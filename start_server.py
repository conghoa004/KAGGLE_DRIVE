#!/usr/bin/env python3
"""
Kaggle Cloud Drive Server Launcher
Starts the server in the background by default, or keeps it attached to the
current terminal with --foreground.
"""

import os
import sys
import time
import argparse
import re
import subprocess
from pathlib import Path

# Resolve project directory dynamically
PROJECT_DIR = Path(__file__).resolve().parent if "__file__" in globals() else (
    Path("/kaggle/working/kaggle_drive") if Path("/kaggle/working/kaggle_drive").exists() else Path.cwd()
)
os.chdir(str(PROJECT_DIR))

LOG_PATH = PROJECT_DIR / "server.log"
PID_PATH = PROJECT_DIR / "server.pid"


def parse_args():
    parser = argparse.ArgumentParser(
        description="Kaggle Cloud Drive - Background Server Starter",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )
    parser.add_argument(
        "-l", "--lang", "--language",
        dest="lang",
        choices=["vi", "en", "zh"],
        default=None,
        help="Interface language: vi (Tiếng Việt), en (English), zh (简体中文)"
    )
    parser.add_argument("-u", "--username", dest="username", default=None, help="Admin username")
    parser.add_argument("-p", "--password", dest="password", default=None, help="Admin password")
    parser.add_argument("--port", type=int, default=None, help="Port to bind (default: 8000)")
    parser.add_argument("--host", default=None, help="Host to bind (default: 127.0.0.1)")
    parser.add_argument("--root", default=None, help="Root directory to manage")
    parser.add_argument("--no-tunnel", action="store_true", help="Disable Cloudflare Tunnel (local development)")
    parser.add_argument("--token", default=None, help="Cloudflare Tunnel Token (if using named tunnel)")
    parser.add_argument(
        "--foreground",
        action="store_true",
        help="Run in the foreground and stream server output to this terminal"
    )
    parser.add_argument("--wait", type=int, default=300, help="Maximum seconds to wait for server and tunnel startup")

    return parser.parse_known_args()


def get_existing_project_server_pid():
    if not PID_PATH.exists():
        return None, None

    try:
        pid = int(PID_PATH.read_text().strip())
    except (OSError, ValueError):
        PID_PATH.unlink(missing_ok=True)
        return None, None

    try:
        import psutil
    except ImportError as exc:
        return None, f"Cannot verify PID {pid} safely because psutil is unavailable: {exc}"

    try:
        process = psutil.Process(pid)
        process_cwd = Path(process.cwd()).resolve()
        expected_script = (PROJECT_DIR / "run.py").resolve()
        owns_project_script = False
        for argument in process.cmdline():
            if Path(argument).name.lower() != "run.py":
                continue
            script_path = Path(argument)
            if not script_path.is_absolute():
                script_path = process_cwd / script_path
            if script_path.resolve() == expected_script:
                owns_project_script = True
                break

        if (
            process.is_running()
            and process.status() != psutil.STATUS_ZOMBIE
            and process_cwd == PROJECT_DIR.resolve()
            and owns_project_script
        ):
            return pid, None

        PID_PATH.unlink(missing_ok=True)
        return None, None
    except psutil.NoSuchProcess:
        PID_PATH.unlink(missing_ok=True)
        return None, None
    except Exception as exc:
        return None, f"Cannot verify PID {pid} safely: {exc}"


def _server_log_is_current(pid):
    try:
        import psutil
        started_at = psutil.Process(pid).create_time()
        return LOG_PATH.exists() and LOG_PATH.stat().st_mtime >= started_at - 2
    except Exception:
        return False


def read_server_info(pid):
    info = {
        "public_url": None,
        "local_url": None,
        "username": None,
        "password": None,
    }
    if not _server_log_is_current(pid):
        return info

    try:
        content = LOG_PATH.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return info

    ansi_escape = re.compile(r"\x1b\[[0-?]*[ -/]*[@-~]")
    for raw_line in content.splitlines():
        line = ansi_escape.sub("", raw_line).strip()
        for marker, key in (
            ("PUBLIC_READY ", "public_url"),
            ("TUNNEL_URL_CONFIGURED ", "public_url"),
            ("LOCAL_READY ", "local_url"),
        ):
            if line.startswith(marker):
                info[key] = line[len(marker):].strip()

        for label, key in (("Username", "username"), ("Password", "password")):
            match = re.match(rf"^{label}\s*:\s*(.*?)\s*$", line)
            if match:
                info[key] = match.group(1)

    return info


def print_existing_server_info(pid, wait_seconds):
    deadline = time.monotonic() + max(0, wait_seconds)
    info = read_server_info(pid)
    while (
        (not info["local_url"] or not info["password"])
        and time.monotonic() < deadline
        and _server_log_is_current(pid)
    ):
        time.sleep(0.5)
        info = read_server_info(pid)

    print("\n" + "=" * 68)
    print("SERVER ALREADY RUNNING")
    print("=" * 68)
    print(f"PID            : {pid}")
    if info["public_url"]:
        print(f"Public URL     : {info['public_url']}")
    if info["local_url"]:
        print(f"Local URL      : {info['local_url']}")
    if info["username"]:
        print(f"Username       : {info['username']}")
    if info["password"]:
        print(f"Password       : {info['password']}")
    if not info["local_url"] or not info["password"]:
        print("Some startup details are unavailable in this instance's server.log.")
    print("=" * 68)


def stop_existing_server_process(pid):
    current_pid, verification_error = get_existing_project_server_pid()
    if verification_error or current_pid != pid:
        print("[!] The existing server could not be verified for shutdown.")
        return

    try:
        import psutil
        process = psutil.Process(pid)
        if os.name == "nt":
            result = subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(pid)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=10,
            )
            stopped = result.returncode == 0
        else:
            process.terminate()
            try:
                process.wait(timeout=8)
            except psutil.TimeoutExpired:
                process.kill()
                process.wait(timeout=3)
            stopped = True
    except psutil.NoSuchProcess:
        stopped = True
    except Exception as exc:
        print(f"[!] Could not stop the existing server: {exc}")
        return

    if stopped:
        try:
            if PID_PATH.exists() and PID_PATH.read_text().strip() == str(pid):
                PID_PATH.unlink()
        except Exception:
            pass
        print("[OK] Existing server stopped.")
    else:
        print("[!] Could not stop the existing server.")


def attach_to_existing_server(pid, wait_seconds):
    print_existing_server_info(pid, wait_seconds)
    try:
        import psutil
        process = psutil.Process(pid)
    except Exception as exc:
        print(f"[!] Could not attach to server PID {pid}: {exc}")
        return

    log_file = None
    try:
        if LOG_PATH.exists():
            log_file = open(LOG_PATH, "r", encoding="utf-8", errors="replace")
            log_file.seek(0, os.SEEK_END)
    except OSError as exc:
        print(f"[!] Could not read server.log: {exc}")

    print(f"[*] Attached to existing server PID {pid}; showing new log output.")
    print("[*] Press Ctrl+C to stop this server.")
    try:
        while True:
            line = log_file.readline() if log_file else ""
            if line:
                sys.stdout.write(line)
                sys.stdout.flush()

            try:
                running = process.is_running() and process.status() != psutil.STATUS_ZOMBIE
            except psutil.NoSuchProcess:
                running = False
            except psutil.Error as exc:
                print(f"\n[!] Could not inspect server PID {pid}: {exc}")
                break

            if not running:
                try:
                    if PID_PATH.exists() and PID_PATH.read_text().strip() == str(pid):
                        PID_PATH.unlink()
                except Exception:
                    pass
                print("[*] Existing server has stopped.")
                break
            if not line:
                time.sleep(0.2)
    except KeyboardInterrupt:
        print("\n[*] Interrupt received; stopping the existing server...")
        stop_existing_server_process(pid)
    finally:
        if log_file:
            log_file.close()


def main():
    args, extra_args = parse_args()

    existing_pid, verification_error = get_existing_project_server_pid()
    if verification_error:
        print(f"[!] {verification_error}")
        print("[!] Refusing to start another server until the existing PID can be checked.")
        sys.exit(1)
    if existing_pid is not None:
        if args.foreground:
            attach_to_existing_server(existing_pid, args.wait)
        else:
            print_existing_server_info(existing_pid, args.wait)
        return

    # Build run.py command
    cmd = [sys.executable, "-u", "run.py"]

    if args.lang:
        cmd.extend(["--lang", args.lang])
    if args.username:
        cmd.extend(["--username", args.username])
    if args.password:
        cmd.extend(["--password", args.password])
    if args.port:
        cmd.extend(["--port", str(args.port)])
    if args.host:
        cmd.extend(["--host", args.host])
    if args.root:
        cmd.extend(["--root", str(args.root)])
    if args.no_tunnel:
        cmd.append("--no-tunnel")
    if args.token:
        cmd.extend(["--token", args.token])

    # Append any extra arguments
    cmd.extend(extra_args)

    mode = "foreground" if args.foreground else "background"
    print(f"[*] Starting Kaggle Cloud Drive in {mode}...")
    safe_cmd = []
    hide_next = False
    for part in cmd:
        if hide_next:
            safe_cmd.append("***")
            hide_next = False
        elif part in ("--password", "--token"):
            safe_cmd.append(part)
            hide_next = True
        elif part.startswith("--password=") or part.startswith("--token="):
            safe_cmd.append(part.split("=", 1)[0] + "=***")
        else:
            safe_cmd.append(part)
    print(f"[*] Command: {' '.join(safe_cmd)}")

    if args.foreground:
        # Tee output to the terminal and server.log so later launches can show the server details.
        log_file = open(LOG_PATH, "w", buffering=1, encoding="utf-8", errors="replace")
        try:
            server = subprocess.Popen(
                cmd,
                cwd=str(PROJECT_DIR),
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                bufsize=1,
            )
        except Exception:
            log_file.close()
            raise
        try:
            PID_PATH.write_text(str(server.pid))
        except Exception:
            pass
        globals()["server"] = server
        print(f"[*] Server is attached to this terminal (PID: {server.pid}). Press Ctrl+C to stop.")

        try:
            if server.stdout:
                for line in server.stdout:
                    sys.stdout.write(line)
                    sys.stdout.flush()
                    log_file.write(line)
            return_code = server.wait()
        except KeyboardInterrupt:
            print("\n[*] Interrupt received; waiting for the server to shut down...")
            try:
                return_code = server.wait(timeout=10)
            except subprocess.TimeoutExpired:
                server.terminate()
                try:
                    return_code = server.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    server.kill()
                    return_code = server.wait()
        finally:
            try:
                if server.stdout:
                    server.stdout.close()
            except Exception:
                pass
            log_file.close()
            try:
                if PID_PATH.exists() and PID_PATH.read_text().strip() == str(server.pid):
                    PID_PATH.unlink()
            except Exception:
                pass

        print(f"Server status: STOPPED (exit code: {return_code})")
        if return_code:
            sys.exit(return_code)
        return

    # Open log file for output
    log_file = open(LOG_PATH, "w", buffering=1, encoding="utf-8", errors="replace")

    # Start the server process in background
    popen_kwargs = {
        "cwd": str(PROJECT_DIR),
        "stdout": log_file,
        "stderr": subprocess.STDOUT,
    }

    if os.name != "nt":
        popen_kwargs["start_new_session"] = True
    else:
        popen_kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP

    server = subprocess.Popen(cmd, **popen_kwargs)

    # Save PID to file for stop_server.py
    try:
        PID_PATH.write_text(str(server.pid))
    except Exception:
        pass

    # Save server instance in globals for interactive notebook cells
    globals()["server"] = server

    print(f"[*] Server process spawned (PID: {server.pid}).")
    print(f"[*] Waiting for server & Cloudflare Tunnel to be ready (timeout: {args.wait}s)...")

    # Poll log file for readiness
    start_time = time.time()
    ready_state = None

    while time.time() - start_time < args.wait:
        # Check if process exited prematurely
        if server.poll() is not None:
            break

        if LOG_PATH.exists():
            try:
                with open(LOG_PATH, "r", encoding="utf-8", errors="replace") as f:
                    content = f.read()

                if "PUBLIC_READY " in content:
                    ready_state = "public"
                    break
                if "TUNNEL_RUNNING" in content:
                    ready_state = "tunnel_unverified"
                    break
                if "LOCAL_ONLY" in content:
                    ready_state = "local"
                    break
            except Exception:
                pass

        time.sleep(0.5)

    # Print server log output
    print("\n" + "=" * 68)
    print("                    SERVER STARTUP LOGS")
    print("=" * 68)
    if LOG_PATH.exists():
        with open(LOG_PATH, "r", encoding="utf-8", errors="replace") as f:
            log_content = f.read().strip()
            print(log_content if log_content else "(Log file is empty)")
    print("=" * 68 + "\n")

    # Status check
    is_running = server.poll() is None
    labels = {
        "public": "RUNNING (Public URL verified)",
        "tunnel_unverified": "RUNNING (Tunnel process running; URL unverified)",
        "local": "RUNNING (Local only)",
    }
    status_label = labels.get(ready_state, "RUNNING (Still starting)") if is_running else "STOPPED"
    print(f"Server status: {status_label} (PID: {server.pid if is_running else 'None'})")

    if not is_running:
        print(f"[!] Server process exited unexpectedly with code {server.poll()}.")
        sys.exit(1)


if __name__ == "__main__":
    main()
