// model_inspector.js - 3D Model Inspector Panel & Toolbar
// Provides UI for inspecting 3D models in fullscreen mode

const TEX_PROPS = ['map', 'normalMap', 'specularMap', 'emissiveMap', 'aoMap',
  'roughnessMap', 'metalnessMap', 'bumpMap', 'alphaMap'];

export class ModelInspectorPanel {
  constructor(adapter, options = {}) {
    this.adapter = adapter;
    this.isOpen = false;
    this.animPollingId = null;
    this._disposed = false;
    this._abortController = new AbortController();
    this._exportEventsBound = false;
    this._dracoDetected = null; // null=unknown, true/false after check
    this._panelWidth = 300;

    this.toolbar = document.getElementById('model3dToolbar');
    this.panel = document.getElementById('modelInspectorPanel');
    this.animBar = document.getElementById('modelAnimBar');

    this._activeToggles = {
      wireframe: false, grid: false, autoRotate: false,
      skeleton: false, normals: false, bounds: false
    };
    this._currentBg = 'dark';
    this._isFloating = false;
    this._floatDragData = null;

    this._bindToolbarEvents();
    this._bindPanelEvents();
    this._initPanelResize();
    this._show();

    if (adapter.onReady) {
      adapter.onReady(() => { this._populate(); this._syncInitialState(); });
    } else {
      setTimeout(() => { this._populate(); this._syncInitialState(); }, 500);
    }
  }

  _show() {
    if (this.toolbar) this.toolbar.style.display = 'flex';
  }

  _hide() {
    if (this.toolbar) this.toolbar.style.display = 'none';
    if (this.panel) { this.panel.classList.remove('open'); this.isOpen = false; }
    if (this.animBar) this.animBar.style.display = 'none';
  }

  _syncInitialState() {
    const anims = this.adapter?.getAnimations?.();
    if (anims && anims.length > 0 && this.adapter.isPlaying()) {
      this._updatePlayPauseBtn(true);
    }
    // Start async Draco detection
    this.adapter.detectDraco?.().then(isDraco => {
      this._dracoDetected = isDraco;
      this._updateDracoBadge();
    }).catch(() => {});
  }

  _updateDracoBadge() {
    const badge = this.panel?.querySelector('[data-display="draco-badge"]');
    if (badge && this._dracoDetected !== null) {
      if (this._dracoDetected) {
        badge.innerHTML = '<i class="fa fa-bolt"></i> Draco Compressed';
        badge.className = 'inspector-draco-badge active';
      } else {
        badge.innerHTML = 'No Draco';
        badge.className = 'inspector-draco-badge';
      }
    }
    // Also update export section if present
    const exportDraco = this.panel?.querySelector('[data-display="export-draco"]');
    if (exportDraco && this._dracoDetected !== null) {
      exportDraco.textContent = this._dracoDetected
        ? 'Source uses Draco compression. Export will be uncompressed (larger file).'
        : '';
      exportDraco.style.display = this._dracoDetected ? 'block' : 'none';
    }
  }

  togglePanel() {
    if (this._disposed) return;
    this.isOpen = !this.isOpen;
    if (this.panel) this.panel.classList.toggle('open', this.isOpen);
    const panelBtn = this.toolbar?.querySelector('[data-action="togglepanel"]');
    if (panelBtn) panelBtn.classList.toggle('active', this.isOpen);
    if (this.isOpen) this._populate();
  }

  _toggleFloat() {
    if (!this.panel) return;
    this._isFloating = !this._isFloating;
    const floatBtn = this.panel.querySelector('.inspector-float-toggle i');

    if (this._isFloating) {
      // Switch to floating mode
      this.panel.classList.add('floating');
      // Position centered on screen
      this.panel.style.left = 'calc(50% - 175px)';
      this.panel.style.top = '10%';
      this.panel.style.right = '';
      if (floatBtn) floatBtn.className = 'fa fa-window-maximize'; // dock icon
      this.panel.querySelector('.inspector-float-toggle')?.setAttribute('title', 'Dock panel');
      const header = this.panel.querySelector('.inspector-header');
      if (header) header.style.cursor = 'grab';
    } else {
      // Switch to docked mode
      this.panel.classList.remove('floating');
      this.panel.style.left = '';
      this.panel.style.top = '';
      this.panel.style.right = '';
      if (floatBtn) floatBtn.className = 'fa fa-up-right-from-square'; // float icon
      this.panel.querySelector('.inspector-float-toggle')?.setAttribute('title', 'Float / Dock panel');
      const header = this.panel.querySelector('.inspector-header');
      if (header) header.style.cursor = '';
    }
  }

  _bindToolbarEvents() {
    if (!this.toolbar) return;
    const signal = this._abortController.signal;
    this.toolbar.addEventListener('click', (e) => {
      const btn = e.target.closest('.model-toolbar-btn');
      if (!btn) return;
      e.stopPropagation();
      this._handleToolbarAction(btn.dataset.action, btn);
    }, { signal });
  }

  _handleToolbarAction(action, btn) {
    switch (action) {
      case 'wireframe':
        this._activeToggles.wireframe = !this._activeToggles.wireframe;
        btn.classList.toggle('active', this._activeToggles.wireframe);
        this.adapter.setWireframe(this._activeToggles.wireframe);
        break;
      case 'grid':
        this._activeToggles.grid = !this._activeToggles.grid;
        btn.classList.toggle('active', this._activeToggles.grid);
        this.adapter.setGridVisible(this._activeToggles.grid);
        break;
      case 'autorotate':
        this._activeToggles.autoRotate = !this._activeToggles.autoRotate;
        btn.classList.toggle('active', this._activeToggles.autoRotate);
        this.adapter.setAutoRotate(this._activeToggles.autoRotate);
        break;
      case 'resetcamera': this.adapter.resetCamera(); break;
      case 'screenshot': this._takeScreenshot(); break;
      case 'togglepanel': this.togglePanel(); break;
    }
  }

  _bindPanelEvents() {
    if (!this.panel) return;
    const signal = this._abortController.signal;
    const closeBtn = this.panel.querySelector('.inspector-close');
    if (closeBtn) closeBtn.addEventListener('click', () => this.togglePanel(), { signal });
    const floatBtn = this.panel.querySelector('.inspector-float-toggle');
    if (floatBtn) floatBtn.addEventListener('click', () => this._toggleFloat(), { signal });
    this.panel.querySelectorAll('.inspector-section-header').forEach(header => {
      header.addEventListener('click', () => {
        header.closest('.inspector-section')?.classList.toggle('collapsed');
      }, { signal });
    });
    this.panel.addEventListener('click', (e) => e.stopPropagation(), { signal });
    this.toolbar?.addEventListener('click', (e) => e.stopPropagation(), { signal });

    // Drag handler for floating panel (on header bar)
    const header = this.panel.querySelector('.inspector-header');
    if (header) {
      header.addEventListener('mousedown', (e) => {
        if (!this._isFloating) return;
        // Don't drag if clicking a button
        if (e.target.closest('button')) return;
        e.preventDefault();
        const rect = this.panel.getBoundingClientRect();
        this._floatDragData = {
          startX: e.clientX,
          startY: e.clientY,
          startLeft: rect.left,
          startTop: rect.top
        };
        header.style.cursor = 'grabbing';

        const onMove = (ev) => {
          if (!this._floatDragData) return;
          const dx = ev.clientX - this._floatDragData.startX;
          const dy = ev.clientY - this._floatDragData.startY;
          this.panel.style.left = (this._floatDragData.startLeft + dx) + 'px';
          this.panel.style.top = (this._floatDragData.startTop + dy) + 'px';
        };
        const onUp = () => {
          this._floatDragData = null;
          header.style.cursor = '';
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      }, { signal });
    }
  }

  _initPanelResize() {
    if (!this.panel) return;
    const handle = this.panel.querySelector('.inspector-resize-handle');
    if (!handle) return;
    const signal = this._abortController.signal;

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startW = this.panel.offsetWidth;
      handle.classList.add('dragging');

      const onMove = (ev) => {
        const dx = startX - ev.clientX;
        const newW = Math.max(250, Math.min(600, startW + dx));
        this._panelWidth = newW;
        this.panel.style.width = newW + 'px';
      };
      const onUp = () => {
        handle.classList.remove('dragging');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    }, { signal });
  }

  _populate() {
    if (this._disposed) return;
    this._populateStats();
    this._populateMaterials();
    this._populateAnimations();
    this._populateHelpers();
    this._populateScene();
    this._populateExport();
  }

  // =========== STATS ===========

  _populateStats() {
    const container = this.panel?.querySelector('#inspectorStats');
    if (!container) return;
    try {
      const stats = this.adapter.getModelStats();
      if (!stats) { container.innerHTML = '<div class="inspector-no-data">Stats unavailable</div>'; return; }
      const fmt = (n) => n != null ? n.toLocaleString() : 'N/A';
      const bbox = stats.boundingBox;
      const dims = bbox ? `${bbox.x.toFixed(2)} x ${bbox.y.toFixed(2)} x ${bbox.z.toFixed(2)}` : 'N/A';

      container.innerHTML = `
        <div class="inspector-stats-grid">
          <div class="inspector-stat"><div class="inspector-stat-label">Vertices</div><div class="inspector-stat-value">${fmt(stats.vertices)}</div></div>
          <div class="inspector-stat"><div class="inspector-stat-label">Triangles</div><div class="inspector-stat-value">${fmt(stats.triangles)}</div></div>
          <div class="inspector-stat"><div class="inspector-stat-label">Meshes</div><div class="inspector-stat-value">${fmt(stats.meshCount)}</div></div>
          <div class="inspector-stat"><div class="inspector-stat-label">Materials</div><div class="inspector-stat-value">${fmt(stats.materialCount)}</div></div>
          <div class="inspector-stat full-width"><div class="inspector-stat-label">Dimensions</div><div class="inspector-stat-value">${dims}</div></div>
        </div>
        <div class="inspector-draco-badge" data-display="draco-badge">${this._dracoDetected === true ? '<i class="fa fa-bolt"></i> Draco Compressed' : this._dracoDetected === false ? 'No Draco' : 'Checking...'}</div>
      `;
      if (this._dracoDetected === true) {
        container.querySelector('[data-display="draco-badge"]').classList.add('active');
      }

      const renderInfo = this.adapter.getRenderInfo?.();
      if (renderInfo) {
        const renderDiv = document.createElement('div');
        renderDiv.className = 'inspector-render-stats';
        renderDiv.innerHTML = `
          <div class="inspector-render-stat">Draw calls: <span>${renderInfo.drawCalls}</span></div>
          <div class="inspector-render-stat">GPU textures: <span>${renderInfo.texturesInGPU}</span></div>
          <div class="inspector-render-stat">GPU geometries: <span>${renderInfo.geometriesInGPU}</span></div>
        `;
        container.appendChild(renderDiv);
      }
    } catch (err) {
      console.warn('Inspector: Failed to populate stats', err);
      container.innerHTML = '<div class="inspector-no-data">Stats unavailable</div>';
    }
  }

  // =========== MATERIALS (with textures embedded) ===========

  _populateMaterials() {
    const container = this.panel?.querySelector('#inspectorMaterials');
    if (!container) return;
    const signal = this._abortController.signal;

    try {
      const materials = this.adapter.getAllMaterials?.() || [];
      if (materials.length === 0) {
        container.innerHTML = '<div class="inspector-no-data">No materials found</div>';
        return;
      }

      let html = '<div class="inspector-material-list">';
      materials.forEach((mat, matIdx) => {
        const textures = [];
        TEX_PROPS.forEach(prop => {
          const tex = mat[prop];
          if (tex) {
            textures.push({
              type: prop,
              name: tex.name || tex.image?.src?.split('/').pop() || 'unnamed',
              width: tex.image?.width || 'N/A',
              height: tex.image?.height || 'N/A'
            });
          }
        });

        const colorHex = mat.color ? '#' + mat.color.getHexString() : null;
        const isPBR = mat.type?.includes('Standard') || mat.type?.includes('Physical');
        const emissiveHex = mat.emissive ? '#' + mat.emissive.getHexString() : '#000000';

        html += `
          <div class="inspector-material-item collapsed" data-mat-uuid="${mat.uuid}">
            <div class="inspector-material-header" data-mat-toggle="${matIdx}">
              ${colorHex ? `<span class="inspector-material-swatch" style="background:${colorHex}"></span>` : ''}
              <span class="inspector-material-name">${mat.name || `Material ${matIdx + 1}`}</span>
              <span class="inspector-material-type">${mat.type?.replace('Mesh', '').replace('Material', '') || ''}</span>
              <button class="inspector-mat-edit-btn" data-mat-edit="${matIdx}" title="Open material editor"><i class="fa fa-pen"></i></button>
              <i class="fa fa-chevron-right inspector-material-collapse-icon"></i>
            </div>
            <div class="inspector-material-body">
              <div class="inspector-mat-props">
                ${colorHex !== null ? `
                <div class="inspector-mat-prop-row">
                  <span class="inspector-mat-prop-label">Color</span>
                  <input type="color" class="inspector-mat-color-input" data-mat-idx="${matIdx}" data-mat-prop="color" value="${colorHex}">
                </div>` : ''}
                ${isPBR ? `
                <div class="inspector-mat-prop-row">
                  <span class="inspector-mat-prop-label">Roughness</span>
                  <input type="range" class="inspector-mat-range" data-mat-idx="${matIdx}" data-mat-prop="roughness" min="0" max="1" step="0.01" value="${mat.roughness ?? 1}">
                  <span class="inspector-mat-range-val">${(mat.roughness ?? 1).toFixed(2)}</span>
                </div>
                <div class="inspector-mat-prop-row">
                  <span class="inspector-mat-prop-label">Metalness</span>
                  <input type="range" class="inspector-mat-range" data-mat-idx="${matIdx}" data-mat-prop="metalness" min="0" max="1" step="0.01" value="${mat.metalness ?? 0}">
                  <span class="inspector-mat-range-val">${(mat.metalness ?? 0).toFixed(2)}</span>
                </div>` : ''}
                <div class="inspector-mat-prop-row">
                  <span class="inspector-mat-prop-label">Emissive</span>
                  <input type="color" class="inspector-mat-color-input" data-mat-idx="${matIdx}" data-mat-prop="emissive" value="${emissiveHex}">
                </div>
                <div class="inspector-mat-prop-row">
                  <span class="inspector-mat-prop-label">Opacity</span>
                  <input type="range" class="inspector-mat-range" data-mat-idx="${matIdx}" data-mat-prop="opacity" min="0" max="1" step="0.01" value="${mat.opacity ?? 1}">
                  <span class="inspector-mat-range-val">${(mat.opacity ?? 1).toFixed(2)}</span>
                </div>
                <div class="inspector-mat-prop-row">
                  <span class="inspector-mat-prop-label">Transparent</span>
                  <label class="inspector-toggle"><input type="checkbox" ${mat.transparent ? 'checked' : ''} data-mat-idx="${matIdx}" data-mat-prop="transparent"><span class="inspector-toggle-slider"></span></label>
                </div>
                <div class="inspector-mat-prop-row">
                  <span class="inspector-mat-prop-label">Side</span>
                  <select class="inspector-mat-select" data-mat-idx="${matIdx}" data-mat-prop="side">
                    <option value="0" ${mat.side === 0 ? 'selected' : ''}>Front</option>
                    <option value="1" ${mat.side === 1 ? 'selected' : ''}>Back</option>
                    <option value="2" ${mat.side === 2 ? 'selected' : ''}>Double</option>
                  </select>
                </div>
              </div>
              ${textures.length > 0 ? `
              <div class="inspector-mat-textures-label">Textures</div>
              <div class="inspector-texture-list">${textures.map(tex => {
                const sizeStr = (tex.width && tex.height && tex.width !== 'N/A') ? `${tex.width}x${tex.height}` : '';
                return `
                <div class="inspector-texture-row">
                  <label class="inspector-toggle">
                    <input type="checkbox" checked data-mat-idx="${matIdx}" data-tex-type="${tex.type}">
                    <span class="inspector-toggle-slider"></span>
                  </label>
                  <span class="inspector-texture-type">${this._friendlyTexName(tex.type)}</span>
                  <span class="inspector-texture-name" title="${tex.name}">${tex.name}</span>
                  <span class="inspector-texture-size">${sizeStr}</span>
                </div>`;
              }).join('')}</div>` : ''}
            </div>
          </div>`;
      });
      html += '</div>';
      container.innerHTML = html;

      // Material collapse toggle
      container.querySelectorAll('[data-mat-toggle]').forEach(header => {
        header.addEventListener('click', (e) => {
          // Don't toggle if clicking edit button
          if (e.target.closest('.inspector-mat-edit-btn')) return;
          header.closest('.inspector-material-item')?.classList.toggle('collapsed');
        }, { signal });
      });

      // Material editor popup button
      container.querySelectorAll('.inspector-mat-edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this._openMaterialEditor(parseInt(btn.dataset.matEdit));
        }, { signal });
      });

      // Texture toggle events
      container.querySelectorAll('input[data-tex-type]').forEach(input => {
        input.addEventListener('change', () => {
          this.adapter.toggleTexture(input.dataset.texType, input.checked);
        }, { signal });
      });

      // Material property editing
      container.addEventListener('input', (e) => {
        const el = e.target;
        const matIdx = el.dataset?.matIdx;
        const prop = el.dataset?.matProp;
        if (matIdx === undefined || !prop) return;
        this._applyMaterialEdit(parseInt(matIdx), prop, el);
      }, { signal });

      container.addEventListener('change', (e) => {
        const el = e.target;
        const matIdx = el.dataset?.matIdx;
        const prop = el.dataset?.matProp;
        if (matIdx === undefined || !prop) return;
        this._applyMaterialEdit(parseInt(matIdx), prop, el);
      }, { signal });
    } catch (err) {
      console.warn('Inspector: Failed to populate materials', err);
      container.innerHTML = '<div class="inspector-no-data">Material info unavailable</div>';
    }
  }

  _applyMaterialEdit(matIdx, prop, el) {
    const materials = this.adapter.getAllMaterials?.() || [];
    const mat = materials[matIdx];
    if (!mat) return;

    switch (prop) {
      case 'color':
      case 'emissive': {
        const hex = parseInt(el.value.replace('#', ''), 16);
        if (mat[prop]?.setHex) mat[prop].setHex(hex);
        if (prop === 'color') {
          const swatch = el.closest('.inspector-material-item')?.querySelector('.inspector-material-swatch');
          if (swatch) swatch.style.background = el.value;
        }
        break;
      }
      case 'roughness':
      case 'metalness':
      case 'opacity': {
        mat[prop] = parseFloat(el.value);
        const valSpan = el.nextElementSibling;
        if (valSpan?.classList.contains('inspector-mat-range-val') || valSpan?.classList.contains('me-val'))
          valSpan.textContent = parseFloat(el.value).toFixed(2);
        if (prop === 'opacity' && mat.opacity < 1) { mat.transparent = true; }
        break;
      }
      case 'transparent':
        mat.transparent = el.checked;
        break;
      case 'side':
        mat.side = parseInt(el.value);
        break;
    }
    mat.needsUpdate = true;
    this.adapter._requestRender?.();
  }

  _friendlyTexName(type) {
    const names = {
      map: 'Diffuse', normalMap: 'Normal', specularMap: 'Specular', emissiveMap: 'Emissive',
      aoMap: 'AO', roughnessMap: 'Rough', metalnessMap: 'Metal', bumpMap: 'Bump',
      alphaMap: 'Alpha', envMap: 'Env', lightMap: 'Light', displacementMap: 'Displace'
    };
    return names[type] || type;
  }

  // =========== MATERIAL EDITOR POPUP ===========

  _openMaterialEditor(matIdx) {
    // Save state before closing (for refresh preservation)
    const _prevFloating = this._matEditorFloating;
    const _prevPos = _prevFloating && this._matEditorPopup
      ? { left: this._matEditorPopup.style.left, top: this._matEditorPopup.style.top } : null;
    this._closeMaterialEditor();
    this._matEditorFloating = _prevFloating; // restore after close reset

    const materials = this.adapter.getAllMaterials?.() || [];
    const mat = materials[matIdx];
    if (!mat) return;

    const isPBR = mat.type?.includes('Standard') || mat.type?.includes('Physical');
    const colorHex = mat.color ? '#' + mat.color.getHexString() : '#ffffff';
    const emissiveHex = mat.emissive ? '#' + mat.emissive.getHexString() : '#000000';

    const slotNames = {
      map: 'Diffuse', normalMap: 'Normal', roughnessMap: 'Roughness', metalnessMap: 'Metalness',
      emissiveMap: 'Emissive', aoMap: 'AO', bumpMap: 'Bump', alphaMap: 'Alpha', specularMap: 'Specular'
    };
    const slotsToShow = isPBR
      ? ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap', 'alphaMap']
      : ['map', 'normalMap', 'specularMap', 'emissiveMap', 'bumpMap', 'alphaMap'];

    // Build compact texture rows (thumb + label + toggle + strength + drop + remove)
    let slotsHtml = '';
    for (const prop of slotsToShow) {
      const tex = mat[prop];
      const savedTex = mat[`_savedTex_${prop}`]; // texture toggled off but still saved
      const activeTex = tex || savedTex;
      const has = !!activeTex;
      const isOn = !!tex; // currently active (not toggled off)
      const thumbId = `mat-tex-thumb-${matIdx}-${prop}`;
      const w = activeTex?.image?.width || activeTex?.image?.naturalWidth;
      const h = activeTex?.image?.height || activeTex?.image?.naturalHeight;
      const sizeStr = (w && h) ? `${w}x${h}` : '';
      const strength = activeTex ? (activeTex._editorStrength ?? 1.0) : 1.0;

      slotsHtml += `
        <div class="me-tex-row${has ? '' : ' empty'}" data-slot="${prop}" data-mat-idx="${matIdx}">
          <div class="me-tex-thumb" id="${thumbId}">${has ? '' : '<i class="fa fa-plus"></i>'}</div>
          <div class="me-tex-info">
            <span class="me-tex-label">${slotNames[prop] || prop}</span>
            <span class="me-tex-size">${sizeStr}</span>
          </div>
          ${has ? `<label class="inspector-toggle me-tex-toggle"><input type="checkbox" ${isOn ? 'checked' : ''} data-tex-toggle="${prop}"><span class="inspector-toggle-slider"></span></label>
          <input type="range" class="me-tex-strength" data-tex-strength="${prop}" min="0" max="2" step="0.05" value="${strength}" title="Strength"${!isOn ? ' disabled' : ''}>
          <span class="me-tex-strength-val">${strength.toFixed(1)}</span>
          <button class="me-tex-remove" data-remove-slot="${prop}" title="Remove"><i class="fa fa-times"></i></button>` : ''}
          <input type="file" accept="image/*" class="me-tex-file" data-slot-input="${prop}" style="display:none">
        </div>`;
    }

    const wasFloating = this._matEditorFloating;

    const panel = document.createElement('div');
    panel.className = wasFloating ? 'mat-editor-panel floating' : 'mat-editor-panel docked';
    panel.id = 'matEditorPanel';
    if (_prevPos) { panel.style.left = _prevPos.left; panel.style.top = _prevPos.top; }
    panel.innerHTML = `
      <div class="me-resize-handle"></div>
      <div class="me-header"${wasFloating ? ' style="cursor:grab"' : ''}>
        <span class="me-title"><i class="fa fa-palette"></i> ${mat.name || `Material ${matIdx + 1}`}</span>
        <div class="me-header-actions">
          <button class="me-float-btn" title="${wasFloating ? 'Dock to left' : 'Undock'}"><i class="fa fa-${wasFloating ? 'window-maximize' : 'up-right-from-square'}"></i></button>
          <button class="me-close-btn" title="Close"><i class="fa fa-times"></i></button>
        </div>
      </div>
      <div class="me-body">
        <div class="me-props">
          <div class="me-row"><label>Color</label><input type="color" value="${colorHex}" data-eprop="color"></div>
          ${isPBR ? `<div class="me-row"><label>Rough</label><input type="range" min="0" max="1" step="0.01" value="${mat.roughness ?? 1}" data-eprop="roughness"><span class="me-val">${(mat.roughness ?? 1).toFixed(2)}</span></div>
          <div class="me-row"><label>Metal</label><input type="range" min="0" max="1" step="0.01" value="${mat.metalness ?? 0}" data-eprop="metalness"><span class="me-val">${(mat.metalness ?? 0).toFixed(2)}</span></div>` : ''}
          <div class="me-row"><label>Emissive</label><input type="color" value="${emissiveHex}" data-eprop="emissive"></div>
          <div class="me-row"><label>Opacity</label><input type="range" min="0" max="1" step="0.01" value="${mat.opacity ?? 1}" data-eprop="opacity"><span class="me-val">${(mat.opacity ?? 1).toFixed(2)}</span></div>
          <div class="me-row"><label>Side</label><select data-eprop="side"><option value="0" ${mat.side === 0 ? 'selected' : ''}>Front</option><option value="1" ${mat.side === 1 ? 'selected' : ''}>Back</option><option value="2" ${mat.side === 2 ? 'selected' : ''}>Double</option></select></div>
          <div class="me-row"><label>Transp.</label><input type="checkbox" class="me-checkbox" ${mat.transparent ? 'checked' : ''} data-eprop="transparent"></div>
        </div>
        <div class="me-tex-title">Textures <span class="me-tex-hint">drop images onto rows</span></div>
        <div class="me-tex-list">${slotsHtml}</div>
      </div>`;

    const overlay = document.getElementById('fullscreenOverlay');
    (overlay || document.body).appendChild(panel);

    // Draw thumbnails (use active or saved texture)
    for (const prop of slotsToShow) {
      const tex = mat[prop] || mat[`_savedTex_${prop}`];
      if (tex?.image) this._drawTexThumb(`mat-tex-thumb-${matIdx}-${prop}`, tex.image);
    }

    // --- Events ---
    const signal = this._abortController.signal;
    panel.addEventListener('click', (e) => e.stopPropagation(), { signal });

    panel.querySelector('.me-close-btn').addEventListener('click', () => this._closeMaterialEditor(), { signal });
    panel.querySelector('.me-float-btn').addEventListener('click', () => this._toggleMatEditorFloat(), { signal });

    // Right-edge resize handle (docked mode)
    const resizeHandle = panel.querySelector('.me-resize-handle');
    if (resizeHandle) {
      resizeHandle.addEventListener('mousedown', (e) => {
        if (panel.classList.contains('floating')) return;
        e.preventDefault();
        e.stopPropagation();
        const startX = e.clientX;
        const startW = panel.offsetWidth;
        resizeHandle.classList.add('dragging');
        const onMove = (ev) => {
          const newW = Math.max(200, Math.min(500, startW + (ev.clientX - startX)));
          panel.style.width = newW + 'px';
        };
        const onUp = () => {
          resizeHandle.classList.remove('dragging');
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      }, { signal });
    }

    // Draggable header when floating
    const header = panel.querySelector('.me-header');
    header.addEventListener('mousedown', (e) => {
      if (!panel.classList.contains('floating') || e.target.closest('button')) return;
      e.preventDefault();
      const rect = panel.getBoundingClientRect();
      const sx = e.clientX, sy = e.clientY, sl = rect.left, st = rect.top;
      header.style.cursor = 'grabbing';
      const onMove = (ev) => {
        panel.style.left = (sl + ev.clientX - sx) + 'px';
        panel.style.top = (st + ev.clientY - sy) + 'px';
      };
      const onUp = () => {
        header.style.cursor = '';
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    }, { signal });

    // Property edits
    panel.querySelectorAll('[data-eprop]').forEach(el => {
      const handler = () => this._applyMaterialEdit(matIdx, el.dataset.eprop, el);
      el.addEventListener('input', handler, { signal });
      el.addEventListener('change', handler, { signal });
    });

    // Texture toggle on/off (per-material, not global)
    panel.querySelectorAll('[data-tex-toggle]').forEach(cb => {
      cb.addEventListener('change', () => {
        const prop = cb.dataset.texToggle;
        const row = cb.closest('.me-tex-row');
        const strengthSlider = row?.querySelector('.me-tex-strength');
        if (!cb.checked) {
          if (mat[prop]) { mat[`_savedTex_${prop}`] = mat[prop]; mat[prop] = null; }
          if (strengthSlider) strengthSlider.disabled = true;
        } else {
          const saved = mat[`_savedTex_${prop}`];
          if (saved) { mat[prop] = saved; delete mat[`_savedTex_${prop}`]; }
          if (strengthSlider) strengthSlider.disabled = false;
        }
        mat.needsUpdate = true;
        this.adapter._requestRender?.();
      }, { signal });
    });

    // Texture strength
    panel.querySelectorAll('[data-tex-strength]').forEach(slider => {
      slider.addEventListener('input', () => {
        const prop = slider.dataset.texStrength;
        const val = parseFloat(slider.value);
        const valSpan = slider.nextElementSibling;
        if (valSpan) valSpan.textContent = val.toFixed(1);
        const tex = mat[prop];
        if (!tex) return;
        tex._editorStrength = val;
        // Map strength to the appropriate Three.js property
        if (prop === 'normalMap' && mat.normalScale) {
          mat.normalScale.set(val, val);
        } else if (prop === 'bumpMap') {
          mat.bumpScale = val;
        } else if (prop === 'displacementMap') {
          mat.displacementScale = val;
        } else if (prop === 'aoMap') {
          mat.aoMapIntensity = val;
        } else if (prop === 'emissiveMap') {
          mat.emissiveIntensity = val;
        } else if (prop === 'lightMap') {
          mat.lightMapIntensity = val;
        } else if (prop === 'roughnessMap') {
          // roughness scalar multiplies the roughnessMap in the shader
          if (mat._baseRoughness === undefined) mat._baseRoughness = mat.roughness ?? 1;
          mat.roughness = Math.min(1, mat._baseRoughness * val);
        } else if (prop === 'metalnessMap') {
          if (mat._baseMetalness === undefined) mat._baseMetalness = mat.metalness ?? 0;
          mat.metalness = Math.min(1, mat._baseMetalness * val);
        } else if (prop === 'alphaMap') {
          if (mat._baseOpacity === undefined) mat._baseOpacity = mat.opacity ?? 1;
          mat.opacity = Math.min(1, mat._baseOpacity * val);
          if (mat.opacity < 1) mat.transparent = true;
        } else if (prop === 'map' && mat.color) {
          // color multiplies the diffuse map; scale toward white (full texture) or black (no texture)
          if (!mat._baseColor) mat._baseColor = mat.color.clone();
          mat.color.copy(mat._baseColor).multiplyScalar(Math.min(val, 1));
          // For strength > 1, keep at original color (saturated)
          if (val > 1) mat.color.copy(mat._baseColor);
        }
        mat.needsUpdate = true;
        this.adapter._requestRender?.();
      }, { signal });
    });

    // Thumb click -> file picker
    panel.querySelectorAll('.me-tex-thumb').forEach(thumb => {
      thumb.addEventListener('click', () => {
        const row = thumb.closest('.me-tex-row');
        row?.querySelector('.me-tex-file')?.click();
      }, { signal });
    });

    // File input
    panel.querySelectorAll('.me-tex-file').forEach(input => {
      input.addEventListener('change', () => {
        if (input.files?.[0]) this._loadTextureToSlot(matIdx, input.dataset.slotInput, input.files[0]);
      }, { signal });
    });

    // Remove buttons
    panel.querySelectorAll('[data-remove-slot]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._removeTextureFromSlot(matIdx, btn.dataset.removeSlot);
      }, { signal });
    });

    // Drag & drop on rows
    panel.querySelectorAll('.me-tex-row').forEach(row => {
      row.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); row.classList.add('drag-over'); }, { signal });
      row.addEventListener('dragleave', () => row.classList.remove('drag-over'), { signal });
      row.addEventListener('drop', (e) => {
        e.preventDefault(); e.stopPropagation(); row.classList.remove('drag-over');
        const file = e.dataTransfer?.files?.[0];
        if (file?.type.startsWith('image/')) this._loadTextureToSlot(matIdx, row.dataset.slot, file);
      }, { signal });
    });

    this._matEditorPopup = panel;
    this._matEditorIdx = matIdx;
    // Keep floating state if it was already floating (refresh preserves state)
    if (!wasFloating) this._matEditorFloating = false;
  }

  _toggleMatEditorFloat() {
    const panel = this._matEditorPopup;
    if (!panel) return;
    this._matEditorFloating = !this._matEditorFloating;
    const icon = panel.querySelector('.me-float-btn i');

    if (this._matEditorFloating) {
      panel.classList.remove('docked');
      panel.classList.add('floating');
      panel.style.left = 'calc(50% - 160px)';
      panel.style.top = '12%';
      if (icon) icon.className = 'fa fa-window-maximize';
      panel.querySelector('.me-float-btn')?.setAttribute('title', 'Dock to left');
      panel.querySelector('.me-header').style.cursor = 'grab';
    } else {
      panel.classList.remove('floating');
      panel.classList.add('docked');
      panel.style.left = '';
      panel.style.top = '';
      if (icon) icon.className = 'fa fa-up-right-from-square';
      panel.querySelector('.me-float-btn')?.setAttribute('title', 'Undock');
      panel.querySelector('.me-header').style.cursor = '';
    }
  }

  _closeMaterialEditor() {
    if (this._matEditorPopup) {
      this._matEditorPopup.remove();
      this._matEditorPopup = null;
      this._matEditorIdx = null;
      this._matEditorFloating = false;
    }
  }

  _drawTexThumb(elementId, image) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.innerHTML = '';
    const c = document.createElement('canvas');
    c.width = 40; c.height = 40;
    try { c.getContext('2d').drawImage(image, 0, 0, 40, 40); } catch {}
    el.appendChild(c);
  }

  async _loadTextureToSlot(matIdx, slotProp, file) {
    const materials = this.adapter.getAllMaterials?.() || [];
    const mat = materials[matIdx];
    if (!mat) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      import('three').then(three => {
        const texture = new three.Texture(img);
        texture.flipY = true;
        texture.needsUpdate = true;
        texture.name = file.name;
        texture._editorStrength = 1.0;
        mat[slotProp] = texture;
        mat.needsUpdate = true;
        this.adapter._requestRender?.();
        // Refresh the editor to show new texture
        this._openMaterialEditor(matIdx);
        this._populateMaterials();
      });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  _removeTextureFromSlot(matIdx, slotProp) {
    const materials = this.adapter.getAllMaterials?.() || [];
    const mat = materials[matIdx];
    if (!mat) return;
    mat[slotProp] = null;
    delete mat[`_savedTex_${slotProp}`]; // also clear any toggled-off reference
    mat.needsUpdate = true;
    this.adapter._requestRender?.();
    // Refresh the editor
    this._openMaterialEditor(matIdx);
    this._populateMaterials();
  }

  // =========== ANIMATIONS (bottom bar + panel info) ===========

  _populateAnimations() {
    const container = this.panel?.querySelector('#inspectorAnimations');
    const section = container?.closest('.inspector-section');
    const bar = this.animBar;

    try {
      const anims = this.adapter.getAnimations();
      if (!anims || anims.length === 0) {
        if (container) container.innerHTML = '<div class="inspector-no-data">No animations</div>';
        if (section) section.classList.add('collapsed');
        if (bar) bar.style.display = 'none';
        return;
      }

      // Show the bottom animation bar
      if (bar) {
        bar.style.display = 'flex';
        const signal = this._abortController.signal;

        const select = bar.querySelector('.model-anim-bar-select');
        if (select) {
          select.innerHTML = anims.map((a, i) =>
            `<option value="${i}">${a.name || `Animation ${i + 1}`} (${a.duration.toFixed(1)}s)</option>`
          ).join('');
          select.addEventListener('change', () => {
            this.adapter.playAnimation(parseInt(select.value));
            this._updatePlayPauseBtn(true);
          }, { signal });
        }

        const playBtn = bar.querySelector('[data-anim-bar-action="playpause"]');
        if (playBtn) {
          playBtn.addEventListener('click', () => {
            this.adapter.togglePlayback();
            this._updatePlayPauseBtn(this.adapter.isPlaying());
          }, { signal });
        }

        const scrubber = bar.querySelector('.model-anim-bar-scrubber');
        if (scrubber) {
          scrubber.addEventListener('input', () => {
            const d = this.adapter.getDuration();
            if (d > 0) this.adapter.seek((parseFloat(scrubber.value) / 100) * d);
          }, { signal });
        }

        const speedSelect = bar.querySelector('.model-anim-bar-speed');
        if (speedSelect) {
          speedSelect.addEventListener('change', () => {
            this.adapter.setPlaybackSpeed(parseFloat(speedSelect.value));
          }, { signal });
        }

        this._startAnimPolling();
      }

      // Panel section shows animation list summary
      if (container) {
        container.innerHTML = `
          <div class="inspector-no-data">${anims.length} animation${anims.length > 1 ? 's' : ''} — use player bar at bottom</div>
          <div class="inspector-anim-list-info">
            ${anims.map((a, i) => `<div class="inspector-anim-list-row"><span>${a.name || `Animation ${i + 1}`}</span><span class="inspector-anim-list-dur">${a.duration.toFixed(1)}s</span></div>`).join('')}
          </div>`;
      }
    } catch (err) {
      console.warn('Inspector: Failed to populate animations', err);
      if (container) container.innerHTML = '<div class="inspector-no-data">Animation info unavailable</div>';
      if (bar) bar.style.display = 'none';
    }
  }

  _updatePlayPauseBtn(isPlaying) {
    const btn = this.animBar?.querySelector('[data-anim-bar-action="playpause"]');
    if (!btn) return;
    btn.classList.toggle('playing', isPlaying);
    btn.innerHTML = isPlaying ? '<i class="fa fa-pause"></i>' : '<i class="fa fa-play"></i>';
  }

  _startAnimPolling() {
    if (this.animPollingId) return;
    const poll = () => {
      if (this._disposed) return;
      this.animPollingId = requestAnimationFrame(poll);
      const scrubber = this.animBar?.querySelector('.model-anim-bar-scrubber');
      const timeDisplay = this.animBar?.querySelector('.model-anim-bar-time');
      if (!scrubber || !timeDisplay) return;
      if (document.activeElement === scrubber) return;
      const current = this.adapter.getCurrentTime();
      const duration = this.adapter.getDuration();
      if (duration > 0) {
        scrubber.value = ((current / duration) * 100).toFixed(1);
        timeDisplay.textContent = `${this._fmtTime(current)} / ${this._fmtTime(duration)}`;
      }
    };
    this.animPollingId = requestAnimationFrame(poll);
  }

  _stopAnimPolling() {
    if (this.animPollingId) { cancelAnimationFrame(this.animPollingId); this.animPollingId = null; }
  }

  _fmtTime(s) { return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`; }

  // =========== HELPERS ===========

  _populateHelpers() {
    const container = this.panel?.querySelector('#inspectorHelpers');
    if (!container) return;
    const signal = this._abortController.signal;
    const hasSkeleton = this.adapter.hasSkeleton?.() ?? false;

    container.innerHTML = `
      <div class="inspector-helper-toggles">
        <div class="inspector-helper-row">
          <span class="inspector-helper-label"><i class="fa fa-vector-square"></i> Bounding Box</span>
          <label class="inspector-toggle"><input type="checkbox" data-helper="bounds"><span class="inspector-toggle-slider"></span></label>
        </div>
        <div class="inspector-helper-row">
          <span class="inspector-helper-label"><i class="fa fa-arrows-alt"></i> Normals</span>
          <label class="inspector-toggle"><input type="checkbox" data-helper="normals"><span class="inspector-toggle-slider"></span></label>
        </div>
        <div class="inspector-helper-row" style="${hasSkeleton ? '' : 'opacity:0.4;pointer-events:none;'}">
          <span class="inspector-helper-label"><i class="fa fa-bone"></i> Skeleton</span>
          <label class="inspector-toggle"><input type="checkbox" data-helper="skeleton" ${hasSkeleton ? '' : 'disabled'}><span class="inspector-toggle-slider"></span></label>
        </div>
      </div>`;

    container.querySelectorAll('input[data-helper]').forEach(input => {
      input.addEventListener('change', () => {
        const h = input.dataset.helper;
        this._activeToggles[h] = input.checked;
        switch (h) {
          case 'bounds': this.adapter.setBoundsVisible(input.checked); break;
          case 'normals': this.adapter.setNormalsVisible(input.checked); break;
          case 'skeleton': this.adapter.setSkeletonVisible(input.checked); break;
        }
      }, { signal });
    });
  }

  // =========== SCENE ===========

  _populateScene() {
    const container = this.panel?.querySelector('#inspectorScene');
    if (!container) return;
    const signal = this._abortController.signal;

    container.innerHTML = `
      <div class="inspector-scene-label">Background</div>
      <div class="inspector-bg-swatches">
        <div class="inspector-bg-swatch dark active" data-bg="dark" title="Dark Gray"></div>
        <div class="inspector-bg-swatch light" data-bg="light" title="Light Gray"></div>
        <div class="inspector-bg-swatch checker" data-bg="checker" title="Checkerboard"></div>
        <div class="inspector-bg-swatch black" data-bg="black" title="Black"></div>
        <div class="inspector-bg-swatch white" data-bg="white" title="White"></div>
      </div>
      <div class="inspector-scene-label">Lighting</div>
      <select class="inspector-lighting-select">
        <option value="default">Default</option><option value="studio">Studio</option>
        <option value="outdoor">Outdoor</option><option value="dark">Dark / Dramatic</option>
        <option value="flat">Flat (No Shadows)</option>
      </select>`;

    container.querySelectorAll('.inspector-bg-swatch').forEach(swatch => {
      swatch.addEventListener('click', () => {
        container.querySelectorAll('.inspector-bg-swatch').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        this._currentBg = swatch.dataset.bg;
        this.adapter.setBackground(this._currentBg);
      }, { signal });
    });
    const lightSelect = container.querySelector('.inspector-lighting-select');
    lightSelect.addEventListener('change', () => { this.adapter.setLightingPreset(lightSelect.value); }, { signal });
  }

  // =========== EXPORT SECTION ===========

  _populateExport() {
    const container = this.panel?.querySelector('#inspectorExport');
    if (!container) return;

    const stats = this.adapter.getModelStats?.();
    const clips = this.adapter.getAnimationClips?.() || [];

    container.innerHTML = `
      <div class="inspector-export">
        <div class="inspector-tool-group">
          <div class="inspector-tool-label"><i class="fa fa-compress"></i> Texture Resize</div>
          <select class="inspector-tool-select" data-export-param="tex-size">
            <option value="0" selected>Original</option>
            <option value="2048">2048px</option><option value="1024">1024px</option>
            <option value="512">512px</option><option value="256">256px</option><option value="128">128px</option>
          </select>
        </div>

        <div class="inspector-tool-group">
          <div class="inspector-tool-label"><i class="fa fa-chart-pie"></i> Simplify Model</div>
          <div class="inspector-tool-slider-row">
            <input type="range" class="inspector-tool-range" data-export-param="simplify-ratio" min="5" max="100" value="100" step="5">
            <span class="inspector-tool-range-label" data-export-display="simplify-label">100%</span>
          </div>
          <div class="inspector-tool-info" data-export-display="simplify-info">${stats ? `${stats.vertices.toLocaleString()} verts / ${stats.triangles.toLocaleString()} tris` : ''}</div>
        </div>

        ${clips.length > 0 ? `
        <div class="inspector-tool-group">
          <div class="inspector-tool-label"><i class="fa fa-film"></i> Animations
            <span class="inspector-tool-label-actions">
              <button class="inspector-tool-link-btn" data-export-action="anim-all" title="Select all">All</button>
              <button class="inspector-tool-link-btn" data-export-action="anim-none" title="Deselect all">None</button>
            </span>
          </div>
          <div class="inspector-tool-anim-list">
            ${clips.map((clip, i) => `
              <div class="inspector-tool-anim-row">
                <label class="inspector-toggle"><input type="checkbox" checked data-export-anim="${i}"><span class="inspector-toggle-slider"></span></label>
                <span class="inspector-tool-anim-name" title="${clip.name || `Anim ${i + 1}`}">${clip.name || `Animation ${i + 1}`}</span>
                <span class="inspector-tool-anim-dur">${clip.duration.toFixed(1)}s</span>
                <button class="inspector-tool-btn-sm" data-export-action="export-single-anim" data-anim-idx="${i}" title="Export only this animation"><i class="fa fa-download"></i></button>
              </div>
            `).join('')}
          </div>
        </div>` : ''}

        <div class="inspector-tool-group">
          <div class="inspector-tool-label"><i class="fa fa-magic"></i> Quick Actions</div>
          <div class="inspector-tool-row">
            <button class="inspector-tool-btn" data-export-action="flip-normals" title="Flip all face normals"><i class="fa fa-exchange-alt"></i> Flip Normals</button>
            <button class="inspector-tool-btn" data-export-action="center-model" title="Center model at origin"><i class="fa fa-crosshairs"></i> Center</button>
          </div>
        </div>

        <div class="inspector-export-draco" data-display="export-draco" style="display:${this._dracoDetected ? 'block' : 'none'}">${this._dracoDetected ? 'Source uses Draco compression. Export will be uncompressed (larger file).' : ''}</div>

        <div class="inspector-export-size" data-export-display="est-size"></div>

        <div class="inspector-tool-group">
          <div class="inspector-tool-row column">
            <button class="inspector-tool-btn accent" data-export-action="export-glb-full" title="Export GLB with textures embedded"><i class="fa fa-cube"></i> Export GLB + Textures</button>
            <button class="inspector-tool-btn" data-export-action="export-glb-notex" title="Export GLB without textures"><i class="fa fa-cube"></i> Export GLB (no textures)</button>
            <button class="inspector-tool-btn" data-export-action="export-textures" title="Download all textures as PNG files"><i class="fa fa-image"></i> Export Textures</button>
          </div>
        </div>
      </div>
      <div class="inspector-tool-status" data-export-display="status"></div>
    `;

    // Only bind events ONCE on this container
    if (!this._exportEventsBound) {
      this._exportEventsBound = true;
      const signal = this._abortController.signal;

      container.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-export-action]');
        if (!btn || btn.disabled) return;
        this._handleExportAction(btn.dataset.exportAction, e);
      }, { signal });

      container.addEventListener('input', (e) => {
        const el = e.target;
        if (el.dataset.exportParam === 'simplify-ratio') {
          this._updateSimplifyDisplay();
          this._updateEstimatedSize();
        }
        if (el.dataset.exportParam === 'tex-size') {
          this._updateEstimatedSize();
        }
      }, { signal });

      container.addEventListener('change', (e) => {
        if (e.target.dataset.exportParam === 'tex-size') {
          this._updateEstimatedSize();
        }
        if (e.target.dataset.exportAnim !== undefined) {
          this._updateEstimatedSize();
        }
      }, { signal });
    }

    this._updateSimplifyDisplay();
    this._updateEstimatedSize();
  }

  _updateSimplifyDisplay() {
    const container = this.panel?.querySelector('#inspectorExport');
    if (!container) return;
    const slider = container.querySelector('[data-export-param="simplify-ratio"]');
    const label = container.querySelector('[data-export-display="simplify-label"]');
    const info = container.querySelector('[data-export-display="simplify-info"]');
    if (!slider) return;

    const pct = parseInt(slider.value);
    if (label) label.textContent = `${pct}%`;
    const stats = this.adapter.getModelStats?.();
    if (info && stats) {
      const tV = Math.round(stats.vertices * pct / 100);
      const tT = Math.round(stats.triangles * pct / 100);
      info.textContent = `~${tV.toLocaleString()} verts / ~${tT.toLocaleString()} tris`;
    }
  }

  _updateEstimatedSize() {
    const container = this.panel?.querySelector('#inspectorExport');
    if (!container) return;
    const display = container.querySelector('[data-export-display="est-size"]');
    if (!display) return;

    const stats = this.adapter.getModelStats?.();
    if (!stats) { display.textContent = ''; return; }

    const simplifyRatio = parseInt(container.querySelector('[data-export-param="simplify-ratio"]')?.value || '100') / 100;
    const texSize = parseInt(container.querySelector('[data-export-param="tex-size"]')?.value || '0');

    // Sum actual geometry buffer byte lengths for accuracy
    let geoSize = 0;
    const meshes = this.adapter.getAllMeshes?.() || [];
    const countedBuffers = new Set();
    for (const mesh of meshes) {
      const geo = mesh.geometry;
      if (!geo) continue;
      // Sum all attribute buffers (position, normal, uv, etc.)
      for (const attrName in geo.attributes) {
        const attr = geo.attributes[attrName];
        if (attr?.array?.buffer && !countedBuffers.has(attr.array.buffer)) {
          countedBuffers.add(attr.array.buffer);
          geoSize += attr.array.byteLength;
        }
      }
      // Index buffer
      if (geo.index?.array?.buffer && !countedBuffers.has(geo.index.array.buffer)) {
        countedBuffers.add(geo.index.array.buffer);
        geoSize += geo.index.array.byteLength;
      }
    }
    // Apply simplify ratio to geometry
    geoSize = Math.round(geoSize * simplifyRatio);

    // Estimate texture sizes from actual image data
    let texTotal = 0;
    const materials = this.adapter.getAllMaterials?.() || [];
    const seen = new Set();
    for (const mat of materials) {
      for (const prop of TEX_PROPS) {
        const tex = mat[prop];
        if (!tex || !tex.image || seen.has(tex.uuid)) continue;
        seen.add(tex.uuid);
        let w = tex.image.width || tex.image.naturalWidth || 256;
        let h = tex.image.height || tex.image.naturalHeight || 256;
        if (texSize > 0) {
          const scale = texSize / Math.max(w, h);
          if (scale < 1) { w = Math.round(w * scale); h = Math.round(h * scale); }
        }
        // GLB stores textures as PNG/JPEG. Estimate JPEG ~0.5 bytes/pixel, PNG ~1 byte/pixel
        // Use ~0.75 bytes/pixel as middle ground for embedded textures
        texTotal += Math.round(w * h * 0.75);
      }
    }

    // Animation clips buffer sizes
    let animSize = 0;
    const allClips = this.adapter.getAnimationClips?.() || [];
    const checkboxes = container.querySelectorAll('input[data-export-anim]') || [];
    checkboxes.forEach(cb => {
      const idx = parseInt(cb.dataset.exportAnim);
      if (cb.checked && allClips[idx]) {
        const clip = allClips[idx];
        // Each track: times array + values array (Float32)
        for (const track of (clip.tracks || [])) {
          animSize += (track.times?.length || 0) * 4;
          animSize += (track.values?.length || 0) * 4;
        }
      }
    });

    const totalBytes = geoSize + texTotal + animSize + 4096; // 4KB GLB/JSON overhead
    display.innerHTML = `<i class="fa fa-file"></i> Estimated: <strong>${this._fmtBytes(totalBytes)}</strong>`;
  }

  _fmtBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async _handleExportAction(action, clickEvent) {
    const container = this.panel?.querySelector('#inspectorExport');
    if (!container) return;
    const statusEl = container.querySelector('[data-export-display="status"]');
    const setStatus = (msg, isError = false) => {
      if (statusEl) {
        statusEl.textContent = msg;
        statusEl.className = `inspector-tool-status ${isError ? 'error' : 'success'}`;
        if (msg) setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 4000);
      }
    };

    // Helper to run _doExport with cancel support and progress feedback
    const runExport = async (opts, successMsg) => {
      const controller = new AbortController();
      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'Cancel';
      cancelBtn.className = 'inspector-cancel-btn';
      cancelBtn.onclick = () => controller.abort();

      const onProgress = (msg) => {
        if (statusEl) {
          statusEl.textContent = '';
          statusEl.appendChild(document.createTextNode(msg + ' '));
          statusEl.appendChild(cancelBtn);
          statusEl.className = 'inspector-tool-status';
        }
      };
      onProgress('Preparing export...');

      try {
        await this._doExport({ ...opts, signal: controller.signal, onProgress });
        setStatus(successMsg);
      } catch (err) {
        if (err.name === 'AbortError') {
          setStatus('Export cancelled');
        } else {
          throw err;
        }
      } finally {
        cancelBtn.remove();
      }
    };

    try {
      switch (action) {
        case 'export-glb-full': {
          await runExport({ stripTextures: false }, 'GLB exported!');
          break;
        }
        case 'export-glb-notex': {
          await runExport({ stripTextures: true }, 'GLB exported (no textures)!');
          break;
        }
        case 'export-textures': {
          setStatus('Exporting textures...');
          await this._exportTextures();
          setStatus('Textures exported!');
          break;
        }
        case 'export-single-anim': {
          const idx = parseInt(clickEvent?.target?.closest('[data-anim-idx]')?.dataset?.animIdx ?? '0');
          const clips = this.adapter.getAnimationClips?.() || [];
          if (clips[idx]) {
            await runExport(
              { animOnly: true, forceAnims: [clips[idx]] },
              'Animation exported (rig only)!'
            );
          }
          break;
        }
        case 'anim-all': {
          container.querySelectorAll('input[data-export-anim]').forEach(cb => { cb.checked = true; });
          this._updateEstimatedSize();
          break;
        }
        case 'anim-none': {
          container.querySelectorAll('input[data-export-anim]').forEach(cb => { cb.checked = false; });
          this._updateEstimatedSize();
          break;
        }
        case 'flip-normals':
          this._toolFlipNormals();
          setStatus('Normals flipped!');
          break;
        case 'center-model':
          this._toolCenterModel();
          setStatus('Model centered!');
          break;
      }
    } catch (err) {
      console.warn('Export error:', err);
      setStatus(`Error: ${err.message}`, true);
    }
  }

  // Unified export that applies texture resize + simplify + animation selection
  // animOnly: export only skeleton/rig + animations, no mesh geometry
  // signal: AbortSignal for cancellation, onProgress: callback for status updates
  async _doExport({ stripTextures = false, forceAnims = undefined, animOnly = false, signal, onProgress } = {}) {
    const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
    const root = this.adapter.getModelRoot();
    if (!root) throw new Error('No model loaded');

    const container = this.panel?.querySelector('#inspectorExport');
    const texSize = parseInt(container?.querySelector('[data-export-param="tex-size"]')?.value || '0');
    const simplifyRatio = parseInt(container?.querySelector('[data-export-param="simplify-ratio"]')?.value || '100') / 100;

    // Collect selected animations
    let animations;
    if (forceAnims !== undefined) {
      animations = forceAnims;
    } else {
      const allClips = this.adapter.getAnimationClips?.() || [];
      const checkboxes = container?.querySelectorAll('input[data-export-anim]') || [];
      animations = [];
      checkboxes.forEach(cb => {
        const idx = parseInt(cb.dataset.exportAnim);
        if (cb.checked && allClips[idx]) animations.push(allClips[idx]);
      });
    }

    // --- Apply modifications (non-destructive, restore after export) ---
    const restorers = [];

    // 0. If no animations selected, reset skeleton to bind pose (prevents squashed export)
    if (animations.length === 0) {
      // Pause animation to prevent mixer from overwriting bones during export
      const wasPlaying = this.adapter.isPlaying?.();
      if (wasPlaying) {
        this.adapter.togglePlayback?.();
        // Wait 2 frames for the pause to propagate through the animation system
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      }

      const meshes = this.adapter.getAllMeshes?.() || [];
      for (const mesh of meshes) {
        if (mesh.isSkinnedMesh && mesh.skeleton) {
          // Save current bone transforms
          const savedBones = mesh.skeleton.bones.map(bone => ({
            bone,
            pos: bone.position.clone(),
            rot: bone.quaternion.clone(),
            scale: bone.scale.clone()
          }));
          // Reset to bind pose and update bone matrices
          mesh.skeleton.pose();
          mesh.skeleton.update();
          restorers.push(() => {
            savedBones.forEach(({ bone, pos, rot, scale }) => {
              bone.position.copy(pos);
              bone.quaternion.copy(rot);
              bone.scale.copy(scale);
            });
            // Resume playback if it was playing before
            if (wasPlaying) this.adapter.togglePlayback?.();
          });
        }
      }
      // Propagate bone changes through the scene graph
      root.updateMatrixWorld(true);
    }

    // 0b. If animOnly, remove all mesh nodes (keep only bone hierarchy)
    if (animOnly) {
      const removedMeshes = [];
      // Collect meshes first, then remove (can't modify tree during traversal)
      root.traverse(child => {
        if (child.isMesh || child.isSkinnedMesh || child.isPoints) {
          removedMeshes.push({ mesh: child, parent: child.parent });
        }
      });
      removedMeshes.forEach(({ mesh, parent }) => {
        if (parent) parent.remove(mesh);
      });
      restorers.push(() => {
        removedMeshes.forEach(({ mesh, parent }) => {
          if (parent) parent.add(mesh);
        });
        this.adapter._requestRender?.();
      });
    }

    // 1. Texture resize
    if (texSize > 0 && !animOnly) {
      onProgress?.('Resizing textures...');
      if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError');
      const materials = this.adapter.getAllMaterials?.() || [];
      const processed = new Set();
      for (const mat of materials) {
        for (const prop of TEX_PROPS) {
          const tex = mat[prop];
          if (!tex || !tex.image || processed.has(tex.uuid)) continue;
          processed.add(tex.uuid);
          const img = tex.image;

          // Validate drawable source
          const isDrawable = (img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0)
            || img instanceof HTMLCanvasElement
            || img instanceof ImageBitmap
            || img instanceof OffscreenCanvas;
          if (!isDrawable) {
            console.warn(`Skipping texture resize for ${prop}: non-drawable image type`);
            continue;
          }

          const origW = img.width || img.naturalWidth || 512;
          const origH = img.height || img.naturalHeight || 512;
          if (origW <= texSize && origH <= texSize) continue;
          const origImage = tex.image;
          const scale = texSize / Math.max(origW, origH);
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(origW * scale);
          canvas.height = Math.round(origH * scale);
          try {
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            tex.image = canvas;
            tex.needsUpdate = true;
            restorers.push(() => { tex.image = origImage; tex.needsUpdate = true; });
          } catch (err) {
            console.warn(`Texture resize failed for ${prop}:`, err);
          }
        }
        if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError');
      }
    }

    // 2. Strip textures
    if (stripTextures && !animOnly) {
      const materials = this.adapter.getAllMaterials?.() || [];
      for (const mat of materials) {
        for (const prop of TEX_PROPS) {
          if (mat[prop]) {
            const orig = mat[prop];
            mat[prop] = null;
            mat.needsUpdate = true;
            restorers.push(() => { mat[prop] = orig; mat.needsUpdate = true; });
          }
        }
      }
    }

    // 3. Simplify geometry (using meshoptimizer for topology-preserving, fast WASM simplification)
    if (simplifyRatio < 1 && !animOnly) {
      onProgress?.('Loading simplifier...');
      if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError');
      try {
        const { MeshoptSimplifier } = await import('https://cdn.jsdelivr.net/npm/meshoptimizer@0.21/meshopt_simplifier.module.js');
        await MeshoptSimplifier.ready;
        const { BufferAttribute, BufferGeometry } = await import('three');

        const meshes = this.adapter.getAllMeshes?.() || [];
        let simplifyFailed = 0;
        for (let i = 0; i < meshes.length; i++) {
          if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError');
          const mesh = meshes[i];
          if (mesh.isPoints) continue; // Point clouds can't be simplified

          const geo = mesh.geometry;
          const origGeo = geo;
          const posAttr = geo.attributes.position;
          if (!posAttr || posAttr.count < 4) continue;

          onProgress?.(`Simplifying mesh ${i + 1}/${meshes.length}...`);
          try {
            // Get or create index buffer (meshoptimizer requires indexed geometry)
            let workGeo = geo;
            if (!geo.index) {
              const { BufferGeometryUtils } = await import('three/addons/utils/BufferGeometryUtils.js');
              workGeo = BufferGeometryUtils.mergeVertices(geo);
            }
            const srcIndices = new Uint32Array(workGeo.index.array);
            const positions = new Float32Array(workGeo.attributes.position.array);
            const targetIndexCount = Math.max(3, Math.floor(srcIndices.length * simplifyRatio / 3) * 3);

            const [newIndices, error] = MeshoptSimplifier.simplify(
              srcIndices, positions, 3, targetIndexCount, 0.01, ['LockBorder']
            );

            if (newIndices.length >= 3 && newIndices.length < srcIndices.length) {
              // Compact: remove unreferenced vertices to shrink the buffer
              const usedSet = new Set(newIndices);
              const oldToNew = new Map();
              let newIdx = 0;
              for (const vi of usedSet) oldToNew.set(vi, newIdx++);
              const compactCount = oldToNew.size;

              const compactGeo = new BufferGeometry();
              // Remap each attribute buffer to only include used vertices
              for (const name in workGeo.attributes) {
                const src = workGeo.attributes[name];
                const arr = new src.array.constructor(compactCount * src.itemSize);
                for (const [oldV, newV] of oldToNew) {
                  for (let c = 0; c < src.itemSize; c++) {
                    arr[newV * src.itemSize + c] = src.array[oldV * src.itemSize + c];
                  }
                }
                compactGeo.setAttribute(name, new BufferAttribute(arr, src.itemSize, src.normalized));
              }
              // Remap index buffer
              const remappedIdx = new Uint32Array(newIndices.length);
              for (let j = 0; j < newIndices.length; j++) remappedIdx[j] = oldToNew.get(newIndices[j]);
              compactGeo.setIndex(new BufferAttribute(remappedIdx, 1));

              // Copy morph attributes if present
              if (workGeo.morphAttributes) {
                for (const name in workGeo.morphAttributes) {
                  compactGeo.morphAttributes[name] = workGeo.morphAttributes[name].map(src => {
                    const arr = new src.array.constructor(compactCount * src.itemSize);
                    for (const [oldV, newV] of oldToNew) {
                      for (let c = 0; c < src.itemSize; c++) {
                        arr[newV * src.itemSize + c] = src.array[oldV * src.itemSize + c];
                      }
                    }
                    return new BufferAttribute(arr, src.itemSize, src.normalized);
                  });
                }
              }
              if (workGeo.morphTargetsRelative) compactGeo.morphTargetsRelative = true;

              mesh.geometry = compactGeo;
              restorers.push(() => { mesh.geometry = origGeo; });
            }
          } catch (err) {
            simplifyFailed++;
            console.warn(`Simplify failed for ${mesh.name || 'mesh'}:`, err);
          }
          // Yield to event loop between meshes so UI stays responsive
          await new Promise(r => setTimeout(r, 0));
        }
        if (simplifyFailed > 0) {
          console.warn(`${simplifyFailed}/${meshes.length} meshes could not be simplified`);
        }
      } catch (err) {
        if (err.name === 'AbortError') throw err;
        console.warn('meshoptimizer simplifier not available:', err);
      }
    }

    // --- Export (with try/finally to guarantee restorers run) ---
    try {
      if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError');
      onProgress?.('Generating GLB file...');

      const exporter = new GLTFExporter();
      const options = { binary: true };
      if (animations.length > 0) options.animations = animations;

      // Race parseAsync against a 60s timeout and the abort signal
      const EXPORT_TIMEOUT_MS = 60000;
      let exportTimeout;
      const result = await Promise.race([
        exporter.parseAsync(root, options),
        new Promise((_, reject) => {
          exportTimeout = setTimeout(() => reject(new Error('Export timed out (60s)')), EXPORT_TIMEOUT_MS);
          signal?.addEventListener('abort', () => {
            clearTimeout(exportTimeout);
            reject(new DOMException('Export cancelled', 'AbortError'));
          }, { once: true });
        })
      ]);
      clearTimeout(exportTimeout);

      // --- Download ---
      const suffix = [];
      if (animOnly && forceAnims?.length) {
        const clipName = (forceAnims[0].name || 'animation').replace(/[^a-zA-Z0-9_-]/g, '_');
        suffix.push(`anim_${clipName}`);
      }
      if (texSize > 0 && !animOnly) suffix.push(`${texSize}px`);
      if (simplifyRatio < 1 && !animOnly) suffix.push(`${Math.round(simplifyRatio * 100)}pct`);
      if (stripTextures && !animOnly) suffix.push('notex');
      const name = this._getModelName() + (suffix.length ? '_' + suffix.join('_') : '') + '.glb';

      const blob = new Blob([result], { type: 'application/octet-stream' });
      this._downloadBlob(blob, name);
    } finally {
      // ALWAYS restore modifications, even if export throws or is cancelled
      restorers.forEach(fn => fn());
      this.adapter._requestRender?.();
    }
  }

  async _exportTextures() {
    const materials = this.adapter.getAllMaterials?.() || [];
    if (materials.length === 0) throw new Error('No materials found');
    const exported = new Set();
    let count = 0;

    for (const mat of materials) {
      for (const prop of TEX_PROPS) {
        const tex = mat[prop];
        if (!tex || !tex.image || exported.has(tex.uuid)) continue;
        exported.add(tex.uuid);
        const img = tex.image;
        const canvas = document.createElement('canvas');
        canvas.width = img.width || img.naturalWidth || 512;
        canvas.height = img.height || img.naturalHeight || 512;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        if (blob) {
          const name = tex.name || `${mat.name || 'material'}_${prop}`;
          this._downloadBlob(blob, `${name}.png`);
          count++;
          if (count < exported.size) await new Promise(r => setTimeout(r, 300));
        }
      }
    }
    if (count === 0) throw new Error('No textures to export');
  }

  _toolFlipNormals() {
    const meshes = this.adapter.getAllMeshes?.() || [];
    for (const mesh of meshes) {
      const normals = mesh.geometry.attributes.normal;
      if (!normals) continue;
      for (let i = 0; i < normals.count; i++) {
        normals.setXYZ(i, -normals.getX(i), -normals.getY(i), -normals.getZ(i));
      }
      normals.needsUpdate = true;
    }
    this.adapter._requestRender?.();
  }

  _toolCenterModel() {
    const root = this.adapter.getModelRoot();
    if (!root) return;
    import('three').then(({ Box3, Vector3 }) => {
      const box = new Box3().setFromObject(root);
      const center = box.getCenter(new Vector3());
      root.position.sub(center);
      this.adapter._requestRender?.();
    });
  }

  _downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async _takeScreenshot() {
    try {
      const blob = await this.adapter.takeScreenshot();
      if (!blob) return;
      this._downloadBlob(blob, `${this._getModelName()}_screenshot.png`);
    } catch (err) {
      console.warn('Inspector: Screenshot failed', err);
    }
  }

  _getModelName() {
    const nameEl = document.querySelector('.fullscreen-filename');
    const name = nameEl?.textContent?.trim() || 'model';
    return name.replace(/\.[^.]+$/, '');
  }

  // =========== PUBLIC SHORTCUT METHODS ===========

  toggleWireframe() { const btn = this.toolbar?.querySelector('[data-action="wireframe"]'); if (btn) this._handleToolbarAction('wireframe', btn); }
  toggleGrid() { const btn = this.toolbar?.querySelector('[data-action="grid"]'); if (btn) this._handleToolbarAction('grid', btn); }
  toggleAutoRotate() { const btn = this.toolbar?.querySelector('[data-action="autorotate"]'); if (btn) this._handleToolbarAction('autorotate', btn); }
  togglePlayback() { this.adapter.togglePlayback(); this._updatePlayPauseBtn(this.adapter.isPlaying()); }
  resetCamera() { this.adapter.resetCamera(); }
  toggleNormals() { const i = this.panel?.querySelector('input[data-helper="normals"]'); if (i) { i.checked = !i.checked; i.dispatchEvent(new Event('change')); } }
  toggleBounds() { const i = this.panel?.querySelector('input[data-helper="bounds"]'); if (i) { i.checked = !i.checked; i.dispatchEvent(new Event('change')); } }
  toggleSkeleton() { const i = this.panel?.querySelector('input[data-helper="skeleton"]'); if (i && !i.disabled) { i.checked = !i.checked; i.dispatchEvent(new Event('change')); } }
  screenshot() { this._takeScreenshot(); }

  handleEscape() {
    if (this.isOpen) { this.togglePanel(); return true; }
    return false;
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this._stopAnimPolling();
    this._closeMaterialEditor();
    this._abortController.abort();
    this._hide();

    ['#inspectorStats', '#inspectorMaterials', '#inspectorAnimations', '#inspectorHelpers', '#inspectorScene', '#inspectorExport'].forEach(sel => {
      const el = this.panel?.querySelector(sel);
      if (el) el.innerHTML = '';
    });

    // Reset animation bar
    if (this.animBar) {
      this.animBar.style.display = 'none';
      const select = this.animBar.querySelector('.model-anim-bar-select');
      if (select) select.innerHTML = '';
    }

    this.toolbar?.querySelectorAll('.model-toolbar-btn.active').forEach(btn => btn.classList.remove('active'));
    if (this.panel) {
      this.panel.style.width = '';
      this.panel.classList.remove('floating');
      this.panel.style.left = '';
      this.panel.style.top = '';
    }
    this._isFloating = false;
    this._exportEventsBound = false;
    this.adapter = null;
  }
}
