#!/usr/bin/env python3
"""
Kaggle Cloud Drive - Production Launcher
FastAPI + Cloudflare Tunnel
"""

import sys
import time
import signal
import socket
import argparse
import subprocess
import threading
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

# Auto-install dependencies if missing (optimized for Python 3.10 - 3.13+)
def ensure_dependencies():
    package_specs = {
        "fastapi>=0.115.0": "fastapi",
        "uvicorn>=0.30.0": "uvicorn",
        "itsdangerous>=2.2.0": "itsdangerous",
        "python-multipart>=0.0.12": "multipart",
        "pydantic>=2.9.0": "pydantic",
        "python-dotenv>=1.0.1": "dotenv",
        "psutil>=6.0.0": "psutil",
        "httpx>=0.27.0": "httpx",
        "websockets>=14.0": "websockets",
    }
    missing_packages = []
    for pkg_spec, mod_name in package_specs.items():
        try:
            __import__(mod_name)
        except ImportError:
            missing_packages.append(pkg_spec)

    if missing_packages:
        print(f"[*] Installing required dependencies for Python {sys.version.split()[0]}: {', '.join(missing_packages)}...")
        subprocess.run([sys.executable, "-m", "pip", "install", "-q"] + missing_packages, check=True)


import urllib.request
def is_port_in_use(port: int, host: str = "127.0.0.1") -> bool:
    """Check if a network port is already bound."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex((host, port)) == 0


def stop_previous_project_server(port: int) -> tuple[bool, str]:
    """Stop a listener only when it is this project's previous run.py process."""
    try:
        import psutil
    except ImportError:
        return False, "psutil is unavailable, so the listener cannot be identified safely."

    try:
        listeners = [
            connection
            for connection in psutil.net_connections(kind="inet")
            if connection.status == psutil.CONN_LISTEN
            and connection.laddr
            and connection.laddr.port == port
        ]
    except (psutil.AccessDenied, OSError) as exc:
        return False, f"Could not inspect port {port} safely: {exc}"

    project_dir = Path(__file__).resolve().parent
    expected_script = (project_dir / "run.py").resolve()
    project_processes = {}
    unidentified = []

    for connection in listeners:
        if connection.pid is None:
            unidentified.append("unknown PID")
            continue
        try:
            process = psutil.Process(connection.pid)
            cwd = Path(process.cwd()).resolve()
            command = process.cmdline()
            owns_project_script = any(
                Path(argument).name.lower() == "run.py"
                and (Path(argument) if Path(argument).is_absolute() else cwd / argument).resolve() == expected_script
                for argument in command
            )
            if cwd == project_dir and owns_project_script:
                project_processes[process.pid] = process
            else:
                unidentified.append(f"PID {process.pid}")
        except psutil.NoSuchProcess:
            continue
        except (psutil.AccessDenied, OSError, ValueError) as exc:
            unidentified.append(f"PID {connection.pid} (cannot verify: {exc})")

    if not project_processes:
        detail = ", ".join(unidentified) if unidentified else "listener process could not be identified"
        return False, f"Port {port} is occupied by {detail}; no process was terminated."

    stopped_pids = []
    for pid, process in project_processes.items():
        try:
            process.terminate()
            try:
                process.wait(timeout=5)
            except psutil.TimeoutExpired:
                process.kill()
                process.wait(timeout=3)
            stopped_pids.append(pid)
        except psutil.NoSuchProcess:
            stopped_pids.append(pid)
        except (psutil.AccessDenied, psutil.TimeoutExpired, OSError) as exc:
            return False, f"Could not stop project server PID {pid}: {exc}"

    deadline = time.monotonic() + 3
    while is_port_in_use(port) and time.monotonic() < deadline:
        time.sleep(0.1)
    if is_port_in_use(port):
        remaining = ", ".join(unidentified) if unidentified else "another listener"
        return False, f"Stopped project server PID(s) {stopped_pids}, but port {port} remains occupied by {remaining}."

    return True, f"Stopped previous Kaggle Cloud Drive process(es): {stopped_pids}."


def print_banner(public_url: str | None, username: str, password: str, root_dir: Path, lang: str = "vi"):
    """Display modern terminal banner."""
    sep = "=" * 68
    lang_labels = {
        "vi": "Tiếng Việt (vi) 🇻🇳",
        "en": "English (en) 🇺🇸",
        "zh": "简体中文 (zh) 🇨🇳"
    }
    lang_str = lang_labels.get(lang, lang)
    print("\n" + sep)
    if public_url and tunnel_service.url_verified:
        ready_text = 'KAGGLE CLOUD DRIVE IS READY'
    elif public_url:
        ready_text = 'KAGGLE CLOUD DRIVE IS READY (TUNNEL URL UNVERIFIED)'
    else:
        ready_text = 'KAGGLE CLOUD DRIVE IS READY (LOCAL ONLY)'
    print(f'           {ready_text}')
    print(sep)
    if public_url and tunnel_service.url_verified:
        print(f"  Public URL       : \033[92m{public_url}\033[0m")
    elif public_url:
        print(f"  Configured URL   : {public_url} (tunnel status unverified)")
    else:
        print("  Public URL       : unavailable (local-only mode)")
    print(f"  Local URL        : http://127.0.0.1:{settings.PORT}")
    print(f"  Username         : \033[96m{username}\033[0m")
    print(f"  Password         : \033[93m{password}\033[0m")
    print(f"  Default Language : \033[95m{lang_str}\033[0m")
    print(f"  Target Root      : {root_dir}")
    print(sep)
    print("  Tips:")
    print("  • Keep this cell running while you access the web interface.")
    print("  • Drag & drop any files into the browser to upload directly.")
    print("  • Edit code with Ctrl+S, preview images, videos & notebooks.")
    print("  • Switch language anytime via CLI (--lang vi|en|zh) or Topbar UI.")
    print(sep + "\n")


def main():
    ensure_dependencies()
    global settings, tunnel_service
    from app.config import settings
    from app.services.tunnel_service import tunnel_service

    parser = argparse.ArgumentParser(description="Kaggle Cloud Drive Server")
    parser.add_argument("--host", default=settings.HOST, help="Host to bind (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=settings.PORT, help="Port to bind (default: 8000)")
    parser.add_argument("--root", default=str(settings.ROOT_DIR), help="Root directory to manage")
    parser.add_argument("--username", default=settings.USERNAME, help="Admin username")
    parser.add_argument("--password", default=None, help="Admin password (leave blank to auto-generate)")
    parser.add_argument("-l", "--lang", "--language", dest="lang", default=settings.DEFAULT_LANG, choices=["vi", "en", "zh"], help="Default interface language: vi (Tiếng Việt), en (English), zh (简体中文) (default: vi)")
    parser.add_argument("--no-tunnel", action="store_true", help="Disable Cloudflare Tunnel (local development)")
    parser.add_argument("--token", default=None, help="Cloudflare Tunnel Token (if using named tunnel)")

    args = parser.parse_args()

    # Apply CLI overrides to settings
    settings.HOST = args.host
    settings.PORT = args.port
    settings.ROOT_DIR = Path(args.root).resolve()
    settings.ROOT_DIR.mkdir(parents=True, exist_ok=True)
    settings.USERNAME = args.username

    if args.lang:
        settings.DEFAULT_LANG = args.lang.lower()

    if args.password:
        settings.PASSWORD = args.password

    if args.token:
        settings.TUNNEL_TOKEN = args.token

    if args.no_tunnel:
        settings.ENABLE_TUNNEL = False

    if is_port_in_use(settings.PORT):
        print(f"[*] Port {settings.PORT} is already in use; checking for a previous Kaggle Cloud Drive process...")
        freed, message = stop_previous_project_server(settings.PORT)
        if freed:
            print(f"[OK] {message}")
        else:
            print(f"[!] {message} Choose another port or stop that process manually.")
            sys.exit(1)

    import uvicorn
    from app.main import app

    # Start FastAPI in a background thread
    print(f"[*] Starting FastAPI server on {settings.HOST}:{settings.PORT}...")
    config = uvicorn.Config(
        app,
        host=settings.HOST,
        port=settings.PORT,
        log_level="warning",
        access_log=False
    )
    server = uvicorn.Server(config)
    server_thread = threading.Thread(target=server.run, daemon=True)
    server_thread.start()

    # Wait for FastAPI server to become healthy
    health_url = f"http://127.0.0.1:{settings.PORT}/health"
    started = False
    for _ in range(30):
        try:
            req = urllib.request.Request(health_url)
            with urllib.request.urlopen(req, timeout=1) as res:
                if res.status == 200:
                    started = True
                    break
        except Exception:
            time.sleep(0.5)

    if not started:
        print("[!] Failed to verify FastAPI server startup.")
        sys.exit(1)

    print("[✓] FastAPI server is healthy and responding.")

    from app.services.code_server_service import code_server_service
    if settings.CODE_SERVER_ENABLED:
        try:
            code_server_service.start()
            print(f"[OK] VS Code Web is ready at http://127.0.0.1:{settings.PORT}/ide/")
        except Exception as e:
            print(f"[!] VS Code Web could not start: {e}")
            print("[*] Kaggle Cloud Drive will continue without the IDE.")
    else:
        print("[*] VS Code Web is disabled (ENABLE_CODE_SERVER=false).")

    local_url = f"http://127.0.0.1:{settings.PORT}"
    public_url = None
    print(f"LOCAL_READY {local_url}", flush=True)
    if settings.ENABLE_TUNNEL:
        try:
            public_url = tunnel_service.start_tunnel(settings.PORT)
            process_alive = tunnel_service.process and tunnel_service.process.poll() is None
            if tunnel_service.url_verified and process_alive:
                print(f"PUBLIC_READY {public_url}", flush=True)
            elif process_alive:
                print("TUNNEL_RUNNING (public URL not verified)", flush=True)
                if public_url:
                    print(f"TUNNEL_URL_CONFIGURED {public_url}", flush=True)
            else:
                tunnel_service.stop_tunnel()
                public_url = None
                print("LOCAL_ONLY", flush=True)
        except Exception as e:
            tunnel_service.stop_tunnel()
            print(f"[!] Cloudflare Tunnel error: {e}")
            print(f"[*] Continuing in local-only mode: {local_url}")
            print("LOCAL_ONLY", flush=True)
    else:
        print("LOCAL_ONLY", flush=True)

    print_banner(
        public_url=public_url,
        username=settings.USERNAME,
        password=settings.PASSWORD,
        root_dir=settings.ROOT_DIR,
        lang=settings.DEFAULT_LANG
    )

    # Keep main thread alive and handle clean shutdown
    def handle_shutdown(signum, frame):
        print("\n[*] Shutting down Kaggle Cloud Drive...")
        tunnel_service.stop_tunnel()
        code_server_service.stop()
        server.should_exit = True
        sys.exit(0)

    signal.signal(signal.SIGINT, handle_shutdown)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, handle_shutdown)

    try:
        # Stream cloudflared output or idle wait
        while server_thread.is_alive():
            if tunnel_service.process:
                line = tunnel_service.read_output(timeout=1)
                if line and "error" in line.lower():
                    print(f"[Cloudflare] {line}")
            else:
                time.sleep(1)
    except KeyboardInterrupt:
        handle_shutdown(None, None)


if __name__ == "__main__":
    main()
