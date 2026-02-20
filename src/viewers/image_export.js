/**
 * image_export.js - Export images in different formats/sizes with optional annotations
 */

export class ImageExport {
  constructor(imageViewer) {
    this.viewer = imageViewer;
    this.format = 'png';
    this.quality = 0.92;
    this.scaleOption = 1;
    this.customWidth = null;
    this.customHeight = null;
    this.lockRatio = true;
    this.includeAnnotations = true;
    this.panel = null;
  }

  open() {
    if (!this.panel) {
      this._createPanel();
    }
    this._updateQualityVisibility();
    this._updateAnnotationCheckbox();
    this._updateCustomSizeInputs();
    this.panel.style.display = '';
  }

  close() {
    if (this.panel) this.panel.style.display = 'none';
  }

  _createPanel() {
    this.panel = document.createElement('div');
    this.panel.className = 'iv-export-panel';
    this.panel.innerHTML = `
      <div class="iv-export-header">
        <span>Export Image</span>
        <button class="iv-btn iv-export-close"><i class="fa fa-xmark"></i></button>
      </div>
      <div class="iv-export-body">
        <div class="iv-export-row">
          <label>Format</label>
          <div class="iv-export-formats">
            <button class="iv-export-fmt iv-active" data-format="png">PNG</button>
            <button class="iv-export-fmt" data-format="jpg">JPG</button>
            <button class="iv-export-fmt" data-format="webp">WEBP</button>
          </div>
        </div>
        <div class="iv-export-row iv-quality-row">
          <label>Quality</label>
          <input type="range" class="iv-quality-slider" min="10" max="100" value="92" step="1">
          <span class="iv-quality-value">92%</span>
        </div>
        <div class="iv-export-row">
          <label>Size</label>
          <div class="iv-export-sizes">
            <button class="iv-export-size iv-active" data-scale="1">Original</button>
            <button class="iv-export-size" data-scale="0.5">50%</button>
            <button class="iv-export-size" data-scale="0.25">25%</button>
            <button class="iv-export-size" data-scale="custom">Custom</button>
          </div>
          <div class="iv-export-custom-size" style="display:none;">
            <input type="number" class="iv-custom-w" placeholder="Width" min="1">
            <span>x</span>
            <input type="number" class="iv-custom-h" placeholder="Height" min="1">
            <label><input type="checkbox" class="iv-lock-ratio" checked> Lock ratio</label>
          </div>
        </div>
        <div class="iv-export-row iv-export-include-annotations" style="display:none;">
          <label><input type="checkbox" class="iv-include-annotations" checked> Include annotations</label>
        </div>
        <div class="iv-export-actions">
          <button class="iv-btn iv-export-download"><i class="fa fa-download"></i> Download</button>
          <button class="iv-btn iv-export-clipboard"><i class="fa fa-clipboard"></i> Clipboard</button>
        </div>
      </div>
    `;

    this.viewer.overlay.appendChild(this.panel);
    this._bindEvents();

    // Prevent clicks from propagating to overlay
    this.panel.addEventListener('click', e => e.stopPropagation());
    this.panel.addEventListener('mousedown', e => e.stopPropagation());
  }

  _bindEvents() {
    // Format buttons
    this.panel.querySelectorAll('.iv-export-fmt').forEach(btn => {
      btn.addEventListener('click', () => {
        this.panel.querySelectorAll('.iv-export-fmt').forEach(b => b.classList.remove('iv-active'));
        btn.classList.add('iv-active');
        this.format = btn.dataset.format;
        this._updateQualityVisibility();
      });
    });

    // Quality slider
    const qualitySlider = this.panel.querySelector('.iv-quality-slider');
    const qualityVal = this.panel.querySelector('.iv-quality-value');
    qualitySlider.addEventListener('input', () => {
      this.quality = parseInt(qualitySlider.value) / 100;
      qualityVal.textContent = `${qualitySlider.value}%`;
    });

    // Size buttons
    this.panel.querySelectorAll('.iv-export-size').forEach(btn => {
      btn.addEventListener('click', () => {
        this.panel.querySelectorAll('.iv-export-size').forEach(b => b.classList.remove('iv-active'));
        btn.classList.add('iv-active');
        const scale = btn.dataset.scale;
        if (scale === 'custom') {
          this.scaleOption = null;
          this._showCustomSize();
        } else {
          this.scaleOption = parseFloat(scale);
          this.customWidth = null;
          this.customHeight = null;
          this._hideCustomSize();
        }
      });
    });

    // Custom size inputs
    const customW = this.panel.querySelector('.iv-custom-w');
    const customH = this.panel.querySelector('.iv-custom-h');
    const lockCheck = this.panel.querySelector('.iv-lock-ratio');

    customW.addEventListener('input', () => {
      this.customWidth = parseInt(customW.value) || null;
      if (this.lockRatio && this.customWidth && this.viewer.naturalWidth > 0) {
        this.customHeight = Math.round(this.customWidth * (this.viewer.naturalHeight / this.viewer.naturalWidth));
        customH.value = this.customHeight;
      }
    });

    customH.addEventListener('input', () => {
      this.customHeight = parseInt(customH.value) || null;
      if (this.lockRatio && this.customHeight && this.viewer.naturalHeight > 0) {
        this.customWidth = Math.round(this.customHeight * (this.viewer.naturalWidth / this.viewer.naturalHeight));
        customW.value = this.customWidth;
      }
    });

    lockCheck.addEventListener('change', () => {
      this.lockRatio = lockCheck.checked;
    });

    // Include annotations
    this.panel.querySelector('.iv-include-annotations').addEventListener('change', (e) => {
      this.includeAnnotations = e.target.checked;
    });

    // Close
    this.panel.querySelector('.iv-export-close').addEventListener('click', () => {
      this.viewer._closeExport();
    });

    // Download
    this.panel.querySelector('.iv-export-download').addEventListener('click', () => this.download());

    // Clipboard
    this.panel.querySelector('.iv-export-clipboard').addEventListener('click', () => this.copyToClipboard());
  }

  _updateQualityVisibility() {
    if (!this.panel) return;
    const row = this.panel.querySelector('.iv-quality-row');
    row.style.display = this.format === 'png' ? 'none' : 'flex';
  }

  _updateAnnotationCheckbox() {
    if (!this.panel) return;
    const row = this.panel.querySelector('.iv-export-include-annotations');
    const hasAnnotations = this.viewer._annotationModule?.hasAnnotations();
    row.style.display = hasAnnotations ? '' : 'none';
  }

  _updateCustomSizeInputs() {
    if (!this.panel) return;
    const customW = this.panel.querySelector('.iv-custom-w');
    const customH = this.panel.querySelector('.iv-custom-h');
    if (!this.customWidth) {
      customW.placeholder = this.viewer.naturalWidth;
      customH.placeholder = this.viewer.naturalHeight;
    }
  }

  _showCustomSize() {
    this.panel.querySelector('.iv-export-custom-size').style.display = 'flex';
    const customW = this.panel.querySelector('.iv-custom-w');
    const customH = this.panel.querySelector('.iv-custom-h');
    customW.placeholder = this.viewer.naturalWidth;
    customH.placeholder = this.viewer.naturalHeight;
  }

  _hideCustomSize() {
    this.panel.querySelector('.iv-export-custom-size').style.display = 'none';
  }

  _getTargetDimensions() {
    let w, h;
    if (this.customWidth && this.customHeight) {
      w = this.customWidth;
      h = this.customHeight;
    } else {
      const scale = this.scaleOption || 1;
      w = Math.round(this.viewer.naturalWidth * scale);
      h = Math.round(this.viewer.naturalHeight * scale);
    }

    // Swap for rotation
    const rot = this.viewer.rotation;
    if (rot === 90 || rot === 270) {
      [w, h] = [h, w];
    }
    return { w, h };
  }

  _renderToCanvas() {
    const { w, h } = this._getTargetDimensions();
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    const rot = this.viewer.rotation;
    if (rot) {
      ctx.translate(w / 2, h / 2);
      ctx.rotate((rot * Math.PI) / 180);
      if (rot === 90 || rot === 270) {
        ctx.drawImage(this.viewer.img, -h / 2, -w / 2, h, w);
      } else {
        ctx.drawImage(this.viewer.img, -w / 2, -h / 2, w, h);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    } else {
      ctx.drawImage(this.viewer.img, 0, 0, w, h);
    }

    // Bake annotations
    if (this.includeAnnotations && this.viewer._annotationModule?.hasAnnotations()) {
      this.viewer._annotationModule.renderToCanvas(canvas, w, h);
    }

    return canvas;
  }

  _getMime() {
    const map = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };
    return map[this.format] || 'image/png';
  }

  async download() {
    const canvas = this._renderToCanvas();
    const mime = this._getMime();
    const qualityArg = this.format === 'png' ? undefined : this.quality;

    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const baseName = this.viewer.model.name.replace(/\.[^.]+$/, '');
      const ext = this.format === 'jpg' ? 'jpg' : this.format;
      a.download = `${baseName}_export.${ext}`;
      a.href = url;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      this.viewer._showNotification(`Exported as ${ext.toUpperCase()}`);
    }, mime, qualityArg);
  }

  async copyToClipboard() {
    try {
      const canvas = this._renderToCanvas();
      const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      this.viewer._showNotification('Copied to clipboard');
    } catch (err) {
      console.error('Clipboard copy failed:', err);
      this.viewer._showNotification('Failed to copy');
    }
  }
}
