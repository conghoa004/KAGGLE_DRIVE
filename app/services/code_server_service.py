import platform
import posixpath
import re
import shutil
import socket
import subprocess
import tarfile
import time
import urllib.request
from pathlib import Path, PurePosixPath

from app.config import settings


class CodeServerService:
    """Manage the private code-server process proxied through the app."""

    def __init__(self):
        self.process = None
        self.log_handle = None
        self.binary = None

    def _asset_architecture(self):
        machine = platform.machine().lower()
        if machine in ("x86_64", "amd64"):
            return "amd64"
        if machine in ("aarch64", "arm64"):
            return "arm64"
        if machine in ("armv7l", "armv7"):
            return "armv7"
        raise RuntimeError(f"Unsupported code-server architecture: {machine}")

    def _validate_archive(self, archive, destination):
        root = destination.resolve()
        members = archive.getmembers()
        archive_roots = {
            PurePosixPath(member.name).parts[0]
            for member in members
            if PurePosixPath(member.name).parts
        }
        if len(archive_roots) != 1:
            raise RuntimeError("The code-server archive has an unexpected directory structure.")
        archive_root = next(iter(archive_roots))

        for member in members:
            name = PurePosixPath(member.name)
            target = (destination / Path(*name.parts)).resolve()
            if (
                name.is_absolute()
                or not name.parts
                or ".." in name.parts
                or name.parts[0] != archive_root
                or (target != root and root not in target.parents)
            ):
                raise RuntimeError("The code-server archive contains an unsafe path.")
            if member.issym() or member.islnk():
                link = PurePosixPath(member.linkname)
                if link.is_absolute():
                    raise RuntimeError("The code-server archive contains an unsafe link.")
                if member.issym():
                    link_target = PurePosixPath(posixpath.normpath(str(name.parent / link)))
                else:
                    link_target = PurePosixPath(posixpath.normpath(str(link)))
                if (
                    not link_target.parts
                    or link_target.parts[0] != archive_root
                    or ".." in link_target.parts
                ):
                    raise RuntimeError("The code-server archive contains a link outside its package.")
            elif not (member.isdir() or member.isfile()):
                raise RuntimeError("The code-server archive contains an unsupported file type.")

    def ensure_binary(self):
        if settings.CODE_SERVER_BIN:
            configured = Path(settings.CODE_SERVER_BIN).expanduser()
            if configured.is_file():
                return configured.resolve()
            raise RuntimeError(f"CODE_SERVER_BIN does not exist: {configured}")

        installed = shutil.which("code-server")
        if installed:
            return Path(installed)
        if platform.system().lower() != "linux":
            raise RuntimeError("Automatic code-server installation is supported on Linux. On Windows, use WSL and set CODE_SERVER_BIN.")
        if not re.fullmatch(r"\d+\.\d+\.\d+", settings.CODE_SERVER_VERSION):
            raise RuntimeError("CODE_SERVER_VERSION must use a version such as 4.143.1.")

        architecture = self._asset_architecture()
        asset = f"code-server-{settings.CODE_SERVER_VERSION}-linux-{architecture}"
        install_root = settings.CODE_SERVER_DIR
        binary = install_root / asset / "bin" / "code-server"
        if binary.is_file():
            return binary

        install_root.mkdir(parents=True, exist_ok=True)
        archive_path = install_root / f"{asset}.tar.gz"
        temporary_path = install_root / f"{asset}.tar.gz.download"
        if not archive_path.is_file():
            url = f"https://github.com/coder/code-server/releases/download/v{settings.CODE_SERVER_VERSION}/{asset}.tar.gz"
            request = urllib.request.Request(url, headers={"User-Agent": "KaggleCloudDrive/2.0"})
            size = 0
            try:
                with urllib.request.urlopen(request, timeout=60) as response, open(temporary_path, "wb") as output:
                    while True:
                        chunk = response.read(1024 * 1024)
                        if not chunk:
                            break
                        size += len(chunk)
                        if size > 250 * 1024 * 1024:
                            raise RuntimeError("The code-server archive is unexpectedly large.")
                        output.write(chunk)
                if size == 0:
                    raise RuntimeError("The code-server download was empty.")
                temporary_path.replace(archive_path)
            finally:
                temporary_path.unlink(missing_ok=True)

        with tarfile.open(archive_path, "r:gz") as archive:
            self._validate_archive(archive, install_root)
            if hasattr(tarfile, "data_filter"):
                archive.extractall(install_root, filter="data")
            else:
                archive.extractall(install_root)
        archive_path.unlink(missing_ok=True)
        if not binary.is_file():
            raise RuntimeError("The downloaded code-server package did not contain its executable.")
        binary.chmod(binary.stat().st_mode | 0o111)
        return binary

    def is_running(self):
        return bool(self.process and self.process.poll() is None)

    def start(self):
        if not settings.CODE_SERVER_ENABLED:
            return False
        if self.is_running():
            return True
        if settings.CODE_SERVER_PORT == settings.PORT:
            raise RuntimeError("CODE_SERVER_PORT must differ from KAGGLE_DRIVE_PORT.")
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as listener:
            if listener.connect_ex(("127.0.0.1", settings.CODE_SERVER_PORT)) == 0:
                raise RuntimeError(f"CODE_SERVER_PORT {settings.CODE_SERVER_PORT} is already in use.")

        self.binary = self.ensure_binary()
        settings.CODE_SERVER_DIR.mkdir(parents=True, exist_ok=True)
        self.log_handle = open(settings.CODE_SERVER_DIR / "code-server.log", "a", encoding="utf-8")
        command = [
            str(self.binary),
            "--bind-addr", f"127.0.0.1:{settings.CODE_SERVER_PORT}",
            "--auth", "none",
            "--disable-telemetry",
            "--disable-update-check",
            "--user-data-dir", str(settings.CODE_SERVER_DIR / "user-data"),
            str(settings.ROOT_DIR),
        ]
        self.process = subprocess.Popen(
            command,
            stdout=self.log_handle,
            stderr=subprocess.STDOUT,
            cwd=str(settings.ROOT_DIR),
        )

        deadline = time.monotonic() + 20
        while time.monotonic() < deadline:
            if self.process.poll() is not None:
                self.stop()
                raise RuntimeError("code-server exited during startup; see .code_server_bin/code-server.log.")
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{settings.CODE_SERVER_PORT}/", timeout=1):
                    return True
            except Exception:
                time.sleep(0.25)
        self.stop()
        raise RuntimeError("Timed out waiting for code-server; see .code_server_bin/code-server.log.")

    def stop(self):
        if self.process:
            try:
                self.process.terminate()
                self.process.wait(timeout=5)
            except Exception:
                try:
                    self.process.kill()
                except Exception:
                    pass
            finally:
                self.process = None
        if self.log_handle:
            try:
                self.log_handle.close()
            except Exception:
                pass
            self.log_handle = None


code_server_service = CodeServerService()
