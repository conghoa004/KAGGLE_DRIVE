/* ============================================================
   KAGGLE CLOUD DRIVE - UI UTILITIES & OFFICIAL ICONS
   Using Font Awesome 6 Pro-grade Official Vector Icons
   ============================================================ */

const UI = {
  // Toast Notification System
  toast(message, type = "info", duration = 3200) {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const icons = {
      success: '<i class="fa-solid fa-circle-check"></i>',
      error: '<i class="fa-solid fa-circle-xmark"></i>',
      warning: '<i class="fa-solid fa-triangle-exclamation"></i>',
      info: '<i class="fa-solid fa-circle-info"></i>'
    };

    const toastEl = document.createElement("div");
    toastEl.className = `toast ${type}`;
    toastEl.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span>${this.escape(message)}</span>`;

    container.appendChild(toastEl);

    setTimeout(() => {
      toastEl.style.opacity = "0";
      toastEl.style.transform = "translateX(25px)";
      toastEl.style.transition = "all 0.25s ease";
      setTimeout(() => toastEl.remove(), 260);
    }, duration);
  },

  // Modal Control
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add("show");
      const firstInput = modal.querySelector("input:not([type=hidden]), textarea");
      if (firstInput) {
        setTimeout(() => firstInput.focus(), 80);
      }
    }
  },

  closeModal(modalId) {
    if (modalId === "previewModal" && window.Previewer && typeof window.Previewer.closePreview === "function") {
      window.Previewer.closePreview();
      return;
    }
    if (modalId === "editorModal" && window.Editor && typeof window.Editor.close === "function") {
      window.Editor.close();
      return;
    }
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove("show");
    }
  },

  closeAllModals() {
    const unsavedModal = document.getElementById("unsavedChangesModal");
    if (unsavedModal && unsavedModal.classList.contains("show")) {
      this.closeModal("unsavedChangesModal");
      return;
    }
    if (window.Previewer && window.Previewer.spreadsheetState && window.Previewer.spreadsheetState.isDirty) {
      window.Previewer.closePreview();
      return;
    }
    if (window.Editor && window.Editor.isDirty) {
      window.Editor.close();
      return;
    }
    if (window.Previewer && typeof window.Previewer.closePreview === "function") {
      window.Previewer.closePreview();
    }
    document.querySelectorAll(".modal-overlay").forEach(m => {
      m.classList.remove("show");
      m.querySelectorAll("video, audio").forEach(el => {
        try {
          el.pause();
          el.src = "";
          el.load();
        } catch (_) {}
      });
    });
  },

  // Official Font Awesome 6 Vector Icon Mapping
  getIcon(item) {
    if (item.is_dir) {
      return '<i class="fa-solid fa-folder icon-folder"></i>';
    }

    const ext = (item.extension || "").toLowerCase();

    // Specific file extensions
    if (ext === "py") {
      return '<i class="fa-brands fa-python icon-python"></i>';
    }
    if (ext === "ipynb") {
      return '<i class="fa-solid fa-book-bookmark icon-notebook"></i>';
    }
    if (ext === "md") {
      return '<i class="fa-brands fa-markdown icon-markdown"></i>';
    }
    if (ext === "pdf") {
      return '<i class="fa-solid fa-file-pdf icon-pdf"></i>';
    }
    if (ext === "xlsx" || ext === "xls") {
      return '<i class="fa-solid fa-file-excel icon-excel"></i>';
    }
    if (ext === "csv" || ext === "tsv") {
      return '<i class="fa-solid fa-file-csv icon-csv"></i>';
    }
    if (["safetensors", "pth", "pt", "bin", "onnx", "h5", "ckpt"].includes(ext)) {
      return '<i class="fa-solid fa-brain icon-ai-model"></i>';
    }
    if (["zip", "tar", "gz", "tgz", "bz2", "7z", "rar"].includes(ext)) {
      return '<i class="fa-solid fa-file-zipper icon-archive"></i>';
    }

    // Category fallbacks
    const category = item.category;
    if (category === "image") {
      return '<i class="fa-solid fa-file-image icon-image"></i>';
    }
    if (category === "video") {
      return '<i class="fa-solid fa-file-video icon-video"></i>';
    }
    if (category === "audio") {
      return '<i class="fa-solid fa-file-audio icon-audio"></i>';
    }
    if (category === "code") {
      return '<i class="fa-solid fa-file-code icon-code"></i>';
    }

    return '<i class="fa-solid fa-file-lines icon-text"></i>';
  },

  // HTML escaping
  escape(str) {
    if (str === null || str === undefined) return "";
    return String(str).replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c]));
  },

  inlineJsString(value) {
    return String(value ?? "")
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/\r/g, "\\r")
      .replace(/\n/g, "\\n")
      .replace(/\u2028/g, "\\u2028")
      .replace(/\u2029/g, "\\u2029")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/'/g, "&#39;");
  },

  formatSize(bytes) {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(1) + " " + sizes[i];
  }
};
