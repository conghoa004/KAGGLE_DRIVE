import os
import re
import queue
import threading
import time
import platform
import subprocess
import urllib.request
from urllib.parse import urlsplit
from pathlib import Path
from typing import Optional
from app.config import settings

class CloudflareTunnelService:
    def __init__(self):
        self.process: Optional[subprocess.Popen] = None
        self.public_url: Optional[str] = None
        self.url_verified = False
        self.output_queue = queue.Queue(maxsize=500)
        self.reader_thread: Optional[threading.Thread] = None
        self.binary_path = self._get_binary_path()

    def _get_binary_path(self) -> Path:
        """Determine platform-appropriate binary name and path."""
        system = platform.system().lower()
        if "windows" in system:
            return settings.CLOUDFLARED_DIR / "cloudflared.exe"
        return settings.CLOUDFLARED_DIR / "cloudflared"

    def _get_download_url(self) -> str:
        """Select appropriate cloudflared release asset URL."""
        system = platform.system().lower()
        machine = platform.machine().lower()

        base_url = "https://github.com/cloudflare/cloudflared/releases/latest/download"

        if "linux" in system:
            if "arm" in machine or "aarch64" in machine:
                return f"{base_url}/cloudflared-linux-arm64"
            return f"{base_url}/cloudflared-linux-amd64"
        elif "windows" in system:
            return f"{base_url}/cloudflared-windows-amd64.exe"
        elif "darwin" in system:
            if "arm" in machine:
                return f"{base_url}/cloudflared-darwin-arm64"
            return f"{base_url}/cloudflared-darwin-amd64"
        else:
            return f"{base_url}/cloudflared-linux-amd64"

    def ensure_binary(self) -> Path:
        """Download cloudflared with bounded retries and publish it atomically."""
        if self.binary_path.exists() and self.binary_path.stat().st_size:
            return self.binary_path
        self.binary_path.parent.mkdir(parents=True, exist_ok=True)
        print(f"[*] Downloading Cloudflare Tunnel binary to {self.binary_path}...")
        url = self._get_download_url()
        last_error = None
        for attempt in range(3):
            temp = self.binary_path.with_name(self.binary_path.name + ".download")
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "KaggleCloudDrive/2.0"})
                size = 0
                with urllib.request.urlopen(req, timeout=60) as response, open(temp, "wb") as out:
                    length = response.headers.get("Content-Length")
                    if length and int(length) > 150 * 1024 * 1024:
                        raise RuntimeError("Cloudflared binary response is unexpectedly large.")
                    while True:
                        chunk = response.read(64 * 1024)
                        if not chunk:
                            break
                        size += len(chunk)
                        if size > 150 * 1024 * 1024:
                            raise RuntimeError("Cloudflared binary response is unexpectedly large.")
                        out.write(chunk)
                if size == 0:
                    raise RuntimeError("Cloudflared download was empty.")
                os.replace(temp, self.binary_path)
                if platform.system().lower() != "windows":
                    os.chmod(self.binary_path, 0o755)
                print("[OK] Cloudflare Tunnel binary downloaded.")
                return self.binary_path
            except Exception as exc:
                last_error = exc
                try:
                    temp.unlink(missing_ok=True)
                except Exception:
                    pass
                if attempt < 2:
                    time.sleep(2 ** attempt)
        raise RuntimeError(f"Could not download Cloudflare Tunnel binary after 3 attempts: {last_error}")

    def start_tunnel(self, port: int) -> Optional[str]:
        """Start cloudflared; only quick-tunnel URLs are verified from tunnel output."""
        self.ensure_binary()
        self.stop_tunnel()
        print(f"[*] Starting Cloudflare Tunnel for 127.0.0.1:{port}...")
        if settings.TUNNEL_TOKEN:
            cmd = [str(self.binary_path), "tunnel", "run", "--token", settings.TUNNEL_TOKEN]
        else:
            cmd = [str(self.binary_path), "tunnel", "--no-autoupdate", "--url", f"http://127.0.0.1:{port}"]
        self.output_queue = queue.Queue(maxsize=500)
        self.process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)

        def drain():
            if not self.process or not self.process.stdout:
                return
            for line in self.process.stdout:
                if self.output_queue.full():
                    try:
                        self.output_queue.get_nowait()
                    except queue.Empty:
                        pass
                try:
                    self.output_queue.put_nowait(line.rstrip())
                except queue.Full:
                    pass

        self.reader_thread = threading.Thread(target=drain, daemon=True)
        self.reader_thread.start()
        self.public_url = None
        self.url_verified = False
        deadline = time.monotonic() + (8 if settings.TUNNEL_TOKEN else 40)
        error_lines = []
        pattern = re.compile(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com")
        while time.monotonic() < deadline:
            if self.process.poll() is not None:
                while True:
                    try: error_lines.append(self.output_queue.get_nowait())
                    except queue.Empty: break
                raise RuntimeError("Cloudflare Tunnel exited: " + "\n".join(error_lines[-20:]))
            try:
                line = self.output_queue.get(timeout=0.25)
            except queue.Empty:
                continue
            error_lines.append(line)
            match = pattern.search(line)
            if match:
                self.public_url = match.group(0)
                self.url_verified = True
                return self.public_url
        if settings.TUNNEL_TOKEN:
            if self.process.poll() is not None:
                raise RuntimeError("Named Cloudflare Tunnel process exited: " + "\n".join(error_lines[-20:]))
            configured = settings.TUNNEL_URL
            if configured:
                parsed = urlsplit(configured)
                if parsed.scheme.lower() != "https" or not parsed.hostname:
                    raise RuntimeError("CLOUDFLARE_TUNNEL_URL must be a valid HTTPS URL.")
                self.public_url = configured.rstrip("/")
            return self.public_url
        self.stop_tunnel()
        raise RuntimeError("Timed out waiting for a verified trycloudflare.com URL.")

    def read_output(self, timeout: float = 0.2) -> Optional[str]:
        """Read a line already drained from cloudflared's stdout."""
        try:
            return self.output_queue.get(timeout=timeout)
        except queue.Empty:
            return None

    def stop_tunnel(self):
        """Terminate cloudflared and clear its URL state."""
        if self.process:
            try:
                self.process.terminate()
                self.process.wait(timeout=3)
            except Exception:
                try:
                    self.process.kill()
                except Exception:
                    pass
            finally:
                try:
                    if self.process.stdout:
                        self.process.stdout.close()
                except Exception:
                    pass
                self.process = None
        self.public_url = None
        self.url_verified = False

tunnel_service = CloudflareTunnelService()
