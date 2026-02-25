/**
 * video_concat.js - Grid picker for appending video clips before/after
 * Shows video files from the current Dave grid for selection.
 */

export class VideoConcat {
  constructor(editor) {
    this.editor = editor;
    this.panel = null;
    this._selectedModel = null;
    this._position = 'after'; // 'before' | 'after'
  }

  open() {
    if (!this.panel) this._create();
    this._populateGrid();
    this._updateSelection();
    this.panel.style.display = '';
  }

  close() {
    if (this.panel) this.panel.style.display = 'none';
  }

  _create() {
    this.panel = document.createElement('div');
    this.panel.className = 've-concat-panel';
    this.panel.innerHTML = `
      <div class="ve-concat-header">
        <span>Add Clip</span>
        <button class="ve-btn ve-concat-close"><i class="fa fa-xmark"></i></button>
      </div>
      <div class="ve-concat-body">
        <div class="ve-concat-grid"></div>
        <div class="ve-concat-position">
          <button class="ve-concat-pos-btn" data-pos="before">Before</button>
          <button class="ve-concat-pos-btn ve-active" data-pos="after">After</button>
        </div>
        <div class="ve-export-actions" style="margin-top:8px">
          <button class="ve-btn ve-concat-apply"><i class="fa fa-check"></i> Apply</button>
          <button class="ve-btn ve-concat-remove" style="display:none"><i class="fa fa-trash"></i> Remove</button>
        </div>
      </div>
    `;

    this.editor.overlay.appendChild(this.panel);
    this._bindEvents();
  }

  _bindEvents() {
    // Close
    this.panel.querySelector('.ve-concat-close').addEventListener('click', () => {
      this.editor._closeConcat();
    });

    // Position buttons
    this.panel.querySelectorAll('.ve-concat-pos-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.panel.querySelectorAll('.ve-concat-pos-btn').forEach(b => b.classList.remove('ve-active'));
        btn.classList.add('ve-active');
        this._position = btn.dataset.pos;
      });
    });

    // Apply
    this.panel.querySelector('.ve-concat-apply').addEventListener('click', () => {
      if (!this._selectedModel) return;
      if (this._position === 'before') {
        this.editor.concatBefore = this._selectedModel;
      } else {
        this.editor.concatAfter = this._selectedModel;
      }
      this.editor._showNotification(
        `${this._selectedModel.name} added ${this._position} current clip`
      );
      this.editor._closeConcat();
    });

    // Remove
    this.panel.querySelector('.ve-concat-remove').addEventListener('click', () => {
      this.editor.concatBefore = null;
      this.editor.concatAfter = null;
      this._selectedModel = null;
      this._updateSelection();
      this.editor._showNotification('Concat clips removed');
    });

    // Prevent propagation
    this.panel.addEventListener('click', (e) => e.stopPropagation());
    this.panel.addEventListener('mousedown', (e) => e.stopPropagation());
  }

  async _populateGrid() {
    const grid = this.panel.querySelector('.ve-concat-grid');
    grid.innerHTML = '';

    // Get video files from the current grid
    let videoFiles = [];
    try {
      const { filteredModelFiles } = await import('../core/asset_loading.js');
      videoFiles = filteredModelFiles.filter(f =>
        f.type === 'video' && f.name !== this.editor.model?.name
      );
    } catch {
      // Fallback: no files available
    }

    if (videoFiles.length === 0) {
      grid.innerHTML = '<div style="color:var(--ve-muted);font-size:12px;padding:10px;text-align:center">No other video files in current view</div>';
      return;
    }

    for (const model of videoFiles) {
      const item = document.createElement('div');
      item.className = 've-concat-item';
      item.dataset.name = model.name;
      item.title = model.name;

      // Try to show a thumbnail video
      const nameLabel = document.createElement('div');
      nameLabel.className = 've-concat-item-name';
      nameLabel.textContent = model.name;
      item.appendChild(nameLabel);

      item.addEventListener('click', () => {
        // Deselect all
        grid.querySelectorAll('.ve-concat-item').forEach(i => i.classList.remove('ve-active'));
        item.classList.add('ve-active');
        this._selectedModel = model;
      });

      grid.appendChild(item);
    }
  }

  _updateSelection() {
    const removeBtn = this.panel.querySelector('.ve-concat-remove');
    const hasConcat = this.editor.concatBefore || this.editor.concatAfter;
    removeBtn.style.display = hasConcat ? 'flex' : 'none';
  }
}
