/* ============================================================
   KAGGLE CLOUD DRIVE - UPLOAD MANAGER (DRAG & DROP + FOLDERS)
   ============================================================ */

const Uploader = {
  isUploading: false,

  init() {
    this.setupGlobalDragDrop();
    this.setupFileInputs();
  },

  setupGlobalDragDrop() {
    const overlay = document.getElementById("dragOverlay");
    let dragCounter = 0;

    window.addEventListener("dragenter", (e) => {
      e.preventDefault();
      dragCounter++;
      if (overlay) overlay.classList.add("active");
    });

    window.addEventListener("dragleave", (e) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        if (overlay) overlay.classList.remove("active");
      }
    });

    window.addEventListener("dragover", (e) => {
      e.preventDefault();
    });

    window.addEventListener("drop", (e) => {
      e.preventDefault();
      dragCounter = 0;
      if (overlay) overlay.classList.remove("active");

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        this.uploadFilesList(Array.from(files));
      }
    });
  },

  setupFileInputs() {
    const fileInput = document.getElementById("fileInput");
    const folderInput = document.getElementById("folderInput");

    if (fileInput) {
      fileInput.addEventListener("change", (e) => {
        if (e.target.files && e.target.files.length > 0) {
          this.uploadFilesList(Array.from(e.target.files));
          e.target.value = "";
        }
      });
    }

    if (folderInput) {
      folderInput.addEventListener("change", (e) => {
        if (e.target.files && e.target.files.length > 0) {
          this.uploadFilesList(Array.from(e.target.files));
          e.target.value = "";
        }
      });
    }
  },

  async uploadFilesList(files) {
    if (!files.length) return;
    if (this.isUploading) {
      UI.toast(t("upload_busy"), "warning");
      return;
    }

    this.isUploading = true;
    UI.openModal("uploadModal");

    const progressBar = document.getElementById("uploadProgressBar");
    const progressText = document.getElementById("uploadProgressText");
    const fileListText = document.getElementById("uploadFileListText");

    if (progressBar) progressBar.style.width = "0%";
    if (progressText) progressText.textContent = "0%";
    if (fileListText) fileListText.textContent = t("upload_preparing", { count: files.length });

    const formData = new FormData();
    formData.append("target_path", AppState.currentPath);

    files.forEach((file) => {
      formData.append("files", file);
      // Pass relative path if uploaded via folder input
      formData.append("relative_paths", file.webkitRelativePath || "");
    });

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/files/upload", true);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          if (progressBar) progressBar.style.width = percent + "%";
          if (progressText) progressText.textContent = `${percent}% (${UI.formatSize(e.loaded)} / ${UI.formatSize(e.total)})`;
        }
      };

      xhr.onload = () => {
        this.isUploading = false;
        setTimeout(() => UI.closeModal("uploadModal"), 600);

        if (xhr.status >= 200 && xhr.status < 300) {
          UI.toast(t("upload_success", { count: files.length }), "success");
          App.loadDirectory(AppState.currentPath);
          App.refreshSystemStats();
          resolve();
        } else {
          let errorMsg = t("upload_error");
          try {
            const res = JSON.parse(xhr.responseText);
            errorMsg = res.detail || errorMsg;
          } catch (_) {}
          UI.toast(errorMsg, "error");
          reject(new Error(errorMsg));
        }
      };

      xhr.onerror = () => {
        this.isUploading = false;
        UI.closeModal("uploadModal");
        UI.toast(t("upload_error"), "error");
        reject(new Error(t("upload_error")));
      };

      xhr.send(formData);
    });
  }
};

