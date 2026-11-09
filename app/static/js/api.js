/* ============================================================
   KAGGLE CLOUD DRIVE - API CLIENT LAYER
   ============================================================ */

const API = {
  async request(endpoint, options = {}) {
    const defaultHeaders = {};
    if (options.body && !(options.body instanceof FormData)) {
      defaultHeaders["Content-Type"] = "application/json";
    }

    const config = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...(options.headers || {})
      }
    };

    try {
      const response = await fetch(endpoint, config);

      if (response.status === 401) {
        window.dispatchEvent(new CustomEvent("auth:unauthorized"));
        throw new Error("Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.");
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMsg = data.detail || data.message || `Lỗi máy chủ (${response.status})`;
        throw new Error(errorMsg);
      }

      return data;
    } catch (err) {
      throw err;
    }
  },

  // Auth Endpoints
  login(username, password) {
    return this.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });
  },

  logout() {
    return this.request("/api/auth/logout", { method: "POST" });
  },

  getMe() {
    return this.request("/api/auth/me");
  },

  // File Endpoints
  listFiles(path = "", showHidden = false) {
    const params = new URLSearchParams({ path, show_hidden: showHidden });
    return this.request(`/api/files?${params.toString()}`);
  },

  getFileContent(path) {
    return this.request(`/api/files/content?path=${encodeURIComponent(path)}`);
  },

  getFileProperties(path) {
    const params = new URLSearchParams({ path });
    return this.request(`/api/files/properties?${params.toString()}`);
  },

  saveFileContent(path, content) {
    return this.request("/api/files/content", {
      method: "POST",
      body: JSON.stringify({ path, content })
    });
  },

  saveBinaryFile(path, content_b64) {
    return this.request("/api/files/save-binary", {
      method: "POST",
      body: JSON.stringify({ path, content_b64 })
    });
  },

  createFolder(path) {
    return this.request("/api/files/mkdir", {
      method: "POST",
      body: JSON.stringify({ path })
    });
  },

  createFile(path) {
    return this.request("/api/files/touch", {
      method: "POST",
      body: JSON.stringify({ path })
    });
  },

  deleteItem(path) {
    return this.request("/api/files/delete", {
      method: "DELETE",
      body: JSON.stringify({ path })
    });
  },

  renameItem(path, new_name) {
    return this.request("/api/files/rename", {
      method: "POST",
      body: JSON.stringify({ path, new_name })
    });
  },

  copyItem(source_path, target_folder) {
    return this.request("/api/files/copy", {
      method: "POST",
      body: JSON.stringify({ source_path, target_folder })
    });
  },

  moveItem(source_path, target_folder) {
    return this.request("/api/files/move", {
      method: "POST",
      body: JSON.stringify({ source_path, target_folder })
    });
  },

  duplicateItem(path) {
    return this.request("/api/files/duplicate", {
      method: "POST",
      body: JSON.stringify({ path })
    });
  },

  extractArchive(path, target_folder = null) {
    return this.request("/api/files/extract", {
      method: "POST",
      body: JSON.stringify({ path, target_folder })
    });
  },

  compressItems(paths, archive_name = null, target_folder = null) {
    return this.request("/api/files/compress", {
      method: "POST",
      body: JSON.stringify({ paths, archive_name, target_folder })
    });
  },

  downloadFromUrl(url, target_folder = "", filename = null) {
    return this.request("/api/files/download-from-url", {
      method: "POST",
      body: JSON.stringify({ url, target_folder, filename })
    });
  },

  async downloadSelectedZip(items) {
    const response = await fetch("/api/files/download-selected-zip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || "Không thể tải tệp nén");
    }
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = "selected_items.zip";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 5000);
  },

  // System Endpoints
  getSystemStats() {
    return this.request("/api/system/stats");
  }
};

