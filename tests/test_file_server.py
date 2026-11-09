import os
import sys
import types
import shutil
import zipfile
import tarfile
import tempfile
import unittest
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Provide mock fallback if running tests in environments where FastAPI is not yet installed
try:
    import fastapi
    from fastapi import HTTPException
except ImportError:
    fastapi_mock = types.ModuleType("fastapi")
    class HTTPException(Exception):
        def __init__(self, status_code: int, detail: str = ""):
            self.status_code = status_code
            self.detail = detail
            super().__init__(detail)
    class MockRouter:
        def __init__(self, *a, **kw):
            pass
        def get(self, *a, **kw):
            return lambda fn: fn
        def post(self, *a, **kw):
            return lambda fn: fn
        def put(self, *a, **kw):
            return lambda fn: fn
        def delete(self, *a, **kw):
            return lambda fn: fn
    fastapi_mock.HTTPException = HTTPException
    fastapi_mock.Request = object
    fastapi_mock.UploadFile = object
    fastapi_mock.APIRouter = MockRouter
    fastapi_mock.File = lambda *a, **kw: None
    fastapi_mock.Form = lambda *a, **kw: None
    fastapi_mock.Query = lambda *a, **kw: None
    fastapi_mock.status = types.SimpleNamespace(
        HTTP_400_BAD_REQUEST=400,
        HTTP_401_UNAUTHORIZED=401,
        HTTP_403_FORBIDDEN=403,
        HTTP_404_NOT_FOUND=404,
        HTTP_500_INTERNAL_SERVER_ERROR=500
    )
    sys.modules["fastapi"] = fastapi_mock

    responses_mock = types.ModuleType("fastapi.responses")
    class HTMLResponse:
        def __init__(self, content="", media_type="text/html", status_code=200):
            self.body = content.encode("utf-8") if isinstance(content, str) else content
            self.media_type = media_type
            self.status_code = status_code
    class JSONResponse:
        def __init__(self, content=None, status_code=200):
            self.content = content
            self.status_code = status_code
    class FileResponse:
        def __init__(self, path="", media_type="", filename=None):
            self.path = path
            self.media_type = media_type
            self.filename = filename
    class StreamingResponse:
        def __init__(self, content=None, media_type="", headers=None):
            self.content = content
            self.media_type = media_type
            self.headers = headers or {}
    class RedirectResponse:
        def __init__(self, url="", status_code=307):
            self.url = url
            self.status_code = status_code
    responses_mock.HTMLResponse = HTMLResponse
    responses_mock.JSONResponse = JSONResponse
    responses_mock.FileResponse = FileResponse
    responses_mock.StreamingResponse = StreamingResponse
    responses_mock.RedirectResponse = RedirectResponse
    sys.modules["fastapi.responses"] = responses_mock
from app.config import settings
from app.security import get_safe_path, verify_credentials
from app.services.file_service import FileService
from app.services.system_service import SystemService


class TestKaggleCloudDrive(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Create a dedicated temp workspace for testing
        cls.test_dir = tempfile.mkdtemp(prefix="test_kaggle_drive_")
        settings.ROOT_DIR = Path(cls.test_dir).resolve()
        settings.USERNAME = "testadmin"
        settings.PASSWORD = "testpassword123"

    @classmethod
    def tearDownClass(cls):
        # Clean up temp workspace
        if os.path.exists(cls.test_dir):
            shutil.rmtree(cls.test_dir, ignore_errors=True)

    def test_01_security_path_traversal(self):
        """Ensure get_safe_path strictly blocks any path traversal breakout."""
        # 1. Normal safe path
        safe = get_safe_path("subfolder/file.txt", must_exist=False)
        self.assertTrue(str(safe).startswith(str(settings.ROOT_DIR)))

        # 2. Malicious breakout with ..
        with self.assertRaises(HTTPException) as ctx:
            get_safe_path("../../Windows/System32", must_exist=False)
        self.assertEqual(ctx.exception.status_code, 403)

        # 3. Path traversal attempt with /../
        with self.assertRaises(HTTPException) as ctx:
            get_safe_path("/../etc/passwd", must_exist=False)
        self.assertEqual(ctx.exception.status_code, 403)

    def test_02_credentials_verification(self):
        """Verify timing-safe credential verification."""
        self.assertTrue(verify_credentials("testadmin", "testpassword123"))
        self.assertFalse(verify_credentials("testadmin", "wrongpass"))
        self.assertFalse(verify_credentials("wronguser", "testpassword123"))
        self.assertFalse(verify_credentials("", ""))

    def test_03_file_crud_operations(self):
        """Test file creation, reading, atomic writing, duplication, and deletion."""
        # 1. Create directory
        res_dir = FileService.create_directory("demo_folder")
        self.assertEqual(res_dir["status"], "success")
        self.assertTrue((settings.ROOT_DIR / "demo_folder").is_dir())

        # 2. Create file
        res_file = FileService.create_empty_file("demo_folder/sample.py")
        self.assertEqual(res_file["status"], "success")
        self.assertTrue((settings.ROOT_DIR / "demo_folder" / "sample.py").is_file())

        # 3. Write and read text
        test_code = "print('Hello Kaggle from Python 3.13!')\n"
        FileService.write_text_file("demo_folder/sample.py", test_code)
        read_res = FileService.read_text_file("demo_folder/sample.py")
        self.assertEqual(read_res["content"], test_code)
        self.assertEqual(read_res["category"], "code")

        # 4. Duplicate item
        FileService.duplicate_item("demo_folder/sample.py")
        self.assertTrue((settings.ROOT_DIR / "demo_folder" / "sample_copy1.py").is_file())

        # 5. List directory
        list_res = FileService.list_directory("demo_folder")
        self.assertEqual(list_res["total_items"], 2)

        # 6. Delete file
        del_res = FileService.delete_item("demo_folder/sample_copy1.py")
        self.assertEqual(del_res["status"], "success")
        self.assertFalse((settings.ROOT_DIR / "demo_folder" / "sample_copy1.py").exists())

    def test_04_zip_and_tar_operations(self):
        """Test zip creation, extraction, and Python 3.13 tar PEP 706 filter compliance."""
        # 1. Create test file
        FileService.write_text_file("to_zip.txt", "Zip archive content")

        # 2. Stream zip
        zip_mem = FileService.create_zip_archive("to_zip.txt")
        self.assertGreater(zip_mem.getbuffer().nbytes, 0)

        # 3. Verify zip structure
        with zipfile.ZipFile(zip_mem, "r") as zf:
            self.assertIn("to_zip.txt", zf.namelist())

        # 4. Test tarfile extraction with Python 3.13 PEP 706 filter
        tar_path = settings.ROOT_DIR / "test_archive.tar"
        with tarfile.open(tar_path, "w") as tf:
            test_file = settings.ROOT_DIR / "to_zip.txt"
            tf.add(test_file, arcname="archived_file.txt")

        # Extract archive
        extract_res = FileService.extract_archive("test_archive.tar")
        self.assertEqual(extract_res["status"], "success")
        self.assertTrue((settings.ROOT_DIR / "test_archive" / "archived_file.txt").is_file())

    def test_05_system_service(self):
        """Verify system resource monitoring functions."""
        stats = SystemService.get_full_stats()
        self.assertIn("disk", stats)
        self.assertIn("memory", stats)
        self.assertIn("cpu", stats)
        self.assertIn("largest_files", stats)
        self.assertIn("python", stats)
        self.assertGreaterEqual(stats["disk"]["percent"], 0)

    def test_08_copy_move_and_multi_zip(self):
        """Test copy, move, and multi-item zip archive generation."""
        # Setup source
        FileService.write_text_file("item_a.txt", "Content A")
        FileService.write_text_file("item_b.txt", "Content B")
        FileService.create_directory("dest_folder")

        # Copy item_a.txt into dest_folder
        res_copy = FileService.copy_item("item_a.txt", "dest_folder")
        self.assertEqual(res_copy["status"], "success")
        self.assertTrue((settings.ROOT_DIR / "dest_folder" / "item_a.txt").is_file())
        self.assertTrue((settings.ROOT_DIR / "item_a.txt").is_file())

        # Move item_b.txt into dest_folder
        res_move = FileService.move_item("item_b.txt", "dest_folder")
        self.assertEqual(res_move["status"], "success")
        self.assertTrue((settings.ROOT_DIR / "dest_folder" / "item_b.txt").is_file())
        self.assertFalse((settings.ROOT_DIR / "item_b.txt").exists())

        # Multi-item zip archive
        zip_mem = FileService.create_zip_from_items(["dest_folder/item_a.txt", "dest_folder/item_b.txt"])
        self.assertGreater(zip_mem.getbuffer().nbytes, 0)
        with zipfile.ZipFile(zip_mem, "r") as zf:
            names = zf.namelist()
            self.assertIn("item_a.txt", names)
            self.assertIn("item_b.txt", names)

        # Test folder in multi-zip preserves forward slashes
        zip_mem_dir = FileService.create_zip_from_items(["dest_folder"])
        with zipfile.ZipFile(zip_mem_dir, "r") as zf:
            for name in zf.namelist():
                self.assertNotIn("\\", name)
                self.assertTrue(name.startswith("dest_folder/"))

    def test_09_auth_fouc_pre_rendering(self):
        """Test index page pre-renders dashboard for authenticated sessions and login for unauthenticated."""
        from app.routes.view_routes import get_index

        class MockRequest:
            def __init__(self, is_auth=False, username=""):
                self.session = {"authenticated": True, "username": username} if is_auth else {}

        # 1. Unauthenticated request
        req_unauth = MockRequest(is_auth=False)
        resp_unauth = get_index(req_unauth)
        content_unauth = resp_unauth.body.decode("utf-8")
        self.assertIn('<meta name="server-auth" content="0">', content_unauth)
        self.assertIn('id="appContainer" class="hidden', content_unauth)

        # 2. Authenticated request
        req_auth = MockRequest(is_auth=True, username="alice")
        resp_auth = get_index(req_auth)
        content_auth = resp_auth.body.decode("utf-8")
        self.assertIn('<meta name="server-auth" content="1">', content_auth)
        self.assertIn('<meta name="server-user" content="alice">', content_auth)
        self.assertIn('id="loginView" style="display: none;"', content_auth)
        self.assertIn('id="appContainer" style="display: flex;"', content_auth)
        self.assertIn('>alice</span>', content_auth)

    def test_10_media_preview_categories_and_mime(self):
        """Verify multimedia files (image, video, audio) category detection and MIME types."""
        from app.services.file_service import get_file_category, MEDIA_MIMETYPES

        # 1. Categories
        self.assertEqual(get_file_category("png"), "image")
        self.assertEqual(get_file_category("webp"), "image")
        self.assertEqual(get_file_category("mp4"), "video")
        self.assertEqual(get_file_category("webm"), "video")
        self.assertEqual(get_file_category("mp3"), "audio")
        self.assertEqual(get_file_category("flac"), "audio")

        # 2. MIME types
        self.assertEqual(MEDIA_MIMETYPES["webp"], "image/webp")
        self.assertEqual(MEDIA_MIMETYPES["mp4"], "video/mp4")
        self.assertEqual(MEDIA_MIMETYPES["mp3"], "audio/mpeg")
        self.assertEqual(MEDIA_MIMETYPES["flac"], "audio/flac")

    def test_12_rar_archive_support(self):
        """Verify RAR file detection, extraction CLI fallback, and Zip Slip safety."""
        from unittest.mock import patch, MagicMock

        # 1. Detection tests
        rar_file = settings.ROOT_DIR / "sample.rar"
        rar_file.write_bytes(b"dummy rar content")
        self.assertTrue(FileService.is_rar_file(rar_file))

        rar4_header_file = settings.ROOT_DIR / "sample_rar4.bin"
        rar4_header_file.write_bytes(b"Rar!\x1a\x07\x00\xcf\x90\x73")
        self.assertTrue(FileService.is_rar_file(rar4_header_file))

        rar5_header_file = settings.ROOT_DIR / "sample_rar5.bin"
        rar5_header_file.write_bytes(b"Rar!\x1a\x07\x01\x00\x00\x00")
        self.assertTrue(FileService.is_rar_file(rar5_header_file))

        txt_file = settings.ROOT_DIR / "normal.txt"
        txt_file.write_text("just normal text", encoding="utf-8")
        self.assertFalse(FileService.is_rar_file(txt_file))

        # 2. Category mapping
        from app.services.file_service import get_file_category
        self.assertEqual(get_file_category("rar"), "archive")

        # 3. Extraction with CLI tool simulation
        dest_folder = settings.ROOT_DIR / "sample"
        dest_folder.mkdir(parents=True, exist_ok=True)
        sample_extracted = dest_folder / "extracted_file.txt"

        def mock_subprocess_run(cmd, *args, **kwargs):
            # Create the extracted file to simulate extractor output
            sample_extracted.write_text("Hello RAR content", encoding="utf-8")
            res = MagicMock()
            res.returncode = 0
            res.stdout = "Extracted 1 file"
            res.stderr = ""
            return res

        with patch("subprocess.run", side_effect=mock_subprocess_run):
            with patch("shutil.which", return_value="/usr/bin/7z"):
                res = FileService.extract_archive("sample.rar")
                self.assertEqual(res["status"], "success")
                self.assertTrue(sample_extracted.exists())
                self.assertIn("sample", res["destination"])

        # 4. Error handling when extractor CLI fails
        def mock_subprocess_fail(cmd, *args, **kwargs):
            res = MagicMock()
            res.returncode = 1
            res.stdout = ""
            res.stderr = "Corrupted archive header"
            return res

        with patch("subprocess.run", side_effect=mock_subprocess_fail):
            with patch("shutil.which", return_value="/usr/bin/7z"):
                with self.assertRaises(HTTPException) as ctx:
                    FileService.extract_archive("sample.rar")
                self.assertEqual(ctx.exception.status_code, 500)
                self.assertIn("Corrupted archive header", ctx.exception.detail)

    def test_13_spreadsheet_support(self):
        """Verify .csv and Excel (.xlsx, .xls) category mapping and MIME types."""
        from app.services.file_service import get_file_category, MEDIA_MIMETYPES

        # 1. Category mapping
        self.assertEqual(get_file_category("csv"), "spreadsheet")
        self.assertEqual(get_file_category("tsv"), "spreadsheet")
        self.assertEqual(get_file_category("xlsx"), "spreadsheet")
        self.assertEqual(get_file_category("xls"), "spreadsheet")

        # 2. MIME types
        self.assertIn("csv", MEDIA_MIMETYPES)
        self.assertIn("xlsx", MEDIA_MIMETYPES)
        self.assertIn("xls", MEDIA_MIMETYPES)
        self.assertIn("spreadsheetml", MEDIA_MIMETYPES["xlsx"])
        self.assertIn("ms-excel", MEDIA_MIMETYPES["xls"])

    def test_write_binary_file(self):
        """Test write_binary_file with base64 encoded content."""
        import base64
        test_bytes = b"Hello Excel Binary Data \x00\x01\x02\x03\xff\xfe"
        b64_str = base64.b64encode(test_bytes).decode("ascii")

        res = FileService.write_binary_file("sub/test_binary.xlsx", b64_str)
        self.assertEqual(res["status"], "success")

        target = get_safe_path("sub/test_binary.xlsx")
        self.assertTrue(target.exists())
        self.assertEqual(target.read_bytes(), test_bytes)

    def test_compress_items(self):
        """Test FileService.compress_items on single file and folder."""
        # Setup files and folder to compress
        folder_target = get_safe_path("compress_test_dir", must_exist=False)
        folder_target.mkdir(parents=True, exist_ok=True)
        (folder_target / "file1.txt").write_text("Hello 1", encoding="utf-8")
        (folder_target / "sub").mkdir(parents=True, exist_ok=True)
        (folder_target / "sub" / "file2.txt").write_text("Hello 2", encoding="utf-8")

        # 1. Compress folder
        res_dir = FileService.compress_items(["compress_test_dir"], archive_name="compressed_dir.zip")
        self.assertEqual(res_dir["status"], "success")
        self.assertEqual(res_dir["archive_name"], "compressed_dir.zip")

        zip_path = get_safe_path("compressed_dir.zip")
        self.assertTrue(zip_path.exists())
        with zipfile.ZipFile(zip_path, "r") as zf:
            names = zf.namelist()
            self.assertIn("compress_test_dir/file1.txt", names)
            self.assertIn("compress_test_dir/sub/file2.txt", names)

        # 2. Compress single file with default name
        res_file = FileService.compress_items(["compress_test_dir/file1.txt"])
        self.assertEqual(res_file["status"], "success")
        self.assertEqual(res_file["archive_name"], "file1.zip")
        file_zip_path = get_safe_path("compress_test_dir/file1.zip")
        self.assertTrue(file_zip_path.exists())

        # 3. Collision resolution
        res_col = FileService.compress_items(["compress_test_dir/file1.txt"])
        self.assertEqual(res_col["archive_name"], "file1_1.zip")
        self.assertTrue(get_safe_path("compress_test_dir/file1_1.zip").exists())


if __name__ == "__main__":
    unittest.main()
