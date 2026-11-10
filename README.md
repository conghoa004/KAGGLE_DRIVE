# ☁️ Kaggle Cloud Drive (v2.0)

[![Python](https://img.shields.io/badge/Python-3.10%20--%203.13+-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4+-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Cloudflare Tunnel](https://img.shields.io/badge/Cloudflare_Tunnel-Enabled-F38020?style=flat-square&logo=cloudflare&logoColor=white)](https://www.cloudflare.com/)
[![i18n](https://img.shields.io/badge/i18n-VI%20|%20EN%20|%20ZH-blue?style=flat-square&logo=google-translate&logoColor=white)](#-1-internationalization-i18n)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

> **Kaggle Cloud Drive** is a web file manager designed for **Kaggle Notebooks** and local development. It manages the configured root directory and includes a browser code editor, an optional VS Code Web IDE powered by code-server, a Linux terminal, hardware monitoring, and an optional public tunnel through **Cloudflare Tunnel**.

---

## 🌟 Key Features

### 1. 🌍 Internationalization (i18n)
- Full support for **3 languages**:
  - 🇻🇳 **Vietnamese (`vi`)**
  - 🇺🇸 **English (`en`)** (Default)
  - 🇨🇳 **Simplified Chinese (`zh`)**
- Seamless language switching:
  - **Login Screen**: Quick-switch buttons 🇻🇳 VI | 🇺🇸 EN | 🇨🇳 ZH located directly below the login form.
  - **Topbar Navigation**: Flag dropdown menu for instant switching without reloading the page.
- Select default startup language via CLI `--lang vi|en|zh` on `run.py` / `start_server.py` or URL query parameter `?lang=en`.
- Automatically persists user language preferences in `localStorage`.

### 2. 🎨 Tailwind CSS & Responsive Design
- Crafted with modern **Tailwind CSS**, paired with **Plus Jakarta Sans** (UI typography) and **JetBrains Mono** (code & terminal).
- **100% Responsive**: Smooth drawer navigation menu for mobile and tablet devices, spacious grid & table views on desktop.
- Crisp vector icons powered by **Font Awesome 6 Free** instead of plain emojis.
- Easily toggle between **Grid View** and **List View**.
- Toggle visibility for hidden dotfiles (`.dotfiles`).

### 3. 📁 Full Management of `/`
- **High-Speed Uploads**:
  - Drag & drop files or entire folders directly into the browser.
  - Upload entire directory trees (`webkitdirectory`) preserving complete subfolder structures.
  - Concurrent multi-file upload with progress bars and percentage indicators.
- **Flexible Downloads**:
  - Direct high-speed download for single files.
  - Download any folder compressed as a `.ZIP` archive with a single click.
  - Batch select and download multiple files/folders together as `.zip`.
  - Copy ready-to-use `cURL` download commands to pull files to any remote server or local machine.
- **Direct URL Downloader**:
  - Paste any download link (Hugging Face, GitHub Releases, Google Drive, direct links) to pull AI models or datasets directly into Kaggle using datacenter-grade high-speed bandwidth (hundreds of MB/s).
- **Advanced File Operations**: Create folders, create files, rename, duplicate, delete individually or in bulk, and extract archives (`.zip`, `.tar`, `.tar.gz`) directly in Kaggle.

### 4. 👁️ Rich Media & Document Previewer
- **Images**: PNG, JPG, JPEG, WEBP, GIF, SVG, BMP, ICO.
- **Audio & Video**: MP4, WebM, OGG, MP3, WAV with byte-range streaming and browser seek support.
- **Jupyter Notebooks (`.ipynb`)**: Renders Markdown cells, Code cells, formatted outputs, and execution errors.
- **Tabular Data (CSV, TSV)**: Structured table view with line numbers; previews the first 100 rows.
- **Code & Documents**: Syntax-highlighted Markdown, PDF viewer, and raw text files.

### 5. ✏️ Web Code Editor
- Professional Dark Mode code editor.
- Keyboard shortcut **`Ctrl + S`** (or `Cmd + S`) for instant saving with toast notification.
- Supports 4-space `Tab` indentation, dynamic font size adjustment (`- 14px +`), and toggleable line wrap.
- Real-time status bar displaying line count, file size, cursor coordinates (Line, Column), and UTF-8 encoding.
- Dirty check confirmation prompt prevents accidental exit with unsaved changes.
- The full VS Code Web IDE opens at `/ide/` in a new tab from the top bar or sidebar. It uses the same authenticated session and opens the configured managed root directory.
- On Linux, when `CODE_SERVER_BIN` is unset and no `code-server` executable is on `PATH`, code-server is downloaded on first start into `.code_server_bin/`. Internet access is needed for this download; if startup fails, the file manager continues to run.

### 6. 💻 Integrated Kaggle Terminal Console
- Interactive Linux shell backed by a PTY and authenticated WebSocket. Requires a Linux runtime such as Kaggle.
- Live ANSI colors, progress output, persistent `cd`, shell history, and keyboard input such as Ctrl+C.
- Supports interactive terminal programs when available in the Kaggle environment.
- xterm.js display with quick commands, clear, copy, minimize, and restore controls.

### 7. 📊 Real-Time Hardware Resource Monitor
- **Server Disk**: Monitored `/` partition usage (Used / Total / Free / Percent).
- **System RAM**: Memory utilization, available memory, and load gauge.
- **CPU**: Logical core count and instant CPU load percentage.
- **NVIDIA GPU Accelerator**:
  - Auto-detects NVIDIA GPUs (Tesla T4, P100, etc.).
  - Tracks VRAM usage (Used / Total / Free) and GPU compute load via `nvidia-smi`.
  - Clearly displays a `CPU-Only` badge when GPU acceleration is disabled.
- **Top Largest Files**: Lists the largest space-consuming files with quick-preview shortcuts for rapid disk cleanups.

### 8. 🔒 Security & Public HTTPS Tunneling
- **Cloudflare Tunnel**: Automatically downloads and runs Cloudflared when needed. Quick tunnels use a `trycloudflare.com` HTTPS address without manual port forwarding or a Cloudflare account; named tunnels can be configured with a token.
- **Path Traversal & Zip Slip Prevention**: Strictly validates file paths against `ROOT_DIR`, blocking directory escape attacks (`../../`).
- **Authentication**: Verifies credentials using `secrets.compare_digest`. Session cookies are signed (not encrypted) and have a configurable lifetime.

---

## 📁 Project Structure

```text
kaggle_drive/
├── app/
│   ├── __init__.py
│   ├── config.py                  # Server configuration, environment variables, default language
│   ├── security.py                # Path traversal sanitization, session checks, credential validation
│   ├── main.py                    # FastAPI application initialization, middleware, static/template routes
│   ├── services/
│   │   ├── __init__.py
│   │   ├── file_service.py        # File operations: upload, download, zip, extract, duplicate
│   │   ├── system_service.py      # Hardware metrics: Disk, RAM, CPU, NVIDIA GPU
│   │   ├── pty_terminal_service.py # Interactive Linux PTY session management
│   │   ├── code_server_service.py # Private code-server process and Linux installation
│   │   └── tunnel_service.py      # Automated Cloudflare Tunnel management
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── auth_routes.py         # Authentication endpoints: /login, /logout, /me
│   │   ├── file_routes.py         # File management endpoints: CRUD, stream, chunk upload, zip, url
│   │   ├── system_routes.py       # System metrics (/stats) and terminal (/terminal)
│   │   ├── ide_routes.py          # Authenticated HTTP and WebSocket proxy for /ide/
│   │   └── view_routes.py         # SPA HTML route and public config (/api/config)
│   ├── static/
│   │   ├── css/
│   │   │   └── main.css           # Modern stylesheet, custom scrollbars, animations
│   │   └── js/
│   │       ├── i18n.js            # Internationalization library (VI, EN, ZH) and language detector
│   │       ├── api.js             # Centralized API fetch wrapper
│   │       ├── ui.js              # Modal, Toast notifications, file type icon helpers
│   │       ├── upload.js          # Drag & drop multi-file / folder upload with progress
│   │       ├── editor.js          # Dark Mode web code editor (Ctrl+S, wrap, font sizing)
│   │       ├── preview.js         # Rich previewer for media, CSV, Jupyter Notebooks
│   │       └── app.js             # Application lifecycle controller
│   └── templates/
│       └── index.html             # Single Page Application HTML template
├── tests/                         # Automated unit tests
│   ├── test_file_service.py       # Tests file CRUD, zip slip defenses, compression & extraction
│   ├── test_security.py           # Tests path traversal prevention & authentication
│   └── test_system_service.py     # Tests Disk, RAM, and CPU metric retrieval
├── run.py                         # Foreground server launcher (blocks notebook cell)
├── start_server.py                # Background server launcher with intelligent log polling
├── stop_server.py                 # Graceful background server stopper and port release
├── requirements.txt               # Python package dependencies
├── .env.example                   # Environment variable template
├── LICENSE                        # MIT License
└── README.md                      # Project documentation
```

---

## 🚀 Getting Started

> [!IMPORTANT]
> **Kaggle Requirement**: Ensure that **Internet** is toggled **ON** in your Kaggle Notebook settings (**Notebook Settings** -> **Internet** -> **Internet on**). Without internet access, Cloudflare Tunnel cannot connect to generate your public URL.
> Internet is also needed on first launch to download Cloudflared and, when enabled and not already installed, code-server. The file manager itself can continue in local-only mode if the tunnel or IDE cannot start.

---

### 📦 Option 1: Run From GitHub Repository on Kaggle

If you want to customize the codebase, keep server log files, or pull the latest changes from GitHub:

Create a code cell in your Kaggle Notebook and run:

```python
import os

%cd /kaggle/working

PROJECT_DIR = "/kaggle/working/kaggle_drive"

# 1. Clone or update repository from GitHub
if not os.path.isdir(PROJECT_DIR):
    print("[*] Cloning repository from GitHub...")
    !git clone https://github.com/conghoa004/kaggle_drive.git
else:
    print("[*] Repository exists -> Pulling latest changes...")
    %cd /kaggle/working/kaggle_drive
    !git pull

%cd /kaggle/working/kaggle_drive

# 2. Install dependencies
print("[*] Installing dependencies...")
!pip install -q -r requirements.txt

# 3. Start the server in the background
print("[*] Starting Kaggle Cloud Drive...")

# Defaults: English UI, username admin, and a generated password
# !python start_server.py

# Optional: --lang vi|en|zh, --username <user>, --password <pass>
# !python start_server.py --lang en --username admin --password your_password

# Keep the notebook cell attached to the server and stream logs in real time:
!python start_server.py --foreground
```

In foreground mode, the notebook cell remains attached while the server runs; interrupt the cell to stop it. The app prints the login credentials and local/public URLs during startup, and writes output to `server.log`. code-server output is written to `.code_server_bin/code-server.log`.

Running `start_server.py` again without `--foreground` prints the active server's URLs and credentials, then exits. With `--foreground`, it attaches to that server's log; pressing Ctrl+C stops the existing server.

#### Stopping the Background Server:
To stop the server at any time, run in a new notebook cell:
```python
!python /kaggle/working/kaggle_drive/stop_server.py
```

---

### 💻 Option 2: Local Development (Windows / macOS / Linux)

Run locally to manage personal files or develop new features:

```bash
# 1. Clone repository
git clone https://github.com/conghoa004/kaggle_drive.git
cd kaggle_drive

# 2. Install dependencies
pip install -r requirements.txt

# 3. Launch in local mode (disables Cloudflare Tunnel, binds to localhost)
python run.py --no-tunnel

# Customize directory, port, and language:
python run.py --root ./my_workspace --port 8080 --lang en --no-tunnel
```

Open your browser at `http://127.0.0.1:8000` (or your chosen port).

---

## ⚙️ CLI Reference (`run.py` & `start_server.py`)

Both `run.py` and `start_server.py` accept the following command-line arguments:

| Flag | Short | Default | Allowed Values | Description |
|---|---|---|---|---|
| `--lang` | `-l` | `en` | `vi`, `en`, `zh` | Default UI language upon launch |
| `--username` | `-u` | `admin` | String | Admin account username |
| `--password` | `-p` | *(Auto-generated if omitted)* | String | Admin account password |
| `--port` | | `8000` | Integer (e.g. `8080`) | TCP port for FastAPI service |
| `--host` | | `127.0.0.1` | IP address | Server listen host |
| `--root` | | Configured root (`/` by default) | Directory path | Target root directory to manage |
| `--no-tunnel` | | `False` | Flag | Disables Cloudflare Tunnel (local only) |
| `--token` | | `None` | String | Cloudflare Named Tunnel token for custom domains |
| `--foreground` *(only `start_server.py`)* | | `False` | Flag | Keep the server attached to the current terminal and stream its output |
| `--wait` *(only `start_server.py`)* | | `300` | Seconds (integer) | Max seconds to wait for startup before printing the log |

---

## 🔐 Environment Variables

You can configure options through a `.env` file or export them before running:

| Variable | Default | Description |
|---|---|---|
| `KAGGLE_DRIVE_LANG` | `en` | Default interface language (`vi`, `en`, `zh`) |
| `KAGGLE_DRIVE_USERNAME` | `admin` | Admin username |
| `KAGGLE_DRIVE_PASSWORD` | *(Auto-generated)* | Admin password |
| `KAGGLE_DRIVE_ROOT` | `/` | Managed root directory; set a local path for local development |
| `SESSION_MAX_AGE` | `86400` | Session lifetime in seconds (24 hours) |
| `KAGGLE_DRIVE_HOST` | `127.0.0.1` | Server host |
| `KAGGLE_DRIVE_PORT` | `8000` | Server port |
| `ENABLE_CODE_SERVER` | `true` | Enable the full VS Code browser IDE on Linux |
| `CODE_SERVER_PORT` | `8081` | Private local port used by code-server |
| `CODE_SERVER_VERSION` | `4.143.1` | code-server release downloaded on first start |
| `CODE_SERVER_BIN` | *(Auto-detected)* | Optional path to an existing code-server executable |
| `ENABLE_CLOUDFLARE_TUNNEL` | `true` | Enable or disable automatic HTTPS tunnel |
| `CLOUDFLARE_TUNNEL_TOKEN` | *(Empty)* | Custom Cloudflare Tunnel token |
| `KAGGLE_DRIVE_SECRET_KEY` | *(Auto-generated)* | Secret used to sign session cookies |
| `CLOUDFLARE_TUNNEL_URL` | *(Empty)* | Optional HTTPS URL to display when using a named tunnel token |
| `KAGGLE_DRIVE_MAX_UPLOAD_BYTES` | `5368709120` | Maximum upload size in bytes (5 GiB) |
| `KAGGLE_DRIVE_MAX_BINARY_SAVE_BYTES` | `104857600` | Maximum binary editor save size in bytes (100 MiB) |
| `KAGGLE_DRIVE_MAX_TEXT_PREVIEW_BYTES` | `10485760` | Maximum text preview size in bytes (10 MiB) |
| `KAGGLE_DRIVE_MAX_REMOTE_DOWNLOAD_BYTES` | `5368709120` | Maximum remote URL download size in bytes (5 GiB) |
| `KAGGLE_DRIVE_MAX_ARCHIVE_MEMBERS` | `100000` | Maximum number of archive entries to extract |
| `KAGGLE_DRIVE_MAX_ARCHIVE_UNPACKED_BYTES` | `10737418240` | Maximum total extracted archive size in bytes (10 GiB) |

---

## 🧪 Automated Testing (Unit Tests)

The repository includes a comprehensive test suite using Python's standard `unittest` framework:

```bash
python -m unittest discover tests
```

**Test Coverage:**
- `test_security.py`: Tests directory escape defenses (Path traversal with `../`, relative paths, symlinks).
- `test_file_service.py`: Tests file CRUD operations, ZIP compression, extraction, and **Zip Slip** vulnerability defenses.
- `test_system_service.py`: Tests accuracy of Disk, RAM, and CPU metric retrieval.

---

## 🛡️ Security Architecture

1. **Path Traversal Protection**: All user paths submitted via API parameters are sanitized with `get_safe_path()`. If the resolved path lies outside `ROOT_DIR`, a `403 Forbidden` response is returned immediately.
2. **Zip Slip Defense**: Archive extraction inspects every entry, sanitizes target paths, and rejects any malicious relative prefixes (`../`).
3. **Timing-Attack Resistance**: Compares user credentials using `secrets.compare_digest` to prevent side-channel timing analysis.
4. **HTTPS via Cloudflare**: Quick tunnel URLs use HTTPS between the browser and Cloudflare. The app and code-server communicate locally over loopback.
5. **VS Code Web**: code-server listens only on loopback; the `/ide/` HTTP and WebSocket proxy requires the app's authenticated session.

---

## ❓ Frequently Asked Questions (FAQ)

<details>
<summary><b>1. Why does the trycloudflare.com URL not appear?</b></summary>

- Check that **Internet** is enabled in your Kaggle Notebook settings (**Settings** -> **Internet** -> **Internet on**).
- Ensure the `cloudflared` binary has execute permissions (automatically handled via `chmod +x`).
- Inspect the log file: `!cat /kaggle/working/kaggle_drive/server.log`.
</details>

<details>
<summary><b>2. Which environments support the interactive Web Terminal?</b></summary>

- The PTY terminal requires a Linux runtime such as Kaggle. It runs commands with the permissions of the application process.
- The browser connects over an authenticated WebSocket; make sure the runtime and any proxy allow WebSocket connections.
</details>

<details>
<summary><b>3. Why is VS Code Web unavailable?</b></summary>

- VS Code Web is enabled by default on Linux. Check `server.log` for the `[!] VS Code Web could not start` message and `.code_server_bin/code-server.log` for code-server output.
- The first automatic installation needs Internet access. Confirm the runtime is Linux and has a supported architecture; on Windows, install code-server separately and set `CODE_SERVER_BIN` (for example, through WSL).
- Set `ENABLE_CODE_SERVER=false` to disable the IDE. The file manager can still start if code-server fails.
</details>

<details>
<summary><b>4. Can I download large model checkpoints (>10 GB)?</summary>

- Uploads use 1MB chunked streaming for memory efficiency and stability.
- To transfer large models or datasets into Kaggle, use the **"Download from URL"** feature in the web UI. Kaggle will download files directly over its high-speed datacenter connection.
</details>

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more information.

