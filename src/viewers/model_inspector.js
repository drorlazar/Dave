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
    if (this.toolbar) {
      this.toolbar.classList.toggle('panel-open', this.isOpen);
      if (this.isOpen) this.toolbar.style.right = (this._panelWidth + 20) + 'px';
      else this.toolbar.style.right = '20px';
    }
    const panelBtn = this.toolbar?.querySelector('[data-action="togglepanel"]');
    if (panelBtn) panelBtn.classList.toggle('active', this.isOpen);
    if (this.isOpen) this._populate();
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
    this.panel.querySelectorAll('.inspector-section-header').forEach(header => {
      header.addEventListener('click', () => {
        header.closest('.inspector-section')?.classList.toggle('collapsed');
      }, { signal });
    });
    this.panel.addEventListener('click', (e) => e.stopPropagation(), { signal });
    this.toolbar?.addEventListener('click', (e) => e.stopPropagation(), { signal });
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
        if (this.toolbar && this.isOpen) {
          this.toolbar.style.right = (newW + 20) + 'px';
        }
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
        header.addEventListener('click', () => {
          header.closest('.inspector-material-item')?.classList.toggle('collapsed');
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
        if (valSpan?.classList.contains('inspector-mat-range-val')) valSpan.textContent = parseFloat(el.value).toFixed(2);
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

    try {
      switch (action) {
        case 'export-glb-full': {
          setStatus('Exporting GLB...');
          await this._doExport({ stripTextures: false });
          setStatus('GLB exported!');
          break;
        }
        case 'export-glb-notex': {
          setStatus('Exporting GLB (no textures)...');
          await this._doExport({ stripTextures: true });
          setStatus('GLB exported (no textures)!');
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
            setStatus(`Exporting "${clips[idx].name}"...`);
            await this._doExport({ stripTextures: false, forceAnims: [clips[idx]] });
            setStatus('Animation exported!');
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
  async _doExport({ stripTextures = false, forceAnims = undefined } = {}) {
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
          // Reset to bind pose
          mesh.skeleton.pose();
          restorers.push(() => {
            savedBones.forEach(({ bone, pos, rot, scale }) => {
              bone.position.copy(pos);
              bone.quaternion.copy(rot);
              bone.scale.copy(scale);
            });
          });
        }
      }
      // Propagate bone changes through the scene graph
      root.updateMatrixWorld(true);
    }

    // 1. Texture resize
    if (texSize > 0) {
      const materials = this.adapter.getAllMaterials?.() || [];
      const processed = new Set();
      for (const mat of materials) {
        for (const prop of TEX_PROPS) {
          const tex = mat[prop];
          if (!tex || !tex.image || processed.has(tex.uuid)) continue;
          processed.add(tex.uuid);
          const img = tex.image;
          const origW = img.width || img.naturalWidth || 512;
          const origH = img.height || img.naturalHeight || 512;
          if (origW <= texSize && origH <= texSize) continue;
          const origImage = tex.image;
          const scale = texSize / Math.max(origW, origH);
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(origW * scale);
          canvas.height = Math.round(origH * scale);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          tex.image = canvas;
          tex.needsUpdate = true;
          restorers.push(() => { tex.image = origImage; tex.needsUpdate = true; });
        }
      }
    }

    // 2. Strip textures
    if (stripTextures) {
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

    // 3. Simplify geometry
    if (simplifyRatio < 1) {
      try {
        const { SimplifyModifier } = await import('three/addons/modifiers/SimplifyModifier.js');
        const { BufferGeometryUtils } = await import('three/addons/utils/BufferGeometryUtils.js');
        const modifier = new SimplifyModifier();
        const meshes = this.adapter.getAllMeshes?.() || [];
        for (const mesh of meshes) {
          const geo = mesh.geometry;
          const origGeo = geo;
          const vertCount = geo.attributes.position.count;
          // SimplifyModifier.modify(geo, removeCount) - removes N vertices
          const removeCount = Math.max(0, Math.floor(vertCount * (1 - simplifyRatio)));
          if (removeCount < 1) continue;
          try {
            let workGeo = geo.index ? geo : BufferGeometryUtils.mergeVertices(geo);
            const simplified = modifier.modify(workGeo, removeCount);
            mesh.geometry = simplified;
            restorers.push(() => { mesh.geometry = origGeo; });
          } catch (err) {
            console.warn(`Simplify failed for ${mesh.name}:`, err);
          }
        }
      } catch (err) {
        console.warn('SimplifyModifier not available:', err);
      }
    }

    // --- Export ---
    const exporter = new GLTFExporter();
    const options = { binary: true };
    if (animations.length > 0) options.animations = animations;

    const result = await exporter.parseAsync(root, options);

    // --- Restore all modifications ---
    restorers.forEach(fn => fn());
    this.adapter._requestRender?.();

    // --- Download ---
    const suffix = [];
    if (texSize > 0) suffix.push(`${texSize}px`);
    if (simplifyRatio < 1) suffix.push(`${Math.round(simplifyRatio * 100)}pct`);
    if (stripTextures) suffix.push('notex');
    const name = this._getModelName() + (suffix.length ? '_' + suffix.join('_') : '') + '.glb';

    const blob = new Blob([result], { type: 'application/octet-stream' });
    this._downloadBlob(blob, name);
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
    if (this.panel) this.panel.style.width = '';
    if (this.toolbar) this.toolbar.style.right = '';
    this._exportEventsBound = false;
    this.adapter = null;
  }
}
