/**
 * video_crop.js - Crop overlay with 8 resize handles + aspect presets
 * Normalized coordinates (0-1) relative to video natural dimensions.
 * Overlay is positioned to match the video's rendered area (accounts for object-fit: contain).
 */

export class VideoCrop {
  constructor(editor) {
    this.editor = editor;
    this._overlayEl = null;
    this._regionEl = null;
    this._presetsEl = null;

    // Crop state (normalized 0-1 of video content)
    this._x = 0.1;
    this._y = 0.1;
    this._w = 0.8;
    this._h = 0.8;

    this._activePreset = 'free'; // 'free' | '16:9' | '9:16' | '1:1' | '4:3' | '4:5'
    this._dragging = null; // 'move' | handle id
    this._dragStart = { mx: 0, my: 0, x: 0, y: 0, w: 0, h: 0 };

    this._onDocMouseMove = this._handleDocMouseMove.bind(this);
    this._onDocMouseUp = this._handleDocMouseUp.bind(this);
    this._resizeObserver = null;
  }

  activate() {
    // Restore from editor state if exists
    if (this.editor.cropRect) {
      this._x = this.editor.cropRect.x;
      this._y = this.editor.cropRect.y;
      this._w = this.editor.cropRect.w;
      this._h = this.editor.cropRect.h;
    } else {
      this._x = 0.1;
      this._y = 0.1;
      this._w = 0.8;
      this._h = 0.8;
    }
    this._activePreset = 'free';

    if (!this._overlayEl) this._create();
    this._overlayEl.style.display = '';
    this._overlayEl.classList.add('ve-crop-active');
    this._presetsEl.style.display = '';
    this._positionOverlay();
    this._updateRegion();

    // Watch for resize
    if (!this._resizeObserver) {
      this._resizeObserver = new ResizeObserver(() => this._positionOverlay());
      this._resizeObserver.observe(this.editor.viewer);
    }
  }

  deactivate() {
    if (this._overlayEl) {
      this._overlayEl.style.display = 'none';
      this._overlayEl.classList.remove('ve-crop-active');
    }
    if (this._presetsEl) this._presetsEl.style.display = 'none';

    // Stop watching resize
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }

    // Save to editor
    this.editor.cropRect = { x: this._x, y: this._y, w: this._w, h: this._h };
  }

  _create() {
    // Crop overlay inside the viewer
    this._overlayEl = document.createElement('div');
    this._overlayEl.className = 've-crop-overlay';

    // Crop region with handles
    this._regionEl = document.createElement('div');
    this._regionEl.className = 've-crop-region';

    // Rule-of-thirds grid
    const grid = document.createElement('div');
    grid.className = 've-crop-grid';
    grid.innerHTML = `
      <div class="ve-crop-grid-line ve-crop-grid-line-h" style="top:33.33%"></div>
      <div class="ve-crop-grid-line ve-crop-grid-line-h" style="top:66.66%"></div>
      <div class="ve-crop-grid-line ve-crop-grid-line-v" style="left:33.33%"></div>
      <div class="ve-crop-grid-line ve-crop-grid-line-v" style="left:66.66%"></div>
    `;
    this._regionEl.appendChild(grid);

    // 8 resize handles
    const handles = ['tl', 'tc', 'tr', 'ml', 'mr', 'bl', 'bc', 'br'];
    for (const h of handles) {
      const handle = document.createElement('div');
      handle.className = `ve-crop-handle ve-crop-handle-${h}`;
      handle.dataset.handle = h;
      this._regionEl.appendChild(handle);
    }

    this._overlayEl.appendChild(this._regionEl);
    this.editor.viewer.appendChild(this._overlayEl);

    // Presets bar
    this._presetsEl = document.createElement('div');
    this._presetsEl.className = 've-crop-presets';

    const presets = [
      { key: 'free', label: 'Free' },
      { key: '16:9', label: '16:9' },
      { key: '9:16', label: '9:16' },
      { key: '1:1',  label: '1:1' },
      { key: '4:3',  label: '4:3' },
      { key: '4:5',  label: '4:5' }
    ];

    for (const p of presets) {
      const btn = document.createElement('button');
      btn.className = 've-crop-preset' + (p.key === 'free' ? ' ve-active' : '');
      btn.textContent = p.label;
      btn.dataset.preset = p.key;
      btn.addEventListener('click', () => this._applyPreset(p.key));
      this._presetsEl.appendChild(btn);
    }

    this.editor.overlay.appendChild(this._presetsEl);
    this._bindEvents();
  }

  _bindEvents() {
    // Region drag for move
    this._regionEl.addEventListener('mousedown', (e) => {
      if (e.target.dataset.handle) return; // Handle click handled below
      this._startDrag('move', e);
    });

    // Handle drag
    this._regionEl.querySelectorAll('.ve-crop-handle').forEach(h => {
      h.addEventListener('mousedown', (e) => {
        this._startDrag(e.target.dataset.handle, e);
        e.stopPropagation();
      });
    });

    // Prevent propagation
    this._overlayEl.addEventListener('click', (e) => e.stopPropagation());
    this._presetsEl.addEventListener('click', (e) => e.stopPropagation());
    this._presetsEl.addEventListener('mousedown', (e) => e.stopPropagation());
  }

  _startDrag(type, e) {
    this._dragging = type;
    this._dragStart = {
      mx: e.clientX, my: e.clientY,
      x: this._x, y: this._y, w: this._w, h: this._h
    };
    document.addEventListener('mousemove', this._onDocMouseMove);
    document.addEventListener('mouseup', this._onDocMouseUp);
    e.preventDefault();
  }

  _handleDocMouseMove(e) {
    if (!this._dragging) return;
    // Use the overlay rect (matches video content area) for normalized coordinates
    const overlayRect = this._overlayEl.getBoundingClientRect();
    const dx = (e.clientX - this._dragStart.mx) / overlayRect.width;
    const dy = (e.clientY - this._dragStart.my) / overlayRect.height;
    const s = this._dragStart;
    const ratio = this._getAspectRatio();

    if (this._dragging === 'move') {
      this._x = Math.max(0, Math.min(1 - s.w, s.x + dx));
      this._y = Math.max(0, Math.min(1 - s.h, s.y + dy));
    } else {
      // Handle resize
      let nx = s.x, ny = s.y, nw = s.w, nh = s.h;
      const handle = this._dragging;

      // Horizontal
      if (handle.includes('l')) {
        nw = Math.max(0.05, s.w - dx);
        nx = s.x + s.w - nw;
      } else if (handle.includes('r')) {
        nw = Math.max(0.05, s.w + dx);
      }

      // Vertical
      if (handle.includes('t')) {
        nh = Math.max(0.05, s.h - dy);
        ny = s.y + s.h - nh;
      } else if (handle.includes('b')) {
        nh = Math.max(0.05, s.h + dy);
      }

      // Middle handles: only move one axis
      if (handle === 'ml' || handle === 'mr') { ny = s.y; nh = s.h; }
      if (handle === 'tc' || handle === 'bc') { nx = s.x; nw = s.w; }

      // Apply aspect ratio constraint
      if (ratio && handle !== 'ml' && handle !== 'mr' && handle !== 'tc' && handle !== 'bc') {
        // Adjust height to match desired aspect ratio in video pixel space
        const videoAspect = this._getVideoAspect();
        nh = (nw * videoAspect) / ratio;
        if (handle.includes('t')) {
          ny = s.y + s.h - nh;
        }
      }

      // Clamp to bounds
      nx = Math.max(0, nx);
      ny = Math.max(0, ny);
      nw = Math.min(nw, 1 - nx);
      nh = Math.min(nh, 1 - ny);

      this._x = nx;
      this._y = ny;
      this._w = nw;
      this._h = nh;
    }

    this._updateRegion();
  }

  _handleDocMouseUp() {
    this._dragging = null;
    document.removeEventListener('mousemove', this._onDocMouseMove);
    document.removeEventListener('mouseup', this._onDocMouseUp);
  }

  /**
   * Compute where the video content actually renders within the viewer
   * (accounting for object-fit: contain letterboxing/pillarboxing).
   */
  _getVideoRect() {
    const viewer = this.editor.viewer;
    const video = this.editor.videoEl;
    if (!viewer || !video) return { x: 0, y: 0, w: viewer?.clientWidth || 0, h: viewer?.clientHeight || 0 };

    const vw = viewer.clientWidth;
    const vh = viewer.clientHeight;
    const nw = video.videoWidth;
    const nh = video.videoHeight;

    if (!nw || !nh) return { x: 0, y: 0, w: vw, h: vh };

    const viewerAspect = vw / vh;
    const videoAspect = nw / nh;

    let rw, rh, rx, ry;
    if (videoAspect > viewerAspect) {
      // Video wider than viewer - letterbox top/bottom
      rw = vw;
      rh = vw / videoAspect;
      rx = 0;
      ry = (vh - rh) / 2;
    } else {
      // Video taller than viewer - pillarbox left/right
      rh = vh;
      rw = vh * videoAspect;
      ry = 0;
      rx = (vw - rw) / 2;
    }

    return { x: rx, y: ry, w: rw, h: rh };
  }

  /** Position the crop overlay to match the video content area */
  _positionOverlay() {
    if (!this._overlayEl) return;
    const r = this._getVideoRect();
    this._overlayEl.style.left = `${r.x}px`;
    this._overlayEl.style.top = `${r.y}px`;
    this._overlayEl.style.width = `${r.w}px`;
    this._overlayEl.style.height = `${r.h}px`;
  }

  _updateRegion() {
    if (!this._regionEl) return;
    this._regionEl.style.left = `${this._x * 100}%`;
    this._regionEl.style.top = `${this._y * 100}%`;
    this._regionEl.style.width = `${this._w * 100}%`;
    this._regionEl.style.height = `${this._h * 100}%`;
  }

  _applyPreset(key) {
    this._activePreset = key;
    // Update preset buttons
    this._presetsEl.querySelectorAll('.ve-crop-preset').forEach(btn => {
      btn.classList.toggle('ve-active', btn.dataset.preset === key);
    });

    if (key === 'free') return;

    const ratio = this._getAspectRatioForKey(key);
    if (!ratio) return;

    // Calculate crop dimensions in normalized video space.
    // The overlay now matches the video content area, so coordinates directly map to video pixels.
    // We want: (w * videoWidth) / (h * videoHeight) = ratio
    // So: w/h = ratio * (videoHeight / videoWidth) = ratio / videoAspect
    const videoAspect = this._getVideoAspect();
    const normalizedRatio = ratio / videoAspect; // w/h in normalized space

    let w, h;
    if (normalizedRatio >= 1) {
      w = 0.8;
      h = w / normalizedRatio;
      if (h > 0.8) { h = 0.8; w = h * normalizedRatio; }
    } else {
      h = 0.8;
      w = h * normalizedRatio;
      if (w > 0.8) { w = 0.8; h = w / normalizedRatio; }
    }

    this._w = w;
    this._h = h;
    this._x = (1 - w) / 2;
    this._y = (1 - h) / 2;
    this._updateRegion();
  }

  _getAspectRatio() {
    return this._getAspectRatioForKey(this._activePreset);
  }

  _getAspectRatioForKey(key) {
    const map = { '16:9': 16/9, '9:16': 9/16, '1:1': 1, '4:3': 4/3, '4:5': 4/5 };
    return map[key] || null;
  }

  _getVideoAspect() {
    const v = this.editor.videoEl;
    if (!v || !v.videoWidth || !v.videoHeight) return 16/9;
    return v.videoWidth / v.videoHeight;
  }
}
