/* ============================================================
   KAGGLE CLOUD DRIVE - EXECUTIVE RICH MEDIA LIGHTBOX & PLAYERS
   (Interactive Image Lightbox, Cinema Video, Studio Audio, Documents)
   ============================================================ */

const Previewer = {
  playlist: [],
  currentIndex: -1,
  currentItem: null,
  currentCategory: null,
  activeVideo: null,
  activeAudio: null,
  keydownHandler: null,

  // State for interactive image viewer
  imageState: {
    scale: 1,
    rotation: 0,
    panX: 0,
    panY: 0,
    isDragging: false,
    startX: 0,
    startY: 0
  },

  closePreview() {
    if (this.spreadsheetState && this.spreadsheetState.isDirty) {
      this.promptUnsavedSpreadsheet();
      return;
    }
    this.doClosePreview();
  },

  promptUnsavedSpreadsheet() {
    const title = document.getElementById("unsavedModalTitle");
    const body = document.getElementById("unsavedChangesBody");
    const discardBtn = document.getElementById("unsavedDiscardBtn");
    const saveBtn = document.getElementById("unsavedSaveBtn");

    if (title) title.textContent = "Thay đổi chưa được lưu";
    if (body) {
      body.textContent = "Bảng tính có các thay đổi chưa được lưu vào máy chủ. Bạn có muốn lưu thay đổi trước khi đóng không?";
    }
    if (discardBtn) {
      discardBtn.onclick = () => Previewer.discardAndClose();
    }
    if (saveBtn) {
      saveBtn.onclick = () => Previewer.saveAndClose();
    }
    UI.openModal("unsavedChangesModal");
  },

  async saveAndClose() {
    UI.closeModal("unsavedChangesModal");
    if (this.spreadsheetState) {
      await this.saveSpreadsheet();
      if (this.spreadsheetState && this.spreadsheetState.isDirty) {
        return;
      }
    }
    this.doClosePreview();
  },

  discardAndClose() {
    UI.closeModal("unsavedChangesModal");
    if (this.spreadsheetState) {
      this.spreadsheetState.isDirty = false;
    }
    this.doClosePreview();
  },

  doClosePreview() {
    this.closeSsContextMenu();
    this.spreadsheetState = null;

    // 1. Remove keyboard navigation listener
    if (this.keydownHandler) {
      window.removeEventListener("keydown", this.keydownHandler);
      this.keydownHandler = null;
    }

    const modal = document.getElementById("previewModal");
    if (!modal) return;
    
    // 2. Stop and unload any media elements immediately
    const media = modal.querySelectorAll("video, audio");
    media.forEach(el => {
      try {
        el.pause();
        el.src = "";
        el.load();
      } catch (_) {}
    });
    this.activeVideo = null;
    this.activeAudio = null;

    const container = document.getElementById("previewContainer");
    if (container) container.innerHTML = "";
    modal.classList.remove("show");
  },

  navigateMedia(direction) {
    if (!this.playlist || this.playlist.length <= 1) return;
    let nextIdx = this.currentIndex + direction;
    if (nextIdx < 0) nextIdx = this.playlist.length - 1;
    if (nextIdx >= this.playlist.length) nextIdx = 0;
    const nextItem = this.playlist[nextIdx];
    if (nextItem) {
      this.openPreview(nextItem);
    }
  },

  async openPreview(itemOrPath, optionalName = null) {
    if (window.App && typeof App.hideContextMenu === "function") {
      App.hideContextMenu();
    }
    let item = itemOrPath;
    if (typeof itemOrPath === "string") {
      const path = itemOrPath;
      const name = optionalName || path.split("/").pop() || path;
      const ext = (name.split(".").pop() || "").toLowerCase();
      const codeExts = ["py", "js", "ts", "json", "yaml", "yml", "html", "css", "sh", "sql", "c", "cpp", "java", "rs", "go"];
      const imgExts = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico", "avif", "tiff", "tif"];
      const videoExts = ["mp4", "webm", "mkv", "avi", "mov", "flv", "wmv", "m4v"];
      const audioExts = ["mp3", "wav", "ogg", "flac", "m4a", "aac", "wma", "opus"];
      let cat = "text";
      if (codeExts.includes(ext)) cat = "code";
      else if (imgExts.includes(ext)) cat = "image";
      else if (videoExts.includes(ext)) cat = "video";
      else if (audioExts.includes(ext)) cat = "audio";
      else if (ext === "pdf") cat = "pdf";
      else if (ext === "ipynb") cat = "notebook";
      else if (["csv", "tsv", "xlsx", "xls"].includes(ext)) cat = "spreadsheet";
      else if (ext === "md") cat = "markdown";

      item = {
        name: name,
        path: path,
        extension: ext,
        category: cat,
        formatted_size: ""
      };
    }

    this.currentItem = item;
    this.currentCategory = item.category;

    // Gallery playlist calculation: find files in current directory with matching category
    if (window.AppState && Array.isArray(AppState.files)) {
      if (["image", "video", "audio"].includes(item.category)) {
        this.playlist = AppState.files.filter(f => !f.is_dir && f.category === item.category);
        if (!this.playlist.some(f => f.path === item.path)) {
          this.playlist.unshift(item);
        }
      } else {
        this.playlist = AppState.files.filter(f => !f.is_dir && f.category === item.category);
        if (!this.playlist.some(f => f.path === item.path)) {
          this.playlist = [item];
        }
      }
    } else {
      this.playlist = [item];
    }

    this.currentIndex = this.playlist.findIndex(f => f.path === item.path);
    if (this.currentIndex === -1) this.currentIndex = 0;

    const modal = document.getElementById("previewModal");
    const titleEl = document.getElementById("previewFileName");
    const metaEl = document.getElementById("previewFileMeta");
    const iconEl = document.getElementById("previewCategoryIcon");
    const container = document.getElementById("previewContainer");
    const downloadBtn = document.getElementById("previewDownloadBtn");
    const prevBtn = document.getElementById("previewPrevBtn");
    const nextBtn = document.getElementById("previewNextBtn");
    const counterEl = document.getElementById("previewGalleryCounter");
    const curIdxEl = document.getElementById("previewCurrentIndex");
    const totalCountEl = document.getElementById("previewTotalCount");

    if (!modal || !container) return;

    // Unload any previously playing media before rendering new one
    modal.querySelectorAll("video, audio").forEach(el => {
      try {
        el.pause();
        el.src = "";
        el.load();
      } catch (_) {}
    });
    this.activeVideo = null;
    this.activeAudio = null;

    const rawUrl = `/api/files/preview-raw?path=${encodeURIComponent(item.path).replace(/'/g, "%27")}`;
    const category = item.category;
    const ext = (item.extension || "").toUpperCase();

    // Setup Header UI
    if (titleEl) titleEl.textContent = item.name;
    if (iconEl) {
      if (category === "image") iconEl.innerHTML = '<i class="fa-solid fa-image text-emerald-400"></i>';
      else if (category === "video") iconEl.innerHTML = '<i class="fa-solid fa-film text-purple-400"></i>';
      else if (category === "audio") iconEl.innerHTML = '<i class="fa-solid fa-music text-pink-400"></i>';
      else if (category === "code" || category === "text") iconEl.innerHTML = '<i class="fa-solid fa-code text-sky-400"></i>';
      else if (category === "pdf") iconEl.innerHTML = '<i class="fa-solid fa-file-pdf text-rose-400"></i>';
      else if (category === "notebook") iconEl.innerHTML = '<i class="fa-solid fa-book-bookmark text-amber-400"></i>';
      else if (category === "spreadsheet" || category === "csv" || ["xlsx", "xls", "csv", "tsv"].includes((item.extension || "").toLowerCase())) {
        const isXls = ["xlsx", "xls"].includes((item.extension || "").toLowerCase());
        iconEl.innerHTML = isXls ? '<i class="fa-solid fa-file-excel text-emerald-400"></i>' : '<i class="fa-solid fa-table text-emerald-400"></i>';
      }
      else if (category === "markdown") iconEl.innerHTML = '<i class="fa-brands fa-markdown text-blue-400"></i>';
      else iconEl.innerHTML = '<i class="fa-solid fa-file text-slate-400"></i>';
    }
    if (metaEl) {
      metaEl.textContent = `${ext}${item.formatted_size ? ' • ' + item.formatted_size : ''}`;
    }
    if (downloadBtn) {
      downloadBtn.onclick = () => {
        window.location.href = `/api/files/download?path=${encodeURIComponent(item.path).replace(/'/g, "%27")}`;
      };
    }

    // Gallery Counter & Chevrons
    if (this.playlist.length > 1) {
      if (counterEl) counterEl.classList.remove("hidden");
      if (curIdxEl) curIdxEl.textContent = (this.currentIndex + 1);
      if (totalCountEl) totalCountEl.textContent = this.playlist.length;
      if (prevBtn) prevBtn.classList.remove("hidden");
      if (nextBtn) nextBtn.classList.remove("hidden");
    } else {
      if (counterEl) counterEl.classList.add("hidden");
      if (prevBtn) prevBtn.classList.add("hidden");
      if (nextBtn) nextBtn.classList.add("hidden");
    }

    // Attach Lightbox Keyboard Shortcuts
    if (this.keydownHandler) {
      window.removeEventListener("keydown", this.keydownHandler);
    }
    this.keydownHandler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && this.spreadsheetState) {
        e.preventDefault();
        this.saveSpreadsheet();
        return;
      }
      if (document.activeElement && ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
      if (document.activeElement && document.activeElement.isContentEditable) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        this.navigateMedia(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        this.navigateMedia(1);
      } else if (e.key === " " && (this.activeVideo || this.activeAudio)) {
        e.preventDefault();
        if (this.activeVideo) this.toggleVideoPlay();
        else if (this.activeAudio) this.toggleAudioPlay();
      } else if (e.key === "Escape") {
        const unsavedModal = document.getElementById("unsavedChangesModal");
        if (unsavedModal && unsavedModal.classList.contains("show")) {
          UI.closeModal("unsavedChangesModal");
          return;
        }
        const ctxMenu = document.getElementById("ssContextMenu");
        if (ctxMenu && !ctxMenu.classList.contains("hidden")) {
          this.closeSsContextMenu();
          return;
        }
        this.closePreview();
      }
    };
    window.addEventListener("keydown", this.keydownHandler);

    container.innerHTML = `<div class="flex flex-col items-center justify-center p-12 text-slate-400 gap-3"><i class="fa-solid fa-circle-notch fa-spin text-3xl text-brand-500 mb-1"></i><span class="text-sm font-medium text-slate-300">${t("preview_loading")}</span></div>`;
    UI.openModal("previewModal");

    try {
      if (category === "image") {
        this.renderImage(item, rawUrl, container);
      } else if (category === "video") {
        this.renderVideo(item, rawUrl, container);
      } else if (category === "audio") {
        this.renderAudio(item, rawUrl, container);
      } else if (category === "pdf") {
        this.renderPdf(item, rawUrl, container);
      } else if (item.extension && item.extension.toLowerCase() === "ipynb") {
        const data = await API.getFileContent(item.path);
        this.renderNotebook(data.content, container);
      } else if (category === "spreadsheet" || category === "csv" || ["xlsx", "xls", "csv", "tsv"].includes((item.extension || "").toLowerCase())) {
        await this.renderSpreadsheet(item, rawUrl, container);
      } else if (category === "markdown") {
        const data = await API.getFileContent(item.path);
        this.renderMarkdown(data.content, container);
      } else if (category === "text" || category === "code") {
        const data = await API.getFileContent(item.path);
        this.renderCode(item, data, container);
      } else {
        container.innerHTML = `
          <div class="preview-doc-window" style="height: auto; max-width: 480px; margin: auto; padding: 40px; text-align: center;">
            <div style="font-size: 54px; margin-bottom: 16px;">${UI.getIcon(item)}</div>
            <h3 class="font-bold text-white text-base mb-1">${UI.escape(item.name)}</h3>
            <p style="color: #94a3b8; margin: 8px 0 20px;" class="text-xs">${t("preview_unsupported", { ext: (item.extension || "").toUpperCase() })}</p>
            <button class="btn-primary" style="margin: 0 auto;" onclick="window.location.href='/api/files/download?path=${encodeURIComponent(item.path).replace(/'/g, "%27")}'">
              <i class="fa-solid fa-download"></i> ${t("preview_download_file")}
            </button>
          </div>`;
      }
    } catch (err) {
      container.innerHTML = `<div class="p-8 text-center text-rose-400 font-mono text-sm">${UI.escape(err.message)}</div>`;
    }
  },

  renderImage(item, rawUrl, container) {
    this.imageState = { scale: 1, rotation: 0, panX: 0, panY: 0, isDragging: false, startX: 0, startY: 0 };
    const sizeStr = item.formatted_size || "";

    container.innerHTML = `
      <div class="image-lightbox-wrapper" id="imgWrapper">
        <div class="image-lightbox-canvas" id="imgViewport">
          <img id="previewActiveImg" src="${rawUrl}" alt="${UI.escape(item.name)}" class="image-lightbox-img" />
        </div>

        <!-- Floating Glass Capsule Toolbar -->
        <div class="image-floating-toolbar">
          <button class="img-capsule-btn" onclick="Previewer.zoomImage(-0.25)" title="${t("preview_zoom_out")}">
            <i class="fa-solid fa-minus"></i>
          </button>
          <span id="imgZoomPercent" class="img-zoom-label" onclick="Previewer.resetImageZoom()" title="${t("preview_fit_screen")}">100%</span>
          <button class="img-capsule-btn" onclick="Previewer.zoomImage(0.25)" title="${t("preview_zoom_in")}">
            <i class="fa-solid fa-plus"></i>
          </button>
          <div class="img-toolbar-sep"></div>
          <button class="img-capsule-btn" onclick="Previewer.resetImageZoom()" title="${t("preview_fit_screen")}">
            <i class="fa-solid fa-arrows-to-eye"></i>
          </button>
          <button class="img-capsule-btn" onclick="Previewer.setImage1to1()" title="${t("preview_reset_zoom")}">
            <span style="font-size: 11px; font-weight: bold; font-family: monospace;">1:1</span>
          </button>
          <button class="img-capsule-btn" onclick="Previewer.rotateImage()" title="${t("preview_rotate")}">
            <i class="fa-solid fa-rotate-right"></i>
          </button>
          <div class="img-toolbar-sep"></div>
          <button class="img-capsule-btn" onclick="window.location.href='/api/files/download?path=${encodeURIComponent(item.path).replace(/'/g, "%27")}'" title="${t("download")}">
            <i class="fa-solid fa-download"></i>
          </button>
        </div>
      </div>
    `;

    const img = document.getElementById("previewActiveImg");
    const viewport = document.getElementById("imgViewport");
    const metaEl = document.getElementById("previewFileMeta");

    if (img) {
      img.onload = () => {
        if (metaEl) {
          metaEl.textContent = `${(item.extension || "IMG").toUpperCase()} • ${img.naturalWidth} × ${img.naturalHeight} px${sizeStr ? " • " + sizeStr : ""}`;
        }
      };

      // Mouse Wheel Zoom
      viewport.addEventListener("wheel", (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.2 : -0.2;
        Previewer.zoomImage(delta);
      }, { passive: false });

      // Drag to Pan when zoomed in
      viewport.addEventListener("mousedown", (e) => {
        if (Previewer.imageState.scale <= 1) return;
        Previewer.imageState.isDragging = true;
        Previewer.imageState.startX = e.clientX - Previewer.imageState.panX;
        Previewer.imageState.startY = e.clientY - Previewer.imageState.panY;
        viewport.style.cursor = "grabbing";
      });

      window.addEventListener("mousemove", (e) => {
        if (!Previewer.imageState.isDragging) return;
        Previewer.imageState.panX = e.clientX - Previewer.imageState.startX;
        Previewer.imageState.panY = e.clientY - Previewer.imageState.startY;
        Previewer.applyImageTransform();
      });

      window.addEventListener("mouseup", () => {
        if (Previewer.imageState.isDragging) {
          Previewer.imageState.isDragging = false;
          if (viewport) viewport.style.cursor = Previewer.imageState.scale > 1 ? "grab" : "default";
        }
      });

      // Double-click toggle: fit or 1.6x
      viewport.addEventListener("dblclick", () => {
        if (Previewer.imageState.scale !== 1) {
          Previewer.resetImageZoom();
        } else {
          Previewer.zoomImage(0.6);
        }
      });
    }
  },

  zoomImage(delta) {
    const s = this.imageState;
    s.scale = Math.max(0.2, Math.min(6.0, Math.round((s.scale + delta) * 100) / 100));
    if (s.scale <= 1) {
      s.panX = 0;
      s.panY = 0;
    }
    this.applyImageTransform();
  },

  setImage1to1() {
    this.imageState.scale = 1;
    this.imageState.panX = 0;
    this.imageState.panY = 0;
    this.applyImageTransform();
  },

  rotateImage() {
    this.imageState.rotation = (this.imageState.rotation + 90) % 360;
    this.applyImageTransform();
  },

  resetImageZoom() {
    this.imageState.scale = 1;
    this.imageState.panX = 0;
    this.imageState.panY = 0;
    this.imageState.rotation = 0;
    this.applyImageTransform();
  },

  applyImageTransform() {
    const img = document.getElementById("previewActiveImg");
    const zoomText = document.getElementById("imgZoomPercent");
    const viewport = document.getElementById("imgViewport");
    if (!img) return;

    const s = this.imageState;
    img.style.transform = `translate(${s.panX}px, ${s.panY}px) scale(${s.scale}) rotate(${s.rotation}deg)`;
    if (zoomText) zoomText.textContent = `${Math.round(s.scale * 100)}%`;
    if (viewport) viewport.style.cursor = s.scale > 1 ? "grab" : "default";
  },

  renderVideo(item, rawUrl, container) {
    const sizeStr = item.formatted_size || "";

    container.innerHTML = `
      <div class="video-cinema-wrapper">
        <div class="video-cinema-viewport" id="videoViewport">
          <video id="previewVideoPlayer" preload="metadata" playsinline class="video-cinema-element">
            <source src="${rawUrl}">
            ${t("preview_video_unsupported")}
          </video>

          <!-- Center Big Play Button Overlay -->
          <div id="videoCenterPlayBtn" class="video-center-play" onclick="Previewer.toggleVideoPlay()">
            <i class="fa-solid fa-play ml-1"></i>
          </div>

          <!-- Bottom Cinema Controls Bar -->
          <div class="video-controls-bar" id="videoControls">
            <!-- Scrubber Progress Bar -->
            <div class="video-progress-wrap" id="videoProgressWrap">
              <div class="video-progress-track">
                <div class="video-progress-fill" id="videoProgressFill">
                  <span class="video-progress-thumb"></span>
                </div>
              </div>
            </div>

            <!-- Controls Row -->
            <div class="video-controls-row">
              <div class="flex items-center gap-1.5">
                <button class="video-ctrl-btn" id="videoPlayPauseBtn" onclick="Previewer.toggleVideoPlay()" title="${t("preview_play")}">
                  <i class="fa-solid fa-play"></i>
                </button>
                <button class="video-ctrl-btn" onclick="Previewer.seekVideo(-10)" title="${t("preview_jump_backward")}">
                  <i class="fa-solid fa-rotate-left"></i>
                </button>
                <button class="video-ctrl-btn" onclick="Previewer.seekVideo(10)" title="${t("preview_jump_forward")}">
                  <i class="fa-solid fa-rotate-right"></i>
                </button>
                <div class="flex items-center gap-1 ml-1">
                  <button class="video-ctrl-btn text-xs" id="videoVolumeBtn" onclick="Previewer.toggleVideoMute()" title="${t("preview_volume")}">
                    <i class="fa-solid fa-volume-high"></i>
                  </button>
                  <input type="range" id="videoVolumeSlider" class="video-volume-slider" min="0" max="1" step="0.05" value="1" oninput="Previewer.setVideoVolume(this.value)" />
                </div>
                <div class="video-time-display ml-2">
                  <span id="videoCurrentTime">00:00</span> / <span id="videoDuration">00:00</span>
                </div>
              </div>

              <div class="flex items-center gap-2">
                <!-- Playback Speed Pills -->
                <div class="flex items-center gap-1 bg-slate-900/60 p-0.5 rounded-lg border border-white/10">
                  <button class="video-speed-pill" onclick="Previewer.setVideoSpeed(0.75, this)">0.75x</button>
                  <button class="video-speed-pill active" onclick="Previewer.setVideoSpeed(1.0, this)">1x</button>
                  <button class="video-speed-pill" onclick="Previewer.setVideoSpeed(1.25, this)">1.25x</button>
                  <button class="video-speed-pill" onclick="Previewer.setVideoSpeed(1.5, this)">1.5x</button>
                  <button class="video-speed-pill" onclick="Previewer.setVideoSpeed(2.0, this)">2x</button>
                </div>
                <!-- Fullscreen Button -->
                <button class="video-ctrl-btn" onclick="Previewer.toggleVideoFullscreen()" title="${t("preview_fullscreen")}">
                  <i class="fa-solid fa-expand"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const vid = document.getElementById("previewVideoPlayer");
    const metaEl = document.getElementById("previewFileMeta");
    const centerBtn = document.getElementById("videoCenterPlayBtn");
    const playBtn = document.getElementById("videoPlayPauseBtn");
    const progressWrap = document.getElementById("videoProgressWrap");
    const progressFill = document.getElementById("videoProgressFill");
    const curTimeEl = document.getElementById("videoCurrentTime");
    const durTimeEl = document.getElementById("videoDuration");

    this.activeVideo = vid;

    if (vid) {
      const formatTime = (seconds) => {
        if (!seconds || isNaN(seconds)) return "00:00";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
      };

      vid.onloadedmetadata = () => {
        const durStr = formatTime(vid.duration);
        if (durTimeEl) durTimeEl.textContent = durStr;
        if (metaEl) {
          const res = vid.videoWidth ? `${vid.videoWidth} × ${vid.videoHeight}` : "";
          metaEl.textContent = `${(item.extension || "MP4").toUpperCase()}${res ? " • " + res : ""}${durStr ? " • " + durStr : ""}${sizeStr ? " • " + sizeStr : ""}`;
        }
      };

      vid.ontimeupdate = () => {
        if (curTimeEl) curTimeEl.textContent = formatTime(vid.currentTime);
        if (progressFill && vid.duration) {
          const pct = (vid.currentTime / vid.duration) * 100;
          progressFill.style.width = `${pct}%`;
        }
      };

      vid.onplay = () => {
        if (centerBtn) centerBtn.style.opacity = "0";
        if (centerBtn) centerBtn.style.pointerEvents = "none";
        if (playBtn) playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
      };

      vid.onpause = () => {
        if (centerBtn) centerBtn.style.opacity = "1";
        if (centerBtn) centerBtn.style.pointerEvents = "auto";
        if (playBtn) playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
      };

      vid.onended = () => {
        if (centerBtn) centerBtn.style.opacity = "1";
        if (centerBtn) centerBtn.style.pointerEvents = "auto";
        if (playBtn) playBtn.innerHTML = '<i class="fa-solid fa-rotate-right"></i>';
      };

      // Click video toggles play
      vid.addEventListener("click", () => {
        Previewer.toggleVideoPlay();
      });

      // Double click toggles fullscreen
      vid.addEventListener("dblclick", () => {
        Previewer.toggleVideoFullscreen();
      });

      // Scrubber Seek
      if (progressWrap) {
        progressWrap.addEventListener("click", (e) => {
          const rect = progressWrap.getBoundingClientRect();
          const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          if (vid.duration) {
            vid.currentTime = pos * vid.duration;
          }
        });
      }

      // Auto play video when opened
      vid.play().catch(() => {});
    }
  },

  toggleVideoPlay() {
    const vid = this.activeVideo || document.getElementById("previewVideoPlayer");
    if (!vid) return;
    if (vid.paused || vid.ended) {
      vid.play();
    } else {
      vid.pause();
    }
  },

  seekVideo(seconds) {
    const vid = this.activeVideo || document.getElementById("previewVideoPlayer");
    if (vid) vid.currentTime = Math.max(0, Math.min(vid.duration || 0, vid.currentTime + seconds));
  },

  setVideoSpeed(speed, buttonEl) {
    const vid = this.activeVideo || document.getElementById("previewVideoPlayer");
    if (vid) {
      vid.playbackRate = speed;
      if (buttonEl) {
        const parent = buttonEl.parentElement;
        if (parent) {
          parent.querySelectorAll(".video-speed-pill").forEach(p => p.classList.remove("active"));
          buttonEl.classList.add("active");
        }
      }
    }
  },

  setVideoVolume(val) {
    const vid = this.activeVideo || document.getElementById("previewVideoPlayer");
    const volBtn = document.getElementById("videoVolumeBtn");
    if (vid) {
      vid.volume = parseFloat(val);
      vid.muted = (vid.volume === 0);
      if (volBtn) {
        if (vid.volume === 0) volBtn.innerHTML = '<i class="fa-solid fa-volume-xmark text-rose-400"></i>';
        else if (vid.volume < 0.5) volBtn.innerHTML = '<i class="fa-solid fa-volume-low"></i>';
        else volBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
      }
    }
  },

  toggleVideoMute() {
    const vid = this.activeVideo || document.getElementById("previewVideoPlayer");
    const slider = document.getElementById("videoVolumeSlider");
    const volBtn = document.getElementById("videoVolumeBtn");
    if (vid) {
      vid.muted = !vid.muted;
      if (vid.muted) {
        if (slider) slider.value = 0;
        if (volBtn) volBtn.innerHTML = '<i class="fa-solid fa-volume-xmark text-rose-400"></i>';
      } else {
        if (slider) slider.value = vid.volume || 1;
        if (volBtn) volBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
      }
    }
  },

  toggleVideoFullscreen() {
    const vp = document.getElementById("videoViewport");
    if (!vp) return;
    if (!document.fullscreenElement) {
      if (vp.requestFullscreen) vp.requestFullscreen();
      else if (vp.webkitRequestFullscreen) vp.webkitRequestFullscreen();
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
    }
  },

  renderAudio(item, rawUrl, container) {
    const sizeStr = item.formatted_size || "";
    const ext = (item.extension || "MP3").toUpperCase();

    // Generate 26 equalizer frequency bars with varying heights and animation delays
    let eqBarsHtml = "";
    for (let i = 0; i < 26; i++) {
      const delay = (i * 0.05).toFixed(2);
      const dur = (0.9 + (i % 5) * 0.15).toFixed(2);
      eqBarsHtml += `<div class="audio-eq-bar" style="animation-delay: ${delay}s; animation-duration: ${dur}s;"></div>`;
    }

    container.innerHTML = `
      <div class="audio-studio-card">
        <div class="audio-ambient-glow"></div>

        <!-- Disc Hero Artwork -->
        <div class="audio-disc-hero" id="audioDiscHero">
          <div class="audio-disc-center">
            <i class="fa-solid fa-music"></i>
          </div>
        </div>

        <!-- Audio Equalizer Spectrum Visualizer -->
        <div class="audio-eq-container" id="audioEqContainer">
          ${eqBarsHtml}
        </div>

        <!-- Track Title & Meta -->
        <h3 class="audio-track-title" title="${UI.escape(item.name)}">${UI.escape(item.name)}</h3>
        <div class="audio-track-meta">
          <span class="px-2 py-0.5 rounded bg-brand-500/20 text-brand-400 font-bold">${ext}</span>
          <span id="audioTrackDur">00:00</span>
          ${sizeStr ? `<span>•</span><span>${sizeStr}</span>` : ""}
        </div>

        <!-- Audio Seeker Scrubber -->
        <div class="audio-scrubber-wrap">
          <div class="audio-seeker" id="audioSeeker">
            <div class="audio-seeker-fill" id="audioSeekerFill"></div>
          </div>
          <div class="audio-time-row">
            <span id="audioCurrentTime">00:00</span>
            <span id="audioTotalTime">00:00</span>
          </div>
        </div>

        <!-- Transport Hero Buttons -->
        <div class="audio-hero-transport">
          <button class="audio-jump-btn" onclick="Previewer.seekAudio(-10)" title="${t("preview_jump_backward")}">
            <i class="fa-solid fa-rotate-left"></i>
          </button>
          <button class="audio-hero-play" id="audioPlayPauseBtn" onclick="Previewer.toggleAudioPlay()" title="${t("preview_play")}">
            <i class="fa-solid fa-play ml-0.5"></i>
          </button>
          <button class="audio-jump-btn" onclick="Previewer.seekAudio(10)" title="${t("preview_jump_forward")}">
            <i class="fa-solid fa-rotate-right"></i>
          </button>
        </div>

        <!-- Auxiliary Speed & Volume Row -->
        <div class="flex items-center justify-between w-full pt-3 border-t border-white/10 text-xs">
          <!-- Speed Selector -->
          <div class="flex items-center gap-1 bg-slate-900/60 p-0.5 rounded-lg border border-white/10">
            <button class="video-speed-pill" onclick="Previewer.setAudioSpeed(0.75, this)">0.75x</button>
            <button class="video-speed-pill active" onclick="Previewer.setAudioSpeed(1.0, this)">1x</button>
            <button class="video-speed-pill" onclick="Previewer.setAudioSpeed(1.25, this)">1.25x</button>
            <button class="video-speed-pill" onclick="Previewer.setAudioSpeed(1.5, this)">1.5x</button>
          </div>

          <!-- Volume Slider -->
          <div class="flex items-center gap-2">
            <button class="video-ctrl-btn text-xs" id="audioVolumeBtn" onclick="Previewer.toggleAudioMute()" title="${t("preview_volume")}">
              <i class="fa-solid fa-volume-high"></i>
            </button>
            <input type="range" id="audioVolumeSlider" class="video-volume-slider" min="0" max="1" step="0.05" value="1" oninput="Previewer.setAudioVolume(this.value)" />
          </div>
        </div>

        <!-- Hidden Native Audio Engine -->
        <audio id="previewAudioPlayer" preload="metadata">
          <source src="${rawUrl}">
          ${t("preview_audio_unsupported")}
        </audio>
      </div>
    `;

    const aud = document.getElementById("previewAudioPlayer");
    const metaEl = document.getElementById("previewFileMeta");
    const playBtn = document.getElementById("audioPlayPauseBtn");
    const disc = document.getElementById("audioDiscHero");
    const eqBars = container.querySelectorAll(".audio-eq-bar");
    const seeker = document.getElementById("audioSeeker");
    const seekerFill = document.getElementById("audioSeekerFill");
    const curTimeEl = document.getElementById("audioCurrentTime");
    const totTimeEl = document.getElementById("audioTotalTime");
    const trackDurEl = document.getElementById("audioTrackDur");

    this.activeAudio = aud;

    if (aud) {
      const formatTime = (seconds) => {
        if (!seconds || isNaN(seconds)) return "00:00";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
      };

      aud.onloadedmetadata = () => {
        const durStr = formatTime(aud.duration);
        if (totTimeEl) totTimeEl.textContent = durStr;
        if (trackDurEl) trackDurEl.textContent = durStr;
        if (metaEl) {
          metaEl.textContent = `${ext}${durStr ? " • " + durStr : ""}${sizeStr ? " • " + sizeStr : ""}`;
        }
      };

      aud.ontimeupdate = () => {
        if (curTimeEl) curTimeEl.textContent = formatTime(aud.currentTime);
        if (seekerFill && aud.duration) {
          const pct = (aud.currentTime / aud.duration) * 100;
          seekerFill.style.width = `${pct}%`;
        }
      };

      aud.onplay = () => {
        if (playBtn) playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
        if (disc) disc.classList.add("animate-spin-slow");
        eqBars.forEach(bar => bar.classList.add("animating"));
      };

      aud.onpause = () => {
        if (playBtn) playBtn.innerHTML = '<i class="fa-solid fa-play ml-0.5"></i>';
        if (disc) disc.classList.remove("animate-spin-slow");
        eqBars.forEach(bar => bar.classList.remove("animating"));
      };

      aud.onended = () => {
        if (playBtn) playBtn.innerHTML = '<i class="fa-solid fa-rotate-right"></i>';
        if (disc) disc.classList.remove("animate-spin-slow");
        eqBars.forEach(bar => bar.classList.remove("animating"));
      };

      // Seeker Scrubber
      if (seeker) {
        seeker.addEventListener("click", (e) => {
          const rect = seeker.getBoundingClientRect();
          const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          if (aud.duration) {
            aud.currentTime = pos * aud.duration;
          }
        });
      }

      // Auto play audio
      aud.play().catch(() => {});
    }
  },

  toggleAudioPlay() {
    const aud = this.activeAudio || document.getElementById("previewAudioPlayer");
    if (!aud) return;
    if (aud.paused || aud.ended) {
      aud.play();
    } else {
      aud.pause();
    }
  },

  seekAudio(seconds) {
    const aud = this.activeAudio || document.getElementById("previewAudioPlayer");
    if (aud) aud.currentTime = Math.max(0, Math.min(aud.duration || 0, aud.currentTime + seconds));
  },

  setAudioSpeed(speed, buttonEl) {
    const aud = this.activeAudio || document.getElementById("previewAudioPlayer");
    if (aud) {
      aud.playbackRate = speed;
      if (buttonEl) {
        const parent = buttonEl.parentElement;
        if (parent) {
          parent.querySelectorAll(".video-speed-pill").forEach(p => p.classList.remove("active"));
          buttonEl.classList.add("active");
        }
      }
    }
  },

  setAudioVolume(val) {
    const aud = this.activeAudio || document.getElementById("previewAudioPlayer");
    const volBtn = document.getElementById("audioVolumeBtn");
    if (aud) {
      aud.volume = parseFloat(val);
      aud.muted = (aud.volume === 0);
      if (volBtn) {
        if (aud.volume === 0) volBtn.innerHTML = '<i class="fa-solid fa-volume-xmark text-rose-400"></i>';
        else if (aud.volume < 0.5) volBtn.innerHTML = '<i class="fa-solid fa-volume-low"></i>';
        else volBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
      }
    }
  },

  toggleAudioMute() {
    const aud = this.activeAudio || document.getElementById("previewAudioPlayer");
    const slider = document.getElementById("audioVolumeSlider");
    const volBtn = document.getElementById("audioVolumeBtn");
    if (aud) {
      aud.muted = !aud.muted;
      if (aud.muted) {
        if (slider) slider.value = 0;
        if (volBtn) volBtn.innerHTML = '<i class="fa-solid fa-volume-xmark text-rose-400"></i>';
      } else {
        if (slider) slider.value = aud.volume || 1;
        if (volBtn) volBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
      }
    }
  },

  renderPdf(item, rawUrl, container) {
    container.innerHTML = `
      <div class="preview-doc-window" style="height: calc(100vh - 80px); width: 95%; max-width: 1200px;">
        <iframe src="${rawUrl}" style="width: 100%; height: 100%; border: none; background: #ffffff;"></iframe>
      </div>
    `;
  },

  renderCode(item, data, container) {
    const content = data.content || "";
    const lines = content.split("\n");
    const lineCount = lines.length;
    const sizeStr = UI.formatSize(content.length);

    let codeRows = "";
    lines.forEach((line, idx) => {
      codeRows += `<tr><td class="select-none text-right pr-3.5 text-slate-500 font-mono text-xs w-10 border-r border-slate-800/90 align-top">${idx + 1}</td><td class="pl-3.5 font-mono text-xs sm:text-sm text-slate-100 whitespace-pre align-top">${UI.escape(line)}</td></tr>`;
    });

    container.innerHTML = `
      <div class="preview-doc-window">
        <!-- Code Window Bar -->
        <div class="preview-doc-header">
          <div class="flex items-center gap-2.5">
            <span class="text-base">${UI.getIcon(item)}</span>
            <span class="text-xs font-mono font-bold text-slate-200">${UI.escape(item.name)}</span>
            <span class="text-[11px] font-mono text-slate-400">(${lineCount} dòng • ${sizeStr})</span>
          </div>
          <div class="flex items-center gap-2">
            <button id="btnCopyPreviewCode" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono rounded-lg transition flex items-center gap-1.5 border border-slate-700/60" title="${t("preview_copy_code")}">
              <i class="fa-solid fa-copy text-sky-400"></i>
              <span>${t("preview_copy_code")}</span>
            </button>
            <button class="px-3 py-1 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-lg transition flex items-center gap-1.5 shadow-sm" onclick="Previewer.closePreview(); Editor.openFile('${UI.inlineJsString(item.path)}')">
              <i class="fa-solid fa-pen-to-square"></i>
              <span>${t("preview_edit_code")}</span>
            </button>
          </div>
        </div>

        <!-- Code Content with Line Numbers -->
        <div class="preview-doc-body">
          <table class="border-collapse w-full">
            <tbody>
              ${codeRows}
            </tbody>
          </table>
        </div>
      </div>
    `;

    const copyBtn = document.getElementById("btnCopyPreviewCode");
    if (copyBtn) {
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(content).then(() => {
          UI.toast(t("preview_copied_toast"), "success");
        }).catch(() => {
          UI.toast(t("terminal_copy_failed"), "warning");
        });
      };
    }
  },

  safeMarkdownHtml(content) {
    const source = String(content ?? "");
    if (!window.marked || !window.DOMPurify) {
      return `<pre style="white-space: pre-wrap; font-family: sans-serif; line-height: 1.6;">${UI.escape(source)}</pre>`;
    }
    return window.DOMPurify.sanitize(window.marked.parse(source), { USE_PROFILES: { html: true } });
  },

  renderMarkdown(content, container) {
    container.innerHTML = `
      <div class="preview-doc-window" style="background: #ffffff; color: #0f172a;">
        <div class="preview-doc-header" style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; color: #0f172a;">
          <div class="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <i class="fa-brands fa-markdown text-blue-600"></i>
            <span>Markdown Preview</span>
          </div>
        </div>
        <div class="preview-doc-body" style="background: #ffffff;">
          <div class="preview-markdown">${this.safeMarkdownHtml(content)}</div>
        </div>
      </div>
    `;
  },

  async renderSpreadsheet(item, rawUrl, container) {
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center p-12 text-slate-300">
        <i class="fa-solid fa-circle-notch fa-spin text-emerald-400 text-3xl mb-3"></i>
        <span class="text-sm font-medium">${t("spreadsheet_loading")}</span>
      </div>
    `;

    try {
      const ext = (item.extension || "").toLowerCase();
      const isExcel = ["xlsx", "xls"].includes(ext);
      const isTsv = ext === "tsv";
      
      let sheets = {};
      let sheetNames = [];
      let parsedWb = null;
      let hasBom = false;

      // If SheetJS is loaded, use it to parse XLSX, XLS, CSV, TSV
      if (window.XLSX) {
        const resp = await fetch(rawUrl);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
        const arrayBuffer = await resp.arrayBuffer();
        const u8 = new Uint8Array(arrayBuffer);
        hasBom = u8.length >= 3 && u8[0] === 0xEF && u8[1] === 0xBB && u8[2] === 0xBF;
        parsedWb = XLSX.read(u8, {
          type: "array",
          cellDates: true,
          raw: false
        });
        sheetNames = parsedWb.SheetNames || [];
        sheetNames.forEach(sName => {
          const ws = parsedWb.Sheets[sName];
          const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
          // Filter out completely empty trailing rows
          let lastNonEmpty = -1;
          for (let i = data.length - 1; i >= 0; i--) {
            if (data[i] && data[i].some(c => c !== null && c !== undefined && String(c).trim() !== "")) {
              lastNonEmpty = i;
              break;
            }
          }
          sheets[sName] = lastNonEmpty >= 0 ? data.slice(0, lastNonEmpty + 1) : [];
        });
      } else {
        // Fallback for CSV/TSV if XLSX library is not available
        const resp = await fetch(rawUrl);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
        const text = await resp.text();
        hasBom = text.charCodeAt(0) === 0xFEFF;
        const delimiter = isTsv ? "\t" : ",";
        const rows = this.parseCSVFallback(text, delimiter);
        sheetNames = ["Sheet1"];
        sheets["Sheet1"] = rows;
      }

      if (!sheetNames.length) {
        sheetNames = ["Sheet1"];
        sheets["Sheet1"] = [["Cột 1"]];
      } else if (!sheets[sheetNames[0]] || sheets[sheetNames[0]].length === 0) {
        sheets[sheetNames[0]] = [["Cột 1"]];
      }

      this.spreadsheetState = {
        item: item,
        rawUrl: rawUrl,
        sheets: sheets,
        sheetNames: sheetNames,
        activeSheet: sheetNames[0],
        searchQuery: "",
        page: 1,
        pageSize: 100,
        workbook: parsedWb,
        hasBom: hasBom,
        isDirty: false,
        isSaving: false
      };

      this.renderSpreadsheetDOM(container);
    } catch (err) {
      container.innerHTML = `
        <div class="preview-doc-window" style="height: auto; max-width: 520px; margin: auto; padding: 32px; text-align: center;">
          <div style="font-size: 44px; margin-bottom: 16px; color: #f43f5e;">
            <i class="fa-solid fa-triangle-exclamation"></i>
          </div>
          <h3 class="font-bold text-white text-base mb-2">${UI.escape(item.name)}</h3>
          <p style="color: #fda4af; margin-bottom: 20px; font-family: monospace; font-size: 12px; word-break: break-all;">
            ${UI.escape(err.message)}
          </p>
          <button class="btn-primary" style="margin: 0 auto;" onclick="window.location.href='/api/files/download?path=${encodeURIComponent(item.path).replace(/'/g, "%27")}'">
            <i class="fa-solid fa-download"></i> ${t("preview_download_file")}
          </button>
        </div>
      `;
    }
  },

  parseCSVFallback(text, delimiter = ",") {
    if (!text) return [];
    if (text.charCodeAt(0) === 0xFEFF) {
      text = text.slice(1);
    }
    const rows = [];
    let currentRow = [];
    let currentVal = "";
    let insideQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];
      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          currentVal += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === delimiter && !insideQuotes) {
        currentRow.push(currentVal);
        currentVal = "";
      } else if ((char === '\r' || char === '\n') && !insideQuotes) {
        if (char === '\r' && nextChar === '\n') i++;
        currentRow.push(currentVal);
        if (currentRow.some(c => String(c).trim().length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentVal = "";
      } else {
        currentVal += char;
      }
    }
    if (currentVal || currentRow.length > 0) {
      currentRow.push(currentVal);
      if (currentRow.some(c => String(c).trim().length > 0)) {
        rows.push(currentRow);
      }
    }
    return rows;
  },

  renderSpreadsheetDOM(container) {
    const state = this.spreadsheetState;
    if (!state) return;

    let allRows = state.sheets[state.activeSheet];
    if (!allRows || !allRows.length) {
      allRows = [["Cột 1"]];
      state.sheets[state.activeSheet] = allRows;
    }

    const query = state.searchQuery.toLowerCase().trim();

    // Row 0 is the header row
    const headerRow = allRows[0] || [];
    // Data rows with their real index in allRows (1, 2, 3...)
    const indexedDataRows = [];
    for (let i = 1; i < allRows.length; i++) {
      indexedDataRows.push({ row: allRows[i], originalIndex: i });
    }

    // Calculate maximum columns in active sheet
    let maxCols = Math.max(1, headerRow.length);
    for (let i = 0; i < Math.min(indexedDataRows.length, 500); i++) {
      if (indexedDataRows[i].row && indexedDataRows[i].row.length > maxCols) {
        maxCols = indexedDataRows[i].row.length;
      }
    }

    // Filter rows based on search
    const filteredRows = query ? indexedDataRows.filter(item => {
      return item.row.some(cell => String(cell || "").toLowerCase().includes(query));
    }) : indexedDataRows;

    // Pagination
    const totalPages = Math.max(1, Math.ceil(filteredRows.length / state.pageSize));
    if (state.page > totalPages) state.page = totalPages;
    const startIdx = (state.page - 1) * state.pageSize;
    const endIdx = Math.min(startIdx + state.pageSize, filteredRows.length);
    const visibleRows = filteredRows.slice(startIdx, endIdx);

    // Build Sheet Tabs HTML
    let sheetTabsHtml = "";
    if (state.sheetNames.length > 1) {
      sheetTabsHtml = `
        <div class="spreadsheet-sheet-tabs">
          ${state.sheetNames.map(s => `
            <button class="sheet-tab-pill ${s === state.activeSheet ? 'active' : ''}" onclick="Previewer.switchSheet('${UI.escape(s).replace(/'/g, "\\'")}')">
              <i class="fa-solid fa-table-cells text-emerald-400"></i>
              <span>${UI.escape(s)}</span>
              <span class="text-[10px] opacity-60">(${state.sheets[s] ? state.sheets[s].length : 0})</span>
            </button>
          `).join("")}
        </div>
      `;
    }

    // Column letters helper (0 -> A, 1 -> B, 26 -> AA...)
    const getColLetter = (n) => this.getColLetter(n);

    container.innerHTML = `
      <div class="preview-spreadsheet-window">
        <!-- Floating Context Menu -->
        <div id="ssContextMenu" class="ss-context-menu hidden"></div>

        <!-- Spreadsheet Header Bar -->
        <div class="spreadsheet-header-bar">
          ${sheetTabsHtml}
          
          <div class="spreadsheet-tools">
            <div class="spreadsheet-search-wrap">
              <i class="fa-solid fa-magnifying-glass"></i>
              <input type="text" class="spreadsheet-search-input" id="ssSearchInput" 
                placeholder="${t("spreadsheet_search_placeholder")}" 
                value="${UI.escape(state.searchQuery)}"
                oninput="Previewer.handleSpreadsheetSearch(this.value)" />
            </div>

            <div class="spreadsheet-stats-badge">
              <i class="fa-solid fa-table-cells mr-1.5 text-emerald-400"></i>
              <span>${query ? `${filteredRows.length} / ` : ''}${(allRows.length - 1).toLocaleString()} ${t("spreadsheet_rows")}</span>
              <span class="mx-1.5 text-slate-600">•</span>
              <span>${maxCols} ${t("spreadsheet_cols")}</span>
            </div>

            <button class="spreadsheet-btn-action" title="${t("spreadsheet_copy_csv")}" onclick="Previewer.copySpreadsheetData()">
              <i class="fa-regular fa-copy text-emerald-400"></i>
              <span>${t("spreadsheet_copy_csv")}</span>
            </button>

            <button id="btnSaveSpreadsheet" class="spreadsheet-btn-save ${state.isDirty ? 'dirty' : ''}" title="${t("spreadsheet_save_btn")} (Ctrl+S)" onclick="Previewer.saveSpreadsheet()">
              <i class="fa-solid fa-floppy-disk mr-1"></i>
              <span>${t("spreadsheet_save_btn")}</span>
            </button>
          </div>
        </div>

        <!-- Spreadsheet Grid Container -->
        <div class="spreadsheet-table-container">
          <!-- Floating Seam Indicators -->
          <div id="ssRowSeam" class="ss-seam-line horizontal hidden">
            <button id="ssRowSeamBtn" class="ss-seam-btn" title="Chèn dòng vào đây (+)"><i class="fa-solid fa-plus"></i></button>
          </div>
          <div id="ssColSeam" class="ss-seam-line vertical hidden">
            <button id="ssColSeamBtn" class="ss-seam-btn" title="Chèn cột vào đây (+)"><i class="fa-solid fa-plus"></i></button>
          </div>

          <table class="spreadsheet-grid-table">
            <thead>
              <tr>
                <th class="col-index-th" title="Nhấp chuột phải hoặc rê chuột vào mép để chèn dòng/cột đầu tiên">
                  <span>#</span>
                  <div class="col-edge-adder" title="Chèn cột đầu tiên (+)" onclick="event.stopPropagation(); Previewer.insertSpreadsheetCol(0)">
                    <span class="edge-add-icon"><i class="fa-solid fa-plus"></i></span>
                  </div>
                  <div class="row-edge-adder" title="Chèn dòng đầu tiên (+)" onclick="event.stopPropagation(); Previewer.insertSpreadsheetRow(1)">
                    <span class="edge-add-icon"><i class="fa-solid fa-plus"></i></span>
                  </div>
                </th>
                ${Array.from({ length: maxCols }).map((_, colIdx) => {
                  const letter = getColLetter(colIdx);
                  const title = headerRow[colIdx] !== undefined && String(headerRow[colIdx]).trim() !== "" ? String(headerRow[colIdx]) : letter;
                  return `
                    <th title="Chuột phải để mở menu tùy chọn cột ${letter}" data-col="${colIdx}" oncontextmenu="Previewer.openColContextMenu(event, ${colIdx})">
                      <div class="flex items-center justify-between gap-1.5">
                        <span class="editable-header" contenteditable="true" spellcheck="false" 
                          title="Nhấp để sửa tiêu đề cột"
                          onblur="Previewer.onSpreadsheetHeaderChange(this, ${colIdx})" 
                          onkeydown="Previewer.onSpreadsheetCellKey(event, this)">${UI.escape(title)}</span>
                        <div class="col-action-wrap select-none">
                          <span class="col-letter-badge">${letter}</span>
                          ${maxCols > 1 ? `
                            <button class="col-del-btn" 
                              title="Xóa cột ${letter}" 
                              onclick="event.stopPropagation(); Previewer.deleteSpreadsheetCol(${colIdx})">
                              <i class="fa-solid fa-trash-can"></i>
                            </button>
                          ` : ''}
                        </div>
                      </div>
                      <div class="col-edge-adder" title="Chèn cột vào đây (+)" onclick="event.stopPropagation(); Previewer.insertSpreadsheetCol(${colIdx + 1})">
                        <span class="edge-add-icon"><i class="fa-solid fa-plus"></i></span>
                      </div>
                    </th>
                  `;
                }).join("")}
                <th class="col-append-th" title="Thêm cột vào cuối (+)" onclick="Previewer.addSpreadsheetCol()">
                  <div class="col-append-btn"><i class="fa-solid fa-plus"></i></div>
                </th>
              </tr>
            </thead>
            <tbody>
              ${visibleRows.map((item, rIdx) => {
                const actualRowNum = startIdx + rIdx + 1;
                return `
                  <tr>
                    <td class="row-num-cell" data-row="${item.originalIndex}" title="Xóa dòng ${actualRowNum} (hoặc chuột phải để xem menu)" oncontextmenu="Previewer.openRowContextMenu(event, ${item.originalIndex}, ${actualRowNum})">
                      <span class="row-num-text">${actualRowNum}</span>
                      <button class="row-del-btn" title="Xóa dòng ${actualRowNum}" onclick="event.stopPropagation(); Previewer.deleteSpreadsheetRow(${item.originalIndex})">
                        <i class="fa-solid fa-trash-can"></i>
                      </button>
                      <div class="row-edge-adder" title="Chèn dòng vào đây (+)" onclick="event.stopPropagation(); Previewer.insertSpreadsheetRow(${item.originalIndex + 1})">
                        <span class="edge-add-icon"><i class="fa-solid fa-plus"></i></span>
                      </div>
                    </td>
                    ${Array.from({ length: maxCols }).map((_, cIdx) => {
                      const val = item.row && item.row[cIdx] !== undefined ? String(item.row[cIdx]) : "";
                      const escapedVal = UI.escape(val);
                      return `
                        <td class="editable-cell" contenteditable="true" spellcheck="false" 
                          data-row="${item.originalIndex}" data-col="${cIdx}"
                          onblur="Previewer.onSpreadsheetCellChange(this, ${item.originalIndex}, ${cIdx})" 
                          onkeydown="Previewer.onSpreadsheetCellKey(event, this)">${escapedVal}</td>
                      `;
                    }).join("")}
                    <td style="border-bottom: 1px solid rgba(255,255,255,0.04); background: rgba(15,23,42,0.2);"></td>
                  </tr>
                `;
              }).join("")}
              <tr class="row-append-tr" onclick="Previewer.addSpreadsheetRow()">
                <td class="row-append-td" colspan="${maxCols + 2}">
                  <div class="row-append-btn">
                    <i class="fa-solid fa-plus text-emerald-400"></i>
                    <span>Thêm dòng mới vào cuối...</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Spreadsheet Footer Bar with Pagination -->
        <div class="spreadsheet-footer-bar">
          <div>
            ${filteredRows.length > 0 ? `
              <span>${t("spreadsheet_sheet")}: <b class="text-white">${UI.escape(state.activeSheet)}</b> • ${t("spreadsheet_rows")} <b>${(startIdx + 1).toLocaleString()}</b> - <b>${endIdx.toLocaleString()}</b> / <b>${filteredRows.length.toLocaleString()}</b></span>
            ` : `
              <span>Không tìm thấy dòng phù hợp với "${UI.escape(state.searchQuery)}"</span>
            `}
          </div>

          <div class="spreadsheet-pagination">
            <button class="ss-page-btn" title="Trang đầu" onclick="Previewer.setSpreadsheetPage(1)" ${state.page <= 1 ? 'disabled' : ''}>
              <i class="fa-solid fa-angles-left"></i>
            </button>
            <button class="ss-page-btn" title="Trang trước" onclick="Previewer.setSpreadsheetPage(${state.page - 1})" ${state.page <= 1 ? 'disabled' : ''}>
              <i class="fa-solid fa-angle-left"></i>
            </button>
            <span class="px-2 font-mono text-xs text-slate-300">${t("spreadsheet_page")} <b class="text-white">${state.page}</b> / ${totalPages}</span>
            <button class="ss-page-btn" title="Trang sau" onclick="Previewer.setSpreadsheetPage(${state.page + 1})" ${state.page >= totalPages ? 'disabled' : ''}>
              <i class="fa-solid fa-angle-right"></i>
            </button>
            <button class="ss-page-btn" title="Trang cuối" onclick="Previewer.setSpreadsheetPage(${totalPages})" ${state.page >= totalPages ? 'disabled' : ''}>
              <i class="fa-solid fa-angles-right"></i>
            </button>
          </div>
        </div>
      </div>
    `;

    // Keep search input focused if user was typing
    const searchEl = document.getElementById("ssSearchInput");
    if (searchEl && query) {
      searchEl.focus();
      searchEl.setSelectionRange(searchEl.value.length, searchEl.value.length);
    }

    // Initialize Excel-style edge hover listeners
    this.initSpreadsheetEdgeHover(container);

    // Global listener to dismiss context menu
    if (!this._ctxMenuBound) {
      document.addEventListener("click", (e) => {
        if (!e.target.closest("#ssContextMenu") && !e.target.closest(".col-menu-btn")) {
          Previewer.closeSsContextMenu();
        }
      });
      window.addEventListener("resize", () => Previewer.closeSsContextMenu());
      this._ctxMenuBound = true;
    }
  },

  onSpreadsheetCellChange(el, realRowIdx, colIdx) {
    if (!this.spreadsheetState) return;
    const state = this.spreadsheetState;
    const allRows = state.sheets[state.activeSheet];
    if (!allRows) return;
    if (!allRows[realRowIdx]) allRows[realRowIdx] = [];

    const newVal = el.innerText.trim();
    const oldVal = String(allRows[realRowIdx][colIdx] || "");
    if (newVal !== oldVal) {
      while (allRows[realRowIdx].length <= colIdx) {
        allRows[realRowIdx].push("");
      }
      allRows[realRowIdx][colIdx] = newVal;
      this.markSpreadsheetDirty();
    }
  },

  onSpreadsheetHeaderChange(el, colIdx) {
    if (!this.spreadsheetState) return;
    const state = this.spreadsheetState;
    const allRows = state.sheets[state.activeSheet];
    if (!allRows || !allRows[0]) return;

    const newVal = el.innerText.trim();
    const oldVal = String(allRows[0][colIdx] || "");
    if (newVal !== oldVal) {
      while (allRows[0].length <= colIdx) {
        allRows[0].push("");
      }
      allRows[0][colIdx] = newVal;
      this.markSpreadsheetDirty();
    }
  },

  onSpreadsheetCellKey(e, el) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      el.blur();
      this.saveSpreadsheet();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      el.blur();
    }
  },

  markSpreadsheetDirty() {
    if (!this.spreadsheetState) return;
    this.spreadsheetState.isDirty = true;
    const saveBtn = document.getElementById("btnSaveSpreadsheet");
    if (saveBtn && !saveBtn.classList.contains("dirty")) {
      saveBtn.classList.add("dirty");
    }
  },

  insertSpreadsheetRow(atIndex) {
    if (!this.spreadsheetState) return;
    const state = this.spreadsheetState;
    const allRows = state.sheets[state.activeSheet] || [];
    let maxCols = allRows[0] ? allRows[0].length : 1;
    for (let i = 0; i < Math.min(allRows.length, 100); i++) {
      if (allRows[i] && allRows[i].length > maxCols) maxCols = allRows[i].length;
    }
    const newRow = new Array(maxCols).fill("");

    const insertPos = Math.max(1, Math.min(atIndex, allRows.length));
    allRows.splice(insertPos, 0, newRow);
    state.sheets[state.activeSheet] = allRows;
    this.markSpreadsheetDirty();

    // Navigate to page containing the new row
    const targetPage = Math.max(1, Math.ceil(insertPos / state.pageSize));
    state.page = targetPage;

    const container = document.getElementById("previewContainer");
    if (container) this.renderSpreadsheetDOM(container);
  },

  insertSpreadsheetCol(atIndex) {
    if (!this.spreadsheetState) return;
    const state = this.spreadsheetState;
    const allRows = state.sheets[state.activeSheet] || [];
    if (!allRows.length) allRows.push(["Cột 1"]);

    const newColNum = (allRows[0] ? allRows[0].length : 0) + 1;
    const insertPos = Math.max(0, Math.min(atIndex, allRows[0].length));

    for (let i = 0; i < allRows.length; i++) {
      if (!allRows[i]) allRows[i] = [];
      while (allRows[i].length < insertPos) {
        allRows[i].push("");
      }
      if (i === 0) {
        allRows[i].splice(insertPos, 0, `Cột ${newColNum}`);
      } else {
        allRows[i].splice(insertPos, 0, "");
      }
    }
    this.markSpreadsheetDirty();

    const container = document.getElementById("previewContainer");
    if (container) this.renderSpreadsheetDOM(container);
  },

  addSpreadsheetRow() {
    if (!this.spreadsheetState) return;
    const state = this.spreadsheetState;
    const allRows = state.sheets[state.activeSheet] || [];
    this.insertSpreadsheetRow(allRows.length);
  },

  addSpreadsheetCol() {
    if (!this.spreadsheetState) return;
    const state = this.spreadsheetState;
    const allRows = state.sheets[state.activeSheet] || [];
    this.insertSpreadsheetCol(allRows[0] ? allRows[0].length : 1);
  },

  initSpreadsheetEdgeHover(container) {
    const table = container.querySelector(".spreadsheet-grid-table");
    const hSeam = document.getElementById("ssRowSeam");
    const vSeam = document.getElementById("ssColSeam");
    const hBtn = document.getElementById("ssRowSeamBtn");
    const vBtn = document.getElementById("ssColSeamBtn");
    const tableBox = container.querySelector(".spreadsheet-table-container");
    if (!table || !hSeam || !vSeam || !tableBox) return;

    let targetRowInsertIdx = null;
    let targetColInsertIdx = null;

    table.onmousemove = (e) => {
      const cell = e.target.closest("td, th");
      if (!cell || cell.classList.contains("col-append-th") || cell.classList.contains("row-append-td")) {
        hSeam.classList.add("hidden");
        vSeam.classList.add("hidden");
        return;
      }

      const rect = cell.getBoundingClientRect();
      const boxRect = tableBox.getBoundingClientRect();
      const edgeThreshold = 8;

      const distBottom = Math.abs(rect.bottom - e.clientY);
      const distRight = Math.abs(rect.right - e.clientX);

      // Bottom edge detection (Row insert)
      if (distBottom <= edgeThreshold && e.clientY >= rect.top + 6) {
        const rowAttr = cell.getAttribute("data-row");
        const row = cell.closest("tr");
        const rowNumCell = row ? row.querySelector(".row-num-cell") : null;
        const actualRowIdx = rowAttr ? parseInt(rowAttr, 10) : (rowNumCell ? parseInt(rowNumCell.getAttribute("data-row"), 10) : null);

        if (actualRowIdx !== null && !isNaN(actualRowIdx)) {
          targetRowInsertIdx = actualRowIdx + 1;
          const topPos = rect.bottom - boxRect.top + tableBox.scrollTop;
          hSeam.style.top = `${topPos}px`;
          hSeam.style.width = `${table.offsetWidth}px`;
          hBtn.style.left = `${Math.max(28, e.clientX - boxRect.left + tableBox.scrollLeft)}px`;
          hBtn.style.top = `0px`;
          hSeam.classList.remove("hidden");
        } else if (cell.tagName === "TH") {
          targetRowInsertIdx = 1;
          const topPos = rect.bottom - boxRect.top + tableBox.scrollTop;
          hSeam.style.top = `${topPos}px`;
          hSeam.style.width = `${table.offsetWidth}px`;
          hBtn.style.left = `${Math.max(28, e.clientX - boxRect.left + tableBox.scrollLeft)}px`;
          hBtn.style.top = `0px`;
          hSeam.classList.remove("hidden");
        }
      } else {
        hSeam.classList.add("hidden");
      }

      // Right edge detection (Column insert)
      if (distRight <= edgeThreshold && e.clientX >= rect.left + 6) {
        const colAttr = cell.getAttribute("data-col");
        if (colAttr !== null && !isNaN(parseInt(colAttr, 10))) {
          const colIdx = parseInt(colAttr, 10);
          targetColInsertIdx = colIdx + 1;
          const leftPos = rect.right - boxRect.left + tableBox.scrollLeft;
          vSeam.style.left = `${leftPos}px`;
          vSeam.style.height = `${table.offsetHeight}px`;
          vBtn.style.top = `${Math.max(20, e.clientY - boxRect.top + tableBox.scrollTop)}px`;
          vBtn.style.left = `0px`;
          vSeam.classList.remove("hidden");
        } else if (cell.classList.contains("col-index-th") || cell.classList.contains("row-num-cell")) {
          targetColInsertIdx = 0;
          const leftPos = rect.right - boxRect.left + tableBox.scrollLeft;
          vSeam.style.left = `${leftPos}px`;
          vSeam.style.height = `${table.offsetHeight}px`;
          vBtn.style.top = `${Math.max(20, e.clientY - boxRect.top + tableBox.scrollTop)}px`;
          vBtn.style.left = `0px`;
          vSeam.classList.remove("hidden");
        }
      } else {
        vSeam.classList.add("hidden");
      }
    };

    tableBox.onmouseleave = () => {
      hSeam.classList.add("hidden");
      vSeam.classList.add("hidden");
    };

    if (hBtn) {
      hBtn.onclick = (e) => {
        e.stopPropagation();
        hSeam.classList.add("hidden");
        if (targetRowInsertIdx !== null) {
          Previewer.insertSpreadsheetRow(targetRowInsertIdx);
        }
      };
    }

    if (vBtn) {
      vBtn.onclick = (e) => {
        e.stopPropagation();
        vSeam.classList.add("hidden");
        if (targetColInsertIdx !== null) {
          Previewer.insertSpreadsheetCol(targetColInsertIdx);
        }
      };
    }
  },

  deleteSpreadsheetRow(realRowIdx) {
    if (!this.spreadsheetState) return;
    const state = this.spreadsheetState;
    const allRows = state.sheets[state.activeSheet] || [];
    if (realRowIdx <= 0 || realRowIdx >= allRows.length) return;
    allRows.splice(realRowIdx, 1);
    this.markSpreadsheetDirty();
    const container = document.getElementById("previewContainer");
    if (container) this.renderSpreadsheetDOM(container);
  },

  deleteSpreadsheetCol(colIdx) {
    if (!this.spreadsheetState) return;
    const state = this.spreadsheetState;
    const allRows = state.sheets[state.activeSheet] || [];
    if (!allRows.length || allRows[0].length <= 1) {
      UI.toast("Không thể xóa cột cuối cùng của bảng tính.", "warning");
      return;
    }
    for (let i = 0; i < allRows.length; i++) {
      if (allRows[i] && allRows[i].length > colIdx) {
        allRows[i].splice(colIdx, 1);
      }
    }
    this.markSpreadsheetDirty();
    const container = document.getElementById("previewContainer");
    if (container) this.renderSpreadsheetDOM(container);
  },

  rowsToCSV(rows, delimiter = ",", withBom = false) {
    if (!rows || !rows.length) return "";
    let maxCols = rows[0] ? rows[0].length : 0;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i] && rows[i].length > maxCols) maxCols = rows[i].length;
    }
    const lines = rows.map(row => {
      const r = row || [];
      const cells = [];
      for (let c = 0; c < maxCols; c++) {
        const cell = r[c];
        const str = cell === null || cell === undefined ? "" : String(cell);
        if (str.includes(delimiter) || str.includes('"') || str.includes("\n") || str.includes("\r")) {
          cells.push(`"${str.replace(/"/g, '""')}"`);
        } else {
          cells.push(str);
        }
      }
      return cells.join(delimiter);
    });
    const prefix = withBom ? "\uFEFF" : "";
    return prefix + lines.join("\r\n");
  },

  async saveSpreadsheet() {
    if (!this.spreadsheetState || this.spreadsheetState.isSaving) return;
    const state = this.spreadsheetState;

    // 1. Force commit any cell or header currently being edited
    if (document.activeElement && document.activeElement.isContentEditable) {
      const el = document.activeElement;
      if (el.classList.contains("editable-cell")) {
        const r = parseInt(el.getAttribute("data-row"), 10);
        const c = parseInt(el.getAttribute("data-col"), 10);
        if (!isNaN(r) && !isNaN(c)) {
          this.onSpreadsheetCellChange(el, r, c);
        }
      } else if (el.classList.contains("editable-header")) {
        const c = parseInt(el.closest("th")?.getAttribute("data-col"), 10);
        if (!isNaN(c)) {
          this.onSpreadsheetHeaderChange(el, c);
        }
      }
      el.blur();
    }

    state.isSaving = true;
    const saveBtn = document.getElementById("btnSaveSpreadsheet");
    if (saveBtn) {
      saveBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin mr-1"></i><span>${t("spreadsheet_saving")}</span>`;
    }

    try {
      const ext = (state.item.extension || "").toLowerCase();
      const isExcel = ["xlsx", "xls", "xlsb", "xlsm"].includes(ext);
      const isTsv = ext === "tsv";

      if (isExcel) {
        if (!window.XLSX) {
          throw new Error("Thư viện SheetJS chưa được tải.");
        }
        let wb = state.workbook || XLSX.utils.book_new();
        // Update all sheets
        for (const sName of state.sheetNames) {
          const sheetData = state.sheets[sName] || [];
          const oldWs = wb.Sheets ? wb.Sheets[sName] : null;
          const ws = XLSX.utils.aoa_to_sheet(sheetData);
          if (oldWs && oldWs["!cols"]) ws["!cols"] = oldWs["!cols"];
          if (oldWs && oldWs["!rows"]) ws["!rows"] = oldWs["!rows"];
          if (!wb.Sheets) wb.Sheets = {};
          wb.Sheets[sName] = ws;
          if (!wb.SheetNames) wb.SheetNames = [];
          if (!wb.SheetNames.includes(sName)) {
            wb.SheetNames.push(sName);
          }
        }
        let bookType = "xlsx";
        if (ext === "xls") bookType = "biff8";
        else if (ext === "xlsb") bookType = "xlsb";
        else if (ext === "xlsm") bookType = "xlsm";

        let b64;
        try {
          b64 = XLSX.write(wb, { bookType: bookType, type: "base64" });
        } catch (_) {
          b64 = XLSX.write(wb, { bookType: "xlsx", type: "base64" });
        }
        await API.saveBinaryFile(state.item.path, b64);
      } else {
        const delimiter = isTsv ? "\t" : ",";
        const rows = state.sheets[state.activeSheet] || [];
        const csvContent = this.rowsToCSV(rows, delimiter, state.hasBom);
        await API.saveFileContent(state.item.path, csvContent);
      }

      state.isDirty = false;
      UI.toast(t("spreadsheet_saved_toast"), "success");
      if (typeof App !== "undefined" && App.refreshSystemStats) {
        App.loadDirectory(AppState.currentPath, false);
      }
    } catch (err) {
      UI.toast(`${t("error")}: ${err.message}`, "error");
    } finally {
      state.isSaving = false;
      if (saveBtn) {
        saveBtn.className = `spreadsheet-btn-save ${state.isDirty ? 'dirty' : ''}`;
        saveBtn.innerHTML = `<i class="fa-solid fa-floppy-disk mr-1"></i><span>${t("spreadsheet_save_btn")}</span>`;
      }
    }
  },

  switchSheet(sheetName) {
    if (!this.spreadsheetState || !this.spreadsheetState.sheets[sheetName]) return;
    this.spreadsheetState.activeSheet = sheetName;
    this.spreadsheetState.searchQuery = "";
    this.spreadsheetState.page = 1;
    const container = document.getElementById("previewContainer");
    if (container) this.renderSpreadsheetDOM(container);
  },

  handleSpreadsheetSearch(query) {
    if (!this.spreadsheetState) return;
    this.spreadsheetState.searchQuery = query;
    this.spreadsheetState.page = 1;
    const container = document.getElementById("previewContainer");
    if (container) this.renderSpreadsheetDOM(container);
  },

  setSpreadsheetPage(page) {
    if (!this.spreadsheetState) return;
    this.spreadsheetState.page = page;
    const container = document.getElementById("previewContainer");
    if (container) this.renderSpreadsheetDOM(container);
  },

  copySpreadsheetData() {
    if (!this.spreadsheetState) return;
    const state = this.spreadsheetState;
    const rows = state.sheets[state.activeSheet] || [];
    if (!rows.length) return;

    // Convert to TSV (easy paste into Excel / Sheets)
    const tsv = rows.slice(0, 1000).map(row => {
      return (row || []).map(cell => {
        const str = String(cell || "");
        if (str.includes("\t") || str.includes("\n") || str.includes('"')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join("\t");
    }).join("\n");

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(tsv).then(() => {
        UI.toast(t("spreadsheet_copied_toast"), "success");
      }).catch(() => {
        UI.toast("Copy failed", "error");
      });
    }
  },

  getColLetter(n) {
    let s = "";
    while (n >= 0) {
      s = String.fromCharCode((n % 26) + 65) + s;
      n = Math.floor(n / 26) - 1;
    }
    return s;
  },

  openColContextMenu(e, colIdx) {
    e.preventDefault();
    e.stopPropagation();
    const state = this.spreadsheetState;
    if (!state) return;
    const allRows = state.sheets[state.activeSheet] || [];
    const headerRow = allRows[0] || [];
    const colName = headerRow[colIdx] !== undefined && String(headerRow[colIdx]).trim() !== "" ? String(headerRow[colIdx]) : `Cột ${colIdx + 1}`;
    const letter = this.getColLetter(colIdx);
    const maxCols = headerRow.length;

    const menu = document.getElementById("ssContextMenu");
    if (!menu) return;

    menu.innerHTML = `
      <div class="ss-ctx-header">
        <i class="fa-solid fa-table-columns text-emerald-400"></i>
        <span>Cột ${letter} (${UI.escape(colName)})</span>
      </div>
      <button class="ss-ctx-item" onclick="Previewer.closeSsContextMenu(); Previewer.insertSpreadsheetCol(${colIdx})">
        <i class="fa-solid fa-arrow-left text-sky-400"></i>
        <span>Chèn cột sang trái</span>
      </button>
      <button class="ss-ctx-item" onclick="Previewer.closeSsContextMenu(); Previewer.insertSpreadsheetCol(${colIdx + 1})">
        <i class="fa-solid fa-arrow-right text-sky-400"></i>
        <span>Chèn cột sang phải</span>
      </button>
      <button class="ss-ctx-item" onclick="Previewer.closeSsContextMenu(); Previewer.copySpreadsheetCol(${colIdx})">
        <i class="fa-regular fa-copy text-amber-400"></i>
        <span>Sao chép dữ liệu cột</span>
      </button>
      ${maxCols > 1 ? `
        <div class="ss-ctx-divider"></div>
        <button class="ss-ctx-item text-rose-400 hover:bg-rose-500/20" onclick="Previewer.closeSsContextMenu(); Previewer.deleteSpreadsheetCol(${colIdx})">
          <i class="fa-solid fa-trash-can text-rose-400"></i>
          <span>Xóa cột này</span>
        </button>
      ` : ''}
    `;

    this.positionContextMenu(menu, e.clientX, e.clientY);
  },

  openRowContextMenu(e, originalIndex, actualRowNum) {
    e.preventDefault();
    e.stopPropagation();
    const state = this.spreadsheetState;
    if (!state) return;
    const menu = document.getElementById("ssContextMenu");
    if (!menu) return;

    menu.innerHTML = `
      <div class="ss-ctx-header">
        <i class="fa-solid fa-bars text-emerald-400"></i>
        <span>Dòng ${actualRowNum}</span>
      </div>
      <button class="ss-ctx-item" onclick="Previewer.closeSsContextMenu(); Previewer.insertSpreadsheetRow(${originalIndex})">
        <i class="fa-solid fa-arrow-up text-sky-400"></i>
        <span>Chèn dòng lên trên</span>
      </button>
      <button class="ss-ctx-item" onclick="Previewer.closeSsContextMenu(); Previewer.insertSpreadsheetRow(${originalIndex + 1})">
        <i class="fa-solid fa-arrow-down text-sky-400"></i>
        <span>Chèn dòng xuống dưới</span>
      </button>
      <button class="ss-ctx-item" onclick="Previewer.closeSsContextMenu(); Previewer.copySpreadsheetRow(${originalIndex})">
        <i class="fa-regular fa-copy text-amber-400"></i>
        <span>Sao chép dòng</span>
      </button>
      <div class="ss-ctx-divider"></div>
      <button class="ss-ctx-item text-rose-400 hover:bg-rose-500/20" onclick="Previewer.closeSsContextMenu(); Previewer.deleteSpreadsheetRow(${originalIndex})">
        <i class="fa-solid fa-trash-can text-rose-400"></i>
        <span>Xóa dòng này</span>
      </button>
    `;

    this.positionContextMenu(menu, e.clientX, e.clientY);
  },

  closeSsContextMenu() {
    const menu = document.getElementById("ssContextMenu");
    if (menu) menu.classList.add("hidden");
  },

  positionContextMenu(menu, x, y) {
    menu.classList.remove("hidden");
    const menuWidth = 210;
    const menuHeight = 220;
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;

    let posX = x;
    let posY = y;
    if (posX + menuWidth > winWidth - 10) posX = Math.max(10, winWidth - menuWidth - 10);
    if (posY + menuHeight > winHeight - 10) posY = Math.max(10, winHeight - menuHeight - 10);

    menu.style.left = `${posX}px`;
    menu.style.top = `${posY}px`;
  },

  copySpreadsheetCol(colIdx) {
    if (!this.spreadsheetState) return;
    const state = this.spreadsheetState;
    const allRows = state.sheets[state.activeSheet] || [];
    const colValues = allRows.map(row => (row && row[colIdx] !== undefined ? String(row[colIdx]) : ""));
    const text = colValues.join("\r\n");
    navigator.clipboard.writeText(text).then(() => {
      UI.toast("Đã sao chép dữ liệu cột vào bộ nhớ tạm.", "success");
    }).catch(() => {
      UI.toast("Không thể sao chép dữ liệu.", "warning");
    });
  },

  copySpreadsheetRow(originalIndex) {
    if (!this.spreadsheetState) return;
    const state = this.spreadsheetState;
    const allRows = state.sheets[state.activeSheet] || [];
    const row = allRows[originalIndex] || [];
    const text = row.map(c => (c === null || c === undefined ? "" : String(c))).join("\t");
    navigator.clipboard.writeText(text).then(() => {
      UI.toast("Đã sao chép dòng vào bộ nhớ tạm.", "success");
    }).catch(() => {
      UI.toast("Không thể sao chép dữ liệu.", "warning");
    });
  },

  renderNotebook(jsonStr, container) {
    try {
      const nb = JSON.parse(jsonStr);
      const cells = nb.cells || [];
      let cellsHtml = '';

      cells.forEach((cell, idx) => {
        const source = Array.isArray(cell.source) ? cell.source.join("") : cell.source || "";
        if (cell.cell_type === "markdown") {
          cellsHtml += `<div style="margin-bottom: 16px; padding: 14px; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; color: #0f172a;">${this.safeMarkdownHtml(source)}</div>`;
        } else if (cell.cell_type === "code") {
          cellsHtml += `
            <div style="margin-bottom: 16px; border-radius: 12px; overflow: hidden; border: 1px solid #334155;">
              <div style="background: #0f172a; color: #a5f3fc; padding: 12px; font-family: monospace; font-size: 13px; line-height: 1.5; white-space: pre-wrap;">
                <span style="color: #64748b; font-size: 11px; margin-right: 8px;">[${UI.escape(cell.execution_count ?? " ")}]:</span>${UI.escape(source)}
              </div>
          `;
          if (cell.outputs && cell.outputs.length > 0) {
            cellsHtml += '<div style="background: #f8fafc; padding: 10px 14px; border-top: 1px solid #e2e8f0; font-family: monospace; font-size: 12px; color: #334155; max-height: 200px; overflow-y: auto;">';
            cell.outputs.forEach(out => {
              if (out.text) {
                const text = Array.isArray(out.text) ? out.text.join("") : out.text;
                cellsHtml += `<pre style="white-space: pre-wrap; margin: 0;">${UI.escape(text)}</pre>`;
              }
            });
            cellsHtml += '</div>';
          }
          cellsHtml += '</div>';
        }
      });

      container.innerHTML = `
        <div class="preview-doc-window">
          <div class="preview-doc-header">
            <div class="flex items-center gap-2 text-xs font-mono font-semibold text-slate-200">
              <i class="fa-solid fa-book-bookmark text-amber-400"></i>
              <span>Jupyter Notebook (${cells.length} cells)</span>
            </div>
          </div>
          <div class="preview-doc-body">
            ${cellsHtml}
          </div>
        </div>
      `;
    } catch (e) {
      container.innerHTML = `<div class="preview-doc-window p-8 text-center text-rose-400">${t("preview_notebook_error", { msg: UI.escape(e.message) })}</div>`;
    }
  }
};

const Preview = Previewer;
window.Preview = Previewer;
window.Previewer = Previewer;
