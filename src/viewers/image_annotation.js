/**
 * image_annotation.js - Canvas-based annotation overlay for the image viewer
 * Theme-aware: reads --theme-accent for canvas drawing colors.
 * Coordinates stored in normalized image space (0-1).
 */

export class ImageAnnotation {
  constructor(imageViewer) {
    this.viewer = imageViewer;
    this.canvas = null;
    this.ctx = null;
    this.toolbar = null;
    this.tool = 'pen';
    this.color = '#ff3333';
    this.lineWidth = 3;
    this.fillEnabled = false;
    this.fillOpacity = 0.3;
    this.strokeEnabled = true;
    this.strokes = [];
    this.undoStack = [];   // action-based: { type, ... }
    this.redoStack = [];
    this.currentStroke = null;
    this.visible = true;
    this.isDrawing = false;
    this._animFrame = null;
    this._nextNumber = 1;

    // Selection state
    this.selectedId = null;
    this._dragMode = null;    // null | 'move' | 'resize' | 'rotate'
    this._dragHandle = -1;    // resize handle index (0-7)
    this._dragStart = null;   // { x, y } in normalized coords
    this._dragOrigData = null; // snapshot for undo
    this._dragOrigBounds = null; // original bounds for resize
    this._dragOrigRotation = 0;  // original rotation for rotate drag
    this._hoveredHandle = -1; // for cursor feedback

    // Inline text editor
    this._textEditor = null;

    // Max undo stack
    this._maxUndo = 50;

    // Theme accent cache
    this._cachedAccentColor = null;

    // Attribute editing: snapshot before continuous edits (slider/color-picker)
    this._editBeforeSnapshot = null;

    // Editing existing text annotation state
    this._editingStrokeId = null;
    this._editingStrokeBefore = null;

    // Dave color palette
    this._palette = [
      { color: '#ff3333', name: 'Alert' },
      { color: '#00ff41', name: 'Dave' },
      { color: '#44ddff', name: 'Curious' },
      { color: '#ff66cc', name: 'Sassy' },
      { color: '#ffff33', name: 'Warning' },
      { color: '#ffffff', name: 'Clean' },
      { color: '#aa88ff', name: 'Existential' },
    ];

    // Handle cursors by index: TL, T, TR, L, R, BL, B, BR
    this._handleCursors = [
      'nw-resize', 'n-resize', 'ne-resize',
      'w-resize', 'e-resize',
      'sw-resize', 's-resize', 'se-resize'
    ];

    // Bound handlers
    this._onPointerDown = this._handlePointerDown.bind(this);
    this._onPointerMove = this._handlePointerMove.bind(this);
    this._onPointerUp = this._handlePointerUp.bind(this);
    this._onDblClick = this._handleCanvasDblClick.bind(this);
  }

  // ===========================================================
  //  LIFECYCLE
  // ===========================================================

  init() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'iv-annotation-canvas';
    this.viewer.viewer.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    this._createToolbar();

    this.canvas.addEventListener('pointerdown', this._onPointerDown);
    this.canvas.addEventListener('dblclick', this._onDblClick);
    window.addEventListener('pointermove', this._onPointerMove);
    window.addEventListener('pointerup', this._onPointerUp);
  }

  activate() {
    this._resizeCanvas();
    this.canvas.style.display = '';
    this.canvas.classList.add('iv-drawing');
    this.toolbar.style.display = 'block';
    // Trigger slide-up animation
    this.toolbar.classList.remove('iv-anno-bar--enter');
    void this.toolbar.offsetWidth;
    this.toolbar.classList.add('iv-anno-bar--enter');
    this._updateCursor();
    this._redraw();
  }

  deactivate() {
    this.canvas.classList.remove('iv-drawing');
    this.canvas.style.display = 'none';
    if (this.toolbar) this.toolbar.style.display = 'none';
    this.isDrawing = false;
    this._clearSelection();
    this._removeTextEditor();
  }

  dispose() {
    if (this.canvas) {
      this.canvas.remove();
      this.canvas = null;
    }
    if (this.toolbar) {
      this.toolbar.remove();
      this.toolbar = null;
    }
    this._removeTextEditor();
    window.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('pointerup', this._onPointerUp);
  }

  /** Called on dave:themeChange — invalidate accent cache and redraw */
  onThemeChange() {
    this._cachedAccentColor = null;
    this._requestRedraw();
  }

  // ===========================================================
  //  THEME-AWARE ACCENT COLOR
  // ===========================================================

  _getAccentColor() {
    if (this._cachedAccentColor) return this._cachedAccentColor;
    const el = this.toolbar || this.canvas;
    if (!el) return '#9b77ff'; // fallback
    const style = getComputedStyle(document.documentElement);
    this._cachedAccentColor = style.getPropertyValue('--theme-accent').trim() || '#9b77ff';
    return this._cachedAccentColor;
  }

  // ===========================================================
  //  TOOLBAR (Annotation Strip)
  // ===========================================================

  _createToolbar() {
    this.toolbar = document.createElement('div');
    this.toolbar.className = 'iv-anno-bar';
    this.toolbar.style.display = 'none';

    const tools = [
      { id: 'select', icon: 'fa-arrow-pointer', key: 'V', title: 'Select' },
      { id: 'pen', icon: 'fa-pen-fancy', key: 'P', title: 'Pen' },
      { id: 'line', icon: 'fa-minus', key: 'L', title: 'Line' },
      { id: 'arrow', icon: 'fa-arrow-right', key: '', title: 'Arrow' },
      { id: 'rect', icon: 'fa-square', key: '', title: 'Rectangle' },
      { id: 'circle', icon: 'fa-circle', key: '', title: 'Circle' },
      { id: 'text', icon: 'fa-font', key: 'T', title: 'Text' },
      { id: 'number', icon: 'fa-hashtag', key: 'N', title: 'Number' },
      { id: 'highlighter', icon: 'fa-highlighter', key: 'H', title: 'Highlighter' },
    ];

    const toolButtons = tools.map(t => {
      const active = t.id === this.tool ? ' iv-anno-tool--active' : '';
      const keyHint = t.key ? `<span class="iv-anno-tool__key">${t.key}</span>` : '';
      return `<button class="iv-anno-tool${active}" data-tool="${t.id}" title="${t.title}${t.key ? ' (' + t.key + ')' : ''}"><i class="fa ${t.icon}"></i>${keyHint}</button>`;
    }).join('');

    const colorSwatches = this._palette.map(c => {
      const active = c.color === this.color ? ' iv-anno-color-swatch--active' : '';
      return `<span class="iv-anno-color-swatch${active}" data-color="${c.color}" title="${c.name}" style="background:${c.color}"></span>`;
    }).join('');

    this.toolbar.innerHTML = `
      <div class="iv-anno-bar__header">
        <span class="iv-anno-bar__status-light"></span>
        <span class="iv-anno-bar__title">ANNOTATION // ACTIVE</span>
      </div>
      <div class="iv-anno-bar__body">
        <div class="iv-anno-bar__section">
          ${toolButtons}
        </div>
        <div class="iv-anno-bar__divider"></div>
        <div class="iv-anno-bar__section iv-anno-bar__options">
          <button class="iv-anno-toggle" data-toggle="fill" title="Toggle fill (shapes)">
            <i class="fa fa-fill-drip"></i>
          </button>
          <button class="iv-anno-toggle iv-anno-toggle--active" data-toggle="stroke" title="Toggle stroke">
            <i class="fa fa-paintbrush"></i>
          </button>
          <div class="iv-anno-color-swatches">
            ${colorSwatches}
          </div>
          <input type="color" class="iv-anno-color-custom" value="${this.color}" title="Custom color">
          <div class="iv-anno-bar__divider"></div>
          <div class="iv-anno-slider-group">
            <input type="range" class="iv-anno-slider" min="1" max="20" value="${this.lineWidth}">
            <span class="iv-anno-slider__value">${this.lineWidth}px</span>
          </div>
        </div>
        <div class="iv-anno-bar__divider"></div>
        <div class="iv-anno-bar__section">
          <button class="iv-anno-tool" data-action="undo" title="Undo (Ctrl+Z)"><i class="fa fa-undo"></i></button>
          <button class="iv-anno-tool" data-action="redo" title="Redo (Ctrl+Shift+Z)"><i class="fa fa-redo"></i></button>
          <button class="iv-anno-tool" data-action="clear" title="Clear all"><i class="fa fa-trash"></i></button>
          <button class="iv-anno-tool iv-anno-toggle-vis" data-action="toggle" title="Toggle visibility"><i class="fa fa-eye"></i></button>
        </div>
      </div>
    `;

    this.viewer.overlay.appendChild(this.toolbar);
    this._bindToolbarEvents();

    this.toolbar.addEventListener('click', e => e.stopPropagation());
    this.toolbar.addEventListener('mousedown', e => e.stopPropagation());
    this.toolbar.addEventListener('pointerdown', e => e.stopPropagation());
  }

  _bindToolbarEvents() {
    // Tool selection
    this.toolbar.querySelectorAll('[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => this._selectTool(btn.dataset.tool));
    });

    // Fill toggle
    this.toolbar.querySelector('[data-toggle="fill"]').addEventListener('click', (e) => {
      const selected = this._getSelectedStroke();
      if (selected) {
        // Edit selected annotation's fill
        const before = this._snapshotStroke(selected);
        const shapeFillable = ['rect', 'circle', 'highlighter'].includes(selected.type);
        if (shapeFillable) {
          const newFill = selected.fillColor ? null : selected.color;
          selected.fillColor = newFill;
          e.currentTarget.classList.toggle('iv-anno-toggle--active', !!newFill);
        }
        this._pushUndo({ type: 'edit', id: selected.id, before, after: this._snapshotStroke(selected) });
        this._requestRedraw();
      } else {
        this.fillEnabled = !this.fillEnabled;
        e.currentTarget.classList.toggle('iv-anno-toggle--active', this.fillEnabled);
        if (!this.fillEnabled && !this.strokeEnabled) {
          this.strokeEnabled = true;
          this.toolbar.querySelector('[data-toggle="stroke"]').classList.add('iv-anno-toggle--active');
        }
      }
    });

    // Stroke toggle
    this.toolbar.querySelector('[data-toggle="stroke"]').addEventListener('click', (e) => {
      const selected = this._getSelectedStroke();
      if (selected) {
        const before = this._snapshotStroke(selected);
        selected.strokeEnabled = !selected.strokeEnabled;
        e.currentTarget.classList.toggle('iv-anno-toggle--active', selected.strokeEnabled);
        // Ensure at least one is on
        if (!selected.fillColor && !selected.strokeEnabled) {
          selected.strokeEnabled = true;
          e.currentTarget.classList.add('iv-anno-toggle--active');
        }
        this._pushUndo({ type: 'edit', id: selected.id, before, after: this._snapshotStroke(selected) });
        this._requestRedraw();
      } else {
        this.strokeEnabled = !this.strokeEnabled;
        e.currentTarget.classList.toggle('iv-anno-toggle--active', this.strokeEnabled);
        if (!this.fillEnabled && !this.strokeEnabled) {
          this.fillEnabled = true;
          this.toolbar.querySelector('[data-toggle="fill"]').classList.add('iv-anno-toggle--active');
        }
      }
    });

    // Color swatches
    this.toolbar.querySelectorAll('.iv-anno-color-swatch').forEach(dot => {
      dot.addEventListener('click', () => {
        const selected = this._getSelectedStroke();
        if (selected) {
          const before = this._snapshotStroke(selected);
          selected.color = dot.dataset.color;
          if (selected.fillColor) selected.fillColor = dot.dataset.color;
          this._pushUndo({ type: 'edit', id: selected.id, before, after: this._snapshotStroke(selected) });
          this._requestRedraw();
        } else {
          this.color = dot.dataset.color;
        }
        this.toolbar.querySelector('.iv-anno-color-custom').value = dot.dataset.color;
        this.toolbar.querySelectorAll('.iv-anno-color-swatch').forEach(d => d.classList.remove('iv-anno-color-swatch--active'));
        dot.classList.add('iv-anno-color-swatch--active');
      });
    });

    // Custom color
    const colorPicker = this.toolbar.querySelector('.iv-anno-color-custom');
    colorPicker.addEventListener('input', (e) => {
      const selected = this._getSelectedStroke();
      if (selected) {
        if (!this._editBeforeSnapshot) {
          this._editBeforeSnapshot = this._snapshotStroke(selected);
        }
        selected.color = e.target.value;
        if (selected.fillColor) selected.fillColor = e.target.value;
        this._requestRedraw();
      } else {
        this.color = e.target.value;
      }
      this.toolbar.querySelectorAll('.iv-anno-color-swatch').forEach(d => d.classList.remove('iv-anno-color-swatch--active'));
    });
    colorPicker.addEventListener('change', (e) => {
      const selected = this._getSelectedStroke();
      if (selected && this._editBeforeSnapshot) {
        this._pushUndo({ type: 'edit', id: selected.id, before: this._editBeforeSnapshot, after: this._snapshotStroke(selected) });
        this._editBeforeSnapshot = null;
      }
    });

    // Stroke width slider
    const slider = this.toolbar.querySelector('.iv-anno-slider');
    const sliderVal = this.toolbar.querySelector('.iv-anno-slider__value');
    slider.addEventListener('input', () => {
      const newWidth = parseInt(slider.value);
      const selected = this._getSelectedStroke();
      if (selected) {
        if (!this._editBeforeSnapshot) {
          this._editBeforeSnapshot = this._snapshotStroke(selected);
        }
        selected.lineWidth = newWidth;
        this._requestRedraw();
      } else {
        this.lineWidth = newWidth;
      }
      sliderVal.textContent = `${newWidth}px`;
    });
    slider.addEventListener('change', () => {
      const selected = this._getSelectedStroke();
      if (selected && this._editBeforeSnapshot) {
        this._pushUndo({ type: 'edit', id: selected.id, before: this._editBeforeSnapshot, after: this._snapshotStroke(selected) });
        this._editBeforeSnapshot = null;
      }
    });

    // Actions
    this.toolbar.querySelector('[data-action="undo"]').addEventListener('click', () => this.undo());
    this.toolbar.querySelector('[data-action="redo"]').addEventListener('click', () => this.redo());
    this.toolbar.querySelector('[data-action="clear"]').addEventListener('click', () => this.clearAll());
    this.toolbar.querySelector('[data-action="toggle"]').addEventListener('click', () => this.toggleVisibility());
  }

  _selectTool(toolId) {
    this.tool = toolId;
    this.toolbar.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('iv-anno-tool--active'));
    const btn = this.toolbar.querySelector(`[data-tool="${toolId}"]`);
    if (btn) btn.classList.add('iv-anno-tool--active');

    if (toolId !== 'select') {
      this._clearSelection();
    }
    this._removeTextEditor();
    this._updateCursor();
  }

  // ===========================================================
  //  SELECTION → TOOLBAR SYNC (Feature 3)
  // ===========================================================

  _onSelectionChange() {
    const stroke = this._getSelectedStroke();
    if (stroke) {
      this._syncToolbarToStroke(stroke);
    } else {
      this._syncToolbarToGlobals();
    }
  }

  _syncToolbarToStroke(stroke) {
    if (!this.toolbar) return;

    // Color swatches
    this.toolbar.querySelectorAll('.iv-anno-color-swatch').forEach(d => {
      d.classList.toggle('iv-anno-color-swatch--active', d.dataset.color === stroke.color);
    });
    this.toolbar.querySelector('.iv-anno-color-custom').value = stroke.color;

    // Slider
    const slider = this.toolbar.querySelector('.iv-anno-slider');
    const sliderVal = this.toolbar.querySelector('.iv-anno-slider__value');
    if (slider) slider.value = stroke.lineWidth;
    if (sliderVal) sliderVal.textContent = `${stroke.lineWidth}px`;

    // Toggles
    this.toolbar.querySelector('[data-toggle="fill"]').classList.toggle('iv-anno-toggle--active', !!stroke.fillColor);
    this.toolbar.querySelector('[data-toggle="stroke"]').classList.toggle('iv-anno-toggle--active', stroke.strokeEnabled);
  }

  _syncToolbarToGlobals() {
    if (!this.toolbar) return;

    this.toolbar.querySelectorAll('.iv-anno-color-swatch').forEach(d => {
      d.classList.toggle('iv-anno-color-swatch--active', d.dataset.color === this.color);
    });
    this.toolbar.querySelector('.iv-anno-color-custom').value = this.color;

    const slider = this.toolbar.querySelector('.iv-anno-slider');
    const sliderVal = this.toolbar.querySelector('.iv-anno-slider__value');
    if (slider) slider.value = this.lineWidth;
    if (sliderVal) sliderVal.textContent = `${this.lineWidth}px`;

    this.toolbar.querySelector('[data-toggle="fill"]').classList.toggle('iv-anno-toggle--active', this.fillEnabled);
    this.toolbar.querySelector('[data-toggle="stroke"]').classList.toggle('iv-anno-toggle--active', this.strokeEnabled);
  }

  // ===========================================================
  //  CANVAS POSITIONING
  // ===========================================================

  _resizeCanvas() {
    if (!this.canvas || !this.viewer.img) return;
    const viewerRect = this.viewer.viewer.getBoundingClientRect();
    this.canvas.width = viewerRect.width;
    this.canvas.height = viewerRect.height;
    this.canvas.style.width = viewerRect.width + 'px';
    this.canvas.style.height = viewerRect.height + 'px';
    this._redraw();
  }

  _resizeCanvasIfNeeded() {
    const viewerRect = this.viewer.viewer.getBoundingClientRect();
    if (this.canvas.width !== Math.round(viewerRect.width) ||
        this.canvas.height !== Math.round(viewerRect.height)) {
      this.canvas.width = Math.round(viewerRect.width);
      this.canvas.height = Math.round(viewerRect.height);
      this.canvas.style.width = viewerRect.width + 'px';
      this.canvas.style.height = viewerRect.height + 'px';
    }
  }

  // ===========================================================
  //  COORDINATE MAPPING
  // ===========================================================

  _screenToImage(screenX, screenY) {
    const imgRect = this.viewer.img.getBoundingClientRect();
    return {
      x: (screenX - imgRect.left) / imgRect.width,
      y: (screenY - imgRect.top) / imgRect.height
    };
  }

  _imageToCanvas(ix, iy) {
    const imgRect = this.viewer.img.getBoundingClientRect();
    const viewerRect = this.viewer.viewer.getBoundingClientRect();
    return {
      x: (imgRect.left - viewerRect.left) + ix * imgRect.width,
      y: (imgRect.top - viewerRect.top) + iy * imgRect.height
    };
  }

  /** Convert a pixel distance to normalized image distance (approx) */
  _pixelsToImageDist(px) {
    const imgRect = this.viewer.img.getBoundingClientRect();
    return px / Math.max(imgRect.width, imgRect.height);
  }

  // ===========================================================
  //  BOUNDS CLAMPING (Feature 4) — content-aware
  // ===========================================================

  /** Compute actual image content area in normalized element coords (excludes object-fit:contain letterbox) */
  _getImageContentBounds() {
    const img = this.viewer.img;
    if (!img) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
    const imgRect = img.getBoundingClientRect();
    let natW = this.viewer.naturalWidth;
    let natH = this.viewer.naturalHeight;
    if (!natW || !natH) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
    if (this.viewer.rotation === 90 || this.viewer.rotation === 270) [natW, natH] = [natH, natW];
    const imgAspect = natW / natH;
    const elemAspect = imgRect.width / imgRect.height;
    if (Math.abs(imgAspect - elemAspect) < 0.01) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
    if (imgAspect > elemAspect) {
      const contentH = imgRect.width / imgAspect;
      const pad = (imgRect.height - contentH) / 2;
      return { minX: 0, minY: pad / imgRect.height, maxX: 1, maxY: 1 - pad / imgRect.height };
    } else {
      const contentW = imgRect.height * imgAspect;
      const pad = (imgRect.width - contentW) / 2;
      return { minX: pad / imgRect.width, minY: 0, maxX: 1 - pad / imgRect.width, maxY: 1 };
    }
  }

  _clampToImage(pt) {
    const b = this._getImageContentBounds();
    return {
      x: Math.max(b.minX, Math.min(b.maxX, pt.x)),
      y: Math.max(b.minY, Math.min(b.maxY, pt.y))
    };
  }

  _isInImageBounds(pt) {
    const b = this._getImageContentBounds();
    return pt.x >= b.minX && pt.x <= b.maxX && pt.y >= b.minY && pt.y <= b.maxY;
  }

  // ===========================================================
  //  ROTATION UTILITY
  // ===========================================================

  _rotatePoint(pt, center, angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dx = pt.x - center.x;
    const dy = pt.y - center.y;
    return {
      x: center.x + dx * cos - dy * sin,
      y: center.y + dx * sin + dy * cos
    };
  }

  /** Un-rotate a test point, accounting for aspect ratio between normalized and pixel space */
  _unrotateForHitTest(pt, stroke) {
    if (!stroke.rotation) return pt;
    const center = this._getBoundsCenter(stroke);
    if (!center) return pt;
    const imgRect = this.viewer.img.getBoundingClientRect();
    const w = imgRect.width;
    const h = imgRect.height;
    const cos = Math.cos(-stroke.rotation);
    const sin = Math.sin(-stroke.rotation);
    const dx = (pt.x - center.x) * w;
    const dy = (pt.y - center.y) * h;
    return {
      x: center.x + (dx * cos - dy * sin) / w,
      y: center.y + (dx * sin + dy * cos) / h
    };
  }

  // ===========================================================
  //  STROKE CREATION HELPERS
  // ===========================================================

  _createStroke(type, pt) {
    return {
      id: crypto.randomUUID(),
      type,
      color: this.color,
      lineWidth: type === 'highlighter' ? Math.max(20, this.lineWidth * 4) : this.lineWidth,
      points: [pt],
      start: { ...pt },
      end: { ...pt },
      text: '',
      fontSize: Math.max(14, this.lineWidth * 3),
      fillColor: (this.fillEnabled && ['rect', 'circle', 'highlighter'].includes(type)) ? this.color : null,
      fillOpacity: this.fillOpacity,
      strokeEnabled: type === 'highlighter' ? false : this.strokeEnabled,
      rotation: 0,
    };
  }

  // ===========================================================
  //  BOUNDING BOX
  // ===========================================================

  _getBounds(stroke) {
    let minX, minY, maxX, maxY;
    switch (stroke.type) {
      case 'pen':
      case 'highlighter': {
        if (!stroke.points.length) return null;
        minX = Infinity; minY = Infinity; maxX = -Infinity; maxY = -Infinity;
        for (const p of stroke.points) {
          if (p.x < minX) minX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.x > maxX) maxX = p.x;
          if (p.y > maxY) maxY = p.y;
        }
        // Pad by line width in normalized space
        const pad = this._pixelsToImageDist(stroke.lineWidth / 2 + 2);
        return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
      }
      case 'line':
      case 'arrow':
      case 'rect':
      case 'circle': {
        minX = Math.min(stroke.start.x, stroke.end.x);
        minY = Math.min(stroke.start.y, stroke.end.y);
        maxX = Math.max(stroke.start.x, stroke.end.x);
        maxY = Math.max(stroke.start.y, stroke.end.y);
        const pad2 = this._pixelsToImageDist(stroke.lineWidth / 2 + 2);
        return { minX: minX - pad2, minY: minY - pad2, maxX: maxX + pad2, maxY: maxY + pad2 };
      }
      case 'text': {
        // Estimate text bounds
        const fSize = stroke.fontSize || 16;
        const textLen = (stroke.text || '').length;
        const wEst = this._pixelsToImageDist(textLen * fSize * 0.6);
        const hEst = this._pixelsToImageDist(fSize * 1.3);
        return {
          minX: stroke.start.x - this._pixelsToImageDist(4),
          minY: stroke.start.y - hEst,
          maxX: stroke.start.x + wEst + this._pixelsToImageDist(4),
          maxY: stroke.start.y + this._pixelsToImageDist(4)
        };
      }
      case 'number': {
        const radius = this._pixelsToImageDist((stroke.fontSize || 18) * 0.75);
        return {
          minX: stroke.start.x - radius,
          minY: stroke.start.y - radius,
          maxX: stroke.start.x + radius,
          maxY: stroke.start.y + radius
        };
      }
      default:
        return null;
    }
  }

  _getBoundsCenter(stroke) {
    const b = this._getBounds(stroke);
    if (!b) return null;
    return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
  }

  // ===========================================================
  //  HIT TESTING
  // ===========================================================

  _hitTest(pt) {
    // Test strokes in reverse order (top-most first)
    for (let i = this.strokes.length - 1; i >= 0; i--) {
      if (this._hitTestStroke(this.strokes[i], pt)) {
        return this.strokes[i].id;
      }
    }
    return null;
  }

  _hitTestStroke(stroke, pt) {
    const testPt = this._unrotateForHitTest(pt, stroke);

    const threshold = this._pixelsToImageDist(stroke.lineWidth / 2 + 6);
    switch (stroke.type) {
      case 'pen':
      case 'highlighter': {
        for (let i = 1; i < stroke.points.length; i++) {
          if (this._distToSegment(testPt, stroke.points[i - 1], stroke.points[i]) < threshold) return true;
        }
        return false;
      }
      case 'line':
      case 'arrow':
        return this._distToSegment(testPt, stroke.start, stroke.end) < threshold;
      case 'rect': {
        const b = this._getBounds(stroke);
        if (!b) return false;
        // Inside fill area?
        if (stroke.fillColor && testPt.x >= b.minX && testPt.x <= b.maxX && testPt.y >= b.minY && testPt.y <= b.maxY) return true;
        // Near border?
        const s = stroke.start, e = stroke.end;
        const corners = [
          { x: s.x, y: s.y }, { x: e.x, y: s.y },
          { x: e.x, y: e.y }, { x: s.x, y: e.y }
        ];
        for (let i = 0; i < 4; i++) {
          if (this._distToSegment(testPt, corners[i], corners[(i + 1) % 4]) < threshold) return true;
        }
        return false;
      }
      case 'circle': {
        const cx = (stroke.start.x + stroke.end.x) / 2;
        const cy = (stroke.start.y + stroke.end.y) / 2;
        const rx = Math.abs(stroke.end.x - stroke.start.x) / 2;
        const ry = Math.abs(stroke.end.y - stroke.start.y) / 2;
        if (rx < 0.001 || ry < 0.001) return false;
        const dx = (testPt.x - cx) / rx;
        const dy = (testPt.y - cy) / ry;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (stroke.fillColor && dist <= 1) return true;
        return Math.abs(dist - 1) < threshold / Math.min(rx, ry);
      }
      case 'text': {
        const b = this._getBounds(stroke);
        return b && testPt.x >= b.minX && testPt.x <= b.maxX && testPt.y >= b.minY && testPt.y <= b.maxY;
      }
      case 'number': {
        const radius = this._pixelsToImageDist((stroke.fontSize || 18) * 0.75);
        const dx = testPt.x - stroke.start.x;
        const dy = testPt.y - stroke.start.y;
        return Math.sqrt(dx * dx + dy * dy) <= radius + threshold;
      }
      default:
        return false;
    }
  }

  _distToSegment(p, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.sqrt((p.x - a.x) ** 2 + (p.y - a.y) ** 2);
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const px = a.x + t * dx;
    const py = a.y + t * dy;
    return Math.sqrt((p.x - px) ** 2 + (p.y - py) ** 2);
  }

  // ===========================================================
  //  SELECTION
  // ===========================================================

  _getSelectedStroke() {
    if (!this.selectedId) return null;
    return this.strokes.find(s => s.id === this.selectedId) || null;
  }

  _clearSelection() {
    const hadSelection = !!this.selectedId;
    this.selectedId = null;
    this._dragMode = null;
    this._hoveredHandle = -1;
    if (hadSelection) this._onSelectionChange();
    this._requestRedraw();
  }

  /** Get the 8 handle positions in normalized image coords for a stroke */
  _getHandlePositions(stroke) {
    const b = this._getBounds(stroke);
    if (!b) return [];
    const { minX, minY, maxX, maxY } = b;
    const mx = (minX + maxX) / 2;
    const my = (minY + maxY) / 2;
    return [
      { x: minX, y: minY }, { x: mx, y: minY }, { x: maxX, y: minY },
      { x: minX, y: my },                         { x: maxX, y: my },
      { x: minX, y: maxY }, { x: mx, y: maxY }, { x: maxX, y: maxY },
    ];
  }

  /** Check which handle is under the point. Returns index 0-7 or -1 */
  _hitTestHandles(stroke, pt) {
    const testPt = this._unrotateForHitTest(pt, stroke);
    const handles = this._getHandlePositions(stroke);
    const handleSize = this._pixelsToImageDist(6);
    for (let i = 0; i < handles.length; i++) {
      const h = handles[i];
      if (Math.abs(testPt.x - h.x) < handleSize && Math.abs(testPt.y - h.y) < handleSize) {
        return i;
      }
    }
    return -1;
  }

  /** Check if point is over the delete button (above top-right corner) */
  _hitTestDeleteButton(stroke, pt) {
    const b = this._getBounds(stroke);
    if (!b) return false;
    const testPt = this._unrotateForHitTest(pt, stroke);
    const delSize = this._pixelsToImageDist(8);
    const cx = b.maxX;
    const cy = b.minY - this._pixelsToImageDist(14);
    return Math.abs(testPt.x - cx) < delSize && Math.abs(testPt.y - cy) < delSize;
  }

  /** Check if point is over the rotation handle (above top-center) */
  _hitTestRotationHandle(stroke, pt) {
    const b = this._getBounds(stroke);
    if (!b) return false;
    const testPt = this._unrotateForHitTest(pt, stroke);
    const handleDist = this._pixelsToImageDist(20);
    const hitSize = this._pixelsToImageDist(8);
    const cx = (b.minX + b.maxX) / 2;
    const cy = b.minY - handleDist;
    return Math.abs(testPt.x - cx) < hitSize && Math.abs(testPt.y - cy) < hitSize;
  }

  _snapshotStroke(stroke) {
    return JSON.parse(JSON.stringify(stroke));
  }

  _restoreStroke(id, snapshot) {
    const idx = this.strokes.findIndex(s => s.id === id);
    if (idx === -1) return;
    Object.assign(this.strokes[idx], snapshot);
  }

  // ===========================================================
  //  MOVE & RESIZE
  // ===========================================================

  _moveStroke(stroke, dx, dy) {
    if (stroke.points && stroke.points.length > 0) {
      for (const p of stroke.points) {
        p.x += dx;
        p.y += dy;
      }
    }
    if (stroke.start) {
      stroke.start.x += dx;
      stroke.start.y += dy;
    }
    if (stroke.end) {
      stroke.end.x += dx;
      stroke.end.y += dy;
    }
  }

  _resizeStroke(stroke, handleIdx, newPt, origBounds, origSnapshot) {
    // Determine which edges the handle affects
    const affectsLeft = [0, 3, 5].includes(handleIdx);
    const affectsRight = [2, 4, 7].includes(handleIdx);
    const affectsTop = [0, 1, 2].includes(handleIdx);
    const affectsBottom = [5, 6, 7].includes(handleIdx);

    let newMinX = origBounds.minX;
    let newMaxX = origBounds.maxX;
    let newMinY = origBounds.minY;
    let newMaxY = origBounds.maxY;

    if (affectsLeft) newMinX = Math.min(newPt.x, origBounds.maxX - this._pixelsToImageDist(10));
    if (affectsRight) newMaxX = Math.max(newPt.x, origBounds.minX + this._pixelsToImageDist(10));
    if (affectsTop) newMinY = Math.min(newPt.y, origBounds.maxY - this._pixelsToImageDist(10));
    if (affectsBottom) newMaxY = Math.max(newPt.y, origBounds.minY + this._pixelsToImageDist(10));

    const oW = origBounds.maxX - origBounds.minX;
    const oH = origBounds.maxY - origBounds.minY;
    const nW = newMaxX - newMinX;
    const nH = newMaxY - newMinY;

    if (oW < 0.0001 || oH < 0.0001) return;

    const scaleX = nW / oW;
    const scaleY = nH / oH;

    // Restore from snapshot and apply scaling
    const orig = origSnapshot;

    switch (stroke.type) {
      case 'pen':
      case 'highlighter': {
        for (let i = 0; i < stroke.points.length; i++) {
          stroke.points[i].x = newMinX + (orig.points[i].x - origBounds.minX) * scaleX;
          stroke.points[i].y = newMinY + (orig.points[i].y - origBounds.minY) * scaleY;
        }
        // Update start/end to match first/last point
        if (stroke.points.length > 0) {
          stroke.start = { ...stroke.points[0] };
          stroke.end = { ...stroke.points[stroke.points.length - 1] };
        }
        break;
      }
      case 'line':
      case 'arrow':
      case 'rect':
      case 'circle': {
        stroke.start.x = newMinX + (orig.start.x - origBounds.minX) * scaleX;
        stroke.start.y = newMinY + (orig.start.y - origBounds.minY) * scaleY;
        stroke.end.x = newMinX + (orig.end.x - origBounds.minX) * scaleX;
        stroke.end.y = newMinY + (orig.end.y - origBounds.minY) * scaleY;
        break;
      }
      case 'number':
      case 'text': {
        stroke.start.x = newMinX + (orig.start.x - origBounds.minX) * scaleX;
        stroke.start.y = newMinY + (orig.start.y - origBounds.minY) * scaleY;
        stroke.fontSize = Math.max(10, (orig.fontSize || 16) * Math.min(scaleX, scaleY));
        break;
      }
    }
  }

  // ===========================================================
  //  DRAWING HANDLERS
  // ===========================================================

  _handlePointerDown(e) {
    if (!this.viewer.isAnnotationMode) return;
    if (this._textEditor) return; // Don't draw while text editor is open

    const pt = this._screenToImage(e.clientX, e.clientY);

    // SELECT TOOL
    if (this.tool === 'select') {
      this._handleSelectPointerDown(pt, e);
      return;
    }

    // TEXT TOOL — constrain to image bounds
    if (this.tool === 'text') {
      if (!this._isInImageBounds(pt)) return;
      this._openTextEditor(pt, e.clientX, e.clientY);
      return;
    }

    // NUMBER TOOL — click-to-place numbered point
    if (this.tool === 'number') {
      if (!this._isInImageBounds(pt)) return;
      const stroke = {
        id: crypto.randomUUID(),
        type: 'number',
        color: this.color,
        lineWidth: this.lineWidth,
        text: String(this._nextNumber),
        start: { ...pt },
        end: { ...pt },
        fontSize: Math.max(18, this.lineWidth * 5),
        points: [],
        fillColor: null,
        fillOpacity: 0.3,
        strokeEnabled: true,
        rotation: 0,
      };
      this.strokes.push(stroke);
      this._pushUndo({ type: 'add', stroke });
      this._nextNumber++;
      this._requestRedraw();
      e.preventDefault();
      return;
    }

    // DRAWING TOOLS — constrain start to image bounds
    if (!this._isInImageBounds(pt)) return;

    this.isDrawing = true;
    this._clearSelection();
    this.currentStroke = this._createStroke(this.tool, pt);
    e.preventDefault();
  }

  _handlePointerMove(e) {
    if (!this.viewer.isAnnotationMode) return;

    const pt = this._screenToImage(e.clientX, e.clientY);

    // SELECT TOOL hover cursor
    if (this.tool === 'select' && !this._dragMode && !this.isDrawing) {
      this._updateSelectCursor(pt);
    }

    // DRAGGING (move/resize/rotate) in select mode
    if (this._dragMode) {
      this._handleSelectDrag(pt, e);
      return;
    }

    // DRAWING — clamp to image bounds
    if (!this.isDrawing || !this.currentStroke) return;

    const clamped = this._clampToImage(pt);
    if (this.tool === 'pen' || this.tool === 'highlighter') {
      this.currentStroke.points.push(clamped);
    }
    this.currentStroke.end = clamped;
    this._requestRedraw();
  }

  _handlePointerUp(e) {
    // Finish move/resize/rotate
    if (this._dragMode) {
      this._finishSelectDrag();
      return;
    }

    if (!this.isDrawing || !this.currentStroke) {
      this.isDrawing = false;
      return;
    }

    const pt = this._clampToImage(this._screenToImage(e.clientX, e.clientY));
    this.currentStroke.end = pt;

    if (this.tool === 'pen' || this.tool === 'highlighter') {
      this.currentStroke.points.push(pt);
    }

    this.strokes.push(this.currentStroke);
    this._pushUndo({ type: 'add', stroke: this.currentStroke });
    this.currentStroke = null;
    this.isDrawing = false;
    this._requestRedraw();
  }

  // ===========================================================
  //  SELECT TOOL POINTER HANDLING
  // ===========================================================

  _handleSelectPointerDown(pt, e) {
    const selected = this._getSelectedStroke();

    // If something is selected, check handles first
    if (selected) {
      // Delete button
      if (this._hitTestDeleteButton(selected, pt)) {
        this._deleteSelected();
        e.preventDefault();
        return;
      }
      // Rotation handle
      if (this._hitTestRotationHandle(selected, pt)) {
        this._dragMode = 'rotate';
        this._dragStart = pt;
        this._dragOrigData = this._snapshotStroke(selected);
        this._dragOrigRotation = selected.rotation || 0;
        const center = this._getBoundsCenter(selected);
        this._dragRotCenter = center;
        e.preventDefault();
        this.canvas.style.cursor = 'grabbing';
        return;
      }
      // Resize handle
      const handleIdx = this._hitTestHandles(selected, pt);
      if (handleIdx >= 0) {
        this._dragMode = 'resize';
        this._dragHandle = handleIdx;
        this._dragStart = pt;
        this._dragOrigData = this._snapshotStroke(selected);
        this._dragOrigBounds = this._getBounds(selected);
        e.preventDefault();
        return;
      }
      // Move (hit on the selected stroke body)
      if (this._hitTestStroke(selected, pt)) {
        this._dragMode = 'move';
        this._dragStart = pt;
        this._dragOrigData = this._snapshotStroke(selected);
        e.preventDefault();
        this.canvas.style.cursor = 'grabbing';
        return;
      }
    }

    // Try to select a new stroke
    const hitId = this._hitTest(pt);
    if (hitId) {
      this.selectedId = hitId;
      this._onSelectionChange();
      this._requestRedraw();
      // Start move immediately
      this._dragMode = 'move';
      this._dragStart = pt;
      this._dragOrigData = this._snapshotStroke(this._getSelectedStroke());
      e.preventDefault();
      this.canvas.style.cursor = 'grabbing';
      return;
    }

    // Clicked empty area - deselect
    this._clearSelection();
    e.preventDefault();
  }

  _handleSelectDrag(pt, e) {
    const stroke = this._getSelectedStroke();
    if (!stroke) { this._dragMode = null; return; }

    if (this._dragMode === 'move') {
      const dx = pt.x - this._dragStart.x;
      const dy = pt.y - this._dragStart.y;
      // Restore original and apply offset
      const orig = this._dragOrigData;
      if (stroke.points && orig.points) {
        for (let i = 0; i < stroke.points.length; i++) {
          stroke.points[i].x = orig.points[i].x + dx;
          stroke.points[i].y = orig.points[i].y + dy;
        }
      }
      if (orig.start) {
        stroke.start = { x: orig.start.x + dx, y: orig.start.y + dy };
      }
      if (orig.end) {
        stroke.end = { x: orig.end.x + dx, y: orig.end.y + dy };
      }
    } else if (this._dragMode === 'resize') {
      const resizePt = this._unrotateForHitTest(pt, stroke);
      this._resizeStroke(stroke, this._dragHandle, resizePt, this._dragOrigBounds, this._dragOrigData);
    } else if (this._dragMode === 'rotate') {
      const center = this._dragRotCenter;
      if (!center) return;
      const imgRect = this.viewer.img.getBoundingClientRect();
      const startAngle = Math.atan2((this._dragStart.y - center.y) * imgRect.height, (this._dragStart.x - center.x) * imgRect.width);
      const curAngle = Math.atan2((pt.y - center.y) * imgRect.height, (pt.x - center.x) * imgRect.width);
      let newRotation = this._dragOrigRotation + (curAngle - startAngle);
      // Shift-snap to 15 degree increments
      if (e && e.shiftKey) {
        const snap = Math.PI / 12; // 15 degrees
        newRotation = Math.round(newRotation / snap) * snap;
      }
      stroke.rotation = newRotation;
    }

    this._requestRedraw();
  }

  _finishSelectDrag() {
    const stroke = this._getSelectedStroke();
    if (stroke && this._dragOrigData) {
      const after = this._snapshotStroke(stroke);
      const type = this._dragMode === 'move' ? 'move' :
                   this._dragMode === 'resize' ? 'resize' : 'rotate';
      this._pushUndo({
        type,
        id: stroke.id,
        before: this._dragOrigData,
        after
      });
    }
    this._dragMode = null;
    this._dragStart = null;
    this._dragOrigData = null;
    this._dragOrigBounds = null;
    this._dragRotCenter = null;
    this._updateCursor();
    this._requestRedraw();
  }

  _updateSelectCursor(pt) {
    const selected = this._getSelectedStroke();
    if (selected) {
      if (this._hitTestDeleteButton(selected, pt)) {
        this.canvas.style.cursor = 'pointer';
        this._hoveredHandle = -1;
        return;
      }
      if (this._hitTestRotationHandle(selected, pt)) {
        this.canvas.style.cursor = 'grab';
        this._hoveredHandle = -1;
        return;
      }
      const handleIdx = this._hitTestHandles(selected, pt);
      if (handleIdx >= 0) {
        this.canvas.style.cursor = this._handleCursors[handleIdx];
        this._hoveredHandle = handleIdx;
        return;
      }
      if (this._hitTestStroke(selected, pt)) {
        this.canvas.style.cursor = 'move';
        this._hoveredHandle = -1;
        return;
      }
    }
    // Check hover on any stroke
    const hitId = this._hitTest(pt);
    this.canvas.style.cursor = hitId ? 'move' : 'default';
    this._hoveredHandle = -1;
  }

  _deleteSelected() {
    if (!this.selectedId) return;
    const idx = this.strokes.findIndex(s => s.id === this.selectedId);
    if (idx === -1) return;
    const stroke = this.strokes.splice(idx, 1)[0];
    this._pushUndo({ type: 'delete', stroke, index: idx });
    this._clearSelection();
  }

  // ===========================================================
  //  INLINE TEXT EDITOR
  // ===========================================================

  _openTextEditor(pt, screenX, screenY) {
    this._removeTextEditor();

    const canvasPt = this._imageToCanvas(pt.x, pt.y);
    const viewerRect = this.viewer.viewer.getBoundingClientRect();

    const editor = document.createElement('div');
    editor.className = 'iv-anno-text-input';
    editor.contentEditable = 'true';
    editor.spellcheck = false;

    const fontSize = Math.max(14, this.lineWidth * 3);
    editor.style.left = (viewerRect.left + canvasPt.x) + 'px';
    editor.style.top = (viewerRect.top + canvasPt.y) + 'px';
    editor.style.fontSize = fontSize + 'px';
    editor.style.color = this.color;

    document.body.appendChild(editor);
    this._textEditor = editor;
    this._textEditorPt = pt;
    this._textEditorFontSize = fontSize;

    // Focus after append
    requestAnimationFrame(() => {
      editor.focus();
    });

    // Handle Enter to commit, Escape to cancel
    editor.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this._commitTextEditor();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this._removeTextEditor();
      }
      e.stopPropagation();
    });

    // Prevent clicks from closing overlay
    editor.addEventListener('mousedown', e => e.stopPropagation());
    editor.addEventListener('click', e => e.stopPropagation());
    editor.addEventListener('pointerdown', e => e.stopPropagation());
  }

  _commitTextEditor() {
    if (!this._textEditor) return;
    const text = this._textEditor.textContent.trim();

    if (this._editingStrokeId) {
      // Editing existing text annotation
      const stroke = this.strokes.find(s => s.id === this._editingStrokeId);
      if (stroke && text) {
        stroke.text = text;
        this._pushUndo({ type: 'edit', id: this._editingStrokeId, before: this._editingStrokeBefore, after: this._snapshotStroke(stroke) });
      } else if (stroke && !text) {
        // Empty text — delete the annotation
        const idx = this.strokes.indexOf(stroke);
        if (idx >= 0) {
          this.strokes.splice(idx, 1);
          this._pushUndo({ type: 'delete', stroke: this._editingStrokeBefore, index: idx });
          if (this.selectedId === this._editingStrokeId) this._clearSelection();
        }
      }
      this._editingStrokeId = null;
      this._editingStrokeBefore = null;
    } else if (text) {
      // New text annotation
      const stroke = {
        id: crypto.randomUUID(),
        type: 'text',
        color: this.color,
        lineWidth: this.lineWidth,
        text,
        start: this._textEditorPt,
        end: this._textEditorPt,
        fontSize: this._textEditorFontSize,
        points: [],
        fillColor: null,
        fillOpacity: 0.3,
        strokeEnabled: true,
        rotation: 0,
      };
      this.strokes.push(stroke);
      this._pushUndo({ type: 'add', stroke });
    }

    this._removeTextEditor();
    this._requestRedraw();
  }

  _removeTextEditor() {
    if (this._textEditor) {
      this._textEditor.remove();
      this._textEditor = null;
      this._textEditorPt = null;
    }
    // Clear editing state (harmless if not editing)
    this._editingStrokeId = null;
    this._editingStrokeBefore = null;
  }

  /** Handle double-click on canvas for text editing */
  _handleCanvasDblClick(e) {
    if (!this.viewer.isAnnotationMode) return;
    if (this.tool !== 'select') return;
    if (this._textEditor) return;

    const pt = this._screenToImage(e.clientX, e.clientY);

    // Check selected stroke first
    const selected = this._getSelectedStroke();
    if (selected && (selected.type === 'text' || selected.type === 'number') && this._hitTestStroke(selected, pt)) {
      e.stopPropagation();
      this._editTextStroke(selected);
      return;
    }

    // Find any text annotation under cursor
    for (let i = this.strokes.length - 1; i >= 0; i--) {
      const stroke = this.strokes[i];
      if ((stroke.type === 'text' || stroke.type === 'number') && this._hitTestStroke(stroke, pt)) {
        this.selectedId = stroke.id;
        this._onSelectionChange();
        e.stopPropagation();
        this._editTextStroke(stroke);
        return;
      }
    }
  }

  /** Open inline editor pre-populated with existing text annotation content */
  _editTextStroke(stroke) {
    this._removeTextEditor();

    const canvasPt = this._imageToCanvas(stroke.start.x, stroke.start.y);
    const viewerRect = this.viewer.viewer.getBoundingClientRect();

    const editor = document.createElement('div');
    editor.className = 'iv-anno-text-input';
    editor.contentEditable = 'true';
    editor.spellcheck = false;

    const fontSize = stroke.fontSize || 16;
    editor.style.left = (viewerRect.left + canvasPt.x) + 'px';
    editor.style.top = (viewerRect.top + canvasPt.y) + 'px';
    editor.style.fontSize = fontSize + 'px';
    editor.style.color = stroke.color;
    editor.textContent = stroke.text || '';

    document.body.appendChild(editor);
    this._textEditor = editor;
    this._textEditorPt = { ...stroke.start };
    this._textEditorFontSize = fontSize;
    this._editingStrokeId = stroke.id;
    this._editingStrokeBefore = this._snapshotStroke(stroke);

    requestAnimationFrame(() => {
      editor.focus();
      // Select all text for easy replacement
      const range = document.createRange();
      range.selectNodeContents(editor);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    });

    editor.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this._commitTextEditor();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this._removeTextEditor();
        this._requestRedraw();
      }
      e.stopPropagation();
    });

    editor.addEventListener('mousedown', e => e.stopPropagation());
    editor.addEventListener('click', e => e.stopPropagation());
    editor.addEventListener('pointerdown', e => e.stopPropagation());
    this._requestRedraw();
  }

  // ===========================================================
  //  CURSOR FEEDBACK
  // ===========================================================

  _updateCursor() {
    if (!this.canvas) return;
    switch (this.tool) {
      case 'select':
        this.canvas.style.cursor = 'default';
        break;
      case 'text':
        this.canvas.style.cursor = 'text';
        break;
      case 'highlighter':
        this.canvas.style.cursor = 'crosshair';
        break;
      default:
        this.canvas.style.cursor = 'crosshair';
    }
  }

  // ===========================================================
  //  KEYBOARD HANDLING (called from image_viewer.js)
  // ===========================================================

  /** Returns true if the key was handled by the annotation module */
  handleKeyDown(e) {
    // Don't intercept if typing in text editor
    if (this._textEditor) return false;
    if (e.target.isContentEditable) return false;

    const key = e.key;

    // Tool shortcuts
    switch (key) {
      case 'v': case 'V': this._selectTool('select'); e.preventDefault(); return true;
      case 'p': case 'P': this._selectTool('pen'); e.preventDefault(); return true;
      case 'l': case 'L': this._selectTool('line'); e.preventDefault(); return true;
      case 't': case 'T': this._selectTool('text'); e.preventDefault(); return true;
      case 'n': case 'N': this._selectTool('number'); e.preventDefault(); return true;
      case 'h': case 'H': this._selectTool('highlighter'); e.preventDefault(); return true;
    }

    // Delete selected annotation
    if ((key === 'Delete' || key === 'Backspace') && this.selectedId) {
      this._deleteSelected();
      e.preventDefault();
      return true;
    }

    // Stroke width: [ and ]
    if (key === '[') {
      const selected = this._getSelectedStroke();
      if (selected) {
        const before = this._snapshotStroke(selected);
        selected.lineWidth = Math.max(1, selected.lineWidth - 1);
        this._pushUndo({ type: 'edit', id: selected.id, before, after: this._snapshotStroke(selected) });
        this._syncToolbarToStroke(selected);
        this._requestRedraw();
      } else {
        this.lineWidth = Math.max(1, this.lineWidth - 1);
        this._updateSliderUI();
      }
      e.preventDefault();
      return true;
    }
    if (key === ']') {
      const selected = this._getSelectedStroke();
      if (selected) {
        const before = this._snapshotStroke(selected);
        selected.lineWidth = Math.min(20, selected.lineWidth + 1);
        this._pushUndo({ type: 'edit', id: selected.id, before, after: this._snapshotStroke(selected) });
        this._syncToolbarToStroke(selected);
        this._requestRedraw();
      } else {
        this.lineWidth = Math.min(20, this.lineWidth + 1);
        this._updateSliderUI();
      }
      e.preventDefault();
      return true;
    }

    return false;
  }

  /** Returns true if Escape was consumed (deselected something) */
  handleEscape() {
    if (this._textEditor) {
      this._removeTextEditor();
      return true;
    }
    if (this.selectedId) {
      this._clearSelection();
      return true;
    }
    return false;
  }

  _updateSliderUI() {
    if (!this.toolbar) return;
    const slider = this.toolbar.querySelector('.iv-anno-slider');
    const val = this.toolbar.querySelector('.iv-anno-slider__value');
    if (slider) slider.value = this.lineWidth;
    if (val) val.textContent = `${this.lineWidth}px`;
  }

  // ===========================================================
  //  RENDERING
  // ===========================================================

  _requestRedraw() {
    if (this._animFrame) return;
    this._animFrame = requestAnimationFrame(() => {
      this._animFrame = null;
      this._redraw();
    });
  }

  _redraw() {
    if (!this.ctx || !this.canvas) return;
    this._resizeCanvasIfNeeded();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this.visible) return;

    // Draw all strokes (skip stroke being text-edited — editor overlays it)
    for (const stroke of this.strokes) {
      if (this._editingStrokeId === stroke.id) continue;
      this._renderStroke(stroke, this.ctx, false);
    }

    // Ghost preview of current stroke
    if (this.currentStroke) {
      this._renderGhostStroke(this.currentStroke);
    }

    // Selection overlay
    if (this.selectedId) {
      const stroke = this._getSelectedStroke();
      if (stroke) this._renderSelection(stroke);
    }
  }

  _renderStroke(stroke, ctx, isExport) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const toCanvas = isExport ? null : (ix, iy) => this._imageToCanvas(ix, iy);

    // Apply rotation if present
    if (stroke.rotation) {
      const center = this._getBoundsCenter(stroke);
      if (center) {
        const canvasCenter = isExport ? null : this._imageToCanvas(center.x, center.y);
        if (!isExport && canvasCenter) {
          ctx.translate(canvasCenter.x, canvasCenter.y);
          ctx.rotate(stroke.rotation);
          ctx.translate(-canvasCenter.x, -canvasCenter.y);
        }
      }
    }

    switch (stroke.type) {
      case 'pen': this._renderPen(stroke, ctx, toCanvas, isExport); break;
      case 'line': this._renderLine(stroke, ctx, toCanvas, isExport); break;
      case 'arrow': this._renderArrow(stroke, ctx, toCanvas, isExport); break;
      case 'rect': this._renderRect(stroke, ctx, toCanvas, isExport); break;
      case 'circle': this._renderCircle(stroke, ctx, toCanvas, isExport); break;
      case 'text': this._renderText(stroke, ctx, toCanvas, isExport); break;
      case 'number': this._renderNumber(stroke, ctx, toCanvas, isExport); break;
      case 'highlighter': this._renderHighlighter(stroke, ctx, toCanvas, isExport); break;
    }

    ctx.restore();
  }

  _renderPen(stroke, ctx, toCanvas) {
    if (stroke.points.length < 2) return;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.lineWidth;
    ctx.beginPath();
    const first = toCanvas ? toCanvas(stroke.points[0].x, stroke.points[0].y) : stroke.points[0];
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < stroke.points.length; i++) {
      const p = toCanvas ? toCanvas(stroke.points[i].x, stroke.points[i].y) : stroke.points[i];
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }

  _renderLine(stroke, ctx, toCanvas) {
    const a = toCanvas ? toCanvas(stroke.start.x, stroke.start.y) : stroke.start;
    const b = toCanvas ? toCanvas(stroke.end.x, stroke.end.y) : stroke.end;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.lineWidth;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  _renderArrow(stroke, ctx, toCanvas) {
    const a = toCanvas ? toCanvas(stroke.start.x, stroke.start.y) : stroke.start;
    const b = toCanvas ? toCanvas(stroke.end.x, stroke.end.y) : stroke.end;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.lineWidth;
    // Shaft
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    // Filled arrowhead
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const headLen = 12 + stroke.lineWidth * 2;
    ctx.fillStyle = stroke.color;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - headLen * Math.cos(angle - 0.35), b.y - headLen * Math.sin(angle - 0.35));
    ctx.lineTo(b.x - headLen * Math.cos(angle + 0.35), b.y - headLen * Math.sin(angle + 0.35));
    ctx.closePath();
    ctx.fill();
  }

  _renderRect(stroke, ctx, toCanvas) {
    const a = toCanvas ? toCanvas(stroke.start.x, stroke.start.y) : stroke.start;
    const b = toCanvas ? toCanvas(stroke.end.x, stroke.end.y) : stroke.end;
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    const w = Math.abs(b.x - a.x);
    const h = Math.abs(b.y - a.y);

    // Fill
    if (stroke.fillColor) {
      ctx.save();
      ctx.globalAlpha = stroke.fillOpacity;
      ctx.fillStyle = stroke.fillColor;
      ctx.fillRect(x, y, w, h);
      ctx.restore();
    }
    // Stroke
    if (stroke.strokeEnabled) {
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.lineWidth;
      ctx.strokeRect(x, y, w, h);
    }
  }

  _renderCircle(stroke, ctx, toCanvas) {
    const a = toCanvas ? toCanvas(stroke.start.x, stroke.start.y) : stroke.start;
    const b = toCanvas ? toCanvas(stroke.end.x, stroke.end.y) : stroke.end;
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    const rx = Math.abs(b.x - a.x) / 2;
    const ry = Math.abs(b.y - a.y) / 2;
    if (rx < 0.5 && ry < 0.5) return;

    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(rx, 0.5), Math.max(ry, 0.5), 0, 0, Math.PI * 2);

    if (stroke.fillColor) {
      ctx.save();
      ctx.globalAlpha = stroke.fillOpacity;
      ctx.fillStyle = stroke.fillColor;
      ctx.fill();
      ctx.restore();
    }
    if (stroke.strokeEnabled) {
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.lineWidth;
      ctx.stroke();
    }
  }

  _renderText(stroke, ctx, toCanvas) {
    const p = toCanvas ? toCanvas(stroke.start.x, stroke.start.y) : stroke.start;
    const fontSize = stroke.fontSize || 16;
    ctx.font = `bold ${fontSize}px 'Courier New', Courier, monospace`;

    const text = stroke.text || '';
    const metrics = ctx.measureText(text);
    const textW = metrics.width;
    const textH = fontSize * 1.2;

    // Background pill
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#000000';
    const padX = 4;
    const padY = 4;
    const bgX = p.x - padX;
    const bgY = p.y - textH + padY / 2;
    const bgW = textW + padX * 2;
    const bgH = textH + padY;
    ctx.beginPath();
    ctx.roundRect(bgX, bgY, bgW, bgH, 4);
    ctx.fill();
    ctx.restore();

    // Text
    ctx.fillStyle = stroke.color;
    ctx.fillText(text, p.x, p.y);
  }

  _renderNumber(stroke, ctx, toCanvas) {
    const center = toCanvas ? toCanvas(stroke.start.x, stroke.start.y) : stroke.start;
    const fontSize = stroke.fontSize || 18;
    const radius = fontSize * 0.75;
    const text = stroke.text || '1';

    // Dark semi-transparent circle background
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Colored border ring
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Colored number text centered
    ctx.fillStyle = stroke.color;
    ctx.font = `bold ${fontSize}px 'Courier New', Courier, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, center.x, center.y);
  }

  _renderHighlighter(stroke, ctx, toCanvas) {
    if (stroke.points.length < 2) return;
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = stroke.fillColor || stroke.color;
    ctx.lineWidth = stroke.lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const first = toCanvas ? toCanvas(stroke.points[0].x, stroke.points[0].y) : stroke.points[0];
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < stroke.points.length; i++) {
      const p = toCanvas ? toCanvas(stroke.points[i].x, stroke.points[i].y) : stroke.points[i];
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // ===========================================================
  //  GHOST PREVIEW
  // ===========================================================

  _renderGhostStroke(stroke) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.setLineDash([6, 4]);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (stroke.type) {
      case 'pen':
      case 'highlighter': {
        // For pen/highlighter, draw solid (no dash) but at reduced opacity
        ctx.setLineDash([]);
        if (stroke.type === 'highlighter') {
          ctx.globalAlpha = 0.15;
          ctx.strokeStyle = stroke.fillColor || stroke.color;
        } else {
          ctx.strokeStyle = stroke.color;
        }
        ctx.lineWidth = stroke.lineWidth;
        if (stroke.points.length >= 2) {
          ctx.beginPath();
          const first = this._imageToCanvas(stroke.points[0].x, stroke.points[0].y);
          ctx.moveTo(first.x, first.y);
          for (let i = 1; i < stroke.points.length; i++) {
            const p = this._imageToCanvas(stroke.points[i].x, stroke.points[i].y);
            ctx.lineTo(p.x, p.y);
          }
          ctx.stroke();
        }
        break;
      }
      case 'line': {
        const a = this._imageToCanvas(stroke.start.x, stroke.start.y);
        const b = this._imageToCanvas(stroke.end.x, stroke.end.y);
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.lineWidth;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        break;
      }
      case 'arrow': {
        const a = this._imageToCanvas(stroke.start.x, stroke.start.y);
        const b = this._imageToCanvas(stroke.end.x, stroke.end.y);
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.lineWidth;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        // Arrow head ghost
        const angle = Math.atan2(b.y - a.y, b.x - a.x);
        const headLen = 12 + stroke.lineWidth * 2;
        ctx.setLineDash([]);
        ctx.fillStyle = stroke.color;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - headLen * Math.cos(angle - 0.35), b.y - headLen * Math.sin(angle - 0.35));
        ctx.lineTo(b.x - headLen * Math.cos(angle + 0.35), b.y - headLen * Math.sin(angle + 0.35));
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'rect': {
        const a = this._imageToCanvas(stroke.start.x, stroke.start.y);
        const b = this._imageToCanvas(stroke.end.x, stroke.end.y);
        const x = Math.min(a.x, b.x);
        const y = Math.min(a.y, b.y);
        const w = Math.abs(b.x - a.x);
        const h = Math.abs(b.y - a.y);
        if (stroke.fillColor) {
          ctx.save();
          ctx.globalAlpha = stroke.fillOpacity * 0.5;
          ctx.fillStyle = stroke.fillColor;
          ctx.setLineDash([]);
          ctx.fillRect(x, y, w, h);
          ctx.restore();
          ctx.globalAlpha = 0.5;
        }
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.lineWidth;
        ctx.strokeRect(x, y, w, h);
        break;
      }
      case 'circle': {
        const a = this._imageToCanvas(stroke.start.x, stroke.start.y);
        const b = this._imageToCanvas(stroke.end.x, stroke.end.y);
        const cx = (a.x + b.x) / 2;
        const cy = (a.y + b.y) / 2;
        const rx = Math.abs(b.x - a.x) / 2;
        const ry = Math.abs(b.y - a.y) / 2;
        if (rx < 0.5 && ry < 0.5) break;
        ctx.beginPath();
        ctx.ellipse(cx, cy, Math.max(rx, 0.5), Math.max(ry, 0.5), 0, 0, Math.PI * 2);
        if (stroke.fillColor) {
          ctx.save();
          ctx.globalAlpha = stroke.fillOpacity * 0.5;
          ctx.fillStyle = stroke.fillColor;
          ctx.setLineDash([]);
          ctx.fill();
          ctx.restore();
          ctx.globalAlpha = 0.5;
        }
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.lineWidth;
        ctx.stroke();
        break;
      }
    }

    ctx.restore();
  }

  // ===========================================================
  //  SELECTION RENDERING
  // ===========================================================

  _renderSelection(stroke) {
    const ctx = this.ctx;
    const b = this._getBounds(stroke);
    if (!b) return;

    const accent = this._getAccentColor();

    ctx.save();

    // Apply rotation around bounds center if rotated
    if (stroke.rotation) {
      const center = this._getBoundsCenter(stroke);
      if (center) {
        const canvasCenter = this._imageToCanvas(center.x, center.y);
        ctx.translate(canvasCenter.x, canvasCenter.y);
        ctx.rotate(stroke.rotation);
        ctx.translate(-canvasCenter.x, -canvasCenter.y);
      }
    }

    const tl = this._imageToCanvas(b.minX, b.minY);
    const br = this._imageToCanvas(b.maxX, b.maxY);
    const x = tl.x;
    const y = tl.y;
    const w = br.x - tl.x;
    const h = br.y - tl.y;

    // Dashed bounding box
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);

    // Rotation handle: dashed line + circle 20px above top-center
    const rotHandleX = x + w / 2;
    const rotHandleY = y - 20;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(rotHandleX, rotHandleY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Rotation handle circle
    ctx.beginPath();
    ctx.arc(rotHandleX, rotHandleY, 5, 0, Math.PI * 2);
    ctx.fillStyle = accent;
    ctx.fill();
    ctx.strokeStyle = 'var(--iv-bg-solid, #121212)';
    // Can't use CSS vars in canvas, use bg-solid fallback
    ctx.strokeStyle = this._getBgColor();
    ctx.lineWidth = 1;
    ctx.stroke();

    // Resize handles
    const handles = this._getHandlePositions(stroke);
    const hs = 8; // handle size in pixels
    for (let i = 0; i < handles.length; i++) {
      const hp = this._imageToCanvas(handles[i].x, handles[i].y);
      ctx.fillStyle = accent;
      ctx.strokeStyle = this._getBgColor();
      ctx.lineWidth = 1;
      ctx.fillRect(hp.x - hs / 2, hp.y - hs / 2, hs, hs);
      ctx.strokeRect(hp.x - hs / 2, hp.y - hs / 2, hs, hs);
    }

    // Delete button (circle with x above top-right)
    const delR = 7;
    const delX = br.x;
    const delY = tl.y - 14;
    ctx.beginPath();
    ctx.arc(delX, delY, delR, 0, Math.PI * 2);
    ctx.fillStyle = '#ff3333';
    ctx.fill();
    ctx.strokeStyle = this._getBgColor();
    ctx.lineWidth = 1;
    ctx.stroke();
    // X mark
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    const xr = 3;
    ctx.beginPath();
    ctx.moveTo(delX - xr, delY - xr);
    ctx.lineTo(delX + xr, delY + xr);
    ctx.moveTo(delX + xr, delY - xr);
    ctx.lineTo(delX - xr, delY + xr);
    ctx.stroke();

    ctx.restore();
  }

  _getBgColor() {
    const style = getComputedStyle(document.documentElement);
    return style.getPropertyValue('--theme-bg').trim() || '#121212';
  }

  // ===========================================================
  //  UNDO / REDO / CLEAR
  // ===========================================================

  _pushUndo(action) {
    this.undoStack.push(action);
    if (this.undoStack.length > this._maxUndo) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  undo() {
    if (this.undoStack.length === 0) return;
    const action = this.undoStack.pop();
    this._undoAction(action);
    this.redoStack.push(action);
    this._requestRedraw();
  }

  redo() {
    if (this.redoStack.length === 0) return;
    const action = this.redoStack.pop();
    this._redoAction(action);
    this.undoStack.push(action);
    this._requestRedraw();
  }

  _undoAction(action) {
    switch (action.type) {
      case 'add': {
        const idx = this.strokes.findIndex(s => s.id === action.stroke.id);
        if (idx >= 0) this.strokes.splice(idx, 1);
        if (this.selectedId === action.stroke.id) this._clearSelection();
        break;
      }
      case 'delete': {
        const insertIdx = Math.min(action.index, this.strokes.length);
        this.strokes.splice(insertIdx, 0, action.stroke);
        break;
      }
      case 'move':
      case 'resize':
      case 'rotate':
      case 'edit': {
        const stroke = this.strokes.find(s => s.id === action.id);
        if (stroke) {
          Object.assign(stroke, JSON.parse(JSON.stringify(action.before)));
        }
        // Sync toolbar if this stroke is selected
        if (this.selectedId === action.id) {
          const updated = this._getSelectedStroke();
          if (updated) this._syncToolbarToStroke(updated);
        }
        break;
      }
    }
  }

  _redoAction(action) {
    switch (action.type) {
      case 'add': {
        this.strokes.push(action.stroke);
        break;
      }
      case 'delete': {
        const idx = this.strokes.findIndex(s => s.id === action.stroke.id);
        if (idx >= 0) this.strokes.splice(idx, 1);
        break;
      }
      case 'move':
      case 'resize':
      case 'rotate':
      case 'edit': {
        const stroke = this.strokes.find(s => s.id === action.id);
        if (stroke) {
          Object.assign(stroke, JSON.parse(JSON.stringify(action.after)));
        }
        if (this.selectedId === action.id) {
          const updated = this._getSelectedStroke();
          if (updated) this._syncToolbarToStroke(updated);
        }
        break;
      }
    }
  }

  clearAll() {
    if (this.strokes.length === 0) return;
    // Push all strokes as individual delete actions for undo
    for (let i = this.strokes.length - 1; i >= 0; i--) {
      this.undoStack.push({ type: 'delete', stroke: this.strokes[i], index: i });
    }
    if (this.undoStack.length > this._maxUndo) {
      this.undoStack.splice(0, this.undoStack.length - this._maxUndo);
    }
    this.strokes = [];
    this.redoStack = [];
    this._nextNumber = 1;
    this._clearSelection();
    this._requestRedraw();
  }

  toggleVisibility() {
    this.visible = !this.visible;
    const icon = this.toolbar.querySelector('.iv-anno-toggle-vis i');
    icon.className = this.visible ? 'fa fa-eye' : 'fa fa-eye-slash';
    this._requestRedraw();
  }

  hasAnnotations() {
    return this.strokes.length > 0;
  }

  // ===========================================================
  //  EXPORT RENDERING
  // ===========================================================

  renderToCanvas(targetCanvas, targetW, targetH) {
    const ctx = targetCanvas.getContext('2d');
    for (const stroke of this.strokes) {
      this._renderStrokeToExport(ctx, stroke, targetW, targetH);
    }
  }

  _renderStrokeToExport(ctx, stroke, w, h) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const scale = w / this.viewer.naturalWidth;
    const toPixel = (pt) => ({ x: pt.x * w, y: pt.y * h });

    // Apply rotation for export
    if (stroke.rotation) {
      const center = this._getBoundsCenter(stroke);
      if (center) {
        const pc = toPixel(center);
        ctx.translate(pc.x, pc.y);
        ctx.rotate(stroke.rotation);
        ctx.translate(-pc.x, -pc.y);
      }
    }

    switch (stroke.type) {
      case 'pen': {
        if (stroke.points.length < 2) break;
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.lineWidth * scale;
        ctx.beginPath();
        const first = toPixel(stroke.points[0]);
        ctx.moveTo(first.x, first.y);
        for (let i = 1; i < stroke.points.length; i++) {
          const p = toPixel(stroke.points[i]);
          ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
        break;
      }
      case 'line': {
        const a = toPixel(stroke.start);
        const b = toPixel(stroke.end);
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.lineWidth * scale;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        break;
      }
      case 'arrow': {
        const a = toPixel(stroke.start);
        const b = toPixel(stroke.end);
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.lineWidth * scale;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        const angle = Math.atan2(b.y - a.y, b.x - a.x);
        const headLen = (12 + stroke.lineWidth * 2) * scale;
        ctx.fillStyle = stroke.color;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - headLen * Math.cos(angle - 0.35), b.y - headLen * Math.sin(angle - 0.35));
        ctx.lineTo(b.x - headLen * Math.cos(angle + 0.35), b.y - headLen * Math.sin(angle + 0.35));
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'rect': {
        const a = toPixel(stroke.start);
        const b = toPixel(stroke.end);
        const x = Math.min(a.x, b.x);
        const y = Math.min(a.y, b.y);
        const rw = Math.abs(b.x - a.x);
        const rh = Math.abs(b.y - a.y);
        if (stroke.fillColor) {
          ctx.save();
          ctx.globalAlpha = stroke.fillOpacity;
          ctx.fillStyle = stroke.fillColor;
          ctx.fillRect(x, y, rw, rh);
          ctx.restore();
        }
        if (stroke.strokeEnabled) {
          ctx.strokeStyle = stroke.color;
          ctx.lineWidth = stroke.lineWidth * scale;
          ctx.strokeRect(x, y, rw, rh);
        }
        break;
      }
      case 'circle': {
        const a = toPixel(stroke.start);
        const b = toPixel(stroke.end);
        const cx = (a.x + b.x) / 2;
        const cy = (a.y + b.y) / 2;
        const rx = Math.abs(b.x - a.x) / 2;
        const ry = Math.abs(b.y - a.y) / 2;
        if (rx < 0.5 && ry < 0.5) break;
        ctx.beginPath();
        ctx.ellipse(cx, cy, Math.max(rx, 0.5), Math.max(ry, 0.5), 0, 0, Math.PI * 2);
        if (stroke.fillColor) {
          ctx.save();
          ctx.globalAlpha = stroke.fillOpacity;
          ctx.fillStyle = stroke.fillColor;
          ctx.fill();
          ctx.restore();
        }
        if (stroke.strokeEnabled) {
          ctx.strokeStyle = stroke.color;
          ctx.lineWidth = stroke.lineWidth * scale;
          ctx.stroke();
        }
        break;
      }
      case 'text': {
        const p = toPixel(stroke.start);
        const fontSize = (stroke.fontSize || 16) * scale;
        ctx.font = `bold ${fontSize}px 'Courier New', Courier, monospace`;
        const text = stroke.text || '';
        const metrics = ctx.measureText(text);
        const textW = metrics.width;
        const textH = fontSize * 1.2;
        // Background pill
        ctx.save();
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = '#000000';
        const padX = 4 * scale;
        const padY = 4 * scale;
        const bgX = p.x - padX;
        const bgY = p.y - textH + padY / 2;
        const bgW = textW + padX * 2;
        const bgH = textH + padY;
        ctx.beginPath();
        ctx.roundRect(bgX, bgY, bgW, bgH, 4 * scale);
        ctx.fill();
        ctx.restore();
        // Text
        ctx.fillStyle = stroke.color;
        ctx.fillText(text, p.x, p.y);
        break;
      }
      case 'number': {
        const center = toPixel(stroke.start);
        const fontSize = (stroke.fontSize || 18) * scale;
        const radius = fontSize * 0.75;
        const text = stroke.text || '1';
        // Dark semi-transparent circle background
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        // Colored border ring
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = 2 * scale;
        ctx.beginPath();
        ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        // Colored number text centered
        ctx.fillStyle = stroke.color;
        ctx.font = `bold ${fontSize}px 'Courier New', Courier, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, center.x, center.y);
        break;
      }
      case 'highlighter': {
        if (stroke.points.length < 2) break;
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = stroke.fillColor || stroke.color;
        ctx.lineWidth = stroke.lineWidth * scale;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        const first = toPixel(stroke.points[0]);
        ctx.moveTo(first.x, first.y);
        for (let i = 1; i < stroke.points.length; i++) {
          const p = toPixel(stroke.points[i]);
          ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
        ctx.restore();
        break;
      }
    }

    ctx.restore();
  }
}
