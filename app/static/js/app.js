/* ============================================================
   KAGGLE CLOUD DRIVE - MAIN APPLICATION CONTROLLER
   ============================================================ */

const AppState = {
  currentPath: localStorage.getItem("kaggle_drive_current_path") || "",
  parentPath: null,
  rootDir: "",
  files: [],
  selectedItems: new Set(),
  lastSelectedPath: null,
  terminalCwd: "",
  viewMode: localStorage.getItem("kaggle_drive_view_mode") || "grid", // 'grid' | 'list'
  showHidden: false,
  searchQuery: "",
  systemStats: null
};

const App = {
  init() {
    I18n.init();
    this.bindEvents();
    this.initDragSelect();
    Uploader.init();
    Editor.init();
    this.checkAuthStatus();
  },

  onLanguageChange() {
    this.renderBreadcrumb();
    this.renderFiles();
    this.updateSelectionBar();
    const statsModal = document.getElementById("systemStatsModal");
    if (statsModal && statsModal.classList.contains("show") && AppState.systemStats) {
      this.renderSystemStatsModal(AppState.systemStats);
    }
  },

  bindEvents() {
    // Auth unauthorized listener
    window.addEventListener("auth:unauthorized", () => {
      this.closeTerminalSession();
      this.showLoginView();
    });

    // Global Key shortcuts
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.hideContextMenu();
        const unsavedModal = document.getElementById("unsavedChangesModal");
        if (unsavedModal && unsavedModal.classList.contains("show")) {
          UI.closeModal("unsavedChangesModal");
          return;
        }
        const terminalModal = document.getElementById("terminalModal");
        if (terminalModal && terminalModal.classList.contains("show")) {
          this.setTerminalMinimized(true);
        }
        UI.closeAllModals();
      } else if (e.key === "/" && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
        e.preventDefault();
        const searchInput = document.getElementById("searchInput");
        if (searchInput) searchInput.focus();
      } else if ((e.key === "Delete" || (e.ctrlKey && e.key === "Backspace")) && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
        if (AppState.selectedItems.size > 0 && !document.querySelector(".modal-overlay.show")) {
          e.preventDefault();
          this.promptDelete();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a" && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
        if (!document.querySelector(".modal-overlay.show")) {
          e.preventDefault();
          this.toggleSelectAll(true);
        }
      }
    });

    // Dismiss floating context menu on click outside, resize, scroll
    document.addEventListener("mousedown", (e) => {
      if (!e.target.closest("#contextMenu")) {
        this.hideContextMenu();
      }
    });

    window.addEventListener("resize", () => {
      this.hideContextMenu();
    });

    window.addEventListener("scroll", () => {
      this.hideContextMenu();
    }, true);

    // Search input
    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        AppState.searchQuery = e.target.value.toLowerCase().trim();
        this.renderFiles();
      });
    }

    // New dropdown toggle
    const btnNew = document.getElementById("btnNewDropdown");
    const dropdownMenu = document.getElementById("dropdownNewMenu");
    if (btnNew && dropdownMenu) {
      btnNew.addEventListener("click", (e) => {
        e.stopPropagation();
        dropdownMenu.classList.toggle("show");
      });

      document.addEventListener("click", () => {
        dropdownMenu.classList.remove("show");
      });
    }
  },

  toggleMobileSidebar(force) {
    const sidebar = document.getElementById("sidebar");
    const backdrop = document.getElementById("sidebarBackdrop");
    if (!sidebar) return;
    const isClosed = sidebar.classList.contains("-translate-x-full");
    const shouldOpen = force !== undefined ? force : isClosed;

    if (shouldOpen) {
      sidebar.classList.remove("-translate-x-full");
      sidebar.classList.add("translate-x-0");
      if (backdrop) backdrop.classList.remove("hidden");
    } else {
      sidebar.classList.remove("translate-x-0");
      sidebar.classList.add("-translate-x-full");
      if (backdrop) backdrop.classList.add("hidden");
    }
  },

  async checkAuthStatus() {
    const authMeta = document.querySelector('meta[name="server-auth"]');
    const userMeta = document.querySelector('meta[name="server-user"]');
    const serverAuth = authMeta ? authMeta.getAttribute("content") : null;
    const serverUser = userMeta ? userMeta.getAttribute("content") : "admin";

    // Fast-path: Server already hydrated authentication state directly into HTML
    if (serverAuth === "1") {
      this.showAppView({ authenticated: true, username: serverUser || "admin" });
      // Validate session in background without UI flicker
      API.getMe().catch(() => this.showLoginView());
      return;
    }

    if (serverAuth === "0") {
      this.showLoginView();
      return;
    }

    // Fallback if metadata not present
    try {
      const data = await API.getMe();
      if (data && data.authenticated) {
        this.showAppView(data);
      } else {
        this.showLoginView();
      }
    } catch (_) {
      this.showLoginView();
    }
  },

  showLoginView() {
    const loginView = document.getElementById("loginView");
    const appContainer = document.getElementById("appContainer");
    if (loginView) {
      loginView.classList.remove("hidden");
      loginView.style.display = "flex";
    }
    if (appContainer) {
      appContainer.classList.add("hidden");
      appContainer.style.display = "none";
    }
    const usernameInput = document.getElementById("loginUsername");
    if (usernameInput) {
      usernameInput.value = "admin";
    }
    const passwordInput = document.getElementById("loginPassword");
    if (passwordInput) {
      passwordInput.value = "";
      setTimeout(() => passwordInput.focus(), 100);
    }
  },

  showAppView(userData = null) {
    const loginView = document.getElementById("loginView");
    const appContainer = document.getElementById("appContainer");
    if (loginView) {
      loginView.classList.add("hidden");
      loginView.style.display = "none";
    }
    if (appContainer) {
      appContainer.classList.remove("hidden");
      appContainer.style.display = "flex";
    }

    if (userData && userData.username) {
      const userEl = document.getElementById("currentUsername");
      if (userEl) userEl.textContent = userData.username;
    }

    this.loadDirectory(AppState.currentPath);
    this.refreshSystemStats();
  },

  async handleLogin() {
    const usernameInput = document.getElementById("loginUsername");
    const passwordInput = document.getElementById("loginPassword");
    const errorEl = document.getElementById("loginError");

    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    errorEl.textContent = "";

    if (!username || !password) {
      errorEl.textContent = t("login_empty_error");
      return;
    }

    const btn = document.getElementById("btnLogin");
    btn.disabled = true;
    btn.textContent = t("authenticating");

    try {
      await API.login(username, password);
      this.showAppView({ username });
    } catch (err) {
      errorEl.textContent = err.message || t("login_fail_error");
    } finally {
      btn.disabled = false;
      btn.textContent = t("login_btn");
    }
  },

  async handleLogout() {
    this.closeTerminalSession();
    try {
      await API.logout();
    } catch (_) {}
    AppState.currentPath = "";
    try {
      localStorage.removeItem("kaggle_drive_current_path");
    } catch (_) {}
    AppState.selectedItems.clear();
    this.showLoginView();
  },

  async loadDirectory(path = "", resetSearch = true) {
    this.hideContextMenu();
    this.toggleMobileSidebar(false);
    AppState.currentPath = path;
    try {
      localStorage.setItem("kaggle_drive_current_path", path);
    } catch (_) {}
    AppState.selectedItems.clear();
    AppState.lastSelectedPath = null;
    this.updateSelectionBar();

    if (resetSearch) {
      AppState.searchQuery = "";
      const searchInput = document.getElementById("searchInput");
      if (searchInput) searchInput.value = "";
    }

    try {
      const data = await API.listFiles(path, AppState.showHidden);
      AppState.parentPath = data.parent_path;
      AppState.rootDir = data.root_dir || AppState.rootDir;
      AppState.files = data.items || [];
      this.renderBreadcrumb();
      this.renderFiles();
    } catch (err) {
      UI.toast(`${t("error")}: ${err.message}`, "error");
    }
  },

  renderBreadcrumb() {
    const container = document.getElementById("breadcrumbContainer");
    if (!container) return;

    let html = `
      <span class="breadcrumb-crumb ${!AppState.currentPath ? 'active' : ''}" onclick="App.loadDirectory('')">
        <i class="fa-solid fa-house-chimney icon-python"></i> working
      </span>
    `;

    if (AppState.currentPath) {
      const parts = AppState.currentPath.split("/");
      let accum = "";
      parts.forEach((part, idx) => {
        accum = accum ? `${accum}/${part}` : part;
        const isLast = idx === parts.length - 1;
        html += `
          <span class="breadcrumb-sep"><i class="fa-solid fa-chevron-right" style="font-size: 10px;"></i></span>
          <span class="breadcrumb-crumb ${isLast ? 'active' : ''}" onclick="App.loadDirectory('${accum.replace(/'/g, "\\'")}')">
            ${UI.escape(part)}
          </span>
        `;
      });
    }

    container.innerHTML = html;
  },

  renderFiles() {
    const container = document.getElementById("fileViewContainer");
    if (!container) return;

    let filtered = AppState.files;
    if (AppState.searchQuery) {
      filtered = filtered.filter(f => f.name.toLowerCase().includes(AppState.searchQuery));
    }

    if (!filtered.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><i class="fa-solid fa-folder-open"></i></div>
          <h3 style="font-weight: 600;">${t("empty_title")}</h3>
          <p style="margin-top: 6px; font-size: 13.5px;">${t("empty_desc")}</p>
        </div>
      `;
      return;
    }

    if (AppState.viewMode === "grid") {
      this.renderGridView(filtered, container);
    } else {
      this.renderListView(filtered, container);
    }
  },

  renderGridView(items, container) {
    let html = '<div class="file-grid">';

    items.forEach(item => {
      const isSelected = AppState.selectedItems.has(item.path);
      const icon = UI.getIcon(item);
      const safePath = UI.inlineJsString(item.path);

      html += `
        <div class="file-card ${isSelected ? 'selected' : ''}" 
             data-path="${UI.escape(item.path)}"
             onclick="App.handleItemClick(event, '${safePath}')" 
             ondblclick="App.handleItemDblClick('${safePath}', ${item.is_dir})"
             oncontextmenu="App.handleContextMenu(event, '${safePath}')"
             title="${UI.escape(item.name)}">
          <div class="file-card-header">
            <div class="file-card-icon-wrapper">${icon}</div>
            <button class="file-card-menu-btn" onclick="App.openItemActionsModal(event, '${safePath}')" title="${t("options")}">
              <i class="fa-solid fa-ellipsis-vertical"></i>
            </button>
          </div>
          <div class="file-card-name">${UI.escape(item.name)}</div>
          <div class="file-card-meta">
            <span>${item.formatted_size}</span>
            <span>${item.mtime.split(" ")[0]}</span>
          </div>
        </div>
      `;
    });

    html += '</div>';
    container.innerHTML = html;
  },

  renderListView(items, container) {
    let html = `
      <div class="file-table-container">
        <table class="file-table">
          <thead>
            <tr>
              <th style="width: 38px;">
                <input type="checkbox" id="selectAllCheckbox" onchange="App.toggleSelectAll(this.checked)" ${AppState.selectedItems.size === items.length && items.length > 0 ? 'checked' : ''}>
              </th>
              <th>${t("col_name")}</th>
              <th style="width: 120px;">${t("col_size")}</th>
              <th style="width: 180px;">${t("col_date")}</th>
              <th style="width: 130px; text-align: right;">${t("col_actions")}</th>
            </tr>
          </thead>
          <tbody>
    `;

    items.forEach(item => {
      const isSelected = AppState.selectedItems.has(item.path);
      const icon = UI.getIcon(item);
      const safePath = UI.inlineJsString(item.path);

      html += `
        <tr class="${isSelected ? 'selected' : ''}" 
            data-path="${UI.escape(item.path)}"
            onclick="App.handleItemClick(event, '${safePath}')"
            ondblclick="App.handleItemDblClick('${safePath}', ${item.is_dir})"
            oncontextmenu="App.handleContextMenu(event, '${safePath}')">
          <td onclick="event.stopPropagation()">
            <input type="checkbox" class="item-checkbox" onchange="App.toggleItemSelection('${safePath}', this.checked)" ${isSelected ? 'checked' : ''}>
          </td>
          <td>
            <div class="table-file-name">
              <span style="font-size: 20px;">${icon}</span>
              <span>${UI.escape(item.name)}</span>
            </div>
          </td>
          <td>${item.formatted_size}</td>
          <td>${item.mtime}</td>
          <td>
            <div class="table-actions" onclick="event.stopPropagation()">
              ${!item.is_dir ? `
                <button class="table-btn-action" title="${t("action_download")}" onclick="App.downloadFile('${safePath}')"><i class="fa-solid fa-download"></i></button>
                <button class="table-btn-action" title="${t("action_preview")}" onclick="App.previewItem('${safePath}')"><i class="fa-solid fa-eye"></i></button>
                ${['code', 'text', 'markdown', 'csv'].includes(item.category) ? `
                  <button class="table-btn-action" title="${t("action_edit")}" onclick="Editor.openFile('${safePath}')"><i class="fa-solid fa-pen-to-square"></i></button>
                ` : ''}
              ` : `
                <button class="table-btn-action" title="${t("action_download_zip")}" onclick="App.downloadZip('${safePath}')"><i class="fa-solid fa-file-zipper"></i></button>
              `}
              <button class="table-btn-action" title="${t("more_options")}" onclick="App.openItemActionsModal(event, '${safePath}')"><i class="fa-solid fa-ellipsis-vertical"></i></button>
            </div>
          </td>
        </tr>
      `;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
  },

  handleItemClick(event, path) {
    // If clicked inside interactive buttons (3-dots, action buttons, checkbox), let their handlers run
    if (event.target.closest("button") || event.target.closest("a") || event.target.closest("input[type='checkbox']")) {
      return;
    }

    this.hideContextMenu();

    const isMulti = event.ctrlKey || event.metaKey;
    const isShift = event.shiftKey;

    if (isShift && AppState.lastSelectedPath) {
      const items = AppState.files.map(f => f.path);
      const fromIdx = items.indexOf(AppState.lastSelectedPath);
      const toIdx = items.indexOf(path);
      if (fromIdx !== -1 && toIdx !== -1) {
        const start = Math.min(fromIdx, toIdx);
        const end = Math.max(fromIdx, toIdx);
        if (!isMulti) AppState.selectedItems.clear();
        for (let i = start; i <= end; i++) {
          AppState.selectedItems.add(items[i]);
        }
      } else {
        AppState.selectedItems.clear();
        AppState.selectedItems.add(path);
      }
    } else if (isMulti) {
      if (AppState.selectedItems.has(path)) {
        AppState.selectedItems.delete(path);
      } else {
        AppState.selectedItems.add(path);
      }
      AppState.lastSelectedPath = path;
    } else {
      AppState.selectedItems.clear();
      AppState.selectedItems.add(path);
      AppState.lastSelectedPath = path;
    }

    this.updateSelectionUI();
  },

  handleItemDblClick(path, isDir) {
    this.hideContextMenu();

    if (isDir) {
      this.loadDirectory(path);
    } else {
      const item = AppState.files.find(f => f.path === path);
      if (!item) return;

      if (['code', 'text', 'markdown'].includes(item.category) && !['csv', 'tsv'].includes((item.extension || '').toLowerCase())) {
        Editor.openFile(path);
      } else {
        Previewer.openPreview(item);
      }
    }
  },

  handleContextMenu(event, path) {
    event.preventDefault();
    event.stopPropagation();

    // If right-clicked item is not currently selected, select it exclusively
    if (!AppState.selectedItems.has(path)) {
      AppState.selectedItems.clear();
      AppState.selectedItems.add(path);
      AppState.lastSelectedPath = path;
      this.updateSelectionUI();
    }

    if (window.innerWidth <= 640) {
      this.openItemActionsModal(event, path);
      return;
    }

    this.showContextMenuAt(event.clientX, event.clientY, path);
  },

  handleContainerContextMenu(event) {
    // If right-click originated on an item, item handler already stopped propagation
    if (event.target.closest(".file-card") || event.target.closest(".file-table tbody tr")) {
      return;
    }

    event.preventDefault();

    if (AppState.selectedItems.size > 0) {
      AppState.selectedItems.clear();
      AppState.lastSelectedPath = null;
      this.updateSelectionUI();
    }

    if (window.innerWidth <= 640) return;

    this.showContainerContextMenuAt(event.clientX, event.clientY);
  },

  handleContainerClick(event) {
    if (this._justDragged) {
      return;
    }
    if (!event.target.closest(".file-card") && 
        !event.target.closest(".file-table tbody tr") && 
        !event.target.closest("#contextMenu") &&
        !event.target.closest("button") &&
        !event.target.closest(".modal-content")) {
      if (AppState.selectedItems.size > 0) {
        AppState.selectedItems.clear();
        AppState.lastSelectedPath = null;
        this.updateSelectionUI();
      }
      this.hideContextMenu();
    }
  },

  updateSelectionUI() {
    // 1. Grid View cards
    const cards = document.querySelectorAll(".file-card");
    cards.forEach(card => {
      const p = card.getAttribute("data-path");
      if (p && AppState.selectedItems.has(p)) {
        card.classList.add("selected");
      } else {
        card.classList.remove("selected");
      }
    });

    // 2. List View rows & checkboxes
    const rows = document.querySelectorAll(".file-table tbody tr");
    rows.forEach(row => {
      const p = row.getAttribute("data-path");
      const isSel = p && AppState.selectedItems.has(p);
      row.classList.toggle("selected", isSel);
      const cb = row.querySelector(".item-checkbox");
      if (cb) cb.checked = isSel;
    });

    // 3. Table Header select-all checkbox
    const selectAllCb = document.getElementById("selectAllCheckbox");
    if (selectAllCb) {
      const total = AppState.files.length;
      const count = AppState.selectedItems.size;
      selectAllCb.checked = total > 0 && count === total;
      selectAllCb.indeterminate = count > 0 && count < total;
    }

    // 4. Selection bar
    this.updateSelectionBar();
  },

  toggleItemSelection(path, checked) {
    if (checked === undefined) {
      if (AppState.selectedItems.has(path)) {
        AppState.selectedItems.delete(path);
      } else {
        AppState.selectedItems.add(path);
        AppState.lastSelectedPath = path;
      }
    } else if (checked) {
      AppState.selectedItems.add(path);
      AppState.lastSelectedPath = path;
    } else {
      AppState.selectedItems.delete(path);
    }
    this.updateSelectionUI();
  },

  toggleSelectAll(checked) {
    if (checked) {
      AppState.files.forEach(f => AppState.selectedItems.add(f.path));
    } else {
      AppState.selectedItems.clear();
      AppState.lastSelectedPath = null;
    }
    this.updateSelectionUI();
  },

  showContextMenuAt(x, y, path) {
    const menu = document.getElementById("contextMenu");
    const header = document.getElementById("contextMenuHeader");
    const body = document.getElementById("contextMenuItems");
    if (!menu || !body) return;

    const count = AppState.selectedItems.size;
    const isMultiple = count > 1 && AppState.selectedItems.has(path);

    if (isMultiple) {
      if (header) {
        header.style.display = "block";
        header.innerHTML = `<div class="context-menu-caption">${t("selected_items", { count })}</div>`;
      }

      body.innerHTML = `
        <button class="context-menu-item" onclick="App.hideContextMenu(); App.promptCompress()">
          <div class="context-item-left">
            <span class="context-item-icon"><i class="fa-solid fa-box-archive"></i></span>
            <span>${t("action_compress_selected")}</span>
          </div>
        </button>
        <button class="context-menu-item" onclick="App.hideContextMenu(); App.downloadSelectedAsZip()">
          <div class="context-item-left">
            <span class="context-item-icon"><i class="fa-solid fa-file-zipper"></i></span>
            <span>${t("download_selected_zip")}</span>
          </div>
        </button>
        <div class="context-menu-divider"></div>
        <button class="context-menu-item danger" onclick="App.hideContextMenu(); App.promptDelete()">
          <div class="context-item-left">
            <span class="context-item-icon"><i class="fa-regular fa-trash-can"></i></span>
            <span>${t("delete_selected")} (${count})</span>
          </div>
          <span class="context-item-kbd">Del</span>
        </button>
      `;
    } else {
      const item = AppState.files.find(f => f.path === path);
      if (!item) return;

      // Clean desktop style: hide bulky duplicate header
      if (header) {
        header.style.display = "none";
        header.innerHTML = "";
      }

      const safePath = UI.inlineJsString(path);
      let itemsHtml = "";

      if (item.is_dir) {
        itemsHtml += `
          <button class="context-menu-item" onclick="App.hideContextMenu(); App.loadDirectory('${safePath}')">
            <div class="context-item-left">
              <span class="context-item-icon"><i class="fa-regular fa-folder-open"></i></span>
              <span>${t("action_open_folder")}</span>
            </div>
            <span class="context-item-kbd">Enter</span>
          </button>
          <button class="context-menu-item" onclick="App.hideContextMenu(); App.openTerminalModal('${safePath}')">
            <div class="context-item-left">
              <span class="context-item-icon"><i class="fa-solid fa-terminal"></i></span>
              <span>${t("action_open_terminal")}</span>
            </div>
          </button>
          <button class="context-menu-item" onclick="App.hideContextMenu(); App.copyFilePath('${safePath}')">
            <div class="context-item-left">
              <span class="context-item-icon"><i class="fa-solid fa-folder-tree"></i></span>
              <span>${t("action_copy_path")}</span>
            </div>
          </button>
          <button class="context-menu-item" onclick="App.hideContextMenu(); App.promptCompress('${safePath}')">
            <div class="context-item-left">
              <span class="context-item-icon"><i class="fa-solid fa-box-archive"></i></span>
              <span>${t("action_compress")}</span>
            </div>
          </button>
          <button class="context-menu-item" onclick="App.hideContextMenu(); App.downloadZip('${safePath}')">
            <div class="context-item-left">
              <span class="context-item-icon"><i class="fa-solid fa-file-zipper"></i></span>
              <span>${t("action_download_zip")}</span>
            </div>
          </button>
          <div class="context-menu-divider"></div>
          <button class="context-menu-item" onclick="App.hideContextMenu(); App.duplicateItem('${safePath}')">
            <div class="context-item-left">
              <span class="context-item-icon"><i class="fa-regular fa-copy"></i></span>
              <span>${t("action_duplicate")}</span>
            </div>
          </button>
          <button class="context-menu-item" onclick="App.hideContextMenu(); App.promptRename('${safePath}')">
            <div class="context-item-left">
              <span class="context-item-icon"><i class="fa-regular fa-pen-to-square"></i></span>
              <span>${t("action_rename")}</span>
            </div>
            <span class="context-item-kbd">F2</span>
          </button>
          <button class="context-menu-item" onclick="App.hideContextMenu(); App.showProperties('${safePath}')">
            <div class="context-item-left">
              <span class="context-item-icon"><i class="fa-solid fa-circle-info"></i></span>
              <span>${t("action_properties")}</span>
            </div>
          </button>
          <div class="context-menu-divider"></div>
          <button class="context-menu-item danger" onclick="App.hideContextMenu(); App.promptDelete('${safePath}')">
            <div class="context-item-left">
              <span class="context-item-icon"><i class="fa-regular fa-trash-can"></i></span>
              <span>${t("action_delete")}</span>
            </div>
            <span class="context-item-kbd">Del</span>
          </button>
        `;
      } else {
        const isSpreadsheet = ['spreadsheet', 'csv'].includes(item.category) || ['xlsx', 'xls', 'csv', 'tsv'].includes((item.extension || '').toLowerCase());
        const isEditable = (['code', 'text', 'markdown'].includes(item.category) || ['csv', 'tsv'].includes((item.extension || '').toLowerCase())) && !['xlsx', 'xls'].includes((item.extension || '').toLowerCase());
        const isArchive = ['zip', 'tar', 'archive'].includes(item.category) || ['zip', 'tar', 'gz', 'bz2', '7z', 'rar'].includes((item.extension || '').toLowerCase());

        let primaryIcon = 'fa-regular fa-eye';
        let primaryLabel = t("action_preview");
        if (item.category === "image") {
          primaryIcon = 'fa-regular fa-image';
          primaryLabel = t("action_view_image");
        } else if (item.category === "video") {
          primaryIcon = 'fa-solid fa-circle-play';
          primaryLabel = t("action_play_video");
        } else if (item.category === "audio") {
          primaryIcon = 'fa-solid fa-music';
          primaryLabel = t("action_play_audio");
        } else if (item.category === "pdf") {
          primaryIcon = 'fa-regular fa-file-pdf';
          primaryLabel = t("action_view_pdf");
        } else if (isSpreadsheet) {
          const isXls = ['xlsx', 'xls'].includes((item.extension || '').toLowerCase());
          primaryIcon = isXls ? 'fa-solid fa-file-excel' : 'fa-solid fa-table';
          primaryLabel = isXls ? t("action_view_excel") : t("action_view_csv");
        }

        if (isEditable) {
          itemsHtml += `
            <button class="context-menu-item" onclick="App.hideContextMenu(); Editor.openFile('${safePath}')">
              <div class="context-item-left">
                <span class="context-item-icon"><i class="fa-regular fa-pen-to-square"></i></span>
                <span>${t("action_edit")}</span>
              </div>
              <span class="context-item-kbd">Enter</span>
            </button>
            <button class="context-menu-item" onclick="App.hideContextMenu(); App.previewItem('${safePath}')">
              <div class="context-item-left">
                <span class="context-item-icon"><i class="fa-regular fa-eye"></i></span>
                <span>${t("action_preview")}</span>
              </div>
              <span class="context-item-kbd">Space</span>
            </button>
          `;
        } else {
          itemsHtml += `
            <button class="context-menu-item" onclick="App.hideContextMenu(); App.previewItem('${safePath}')">
              <div class="context-item-left">
                <span class="context-item-icon"><i class="${primaryIcon}"></i></span>
                <span>${primaryLabel}</span>
              </div>
              <span class="context-item-kbd">Space</span>
            </button>
          `;
        }

        itemsHtml += `
          <button class="context-menu-item" onclick="App.hideContextMenu(); App.downloadFile('${safePath}')">
            <div class="context-item-left">
              <span class="context-item-icon"><i class="fa-solid fa-download"></i></span>
              <span>${t("action_download")}</span>
            </div>
          </button>
          <button class="context-menu-item" onclick="App.hideContextMenu(); App.copyFilePath('${safePath}')">
            <div class="context-item-left">
              <span class="context-item-icon"><i class="fa-solid fa-folder-tree"></i></span>
              <span>${t("action_copy_path")}</span>
            </div>
          </button>
          <button class="context-menu-item" onclick="App.hideContextMenu(); App.promptCompress('${safePath}')">
            <div class="context-item-left">
              <span class="context-item-icon"><i class="fa-solid fa-box-archive"></i></span>
              <span>${t("action_compress")}</span>
            </div>
          </button>
        `;

        if (isArchive) {
          itemsHtml += `
            <button class="context-menu-item" onclick="App.hideContextMenu(); App.extractArchive('${safePath}')">
              <div class="context-item-left">
                <span class="context-item-icon"><i class="fa-solid fa-box-open"></i></span>
                <span>${t("action_extract_here")}</span>
              </div>
            </button>
          `;
        }

        itemsHtml += `
          <div class="context-menu-divider"></div>
          <button class="context-menu-item" onclick="App.hideContextMenu(); App.duplicateItem('${safePath}')">
            <div class="context-item-left">
              <span class="context-item-icon"><i class="fa-regular fa-copy"></i></span>
              <span>${t("action_duplicate")}</span>
            </div>
          </button>
          <button class="context-menu-item" onclick="App.hideContextMenu(); App.promptRename('${safePath}')">
            <div class="context-item-left">
              <span class="context-item-icon"><i class="fa-regular fa-pen-to-square"></i></span>
              <span>${t("action_rename")}</span>
            </div>
            <span class="context-item-kbd">F2</span>
          </button>
          <button class="context-menu-item" onclick="App.hideContextMenu(); App.showProperties('${safePath}')">
            <div class="context-item-left">
              <span class="context-item-icon"><i class="fa-solid fa-circle-info"></i></span>
              <span>${t("action_properties")}</span>
            </div>
          </button>
          <div class="context-menu-divider"></div>
          <button class="context-menu-item danger" onclick="App.hideContextMenu(); App.promptDelete('${safePath}')">
            <div class="context-item-left">
              <span class="context-item-icon"><i class="fa-regular fa-trash-can"></i></span>
              <span>${t("action_delete")}</span>
            </div>
            <span class="context-item-kbd">Del</span>
          </button>
        `;
      }
      body.innerHTML = itemsHtml;
    }

    this.positionContextMenu(x, y);
  },

  showContainerContextMenuAt(x, y) {
    const menu = document.getElementById("contextMenu");
    const header = document.getElementById("contextMenuHeader");
    const body = document.getElementById("contextMenuItems");
    if (!menu || !body) return;

    if (header) {
      header.style.display = "none";
      header.innerHTML = "";
    }

    body.innerHTML = `
      <button class="context-menu-item" onclick="App.hideContextMenu(); App.promptNewFolder()">
        <div class="context-item-left">
          <span class="context-item-icon"><i class="fa-solid fa-folder-plus"></i></span>
          <span>${t("new_folder")}</span>
        </div>
      </button>
      <button class="context-menu-item" onclick="App.hideContextMenu(); App.promptNewFile()">
        <div class="context-item-left">
          <span class="context-item-icon"><i class="fa-solid fa-file-circle-plus"></i></span>
          <span>${t("new_file")}</span>
        </div>
      </button>
      <div class="context-menu-divider"></div>
      <button class="context-menu-item" onclick="App.hideContextMenu(); App.openTerminalModal(AppState.currentPath)">
        <div class="context-item-left">
          <span class="context-item-icon"><i class="fa-solid fa-terminal"></i></span>
          <span>${t("action_open_terminal_here")}</span>
        </div>
      </button>
      <div class="context-menu-divider"></div>
      <button class="context-menu-item" onclick="App.hideContextMenu(); document.getElementById('fileInput').click()">
        <div class="context-item-left">
          <span class="context-item-icon"><i class="fa-solid fa-arrow-up-from-bracket"></i></span>
          <span>${t("upload_file")}</span>
        </div>
      </button>
      <button class="context-menu-item" onclick="App.hideContextMenu(); document.getElementById('folderInput').click()">
        <div class="context-item-left">
          <span class="context-item-icon"><i class="fa-solid fa-folder-arrow-up"></i></span>
          <span>${t("upload_folder")}</span>
        </div>
      </button>
      <button class="context-menu-item" onclick="App.hideContextMenu(); App.promptDownloadUrl()">
        <div class="context-item-left">
          <span class="context-item-icon"><i class="fa-solid fa-cloud-arrow-down"></i></span>
          <span>${t("upload_url")}</span>
        </div>
      </button>
      <div class="context-menu-divider"></div>
      <button class="context-menu-item" onclick="App.hideContextMenu(); App.loadDirectory(AppState.currentPath, false)">
        <div class="context-item-left">
          <span class="context-item-icon"><i class="fa-solid fa-rotate"></i></span>
          <span>${t("refresh")}</span>
        </div>
        <span class="context-item-kbd">F5</span>
      </button>
      <button class="context-menu-item" onclick="App.hideContextMenu(); App.downloadZip()">
        <div class="context-item-left">
          <span class="context-item-icon"><i class="fa-solid fa-file-zipper"></i></span>
          <span>${t("download_folder_zip")}</span>
        </div>
      </button>
    `;

    this.positionContextMenu(x, y);
  },

  positionContextMenu(x, y) {
    const menu = document.getElementById("contextMenu");
    if (!menu) return;

    menu.style.visibility = "hidden";
    menu.classList.remove("hidden");

    const rect = menu.getBoundingClientRect();
    const winW = window.innerWidth;
    const winH = window.innerHeight;

    let left = x;
    let top = y;

    if (left + rect.width > winW - 8) {
      left = Math.max(8, winW - rect.width - 8);
    }
    if (top + rect.height > winH - 8) {
      top = Math.max(8, winH - rect.height - 8);
    }
    if (left < 8) left = 8;
    if (top < 8) top = 8;

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu.style.visibility = "visible";
  },

  hideContextMenu() {
    const menu = document.getElementById("contextMenu");
    if (menu) {
      menu.classList.add("hidden");
    }
  },

  clearSelection() {
    AppState.selectedItems.clear();
    AppState.lastSelectedPath = null;
    this.updateSelectionUI();
  },

  updateSelectionBar() {
    const bar = document.getElementById("selectionBar");
    const countEl = document.getElementById("selectedCountText");
    if (!bar) return;

    const count = AppState.selectedItems.size;
    // Only display selection bar for batch operations (2 or more items selected)
    // Clicking a single item highlights it like File Explorer without popping up the bar
    if (count > 1) {
      bar.classList.add("show");
      if (countEl) countEl.textContent = t("selected_items", { count });
    } else {
      bar.classList.remove("show");
    }
  },

  toggleViewMode() {
    AppState.viewMode = AppState.viewMode === "grid" ? "list" : "grid";
    localStorage.setItem("kaggle_drive_view_mode", AppState.viewMode);
    const btn = document.getElementById("btnToggleView");
    if (btn) btn.innerHTML = AppState.viewMode === "grid" ? '<i class="fa-solid fa-list"></i>' : '<i class="fa-solid fa-table-cells-large"></i>';
    this.renderFiles();
  },

  toggleShowHidden() {
    AppState.showHidden = !AppState.showHidden;
    const btn = document.getElementById("btnToggleHidden");
    if (btn) btn.style.color = AppState.showHidden ? "var(--primary)" : "var(--text-muted)";
    this.loadDirectory(AppState.currentPath, false);
  },

  goBack() {
    if (AppState.parentPath !== null) {
      this.loadDirectory(AppState.parentPath);
    }
  },

  downloadFile(path) {
    this.hideContextMenu();
    window.location.href = `/api/files/download?path=${encodeURIComponent(path)}`;
  },

  downloadZip(path = "") {
    this.hideContextMenu();
    const targetPath = path || AppState.currentPath;
    window.location.href = `/api/files/download-zip?path=${encodeURIComponent(targetPath)}`;
  },

  previewItem(path) {
    this.hideContextMenu();
    const item = AppState.files.find(f => f.path === path);
    if (item) {
      Previewer.openPreview(item);
    } else {
      Previewer.openPreview(path);
    }
  },

  // Modal Dialog Actions
  promptNewFolder() {
    const input = document.getElementById("newFolderNameInput");
    if (input) input.value = "";
    UI.openModal("newFolderModal");
  },

  async confirmCreateFolder() {
    const input = document.getElementById("newFolderNameInput");
    const name = input.value.trim();
    if (!name) return;

    const fullPath = AppState.currentPath ? `${AppState.currentPath}/${name}` : name;
    try {
      await API.createFolder(fullPath);
      UI.closeModal("newFolderModal");
      UI.toast(t("folder_created_toast", { name }), "success");
      this.loadDirectory(AppState.currentPath, false);
      this.refreshSystemStats();
    } catch (err) {
      UI.toast(err.message, "error");
    }
  },

  promptNewFile() {
    const input = document.getElementById("newFileNameInput");
    if (input) input.value = "";
    UI.openModal("newFileModal");
  },

  async confirmCreateFile() {
    const input = document.getElementById("newFileNameInput");
    const name = input.value.trim();
    if (!name) return;

    const fullPath = AppState.currentPath ? `${AppState.currentPath}/${name}` : name;
    try {
      await API.createFile(fullPath);
      UI.closeModal("newFileModal");
      UI.toast(t("file_created_toast", { name }), "success");
      this.loadDirectory(AppState.currentPath, false);
      Editor.openFile(fullPath);
    } catch (err) {
      UI.toast(err.message, "error");
    }
  },

  promptDownloadUrl() {
    const urlInput = document.getElementById("downloadUrlInput");
    const nameInput = document.getElementById("downloadFilenameInput");
    if (urlInput) urlInput.value = "";
    if (nameInput) nameInput.value = "";
    UI.openModal("downloadUrlModal");
  },

  async confirmDownloadUrl() {
    const urlInput = document.getElementById("downloadUrlInput");
    const nameInput = document.getElementById("downloadFilenameInput");
    const btn = document.getElementById("btnStartDownloadUrl");

    const url = urlInput ? urlInput.value.trim() : "";
    const filename = nameInput ? nameInput.value.trim() : "";

    if (!url) {
      UI.toast(t("url_invalid_toast"), "warning");
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = t("url_btn_downloading");
    }

    UI.toast(t("url_start_toast"), "info", 5000);

    try {
      const res = await API.downloadFromUrl(url, AppState.currentPath, filename || null);
      UI.closeModal("downloadUrlModal");
      UI.toast(res.message || t("success"), "success");
      this.loadDirectory(AppState.currentPath, false);
      this.refreshSystemStats();
    } catch (err) {
      UI.toast(`${t("error")}: ${err.message}`, "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = t("url_btn_start");
      }
    }
  },

  async downloadSelectedAsZip() {
    const items = Array.from(AppState.selectedItems);
    if (!items.length) {
      UI.toast(t("no_items_selected"), "warning");
      return;
    }
    UI.toast(t("compressing_multi_toast", { count: items.length }), "info", 3000);
    try {
      await API.downloadSelectedZip(items);
      UI.toast(t("compress_multi_success"), "success");
    } catch (err) {
      UI.toast(`${t("error")}: ${err.message}`, "error");
    }
  },

  promptRename(path) {
    this.hideContextMenu();
    const targetPath = path || Array.from(AppState.selectedItems)[0];
    if (!targetPath) return;

    const filename = targetPath.split("/").pop();
    const input = document.getElementById("renameInput");
    document.getElementById("renamePathTarget").value = targetPath;
    if (input) input.value = filename;

    UI.openModal("renameModal");
  },

  async confirmRename() {
    const targetPath = document.getElementById("renamePathTarget").value;
    const input = document.getElementById("renameInput");
    const newName = input.value.trim();
    if (!targetPath || !newName) return;

    try {
      await API.renameItem(targetPath, newName);
      UI.closeModal("renameModal");
      UI.toast(t("rename_success_toast"), "success");
      this.loadDirectory(AppState.currentPath, false);
    } catch (err) {
      UI.toast(err.message, "error");
    }
  },

  promptDelete(path = null) {
    this.hideContextMenu();
    const itemsToDelete = path ? [path] : Array.from(AppState.selectedItems);
    if (!itemsToDelete.length) return;

    const msgEl = document.getElementById("deleteConfirmMsg");
    if (msgEl) {
      msgEl.textContent = itemsToDelete.length === 1
        ? t("delete_confirm_single")
        : t("delete_confirm_multi", { count: itemsToDelete.length });
    }
    document.getElementById("deleteTargetData").value = JSON.stringify(itemsToDelete);
    UI.openModal("deleteModal");
  },

  async confirmDelete() {
    const itemsStr = document.getElementById("deleteTargetData").value;
    if (!itemsStr) return;
    const items = JSON.parse(itemsStr);

    UI.closeModal("deleteModal");
    let successCount = 0;

    for (const itemPath of items) {
      try {
        await API.deleteItem(itemPath);
        successCount++;
      } catch (err) {
        UI.toast(`${t("error")} (${itemPath}): ${err.message}`, "error");
      }
    }

    if (successCount > 0) {
      UI.toast(t("delete_success_toast", { count: successCount }), "success");
      AppState.selectedItems.clear();
      this.loadDirectory(AppState.currentPath, false);
      this.refreshSystemStats();
    }
  },

  promptCompress(path = null) {
    this.hideContextMenu();
    const itemsToCompress = path ? [path] : Array.from(AppState.selectedItems);
    if (!itemsToCompress.length) {
      UI.toast(t("no_items_selected"), "warning");
      return;
    }

    const targetInput = document.getElementById("compressTargetPaths");
    const nameInput = document.getElementById("compressNameInput");
    if (targetInput) targetInput.value = JSON.stringify(itemsToCompress);

    let defaultName = "archive.zip";
    if (itemsToCompress.length === 1) {
      const base = itemsToCompress[0].split("/").pop().replace(/\.[^/.]+$/, "");
      defaultName = (base || "archive") + ".zip";
    }
    if (nameInput) {
      nameInput.value = defaultName;
      setTimeout(() => {
        nameInput.focus();
        nameInput.select();
      }, 50);
    }
    UI.openModal("compressModal");
  },

  async confirmCompress() {
    const targetsStr = document.getElementById("compressTargetPaths")?.value;
    const nameInput = document.getElementById("compressNameInput");
    if (!targetsStr) return;

    let paths = [];
    try {
      paths = JSON.parse(targetsStr);
    } catch {
      return;
    }
    if (!paths.length) return;

    const archiveName = nameInput ? nameInput.value.trim() : "";
    UI.closeModal("compressModal");
    UI.toast(t("compress_start_toast"), "info");

    try {
      const res = await API.compressItems(paths, archiveName, AppState.currentPath);
      UI.toast(t("compress_success_toast", { name: res.archive_name || archiveName || "archive.zip" }), "success");
      AppState.selectedItems.clear();
      this.loadDirectory(AppState.currentPath, false);
      this.refreshSystemStats();
    } catch (err) {
      UI.toast(`${t("error")}: ${err.message}`, "error");
    }
  },

  async duplicateItem(path) {
    const targetPath = path || Array.from(AppState.selectedItems)[0];
    if (!targetPath) return;

    try {
      await API.duplicateItem(targetPath);
      UI.toast(t("duplicate_success_toast"), "success");
      this.loadDirectory(AppState.currentPath, false);
    } catch (err) {
      UI.toast(err.message, "error");
    }
  },

  async extractArchive(path) {
    const targetPath = path || Array.from(AppState.selectedItems)[0];
    if (!targetPath) return;

    try {
      UI.toast(t("extract_start_toast"), "info", 3000);
      const res = await API.extractArchive(targetPath);
      UI.toast(res.message || t("extract_success_toast"), "success");
      this.loadDirectory(AppState.currentPath, false);
      this.refreshSystemStats();
    } catch (err) {
      UI.toast(err.message, "error");
    }
  },

  openItemActionsModal(event, path) {
    if (event) {
      event.stopPropagation();
    }
    const item = AppState.files.find(f => f.path === path);
    if (!item) return;

    if (!AppState.selectedItems.has(path)) {
      AppState.selectedItems.clear();
      AppState.selectedItems.add(path);
      AppState.lastSelectedPath = path;
      this.updateSelectionUI();
    }

    // On desktop, anchor context menu right below the button
    if (window.innerWidth > 640 && event && event.currentTarget) {
      const rect = event.currentTarget.getBoundingClientRect();
      this.showContextMenuAt(rect.right - 200, rect.bottom + 4, path);
      return;
    }

    const modal = document.getElementById("itemActionsModal");
    const title = document.getElementById("itemActionsTitle");
    const content = document.getElementById("itemActionsContent");

    if (title) title.textContent = item.name;

    const safePath = UI.inlineJsString(path);
    let actions = `
      <div style="display: flex; flex-direction: column; gap: 8px;">
        ${!item.is_dir ? `
          <button class="btn-secondary" style="text-align: left;" onclick="UI.closeModal('itemActionsModal'); App.downloadFile('${safePath}')">
            <i class="fa-solid fa-download"></i> ${t("action_download")}
          </button>
          <button class="btn-secondary" style="text-align: left;" onclick="UI.closeModal('itemActionsModal'); App.previewItem('${safePath}')">
            <i class="fa-solid fa-eye"></i> ${t("action_preview")}
          </button>
          ${['code', 'text', 'markdown', 'csv'].includes(item.category) ? `
            <button class="btn-secondary" style="text-align: left;" onclick="UI.closeModal('itemActionsModal'); Editor.openFile('${safePath}')">
              <i class="fa-solid fa-pen-to-square"></i> ${t("action_edit")}
            </button>
          ` : ''}
          ${['zip', 'tar', 'archive'].includes(item.category) || ['zip', 'tar', 'gz', 'bz2', '7z', 'rar'].includes((item.extension || '').toLowerCase()) ? `
            <button class="btn-secondary" style="text-align: left;" onclick="UI.closeModal('itemActionsModal'); App.extractArchive('${safePath}')">
              <i class="fa-solid fa-box-open"></i> ${t("action_extract_here")}
            </button>
          ` : ''}
        ` : `
          <button class="btn-secondary" style="text-align: left;" onclick="UI.closeModal('itemActionsModal'); App.loadDirectory('${safePath}')">
            <i class="fa-solid fa-folder-open"></i> ${t("action_open_folder")}
          </button>
          <button class="btn-secondary" style="text-align: left;" onclick="UI.closeModal('itemActionsModal'); App.openTerminalModal('${safePath}')">
            <i class="fa-solid fa-terminal text-sky-500"></i> ${t("action_open_terminal")}
          </button>
          <button class="btn-secondary" style="text-align: left;" onclick="UI.closeModal('itemActionsModal'); App.downloadZip('${safePath}')">
            <i class="fa-solid fa-file-zipper"></i> ${t("action_download_zip")}
          </button>
        `}
        <button class="btn-secondary" style="text-align: left;" onclick="UI.closeModal('itemActionsModal'); App.showProperties('${safePath}')">
          <i class="fa-solid fa-circle-info"></i> ${t("action_properties")}
        </button>
        <button class="btn-secondary" style="text-align: left;" onclick="UI.closeModal('itemActionsModal'); App.copyFilePath('${safePath}')">
          <i class="fa-solid fa-folder-tree text-sky-500"></i> ${t("action_copy_path")}
        </button>
        <button class="btn-secondary" style="text-align: left;" onclick="UI.closeModal('itemActionsModal'); App.promptCompress('${safePath}')">
          <i class="fa-solid fa-box-archive text-amber-500"></i> ${t("action_compress")}
        </button>
        <button class="btn-secondary" style="text-align: left;" onclick="UI.closeModal('itemActionsModal'); App.duplicateItem('${safePath}')">
          <i class="fa-solid fa-copy"></i> ${t("action_duplicate")}
        </button>
        <button class="btn-secondary" style="text-align: left;" onclick="UI.closeModal('itemActionsModal'); App.promptRename('${safePath}')">
          <i class="fa-solid fa-tag"></i> ${t("action_rename")}
        </button>
        <button class="btn-danger" style="text-align: left;" onclick="UI.closeModal('itemActionsModal'); App.promptDelete('${safePath}')">
          <i class="fa-solid fa-trash-can"></i> ${t("action_delete")}
        </button>
      </div>
    `;

    if (content) content.innerHTML = actions;
    UI.openModal("itemActionsModal");
  },

  async showProperties(path) {
    this.hideContextMenu();
    const modal = document.getElementById("propertiesModal");
    const title = document.getElementById("propertiesTitle");
    const body = document.getElementById("propertiesBody");
    if (!modal || !body) return;

    if (title) title.textContent = t("properties_title");
    body.textContent = t("properties_loading");
    UI.openModal("propertiesModal");

    try {
      const properties = await API.getFileProperties(path);
      body.replaceChildren();
      const numberFormat = new Intl.NumberFormat(I18n.currentLang || "vi");
      const rows = [
        { label: t("properties_name"), value: properties.name },
        { label: t("properties_type"), value: properties.is_dir ? t("folder_badge") : t("file_badge") },
        { label: t("properties_location"), value: properties.parent_path || t("properties_root") },
        ...(properties.extension ? [{ label: t("properties_extension"), value: `.${properties.extension}` }] : []),
        ...(properties.mime_type ? [{ label: t("properties_mime"), value: properties.mime_type }] : []),
        { label: t("properties_size"), value: properties.formatted_size },
        ...(properties.is_dir ? [{
          label: t("properties_contents"),
          value: `${numberFormat.format(properties.files_count)} ${t("properties_files")}, ${numberFormat.format(properties.folders_count)} ${t("properties_folders")}`
        }] : []),
        { label: t("properties_created"), value: properties.created_at || "-" },
        { label: t("properties_modified"), value: properties.modified_at || "-" },
        { label: t("properties_permissions"), value: properties.permissions || "-" }
      ];

      rows.forEach(({ label, value }) => {
        const row = document.createElement("div");
        row.className = "properties-row";
        const labelElement = document.createElement("span");
        labelElement.className = "properties-label";
        labelElement.textContent = label;
        const valueElement = document.createElement("span");
        valueElement.className = "properties-value";
        valueElement.textContent = value ?? "-";
        row.append(labelElement, valueElement);
        body.appendChild(row);
      });

      if (properties.is_dir && !properties.size_complete) {
        const note = document.createElement("p");
        note.className = "properties-note";
        note.textContent = t("properties_partial");
        body.appendChild(note);
      }
    } catch (error) {
      body.textContent = t("properties_load_error");
      UI.toast(error.message, "error");
    }
  },

  async copyFilePath(path) {
    this.hideContextMenu();
    const root = (AppState.rootDir || "").replace(/\\/g, "/").replace(/\/+$/, "");
    const relativePath = String(path || "").replace(/\\/g, "/").replace(/^\/+/, "");
    const fullPath = `${root}/${relativePath}` || "/";

    try {
      if (!navigator.clipboard) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(fullPath);
      UI.toast(t("path_copied_toast"), "success");
    } catch (_) {
      prompt(t("copy_path_prompt"), fullPath);
    }
  },

  copyDownloadCommand(path) {
    this.copyFilePath(path);
  },

  // System Stats & Terminal
  async refreshSystemStats(showToast = false) {
    const btn = document.getElementById("btnRefreshStats");
    const modal = document.getElementById("systemStatsModal");
    const body = document.getElementById("systemStatsBody");
    let originalIcon = null;
    if (btn && showToast) {
      originalIcon = btn.innerHTML;
      btn.innerHTML = `<i class="fa-solid fa-rotate fa-spin"></i> ${t("stats_refreshing")}`;
      btn.disabled = true;
    }
    if (!AppState.systemStats && body && modal && modal.classList.contains("show")) {
      body.innerHTML = `
        <div class="flex flex-col items-center justify-center py-12 text-slate-400 gap-3">
          <i class="fa-solid fa-circle-notch fa-spin text-3xl text-brand-600"></i>
          <span class="text-sm font-medium text-slate-600">${t("stats_scanning")}</span>
        </div>
      `;
    }

    try {
      const stats = await API.getSystemStats();
      AppState.systemStats = stats;

      if (stats.disk) {
        const percent = stats.disk.status !== "unavailable" && Number.isFinite(stats.disk.percent)
          ? stats.disk.percent
          : null;
        const fill = document.getElementById("sidebarStorageFill");
        const text = document.getElementById("sidebarStorageText");
        const topbarDiskText = document.getElementById("topbarDiskUsage");
        const used = stats.disk.used_formatted || "N/A";
        const total = stats.disk.total_formatted || "N/A";

        if (fill) fill.style.width = `${percent === null ? 0 : Math.min(100, Math.max(0, percent))}%`;
        if (text) text.textContent = `${used} / ${total}${percent === null ? "" : ` (${percent}%)`}`;
        if (topbarDiskText) topbarDiskText.textContent = `${used} / ${total}`;
      }

      if (modal && modal.classList.contains("show")) {
        this.renderSystemStatsModal(stats);
      }
      if (showToast) {
        UI.toast(t("stats_updated_toast"), "success", 1200);
      }
    } catch (err) {
      if (showToast) {
        UI.toast(t("stats_error_toast", { msg: err.message }), "error");
      }
      if (!AppState.systemStats && body && modal && modal.classList.contains("show")) {
        body.innerHTML = `
          <div class="flex flex-col items-center justify-center py-10 text-slate-500 gap-3 text-center">
            <i class="fa-solid fa-triangle-exclamation text-2xl text-amber-500"></i>
            <p class="text-sm">${UI.escape(t("stats_error_toast", { msg: err.message }))}</p>
            <button class="btn-secondary text-xs py-2 px-4" onclick="App.refreshSystemStats(false)">${t("stats_refresh_btn")}</button>
          </div>
        `;
      }
    } finally {
      if (btn && showToast && originalIcon) {
        btn.innerHTML = originalIcon;
        btn.disabled = false;
      }
    }
  },

  async openSystemModal() {
    this.toggleMobileSidebar(false);
    UI.openModal("systemStatsModal");

    const container = document.getElementById("systemStatsBody");
    if (AppState.systemStats) {
      this.renderSystemStatsModal(AppState.systemStats);
      this.refreshSystemStats(false);
    } else {
      if (container) {
        container.innerHTML = `
          <div class="flex flex-col items-center justify-center py-12 text-slate-400 gap-3">
            <i class="fa-solid fa-circle-notch fa-spin text-3xl text-brand-600"></i>
            <span class="text-sm font-medium text-slate-600">${t("stats_scanning")}</span>
          </div>
        `;
      }
      await this.refreshSystemStats(false);
    }
  },

  renderSystemStatsModal(stats) {
    const container = document.getElementById("systemStatsBody");
    if (!container || !stats) return;

    const getBadgeClass = (percent) => {
      if (percent === null) return "bg-slate-50 text-slate-500 border-slate-200";
      if (percent >= 85) return "bg-rose-50 text-rose-700 border-rose-200";
      if (percent >= 70) return "bg-amber-50 text-amber-700 border-amber-200";
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    };

    const getBarColor = (percent, defaultGradient) => {
      if (percent === null) return "bg-slate-300";
      if (percent >= 85) return "bg-gradient-to-r from-rose-500 to-red-600";
      if (percent >= 70) return "bg-gradient-to-r from-amber-400 to-amber-600";
      return defaultGradient;
    };

    const getPercent = (metric) => {
      if (!metric || metric.status === "unavailable" || !Number.isFinite(metric.percent)) return null;
      return Math.min(100, Math.max(0, metric.percent));
    };

    const disk = stats.disk || {};
    const diskP = getPercent(disk);
    const mem = stats.memory || {};
    const memP = getPercent(mem);
    const cpu = stats.cpu || {};
    const cpuP = getPercent(cpu);

    // GPU Cards: keep VRAM values separate because devices do not share memory.
    const gpu = stats.gpu || { status: "query_error" };
    let gpuCardHtml = "";
    if (gpu.status === "available" && Array.isArray(gpu.devices) && gpu.devices.length > 0) {
      gpuCardHtml = gpu.devices.map((device, index) => {
        const vramP = device.vram_percent || 0;
        const gpuTitle = gpu.devices.length > 1 ? `${t("stats_gpu_card")} ${index + 1}` : t("stats_gpu_card");
        return `
          <div class="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4 rounded-2xl border border-slate-700/80 shadow-md relative overflow-hidden flex flex-col justify-between">
            <div class="absolute -right-3 -bottom-3 opacity-10 text-6xl text-emerald-400 pointer-events-none"><i class="fa-solid fa-microchip"></i></div>
            <div>
              <div class="flex items-center justify-between mb-2.5">
                <div class="flex items-center gap-2.5 min-w-0">
                  <span class="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-sm shrink-0 shadow-inner"><i class="fa-solid fa-microchip"></i></span>
                  <div class="min-w-0">
                    <div class="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">${gpuTitle}</div>
                    <div class="text-sm font-bold text-white truncate" title="${UI.escape(device.name)}">${UI.escape(device.name)}</div>
                  </div>
                </div>
                <span class="text-xs font-mono px-2 py-0.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 font-bold shrink-0">${t("stats_gpu_util", { percent: device.utilization_percent })}</span>
              </div>
              <div class="mt-3">
                <div class="flex justify-between text-xs text-slate-300 mb-1 font-medium">
                  <span>${t("stats_vram_used")}</span>
                  <span class="text-white font-semibold font-mono">${device.vram_used} / ${device.vram_total}</span>
                </div>
                <div class="h-2 w-full bg-slate-700/80 rounded-full overflow-hidden p-0.5"><div class="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 transition-all duration-500" style="width: ${Math.min(100, vramP)}%"></div></div>
              </div>
            </div>
            <div class="flex justify-between items-center text-[11px] text-slate-400 mt-2 font-mono pt-1 border-t border-slate-700/40">
              <span>${t("stats_vram_free", { free: device.vram_free })}</span>
              <span class="text-emerald-400 font-semibold">${t("stats_vram_percent", { percent: vramP })}</span>
            </div>
          </div>
        `;
      }).join("");
    } else {
      const gpuNotFound = gpu.status === "not_found";
      const titleKey = gpuNotFound ? "stats_gpu_none_title" : "stats_gpu_error_title";
      const descriptionKey = gpuNotFound ? "stats_gpu_none_desc" : "stats_gpu_error_desc";
      const badgeKey = gpuNotFound ? "stats_gpu_none_badge" : "stats_gpu_error_badge";
      gpuCardHtml = `
        <div class="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between">
          <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div class="flex items-center gap-2.5 min-w-0">
              <span class="w-8 h-8 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center text-sm shrink-0"><i class="fa-solid fa-microchip"></i></span>
              <div>
                <div class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">${t("stats_gpu_card")}</div>
                <div class="text-sm font-bold text-slate-700">${t(titleKey)}</div>
              </div>
            </div>
            <span class="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 font-medium font-sans leading-none shrink-0 whitespace-nowrap">${t(badgeKey)}</span>
          </div>
          <p class="text-xs text-slate-500 mt-2 leading-relaxed">${t(descriptionKey)}</p>
          <div class="text-[11px] text-slate-400 font-mono mt-2 pt-1 border-t border-slate-100">GPU: ${t(badgeKey)}</div>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div class="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2.5 min-w-0">
                <span class="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-sm shrink-0"><i class="fa-solid fa-hard-drive"></i></span>
                <div class="min-w-0">
                  <div class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">${t("stats_disk_card")}</div>
                  <div class="text-sm font-bold text-slate-800 truncate">${disk.used_formatted || "N/A"} / ${disk.total_formatted || "N/A"}</div>
                </div>
              </div>
              <span class="text-xs font-mono px-2 py-0.5 rounded-full border ${getBadgeClass(diskP)} font-bold shrink-0">${diskP === null ? "N/A" : `${diskP}%`}</span>
            </div>
            <div class="mt-2">
              <div class="h-2 w-full bg-slate-100 rounded-full overflow-hidden"><div class="h-full ${getBarColor(diskP, "bg-gradient-to-r from-blue-500 to-indigo-600")} transition-all duration-500" style="width: ${diskP === null ? 0 : diskP}%"></div></div>
              <div class="flex justify-between items-center text-[11px] text-slate-500 mt-2 font-mono">
                <span>${t("stats_free")}: <b>${disk.free_formatted || "N/A"}</b></span>
                <span class="text-slate-400 truncate" title="${UI.escape(stats.root_dir || "/")}">${UI.escape(stats.root_dir || "/")}</span>
              </div>
            </div>
          </div>

          <div class="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2.5 min-w-0">
                <span class="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm shrink-0"><i class="fa-solid fa-memory"></i></span>
                <div class="min-w-0">
                  <div class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">${t("stats_ram_card")}</div>
                  <div class="text-sm font-bold text-slate-800 truncate">${mem.used_formatted || "N/A"} / ${mem.total_formatted || "N/A"}</div>
                </div>
              </div>
              <span class="text-xs font-mono px-2 py-0.5 rounded-full border ${getBadgeClass(memP)} font-bold shrink-0">${memP === null ? "N/A" : `${memP}%`}</span>
            </div>
            <div class="mt-2">
              <div class="h-2 w-full bg-slate-100 rounded-full overflow-hidden"><div class="h-full ${getBarColor(memP, "bg-gradient-to-r from-emerald-500 to-teal-600")} transition-all duration-500" style="width: ${memP === null ? 0 : memP}%"></div></div>
              <div class="flex justify-between items-center text-[11px] text-slate-500 mt-2 font-mono"><span>${t("stats_available")}: <b>${mem.free_formatted || "N/A"}</b></span><span class="text-slate-400">System RAM</span></div>
            </div>
          </div>

          <div class="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2.5 min-w-0">
                <span class="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-sm shrink-0"><i class="fa-solid fa-microchip"></i></span>
                <div class="min-w-0">
                  <div class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">${t("stats_cpu_card")}</div>
                  <div class="text-sm font-bold text-slate-800 truncate">${t("stats_cpu_cores", { cores: cpu.cores || 1 })}</div>
                </div>
              </div>
              <span class="text-xs font-mono px-2 py-0.5 rounded-full border ${getBadgeClass(cpuP)} font-bold shrink-0">${cpuP === null ? "N/A" : `${cpuP}%`}</span>
            </div>
            <div class="mt-2">
              <div class="h-2 w-full bg-slate-100 rounded-full overflow-hidden"><div class="h-full ${getBarColor(cpuP, "bg-gradient-to-r from-purple-500 to-indigo-600")} transition-all duration-500" style="width: ${cpuP === null ? 0 : cpuP}%"></div></div>
              <div class="flex justify-between items-center text-[11px] text-slate-500 mt-2 font-mono"><span>${cpuP === null ? "N/A" : t("stats_cpu_load", { percent: cpuP })}</span><span class="text-slate-400">${t("stats_cpu_instant")}</span></div>
            </div>
          </div>

          ${gpuCardHtml}
        </div>
        <div class="pt-3 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <div class="flex flex-wrap items-center gap-2">
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 text-slate-700 font-semibold text-[11px]"><i class="fa-brands fa-linux text-slate-500"></i> ${UI.escape(stats.os || "Linux")}</span>
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-50 text-amber-800 border border-amber-200/80 font-semibold text-[11px]"><i class="fa-brands fa-python text-amber-600"></i> Python ${UI.escape(stats.python || "3.13")}</span>
          </div>
          <span class="text-[11px] text-slate-400 font-mono flex items-center gap-1"><i class="fa-solid fa-folder-tree text-slate-400"></i> ${UI.escape(stats.root_dir || "/kaggle/working")}</span>
        </div>
      </div>
    `;
  },

  terminalInstance: null,
  terminalFitAddon: null,
  terminalSocket: null,
  terminalResizeObserver: null,
  terminalPendingInput: [],
  terminalRequestedCwd: null,

  openTerminalModal(targetCwd = null) {
    this.hideContextMenu();
    this.toggleMobileSidebar(false);

    const cwd = targetCwd !== null ? targetCwd : (AppState.currentPath || "");
    this.setTerminalMinimized(false);
    AppState.terminalCwd = cwd;
    const promptPath = cwd ? `/kaggle/working/${cwd}` : "/kaggle/working";
    const headerEl = document.getElementById("terminalHeaderTitle");
    if (headerEl) headerEl.textContent = `bash - ${promptPath}`;

    UI.openModal("terminalModal");
    this.initTerminalEmulator();
    setTimeout(() => {
      this.fitTerminal();
      if (this.terminalInstance) this.terminalInstance.focus();
      const socketOpen = this.terminalSocket && this.terminalSocket.readyState <= WebSocket.OPEN;
      const selectedFolderChanged = targetCwd !== null && cwd !== this.terminalRequestedCwd;
      if (selectedFolderChanged && this.terminalSocket) {
        this.terminalSocket.close(1000, "Starting terminal in selected folder");
        this.terminalSocket = null;
      }
      if (!socketOpen || selectedFolderChanged) this.connectTerminal(cwd);
    }, 120);
  },

  initTerminalEmulator() {
    const container = document.getElementById("terminalWindow");
    if (!container || this.terminalInstance) return;
    const TerminalCtor = window.Terminal?.Terminal || window.Terminal;
    const FitAddonCtor = window.FitAddon?.FitAddon;
    if (!TerminalCtor || !FitAddonCtor) {
      container.textContent = "Terminal emulator assets could not be loaded. Check the notebook internet connection and reload the page.";
      return;
    }

    this.terminalInstance = new TerminalCtor({
      cursorBlink: true,
      convertEol: false,
      scrollback: 3000,
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: 13,
      theme: {
        background: "#020617",
        foreground: "#e2e8f0",
        cursor: "#38bdf8",
        selectionBackground: "#334155"
      }
    });
    this.terminalFitAddon = new FitAddonCtor();
    this.terminalInstance.loadAddon(this.terminalFitAddon);
    this.terminalInstance.open(container);
    this.terminalInstance.onData(data => this.sendTerminalInput(data));
    this.terminalResizeObserver = new ResizeObserver(() => this.fitTerminal());
    this.terminalResizeObserver.observe(container);
  },

  connectTerminal(cwd = "") {
    if (!this.terminalInstance) return;
    if (this.terminalSocket && this.terminalSocket.readyState <= WebSocket.OPEN) return;
    this.terminalRequestedCwd = cwd || "";
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/api/system/terminal/ws?cwd=${encodeURIComponent(cwd || "")}`;
    const socket = new WebSocket(url);
    socket.binaryType = "arraybuffer";
    this.terminalSocket = socket;

    socket.onopen = () => {
      if (this.terminalSocket !== socket) return;
      this.fitTerminal();
      this.sendTerminalResize();
      this.terminalInstance.focus();
      for (const data of this.terminalPendingInput.splice(0)) {
        socket.send(JSON.stringify({ type: "input", data }));
      }
    };
    socket.onmessage = event => {
      if (typeof event.data === "string") {
        try {
          const message = JSON.parse(event.data);
          if (message.type === "error") {
            this.terminalInstance.writeln(`\r\n\x1b[31m${message.message || "Terminal error"}\x1b[0m`);
            return;
          }
        } catch (_) {}
        this.terminalInstance.write(event.data);
      } else {
        this.terminalInstance.write(new Uint8Array(event.data));
      }
    };
    socket.onerror = () => {
      if (this.terminalSocket === socket) {
        this.terminalInstance.writeln("\r\n\x1b[31mWebSocket terminal connection failed.\x1b[0m");
      }
    };
    socket.onclose = event => {
      if (this.terminalSocket === socket) {
        this.terminalSocket = null;
        this.setTerminalMinimized(false);
      }
      if (event.code === 1008) {
        this.terminalInstance.writeln("\r\n\x1b[31mTerminal session rejected. Please sign in again.\x1b[0m");
      }
    };
  },

  setTerminalMinimized(minimized) {
    const nav = document.getElementById("navTerminal");
    const indicator = document.getElementById("terminalMinimizedIndicator");
    if (nav) nav.classList.toggle("terminal-minimized", minimized);
    if (indicator) indicator.classList.toggle("hidden", !minimized);
  },

  minimizeTerminal() {
    this.setTerminalMinimized(true);
    UI.closeModal("terminalModal");
  },

  closeTerminalWindow() {
    this.closeTerminalSession();
    UI.closeModal("terminalModal");
  },

  closeTerminalSession() {
    this.setTerminalMinimized(false);
    const socket = this.terminalSocket;
    this.terminalSocket = null;
    if (socket && socket.readyState < WebSocket.CLOSING) {
      socket.close(1000, "User signed out");
    }
    this.terminalPendingInput.length = 0;
    if (this.terminalResizeObserver) this.terminalResizeObserver.disconnect();
    this.terminalResizeObserver = null;
    if (this.terminalInstance) this.terminalInstance.dispose();
    this.terminalInstance = null;
    this.terminalFitAddon = null;
  },

  sendTerminalInput(data) {
    const socket = this.terminalSocket;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "input", data }));
    } else if (socket && socket.readyState === WebSocket.CONNECTING) {
      this.terminalPendingInput.push(data);
    }
  },

  sendTerminalResize() {
    const socket = this.terminalSocket;
    if (!socket || socket.readyState !== WebSocket.OPEN || !this.terminalInstance) return;
    socket.send(JSON.stringify({
      type: "resize",
      cols: this.terminalInstance.cols,
      rows: this.terminalInstance.rows
    }));
  },

  fitTerminal() {
    if (!this.terminalFitAddon || !this.terminalInstance) return;
    try {
      this.terminalFitAddon.fit();
      this.sendTerminalResize();
    } catch (_) {}
  },

  clearTerminal() {
    if (this.terminalInstance) this.terminalInstance.clear();
  },

  copyTerminalOutput() {
    if (!this.terminalInstance) return;
    this.terminalInstance.selectAll();
    const text = this.terminalInstance.getSelection();
    this.terminalInstance.clearSelection();
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      UI.toast(t("terminal_copy_toast"), "success");
    }).catch(() => {
      UI.toast(t("terminal_copy_failed"), "warning");
    });
  },

  runTerminalCommand(command) {
    if (!command || !this.terminalInstance) return;
    this.terminalInstance.paste(`${command}\r`);
    this.terminalInstance.focus();
  },

  initDragSelect() {
    const container = document.getElementById("mainContentArea");
    if (!container) return;

    let isDown = false;
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let preSelected = new Set();
    let isCtrlOrShift = false;
    let animFrame = null;

    // Create drag selection box element if not present in DOM
    let box = document.getElementById("dragSelectionBox");
    if (!box) {
      box = document.createElement("div");
      box.id = "dragSelectionBox";
      box.className = "drag-selection-box";
      document.body.appendChild(box);
    }

    container.addEventListener("mousedown", (e) => {
      // Only left mouse button (e.button === 0)
      if (e.button !== 0) return;

      // Ignore interactive controls, modal overlays, buttons, inputs, context menus
      if (e.target.closest("button, a, input, select, textarea, .breadcrumb-crumb, .selection-bar, .modal-overlay, #contextMenu, .file-card-menu-btn, .table-btn-action, .item-checkbox, .preview-lightbox-overlay")) {
        return;
      }

      isDown = true;
      isDragging = false;
      startX = e.clientX;
      startY = e.clientY;
      isCtrlOrShift = e.ctrlKey || e.metaKey || e.shiftKey;

      if (isCtrlOrShift) {
        preSelected = new Set(AppState.selectedItems);
      } else {
        preSelected = new Set();
        // If clicking on empty space without Ctrl/Shift, deselect previous items
        if (!e.target.closest(".file-card, .file-table tbody tr")) {
          AppState.selectedItems.clear();
          AppState.lastSelectedPath = null;
          App.updateSelectionUI();
        }
      }
    });

    const onMouseMove = (e) => {
      if (!isDown) return;

      const currentX = e.clientX;
      const currentY = e.clientY;
      const dist = Math.hypot(currentX - startX, currentY - startY);

      if (!isDragging) {
        // Drag threshold of 5px to avoid interfering with regular single clicks
        if (dist > 5) {
          isDragging = true;
          this._justDragged = true;
          document.body.classList.add("select-none");
          App.hideContextMenu();
        } else {
          return;
        }
      }

      if (animFrame) cancelAnimationFrame(animFrame);
      animFrame = requestAnimationFrame(() => {
        // Calculate box dimensions
        const x1 = Math.min(startX, currentX);
        const y1 = Math.min(startY, currentY);
        const x2 = Math.max(startX, currentX);
        const y2 = Math.max(startY, currentY);

        box.style.left = `${x1}px`;
        box.style.top = `${y1}px`;
        box.style.width = `${x2 - x1}px`;
        box.style.height = `${y2 - y1}px`;
        box.style.display = "block";

        // Auto-scroll if dragging near vertical edges of the viewport
        const cRect = container.getBoundingClientRect();
        if (currentY > cRect.bottom - 45) {
          container.scrollTop += 12;
        } else if (currentY < cRect.top + 45) {
          container.scrollTop -= 12;
        }

        // Query all selectable file cards or table rows
        const items = container.querySelectorAll(".file-card, .file-table tbody tr");
        const intersecting = new Set();

        items.forEach(el => {
          const path = el.getAttribute("data-path");
          if (!path) return;

          const rect = el.getBoundingClientRect();
          // Check rectangle intersection
          const isIntersecting = !(rect.right < x1 || rect.left > x2 || rect.bottom < y1 || rect.top > y2);

          if (isIntersecting) {
            intersecting.add(path);
          }
        });

        // Determine updated selection set
        if (isCtrlOrShift) {
          AppState.selectedItems = new Set(preSelected);
          intersecting.forEach(p => {
            if (preSelected.has(p) && (e.ctrlKey || e.metaKey)) {
              AppState.selectedItems.delete(p);
            } else {
              AppState.selectedItems.add(p);
            }
          });
        } else {
          AppState.selectedItems = new Set(intersecting);
        }

        // Apply fast visual selection classes directly
        items.forEach(el => {
          const path = el.getAttribute("data-path");
          const sel = AppState.selectedItems.has(path);
          el.classList.toggle("selected", sel);
          const cb = el.querySelector(".item-checkbox");
          if (cb) cb.checked = sel;
        });

        // Update selection count and floating selection bar
        App.updateSelectionBar();
      });
    };

    const onMouseUp = () => {
      if (!isDown) return;
      isDown = false;

      if (animFrame) cancelAnimationFrame(animFrame);
      box.style.display = "none";
      document.body.classList.remove("select-none");

      if (isDragging) {
        isDragging = false;
        App.updateSelectionUI();
        setTimeout(() => {
          this._justDragged = false;
        }, 120);
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }
};

// Initialize application on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  App.init();
});

