import asyncio
from contextlib import suppress

import httpx
import websockets
from fastapi import APIRouter, HTTPException, Request, WebSocket
from fastapi.responses import RedirectResponse, StreamingResponse
from starlette.background import BackgroundTask

from app.config import settings
from app.security import require_auth
from app.services.code_server_service import code_server_service


router = APIRouter(tags=["ide"])
HOP_BY_HOP_HEADERS = {
    "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
    "te", "trailers", "transfer-encoding", "upgrade",
}
HTTP_METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]


def _ensure_ide_available():
    if not settings.CODE_SERVER_ENABLED:
        raise HTTPException(status_code=404, detail="VS Code Web is disabled.")
    if not code_server_service.is_running():
        raise HTTPException(status_code=503, detail="VS Code Web is not running.")


def _upstream_path(path):
    return "/" + path.lstrip("/")


def _request_headers(headers, host):
    result = {
        name: value
        for name, value in headers.items()
        if name.lower() not in HOP_BY_HOP_HEADERS
        and name.lower() not in {"host", "cookie", "authorization"}
    }
    result["host"] = host
    result["x-forwarded-host"] = host
    result["x-forwarded-prefix"] = "/ide"
    return result


async def _close_http_response(response, client):
    await response.aclose()
    await client.aclose()


@router.api_route("/ide", methods=HTTP_METHODS)
async def ide_root(request: Request):
    require_auth(request)
    _ensure_ide_available()
    return RedirectResponse("/ide/", status_code=307)


@router.api_route("/ide/{path:path}", methods=HTTP_METHODS)
async def proxy_ide_http(request: Request, path: str):
    require_auth(request)
    _ensure_ide_available()

    upstream_path = _upstream_path(path)
    query = request.url.query
    upstream_url = f"http://127.0.0.1:{settings.CODE_SERVER_PORT}{upstream_path}"
    if query:
        upstream_url = f"{upstream_url}?{query}"
    client = httpx.AsyncClient(timeout=None, follow_redirects=False)
    try:
        upstream_request = client.build_request(
            request.method,
            upstream_url,
            headers=_request_headers(request.headers, request.headers.get("host", "localhost")),
            content=request.stream(),
        )
        upstream_response = await client.send(upstream_request, stream=True)
    except Exception as exc:
        await client.aclose()
        raise HTTPException(status_code=502, detail="Could not connect to VS Code Web.") from exc

    response_headers = {
        name: value
        for name, value in upstream_response.headers.items()
        if name.lower() not in HOP_BY_HOP_HEADERS
    }
    return StreamingResponse(
        upstream_response.aiter_raw(),
        status_code=upstream_response.status_code,
        headers=response_headers,
        background=BackgroundTask(_close_http_response, upstream_response, client),
    )


@router.websocket("/ide/{path:path}")
async def proxy_ide_websocket(websocket: WebSocket, path: str):
    if websocket.session.get("authenticated") is not True:
        await websocket.close(code=4401)
        return
    try:
        _ensure_ide_available()
    except HTTPException:
        await websocket.close(code=1013)
        return

    upstream_path = _upstream_path(path)
    query = websocket.url.query
    upstream_url = f"ws://127.0.0.1:{settings.CODE_SERVER_PORT}{upstream_path}"
    if query:
        upstream_url = f"{upstream_url}?{query}"
    host = websocket.headers.get("host", "localhost")
    headers = _request_headers(websocket.headers, host)
    headers = {
        name: value
        for name, value in headers.items()
        if not name.lower().startswith("sec-websocket-") and name.lower() != "origin"
    }
    protocols = [
        item.strip()
        for item in websocket.headers.get("sec-websocket-protocol", "").split(",")
        if item.strip()
    ]
    try:
        async with websockets.connect(
            upstream_url,
            additional_headers=headers,
            subprotocols=protocols or None,
            origin=websocket.headers.get("origin"),
            max_size=None,
            ping_interval=None,
        ) as upstream:
            await websocket.accept(subprotocol=upstream.subprotocol)

            async def browser_to_ide():
                while True:
                    message = await websocket.receive()
                    if message["type"] == "websocket.disconnect":
                        return
                    if message.get("text") is not None:
                        await upstream.send(message["text"])
                    elif message.get("bytes") is not None:
                        await upstream.send(message["bytes"])

            async def ide_to_browser():
                async for message in upstream:
                    if isinstance(message, str):
                        await websocket.send_text(message)
                    else:
                        await websocket.send_bytes(message)

            tasks = {
                asyncio.create_task(browser_to_ide()),
                asyncio.create_task(ide_to_browser()),
            }
            done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
            for task in pending:
                task.cancel()
            await asyncio.gather(*pending, return_exceptions=True)
            for task in done:
                with suppress(Exception):
                    task.result()
            with suppress(Exception):
                await websocket.close()
    except Exception:
        with suppress(Exception):
            await websocket.close(code=1011)
