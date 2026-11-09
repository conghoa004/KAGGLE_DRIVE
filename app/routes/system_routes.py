from fastapi import APIRouter, Request, WebSocket
from app.security import require_auth
from app.services.system_service import SystemService
from app.services.pty_terminal_service import PtyTerminalService

router = APIRouter(prefix="/api/system", tags=["system"])


@router.get("/stats")
def get_system_stats(request: Request):
    """Return disk space, RAM, CPU, and GPU statistics."""
    require_auth(request)
    return SystemService.get_full_stats()


@router.websocket("/terminal/ws")
async def run_terminal_pty(websocket: WebSocket):
    """Open an authenticated interactive PTY session for the browser terminal."""
    await PtyTerminalService.serve(websocket)

