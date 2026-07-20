/**
 * image_viewer.js - Modern Image Viewer for Dave
 * Bottom toolbar, zoom slider, pan, mini-map, navigation, auto-hide chrome.
 * Coordinates annotation and export sub-modules.
 */

import { photopeaPanel } from './photopea_panel.js';

class ImageViewer {
  constructor() {
    // State
    this.model = null;
    this.img = null;
    this.fileUrl = null;
    this.scale = 1;       // CSS scale: 1 = fit (object-fit:contain handles it)
    this.translateX = 0;
    this.translateY = 0;
    this.rotation = 0;
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.isOpen = false;
    this.autoHideTimer = null;
    this.chromeVisible = true;
    this.naturalWidth = 0;
    this.naturalHeight = 0;

    // Navigation
    this.filteredFiles = [];
    this.currentIndex = -1;

    // Sub-modules (lazy loaded)
    this._annotationModule = null;
    this._exportModule = null;
    this.isAnnotationMode = false;

    // Panels
    this._infoPanelOpen = false;
    this._exportPanelOpen = false;
    this._bgMode = 'dark'; // 'dark' | 'checker'

    // DOM refs (set on open)
    this.overlay = null;
    this.viewer = null;
    this.toolbar = null;
    this.miniMapEl = null;
    this.miniMapCanvas = null;
    this.miniMapViewport = null;
    this.infoPanelEl = null;
    this.exportPanelEl = null;
    this.annotationBarEl = null;

    // Bound handlers for cleanup
    this._onWheel = this._handleWheel.bind(this);
    this._onOverlayWheel = (e) => e.preventDefault();
    this._onMouseDown = this._handleMouseDown.bind(this);
    this._onMouseMove = this._handleMouseMove.bind(this);
    this._onMouseUp = this._handleMouseUp.bind(this);
    this._onKeyDown = this._handleKeyDown.bind(this);
    this._onMouseActivity = this._handleMouseActivity.bind(this);
    this._onDblClick = this._handleDblClick.bind(this);
    this._onResize = this._handleResize.bind(this);
    this._onViewerClick = this._handleViewerClick.bind(this);
    this._onThemeChange = () => {
      if (this._annotationModule) this._annotationModule.onThemeChange();
    };
  }

  // ===========================================================
  //  OPEN / CLOSE
  // ===========================================================

  async open(model, fileUrl, filteredFiles, currentIndex) {
    this.model = model;
    this.fileUrl = fileUrl;
    this.filteredFiles = filteredFiles;
    this.currentIndex = currentIndex;
    this.isOpen = true;
    this.scale = 1;
    this.translateX = 0;
    this.translateY = 0;
    this.rotation = 0;
    this._bgMode = 'dark';

    // DOM refs
    this.overlay = document.getElementById('fullscreenOverlay');
    this.viewer = document.getElementById('fullscreenViewer');

    // Add iv-fullscreen class to hide old UI
    this.overlay.classList.add('iv-fullscreen');

    // Create image
    this.viewer.innerHTML = '';
    this.img = document.createElement('img');
    this.img.src = fileUrl;
    this.img.draggable = false;
    this.viewer.appendChild(this.img);

    // Wait for image load to get natural dimensions
    await this._waitForImageLoad(this.img);
    this.naturalWidth = this.img.naturalWidth;
    this.naturalHeight = this.img.naturalHeight;

    // Create toolbar if not exists
    if (!this.toolbar) {
      this._createToolbar();
    }
    this.toolbar.style.display = 'flex';

    // Wait one frame so the CSS overrides (.iv-fullscreen) take effect
    // and the viewer container reflows to its full size
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    // Calculate fit scale and start at fit
    this._zoomToFit(false);

    // Update toolbar
    this._updateNavCounter();
    this._updateFileInfo();
    this._updateZoomUI();

    // Bind events
    this._bindEvents();

    // Show chrome and start auto-hide
    this._showChrome();
    this._startAutoHideTimer();
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;

    // Close sub-panels
    this._closeAllPanels();

    // Deactivate annotation
    if (this.isAnnotationMode) {
      this._deactivateAnnotation();
    }

    // Remove class
    if (this.overlay) {
      this.overlay.classList.remove('iv-fullscreen', 'iv-bg-checker');
    }

    // Hide toolbar
    if (this.toolbar) {
      this.toolbar.style.display = 'none';
    }

    // Unbind events
    this._unbindEvents();

    // Clear auto-hide
    clearTimeout(this.autoHideTimer);

    // Clear image ref
    this.img = null;
    this.model = null;
  }

  // ===========================================================
  //  NAVIGATION (in-place swap)
  // ===========================================================

  navigate(direction) {
    const newIndex = direction === 'prev' ? this.currentIndex - 1 : this.currentIndex + 1;
    if (newIndex < 0 || newIndex >= this.filteredFiles.length) return;

    this.currentIndex = newIndex;
    const nextModel = this.filteredFiles[newIndex];

    // We need a file URL for the next image
    this._loadFileUrl(nextModel).then(url => {
      // Revoke old URL if it was a blob
      // (The cleanup is handled by asset_loading.js's cleanup callback)

      this.model = nextModel;
      this.fileUrl = url;
      this.scale = 1;
      this.translateX = 0;
      this.translateY = 0;
      this.rotation = 0;

      // Swap image src
      this.img.src = url;
      this._waitForImageLoad(this.img).then(() => {
        this.naturalWidth = this.img.naturalWidth;
        this.naturalHeight = this.img.naturalHeight;
        this._zoomToFit(false);
        this._updateNavCounter();
        this._updateFileInfo();
        this._updateZoomUI();
        this._updateMiniMap();

        // Clear annotations for new image
        if (this._annotationModule) {
          this._annotationModule.clearAll();
        }
      });

      // Update the external reference so exitFullscreen works
      const ext = window._ivExternalRef;
      if (ext) {
        ext.fileName = nextModel.name;
        ext.element = this.img;
      }
    });
  }

  async _loadFileUrl(model) {
    // For local files, create object URL from file handle
    if (model.file) {
      return URL.createObjectURL(model.file);
    }
    // For cloud files, use the URL directly
    if (model.url) {
      return model.url;
    }
    // Fallback
    return model.fullPath || '';
  }

  // ===========================================================
  //  TOOLBAR CREATION
  // ===========================================================

  _createToolbar() {
    this.toolbar = document.createElement('div');
    this.toolbar.className = 'iv-toolbar';
    this.toolbar.innerHTML = `
      <div class="iv-toolbar-left">
        <span class="iv-filename"></span>
        <span class="iv-dimensions"></span>
      </div>
      <div class="iv-toolbar-center">
        <button class="iv-btn iv-nav-prev" title="Previous (Left Arrow)">
          <i class="fa fa-chevron-left"></i>
        </button>
        <span class="iv-nav-counter"></span>
        <button class="iv-btn iv-nav-next" title="Next (Right Arrow)">
          <i class="fa fa-chevron-right"></i>
        </button>

        <div class="iv-divider"></div>

        <div class="iv-zoom-group">
          <button class="iv-btn iv-btn-text iv-zoom-fit" title="Fit to screen (F)">Fit</button>
          <button class="iv-btn iv-btn-text iv-zoom-100" title="Actual size (1)">100%</button>
          <div class="iv-zoom-slider-wrap">
            <input type="range" class="iv-zoom-slider" min="10" max="1000" value="100" step="1">
          </div>
          <span class="iv-zoom-label">100%</span>
        </div>

        <div class="iv-divider"></div>

        <button class="iv-btn iv-tool-annotate" title="Annotate (A)">
          <i class="fa fa-pen"></i>
        </button>
        <button class="iv-btn iv-tool-export" title="Export (E)">
          <i class="fa fa-download"></i>
        </button>
        <button class="iv-btn iv-tool-info" title="File info (I)">
          <i class="fa fa-info-circle"></i>
        </button>
        <button class="iv-btn iv-tool-rotate" title="Rotate 90 CW (R)">
          <i class="fa fa-rotate-right"></i>
        </button>
        <button class="iv-btn iv-tool-bg" title="Toggle background (D)">
          <i class="fa fa-chess-board"></i>
        </button>
        <button class="iv-btn iv-tool-edit" title="Edit in Photopea">
          <i class="fa fa-pen-to-square"></i>
        </button>
      </div>
      <div class="iv-toolbar-right">
        <button class="iv-btn iv-close" title="Close (Escape)">
          <i class="fa fa-xmark"></i>
        </button>
      </div>
    `;

    this.overlay.appendChild(this.toolbar);
    this._bindToolbarEvents();
  }

  _bindToolbarEvents() {
    const tb = this.toolbar;

    // Navigation
    tb.querySelector('.iv-nav-prev').addEventListener('click', () => this.navigate('prev'));
    tb.querySelector('.iv-nav-next').addEventListener('click', () => this.navigate('next'));

    // Zoom
    tb.querySelector('.iv-zoom-fit').addEventListener('click', () => this._zoomToFit(true));
    tb.querySelector('.iv-zoom-100').addEventListener('click', () => this._zoomTo100());

    // Zoom slider
    const slider = tb.querySelector('.iv-zoom-slider');
    slider.addEventListener('input', (e) => {
      const newScale = this._sliderToScale(parseInt(e.target.value));
      this._zoomTo(newScale);
    });

    // Tools
    tb.querySelector('.iv-tool-annotate').addEventListener('click', () => this._toggleAnnotation());
    tb.querySelector('.iv-tool-export').addEventListener('click', () => this._toggleExport());
    tb.querySelector('.iv-tool-info').addEventListener('click', () => this._toggleInfoPanel());
    tb.querySelector('.iv-tool-rotate').addEventListener('click', () => this._rotate());
    tb.querySelector('.iv-tool-bg').addEventListener('click', () => this._toggleBackground());
    tb.querySelector('.iv-tool-edit').addEventListener('click', () => photopeaPanel.open(this.model));

    // Close
    tb.querySelector('.iv-close').addEventListener('click', () => {
      // Dispatch the close via the existing exitFullscreen path
      const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
      document.body.dispatchEvent(event);
    });

    // Prevent toolbar clicks from closing the overlay
    tb.addEventListener('click', (e) => e.stopPropagation());
    tb.addEventListener('mousedown', (e) => e.stopPropagation());
  }

  // ===========================================================
  //  ZOOM
  // ===========================================================

  // ===========================================================
  //  ZOOM - Scale semantics:
  //  CSS object-fit:contain handles the base "fit" display.
  //  CSS transform scale(1) = fit. scale(2) = 2x fit.
  //  _actualPixelScale = the CSS scale at which 1 image pixel = 1 screen pixel.
  //  _actualPixelScale = naturalSize / renderedContainSize
  // ===========================================================

  /** Compute the CSS scale needed for 1:1 pixel mapping (100% actual size) */
  _computeActualPixelScale() {
    const viewerRect = this.viewer.getBoundingClientRect();
    let imgW = this.naturalWidth;
    let imgH = this.naturalHeight;
    if (this.rotation === 90 || this.rotation === 270) [imgW, imgH] = [imgH, imgW];
    if (imgW === 0 || imgH === 0) return 1;
    // The contain-rendered size
    const containScale = Math.min(viewerRect.width / imgW, viewerRect.height / imgH);
    const renderedW = imgW * containScale;
    // 100% actual pixels means naturalWidth should equal screen pixels
    // CSS scale = naturalWidth / renderedWidth
    return imgW / renderedW; // = 1 / containScale
  }

  /** Convert CSS scale to display percentage (where 100% = actual pixels) */
  _scaleToPercent(cssScale) {
    const aps = this._computeActualPixelScale();
    if (aps === 0) return 100;
    return Math.round((cssScale / aps) * 100);
  }

  /** Convert display percentage to CSS scale */
  _percentToScale(pct) {
    return (pct / 100) * this._computeActualPixelScale();
  }

  /** Slider maps 10-1000 to percentage via log scale: 10->10%, 100->100%, 1000->1000% */
  _sliderToScale(sliderVal) {
    // sliderVal 10..1000 maps to percent 10%..1000% via log
    const pct = Math.pow(10, (sliderVal - 100) / 450) * 100;
    return this._percentToScale(pct);
  }

  _scaleToSlider(cssScale) {
    const pct = this._scaleToPercent(cssScale);
    return Math.round(100 + 450 * Math.log10(Math.max(pct / 100, 0.01)));
  }

  _zoomTo(newScale, centerX, centerY) {
    const prevScale = this.scale;
    const minScale = 0.1;
    const maxScale = this._percentToScale(1000); // 1000%
    this.scale = Math.max(minScale, Math.min(newScale, maxScale));

    if (centerX !== undefined && centerY !== undefined) {
      const rect = this.img.getBoundingClientRect();
      const imgCx = rect.left + rect.width / 2;
      const imgCy = rect.top + rect.height / 2;
      const mx = centerX - imgCx;
      const my = centerY - imgCy;
      const ratio = this.scale / prevScale;
      this.translateX = mx - ratio * (mx - this.translateX);
      this.translateY = my - ratio * (my - this.translateY);
    }

    this._updateTransform();
    this._updateZoomUI();
    this._updateMiniMap();
  }

  _zoomToFit(animate) {
    // CSS object-fit:contain at scale(1) IS fit
    this.scale = 1;
    this.translateX = 0;
    this.translateY = 0;
    this._updateTransform();
    this._updateZoomUI();
    this._updateMiniMap();
  }

  _zoomTo100() {
    // 100% actual pixels
    this.scale = this._computeActualPixelScale();
    this.translateX = 0;
    this.translateY = 0;
    this._updateTransform();
    this._updateZoomUI();
    this._updateMiniMap();
  }

  _updateTransform() {
    if (!this.img) return;
    const rot = this.rotation ? `rotate(${this.rotation}deg)` : '';
    this.img.style.transform = `translate(${this.translateX}px, ${this.translateY}px) scale(${this.scale}) ${rot}`;
    const atFit = Math.abs(this.scale - 1) < 0.01 && Math.abs(this.translateX) < 1 && Math.abs(this.translateY) < 1;
    this.img.style.cursor = this.isDragging ? 'grabbing' : (!atFit ? 'grab' : 'default');

    // Keep annotation overlay in sync with image transform
    if (this._annotationModule && this.isAnnotationMode) {
      this._annotationModule._requestRedraw();
    }
  }

  _updateZoomUI() {
    if (!this.toolbar) return;
    const pct = this._scaleToPercent(this.scale);
    this.toolbar.querySelector('.iv-zoom-label').textContent = `${pct}%`;
    this.toolbar.querySelector('.iv-zoom-slider').value = this._scaleToSlider(this.scale);

    // Highlight active preset
    const fitBtn = this.toolbar.querySelector('.iv-zoom-fit');
    const btn100 = this.toolbar.querySelector('.iv-zoom-100');
    fitBtn.classList.toggle('iv-active', Math.abs(this.scale - 1) < 0.005);
    const aps = this._computeActualPixelScale();
    btn100.classList.toggle('iv-active', Math.abs(this.scale - aps) < 0.005 * aps);
  }

  // ===========================================================
  //  PAN
  // ===========================================================

  _handleMouseDown(e) {
    if (e.button !== 0) return;
    if (this.isAnnotationMode) return;
    // Only block pan at exact fit (scale ~1 with no translation)
    if (Math.abs(this.scale - 1) < 0.01 && Math.abs(this.translateX) < 1 && Math.abs(this.translateY) < 1) return;

    this.isDragging = true;
    this.dragStartX = e.clientX - this.translateX;
    this.dragStartY = e.clientY - this.translateY;
    this.img.style.cursor = 'grabbing';
    e.preventDefault();
  }

  _handleMouseMove(e) {
    if (!this.isDragging) return;
    this.translateX = e.clientX - this.dragStartX;
    this.translateY = e.clientY - this.dragStartY;
    this._updateTransform();
    this._updateMiniMap();
  }

  _handleMouseUp() {
    if (!this.isDragging) return;
    this.isDragging = false;
    this._updateTransform();
  }

  _handleWheel(e) {
    e.preventDefault();
    e.stopPropagation();

    const rect = this.img.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const mx = e.clientX - cx;
    const my = e.clientY - cy;

    const prev = this.scale;
    const factor = 1.1;
    const maxScale = this._percentToScale(1000);
    const newScale = e.deltaY < 0
      ? Math.min(this.scale * factor, maxScale)
      : Math.max(this.scale / factor, 0.1);

    this.scale = newScale;
    const r = this.scale / prev;
    this.translateX = mx - r * (mx - this.translateX);
    this.translateY = my - r * (my - this.translateY);

    this._updateTransform();
    this._updateZoomUI();
    this._updateMiniMap();
  }

  _handleDblClick(e) {
    if (this.isAnnotationMode) return;
    // If at fit (scale ~1), zoom to 100% at click point. Otherwise go back to fit.
    if (Math.abs(this.scale - 1) < 0.02 && Math.abs(this.translateX) < 5 && Math.abs(this.translateY) < 5) {
      // Currently at fit -> zoom to 100% actual pixels centered on click
      const aps = this._computeActualPixelScale();
      this.translateX = 0;
      this.translateY = 0;
      this._zoomTo(aps, e.clientX, e.clientY);
    } else {
      // Zoomed -> go back to fit
      this._zoomToFit(true);
    }
  }

  _handleViewerClick(e) {
    // Click on viewer bg or letterbox area (outside actual image content) closes the viewer
    if (e.target === this.viewer) {
      // Direct click on viewer background
    } else if (e.target === this.img) {
      // Check if click is in letterbox area (outside actual image content)
      if (this._isClickOnImageContent(e.clientX, e.clientY)) return;
    } else {
      return; // Click on toolbar, panel, etc.
    }
    if (this.isAnnotationMode) return;
    if (this.isDragging) return;
    if (this._infoPanelOpen || this._exportPanelOpen) return;
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    document.body.dispatchEvent(event);
  }

  /** Check if a screen point falls on actual image content (not letterbox area) */
  _isClickOnImageContent(screenX, screenY) {
    if (!this.img) return false;
    const imgRect = this.img.getBoundingClientRect();
    let natW = this.naturalWidth;
    let natH = this.naturalHeight;
    if (!natW || !natH) return true;
    if (this.rotation === 90 || this.rotation === 270) [natW, natH] = [natH, natW];

    const imgAspect = natW / natH;
    const elemAspect = imgRect.width / imgRect.height;
    let contentLeft, contentTop, contentRight, contentBottom;

    if (Math.abs(imgAspect - elemAspect) < 0.01) {
      return true; // No letterboxing
    } else if (imgAspect > elemAspect) {
      const contentH = imgRect.width / imgAspect;
      const pad = (imgRect.height - contentH) / 2;
      contentLeft = imgRect.left;
      contentTop = imgRect.top + pad;
      contentRight = imgRect.right;
      contentBottom = imgRect.bottom - pad;
    } else {
      const contentW = imgRect.height * imgAspect;
      const pad = (imgRect.width - contentW) / 2;
      contentLeft = imgRect.left + pad;
      contentTop = imgRect.top;
      contentRight = imgRect.right - pad;
      contentBottom = imgRect.bottom;
    }

    return screenX >= contentLeft && screenX <= contentRight &&
           screenY >= contentTop && screenY <= contentBottom;
  }

  // ===========================================================
  //  MINI-MAP
  // ===========================================================

  _createMiniMap() {
    this.miniMapEl = document.createElement('div');
    this.miniMapEl.className = 'iv-minimap';
    this.miniMapEl.style.display = 'none';

    this.miniMapCanvas = document.createElement('canvas');
    this.miniMapCanvas.className = 'iv-minimap-canvas';
    this.miniMapEl.appendChild(this.miniMapCanvas);

    this.miniMapViewport = document.createElement('div');
    this.miniMapViewport.className = 'iv-minimap-viewport';
    this.miniMapEl.appendChild(this.miniMapViewport);

    this.overlay.appendChild(this.miniMapEl);

    // Draggable viewport
    let mmDragging = false, mmStartX = 0, mmStartY = 0, mmStartTx = 0, mmStartTy = 0;
    this.miniMapViewport.addEventListener('mousedown', (e) => {
      mmDragging = true;
      mmStartX = e.clientX;
      mmStartY = e.clientY;
      mmStartTx = this.translateX;
      mmStartTy = this.translateY;
      e.stopPropagation();
      e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
      if (!mmDragging) return;
      // Map mini-map pixel delta to image translation delta
      const mapRect = this.miniMapCanvas.getBoundingClientRect();
      const imgW = this.naturalWidth * this.scale;
      const imgH = this.naturalHeight * this.scale;
      const scaleX = imgW / mapRect.width;
      const scaleY = imgH / mapRect.height;
      this.translateX = mmStartTx - (e.clientX - mmStartX) * scaleX;
      this.translateY = mmStartTy - (e.clientY - mmStartY) * scaleY;
      this._updateTransform();
      this._updateMiniMap();
    });
    window.addEventListener('mouseup', () => { mmDragging = false; });
  }

  _updateMiniMap() {
    if (!this.isOpen || !this.img) return;

    // Only show when zoomed beyond fit (scale=1 is fit)
    if (this.scale <= 1.05) {
      this._hideMiniMap();
      return;
    }

    // Don't show if export panel is open (same corner)
    if (this._exportPanelOpen) {
      this._hideMiniMap();
      return;
    }

    if (!this.miniMapEl) {
      this._createMiniMap();
    }

    // Draw thumbnail
    const aspect = this.naturalWidth / this.naturalHeight;
    const mapW = 160;
    const mapH = Math.round(mapW / aspect);
    this.miniMapCanvas.width = mapW;
    this.miniMapCanvas.height = mapH;
    this.miniMapEl.style.height = mapH + 'px';

    const ctx = this.miniMapCanvas.getContext('2d');
    ctx.drawImage(this.img, 0, 0, mapW, mapH);

    // Calculate viewport rectangle
    const viewerRect = this.viewer.getBoundingClientRect();
    const imgRect = this.img.getBoundingClientRect();

    const visLeft = Math.max(viewerRect.left, imgRect.left);
    const visTop = Math.max(viewerRect.top, imgRect.top);
    const visRight = Math.min(viewerRect.right, imgRect.right);
    const visBottom = Math.min(viewerRect.bottom, imgRect.bottom);

    if (visRight <= visLeft || visBottom <= visTop) {
      // Image is completely off-screen
      this.miniMapViewport.style.display = 'none';
    } else {
      this.miniMapViewport.style.display = '';
      const vpLeft = (visLeft - imgRect.left) / imgRect.width;
      const vpTop = (visTop - imgRect.top) / imgRect.height;
      const vpWidth = (visRight - visLeft) / imgRect.width;
      const vpHeight = (visBottom - visTop) / imgRect.height;

      this.miniMapViewport.style.left = `${vpLeft * mapW}px`;
      this.miniMapViewport.style.top = `${vpTop * mapH}px`;
      this.miniMapViewport.style.width = `${vpWidth * mapW}px`;
      this.miniMapViewport.style.height = `${vpHeight * mapH}px`;
    }

    this.miniMapEl.style.display = '';
  }

  _hideMiniMap() {
    if (this.miniMapEl) this.miniMapEl.style.display = 'none';
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
    if (this.toolbar) this.toolbar.classList.remove('iv-hidden');
  }

  _hideChrome() {
    if (!this.chromeVisible) return;
    // Don't hide if panels open or annotation mode
    if (this.isAnnotationMode) return;
    if (this._infoPanelOpen || this._exportPanelOpen) return;

    this.chromeVisible = false;
    if (this.toolbar) this.toolbar.classList.add('iv-hidden');
  }

  _startAutoHideTimer() {
    clearTimeout(this.autoHideTimer);
    this.autoHideTimer = setTimeout(() => this._hideChrome(), 3000);
  }

  // ===========================================================
  //  ROTATION
  // ===========================================================

  _rotate() {
    this.rotation = (this.rotation + 90) % 360;
    this._zoomToFit(false);
  }

  // ===========================================================
  //  BACKGROUND TOGGLE
  // ===========================================================

  _toggleBackground() {
    if (this._bgMode === 'dark') {
      this._bgMode = 'checker';
      this.overlay.classList.add('iv-bg-checker');
    } else {
      this._bgMode = 'dark';
      this.overlay.classList.remove('iv-bg-checker');
    }
    this.toolbar.querySelector('.iv-tool-bg').classList.toggle('iv-active', this._bgMode === 'checker');
  }

  // ===========================================================
  //  INFO PANEL
  // ===========================================================

  _toggleInfoPanel() {
    if (this._infoPanelOpen) {
      this._closeInfoPanel();
    } else {
      this._closeExport();
      this._openInfoPanel();
    }
  }

  _openInfoPanel() {
    if (!this.infoPanelEl) {
      this.infoPanelEl = document.createElement('div');
      this.infoPanelEl.className = 'iv-info-panel';
      this.overlay.appendChild(this.infoPanelEl);
    }
    this._populateInfoPanel();
    this.infoPanelEl.style.display = '';
    this._infoPanelOpen = true;
    this.toolbar.querySelector('.iv-tool-info').classList.add('iv-active');
  }

  _closeInfoPanel() {
    if (this.infoPanelEl) this.infoPanelEl.style.display = 'none';
    this._infoPanelOpen = false;
    if (this.toolbar) this.toolbar.querySelector('.iv-tool-info')?.classList.remove('iv-active');
  }

  _populateInfoPanel() {
    if (!this.infoPanelEl || !this.model) return;
    const m = this.model;
    const fsSize = m.size ?? m.file?.size ?? 0;
    const fsDate = m.lastModified ?? m.file?.lastModified ?? 0;
    const dateStr = fsDate ? new Date(fsDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '-';
    const ext = m.name.split('.').pop().toUpperCase();

    this.infoPanelEl.innerHTML = `
      <div class="iv-info-row"><span>Filename</span><span title="${m.name}">${m.name}</span></div>
      <div class="iv-info-row"><span>Dimensions</span><span>${this.naturalWidth} x ${this.naturalHeight}</span></div>
      <div class="iv-info-row"><span>File Size</span><span>${this._formatSize(fsSize)}</span></div>
      <div class="iv-info-row"><span>Format</span><span>${ext}</span></div>
      <div class="iv-info-row"><span>Modified</span><span>${dateStr}</span></div>
      <div class="iv-info-row"><span>Path</span><span title="${m.fullPath || ''}">${m.fullPath || '-'}</span></div>
    `;
  }

  // ===========================================================
  //  EXPORT
  // ===========================================================

  async _toggleExport() {
    if (this._exportPanelOpen) {
      this._closeExport();
    } else {
      this._closeInfoPanel();
      await this._openExport();
    }
  }

  async _openExport() {
    if (!this._exportModule) {
      const { ImageExport } = await import('./image_export.js');
      this._exportModule = new ImageExport(this);
    }
    this._exportModule.open();
    this._exportPanelOpen = true;
    this.toolbar.querySelector('.iv-tool-export').classList.add('iv-active');
    this._hideMiniMap();
  }

  _closeExport() {
    if (this._exportModule) this._exportModule.close();
    this._exportPanelOpen = false;
    if (this.toolbar) this.toolbar.querySelector('.iv-tool-export')?.classList.remove('iv-active');
    this._updateMiniMap();
  }

  // ===========================================================
  //  ANNOTATION
  // ===========================================================

  async _toggleAnnotation() {
    if (this.isAnnotationMode) {
      this._deactivateAnnotation();
    } else {
      await this._activateAnnotation();
    }
  }

  async _activateAnnotation() {
    if (!this._annotationModule) {
      const { ImageAnnotation } = await import('./image_annotation.js');
      this._annotationModule = new ImageAnnotation(this);
      this._annotationModule.init();
    }
    this.isAnnotationMode = true;
    this._annotationModule.activate();
    this.toolbar.querySelector('.iv-tool-annotate').classList.add('iv-active');
  }

  _deactivateAnnotation() {
    this.isAnnotationMode = false;
    if (this._annotationModule) {
      this._annotationModule.deactivate();
    }
    if (this.toolbar) this.toolbar.querySelector('.iv-tool-annotate')?.classList.remove('iv-active');
  }

  // ===========================================================
  //  KEYBOARD
  // ===========================================================

  _handleKeyDown(e) {
    if (!this.isOpen) return;

    // Don't intercept if typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

    const key = e.key;
    const ctrl = e.ctrlKey || e.metaKey;

    // Annotation undo/redo
    if (ctrl && key === 'z' && !e.shiftKey && this._annotationModule) {
      e.preventDefault();
      this._annotationModule.undo();
      return;
    }
    if (ctrl && (key === 'Z' || (key === 'z' && e.shiftKey)) && this._annotationModule) {
      e.preventDefault();
      this._annotationModule.redo();
      return;
    }
    // Copy to clipboard
    if (ctrl && key === 'c') {
      e.preventDefault();
      this._copyToClipboard();
      return;
    }

    // Delegate annotation tool shortcuts when in annotation mode
    if (this.isAnnotationMode && this._annotationModule) {
      if (this._annotationModule.handleKeyDown(e)) return;
    }

    switch (key) {
      case 'Escape':
        if (this.isAnnotationMode) {
          // Let annotation handle escape first (deselect, close text editor)
          if (this._annotationModule?.handleEscape()) {
            e.preventDefault();
            e.stopPropagation();
            break;
          }
          this._deactivateAnnotation();
        } else if (this._exportPanelOpen) {
          this._closeExport();
        } else if (this._infoPanelOpen) {
          this._closeInfoPanel();
        }
        // Don't prevent default - let ui.js handle the fullscreen close
        // if nothing was open to close
        else return;
        e.preventDefault();
        e.stopPropagation();
        break;
      case 'ArrowLeft':
        this.navigate('prev');
        e.preventDefault();
        break;
      case 'ArrowRight':
        this.navigate('next');
        e.preventDefault();
        break;
      case '+':
      case '=':
        this._zoomTo(this.scale * 1.2);
        e.preventDefault();
        break;
      case '-':
        this._zoomTo(this.scale / 1.2);
        e.preventDefault();
        break;
      case '0':
      case 'f':
      case 'F':
        this._zoomToFit(true);
        e.preventDefault();
        break;
      case '1':
        this._zoomTo100();
        e.preventDefault();
        break;
      case 'r':
      case 'R':
        this._rotate();
        e.preventDefault();
        break;
      case 'd':
      case 'D':
        this._toggleBackground();
        e.preventDefault();
        break;
      case 'a':
      case 'A':
        this._toggleAnnotation();
        e.preventDefault();
        break;
      case 'e':
      case 'E':
        this._toggleExport();
        e.preventDefault();
        break;
      case 'i':
      case 'I':
        this._toggleInfoPanel();
        e.preventDefault();
        break;
      case ' ':
        e.preventDefault();
        if (this.chromeVisible) this._hideChrome();
        else this._showChrome();
        break;
    }
  }

  // ===========================================================
  //  CLIPBOARD
  // ===========================================================

  async _copyToClipboard() {
    if (!this.img) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = this.naturalWidth;
      canvas.height = this.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(this.img, 0, 0);

      if (this._annotationModule?.hasAnnotations()) {
        this._annotationModule.renderToCanvas(canvas, this.naturalWidth, this.naturalHeight);
      }

      const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      this._showNotification('Copied to clipboard');
    } catch (err) {
      console.error('Clipboard copy failed:', err);
      this._showNotification('Failed to copy to clipboard');
    }
  }

  // ===========================================================
  //  EVENT BINDING
  // ===========================================================

  _bindEvents() {
    this.viewer.addEventListener('wheel', this._onWheel, { passive: false });
    this.overlay.addEventListener('wheel', this._onOverlayWheel, { passive: false });
    this.viewer.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mouseup', this._onMouseUp);
    document.addEventListener('keydown', this._onKeyDown, true); // capture phase to intercept before ui.js
    this.overlay.addEventListener('mousemove', this._onMouseActivity);
    this.viewer.addEventListener('dblclick', this._onDblClick);
    this.viewer.addEventListener('click', this._onViewerClick);
    window.addEventListener('resize', this._onResize);
    document.addEventListener('dave:themeChange', this._onThemeChange);
  }

  _unbindEvents() {
    this.viewer?.removeEventListener('wheel', this._onWheel);
    this.overlay?.removeEventListener('wheel', this._onOverlayWheel);
    this.viewer?.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mouseup', this._onMouseUp);
    document.removeEventListener('keydown', this._onKeyDown, true);
    this.overlay?.removeEventListener('mousemove', this._onMouseActivity);
    this.viewer?.removeEventListener('dblclick', this._onDblClick);
    this.viewer?.removeEventListener('click', this._onViewerClick);
    window.removeEventListener('resize', this._onResize);
    document.removeEventListener('dave:themeChange', this._onThemeChange);
  }

  _handleResize() {
    if (!this.isOpen) return;
    // With object-fit:contain, CSS handles fit automatically on resize.
    // Just update minimap and zoom UI (percentage display may change).
    this._updateZoomUI();
    this._updateMiniMap();
    if (this._annotationModule && this.isAnnotationMode) {
      this._annotationModule._resizeCanvas();
    }
  }

  // ===========================================================
  //  TOOLBAR UPDATES
  // ===========================================================

  _updateNavCounter() {
    if (!this.toolbar) return;
    const counter = this.toolbar.querySelector('.iv-nav-counter');
    counter.textContent = `${this.currentIndex + 1} / ${this.filteredFiles.length}`;

    // Disable nav buttons at bounds
    this.toolbar.querySelector('.iv-nav-prev').disabled = this.currentIndex <= 0;
    this.toolbar.querySelector('.iv-nav-next').disabled = this.currentIndex >= this.filteredFiles.length - 1;
  }

  _updateFileInfo() {
    if (!this.toolbar || !this.model) return;
    this.toolbar.querySelector('.iv-filename').textContent = this.model.name;
    this.toolbar.querySelector('.iv-filename').title = this.model.name;
    this.toolbar.querySelector('.iv-dimensions').textContent = `${this.naturalWidth}x${this.naturalHeight}`;

    // Update info panel if open
    if (this._infoPanelOpen) this._populateInfoPanel();
  }

  // ===========================================================
  //  HELPERS
  // ===========================================================

  _closeAllPanels() {
    this._closeInfoPanel();
    this._closeExport();
  }

  _waitForImageLoad(img) {
    return new Promise((resolve) => {
      if (img.complete && img.naturalWidth > 0) {
        resolve();
      } else {
        img.onload = () => resolve();
        img.onerror = () => resolve(); // Resolve even on error to avoid hanging
      }
    });
  }

  _formatSize(bytes) {
    if (bytes === 0) return '-';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let size = bytes;
    while (size >= 1024 && i < units.length - 1) {
      size /= 1024;
      i++;
    }
    return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  }

  _showNotification(message) {
    // Use existing error handler notification if available
    if (window.errorHandler?.showNotification) {
      window.errorHandler.showNotification(message, 'info');
    }
  }
}

export const imageViewer = new ImageViewer();
