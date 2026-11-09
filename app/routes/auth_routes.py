from fastapi import APIRouter, Request, HTTPException, status
from pydantic import BaseModel
from app.config import settings
from app.security import (
    LOGIN_LOCKOUT_MESSAGE,
    check_login_rate_limit,
    clear_login_failures,
    record_login_failure,
    require_auth,
    verify_credentials,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
async def login(request: Request, payload: LoginRequest):
    """Authenticate user with username and password."""
    check_login_rate_limit(request)
    if not verify_credentials(payload.username, payload.password):
        retry_after = record_login_failure(request)
        if retry_after is not None:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=LOGIN_LOCKOUT_MESSAGE,
                headers={"Retry-After": str(retry_after)},
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tên đăng nhập hoặc mật khẩu không chính xác."
        )

    clear_login_failures(request)
    request.session.clear()
    request.session["authenticated"] = True
    request.session["username"] = payload.username.strip()

    return {
        "status": "success",
        "message": "Đăng nhập thành công.",
        "username": payload.username.strip()
    }


@router.post("/logout")
async def logout(request: Request):
    """Log out user and invalidate session."""
    request.session.clear()
    return {"status": "success", "message": "Đã đăng xuất."}


@router.get("/me")
async def get_current_user(request: Request):
    """Check authentication status."""
    require_auth(request)
    return {
        "authenticated": True,
        "username": request.session.get("username", settings.USERNAME),
        "root_dir": str(settings.ROOT_DIR),
        "default_lang": settings.DEFAULT_LANG
    }

