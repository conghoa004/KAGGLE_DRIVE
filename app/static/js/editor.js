/* ============================================================
   KAGGLE CLOUD DRIVE - VS CODE STYLE CODE & TEXT EDITOR
   ============================================================ */

const Editor = {
  currentFilePath: null,
  isDirty: false,
  aceInstance: null,
  fontSize: 14,
  isWrapped: true,

  init() {
    const textarea = document.getElementById("editorTextarea");
    if (!textarea) return;

    if (window.ace) {
      try {
        const aceContainer = document.getElementById("aceEditorContainer");
        if (aceContainer) {
          aceContainer.style.display = "block";
          textarea.style.display = "none";

          this.aceInstance = ace.edit("aceEditorContainer");
          // VS Code style dark theme
          this.aceInstance.setTheme("ace/theme/tomorrow_night_eighties");
          this.aceInstance.setFontSize(this.fontSize + "px");
          this.aceInstance.setShowPrintMargin(false);
          this.aceInstance.session.setTabSize(4);
          this.aceInstance.session.setUseSoftTabs(true);
          this.aceInstance.session.setUseWrapMode(this.isWrapped);
          this.aceInstance.setHighlightActiveLine(true);
          this.aceInstance.setDisplayIndentGuides(true);
          this.aceInstance.setOptions({
            scrollPastEnd: 0.1,
            vScrollBarAlwaysVisible: false,
            autoScrollEditorIntoView: false,
            animatedScroll: true,
          });

          // Track edits
          this.aceInstance.on("change", () => {
            if (this.currentFilePath) {
              this.setDirty(true);
              this.updateStatusInfo();
            }
          });

          // Track cursor position (Ln X, Col Y)
          this.aceInstance.selection.on("changeCursor", () => {
            this.updateStatusInfo();
          });

          // Add Ctrl+S / Cmd+S shortcut
          this.aceInstance.commands.addCommand({
            name: "saveFile",
            bindKey: { win: "Ctrl-S", mac: "Command-S" },
            exec: () => {
              this.saveCurrentFile();
            }
          });
        }
      } catch (_) {
        this.aceInstance = null;
      }
    }

    // Fallback for standard textarea
    if (!this.aceInstance) {
      textarea.style.display = "block";
      textarea.addEventListener("keydown", (e) => {
        if (e.key === "Tab") {
          e.preventDefault();
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          textarea.value = textarea.value.substring(0, start) + "    " + textarea.value.substring(end);
          textarea.selectionStart = textarea.selectionEnd = start + 4;
          this.setDirty(true);
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
          e.preventDefault();
          this.saveCurrentFile();
        } else if (!e.ctrlKey && !e.metaKey && !["Shift", "Alt", "Control", "Meta", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
          this.setDirty(true);
        }
      });

      textarea.addEventListener("input", () => {
        this.updateStatusInfo();
      });

      textarea.addEventListener("click", () => {
        this.updateStatusInfo();
      });
      textarea.addEventListener("keyup", () => {
        this.updateStatusInfo();
      });
    }

    window.addEventListener("resize", () => {
      if (this.aceInstance) {
        this.aceInstance.resize();
        this.aceInstance.renderer.updateFull();
      }
    });
  },

  getAceMode(ext) {
    const modes = {
      py: "ace/mode/python",
      ipynb: "ace/mode/json",
      js: "ace/mode/javascript",
      ts: "ace/mode/typescript",
      json: "ace/mode/json",
      yaml: "ace/mode/yaml",
      yml: "ace/mode/yaml",
      html: "ace/mode/html",
      css: "ace/mode/css",
      md: "ace/mode/markdown",
      sh: "ace/mode/sh",
      bash: "ace/mode/sh",
      sql: "ace/mode/sql",
      c: "ace/mode/c_cpp",
      cpp: "ace/mode/c_cpp",
      h: "ace/mode/c_cpp",
      java: "ace/mode/java",
      rs: "ace/mode/rust",
      go: "ace/mode/golang"
    };
    return modes[ext.toLowerCase()] || "ace/mode/text";
  },

  updateTabIcon(ext) {
    const tabIcon = document.getElementById("editorTabIcon");
    if (!tabIcon) return;
    const icons = {
      py: "fa-brands fa-python text-blue-400",
      ipynb: "fa-solid fa-book-bookmark text-amber-500",
      js: "fa-brands fa-js text-yellow-400",
      json: "fa-solid fa-brackets-curly text-emerald-400",
      html: "fa-brands fa-html5 text-orange-500",
      css: "fa-brands fa-css3-alt text-sky-400",
      md: "fa-brands fa-markdown text-blue-400",
      sh: "fa-solid fa-terminal text-emerald-400"
    };
    tabIcon.className = icons[ext.toLowerCase()] || "fa-solid fa-file-code text-brand-400";
  },

  async openFile(path) {
    if (window.App && typeof App.hideContextMenu === "function") {
      App.hideContextMenu();
    }
    try {
      UI.toast(t("editor_loading_toast"), "info", 1500);
      const data = await API.getFileContent(path);

      this.currentFilePath = data.path;

      const titleEl = document.getElementById("editorFileName");
      if (titleEl) titleEl.textContent = data.name;

      const ext = (data.name.split(".").pop() || "").toLowerCase();
      this.updateTabIcon(ext);

      const langModeEl = document.getElementById("editorLanguageMode");
      if (langModeEl) {
        langModeEl.textContent = ext ? ext.toUpperCase() : "TEXT";
      }

      if (this.aceInstance) {
        this.aceInstance.session.setMode(this.getAceMode(ext));
        this.aceInstance.setValue(data.content || "", -1);
        this.aceInstance.clearSelection();
      } else {
        const textarea = document.getElementById("editorTextarea");
        if (textarea) textarea.value = data.content || "";
      }

      this.isDirty = false;
      this.setDirty(false);
      this.updateStatusInfo();
      UI.openModal("editorModal");

      if (this.aceInstance) {
        setTimeout(() => {
          this.aceInstance.resize();
          this.aceInstance.renderer.updateFull();
          this.aceInstance.focus();
        }, 100);
      }
    } catch (err) {
      UI.toast(err.message, "error");
    }
  },

  getContent() {
    if (this.aceInstance) {
      return this.aceInstance.getValue();
    }
    const textarea = document.getElementById("editorTextarea");
    return textarea ? textarea.value : "";
  },

  setDirty(dirty) {
    this.isDirty = dirty;
    const dirtyIndicator = document.getElementById("editorDirtyIndicator");
    if (dirtyIndicator) {
      dirtyIndicator.style.display = dirty ? "inline-block" : "none";
    }
  },

  changeFontSize(delta) {
    this.fontSize = Math.min(24, Math.max(11, this.fontSize + delta));
    const fontText = document.getElementById("editorFontSizeText");
    if (fontText) fontText.textContent = this.fontSize + "px";

    if (this.aceInstance) {
      this.aceInstance.setFontSize(this.fontSize + "px");
    } else {
      const textarea = document.getElementById("editorTextarea");
      if (textarea) textarea.style.fontSize = this.fontSize + "px";
    }
  },

  toggleWordWrap() {
    this.isWrapped = !this.isWrapped;
    const wrapBtn = document.getElementById("editorWrapBtn");
    if (wrapBtn) {
      wrapBtn.classList.toggle("bg-brand-600", this.isWrapped);
      wrapBtn.classList.toggle("text-white", this.isWrapped);
    }

    if (this.aceInstance) {
      this.aceInstance.session.setUseWrapMode(this.isWrapped);
    } else {
      const textarea = document.getElementById("editorTextarea");
      if (textarea) textarea.style.whiteSpace = this.isWrapped ? "pre-wrap" : "pre";
    }
    UI.toast(this.isWrapped ? t("editor_wrap_on") : t("editor_wrap_off"), "info", 1200);
  },

  toggleFullscreen() {
    const modalContent = document.querySelector("#editorModal .modal-content");
    if (modalContent) {
      const isFull = modalContent.classList.contains("h-screen");
      if (isFull) {
        modalContent.classList.remove("h-screen", "max-w-full", "rounded-none");
        modalContent.classList.add("h-[90vh]", "max-w-6xl", "rounded-2xl");
      } else {
        modalContent.classList.remove("h-[90vh]", "max-w-6xl", "rounded-2xl");
        modalContent.classList.add("h-screen", "max-w-full", "rounded-none");
      }
      if (this.aceInstance) {
        setTimeout(() => {
          this.aceInstance.resize();
          this.aceInstance.renderer.updateFull();
        }, 80);
      }
    }
  },

  updateStatusInfo() {
    const infoEl = document.getElementById("editorStatusInfo");
    const cursorEl = document.getElementById("editorCursorPosition");

    const content = this.getContent();
    const lines = content.split("\n").length;
    const chars = content.length;
    const sizeStr = UI.formatSize(chars);

    if (infoEl) {
      infoEl.textContent = t("editor_lines_size", { lines: lines, size: sizeStr });
    }

    if (cursorEl) {
      if (this.aceInstance) {
        const pos = this.aceInstance.getCursorPosition();
        cursorEl.textContent = `Ln ${pos.row + 1}, Col ${pos.column + 1}`;
      } else {
        const textarea = document.getElementById("editorTextarea");
        if (textarea) {
          const val = textarea.value.substr(0, textarea.selectionStart);
          const row = val.split("\n").length;
          const col = val.split("\n").pop().length + 1;
          cursorEl.textContent = `Ln ${row}, Col ${col}`;
        }
      }
    }
  },

  async saveCurrentFile() {
    if (!this.currentFilePath) return;

    const content = this.getContent();
    const saveBtn = document.getElementById("editorSaveBtn");

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>${t("editor_saving")}</span>`;
    }

    try {
      await API.saveFileContent(this.currentFilePath, content);
      this.setDirty(false);
      UI.toast(t("editor_saved_toast"), "success");
      App.loadDirectory(AppState.currentPath, false);
    } catch (err) {
      UI.toast(t("editor_save_error", { msg: err.message }), "error");
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> <span>${t("editor_save_btn")}</span>`;
      }
    }
  },

  close() {
    if (this.isDirty) {
      this.promptUnsavedChanges();
      return;
    }
    this.doClose();
  },

  promptUnsavedChanges() {
    const title = document.getElementById("unsavedModalTitle");
    const body = document.getElementById("unsavedChangesBody");
    const discardBtn = document.getElementById("unsavedDiscardBtn");
    const saveBtn = document.getElementById("unsavedSaveBtn");

    if (title) title.textContent = "Thay đổi chưa được lưu";
    if (body) {
      body.textContent = (typeof t === "function" && t("editor_dirty_confirm")) || "Tệp tin có các thay đổi chưa được lưu. Bạn có muốn lưu trước khi đóng không?";
    }
    if (discardBtn) {
      discardBtn.onclick = () => Editor.discardAndClose();
    }
    if (saveBtn) {
      saveBtn.onclick = () => Editor.saveAndClose();
    }
    UI.openModal("unsavedChangesModal");
  },

  discardAndClose() {
    UI.closeModal("unsavedChangesModal");
    this.isDirty = false;
    this.doClose();
  },

  async saveAndClose() {
    UI.closeModal("unsavedChangesModal");
    if (this.isDirty) {
      await this.saveCurrentFile();
      if (this.isDirty) return;
    }
    this.doClose();
  },

  doClose() {
    this.currentFilePath = null;
    this.isDirty = false;
    const modal = document.getElementById("editorModal");
    if (modal) modal.classList.remove("show");
  }
};
