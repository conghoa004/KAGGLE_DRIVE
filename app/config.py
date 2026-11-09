import os
import secrets
from pathlib import Path

from dotenv import load_dotenv


load_dotenv(Path(__file__).resolve().parent.parent / ".env", override=False)


def _positive_int_env(name: str, default: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
        return value if value > 0 else default
    except (TypeError, ValueError):
        return default


class Settings:
    def __init__(self):
        # 1. Root Directory Detection
        env_root = os.getenv("KAGGLE_DRIVE_ROOT")
        if env_root:
            self.ROOT_DIR = Path(env_root).resolve()
        elif Path("/").exists():
            self.ROOT_DIR = Path("/").resolve()
        else:
            # Local fallback for development / testing
            local_workspace = Path("./workspace").resolve()
            local_workspace.mkdir(parents=True, exist_ok=True)
            self.ROOT_DIR = local_workspace

        # Ensure ROOT_DIR exists
        self.ROOT_DIR.mkdir(parents=True, exist_ok=True)

        # 2. Server Network Configuration
        self.HOST = os.getenv("KAGGLE_DRIVE_HOST", "127.0.0.1")
        self.PORT = int(os.getenv("KAGGLE_DRIVE_PORT", "8000"))

        # 3. Security & Credentials
        self.USERNAME = os.getenv("KAGGLE_DRIVE_USERNAME", "admin")
        self.PASSWORD = os.getenv("KAGGLE_DRIVE_PASSWORD") or secrets.token_urlsafe(16)
        self.SECRET_KEY = os.getenv("KAGGLE_DRIVE_SECRET_KEY") or secrets.token_urlsafe(32)
        self.SESSION_MAX_AGE = int(os.getenv("SESSION_MAX_AGE", str(24 * 60 * 60)))  # 24 hours

        # 4. Cloudflare Tunnel
        self.ENABLE_TUNNEL = os.getenv("ENABLE_CLOUDFLARE_TUNNEL", "true").lower() in ("true", "1", "yes")
        self.TUNNEL_TOKEN = os.getenv("CLOUDFLARE_TUNNEL_TOKEN", "").strip()
        self.TUNNEL_URL = os.getenv("CLOUDFLARE_TUNNEL_URL", "").strip()
        
        # Install Cloudflared into a system PATH directory on Kaggle so it is
        # available to notebook shells as `cloudflared`.
        if Path("/kaggle/working").exists():
            cache_dir = Path("/usr/local/bin")
        else:
            cache_dir = Path(__file__).resolve().parent.parent / ".cloudflared_bin"

        cache_dir.mkdir(parents=True, exist_ok=True)
        self.CLOUDFLARED_DIR = cache_dir

        # 5. File upload limits & settings
        self.CHUNK_SIZE = 1024 * 1024  # 1MB buffer for streaming uploads
        self.MAX_UPLOAD_BYTES = _positive_int_env("KAGGLE_DRIVE_MAX_UPLOAD_BYTES", 5 * 1024**3)
        self.MAX_BINARY_SAVE_BYTES = _positive_int_env("KAGGLE_DRIVE_MAX_BINARY_SAVE_BYTES", 100 * 1024**2)
        self.MAX_REMOTE_DOWNLOAD_BYTES = _positive_int_env("KAGGLE_DRIVE_MAX_REMOTE_DOWNLOAD_BYTES", 5 * 1024**3)
        self.MAX_ARCHIVE_MEMBERS = _positive_int_env("KAGGLE_DRIVE_MAX_ARCHIVE_MEMBERS", 100000)
        self.MAX_ARCHIVE_UNPACKED_BYTES = _positive_int_env("KAGGLE_DRIVE_MAX_ARCHIVE_UNPACKED_BYTES", 10 * 1024**3)
        self.MAX_TEXT_PREVIEW_SIZE = _positive_int_env("KAGGLE_DRIVE_MAX_TEXT_PREVIEW_BYTES", 10 * 1024**2)

        # 6. Localization
        self.DEFAULT_LANG = os.getenv("KAGGLE_DRIVE_LANG", "vi").lower()
        if self.DEFAULT_LANG not in ("vi", "en", "zh"):
            self.DEFAULT_LANG = "vi"


settings = Settings()