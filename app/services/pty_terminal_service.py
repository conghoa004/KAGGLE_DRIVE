import asyncio
import os
import signal
import struct
import subprocess
from pathlib import Path
from typing import Optional
from urllib.parse import urlsplit

from fastapi import WebSocket, WebSocketDisconnect

from app.config import settings
from app.security import get_safe_path

if os.name != "nt":
    import fcntl
    import pty
    import termios

_ACTIVE_TERMINALS = asyncio.Semaphore(4)


class PtyTerminalService:
    @staticmethod
    async def serve(websocket: WebSocket) -> None:
        if websocket.scope.get("session", {}).get("authenticated") is not True:
            await websocket.close(code=1008)
            return
        origin = websocket.headers.get("origin")
        host = websocket.headers.get("host", "")
        if origin and urlsplit(origin).netloc.lower() != host.lower():
            await websocket.close(code=1008)
            return

        if os.name == "nt":
            await websocket.accept()
            await websocket.send_json({
                "type": "error",
                "message": "Interactive PTY terminal is supported on Linux/Kaggle only.",
            })
            await websocket.close(code=1011)
            return

        if _ACTIVE_TERMINALS.locked():
            await websocket.accept()
            await websocket.send_json({"type": "error", "message": "All terminal sessions are busy."})
            await websocket.close(code=1013)
            return
        await _ACTIVE_TERMINALS.acquire()

        try:
            requested_cwd = websocket.query_params.get("cwd", "")
            try:
                cwd = get_safe_path(requested_cwd, must_exist=True)
                if not cwd.is_dir():
                    raise ValueError("The selected working directory is not a directory.")
            except Exception:
                await websocket.close(code=1008)
                return

            await websocket.accept()
            await PtyTerminalService._run_shell(websocket, cwd)
        finally:
            _ACTIVE_TERMINALS.release()

    @staticmethod
    async def _run_shell(websocket: WebSocket, cwd: Path) -> None:
        master_fd: Optional[int] = None
        slave_fd: Optional[int] = None
        process: Optional[subprocess.Popen] = None
        output_task = None
        input_task = None
        loop = asyncio.get_running_loop()

        try:
            master_fd, slave_fd = pty.openpty()
            fcntl.ioctl(slave_fd, termios.TIOCSWINSZ, struct.pack("HHHH", 24, 80, 0, 0))

            shell = os.environ.get("SHELL", "/bin/bash")
            if not Path(shell).is_file():
                shell = "/bin/bash" if Path("/bin/bash").is_file() else "/bin/sh"
            if Path(shell).name == "bash":
                argv = [shell, "--noprofile", "--norc", "-i"]
            else:
                argv = [shell, "-i"]

            env = os.environ.copy()
            env["TERM"] = "xterm-256color"
            env["COLORTERM"] = "truecolor"
            env["PS1"] = r"\[\e[1;32m\]kaggle@drive\[\e[0m\]:\[\e[1;34m\]\w\[\e[0m\]\$ "

            def set_controlling_terminal():
                fcntl.ioctl(slave_fd, termios.TIOCSCTTY, 0)

            process = subprocess.Popen(
                argv,
                stdin=slave_fd,
                stdout=slave_fd,
                stderr=slave_fd,
                cwd=str(cwd),
                env=env,
                close_fds=True,
                start_new_session=True,
                preexec_fn=set_controlling_terminal,
            )
            os.close(slave_fd)
            slave_fd = None

            output_queue: asyncio.Queue = asyncio.Queue()

            def read_pty():
                try:
                    chunk = os.read(master_fd, 65536)
                except OSError:
                    loop.remove_reader(master_fd)
                    output_queue.put_nowait(None)
                    return
                if chunk:
                    output_queue.put_nowait(chunk)
                else:
                    loop.remove_reader(master_fd)
                    output_queue.put_nowait(None)

            async def send_output():
                while True:
                    chunk = await output_queue.get()
                    if chunk is None:
                        return
                    await websocket.send_bytes(chunk)

            async def receive_input():
                while True:
                    message = await websocket.receive_json()
                    kind = message.get("type")
                    if kind == "input":
                        data = message.get("data", "")
                        if isinstance(data, str) and data:
                            os.write(master_fd, data.encode("utf-8"))
                    elif kind == "resize":
                        try:
                            cols = max(20, min(int(message.get("cols", 80)), 300))
                            rows = max(2, min(int(message.get("rows", 24)), 120))
                            fcntl.ioctl(master_fd, termios.TIOCSWINSZ, struct.pack("HHHH", rows, cols, 0, 0))
                        except (TypeError, ValueError, OSError):
                            pass

            loop.add_reader(master_fd, read_pty)
            output_task = asyncio.create_task(send_output())
            input_task = asyncio.create_task(receive_input())
            done, pending = await asyncio.wait(
                {output_task, input_task}, return_when=asyncio.FIRST_COMPLETED
            )
            for task in done:
                try:
                    task.result()
                except Exception:
                    pass
            for task in pending:
                task.cancel()
            if pending:
                await asyncio.gather(*pending, return_exceptions=True)
        except (WebSocketDisconnect, RuntimeError, OSError):
            pass
        except Exception as exc:
            try:
                await websocket.send_json({"type": "error", "message": f"Could not start terminal: {exc}"})
            except Exception:
                pass
        finally:
            if master_fd is not None:
                try:
                    loop.remove_reader(master_fd)
                except Exception:
                    pass
            for task in (output_task, input_task):
                if task is not None and not task.done():
                    task.cancel()
            if process is not None and process.poll() is None:
                try:
                    os.killpg(process.pid, signal.SIGTERM)
                except OSError:
                    pass
                try:
                    await asyncio.wait_for(asyncio.to_thread(process.wait), timeout=2)
                except asyncio.TimeoutError:
                    try:
                        os.killpg(process.pid, signal.SIGKILL)
                    except OSError:
                        pass
                    await asyncio.to_thread(process.wait)
            for fd in (slave_fd, master_fd):
                if fd is not None:
                    try:
                        os.close(fd)
                    except OSError:
                        pass
            try:
                await websocket.close(code=1000)
            except Exception:
                pass
