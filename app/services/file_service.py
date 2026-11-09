import ipaddress
import mimetypes
import os
import re
import time
import base64
import shutil
import socket
import stat as stat_module
import tempfile
import tarfile
import zipfile
import urllib.request
import http.client
from urllib.parse import urlsplit, urljoin, unquote
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
from fastapi import HTTPException, UploadFile, status

from app.config import settings
from app.security import get_safe_path

# Extended MIME types and category classification
EXTENSION_CATEGORIES = {
    # Images
    "jpg": "image", "jpeg": "image", "png": "image", "gif": "image",
    "webp": "image", "svg": "image", "bmp": "image", "ico": "image",
    "avif": "image", "tiff": "image", "tif": "image",
    # Video
    "mp4": "video", "webm": "video", "mkv": "video", "avi": "video",
    "mov": "video", "flv": "video", "wmv": "video", "m4v": "video",
    # Audio
    "mp3": "audio", "wav": "audio", "ogg": "audio", "flac": "audio",
    "m4a": "audio", "aac": "audio", "wma": "audio", "opus": "audio",
    # Code & Notebooks
    "py": "code", "ipynb": "notebook", "js": "code", "ts": "code",
    "html": "code", "css": "code", "json": "code", "yaml": "code",
    "yml": "code", "sh": "code", "bash": "code", "sql": "code",
    "c": "code", "cpp": "code", "h": "code", "java": "code",
    "rs": "code", "go": "code", "r": "code",
    # Text & Documents
    "txt": "text", "md": "markdown", "log": "text", "ini": "text",
    "conf": "text", "env": "text", "pdf": "pdf",
    # Spreadsheets & Data
    "csv": "spreadsheet", "tsv": "spreadsheet", "xlsx": "spreadsheet", "xls": "spreadsheet",
    "parquet": "data", "pkl": "data", "h5": "data", "pt": "data", "pth": "data", "bin": "data",
    "safetensors": "data", "onnx": "data",
    # Archives
    "zip": "archive", "tar": "archive", "gz": "archive", "tgz": "archive",
    "bz2": "archive", "7z": "archive", "rar": "archive"
}

MAX_PROPERTIES_SCAN_ENTRIES = 100000


MEDIA_MIMETYPES = {
    # Images
    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "gif": "image/gif",
    "webp": "image/webp", "svg": "image/svg+xml", "bmp": "image/bmp", "ico": "image/x-icon",
    "tiff": "image/tiff", "tif": "image/tiff", "avif": "image/avif",
    # Audio
    "mp3": "audio/mpeg", "wav": "audio/wav", "ogg": "audio/ogg", "flac": "audio/flac",
    "m4a": "audio/mp4", "aac": "audio/aac", "wma": "audio/x-ms-wma", "opus": "audio/opus",
    # Video
    "mp4": "video/mp4", "webm": "video/webm", "mkv": "video/webm",
    "avi": "video/x-msvideo", "mov": "video/quicktime", "flv": "video/x-flv", "m4v": "video/mp4",
    # Documents & Spreadsheets
    "pdf": "application/pdf",
    "csv": "text/csv; charset=utf-8",
    "tsv": "text/tab-separated-values; charset=utf-8",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "xls": "application/vnd.ms-excel"
}


def format_size(bytes_num: int) -> str:
    """Format file size into human-readable string."""
    if bytes_num < 1024:
        return f"{bytes_num} B"
    elif bytes_num < 1024 * 1024:
        return f"{bytes_num / 1024:.1f} KB"
    elif bytes_num < 1024 * 1024 * 1024:
        return f"{bytes_num / (1024 * 1024):.1f} MB"
    else:
        return f"{bytes_num / (1024 * 1024 * 1024):.2f} GB"


def get_file_category(extension: str) -> str:
    """Determine UI category for icon and previewer."""
    return EXTENSION_CATEGORIES.get(extension.lower(), "generic")


class FileService:

    @staticmethod
    def list_directory(rel_path: str = "", show_hidden: bool = False) -> Dict[str, Any]:
        """List files and folders in the target directory."""
        folder = get_safe_path(rel_path, must_exist=True)
        if not folder.is_dir():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Đường dẫn chỉ định không phải là một thư mục."
            )

        items = []
        try:
            for item in folder.iterdir():
                if not show_hidden and item.name.startswith("."):
                    continue

                is_dir = item.is_dir()
                try:
                    stat = item.stat()
                    size = stat.st_size if not is_dir else 0
                    mtime = datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S")
                except OSError:
                    size = 0
                    mtime = "-"

                ext = item.suffix.lstrip(".") if not is_dir else ""
                category = "folder" if is_dir else get_file_category(ext)

                rel_item_path = str(item.relative_to(settings.ROOT_DIR)).replace("\\", "/")

                items.append({
                    "name": item.name,
                    "path": rel_item_path,
                    "is_dir": is_dir,
                    "size": size,
                    "formatted_size": "—" if is_dir else format_size(size),
                    "mtime": mtime,
                    "extension": ext.lower(),
                    "category": category,
                })
        except PermissionError:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Không có quyền truy cập vào thư mục này."
            )

        # Sort: Folders first, then alphabetically case-insensitive
        items.sort(key=lambda x: (not x["is_dir"], x["name"].lower()))

        # Determine parent path
        clean_rel = rel_path.strip().replace("\\", "/").strip("/")
        parent_path = str(Path(clean_rel).parent).replace("\\", "/") if clean_rel else None
        if parent_path == ".":
            parent_path = ""

        return {
            "current_path": clean_rel,
            "root_dir": str(settings.ROOT_DIR),
            "parent_path": parent_path,
            "folder_name": folder.name if clean_rel else "working",
            "items": items,
            "total_items": len(items)
        }

    @staticmethod
    def get_properties(rel_path: str) -> Dict[str, Any]:
        """Return file or folder metadata without following nested symlinks."""
        clean_rel = (rel_path or "").strip().replace("\\", "/").strip("/")
        target = get_safe_path(clean_rel, must_exist=True)
        try:
            info = target.stat()
        except OSError:
            raise HTTPException(status_code=403, detail="Cannot read properties for this item.")

        is_dir = target.is_dir()
        is_file = target.is_file()
        size = info.st_size
        files_count = 0
        folders_count = 0
        size_complete = True

        if is_dir:
            size = 0
            pending = [target]
            scanned_entries = 0
            while pending:
                directory = pending.pop()
                try:
                    with os.scandir(directory) as entries:
                        for entry in entries:
                            if scanned_entries >= MAX_PROPERTIES_SCAN_ENTRIES:
                                size_complete = False
                                pending.clear()
                                break
                            scanned_entries += 1
                            try:
                                if entry.is_symlink():
                                    continue
                                if entry.is_dir(follow_symlinks=False):
                                    folders_count += 1
                                    pending.append(Path(entry.path))
                                elif entry.is_file(follow_symlinks=False):
                                    files_count += 1
                                    size += entry.stat(follow_symlinks=False).st_size
                            except OSError:
                                size_complete = False
                except OSError:
                    size_complete = False

        name = Path(clean_rel).name if clean_rel else (target.name or "working")
        extension = Path(name).suffix.lstrip(".").lower() if is_file else ""
        created_at = None
        birth_time = getattr(info, "st_birthtime", None)
        if birth_time is not None:
            created_at = datetime.fromtimestamp(birth_time).strftime("%Y-%m-%d %H:%M:%S")

        return {
            "name": name,
            "path": clean_rel,
            "parent_path": clean_rel.rpartition("/")[0],
            "is_dir": is_dir,
            "is_file": is_file,
            "extension": extension,
            "mime_type": (mimetypes.guess_type(name)[0] or "application/octet-stream") if is_file else None,
            "size": size,
            "formatted_size": format_size(size),
            "files_count": files_count,
            "folders_count": folders_count,
            "size_complete": size_complete,
            "created_at": created_at,
            "modified_at": datetime.fromtimestamp(info.st_mtime).strftime("%Y-%m-%d %H:%M:%S"),
            "permissions": format(stat_module.S_IMODE(info.st_mode), "04o"),
        }

    @staticmethod
    def read_text_file(rel_path: str) -> Dict[str, Any]:
        """Read text file content for the code/text editor."""
        file_path = get_safe_path(rel_path, must_exist=True)
        if not file_path.is_file():
            raise HTTPException(status_code=400, detail="Không phải tệp tin.")

        file_size = file_path.stat().st_size
        if file_size > settings.MAX_TEXT_PREVIEW_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"Tệp quá lớn ({format_size(file_size)}) để mở trong trình chỉnh sửa web (tối đa 10MB)."
            )

        # Attempt UTF-8 then fallback to Latin-1
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
            encoding = "utf-8"
        except UnicodeDecodeError:
            try:
                with open(file_path, "r", encoding="latin-1") as f:
                    content = f.read()
                encoding = "latin-1"
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Không thể đọc mã hóa của tệp: {str(e)}")

        ext = file_path.suffix.lstrip(".").lower()
        return {
            "name": file_path.name,
            "path": rel_path,
            "content": content,
            "size": file_size,
            "extension": ext,
            "encoding": encoding,
            "category": get_file_category(ext)
        }

    @staticmethod
    def write_text_file(rel_path: str, content: str) -> Dict[str, Any]:
        """Save edited text atomically within the configured byte limit."""
        file_path = get_safe_path(rel_path, must_exist=False)
        payload = content.encode("utf-8")
        if len(payload) > settings.MAX_TEXT_PREVIEW_SIZE:
            raise HTTPException(status_code=413, detail="Text content exceeds the configured size limit.")

        file_path.parent.mkdir(parents=True, exist_ok=True)
        temp_path = None
        try:
            with tempfile.NamedTemporaryFile(
                mode="wb", dir=file_path.parent, prefix=".save-", delete=False
            ) as temp_file:
                temp_path = Path(temp_file.name)
                temp_file.write(payload)
            os.replace(temp_path, file_path)
        except Exception as exc:
            if temp_path:
                temp_path.unlink(missing_ok=True)
            raise HTTPException(status_code=500, detail=f"Could not save file: {exc}")

        return {
            "status": "success",
            "message": "File saved.",
            "size": file_path.stat().st_size,
        }

    @staticmethod
    def write_binary_file(rel_path: str, content_b64: str) -> Dict[str, Any]:
        """Decode and atomically save bounded base64 binary content."""
        encoded_limit = ((settings.MAX_BINARY_SAVE_BYTES + 2) // 3) * 4
        if len(content_b64) > encoded_limit:
            raise HTTPException(status_code=413, detail="Binary content exceeds the configured size limit.")
        try:
            payload = base64.b64decode(content_b64, validate=True)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Invalid base64 data: {exc}")
        if len(payload) > settings.MAX_BINARY_SAVE_BYTES:
            raise HTTPException(status_code=413, detail="Binary content exceeds the configured size limit.")

        file_path = get_safe_path(rel_path, must_exist=False)
        file_path.parent.mkdir(parents=True, exist_ok=True)
        temp_path = None
        try:
            with tempfile.NamedTemporaryFile(
                mode="wb", dir=file_path.parent, prefix=".save-", delete=False
            ) as temp_file:
                temp_path = Path(temp_file.name)
                temp_file.write(payload)
            os.replace(temp_path, file_path)
        except Exception as exc:
            if temp_path:
                temp_path.unlink(missing_ok=True)
            raise HTTPException(status_code=500, detail=f"Could not save binary file: {exc}")

        return {
            "status": "success",
            "message": "Binary file saved.",
            "size": file_path.stat().st_size,
        }

    @staticmethod
    def save_uploaded_file(
        target_folder_rel: str,
        upload_file: UploadFile,
        relative_filename: Optional[str] = None,
        max_bytes: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Stream a bounded upload to a temporary file and atomically publish it."""
        base_folder = get_safe_path(target_folder_rel, must_exist=True)
        if not base_folder.is_dir():
            raise HTTPException(status_code=400, detail="Upload destination must be a directory.")

        raw_name = (relative_filename or upload_file.filename or "uploaded_file").replace("\\", "/")
        parts = [part for part in raw_name.split("/") if part not in ("", ".")]
        if raw_name.startswith("/") or not parts or any(
            part == ".." or ":" in part for part in parts
        ):
            raise HTTPException(status_code=400, detail="Invalid upload filename.")

        dest_path = base_folder.joinpath(*parts).resolve()
        try:
            dest_path.relative_to(base_folder.resolve())
            dest_path.relative_to(settings.ROOT_DIR.resolve())
        except ValueError:
            raise HTTPException(status_code=403, detail="Upload destination escapes the configured root.")

        dest_path.parent.mkdir(parents=True, exist_ok=True)
        limit = settings.MAX_UPLOAD_BYTES if max_bytes is None else min(
            max_bytes, settings.MAX_UPLOAD_BYTES
        )
        temp_path = None
        bytes_written = 0
        try:
            with tempfile.NamedTemporaryFile(
                mode="wb", dir=dest_path.parent, prefix=".upload-", delete=False
            ) as output:
                temp_path = Path(output.name)
                while True:
                    chunk = upload_file.file.read(settings.CHUNK_SIZE)
                    if not chunk:
                        break
                    if bytes_written + len(chunk) > limit:
                        raise HTTPException(
                            status_code=413, detail="Upload exceeds the configured size limit."
                        )
                    output.write(chunk)
                    bytes_written += len(chunk)
            os.replace(temp_path, dest_path)
        except HTTPException:
            if temp_path:
                temp_path.unlink(missing_ok=True)
            raise
        except Exception as exc:
            if temp_path:
                temp_path.unlink(missing_ok=True)
            raise HTTPException(status_code=500, detail=f"Could not save uploaded file: {exc}")
        finally:
            upload_file.file.close()

        return {
            "filename": dest_path.name,
            "path": str(dest_path.relative_to(settings.ROOT_DIR.resolve())).replace("\\", "/"),
            "size": bytes_written,
            "formatted_size": format_size(bytes_written),
        }

    @staticmethod
    def create_directory(rel_path: str) -> Dict[str, Any]:
        """Create a new directory."""
        target = get_safe_path(rel_path, must_exist=False)
        if target.exists():
            raise HTTPException(status_code=400, detail="Thư mục hoặc tệp tin đã tồn tại.")

        target.mkdir(parents=True, exist_ok=True)
        return {"status": "success", "message": f"Đã tạo thư mục '{target.name}'"}

    @staticmethod
    def create_empty_file(rel_path: str) -> Dict[str, Any]:
        """Create an empty new file."""
        target = get_safe_path(rel_path, must_exist=False)
        if target.exists():
            raise HTTPException(status_code=400, detail="Tệp tin đã tồn tại.")

        target.parent.mkdir(parents=True, exist_ok=True)
        target.touch()
        return {"status": "success", "message": f"Đã tạo tệp '{target.name}'"}

    @staticmethod
    def delete_item(rel_path: str) -> Dict[str, Any]:
        """Delete a file or recursively delete a directory."""
        target = get_safe_path(rel_path, must_exist=True)

        # Prevent deleting ROOT_DIR itself
        if target.resolve() == settings.ROOT_DIR.resolve():
            raise HTTPException(status_code=403, detail="Không thể xóa thư mục gốc!")

        try:
            if target.is_dir():
                shutil.rmtree(target)
            else:
                target.unlink()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Không thể xóa: {str(e)}")

        return {"status": "success", "message": f"Đã xóa '{target.name}'"}

    @staticmethod
    def rename_item(rel_path: str, new_name: str) -> Dict[str, Any]:
        """Rename a file or folder safely within its parent directory."""
        target = get_safe_path(rel_path, must_exist=True)

        # Sanitize new_name to avoid path injection
        clean_new_name = os.path.basename(new_name.strip())
        if not clean_new_name or clean_new_name in (".", ".."):
            raise HTTPException(status_code=400, detail="Tên mới không hợp lệ.")

        new_target = target.parent / clean_new_name
        if new_target.exists():
            raise HTTPException(status_code=400, detail="Tên mới đã tồn tại.")

        try:
            target.rename(new_target)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Lỗi đổi tên: {str(e)}")

        new_rel_path = str(new_target.relative_to(settings.ROOT_DIR)).replace("\\", "/")
        return {
            "status": "success",
            "message": f"Đã đổi tên thành '{clean_new_name}'",
            "new_path": new_rel_path
        }

    @staticmethod
    def copy_item(source_rel: str, dest_folder_rel: str) -> Dict[str, Any]:
        """Copy an item while rejecting recursive directory copies."""
        source = get_safe_path(source_rel, must_exist=True)
        dest_folder = get_safe_path(dest_folder_rel, must_exist=True)
        if not dest_folder.is_dir():
            raise HTTPException(status_code=400, detail="Destination must be a directory.")

        if source.is_dir():
            try:
                dest_folder.resolve().relative_to(source.resolve())
            except ValueError:
                pass
            else:
                raise HTTPException(
                    status_code=400,
                    detail="Cannot copy a directory into itself or one of its descendants.",
                )

        dest_item = dest_folder / source.name
        if dest_item.exists():
            counter = 1
            while dest_item.exists():
                if source.is_file():
                    name = f"{source.stem}_copy{counter}{source.suffix}"
                else:
                    name = f"{source.name}_copy{counter}"
                dest_item = dest_folder / name
                counter += 1

        try:
            if source.is_dir():
                shutil.copytree(source, dest_item, symlinks=True)
            else:
                shutil.copy2(source, dest_item)
        except Exception as exc:
            if dest_item.is_dir():
                shutil.rmtree(dest_item, ignore_errors=True)
            elif dest_item.exists():
                dest_item.unlink(missing_ok=True)
            raise HTTPException(status_code=500, detail=f"Could not copy item: {exc}")

        return {"status": "success", "message": f"Copied to '{dest_item.name}'"}

    @staticmethod
    def move_item(source_rel: str, dest_folder_rel: str) -> Dict[str, Any]:
        """Move an item while rejecting moves into its own subtree."""
        source = get_safe_path(source_rel, must_exist=True)
        dest_folder = get_safe_path(dest_folder_rel, must_exist=True)
        if not dest_folder.is_dir():
            raise HTTPException(status_code=400, detail="Destination must be a directory.")

        if source.is_dir():
            try:
                dest_folder.resolve().relative_to(source.resolve())
            except ValueError:
                pass
            else:
                raise HTTPException(
                    status_code=400,
                    detail="Cannot move a directory into itself or one of its descendants.",
                )

        dest_item = dest_folder / source.name
        if dest_item.exists():
            raise HTTPException(
                status_code=400,
                detail=f"'{source.name}' already exists in the destination.",
            )
        try:
            shutil.move(str(source), str(dest_item))
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Could not move item: {exc}")

        return {"status": "success", "message": f"Moved '{source.name}'"}

    @staticmethod
    def duplicate_item(source_rel: str) -> Dict[str, Any]:
        """Duplicate a file or folder in place."""
        source = get_safe_path(source_rel, must_exist=True)
        dest_folder = source.parent
        return FileService.copy_item(source_rel, str(dest_folder.relative_to(settings.ROOT_DIR)).replace("\\", "/"))

    @staticmethod
    def create_zip_archive(rel_path: str = ""):
        """Build a size-limited ZIP in a spooled file."""
        target = get_safe_path(rel_path, must_exist=True)
        archive = tempfile.SpooledTemporaryFile(
            max_size=8 * 1024 * 1024, mode="w+b", dir=settings.ROOT_DIR, prefix=".zip-spool-"
        )
        entries = 0
        total_bytes = 0

        def add_file(zip_file, path, archive_name):
            nonlocal entries, total_bytes
            entries += 1
            total_bytes += path.stat().st_size
            if entries > settings.MAX_ARCHIVE_MEMBERS:
                raise HTTPException(status_code=413, detail="ZIP contains too many files.")
            if total_bytes > settings.MAX_ARCHIVE_UNPACKED_BYTES:
                raise HTTPException(status_code=413, detail="ZIP exceeds the configured uncompressed size limit.")
            zip_file.write(path, arcname=archive_name)

        try:
            with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as zip_file:
                if target.is_file():
                    add_file(zip_file, target, target.name)
                else:
                    for path in target.rglob("*"):
                        if path.is_symlink() or not path.is_file():
                            continue
                        relative = path.relative_to(target)
                        if any(part.startswith(".") for part in relative.parts):
                            continue
                        add_file(zip_file, path, relative.as_posix())
            if not entries:
                raise HTTPException(status_code=400, detail="No visible files were available to archive.")
            archive.seek(0)
            return archive
        except Exception as exc:
            archive.close()
            if isinstance(exc, HTTPException):
                raise
            raise HTTPException(status_code=500, detail=f"Could not create ZIP archive: {exc}")

    @staticmethod
    def is_rar_file(archive_path: Path) -> bool:
        """Check if file has .rar extension or RAR magic signature."""
        if archive_path.suffix.lower() == ".rar":
            return True
        try:
            with open(archive_path, "rb") as f:
                sig = f.read(7)
                return sig.startswith(b"Rar!\x1a\x07")
        except Exception:
            return False

    @staticmethod
    def extract_archive(
        archive_rel: str,
        target_folder_rel: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Extract ZIP, TAR, or RAR after validating paths and expansion limits."""
        archive_path = get_safe_path(archive_rel, must_exist=True)
        if not archive_path.is_file():
            raise HTTPException(status_code=400, detail="Archive path must be a file.")

        if target_folder_rel:
            dest_dir = get_safe_path(target_folder_rel, must_exist=False)
        else:
            folder_name = archive_path.stem
            if folder_name.endswith(".tar"):
                folder_name = Path(folder_name).stem
            dest_dir = archive_path.parent / folder_name
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest_root = dest_dir.resolve()

        def safe_member_path(member_name: str) -> Path:
            normalized = str(member_name).replace("\\", "/")
            if (
                not normalized
                or normalized.startswith("/")
                or re.match(r"^[A-Za-z]:", normalized)
            ):
                raise HTTPException(status_code=400, detail="Archive contains an unsafe path.")
            parts = [
                part for part in normalized.rstrip("/").split("/") if part not in ("", ".")
            ]
            if any(part == ".." or ":" in part for part in parts):
                raise HTTPException(status_code=400, detail="Archive contains an unsafe path.")
            if not parts:
                return dest_root

            member_path = dest_root.joinpath(*parts).resolve()
            try:
                member_path.relative_to(dest_root)
            except ValueError:
                raise HTTPException(status_code=400, detail="Archive path escapes the destination.")

            cursor = dest_root
            for part in parts:
                cursor = cursor / part
                if cursor.is_symlink():
                    raise HTTPException(
                        status_code=400, detail="Archive path traverses an existing symbolic link."
                    )
            if member_path == archive_path.resolve():
                raise HTTPException(status_code=400, detail="Archive cannot overwrite itself.")
            return member_path

        def check_limits(member_count: int, unpacked_size: int) -> None:
            if member_count > settings.MAX_ARCHIVE_MEMBERS:
                raise HTTPException(status_code=413, detail="Archive contains too many entries.")
            if unpacked_size > settings.MAX_ARCHIVE_UNPACKED_BYTES:
                raise HTTPException(
                    status_code=413, detail="Archive expands beyond the configured size limit."
                )

        def copy_member(source, target: Path, expected_size: int) -> None:
            target.parent.mkdir(parents=True, exist_ok=True)
            remaining = expected_size
            with open(target, "wb") as output:
                while remaining:
                    chunk = source.read(min(settings.CHUNK_SIZE, remaining))
                    if not chunk:
                        raise HTTPException(
                            status_code=400, detail="Archive entry is shorter than declared."
                        )
                    output.write(chunk)
                    remaining -= len(chunk)
                if source.read(1):
                    raise HTTPException(
                        status_code=400, detail="Archive entry exceeds its declared size."
                    )

        extracted_count = 0
        try:
            if zipfile.is_zipfile(archive_path):
                with zipfile.ZipFile(archive_path, "r") as zip_file:
                    members = zip_file.infolist()
                    unpacked_size = sum(
                        member.file_size for member in members if not member.is_dir()
                    )
                    check_limits(len(members), unpacked_size)

                    checked_members = []
                    for member in members:
                        mode = member.external_attr >> 16
                        file_type = stat_module.S_IFMT(mode)
                        if file_type not in (
                            0,
                            stat_module.S_IFREG,
                            stat_module.S_IFDIR,
                        ):
                            raise HTTPException(
                                status_code=400,
                                detail="Archive contains a link or special file.",
                            )
                        is_directory = member.is_dir() or file_type == stat_module.S_IFDIR
                        checked_members.append(
                            (member, safe_member_path(member.filename), is_directory)
                        )

                    for member, member_path, is_directory in checked_members:
                        if is_directory:
                            member_path.mkdir(parents=True, exist_ok=True)
                        else:
                            with zip_file.open(member, "r") as source:
                                copy_member(source, member_path, member.file_size)
                        extracted_count += 1

            elif tarfile.is_tarfile(archive_path):
                with tarfile.open(archive_path, "r:*") as tar_file:
                    members = tar_file.getmembers()
                    unpacked_size = sum(member.size for member in members if member.isfile())
                    check_limits(len(members), unpacked_size)

                    checked_members = []
                    for member in members:
                        if not (member.isfile() or member.isdir()):
                            raise HTTPException(
                                status_code=400,
                                detail="Archive contains a link or special file.",
                            )
                        checked_members.append(
                            (member, safe_member_path(member.name), member.isdir())
                        )

                    for member, member_path, is_directory in checked_members:
                        if is_directory:
                            member_path.mkdir(parents=True, exist_ok=True)
                        else:
                            source = tar_file.extractfile(member)
                            if source is None:
                                raise HTTPException(
                                    status_code=400, detail="Could not read archive entry."
                                )
                            with source:
                                copy_member(source, member_path, member.size)
                        extracted_count += 1

            elif FileService.is_rar_file(archive_path):
                try:
                    import rarfile
                except ImportError:
                    raise HTTPException(status_code=500, detail="RAR support is unavailable.")

                with rarfile.RarFile(archive_path, "r") as rar_file:
                    members = rar_file.infolist()
                    unpacked_size = sum(
                        max(0, int(getattr(member, "file_size", 0)))
                        for member in members
                        if not member.is_dir()
                    )
                    check_limits(len(members), unpacked_size)

                    checked_members = []
                    for member in members:
                        for flag_name in ("is_symlink", "is_hardlink"):
                            flag = getattr(member, flag_name, False)
                            if callable(flag):
                                flag = flag()
                            if flag:
                                raise HTTPException(
                                    status_code=400, detail="Archive contains a link."
                                )
                        checked_members.append(
                            (member, safe_member_path(member.filename), member.is_dir())
                        )

                    for member, member_path, is_directory in checked_members:
                        if is_directory:
                            member_path.mkdir(parents=True, exist_ok=True)
                        else:
                            expected_size = int(getattr(member, "file_size", 0))
                            if expected_size < 0:
                                raise HTTPException(
                                    status_code=400, detail="Archive entry has an invalid size."
                                )
                            with rar_file.open(member) as source:
                                copy_member(source, member_path, expected_size)
                        extracted_count += 1
            else:
                raise HTTPException(status_code=400, detail="Unsupported archive format.")

            if not extracted_count:
                raise HTTPException(status_code=400, detail="Archive contains no entries.")
        except Exception as exc:
            if isinstance(exc, HTTPException):
                raise
            raise HTTPException(status_code=500, detail=f"Could not extract archive: {exc}")

        return {
            "status": "success",
            "message": f"Extracted {extracted_count} entries to '{dest_dir.name}'.",
            "destination": str(dest_dir.relative_to(settings.ROOT_DIR)).replace("\\", "/"),
        }

    @staticmethod
    def download_url_to_folder(
        url: str,
        target_folder_rel: str = "",
        custom_filename: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Download bounded HTTP(S) data from public hosts with DNS-pinned connections."""
        base_folder = get_safe_path(target_folder_rel, must_exist=True)
        if not base_folder.is_dir():
            raise HTTPException(status_code=400, detail="Destination must be a directory.")

        def validate_url(candidate: str):
            try:
                parsed = urlsplit(candidate)
                port = parsed.port or (443 if parsed.scheme.lower() == "https" else 80)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid download URL.")
            if (
                parsed.scheme.lower() not in ("http", "https")
                or not parsed.hostname
                or parsed.username
                or parsed.password
            ):
                raise HTTPException(
                    status_code=400,
                    detail="Only HTTP(S) URLs without credentials are allowed.",
                )

            hostname = parsed.hostname.rstrip(".").lower()
            if hostname == "localhost" or hostname.endswith(
                (".localhost", ".local", ".internal")
            ):
                raise HTTPException(
                    status_code=400, detail="Local network destinations are not allowed."
                )
            try:
                addresses = {ipaddress.ip_address(hostname)}
            except ValueError:
                try:
                    addresses = {
                        ipaddress.ip_address(result[4][0])
                        for result in socket.getaddrinfo(
                            hostname, port, type=socket.SOCK_STREAM
                        )
                    }
                except OSError as exc:
                    raise HTTPException(
                        status_code=400, detail=f"Could not resolve download host: {exc}"
                    )
            if not addresses or any(not address.is_global for address in addresses):
                raise HTTPException(
                    status_code=400,
                    detail="Local or non-public network destinations are not allowed.",
                )
            return parsed, addresses

        parsed, _ = validate_url(url)
        filename = custom_filename.strip() if custom_filename and custom_filename.strip() else (
            os.path.basename(unquote(parsed.path))
        )
        if not filename or "." not in filename:
            filename = f"download_{int(time.time())}.bin"
        filename = os.path.basename(filename.replace("\\", "/"))
        if filename in ("", ".", "..") or ":" in filename:
            raise HTTPException(status_code=400, detail="Invalid download filename.")

        dest_path = (base_folder / filename).resolve()
        try:
            dest_path.relative_to(settings.ROOT_DIR.resolve())
        except ValueError:
            raise HTTPException(
                status_code=403, detail="Download destination is outside configured root."
            )

        class SafeRedirectHandler(urllib.request.HTTPRedirectHandler):
            def redirect_request(self, req, fp, code, msg, headers, new_url):
                validate_url(urljoin(req.full_url, new_url))
                return super().redirect_request(req, fp, code, msg, headers, new_url)

        class PinnedHTTPHandler(urllib.request.HTTPHandler):
            def http_open(self, req):
                _, addresses = validate_url(req.full_url)
                address = str(min(addresses, key=lambda ip: ip.version))

                class PinnedHTTPConnection(http.client.HTTPConnection):
                    def connect(self):
                        self.sock = socket.create_connection(
                            (address, self.port), self.timeout, self.source_address
                        )

                return self.do_open(PinnedHTTPConnection, req)

        class PinnedHTTPSHandler(urllib.request.HTTPSHandler):
            def https_open(self, req):
                parsed_request, addresses = validate_url(req.full_url)
                address = str(min(addresses, key=lambda ip: ip.version))
                server_name = parsed_request.hostname

                class PinnedHTTPSConnection(http.client.HTTPSConnection):
                    def connect(self):
                        sock = socket.create_connection(
                            (address, self.port), self.timeout, self.source_address
                        )
                        self.sock = self._context.wrap_socket(
                            sock, server_hostname=server_name
                        )

                return self.do_open(
                    PinnedHTTPSConnection, req, context=self._context
                )

        opener = urllib.request.build_opener(
            urllib.request.ProxyHandler({}),
            PinnedHTTPHandler(),
            PinnedHTTPSHandler(),
            SafeRedirectHandler(),
        )
        request = urllib.request.Request(
            url, headers={"User-Agent": "KaggleCloudDrive/2.0"}
        )
        temp_path = None
        bytes_downloaded = 0
        deadline = time.monotonic() + 600
        try:
            with opener.open(request, timeout=60) as response:
                content_length = response.headers.get("Content-Length")
                if content_length:
                    try:
                        if int(content_length) > settings.MAX_REMOTE_DOWNLOAD_BYTES:
                            raise HTTPException(
                                status_code=413,
                                detail="Remote file exceeds the configured size limit.",
                            )
                    except ValueError:
                        pass

                with tempfile.NamedTemporaryFile(
                    mode="wb", dir=dest_path.parent, prefix=".download-", delete=False
                ) as output:
                    temp_path = Path(output.name)
                    while True:
                        if time.monotonic() > deadline:
                            raise HTTPException(
                                status_code=504, detail="Remote download timed out."
                            )
                        chunk = response.read(settings.CHUNK_SIZE)
                        if not chunk:
                            break
                        if bytes_downloaded + len(chunk) > settings.MAX_REMOTE_DOWNLOAD_BYTES:
                            raise HTTPException(
                                status_code=413,
                                detail="Remote file exceeds the configured size limit.",
                            )
                        output.write(chunk)
                        bytes_downloaded += len(chunk)
            os.replace(temp_path, dest_path)
        except HTTPException:
            if temp_path:
                temp_path.unlink(missing_ok=True)
            raise
        except Exception as exc:
            if temp_path:
                temp_path.unlink(missing_ok=True)
            raise HTTPException(status_code=502, detail=f"Remote download failed: {exc}")

        return {
            "status": "success",
            "message": f"Downloaded '{filename}' ({format_size(bytes_downloaded)}).",
            "filename": filename,
            "path": str(dest_path.relative_to(settings.ROOT_DIR)).replace("\\", "/"),
            "size": bytes_downloaded,
        }

    @staticmethod
    def create_zip_from_items(item_paths: List[str]):
        """Build a size-limited selected-items ZIP that spills to disk."""
        if not item_paths:
            raise HTTPException(status_code=400, detail="No items were selected.")
        targets = [get_safe_path(path, must_exist=True) for path in item_paths]
        archive = tempfile.SpooledTemporaryFile(
            max_size=8 * 1024 * 1024, mode="w+b", dir=settings.ROOT_DIR, prefix=".zip-spool-"
        )
        entries = 0
        total_bytes = 0

        def add_file(zip_file, path, archive_name):
            nonlocal entries, total_bytes
            entries += 1
            total_bytes += path.stat().st_size
            if entries > settings.MAX_ARCHIVE_MEMBERS:
                raise HTTPException(status_code=413, detail="ZIP contains too many files.")
            if total_bytes > settings.MAX_ARCHIVE_UNPACKED_BYTES:
                raise HTTPException(status_code=413, detail="ZIP exceeds the configured uncompressed size limit.")
            zip_file.write(path, arcname=archive_name)

        try:
            with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as zip_file:
                for target in targets:
                    if target.is_file():
                        add_file(zip_file, target, target.name)
                    elif target.is_dir():
                        folder_entries = 0
                        for path in target.rglob("*"):
                            if path.is_symlink() or not path.is_file():
                                continue
                            relative = path.relative_to(target)
                            if any(part.startswith(".") for part in relative.parts):
                                continue
                            archive_name = (Path(target.name) / relative).as_posix()
                            add_file(zip_file, path, archive_name)
                            folder_entries += 1
                        if not folder_entries:
                            entries += 1
                            if entries > settings.MAX_ARCHIVE_MEMBERS:
                                raise HTTPException(status_code=413, detail="ZIP contains too many entries.")
                            zip_file.writestr(Path(target.name).as_posix() + "/", "")
                    else:
                        raise HTTPException(status_code=400, detail="Selected item is not a regular file or directory.")
            if not entries:
                raise HTTPException(status_code=400, detail="No files were available to archive.")
            archive.seek(0)
            return archive
        except Exception as exc:
            archive.close()
            if isinstance(exc, HTTPException):
                raise
            raise HTTPException(status_code=500, detail=f"Could not create ZIP archive: {exc}")

    @staticmethod
    def compress_items(
        item_paths: List[str],
        archive_name: Optional[str] = None,
        target_folder_rel: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Create a complete ZIP atomically, within configured archive limits."""
        if not item_paths:
            raise HTTPException(status_code=400, detail="No items selected for compression.")
        targets = [get_safe_path(path, must_exist=True) for path in item_paths]
        first = targets[0]
        dest_dir = get_safe_path(target_folder_rel, must_exist=True) if target_folder_rel else first.parent
        if not dest_dir.is_dir():
            raise HTTPException(status_code=400, detail="Destination must be a directory.")

        requested_name = archive_name.strip() if archive_name and archive_name.strip() else None
        name = os.path.basename(requested_name.replace("\\", "/")) if requested_name else (
            f"{first.stem}.zip" if len(targets) == 1 else "archive.zip"
        )
        if not name or name in (".", "..") or ":" in name:
            raise HTTPException(status_code=400, detail="Invalid archive filename.")
        if not name.lower().endswith(".zip"):
            name += ".zip"

        dest = dest_dir / name
        if dest.exists():
            if requested_name:
                raise HTTPException(status_code=409, detail="An archive with that name already exists.")
            stem = dest.stem
            counter = 1
            while dest.exists():
                dest = dest_dir / f"{stem}_{counter}.zip"
                counter += 1
        try:
            dest.resolve().relative_to(settings.ROOT_DIR.resolve())
        except ValueError:
            raise HTTPException(status_code=403, detail="Archive destination is outside configured root.")
        if any(target.resolve() == dest.resolve() for target in targets):
            raise HTTPException(status_code=400, detail="An archive cannot include itself.")

        temp_path = None
        file_count = 0
        entry_count = 0
        total_bytes = 0

        def add_file(zip_file, path, archive_name):
            nonlocal file_count, entry_count, total_bytes
            entry_count += 1
            file_count += 1
            total_bytes += path.stat().st_size
            if entry_count > settings.MAX_ARCHIVE_MEMBERS:
                raise HTTPException(status_code=413, detail="ZIP contains too many files.")
            if total_bytes > settings.MAX_ARCHIVE_UNPACKED_BYTES:
                raise HTTPException(status_code=413, detail="ZIP exceeds the configured uncompressed size limit.")
            zip_file.write(path, arcname=archive_name)

        def add_empty_directory(zip_file, archive_name):
            nonlocal entry_count
            entry_count += 1
            if entry_count > settings.MAX_ARCHIVE_MEMBERS:
                raise HTTPException(status_code=413, detail="ZIP contains too many entries.")
            zip_file.writestr(archive_name, "")

        try:
            with tempfile.NamedTemporaryFile(
                mode="w+b", dir=dest_dir, prefix=".archive-", suffix=".tmp", delete=False
            ) as output:
                temp_path = Path(output.name)
                with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as zip_file:
                    for target in targets:
                        if target.is_symlink():
                            raise HTTPException(status_code=400, detail="Symbolic links cannot be archived.")
                        if target.is_file():
                            add_file(zip_file, target, target.name)
                        elif target.is_dir():
                            directory_entries = 0
                            for path in target.rglob("*"):
                                if path.is_symlink() or not path.is_file():
                                    continue
                                if path.resolve() in (dest.resolve(), temp_path.resolve()):
                                    continue
                                relative = path.relative_to(target)
                                if any(part.startswith(".") for part in relative.parts):
                                    continue
                                archive_path = (Path(target.name) / relative).as_posix()
                                add_file(zip_file, path, archive_path)
                                directory_entries += 1
                            if not directory_entries:
                                add_empty_directory(zip_file, Path(target.name).as_posix() + "/")
                        else:
                            raise HTTPException(status_code=400, detail="Selected item is not a regular file or directory.")
                output.flush()
                os.fsync(output.fileno())
            if not entry_count:
                raise HTTPException(status_code=400, detail="No files were available to archive.")
            os.replace(temp_path, dest)
        except Exception as exc:
            if temp_path:
                temp_path.unlink(missing_ok=True)
            if isinstance(exc, HTTPException):
                raise
            raise HTTPException(status_code=500, detail=f"Could not create ZIP archive: {exc}")

        size = dest.stat().st_size
        return {
            "status": "success",
            "message": f"Compressed {file_count} files into '{dest.name}'.",
            "archive_name": dest.name,
            "archive_path": str(dest.relative_to(settings.ROOT_DIR)).replace("\\", "/"),
            "size": size,
            "formatted_size": format_size(size),
        }
