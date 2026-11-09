/* ============================================================
   KAGGLE CLOUD DRIVE - INTERNATIONALIZATION (i18n)
   Supported Languages: Tiếng Việt (vi), English (en), 简体中文 (zh)
   ============================================================ */

const I18n = {
  currentLang: "vi",

  locales: {
    vi: { name: "Tiếng Việt", flag: "🇻🇳", label: "VI" },
    en: { name: "English", flag: "🇺🇸", label: "EN" },
    zh: { name: "简体中文", flag: "🇨🇳", label: "ZH" }
  },

  translations: {
    vi: {
      // General
      app_name: "Kaggle Cloud Drive",
      app_subtitle: "Hệ thống quản lý tệp trực quan cho Kaggle Notebook",
      loading: "Đang tải...",
      calculating: "Đang tính...",
      cancel: "Hủy",
      confirm: "Xác nhận",
      save: "Lưu",
      close: "Đóng",
      delete: "Xóa",
      edit: "Chỉnh sửa",
      download: "Tải xuống",
      preview: "Xem trước",
      duplicate: "Nhân bản",
      rename: "Đổi tên",
      copy: "Sao chép",
      options: "Tùy chọn",
      success: "Thành công",
      error: "Lỗi",
      warning: "Cảnh báo",
      info: "Thông tin",

      // Login
      username: "Tên đăng nhập",
      username_placeholder: "admin",
      password: "Mật khẩu",
      password_placeholder: "Nhập mật khẩu...",
      login_btn: "Đăng nhập",
      authenticating: "Đang xác thực...",
      login_empty_error: "Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.",
      login_fail_error: "Tên đăng nhập hoặc mật khẩu không chính xác.",
      logout: "Đăng xuất",

      // Topbar
      search_placeholder: "Tìm kiếm tệp và thư mục...",
      topbar_storage_title: "Xem trạng thái dung lượng & tài nguyên",
      terminal_btn_title: "Mở bảng dòng lệnh Kaggle Terminal",
      toggle_view_title: "Chuyển chế độ xem lưới / danh sách",
      toggle_hidden_title: "Ẩn/Hiện tệp ẩn (.dotfiles)",
      logout_title: "Nhấn để đăng xuất",
      lang_picker_title: "Ngôn ngữ / Language / 语言",

      // Sidebar
      menu_title: "Menu quản lý",
      btn_new: "Mới / Tải lên",
      upload_file: "Tải tệp lên",
      upload_folder: "Tải cả thư mục lên",
      upload_url: "Tải từ liên kết (URL)",
      new_folder: "Thư mục mới",
      new_file: "Tệp mới",
      nav_storage: "Bộ nhớ (/kaggle/working)",
      nav_terminal: "Kaggle Terminal",
      nav_resources: "Tài nguyên CPU/GPU/RAM",
      disk_usage: "Dung lượng ổ đĩa",
      storage_detail_title: "Nhấn để xem chi tiết tài nguyên",

      // Content Header & Toolbar
      go_back: "Quay lại",
      refresh: "Làm mới",
      download_folder_zip: "Tải thư mục (.ZIP)",
      download_folder_zip_title: "Nén thư mục hiện tại thành file .zip và tải về",
      upload_url_title: "Tải mô hình hoặc dữ liệu trực tiếp từ URL",
      upload_file_title: "Tải tệp từ máy lên Kaggle",
      new_folder_title: "Tạo thư mục mới",
      new_file_title: "Tạo tệp văn bản / code mới",

      // Selection Bar
      selected_items: "Đã chọn {count} mục",
      download_selected_zip: "Tải nén (.ZIP)",
      delete_selected: "Xóa",

      // File List / Grid
      col_name: "Tên",
      col_size: "Kích thước",
      col_date: "Ngày chỉnh sửa",
      col_actions: "Thao tác",
      empty_title: "Thư mục trống hoặc không có tệp phù hợp",
      empty_desc: "Kéo thả tệp vào đây hoặc nhấn \"+ Mới\" để tải lên.",
      action_download: "Tải xuống",
      action_preview: "Xem trước",
      action_view_image: "Xem hình ảnh",
      action_play_video: "Phát video",
      action_play_audio: "Nghe âm thanh",
      action_view_pdf: "Xem tài liệu PDF",
      action_view_excel: "Xem bảng tính Excel",
      action_view_csv: "Xem bảng dữ liệu CSV",
      action_edit: "Chỉnh sửa mã nguồn",
      action_download_zip: "Nén & Tải về (.ZIP)",
      action_open_folder: "Mở thư mục",
      action_open_terminal: "Mở trong Terminal",
      action_open_terminal_here: "Mở Terminal tại đây",
      folder_badge: "Thư mục",
      file_badge: "Tệp",
      action_copy_path: "Sao ch\u00e9p \u0111\u01b0\u1eddng d\u1eabn",
      action_copy_curl: "Sao chép liên kết",
      action_duplicate: "Nhân bản",
      action_rename: "Đổi tên",
      action_delete: "Xóa",
      action_extract_here: "Giải nén tại đây",
      action_compress: "Nén thành .ZIP",
      action_compress_selected: "Nén các mục đã chọn (.ZIP)",
      action_compress_here: "Nén lưu tại đây",
      action_properties: "Thu\u{1ed9}c t\u{00ed}nh",
      properties_title: "Thu\u{1ed9}c t\u{00ed}nh",
      properties_name: "T\u{00ea}n",
      properties_type: "Lo\u{1ea1}i",
      properties_location: "V\u{1ecb} tr\u{00ed}",
      properties_extension: "Ph\u{1ea7}n m\u{1edf} r\u{1ed9}ng",
      properties_mime: "\u{0110}\u{1ecb}nh d\u{1ea1}ng",
      properties_size: "Dung l\u{01b0}\u{1ee3}ng",
      properties_contents: "N\u{1ed9}i dung",
      properties_files: "t\u{1ec7}p",
      properties_folders: "th\u{01b0} m\u{1ee5}c",
      properties_root: "Th\u{01b0} m\u{1ee5}c g\u{1ed1}c",
      properties_created: "Ng\u{00e0}y t\u{1ea1}o",
      properties_modified: "Ng\u{00e0}y ch\u{1ec9}nh s\u{1eed}a",
      properties_permissions: "Quy\u{1ec1}n truy c\u{1ead}p",
      properties_loading: "\u{0110}ang t\u{1ea3}i thu\u{1ed9}c t\u{00ed}nh...",
      properties_load_error: "Kh\u{00f4}ng th\u{1ec3} t\u{1ea3}i thu\u{1ed9}c t\u{00ed}nh c\u{1ee7}a m\u{1ee5}c n\u{00e0}y.",
      properties_partial: "Th\u{00f4}ng tin th\u{01b0} m\u{1ee5}c c\u{00f3} th\u{1ec3} ch\u{01b0}a \u{0111}\u{1ea7}y \u{0111}\u{1ee7} do gi\u{1edb}i h\u{1ea1}n qu\u{00e9}t ho\u{1eb7}c thi\u{1ebf}u quy\u{1ec1}n truy c\u{1ead}p.",
      more_options: "Tùy chọn khác",

      // Drag and Drop
      drag_drop_title: "Thả tệp vào đây để tải lên",
      drag_drop_desc: "Tệp sẽ được lưu trực tiếp vào thư mục hiện tại",

      // Upload Progress
      uploading_title: "Đang tải lên máy chủ...",
      upload_preparing: "Chuẩn bị tải lên {count} tệp...",
      upload_success: "Đã tải lên thành công {count} tệp!",
      upload_busy: "Đang có tiến trình tải lên khác. Vui lòng chờ.",
      upload_error: "Lỗi kết nối khi tải lên.",

      // Editor Modal
      editor_title_close: "Đóng",
      editor_title_wrap: "Bật/Tắt tự động xuống dòng",
      editor_title_fullscreen: "Toàn màn hình",
      editor_zoom_in: "Phóng to cỡ chữ",
      editor_zoom_out: "Thu nhỏ cỡ chữ",
      editor_wrap_label: "Wrap",
      editor_save_btn: "Lưu (Ctrl+S)",
      editor_saving: "Đang lưu...",
      editor_saved_toast: "Đã lưu tệp thành công! (Ctrl+S)",
      editor_loading_toast: "Đang nạp tệp vào trình soạn thảo...",
      editor_save_error: "Lỗi khi lưu: {msg}",
      editor_dirty_confirm: "Tệp có các thay đổi chưa lưu. Bạn có chắc muốn đóng không?",
      editor_wrap_on: "Đã bật tự động xuống dòng",
      editor_wrap_off: "Đã tắt tự động xuống dòng",
      editor_lines_size: "{lines} dòng • {size}",
      editor_cursor: "Ln {row}, Col {col}",
      editor_placeholder: "Nhập nội dung mã nguồn hoặc văn bản...",

      // Preview Modal
      preview_modal_title: "Xem trước",
      preview_loading: "Đang tải xem trước...",
      preview_unsupported: "Không hỗ trợ xem trước trực tiếp định dạng này ({ext}).",
      preview_download_file: "Tải xuống tệp",
      preview_copy_code: "Sao chép",
      preview_edit_code: "Chỉnh sửa",
      preview_lines_size: "({lines} dòng • {size})",
      preview_copied_toast: "Đã sao chép mã nguồn vào bộ nhớ tạm!",
      preview_audio_unsupported: "Trình duyệt không hỗ trợ phát âm thanh.",
      preview_video_unsupported: "Trình duyệt của bạn không hỗ trợ phát video này.",
      preview_csv_empty: "Tệp bảng dữ liệu trống.",
      preview_csv_rows_limit: "Đang hiển thị 100 dòng đầu tiên của tệp.",
      spreadsheet_sheet: "Trang tính",
      spreadsheet_rows: "dòng",
      spreadsheet_cols: "cột",
      spreadsheet_search_placeholder: "Tìm kiếm dữ liệu bảng...",
      spreadsheet_page: "Trang",
      spreadsheet_copy_csv: "Sao chép bảng",
      spreadsheet_copied_toast: "Đã sao chép bảng tính vào bộ nhớ tạm!",
      spreadsheet_save_btn: "Lưu thay đổi (Ctrl+S)",
      spreadsheet_saving: "Đang lưu bảng tính...",
      spreadsheet_saved_toast: "Đã lưu bảng tính thành công!",
      spreadsheet_add_row: "+ Thêm dòng",
      spreadsheet_add_col: "+ Thêm cột",
      spreadsheet_del_row: "Xóa dòng",
      spreadsheet_del_col: "Xóa cột",
      spreadsheet_empty: "Bảng tính không có dữ liệu.",
      spreadsheet_loading: "Đang tải và xử lý bảng tính...",
      spreadsheet_error: "Không thể phân tích dữ liệu bảng tính: {msg}",
      preview_notebook_error: "Lỗi đọc cấu trúc Jupyter Notebook: {msg}",
      preview_zoom_in: "Phóng to (+)",
      preview_zoom_out: "Thu nhỏ (-)",
      preview_fit_screen: "Vừa khung",
      preview_rotate: "Xoay 90°",
      preview_jump_backward: "-10s",
      preview_jump_forward: "+10s",
      preview_playback_speed: "Tốc độ",
      preview_unsupported_codec: "Định dạng này không được trình duyệt hỗ trợ phát trực tiếp. Vui lòng tải về máy để xem.",
      preview_prev: "Mục trước (←)",
      preview_next: "Mục tiếp (→)",
      preview_play: "Phát",
      preview_pause: "Tạm dừng",
      preview_mute: "Tắt tiếng",
      preview_unmute: "Bật tiếng",
      preview_fullscreen: "Toàn màn hình",
      preview_reset_zoom: "Kích thước gốc (1:1)",
      preview_volume: "Âm lượng",

      // Terminal Modal
      terminal_title: "bash - /kaggle/working",
      terminal_close: "Đóng",
      terminal_minimize: "\u0054hu nh\u1ecf v\u1ec1 Kaggle Terminal",
      terminal_minimized_status: "Terminal \u0111ang thu nh\u1ecf \u2014 b\u1ea5m \u0111\u1ec3 m\u1edf l\u1ea1i",
      terminal_clear_btn: "Xóa",
      terminal_clear_title: "Xóa toàn bộ nội dung hiển thị",
      terminal_copy_btn: "Sao chép",
      terminal_copy_title: "Sao chép toàn bộ kết quả terminal",
      terminal_quick_cmds: "Lệnh nhanh:",
      terminal_copy_toast: "Đã sao chép toàn bộ kết quả terminal!",
      terminal_copy_failed: "Không thể sao chép",

      // System Stats Modal
      stats_title: "Giám sát tài nguyên máy chủ",
      stats_scanning: "Đang quét thông tin phần cứng Kaggle...",
      stats_refresh_btn: "Cập nhật",
      stats_refreshing: "Đang nạp...",
      stats_updated_toast: "Đã cập nhật số liệu tài nguyên mới nhất!",
      stats_error_toast: "Lỗi cập nhật số liệu: {msg}",
      stats_disk_card: "Ổ ĐĨA MÁY CHỦ",
      stats_ram_card: "BỘ NHỚ RAM",
      stats_cpu_card: "VI XỬ LÝ CPU",
      stats_gpu_card: "GPU ACCELERATOR",
      stats_free: "Trống",
      stats_available: "Khả dụng",
      stats_cpu_cores: "{cores} Lõi CPU Logic",
      stats_cpu_load: "Tải xử lý: {percent}%",
      stats_cpu_instant: "250 ms",
      stats_gpu_util: "{percent}% GPU",
      stats_vram_used: "VRAM Sử dụng:",
      stats_vram_free: "Còn trống: {free}",
      stats_vram_percent: "{percent}% VRAM",
      stats_gpu_error_title: "Kh\u{00f4}ng x\u{00e1}c \u{0111}\u{1ecb}nh \u{0111}\u{01b0}\u{1ee3}c GPU",
      stats_gpu_error_desc: "Kh\u{00f4}ng th\u{1ec3} truy v\u{1ea5}n th\u{00f4}ng tin GPU (nvidia-smi ho\u{1eb7}c tr\u{00ec}nh \u{0111}i\u{1ec1}u khi\u{1ec3}n g\u{1eb7}p l\u{1ed7}i).",
      stats_gpu_error_badge: "Kh\u{00f4}ng r\u{00f5}",
      stats_gpu_none_title: "CPU-Only Environment",
      stats_gpu_none_desc: "Phiên Kaggle đang chạy ở chế độ CPU tiêu chuẩn (Không kích hoạt GPU Accelerator).",
      stats_gpu_none_badge: "Không khả dụng",

      // Download from URL Modal
      url_modal_title: "Tải từ liên kết trực tiếp (URL)",
      url_modal_desc: "Tải mô hình AI hoặc dataset trực tiếp vào Kaggle bằng kết nối mạng tốc độ cao.",
      url_label: "Đường dẫn liên kết (URL):",
      url_placeholder: "https://huggingface.co/.../model.safetensors",
      url_filename_label: "Tên tệp lưu (Tùy chọn):",
      url_filename_placeholder: "model.safetensors",
      url_btn_start: "Bắt đầu tải",
      url_btn_downloading: "Đang tải xuống...",
      url_start_toast: "Đang tải dữ liệu từ URL về máy chủ Kaggle...",
      url_invalid_toast: "Vui lòng nhập đường dẫn URL hợp lệ.",

      // New Folder Modal
      new_folder_modal_title: "Tạo thư mục mới",
      folder_name_label: "Tên thư mục:",
      folder_name_placeholder: "vi_du_thu_muc",
      create_btn: "Tạo",
      folder_created_toast: "Đã tạo thư mục \"{name}\"",

      // New File Modal
      new_file_modal_title: "Tạo tệp mới",
      file_name_label: "Tên tệp (kèm đuôi .py, .txt, .json,...):",
      file_name_placeholder: "script.py",
      create_file_btn: "Tạo tệp",
      file_created_toast: "Đã tạo tệp \"{name}\"",

      // Rename Modal
      rename_modal_title: "Đổi tên",
      rename_new_label: "Tên mới:",
      rename_success_toast: "Đã đổi tên thành công!",

      // Delete Modal
      delete_modal_title: "Xác nhận xóa",
      delete_confirm_single: "Bạn có chắc chắn muốn xóa mục này không? Thao tác này không thể hoàn tác.",
      delete_confirm_multi: "Bạn có chắc chắn muốn xóa vĩnh viễn {count} mục đã chọn không?",
      delete_btn_permanent: "Xóa vĩnh viễn",
      delete_success_toast: "Đã xóa {count} mục.",

      // Compress Modal
      compress_modal_title: "Nén tệp / thư mục (.ZIP)",
      compress_name_label: "Tên tệp nén:",
      compress_name_placeholder: "archive.zip",
      compress_btn: "Nén ngay",
      compress_start_toast: "Đang nén tệp/thư mục trên Kaggle...",
      compress_success_toast: "Đã nén thành công vào \"{name}\"!",

      // Actions Toasts
      extract_start_toast: "Đang giải nén tập tin...",
      extract_success_toast: "Đã giải nén thành công!",
      duplicate_success_toast: "Đã nhân bản tệp/thư mục thành công!",
      curl_copied_toast: "Đã sao chép liên kết vào bộ nhớ tạm!",
      path_copied_toast: "\u0110\u00e3 sao ch\u00e9p \u0111\u01b0\u1eddng d\u1eabn!",
      curl_prompt: "Sao chép liên kết tải xuống bên dưới:",
      copy_path_prompt: "\u0110\u01b0\u1eddng d\u1eabn c\u1ea7n sao ch\u00e9p:",
      compressing_multi_toast: "Đang nén {count} mục đã chọn...",
      compress_multi_success: "Tải tệp nén thành công!",
      no_items_selected: "Chưa chọn mục nào để nén."
    },

    en: {
      // General
      app_name: "Kaggle Cloud Drive",
      app_subtitle: "Visual File Management System for Kaggle Notebooks",
      loading: "Loading...",
      calculating: "Calculating...",
      cancel: "Cancel",
      confirm: "Confirm",
      save: "Save",
      close: "Close",
      delete: "Delete",
      edit: "Edit",
      download: "Download",
      preview: "Preview",
      duplicate: "Duplicate",
      rename: "Rename",
      copy: "Copy",
      options: "Options",
      success: "Success",
      error: "Error",
      warning: "Warning",
      info: "Info",

      // Login
      username: "Username",
      username_placeholder: "admin",
      password: "Password",
      password_placeholder: "Enter password...",
      login_btn: "Sign in",
      authenticating: "Authenticating...",
      login_empty_error: "Please enter both username and password.",
      login_fail_error: "Incorrect username or password.",
      logout: "Sign out",

      // Topbar
      search_placeholder: "Search files and folders...",
      topbar_storage_title: "View storage & resource usage",
      terminal_btn_title: "Open Kaggle Terminal console",
      toggle_view_title: "Toggle grid / list view",
      toggle_hidden_title: "Show / hide hidden files (.dotfiles)",
      logout_title: "Click to sign out",
      lang_picker_title: "Language / Ngôn ngữ / 语言",

      // Sidebar
      menu_title: "Management Menu",
      btn_new: "New / Upload",
      upload_file: "Upload files",
      upload_folder: "Upload folder",
      upload_url: "Download from URL",
      new_folder: "New folder",
      new_file: "New file",
      nav_storage: "Storage (/kaggle/working)",
      nav_terminal: "Kaggle Terminal",
      nav_resources: "CPU/GPU/RAM Resources",
      disk_usage: "Disk Storage",
      storage_detail_title: "Click to view resource details",

      // Content Header & Toolbar
      go_back: "Back",
      refresh: "Refresh",
      download_folder_zip: "Download Folder (.ZIP)",
      download_folder_zip_title: "Compress current folder to .zip and download",
      upload_url_title: "Download model or dataset directly from URL",
      upload_file_title: "Upload files from computer to Kaggle",
      new_folder_title: "Create new folder",
      new_file_title: "Create new code / text file",

      // Selection Bar
      selected_items: "Selected {count} item(s)",
      download_selected_zip: "Download (.ZIP)",
      delete_selected: "Delete",

      // File List / Grid
      col_name: "Name",
      col_size: "Size",
      col_date: "Date modified",
      col_actions: "Actions",
      empty_title: "Folder is empty or no files match",
      empty_desc: "Drag and drop files here or click \"+ New\" to upload.",
      action_download: "Download",
      action_preview: "Preview",
      action_view_image: "View image",
      action_play_video: "Play video",
      action_play_audio: "Play audio",
      action_view_pdf: "View PDF document",
      action_view_excel: "View Excel Sheet",
      action_view_csv: "View CSV Table",
      action_edit: "Edit source code",
      action_download_zip: "Compress & Download (.ZIP)",
      action_open_folder: "Open folder",
      action_open_terminal: "Open in Terminal",
      action_open_terminal_here: "Open Terminal here",
      folder_badge: "Folder",
      file_badge: "File",
      action_copy_path: "Copy path",
      action_copy_curl: "Copy link",
      action_duplicate: "Duplicate",
      action_rename: "Rename",
      action_delete: "Delete",
      action_extract_here: "Extract here",
      action_compress: "Compress to .ZIP",
      action_compress_selected: "Compress Selected (.ZIP)",
      action_compress_here: "Compress here",
      action_properties: "Properties",
      properties_title: "Properties",
      properties_name: "Name",
      properties_type: "Type",
      properties_location: "Location",
      properties_extension: "Extension",
      properties_mime: "File type",
      properties_size: "Size",
      properties_contents: "Contents",
      properties_files: "files",
      properties_folders: "folders",
      properties_root: "Root folder",
      properties_created: "Created",
      properties_modified: "Date modified",
      properties_permissions: "Permissions",
      properties_loading: "Loading properties...",
      properties_load_error: "Could not load properties for this item.",
      properties_partial: "Folder details may be incomplete because the scan limit was reached or some items could not be accessed.",
      more_options: "More options",

      // Drag and Drop
      drag_drop_title: "Drop files here to upload",
      drag_drop_desc: "Files will be saved directly into current folder",

      // Upload Progress
      uploading_title: "Uploading to server...",
      upload_preparing: "Preparing to upload {count} file(s)...",
      upload_success: "Successfully uploaded {count} file(s)!",
      upload_busy: "Another upload is already in progress. Please wait.",
      upload_error: "Connection error during upload.",

      // Editor Modal
      editor_title_close: "Close",
      editor_title_wrap: "Toggle word wrap",
      editor_title_fullscreen: "Fullscreen",
      editor_zoom_in: "Zoom in",
      editor_zoom_out: "Zoom out",
      editor_wrap_label: "Wrap",
      editor_save_btn: "Save (Ctrl+S)",
      editor_saving: "Saving...",
      editor_saved_toast: "File saved successfully! (Ctrl+S)",
      editor_loading_toast: "Loading file into editor...",
      editor_save_error: "Error saving file: {msg}",
      editor_dirty_confirm: "You have unsaved changes. Are you sure you want to close?",
      editor_wrap_on: "Word wrap enabled",
      editor_wrap_off: "Word wrap disabled",
      editor_lines_size: "{lines} lines • {size}",
      editor_cursor: "Ln {row}, Col {col}",
      editor_placeholder: "Enter source code or text content...",

      // Preview Modal
      preview_modal_title: "Preview",
      preview_loading: "Loading preview...",
      preview_unsupported: "Direct preview is not supported for this format ({ext}).",
      preview_download_file: "Download File",
      preview_copy_code: "Copy",
      preview_edit_code: "Edit",
      preview_lines_size: "({lines} lines • {size})",
      preview_copied_toast: "Source code copied to clipboard!",
      preview_audio_unsupported: "Your browser does not support audio playback.",
      preview_video_unsupported: "Your browser does not support video playback.",
      preview_csv_empty: "Spreadsheet file is empty.",
      preview_csv_rows_limit: "Displaying first 100 rows of file.",
      spreadsheet_sheet: "Sheet",
      spreadsheet_rows: "rows",
      spreadsheet_cols: "cols",
      spreadsheet_search_placeholder: "Search spreadsheet...",
      spreadsheet_page: "Page",
      spreadsheet_copy_csv: "Copy table",
      spreadsheet_copied_toast: "Spreadsheet copied to clipboard!",
      spreadsheet_save_btn: "Save changes (Ctrl+S)",
      spreadsheet_saving: "Saving spreadsheet...",
      spreadsheet_saved_toast: "Spreadsheet saved successfully!",
      spreadsheet_add_row: "+ Add Row",
      spreadsheet_add_col: "+ Add Column",
      spreadsheet_del_row: "Delete Row",
      spreadsheet_del_col: "Delete Column",
      spreadsheet_empty: "Spreadsheet has no data.",
      spreadsheet_loading: "Loading and parsing spreadsheet...",
      spreadsheet_error: "Failed to parse spreadsheet: {msg}",
      preview_notebook_error: "Error parsing Jupyter Notebook structure: {msg}",
      preview_zoom_in: "Zoom in (+)",
      preview_zoom_out: "Zoom out (-)",
      preview_fit_screen: "Fit screen",
      preview_rotate: "Rotate 90°",
      preview_jump_backward: "-10s",
      preview_jump_forward: "+10s",
      preview_playback_speed: "Speed",
      preview_unsupported_codec: "This format is not directly supported by your browser. Please download to view locally.",
      preview_prev: "Previous (←)",
      preview_next: "Next (→)",
      preview_play: "Play",
      preview_pause: "Pause",
      preview_mute: "Mute",
      preview_unmute: "Unmute",
      preview_fullscreen: "Fullscreen",
      preview_reset_zoom: "Original size (1:1)",
      preview_volume: "Volume",

      // Terminal Modal
      terminal_title: "bash - /kaggle/working",
      terminal_close: "Close",
      terminal_minimize: "Minimize to Kaggle Terminal",
      terminal_minimized_status: "Terminal minimized - click to restore",
      terminal_clear_btn: "Clear",
      terminal_clear_title: "Clear terminal screen",
      terminal_copy_btn: "Copy",
      terminal_copy_title: "Copy all terminal output",
      terminal_quick_cmds: "Quick commands:",
      terminal_copy_toast: "Terminal output copied to clipboard!",
      terminal_copy_failed: "Failed to copy",

      // System Stats Modal
      stats_title: "Server Resource Monitor",
      stats_scanning: "Scanning Kaggle hardware metrics...",
      stats_refresh_btn: "Refresh",
      stats_refreshing: "Loading...",
      stats_updated_toast: "System resource metrics updated!",
      stats_error_toast: "Failed to update stats: {msg}",
      stats_disk_card: "SERVER DISK",
      stats_ram_card: "SYSTEM RAM",
      stats_cpu_card: "CPU PROCESSOR",
      stats_gpu_card: "GPU ACCELERATOR",
      stats_free: "Free",
      stats_available: "Available",
      stats_cpu_cores: "{cores} Logical Cores",
      stats_cpu_load: "Load: {percent}%",
      stats_cpu_instant: "250 ms",
      stats_gpu_util: "{percent}% GPU",
      stats_vram_used: "VRAM Used:",
      stats_vram_free: "Free: {free}",
      stats_vram_percent: "{percent}% VRAM",
      stats_gpu_error_title: "GPU status unknown",
      stats_gpu_error_desc: "Could not query GPU details. Check nvidia-smi and the GPU driver.",
      stats_gpu_error_badge: "Query error",
      stats_gpu_none_title: "CPU-Only Environment",
      stats_gpu_none_desc: "Kaggle session is running in standard CPU mode (GPU Accelerator not enabled).",
      stats_gpu_none_badge: "Not available",

      // Download from URL Modal
      url_modal_title: "Direct URL Download",
      url_modal_desc: "Download AI models or datasets directly into Kaggle via high-speed datacenter connection.",
      url_label: "Direct Download Link (URL):",
      url_placeholder: "https://huggingface.co/.../model.safetensors",
      url_filename_label: "Save Filename (Optional):",
      url_filename_placeholder: "model.safetensors",
      url_btn_start: "Start Download",
      url_btn_downloading: "Downloading...",
      url_start_toast: "Downloading file from URL to Kaggle server...",
      url_invalid_toast: "Please enter a valid URL.",

      // New Folder Modal
      new_folder_modal_title: "Create New Folder",
      folder_name_label: "Folder name:",
      folder_name_placeholder: "example_folder",
      create_btn: "Create",
      folder_created_toast: "Created folder \"{name}\"",

      // New File Modal
      new_file_modal_title: "Create New File",
      file_name_label: "File name (with ext .py, .txt, .json,...):",
      file_name_placeholder: "script.py",
      create_file_btn: "Create File",
      file_created_toast: "Created file \"{name}\"",

      // Rename Modal
      rename_modal_title: "Rename",
      rename_new_label: "New name:",
      rename_success_toast: "Renamed successfully!",

      // Delete Modal
      delete_modal_title: "Confirm Deletion",
      delete_confirm_single: "Are you sure you want to permanently delete this item? This action cannot be undone.",
      delete_confirm_multi: "Are you sure you want to permanently delete {count} selected item(s)?",
      delete_btn_permanent: "Delete Permanently",
      delete_success_toast: "Deleted {count} item(s).",

      // Compress Modal
      compress_modal_title: "Compress Files / Folders (.ZIP)",
      compress_name_label: "Archive name:",
      compress_name_placeholder: "archive.zip",
      compress_btn: "Compress Now",
      compress_start_toast: "Compressing items on Kaggle...",
      compress_success_toast: "Successfully compressed to \"{name}\"!",

      // Actions Toasts
      extract_start_toast: "Extracting archive...",
      extract_success_toast: "Extracted successfully!",
      duplicate_success_toast: "Item duplicated successfully!",
      curl_copied_toast: "Download link copied to clipboard!",
      path_copied_toast: "Path copied to clipboard!",
      curl_prompt: "Copy download link below:",
      copy_path_prompt: "Path to copy:",
      compressing_multi_toast: "Compressing {count} selected item(s)...",
      compress_multi_success: "Downloaded compressed archive!",
      no_items_selected: "No items selected to compress."
    },

    zh: {
      // General
      app_name: "Kaggle Cloud Drive",
      app_subtitle: "适用于 Kaggle Notebook 的可视化文件管理系统",
      loading: "加载中...",
      calculating: "计算中...",
      cancel: "取消",
      confirm: "确定",
      save: "保存",
      close: "关闭",
      delete: "删除",
      edit: "编辑",
      download: "下载",
      preview: "预览",
      duplicate: "创建副本",
      rename: "重命名",
      copy: "复制",
      options: "选项",
      success: "成功",
      error: "错误",
      warning: "警告",
      info: "提示",

      // Login
      username: "用户名",
      username_placeholder: "admin",
      password: "密码",
      password_placeholder: "输入密码...",
      login_btn: "登录",
      authenticating: "正在验证...",
      login_empty_error: "请输入用户名和密码。",
      login_fail_error: "用户名或密码错误。",
      logout: "退出登录",

      // Topbar
      search_placeholder: "搜索文件和文件夹...",
      topbar_storage_title: "查看存储容量与系统资源",
      terminal_btn_title: "打开 Kaggle 终端控制台",
      toggle_view_title: "切换网格/列表视图",
      toggle_hidden_title: "显示/隐藏隐藏文件 (.dotfiles)",
      logout_title: "点击退出登录",
      lang_picker_title: "语言 / Language / Ngôn ngữ",

      // Sidebar
      menu_title: "管理菜单",
      btn_new: "新建 / 上传",
      upload_file: "上传文件",
      upload_folder: "上传文件夹",
      upload_url: "从 URL 下载",
      new_folder: "新建文件夹",
      new_file: "新建文件",
      nav_storage: "存储空间 (/kaggle/working)",
      nav_terminal: "Kaggle 终端",
      nav_resources: "CPU/GPU/RAM 资源监控",
      disk_usage: "磁盘容量",
      storage_detail_title: "点击查看资源详情",

      // Content Header & Toolbar
      go_back: "返回上级",
      refresh: "刷新",
      download_folder_zip: "下载文件夹 (.ZIP)",
      download_folder_zip_title: "将当前文件夹压缩为 .zip 并下载",
      upload_url_title: "从直接链接下载 AI 模型或数据集",
      upload_file_title: "从本地上传文件到 Kaggle",
      new_folder_title: "创建新文件夹",
      new_file_title: "创建新代码/文本文件",

      // Selection Bar
      selected_items: "已选择 {count} 项",
      download_selected_zip: "打包下载 (.ZIP)",
      delete_selected: "删除",

      // File List / Grid
      col_name: "名称",
      col_size: "大小",
      col_date: "修改日期",
      col_actions: "操作",
      empty_title: "文件夹为空或没有匹配的文件",
      empty_desc: "将文件拖放到此处或点击“+ 新建”进行上传。",
      action_download: "下载",
      action_preview: "在线预览",
      action_view_image: "查看图片",
      action_play_video: "播放视频",
      action_play_audio: "播放音频",
      action_view_pdf: "查看 PDF 文档",
      action_view_excel: "查看 Excel 表格",
      action_view_csv: "查看 CSV 表格",
      action_edit: "编辑源代码",
      action_download_zip: "打包并下载 (.ZIP)",
      action_open_folder: "打开文件夹",
      action_open_terminal: "在终端中打开",
      action_open_terminal_here: "在此处打开终端",
      folder_badge: "文件夹",
      file_badge: "文件",
      action_copy_path: "\u590d\u5236\u8def\u5f84",
      action_copy_curl: "复制链接",
      action_duplicate: "创建副本",
      action_rename: "重命名",
      action_delete: "删除",
      action_extract_here: "解压到此处",
      action_compress: "压缩为 .ZIP",
      action_compress_selected: "压缩所选项目 (.ZIP)",
      action_compress_here: "压缩保存在此",
      action_properties: "\u5c5e\u6027",
      properties_title: "\u5c5e\u6027",
      properties_name: "\u540d\u79f0",
      properties_type: "\u7c7b\u578b",
      properties_location: "\u4f4d\u7f6e",
      properties_extension: "\u6269\u5c55\u540d",
      properties_mime: "\u6587\u4ef6\u7c7b\u578b",
      properties_size: "\u5927\u5c0f",
      properties_contents: "\u5185\u5bb9",
      properties_files: "\u4e2a\u6587\u4ef6",
      properties_folders: "\u4e2a\u6587\u4ef6\u5939",
      properties_root: "\u6839\u76ee\u5f55",
      properties_created: "\u521b\u5efa\u65f6\u95f4",
      properties_modified: "\u4fee\u6539\u65f6\u95f4",
      properties_permissions: "\u6743\u9650",
      properties_loading: "\u6b63\u5728\u52a0\u8f7d\u5c5e\u6027...",
      properties_load_error: "\u65e0\u6cd5\u52a0\u8f7d\u6b64\u9879\u76ee\u7684\u5c5e\u6027\u3002",
      properties_partial: "Folder details may be incomplete because the scan limit was reached or some items could not be accessed.",
      more_options: "更多选项",

      // Drag and Drop
      drag_drop_title: "将文件拖放到此处上传",
      drag_drop_desc: "文件将直接保存到当前文件夹",

      // Upload Progress
      uploading_title: "正在上传到服务器...",
      upload_preparing: "正在准备上传 {count} 个文件...",
      upload_success: "成功上传 {count} 个文件！",
      upload_busy: "已有文件正在上传中，请稍候。",
      upload_error: "上传时发生网络连接错误。",

      // Editor Modal
      editor_title_close: "关闭",
      editor_title_wrap: "开启/关闭自动换行",
      editor_title_fullscreen: "全屏切换",
      editor_zoom_in: "放大字体",
      editor_zoom_out: "缩小字体",
      editor_wrap_label: "换行",
      editor_save_btn: "保存 (Ctrl+S)",
      editor_saving: "正在保存...",
      editor_saved_toast: "文件保存成功！(Ctrl+S)",
      editor_loading_toast: "正在加载文件到编辑器...",
      editor_save_error: "保存文件失败: {msg}",
      editor_dirty_confirm: "文件有未保存的更改，确定要关闭吗？",
      editor_wrap_on: "已开启自动换行",
      editor_wrap_off: "已关闭自动换行",
      editor_lines_size: "{lines} 行 • {size}",
      editor_cursor: "第 {row} 行，第 {col} 列",
      editor_placeholder: "输入源代码或文本内容...",

      // Preview Modal
      preview_modal_title: "预览",
      preview_loading: "正在加载预览...",
      preview_unsupported: "不支持直接预览此格式 ({ext})。",
      preview_download_file: "下载文件",
      preview_copy_code: "复制源码",
      preview_edit_code: "编辑",
      preview_lines_size: "({lines} 行 • {size})",
      preview_copied_toast: "源代码已复制到剪贴板！",
      preview_audio_unsupported: "您的浏览器不支持播放该音频。",
      preview_video_unsupported: "您的浏览器不支持播放该视频。",
      preview_csv_empty: "表格文件为空。",
      preview_csv_rows_limit: "仅显示前 100 行数据。",
      spreadsheet_sheet: "工作表",
      spreadsheet_rows: "行",
      spreadsheet_cols: "列",
      spreadsheet_search_placeholder: "搜索表格数据...",
      spreadsheet_page: "页",
      spreadsheet_copy_csv: "复制表格",
      spreadsheet_copied_toast: "表格已复制到剪贴板！",
      spreadsheet_save_btn: "保存更改 (Ctrl+S)",
      spreadsheet_saving: "正在保存表格...",
      spreadsheet_saved_toast: "表格保存成功！",
      spreadsheet_add_row: "+ 添加行",
      spreadsheet_add_col: "+ 添加列",
      spreadsheet_del_row: "删除行",
      spreadsheet_del_col: "删除列",
      spreadsheet_empty: "电子表格无数据。",
      spreadsheet_loading: "正在加载并解析表格...",
      spreadsheet_error: "解析表格出错：{msg}",
      preview_notebook_error: "解析 Jupyter Notebook 结构出错: {msg}",
      preview_zoom_in: "放大 (+)",
      preview_zoom_out: "缩小 (-)",
      preview_fit_screen: "适应窗口",
      preview_rotate: "旋转 90°",
      preview_jump_backward: "后退 10 秒",
      preview_jump_forward: "快进 10 秒",
      preview_playback_speed: "倍速",
      preview_unsupported_codec: "浏览器不支持此视频编码格式，请下载至本地播放。",
      preview_prev: "上一项 (←)",
      preview_next: "下一项 (→)",
      preview_play: "播放",
      preview_pause: "暂停",
      preview_mute: "静音",
      preview_unmute: "取消静音",
      preview_fullscreen: "全屏",
      preview_reset_zoom: "原始尺寸 (1:1)",
      preview_volume: "音量",

      // Terminal Modal
      terminal_title: "bash - /kaggle/working",
      terminal_close: "关闭",
      terminal_minimize: "\u6700\u5c0f\u5316\u5230 Kaggle Terminal",
      terminal_minimized_status: "\u7ec8\u7aef\u5df2\u6700\u5c0f\u5316\uff0c\u70b9\u51fb\u4ee5\u6062\u590d",
      terminal_clear_btn: "清屏",
      terminal_clear_title: "清除终端屏幕内容",
      terminal_copy_btn: "复制",
      terminal_copy_title: "复制全部终端输出",
      terminal_quick_cmds: "快捷命令:",
      terminal_copy_toast: "已复制终端输出到剪贴板！",
      terminal_copy_failed: "无法复制",

      // System Stats Modal
      stats_title: "服务器硬件资源监控",
      stats_scanning: "正在扫描 Kaggle 硬件状态...",
      stats_refresh_btn: "刷新",
      stats_refreshing: "刷新中...",
      stats_updated_toast: "系统资源数据已更新！",
      stats_error_toast: "更新数据失败: {msg}",
      stats_disk_card: "服务器磁盘",
      stats_ram_card: "运行内存 RAM",
      stats_cpu_card: "CPU 处理器",
      stats_gpu_card: "GPU 加速卡",
      stats_free: "空闲",
      stats_available: "可用",
      stats_cpu_cores: "{cores} 个逻辑核心",
      stats_cpu_load: "当前负载: {percent}%",
      stats_cpu_instant: "250 ms",
      stats_gpu_util: "{percent}% GPU",
      stats_vram_used: "显存已用:",
      stats_vram_free: "剩余: {free}",
      stats_vram_percent: "{percent}% 显存",
      stats_gpu_error_title: "\u65e0\u6cd5\u786e\u8ba4 GPU \u72b6\u6001",
      stats_gpu_error_desc: "\u65e0\u6cd5\u67e5\u8be2 GPU \u4fe1\u606f\uff0c\u8bf7\u68c0\u67e5 nvidia-smi \u548c GPU \u9a71\u52a8\u7a0b\u5e8f\u3002",
      stats_gpu_error_badge: "\u67e5\u8be2\u9519\u8bef",
      stats_gpu_none_title: "仅 CPU 环境",
      stats_gpu_none_desc: "当前 Kaggle 会话在标准 CPU 模式下运行（未开启 GPU 加速）。",
      stats_gpu_none_badge: "不可用",

      // Download from URL Modal
      url_modal_title: "从直接链接 (URL) 下载",
      url_modal_desc: "利用 Kaggle 数据中心高速网络将 AI 模型或数据集直接下载到服务器。",
      url_label: "直接下载链接 (URL):",
      url_placeholder: "https://huggingface.co/.../model.safetensors",
      url_filename_label: "保存文件名（可选）:",
      url_filename_placeholder: "model.safetensors",
      url_btn_start: "开始下载",
      url_btn_downloading: "正在下载...",
      url_start_toast: "正在从 URL 下载文件到 Kaggle 服务器...",
      url_invalid_toast: "请输入有效的下载链接 (URL)。",

      // New Folder Modal
      new_folder_modal_title: "创建新文件夹",
      folder_name_label: "文件夹名称:",
      folder_name_placeholder: "example_folder",
      create_btn: "创建",
      folder_created_toast: "已创建文件夹 \"{name}\"",

      // New File Modal
      new_file_modal_title: "创建新文件",
      file_name_label: "文件名（包含 .py, .txt, .json,... 后缀）:",
      file_name_placeholder: "script.py",
      create_file_btn: "创建文件",
      file_created_toast: "已创建文件 \"{name}\"",

      // Rename Modal
      rename_modal_title: "重命名",
      rename_new_label: "新名称:",
      rename_success_toast: "重命名成功！",

      // Delete Modal
      delete_modal_title: "确认删除",
      delete_confirm_single: "您确定要删除此项目吗？该操作不可撤消。",
      delete_confirm_multi: "您确定要永久删除选中的 {count} 个项目吗？",
      delete_btn_permanent: "永久删除",
      delete_success_toast: "已删除 {count} 个项目。",

      // Compress Modal
      compress_modal_title: "压缩文件 / 文件夹 (.ZIP)",
      compress_name_label: "压缩包名称:",
      compress_name_placeholder: "archive.zip",
      compress_btn: "立即压缩",
      compress_start_toast: "正在 Kaggle 上压缩文件...",
      compress_success_toast: "成功压缩到 \"{name}\"！",

      // Actions Toasts
      extract_start_toast: "正在解压文件...",
      extract_success_toast: "解压成功！",
      duplicate_success_toast: "已成功创建副本！",
      curl_copied_toast: "下载链接已复制到剪贴板！",
      path_copied_toast: "\u8def\u5f84\u5df2\u590d\u5236\u5230\u526a\u8d34\u677f\uff01",
      curl_prompt: "复制下方的下载链接:",
      copy_path_prompt: "\u8981\u590d\u5236\u7684\u8def\u5f84:",
      compressing_multi_toast: "正在压缩选中的 {count} 个项目...",
      compress_multi_success: "压缩文件下载成功！",
      no_items_selected: "未选择要压缩的项目。"
    }
  },

  t(key, params = {}) {
    let str = this.translations[this.currentLang]?.[key] || this.translations["vi"]?.[key] || key;
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, "g"), v);
    }
    return str;
  },

  setLanguage(lang) {
    if (!this.locales[lang]) return;
    this.currentLang = lang;
    localStorage.setItem("kaggle_drive_lang", lang);
    document.documentElement.lang = lang;
    this.updateLanguageUI();
    this.translateDOM();

    // Close any open language dropdowns
    document.querySelectorAll(".lang-dropdown-menu").forEach(el => el.classList.add("hidden"));

    // Inform App to re-render dynamic content
    if (window.App && typeof App.onLanguageChange === "function") {
      App.onLanguageChange();
    }
  },

  toggleDropdown(event, dropdownId = "langDropdownMenu") {
    if (event) event.stopPropagation();
    const dropdown = document.getElementById(dropdownId);
    if (dropdown) {
      dropdown.classList.toggle("hidden");
    }
  },

  updateLanguageUI() {
    const info = this.locales[this.currentLang];
    document.querySelectorAll(".current-lang-label").forEach(el => {
      el.textContent = info.label;
    });
    document.querySelectorAll(".current-lang-flag").forEach(el => {
      el.textContent = info.flag;
    });
    document.querySelectorAll(".current-lang-name").forEach(el => {
      el.textContent = info.name;
    });

    document.querySelectorAll("[data-lang-select]").forEach(el => {
      const targetLang = el.getAttribute("data-lang-select");
      if (targetLang === this.currentLang) {
        el.classList.add("bg-brand-50", "text-brand-600", "font-bold");
      } else {
        el.classList.remove("bg-brand-50", "text-brand-600", "font-bold");
      }
    });
  },

  translateDOM() {
    // 1. Text elements
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      const translation = this.t(key);
      if (translation && translation !== key) {
        el.textContent = translation;
      }
    });

    // 2. Placeholder attributes
    document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
      const key = el.getAttribute("data-i18n-placeholder");
      const translation = this.t(key);
      if (translation) {
        el.placeholder = translation;
      }
    });

    // 3. Title attributes
    document.querySelectorAll("[data-i18n-title]").forEach(el => {
      const key = el.getAttribute("data-i18n-title");
      const translation = this.t(key);
      if (translation) {
        el.title = translation;
      }
    });
  },

  detectLanguage() {
    // 1. URL parameter ?lang=
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlLang = urlParams.get("lang");
      if (urlLang && this.locales[urlLang.toLowerCase()]) {
        const clean = urlLang.toLowerCase();
        localStorage.setItem("kaggle_drive_lang", clean);
        return clean;
      }
    } catch (_) {}

    // 2. Server configured default language from <meta name="server-lang" content="...">
    const serverMeta = document.querySelector('meta[name="server-lang"]');
    const serverLang = serverMeta ? serverMeta.getAttribute("content") : null;
    const lastServerLang = localStorage.getItem("kaggle_drive_last_server_lang");

    if (serverLang && this.locales[serverLang.toLowerCase()]) {
      const cleanServer = serverLang.toLowerCase();
      // If server configuration was changed (e.g. run.py --lang en), apply server default
      if (cleanServer !== lastServerLang) {
        localStorage.setItem("kaggle_drive_last_server_lang", cleanServer);
        localStorage.setItem("kaggle_drive_lang", cleanServer);
        return cleanServer;
      }
    }

    // 3. User chosen preference from localStorage
    const saved = localStorage.getItem("kaggle_drive_lang");
    if (saved && this.locales[saved.toLowerCase()]) {
      return saved.toLowerCase();
    }

    // 4. Fallback to server setting or default 'vi'
    return (serverLang && this.locales[serverLang.toLowerCase()]) ? serverLang.toLowerCase() : "vi";
  },

  init() {
    this.currentLang = this.detectLanguage();
    document.documentElement.lang = this.currentLang;
    this.updateLanguageUI();
    this.translateDOM();

    document.addEventListener("click", () => {
      document.querySelectorAll(".lang-dropdown-menu").forEach(el => {
        el.classList.add("hidden");
      });
    });
  }
};

window.I18n = I18n;
window.t = (k, p) => I18n.t(k, p);
