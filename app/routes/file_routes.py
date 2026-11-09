import mimetypes
from urllib.parse import quote
from typing import List, Optional
from fastapi import APIRouter, Request, HTTPException, UploadFile, File, Form, Query, status
from fastapi.responses import FileResponse, StreamingResponse
from starlette.background import BackgroundTask
from pydantic import BaseModel, Field
from app.config import settings

from app.security import require_auth, get_safe_path
from app.services.file_service import FileService, MEDIA_MIMETYPES

router = APIRouter(prefix="/api/files", tags=["files"])


def _archive_chunks(archive_file):
    while True:
        chunk = archive_file.read(settings.CHUNK_SIZE)
        if not chunk:
            break
        yield chunk


class ContentSaveRequest(BaseModel):
    path: str = Field(..., max_length=4096)
    content: str = Field(..., max_length=settings.MAX_TEXT_PREVIEW_SIZE)


class BinarySaveRequest(BaseModel):
    path: str = Field(..., max_length=4096)
    content_b64: str = Field(..., max_length=((settings.MAX_BINARY_SAVE_BYTES + 2) // 3) * 4)


class MkdirRequest(BaseModel):
    path: str


class TouchRequest(BaseModel):
    path: str


class DeleteRequest(BaseModel):
    path: str


class RenameRequest(BaseModel):
    path: str
    new_name: str


class CopyMoveRequest(BaseModel):
    source_path: str
    target_folder: str


class DuplicateRequest(BaseModel):
    path: str


class ExtractRequest(BaseModel):
    path: str
    target_folder: Optional[str] = None


class DownloadUrlRequest(BaseModel):
    url: str = Field(..., max_length=4096)
    target_folder: str = ""
    filename: Optional[str] = None


class DownloadSelectedRequest(BaseModel):
    items: List[str] = Field(..., min_length=1, max_length=1000)


class CompressRequest(BaseModel):
    paths: List[str] = Field(..., min_length=1, max_length=1000)
    archive_name: Optional[str] = None
    target_folder: Optional[str] = None


@router.get("")
def list_files(
    request: Request,
    path: str = Query("", description="Relative path from ROOT_DIR"),
    show_hidden: bool = Query(False, description="Whether to include hidden files")
):
    """List directory contents."""
    require_auth(request)
    return FileService.list_directory(path, show_hidden=show_hidden)


@router.get("/properties")
def get_file_properties(request: Request, path: str = Query(..., description="File or folder path")):
    """Get metadata and content size for a file or folder."""
    require_auth(request)
    return FileService.get_properties(path)


@router.get("/download")
def download_file(request: Request, path: str = Query(..., description="File path to download")):
    """Download a single file."""
    require_auth(request)
    target = get_safe_path(path, must_exist=True)

    if not target.is_file():
        raise HTTPException(status_code=400, detail="Mục chỉ định không phải là một tệp tin.")

    mime_type, _ = mimetypes.guess_type(target.name)
    return FileResponse(
        path=target,
        media_type=mime_type or "application/octet-stream",
        filename=target.name
    )


@router.get("/preview-raw")
def preview_raw_file(request: Request, path: str = Query(..., description="File path to preview")):
    """
    Stream/serve raw media (image, video, audio, pdf) for inline browser rendering.
    Supports HTTP range requests for smooth video/audio seeking.
    """
    require_auth(request)
    target = get_safe_path(path, must_exist=True)

    if not target.is_file():
        raise HTTPException(status_code=400, detail="Mục chỉ định không phải là một tệp tin.")

    ext = target.suffix.lower().lstrip(".")
    mime_type = MEDIA_MIMETYPES.get(ext) or mimetypes.guess_type(target.name)[0] or "application/octet-stream"
    return FileResponse(
        path=target,
        media_type=mime_type
    )


@router.get("/download-zip")
def download_zip(request: Request, path: str = Query("", description="Folder or file path to zip")):
    """Download a folder or file as a compressed ZIP file."""
    require_auth(request)
    target = get_safe_path(path, must_exist=True)
    archive_file = FileService.create_zip_archive(path)
    zip_name = (target.name if target.name else "kaggle_working") + ".zip"
    return StreamingResponse(
        _archive_chunks(archive_file),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{quote(zip_name)}"'},
        background=BackgroundTask(archive_file.close),
    )


@router.get("/content")
def get_file_content(request: Request, path: str = Query(..., description="File path to read")):
    """Read text file content for web code editor."""
    require_auth(request)
    return FileService.read_text_file(path)


@router.post("/content")
def save_file_content(request: Request, payload: ContentSaveRequest):
    """Save edited content to a text file."""
    require_auth(request)
    return FileService.write_text_file(payload.path, payload.content)


@router.post("/save-binary")
def save_binary_file(request: Request, payload: BinarySaveRequest):
    """Save base64-encoded binary content (e.g. modified Excel workbook) to file."""
    require_auth(request)
    return FileService.write_binary_file(payload.path, payload.content_b64)


@router.post("/upload")
def upload_files(
    request: Request,
    target_path: str = Form(""),
    files: List[UploadFile] = File(...),
    relative_paths: Optional[List[str]] = Form(None)
):
    """Upload files with per-file and aggregate size limits."""
    require_auth(request)
    if len(files) > 1000:
        raise HTTPException(status_code=413, detail="Too many files in one upload request.")
    results = []
    try:
        file_sizes = []
        for upload_file in files:
            upload_file.file.seek(0, 2)
            file_sizes.append(upload_file.file.tell())
            upload_file.file.seek(0)
        if sum(file_sizes) > settings.MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="Upload exceeds the configured size limit.")

        for idx, upload_file in enumerate(files):
            rel_filename = None
            if relative_paths and idx < len(relative_paths) and relative_paths[idx]:
                rel_filename = relative_paths[idx]
            result = FileService.save_uploaded_file(
                target_folder_rel=target_path,
                upload_file=upload_file,
                relative_filename=rel_filename,
                max_bytes=file_sizes[idx],
            )
            results.append(result)
    finally:
        for upload_file in files:
            if not upload_file.file.closed:
                upload_file.file.close()
    return {
        "status": "success",
        "message": f"\u0110\u00e3 t\u1ea3i l\u00ean th\u00e0nh c\u00f4ng {len(results)} t\u1ec7p.",
        "uploaded_files": results
    }


@router.post("/mkdir")
def create_directory(request: Request, payload: MkdirRequest):
    """Create a new folder."""
    require_auth(request)
    return FileService.create_directory(payload.path)


@router.post("/touch")
def create_file(request: Request, payload: TouchRequest):
    """Create a new empty file."""
    require_auth(request)
    return FileService.create_empty_file(payload.path)


@router.delete("/delete")
def delete_item(request: Request, payload: DeleteRequest):
    """Delete a file or folder recursively."""
    require_auth(request)
    return FileService.delete_item(payload.path)


@router.post("/rename")
def rename_item(request: Request, payload: RenameRequest):
    """Rename a file or folder."""
    require_auth(request)
    return FileService.rename_item(payload.path, payload.new_name)


@router.post("/copy")
def copy_item(request: Request, payload: CopyMoveRequest):
    """Copy an item to a target directory."""
    require_auth(request)
    return FileService.copy_item(payload.source_path, payload.target_folder)


@router.post("/move")
def move_item(request: Request, payload: CopyMoveRequest):
    """Move an item to a target directory."""
    require_auth(request)
    return FileService.move_item(payload.source_path, payload.target_folder)


@router.post("/duplicate")
def duplicate_item(request: Request, payload: DuplicateRequest):
    """Duplicate an item."""
    require_auth(request)
    return FileService.duplicate_item(payload.path)


@router.post("/extract")
def extract_archive(request: Request, payload: ExtractRequest):
    """Extract an archive (.zip, .tar, .tar.gz, .rar)."""
    require_auth(request)
    return FileService.extract_archive(payload.path, payload.target_folder)


@router.post("/download-from-url")
def download_from_url(request: Request, payload: DownloadUrlRequest):
    """Download a file directly from external URL to the target directory."""
    require_auth(request)
    return FileService.download_url_to_folder(
        url=payload.url,
        target_folder_rel=payload.target_folder,
        custom_filename=payload.filename
    )


@router.post("/download-selected-zip")
def download_selected_zip(request: Request, payload: DownloadSelectedRequest):
    """Download multiple selected files/folders as a streamed ZIP archive."""
    require_auth(request)
    if not payload.items:
        raise HTTPException(status_code=400, detail="No items were selected for archiving.")
    archive_file = FileService.create_zip_from_items(payload.items)
    return StreamingResponse(
        _archive_chunks(archive_file),
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="selected_items.zip"'},
        background=BackgroundTask(archive_file.close),
    )


@router.post("/compress")
def compress_files(request: Request, payload: CompressRequest):
    """Compress one or multiple files/folders into a .zip archive stored on disk."""
    require_auth(request)
    return FileService.compress_items(
        item_paths=payload.paths,
        archive_name=payload.archive_name,
        target_folder_rel=payload.target_folder
    )

