/**
 * video_filters.js - Color filter slider panel (6 CSS filters)
 * Slide-up panel above timeline with real-time CSS filter preview.
 */

export class VideoFilters {
  constructor(editor) {
    this.editor = editor;
    this.panel = null;
    this._sliders = {};
  }

  open() {
    if (!this.panel) this._create();
    this.updateSliders();
    this.panel.style.display = '';
  }

  close() {
    if (this.panel) this.panel.style.display = 'none';
  }

  updateSliders() {
    if (!this.panel) return;
    const f = this.editor.filters;
    this._setSlider('brightness', f.brightness);
    this._setSlider('contrast', f.contrast);
    this._setSlider('saturate', f.saturate);
    this._setSlider('hueRotate', f.hueRotate);
    this._setSlider('blur', f.blur);
    this._setSlider('sepia', f.sepia);
  }

  _setSlider(name, value) {
    const entry = this._sliders[name];
    if (!entry) return;
    entry.input.value = value;
    entry.display.textContent = entry.format(value);
  }

  _create() {
    this.panel = document.createElement('div');
    this.panel.className = 've-filter-panel';

    const filters = [
      { key: 'brightness', label: 'Brightness', min: 0,   max: 300, step: 1, def: 100, format: v => `${v}%` },
      { key: 'contrast',   label: 'Contrast',   min: 0,   max: 300, step: 1, def: 100, format: v => `${v}%` },
      { key: 'saturate',   label: 'Saturation',  min: 0,   max: 300, step: 1, def: 100, format: v => `${v}%` },
      { key: 'hueRotate',  label: 'Hue Rotate',  min: 0,   max: 360, step: 1, def: 0,   format: v => `${v}deg` },
      { key: 'blur',       label: 'Blur',        min: 0,   max: 20,  step: 0.1, def: 0, format: v => `${v}px` },
      { key: 'sepia',      label: 'Sepia',       min: 0,   max: 100, step: 1, def: 0,   format: v => `${v}%` }
    ];

    let rowsHTML = '';
    for (const f of filters) {
      rowsHTML += `
        <div class="ve-filter-row">
          <label>${f.label}</label>
          <input type="range" class="ve-filter-slider" data-key="${f.key}"
                 min="${f.min}" max="${f.max}" step="${f.step}" value="${f.def}">
          <span class="ve-filter-value" data-key="${f.key}">${f.format(f.def)}</span>
        </div>
      `;
    }

    this.panel.innerHTML = `
      <div class="ve-filter-header">
        <span>Filters</span>
        <button class="ve-btn ve-filter-close"><i class="fa fa-xmark"></i></button>
      </div>
      <div class="ve-filter-body">
        ${rowsHTML}
        <div class="ve-filter-actions">
          <button class="ve-btn ve-filter-reset"><i class="fa fa-rotate-left"></i> Reset</button>
        </div>
      </div>
    `;

    this.editor.overlay.appendChild(this.panel);

    // Cache slider refs
    for (const f of filters) {
      const input = this.panel.querySelector(`.ve-filter-slider[data-key="${f.key}"]`);
      const display = this.panel.querySelector(`.ve-filter-value[data-key="${f.key}"]`);
      this._sliders[f.key] = { input, display, format: f.format, def: f.def };

      input.addEventListener('input', () => {
        const val = parseFloat(input.value);
        this.editor.filters[f.key] = val;
        display.textContent = f.format(val);
        this.editor.applyFilters();
      });
    }

    // Close button
    this.panel.querySelector('.ve-filter-close').addEventListener('click', () => {
      this.editor._closeFilters();
    });

    // Reset button
    this.panel.querySelector('.ve-filter-reset').addEventListener('click', () => {
      for (const f of filters) {
        this.editor.filters[f.key] = f.def;
      }
      this.updateSliders();
      this.editor.applyFilters();
    });

    // Prevent propagation
    this.panel.addEventListener('click', (e) => e.stopPropagation());
    this.panel.addEventListener('mousedown', (e) => e.stopPropagation());
  }
}
