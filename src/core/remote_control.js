/**
 * remote_control.js — Lightweight bridge for external tools (Claude Code, etc.)
 * Connects to either the local Dave server or a standalone helper server,
 * receives commands via SSE, and dispatches them into Dave's existing systems.
 *
 * Two modes:
 *  - Same-origin: Dave runs locally at localhost:7777 (full server)
 *  - Cross-origin: Dave runs on GitHub Pages, connects to localhost helper
 *    via ?server=localhost:7778 URL parameter
 */

import { detectFileType } from '../utils/fileTypeDetector.js';

class RemoteControl {
  constructor() {
    this.eventSource = null;
    this.connected = false;
    this.serverBase = ''; // empty = same-origin, or 'http://localhost:7778'
  }

  init() {
    this._resolveServer();
    this._connect();
    this._handleUrlParams();
    console.log('[RemoteControl] Initialized, server:', this.serverBase || '(same-origin)');
  }

  // -----------------------------------------------------------------------
  // Server resolution — detect whether to use same-origin or a local helper
  // -----------------------------------------------------------------------
  _resolveServer() {
    const params = new URLSearchParams(window.location.search);

    // Explicit ?server= param takes priority
    if (params.has('server')) {
      const server = params.get('server');
      // Ensure it has a protocol
      this.serverBase = server.startsWith('http') ? server : `http://${server}`;
      return;
    }

    // If we're on localhost, use same-origin (full Dave server)
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      this.serverBase = '';
      return;
    }

    // On GitHub Pages or other remote host — try the default helper port
    this.serverBase = 'http://localhost:7778';
  }

  // -----------------------------------------------------------------------
  // URL helpers — resolve API paths against the server base
  // -----------------------------------------------------------------------
  _apiUrl(path) {
    return `${this.serverBase}${path}`;
  }

  _fileUrl(filePath) {
    return `${this.serverBase}/api/file?path=${encodeURIComponent(filePath)}`;
  }

  // -----------------------------------------------------------------------
  // SSE connection
  // -----------------------------------------------------------------------
  _connect() {
    this.eventSource = new EventSource(this._apiUrl('/api/control/events'));

    this.eventSource.onmessage = (event) => {
      try {
        const cmd = JSON.parse(event.data);
        this._dispatch(cmd);
      } catch (e) {
        console.error('[RemoteControl] Parse error:', e);
      }
    };

    this.eventSource.onopen = () => {
      this.connected = true;
      this._updateStatusUI(true);
      console.log('[RemoteControl] SSE connected');
    };

    this.eventSource.onerror = () => {
      this.connected = false;
      this._updateStatusUI(false);
      // EventSource auto-reconnects
    };
  }

  // -----------------------------------------------------------------------
  // Command dispatch
  // -----------------------------------------------------------------------
  async _dispatch(cmd) {
    switch (cmd.type) {
      case 'show':
        await this._handleShow(cmd);
        break;
      case 'annotate':
        await this._handleAnnotate(cmd);
        break;
      case 'navigate':
        this._handleNavigate(cmd);
        break;
      case 'report_state':
        await this._reportState(cmd.requestId);
        break;
    }
  }

  // -----------------------------------------------------------------------
  // Show — load files into Dave
  // -----------------------------------------------------------------------
  async _handleShow(cmd) {
    const { files, fullscreen = -1 } = cmd;

    const newFiles = [];
    for (const filePath of files) {
      const name = filePath.split('/').pop();
      const typeInfo = detectFileType(name);
      if (!typeInfo) continue;

      newFiles.push({
        name,
        type: typeInfo.type,
        subtype: typeInfo.subtype,
        fullPath: filePath,
        remoteUrl: this._fileUrl(filePath),
        size: 0,
        lastModified: Date.now(),
      });
    }

    if (newFiles.length === 0) return;

    // Inject into Dave via the same event cloud files use
    window.dispatchEvent(new CustomEvent('cloudFilesLoaded', {
      detail: { files: newFiles }
    }));

    // Wait for render
    await new Promise(r => setTimeout(r, 200));

    // Open fullscreen if requested
    if (fullscreen >= 0 && fullscreen < newFiles.length) {
      const AssetLoading = await import('./asset_loading.js');
      const target = AssetLoading.filteredModelFiles.find(
        f => f.name === newFiles[fullscreen].name
      );
      if (target) AssetLoading.showFullscreen(target);
    }
  }

  // -----------------------------------------------------------------------
  // Annotate — open annotation mode on the current/specified image
  // -----------------------------------------------------------------------
  async _handleAnnotate(cmd) {
    const { fileIndex, tool, color } = cmd;
    const { imageViewer } = await import('../viewers/image_viewer.js');

    // If a specific file index is requested, open it fullscreen first
    if (fileIndex !== undefined) {
      const AssetLoading = await import('./asset_loading.js');
      const imageFiles = AssetLoading.filteredModelFiles.filter(f => f.type === 'image');
      if (fileIndex >= 0 && fileIndex < imageFiles.length) {
        const target = imageFiles[fileIndex];
        if (!imageViewer.isOpen || imageViewer.model?.name !== target.name) {
          AssetLoading.showFullscreen(target);
          await new Promise(r => setTimeout(r, 500));
        }
      }
    }

    // Activate annotation mode
    if (imageViewer.isOpen && !imageViewer.isAnnotationMode) {
      await imageViewer._activateAnnotation();
    }

    // Set tool and color if specified (direct property assignment)
    if (tool && imageViewer._annotationModule) {
      imageViewer._annotationModule.tool = tool;
    }
    if (color && imageViewer._annotationModule) {
      imageViewer._annotationModule.color = color;
    }
  }

  // -----------------------------------------------------------------------
  // Navigate — next/prev/fullscreen/close/zoom
  // -----------------------------------------------------------------------
  _handleNavigate(cmd) {
    const { action } = cmd;

    if (action === 'next') {
      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowRight', bubbles: true
      }));
    } else if (action === 'prev') {
      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowLeft', bubbles: true
      }));
    } else if (action === 'close') {
      document.getElementById('returnButton')?.click();
    } else if (action.startsWith('fullscreen:')) {
      const idx = parseInt(action.split(':')[1]);
      import('./asset_loading.js').then(AL => {
        if (idx >= 0 && idx < AL.filteredModelFiles.length) {
          AL.showFullscreen(AL.filteredModelFiles[idx]);
        }
      });
    } else if (action.startsWith('page:')) {
      const page = parseInt(action.split(':')[1]);
      Promise.all([
        import('./asset_loading.js'),
        import('./ui.js')
      ]).then(([AL, UI]) => {
        UI.setCurrentPage(page);
        AL.renderPage(page);
        UI.updatePagination(Math.ceil(AL.filteredModelFiles.length / UI.getItemsPerPage()));
      });
    } else if (action.startsWith('zoom:')) {
      const zoomVal = action.split(':')[1];
      import('../viewers/image_viewer.js').then(({ imageViewer }) => {
        if (!imageViewer.isOpen) return;
        if (zoomVal === 'fit') imageViewer._zoomToFit?.(true);
        else if (zoomVal === '100') imageViewer._zoomTo100?.();
      });
    }
  }

  // -----------------------------------------------------------------------
  // State reporting — collect state and POST back to server
  // -----------------------------------------------------------------------
  async _reportState(requestId) {
    const AssetLoading = await import('./asset_loading.js');
    const UI = await import('./ui.js');
    let annotationState = { active: false };

    try {
      const { imageViewer } = await import('../viewers/image_viewer.js');
      annotationState = {
        active: !!imageViewer.isAnnotationMode,
        tool: imageViewer._annotationModule?.tool || null,
        color: imageViewer._annotationModule?.color || null,
        strokeCount: imageViewer._annotationModule?.strokes?.length || 0,
        strokes: (imageViewer._annotationModule?.strokes || []).map(s => ({
          id: s.id,
          type: s.type,
          color: s.color,
          text: s.text || null,
        })),
      };
    } catch (_) { /* image viewer not loaded yet */ }

    const state = {
      loaded: {
        fileCount: AssetLoading.filteredModelFiles.length,
        totalFiles: AssetLoading.modelFiles.length,
        files: AssetLoading.filteredModelFiles.slice(0, 100).map(f => ({
          name: f.name,
          type: f.type,
          path: f.fullPath || f.name,
        })),
        currentPage: UI.getCurrentPage(),
        totalPages: Math.ceil(AssetLoading.filteredModelFiles.length / UI.getItemsPerPage()),
      },
      fullscreen: {
        active: !!AssetLoading.currentFullscreenViewer,
        fileName: AssetLoading.currentFullscreenViewer?.fileName || null,
      },
      annotation: annotationState,
      search: UI.getSearchTerm(),
    };

    await fetch(this._apiUrl('/api/control/state-report'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, state }),
    });
  }

  // -----------------------------------------------------------------------
  // Status UI — update the settings panel indicator
  // -----------------------------------------------------------------------
  _updateStatusUI(connected) {
    const el = document.getElementById('rcStatus');
    if (!el) return;
    if (connected) {
      el.innerHTML = '<i class="fa fa-circle rc-dot-on"></i> Connected';
    } else {
      el.innerHTML = '<i class="fa fa-circle rc-dot-off"></i> Not connected';
    }
  }

  // -----------------------------------------------------------------------
  // URL parameter handler — one-shot commands via query string
  // -----------------------------------------------------------------------
  _handleUrlParams() {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('file') && !params.has('files')) return;

    const fileList = params.has('files')
      ? params.get('files').split(',')
      : [params.get('file')];
    const action = params.get('action') || 'show';
    const fullscreenIdx = params.has('fullscreen')
      ? parseInt(params.get('fullscreen'))
      : (fileList.length === 1 ? 0 : -1);

    // Clean URL to avoid re-triggering on refresh (preserve hash)
    window.history.replaceState({}, '', window.location.pathname);

    this._handleShow({
      files: fileList,
      fullscreen: fullscreenIdx,
      clear: true,
    }).then(() => {
      if (action === 'annotate') {
        setTimeout(() => {
          this._handleAnnotate({
            tool: params.get('tool') || 'pen',
            color: params.get('color') || '#ff3333',
          });
        }, 500);
      }
    });
  }
}

export const remoteControl = new RemoteControl();
