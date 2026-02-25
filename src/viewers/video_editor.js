/**
 * video_editor.js - Video Editor for Dave
 * Bottom toolbar, timeline, trim, filters, crop, concat, export.
 * Mirrors ImageViewer architecture with sub-module orchestration.
 */

class VideoEditor {
  constructor() {
    // State
    this.model = null;
    this.videoEl = null;
    this.fileUrl = null;
    this.isOpen = false;
    this.autoHideTimer = null;
    this.chromeVisible = true;
    this._rafId = null;

    // Playback state
    this._loop = true;

    // Edit state
    this.trimIn = 0;
    this.trimOut = 0; // set to duration on open
    this.filters = {
      brightness: 100,
      contrast: 100,
      saturate: 100,
      hueRotate: 0,
      blur: 0,
      sepia: 0
    };
    this.cropRect = null; // { x, y, w, h } normalized 0-1, or null
    this.concatBefore = null;
    this.concatAfter = null;

    // Panel state
    this._filterPanelOpen = false;
    this._exportPanelOpen = false;
    this._concatPanelOpen = false;
    this._cropActive = false;

    // Sub-modules (lazy loaded)
    this._timelineModule = null;
    this._filterModule = null;
    this._cropModule = null;
    this._exportModule = null;
    this._concatModule = null;

    // DOM refs
    this.overlay = null;
    this.viewer = null;
    this.toolbar = null;

    // Bound handlers
    this._onKeyDown = this._handleKeyDown.bind(this);
    this._onMouseActivity = this._handleMouseActivity.bind(this);
  }

  // ===========================================================
  //  OPEN / CLOSE
  // ===========================================================

  async open(model, fileUrl) {
    this.model = model;
    this.fileUrl = fileUrl;
    this.isOpen = true;

    // Reset edit state
    this.trimIn = 0;
    this.trimOut = 0;
    this.filters = { brightness: 100, contrast: 100, saturate: 100, hueRotate: 0, blur: 0, sepia: 0 };
    this.cropRect = null;
    this.concatBefore = null;
    this.concatAfter = null;
    this._loop = true;

    // DOM refs
    this.overlay = document.getElementById('fullscreenOverlay');
    this.viewer = document.getElementById('fullscreenViewer');

    // Add ve-fullscreen class to hide old UI
    this.overlay.classList.add('ve-fullscreen');

    // Create video element inside viewer (NOT the old #fullscreenVideo)
    this.viewer.innerHTML = '';
    this.videoEl = document.createElement('video');
    this.videoEl.src = fileUrl;
    this.videoEl.playsInline = true;
    this.videoEl.preload = 'auto';
    this.viewer.appendChild(this.videoEl);

    // Click-to-pause on video
    this.videoEl.addEventListener('click', () => this.togglePlay());

    // Handle video ended event for loop support
    this.videoEl.addEventListener('ended', () => this._onVideoEnded());

    // Wait for metadata
    await this._waitForMetadata();
    this.trimOut = this.videoEl.duration || 0;

    // Create toolbar
    if (!this.toolbar) {
      this._createToolbar();
    }
    this.toolbar.style.display = 'flex';
    this._updateFileInfo();

    // Create timeline
    await this._initTimeline();

    // Bind events
    this._bindEvents();

    // Start playback
    this.videoEl.play().catch(() => {});

    // Start playhead update loop
    this._startPlayheadLoop();

    // Show chrome + auto-hide
    this._showChrome();
    this._startAutoHideTimer();

    // Dispatch event
    document.dispatchEvent(new CustomEvent('dave:videoEditor', {
      detail: { action: 'open', filename: model.name }
    }));
  }

  /**
   * Request close with dirty-state confirmation if needed.
   * Returns true if close proceeded, false if user cancelled.
   */
  async requestClose() {
    if (this.isDirty()) {
      const confirmed = await this._showConfirmDialog(
        'You have unsaved edits. Close without exporting?'
      );
      if (!confirmed) return false;
    }
    this.close();
    return true;
  }

  close() {
    if (!this.isOpen) return;
    const filename = this.model?.name;
    this.isOpen = false;

    // Stop playback
    if (this.videoEl) {
      this.videoEl.pause();
      this.videoEl.src = '';
    }

    // Stop RAF loop
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }

    // Close all panels
    this._closeAllPanels();

    // Deactivate crop
    if (this._cropActive) this._deactivateCrop();

    // Remove class
    if (this.overlay) {
      this.overlay.classList.remove('ve-fullscreen');
    }

    // Hide toolbar
    if (this.toolbar) this.toolbar.style.display = 'none';

    // Hide timeline
    if (this._timelineModule) this._timelineModule.hide();

    // Unbind events
    this._unbindEvents();

    // Clear auto-hide
    clearTimeout(this.autoHideTimer);

    // Clear refs
    this.videoEl = null;
    this.model = null;

    // Dispatch event
    document.dispatchEvent(new CustomEvent('dave:videoEditor', {
      detail: { action: 'close', filename }
    }));
  }

  // ===========================================================
  //  TOOLBAR
  // ===========================================================

  _createToolbar() {
    this.toolbar = document.createElement('div');
    this.toolbar.className = 've-toolbar';
    this.toolbar.innerHTML = `
      <div class="ve-toolbar-left">
        <span class="ve-filename"></span>
        <span class="ve-time-display"></span>
      </div>
      <div class="ve-toolbar-center">
        <button class="ve-btn ve-tool-play" title="Play/Pause (Space)">
          <i class="fa fa-play"></i>
        </button>
        <button class="ve-btn ve-tool-loop ve-active" title="Loop (O)">
          <i class="fa fa-repeat"></i>
        </button>

        <div class="ve-volume-group">
          <button class="ve-btn ve-tool-mute" title="Mute/Unmute (M)">
            <i class="fa fa-volume-high"></i>
          </button>
          <div class="ve-volume-slider-wrap">
            <input type="range" class="ve-volume-slider" min="0" max="100" value="100" step="1">
          </div>
        </div>

        <div class="ve-divider"></div>

        <button class="ve-btn ve-tool-trim-in" title="Set trim in ([)">
          <span class="ve-trim-icon">[</span>
        </button>
        <button class="ve-btn ve-tool-trim-out" title="Set trim out (])">
          <span class="ve-trim-icon">]</span>
        </button>

        <div class="ve-divider"></div>

        <button class="ve-btn ve-tool-filters" title="Filters (F)">
          <i class="fa fa-sliders"></i>
        </button>
        <button class="ve-btn ve-tool-crop" title="Crop (C)">
          <i class="fa fa-crop-simple"></i>
        </button>
        <button class="ve-btn ve-tool-concat" title="Concat (+)">
          <i class="fa fa-plus"></i>
        </button>
        <button class="ve-btn ve-tool-export" title="Export (E)">
          <i class="fa fa-download"></i>
        </button>
      </div>
      <div class="ve-toolbar-right">
        <button class="ve-btn ve-tool-reset" title="Reset all edits (R)">
          <i class="fa fa-rotate-left"></i>
        </button>
        <button class="ve-btn ve-close" title="Close (Escape)">
          <i class="fa fa-xmark"></i>
        </button>
      </div>
    `;

    this.overlay.appendChild(this.toolbar);
    this._bindToolbarEvents();
  }

  _bindToolbarEvents() {
    const tb = this.toolbar;

    tb.querySelector('.ve-tool-play').addEventListener('click', () => this.togglePlay());
    tb.querySelector('.ve-tool-loop').addEventListener('click', () => this._toggleLoop());
    tb.querySelector('.ve-tool-mute').addEventListener('click', () => this._toggleMute());
    const volSlider = tb.querySelector('.ve-volume-slider');
    volSlider.addEventListener('input', () => {
      if (!this.videoEl) return;
      this.videoEl.volume = parseInt(volSlider.value) / 100;
      this.videoEl.muted = false;
      this._updateVolumeIcon();
    });
    tb.querySelector('.ve-tool-trim-in').addEventListener('click', () => this.setTrimIn());
    tb.querySelector('.ve-tool-trim-out').addEventListener('click', () => this.setTrimOut());
    tb.querySelector('.ve-tool-filters').addEventListener('click', () => this._toggleFilters());
    tb.querySelector('.ve-tool-crop').addEventListener('click', () => this._toggleCrop());
    tb.querySelector('.ve-tool-concat').addEventListener('click', () => this._toggleConcat());
    tb.querySelector('.ve-tool-export').addEventListener('click', () => this._toggleExport());
    tb.querySelector('.ve-tool-reset').addEventListener('click', () => this.resetAll());
    tb.querySelector('.ve-close').addEventListener('click', () => {
      const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
      document.body.dispatchEvent(event);
    });

    // Prevent toolbar clicks from closing overlay
    tb.addEventListener('click', (e) => e.stopPropagation());
    tb.addEventListener('mousedown', (e) => e.stopPropagation());
  }

  _updateFileInfo() {
    if (!this.toolbar || !this.model) return;
    this.toolbar.querySelector('.ve-filename').textContent = this.model.name;
    this.toolbar.querySelector('.ve-filename').title = this.model.name;
  }

  _updateTimeDisplay() {
    if (!this.toolbar || !this.videoEl) return;
    const cur = this.videoEl.currentTime;
    const dur = this.videoEl.duration || 0;
    this.toolbar.querySelector('.ve-time-display').textContent =
      `${this._formatTime(cur)} / ${this._formatTime(dur)}`;
  }

  _updatePlayButton() {
    if (!this.toolbar || !this.videoEl) return;
    const icon = this.toolbar.querySelector('.ve-tool-play i');
    icon.className = this.videoEl.paused ? 'fa fa-play' : 'fa fa-pause';
  }

  // ===========================================================
  //  PLAYBACK
  // ===========================================================

  togglePlay() {
    if (!this.videoEl) return;
    if (this.videoEl.paused) {
      // If at trim-out, loop back to trim-in
      if (this.videoEl.currentTime >= this.trimOut - 0.05) {
        this.videoEl.currentTime = this.trimIn;
      }
      this.videoEl.play().catch(() => {});
    } else {
      this.videoEl.pause();
    }
    this._updatePlayButton();
  }

  _toggleLoop() {
    this._loop = !this._loop;
    this._updateLoopButton();
    this._showNotification(this._loop ? 'Loop on' : 'Loop off');
  }

  _updateLoopButton() {
    if (!this.toolbar) return;
    const btn = this.toolbar.querySelector('.ve-tool-loop');
    if (btn) btn.classList.toggle('ve-active', this._loop);
  }

  _toggleMute() {
    if (!this.videoEl) return;
    this.videoEl.muted = !this.videoEl.muted;
    this._updateVolumeIcon();
  }

  _updateVolumeIcon() {
    if (!this.toolbar || !this.videoEl) return;
    const btn = this.toolbar.querySelector('.ve-tool-mute i');
    if (!btn) return;
    const vol = this.videoEl.muted ? 0 : this.videoEl.volume;
    btn.className = vol === 0 ? 'fa fa-volume-xmark'
      : vol < 0.5 ? 'fa fa-volume-low'
      : 'fa fa-volume-high';
    // Update slider to match
    const slider = this.toolbar.querySelector('.ve-volume-slider');
    if (slider && !this.videoEl.muted) {
      slider.value = Math.round(this.videoEl.volume * 100);
    }
  }

  _startPlayheadLoop() {
    const tick = () => {
      if (!this.isOpen) return;
      this._onTimeUpdate();
      this._rafId = requestAnimationFrame(tick);
    };
    this._rafId = requestAnimationFrame(tick);
  }

  _onTimeUpdate() {
    if (!this.videoEl) return;

    // Constrained playback between trim points
    if (!this.videoEl.paused) {
      if (this.videoEl.currentTime >= this.trimOut) {
        if (this._loop) {
          this.videoEl.currentTime = this.trimIn;
        } else {
          this.videoEl.pause();
          this.videoEl.currentTime = this.trimOut;
          this._updatePlayButton();
        }
      }
      if (this.videoEl.currentTime < this.trimIn) {
        this.videoEl.currentTime = this.trimIn;
      }
    }

    this._updateTimeDisplay();
    this._updatePlayButton();

    // Update timeline playhead
    if (this._timelineModule) {
      this._timelineModule.updatePlayhead();
    }
  }

  /** Handle video 'ended' event - browser auto-pauses before RAF can catch it */
  _onVideoEnded() {
    if (!this.videoEl || !this._loop) return;
    this.videoEl.currentTime = this.trimIn;
    this.videoEl.play().catch(() => {});
  }

  // ===========================================================
  //  TRIM
  // ===========================================================

  setTrimIn() {
    if (!this.videoEl) return;
    this.trimIn = Math.min(this.videoEl.currentTime, this.trimOut - 0.1);
    if (this._timelineModule) this._timelineModule.updateTrimHandles();
    this._showNotification(`Trim in: ${this._formatTime(this.trimIn)}`);
  }

  setTrimOut() {
    if (!this.videoEl) return;
    this.trimOut = Math.max(this.videoEl.currentTime, this.trimIn + 0.1);
    if (this._timelineModule) this._timelineModule.updateTrimHandles();
    this._showNotification(`Trim out: ${this._formatTime(this.trimOut)}`);
  }

  // ===========================================================
  //  FILTERS
  // ===========================================================

  async _toggleFilters() {
    if (this._filterPanelOpen) {
      this._closeFilters();
    } else {
      this._closeExport();
      this._closeConcat();
      await this._openFilters();
    }
  }

  async _openFilters() {
    if (!this._filterModule) {
      const { VideoFilters } = await import('./video_filters.js');
      this._filterModule = new VideoFilters(this);
    }
    this._filterModule.open();
    this._filterPanelOpen = true;
    this.toolbar.querySelector('.ve-tool-filters').classList.add('ve-active');
  }

  _closeFilters() {
    if (this._filterModule) this._filterModule.close();
    this._filterPanelOpen = false;
    if (this.toolbar) this.toolbar.querySelector('.ve-tool-filters')?.classList.remove('ve-active');
  }

  applyFilters() {
    if (!this.videoEl) return;
    const f = this.filters;
    this.videoEl.style.filter = [
      `brightness(${f.brightness}%)`,
      `contrast(${f.contrast}%)`,
      `saturate(${f.saturate}%)`,
      `hue-rotate(${f.hueRotate}deg)`,
      `blur(${f.blur}px)`,
      `sepia(${f.sepia}%)`
    ].join(' ');
  }

  // ===========================================================
  //  CROP
  // ===========================================================

  async _toggleCrop() {
    if (this._cropActive) {
      this._deactivateCrop();
    } else {
      await this._activateCrop();
    }
  }

  async _activateCrop() {
    this._closeFilters();
    this._closeExport();
    this._closeConcat();
    if (!this._cropModule) {
      const { VideoCrop } = await import('./video_crop.js');
      this._cropModule = new VideoCrop(this);
    }
    this._cropModule.activate();
    this._cropActive = true;
    this.toolbar.querySelector('.ve-tool-crop').classList.add('ve-active');
  }

  _deactivateCrop() {
    if (this._cropModule) this._cropModule.deactivate();
    this._cropActive = false;
    if (this.toolbar) this.toolbar.querySelector('.ve-tool-crop')?.classList.remove('ve-active');
  }

  // ===========================================================
  //  EXPORT
  // ===========================================================

  async _toggleExport() {
    if (this._exportPanelOpen) {
      this._closeExport();
    } else {
      this._closeFilters();
      this._closeConcat();
      if (this._cropActive) this._deactivateCrop();
      await this._openExport();
    }
  }

  async _openExport() {
    if (!this._exportModule) {
      const { VideoExport } = await import('./video_export.js');
      this._exportModule = new VideoExport(this);
    }
    this._exportModule.open();
    this._exportPanelOpen = true;
    this.toolbar.querySelector('.ve-tool-export').classList.add('ve-active');
  }

  _closeExport() {
    if (this._exportModule) this._exportModule.close();
    this._exportPanelOpen = false;
    if (this.toolbar) this.toolbar.querySelector('.ve-tool-export')?.classList.remove('ve-active');
  }

  // ===========================================================
  //  CONCAT
  // ===========================================================

  async _toggleConcat() {
    if (this._concatPanelOpen) {
      this._closeConcat();
    } else {
      this._closeFilters();
      this._closeExport();
      if (this._cropActive) this._deactivateCrop();
      await this._openConcat();
    }
  }

  async _openConcat() {
    if (!this._concatModule) {
      const { VideoConcat } = await import('./video_concat.js');
      this._concatModule = new VideoConcat(this);
    }
    this._concatModule.open();
    this._concatPanelOpen = true;
    this.toolbar.querySelector('.ve-tool-concat').classList.add('ve-active');
  }

  _closeConcat() {
    if (this._concatModule) this._concatModule.close();
    this._concatPanelOpen = false;
    if (this.toolbar) this.toolbar.querySelector('.ve-tool-concat')?.classList.remove('ve-active');
  }

  // ===========================================================
  //  RESET
  // ===========================================================

  resetAll() {
    if (!this.videoEl) return;
    this.trimIn = 0;
    this.trimOut = this.videoEl.duration || 0;
    this.filters = { brightness: 100, contrast: 100, saturate: 100, hueRotate: 0, blur: 0, sepia: 0 };
    this.cropRect = null;
    this.concatBefore = null;
    this.concatAfter = null;
    this._loop = true;

    this.applyFilters();
    this._updateLoopButton();
    if (this._timelineModule) this._timelineModule.updateTrimHandles();
    if (this._filterModule && this._filterPanelOpen) this._filterModule.updateSliders();
    if (this._cropActive) this._deactivateCrop();

    this._showNotification('All edits reset');
  }

  // ===========================================================
  //  TIMELINE
  // ===========================================================

  async _initTimeline() {
    if (!this._timelineModule) {
      const { VideoTimeline } = await import('./video_timeline.js');
      this._timelineModule = new VideoTimeline(this);
    }
    this._timelineModule.show();
    this._timelineModule.updateTrimHandles();
  }

  // ===========================================================
  //  KEYBOARD
  // ===========================================================

  _handleKeyDown(e) {
    if (!this.isOpen) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

    const key = e.key;

    switch (key) {
      case ' ':
        e.preventDefault();
        e.stopPropagation();
        this.togglePlay();
        break;
      case 'Escape':
        if (this._filterPanelOpen) {
          this._closeFilters();
        } else if (this._exportPanelOpen) {
          this._closeExport();
        } else if (this._concatPanelOpen) {
          this._closeConcat();
        } else if (this._cropActive) {
          this._deactivateCrop();
        } else {
          // Let it propagate to close fullscreen
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        break;
      case '[':
        e.preventDefault();
        this.setTrimIn();
        break;
      case ']':
        e.preventDefault();
        this.setTrimOut();
        break;
      case 'j':
      case 'J':
        e.preventDefault();
        this._seek(-5);
        break;
      case 'l':
      case 'L':
        e.preventDefault();
        this._seek(5);
        break;
      case 'k':
      case 'K':
        e.preventDefault();
        if (this.videoEl && !this.videoEl.paused) {
          this.videoEl.pause();
          this._updatePlayButton();
        }
        break;
      case 'ArrowLeft':
        e.preventDefault();
        e.stopPropagation();
        if (this.videoEl && this.videoEl.paused) {
          // Frame step backward (~1/30s)
          this.videoEl.currentTime = Math.max(this.trimIn, this.videoEl.currentTime - 1 / 30);
        } else {
          this._seek(-5);
        }
        break;
      case 'ArrowRight':
        e.preventDefault();
        e.stopPropagation();
        if (this.videoEl && this.videoEl.paused) {
          // Frame step forward (~1/30s)
          this.videoEl.currentTime = Math.min(this.trimOut, this.videoEl.currentTime + 1 / 30);
        } else {
          this._seek(5);
        }
        break;
      case 'f':
      case 'F':
        e.preventDefault();
        this._toggleFilters();
        break;
      case 'c':
      case 'C':
        e.preventDefault();
        this._toggleCrop();
        break;
      case 'e':
      case 'E':
        e.preventDefault();
        this._toggleExport();
        break;
      case 'o':
      case 'O':
        e.preventDefault();
        this._toggleLoop();
        break;
      case 'm':
      case 'M':
        e.preventDefault();
        this._toggleMute();
        break;
      case 'r':
      case 'R':
        e.preventDefault();
        this.resetAll();
        break;
      case 'Home':
        e.preventDefault();
        if (this.videoEl) this.videoEl.currentTime = this.trimIn;
        break;
      case 'End':
        e.preventDefault();
        if (this.videoEl) this.videoEl.currentTime = this.trimOut;
        break;
      default:
        return; // Don't prevent default for unhandled keys
    }
  }

  _seek(seconds) {
    if (!this.videoEl) return;
    const newTime = Math.max(this.trimIn, Math.min(this.trimOut, this.videoEl.currentTime + seconds));
    this.videoEl.currentTime = newTime;
  }

  // ===========================================================
  //  AUTO-HIDE CHROME
  // ===========================================================

  _handleMouseActivity() {
    this._showChrome();
    this._startAutoHideTimer();
  }

  _showChrome() {
    if (this.chromeVisible) return;
    this.chromeVisible = true;
    if (this.toolbar) this.toolbar.classList.remove('ve-hidden');
    if (this._timelineModule) this._timelineModule.el?.classList.remove('ve-hidden');
  }

  _hideChrome() {
    if (!this.chromeVisible) return;
    // Don't hide if any panel is open or crop active
    if (this._filterPanelOpen || this._exportPanelOpen || this._concatPanelOpen || this._cropActive) return;

    this.chromeVisible = false;
    if (this.toolbar) this.toolbar.classList.add('ve-hidden');
    if (this._timelineModule) this._timelineModule.el?.classList.add('ve-hidden');
  }

  _startAutoHideTimer() {
    clearTimeout(this.autoHideTimer);
    this.autoHideTimer = setTimeout(() => this._hideChrome(), 3000);
  }

  // ===========================================================
  //  EVENT BINDING
  // ===========================================================

  _bindEvents() {
    document.addEventListener('keydown', this._onKeyDown, true);
    this.overlay.addEventListener('mousemove', this._onMouseActivity);
  }

  _unbindEvents() {
    document.removeEventListener('keydown', this._onKeyDown, true);
    this.overlay?.removeEventListener('mousemove', this._onMouseActivity);
  }

  // ===========================================================
  //  HELPERS
  // ===========================================================

  _closeAllPanels() {
    this._closeFilters();
    this._closeExport();
    this._closeConcat();
  }

  _waitForMetadata() {
    return new Promise((resolve) => {
      if (this.videoEl.readyState >= 1) {
        resolve();
      } else {
        this.videoEl.addEventListener('loadedmetadata', () => resolve(), { once: true });
        this.videoEl.addEventListener('error', () => resolve(), { once: true });
      }
    });
  }

  _formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) return '00:00.0';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    const mm = String(m).padStart(2, '0');
    const ss = s.toFixed(1).padStart(4, '0');
    return `${mm}:${ss}`;
  }

  _showNotification(message) {
    if (window.errorHandler?.showNotification) {
      window.errorHandler.showNotification(message, 'info');
    }
  }

  _showConfirmDialog(message) {
    return new Promise((resolve) => {
      const backdrop = document.createElement('div');
      backdrop.className = 've-confirm-backdrop';

      const dialog = document.createElement('div');
      dialog.className = 've-confirm-dialog';
      dialog.innerHTML = `
        <p>${message}</p>
        <div class="ve-confirm-actions">
          <button class="ve-btn ve-btn-text ve-confirm-cancel">Cancel</button>
          <button class="ve-btn ve-btn-text ve-confirm-ok" style="border-color:var(--ve-accent,#4a9eff);color:var(--ve-accent,#4a9eff)">Close</button>
        </div>
      `;

      const cleanup = (result) => {
        backdrop.remove();
        dialog.remove();
        resolve(result);
      };

      dialog.querySelector('.ve-confirm-cancel').addEventListener('click', () => cleanup(false));
      dialog.querySelector('.ve-confirm-ok').addEventListener('click', () => cleanup(true));
      backdrop.addEventListener('click', () => cleanup(false));

      document.body.appendChild(backdrop);
      document.body.appendChild(dialog);

      // Prevent propagation
      dialog.addEventListener('click', (e) => e.stopPropagation());
      dialog.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { e.stopPropagation(); cleanup(false); }
        if (e.key === 'Enter') { e.stopPropagation(); cleanup(true); }
      });
      dialog.querySelector('.ve-confirm-ok').focus();
    });
  }

  /** Check if any edits have been made */
  isDirty() {
    if (!this.videoEl) return false;
    const dur = this.videoEl.duration || 0;
    if (this.trimIn > 0.05 || (dur > 0 && this.trimOut < dur - 0.05)) return true;
    const f = this.filters;
    if (f.brightness !== 100 || f.contrast !== 100 || f.saturate !== 100 ||
        f.hueRotate !== 0 || f.blur !== 0 || f.sepia !== 0) return true;
    if (this.cropRect) return true;
    if (this.concatBefore || this.concatAfter) return true;
    return false;
  }

  /** Get active edits summary for export panel */
  getEditsSummary() {
    const parts = [];
    const dur = this.videoEl?.duration || 0;
    if (this.trimIn > 0.05 || (dur > 0 && this.trimOut < dur - 0.05)) {
      parts.push(`Trim: ${this._formatTime(this.trimIn)} - ${this._formatTime(this.trimOut)}`);
    }
    const f = this.filters;
    const filterActive = f.brightness !== 100 || f.contrast !== 100 || f.saturate !== 100 ||
                          f.hueRotate !== 0 || f.blur !== 0 || f.sepia !== 0;
    if (filterActive) parts.push('Filters active');
    if (this.cropRect) parts.push('Crop active');
    if (this.concatBefore) parts.push(`Prepend: ${this.concatBefore.name}`);
    if (this.concatAfter) parts.push(`Append: ${this.concatAfter.name}`);
    return parts.length ? parts.join('\n') : 'No edits';
  }
}

export const videoEditor = new VideoEditor();
