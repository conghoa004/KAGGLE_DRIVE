from pathlib import Path
from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, JSONResponse
from app.config import settings

router = APIRouter(tags=["views"])

TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates"
INDEX_FILE = TEMPLATE_DIR / "index.html"


@router.get("/")
def get_index(request: Request):
    """Serve the single page application HTML with instant server-side auth hydration."""
    if INDEX_FILE.exists():
        content = INDEX_FILE.read_text(encoding="utf-8")
        is_auth = request.session.get("authenticated") is True
        username = request.session.get("username", settings.USERNAME) if is_auth else ""
        auth_val = "1" if is_auth else "0"

        # Inject server-auth metadata to avoid auth latency
        auth_meta = (
            f'<meta name="server-lang" content="{settings.DEFAULT_LANG}">\n'
            f'  <meta name="server-auth" content="{auth_val}">\n'
            f'  <meta name="server-user" content="{username}">'
        )
        content = content.replace('<meta name="server-lang" content="vi">', auth_meta)

        if is_auth:
            # Pre-render authenticated dashboard immediately (0ms FOUC)
            content = content.replace(
                '<div id="loginView" class="fixed',
                '<div id="loginView" style="display: none;" class="hidden fixed'
            )
            content = content.replace(
                '<div id="appContainer" class="hidden h-screen',
                '<div id="appContainer" style="display: flex;" class="flex h-screen'
            )
            content = content.replace('>admin</span>', f'>{username}</span>')

        return HTMLResponse(content=content, media_type="text/html")
    return JSONResponse(status_code=404, content={"detail": "Index template not found."})


@router.get("/api/config")
async def get_app_config():
    """Public configuration endpoint."""
    return {
        "default_lang": settings.DEFAULT_LANG,
        "supported_languages": ["vi", "en", "zh"]
    }


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "online", "service": "Kaggle Cloud Drive"}
