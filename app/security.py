import ipaddress
import secrets
import threading
import time
from collections import OrderedDict
from pathlib import Path
from fastapi import Request, HTTPException, status
from app.config import settings


LOGIN_MAX_ATTEMPTS = 5
LOGIN_WINDOW_SECONDS = 15 * 60
LOGIN_LOCK_SECONDS = 15 * 60
_LOGIN_CLIENT_LIMIT = 4096
_LOGIN_FAILURES = OrderedDict()
_LOGIN_FAILURE_LOCK = threading.Lock()
LOGIN_LOCKOUT_MESSAGE = "\u0110\u0103ng nh\u1eadp sai qu\xe1 nhi\u1ec1u l\u1ea7n. H\xe3y th\u1eed l\u1ea1i sau 15 ph\xfat."


def _login_client_key(request: Request) -> str:
    client = request.client
    peer_host = client.host if client and client.host else "unknown"
    try:
        peer_ip = ipaddress.ip_address(peer_host)
    except ValueError:
        return peer_host

    # cloudflared connects over loopback and supplies the original visitor IP.
    if peer_ip.is_loopback:
        forwarded_ip = request.headers.get("cf-connecting-ip", "").strip()
        try:
            return str(ipaddress.ip_address(forwarded_ip))
        except ValueError:
            pass
    return str(peer_ip)


def _login_lockout_exception(retry_after: int) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail=LOGIN_LOCKOUT_MESSAGE,
        headers={"Retry-After": str(max(1, retry_after))},
    )


def check_login_rate_limit(request: Request) -> None:
    key = _login_client_key(request)
    now = time.monotonic()
    with _LOGIN_FAILURE_LOCK:
        state = _LOGIN_FAILURES.get(key)
        if not state:
            return
        if state["locked_until"] > now:
            _LOGIN_FAILURES.move_to_end(key)
            raise _login_lockout_exception(int(state["locked_until"] - now) + 1)
        if now - state["window_started"] >= LOGIN_WINDOW_SECONDS:
            _LOGIN_FAILURES.pop(key, None)
        else:
            _LOGIN_FAILURES.move_to_end(key)


def record_login_failure(request: Request):
    key = _login_client_key(request)
    now = time.monotonic()
    with _LOGIN_FAILURE_LOCK:
        state = _LOGIN_FAILURES.get(key)
        if state and state["locked_until"] > now:
            _LOGIN_FAILURES.move_to_end(key)
            return int(state["locked_until"] - now) + 1
        if not state or now - state["window_started"] >= LOGIN_WINDOW_SECONDS:
            state = {"count": 0, "window_started": now, "locked_until": 0.0}
        state["count"] += 1
        if state["count"] >= LOGIN_MAX_ATTEMPTS:
            state["locked_until"] = now + LOGIN_LOCK_SECONDS
        if key not in _LOGIN_FAILURES and len(_LOGIN_FAILURES) >= _LOGIN_CLIENT_LIMIT:
            _LOGIN_FAILURES.popitem(last=False)
        _LOGIN_FAILURES[key] = state
        _LOGIN_FAILURES.move_to_end(key)
        if state["locked_until"] > now:
            return LOGIN_LOCK_SECONDS
    return None


def clear_login_failures(request: Request) -> None:
    key = _login_client_key(request)
    with _LOGIN_FAILURE_LOCK:
        _LOGIN_FAILURES.pop(key, None)


def get_safe_path(relative_path: str = "", must_exist: bool = True) -> Path:
    """
    Validates and resolves a relative path against ROOT_DIR.
    Prevents path traversal attacks (e.g., ../../../etc/passwd).
    """
    clean_path = (relative_path or "").strip().lstrip("/\\")
    
    # Resolve the target path
    target = (settings.ROOT_DIR / clean_path).resolve()
    root_resolved = settings.ROOT_DIR.resolve()

    try:
        # Raises ValueError if target is not a subpath of root_resolved
        target.relative_to(root_resolved)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Truy cập bị từ chối: Đường dẫn không hợp lệ hoặc nằm ngoài phạm vi cho phép."
        )

    if must_exist and not target.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tệp hoặc thư mục không tồn tại."
        )

    return target


def require_auth(request: Request):
    """
    Dependency or middleware check to ensure user has active authenticated session.
    """
    if request.session.get("authenticated") is not True:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Yêu cầu đăng nhập để thực hiện tác vụ này."
        )


def verify_credentials(username: str, password: str) -> bool:
    """
    Constant-time comparison to prevent timing attacks.
    """
    if not username or not password:
        return False
    return (
        secrets.compare_digest(username.strip(), settings.USERNAME)
        and secrets.compare_digest(password.strip(), settings.PASSWORD)
    )

