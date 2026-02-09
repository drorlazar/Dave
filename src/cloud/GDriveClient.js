// GDriveClient.js - Google Drive client via Apps Script embedded bridge
//
// Uses a hidden iframe to communicate with the Apps Script bridge.
// Falls back to a popup only for first-time authorization.
// All Drive API calls happen server-side in Apps Script (as the authorized user).

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx3U0FMgoNk_a1-9EiJ2vK3LShKHYBYfE8-hBLZojA5nW3ohh8Fyww3R5WoFTEqlqbhag/exec';

export class GDriveClient {
  constructor() {
    this._iframe = null;       // Hidden iframe bridge (primary)
    this._popup = null;        // Popup fallback (only for first-time auth)
    this._bridgeWindow = null; // The actual window we postMessage to
    this.connected = false;
    this.userEmail = null;
    this._pendingRequests = new Map();
    this._requestCounter = 0;
    this._messageHandler = null;
    this._readyResolve = null;
  }

  init() {}

  /**
   * Connects to Google Drive via hidden iframe.
   * If the iframe doesn't authenticate within a few seconds (first-time auth needed),
   * falls back to a popup for Google consent, then switches to iframe.
   * @returns {Promise<boolean>} true if connected successfully
   */
  requestToken() {
    return new Promise((resolve) => {
      if (this.connected && this._bridgeWindow) {
        resolve(true);
        return;
      }

      this._cleanup();
      this._setupMessageListener();
      this._readyResolve = resolve;

      // Try iframe first (works if user already authorized)
      this._createIframe();

      // If no 'ready' in 4 seconds, assume first-time auth is needed → open popup
      this._iframeFallbackTimer = setTimeout(() => {
        if (this._readyResolve && !this.connected) {
          console.log('GDrive: iframe auth timed out, opening popup for consent...');
          this._openPopupForAuth();
        }
      }, 4000);

      // Final timeout: if nothing works in 60 seconds, fail
      setTimeout(() => {
        if (this._readyResolve) {
          this._readyResolve = null;
          resolve(false);
        }
      }, 60000);
    });
  }

  isAuthenticated() {
    return this.connected && !!this._bridgeWindow;
  }

  revokeToken() {
    this._cleanup();
    this.connected = false;
    this.userEmail = null;
  }

  // ── Drive operations ──

  async listFiles(folderId = 'root') {
    const result = await this._sendMessage({ type: 'list', folderId });
    return result.data || { items: [] };
  }

  async listFilesRecursive(folderId = 'root', maxDepth = 'all') {
    const result = await this._sendMessage({
      type: 'listRecursive',
      folderId,
      maxDepth: String(maxDepth)
    });
    return result.data || { files: [] };
  }

  async listSharedWithMe() {
    const result = await this._sendMessage({ type: 'sharedWithMe' });
    return result.data || { items: [] };
  }

  async listStarred() {
    const result = await this._sendMessage({ type: 'starred' });
    return result.data || { items: [] };
  }

  async listRecent() {
    const result = await this._sendMessage({ type: 'recent' });
    return result.data || { items: [] };
  }

  async getFileBlob(fileId) {
    const result = await this._sendMessage({ type: 'download', fileId });
    const data = result.data;

    if (data.error === 'file_too_large') {
      throw new Error(data.message || 'File too large for Apps Script download.');
    }

    const binaryString = atob(data.content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new Blob([bytes], { type: data.mimeType || 'application/octet-stream' });
  }

  async getFileObjectUrl(fileId) {
    const blob = await this.getFileBlob(fileId);
    return URL.createObjectURL(blob);
  }

  // ── Internal methods ──

  _createIframe() {
    if (this._iframe) {
      this._iframe.remove();
    }
    this._iframe = document.createElement('iframe');
    this._iframe.id = 'gdrive-bridge-frame';
    this._iframe.src = APPS_SCRIPT_URL;
    this._iframe.style.cssText = 'display:none;width:0;height:0;border:none;position:absolute;';
    document.body.appendChild(this._iframe);
  }

  _openPopupForAuth() {
    // Only if iframe didn't work
    const width = 500;
    const height = 600;
    const left = window.screenX + Math.round((window.outerWidth - width) / 2);
    const top = window.screenY + Math.round((window.outerHeight - height) / 2);

    this._popup = window.open(
      APPS_SCRIPT_URL,
      'dave-gdrive-auth',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );

    if (!this._popup) {
      if (this._readyResolve) {
        this._readyResolve(false);
        this._readyResolve = null;
      }
      alert('Popup was blocked. Please allow popups for this site and try again.');
    }
  }

  _setupMessageListener() {
    if (this._messageHandler) {
      window.removeEventListener('message', this._messageHandler);
    }

    this._messageHandler = (event) => {
      const msg = event.data;
      if (!msg || !msg.type) return;

      // Capture the source window for sending messages back
      if (event.source && event.source !== window) {
        this._bridgeWindow = event.source;
      }

      this._onMessage(msg);
    };

    window.addEventListener('message', this._messageHandler);
  }

  _onMessage(msg) {
    if (msg.type === 'ready') {
      this.connected = true;
      this.userEmail = msg.email || null;

      // Clear the fallback timer
      if (this._iframeFallbackTimer) {
        clearTimeout(this._iframeFallbackTimer);
        this._iframeFallbackTimer = null;
      }

      const popupIsOpen = this._popup && !this._popup.closed;

      if (popupIsOpen && !this._awaitingIframeTakeover) {
        // Auth succeeded via popup. Now try to set up the hidden iframe
        // as the permanent bridge so we can close the popup.
        console.log('GDrive: popup auth succeeded. Setting up iframe bridge...');
        this._awaitingIframeTakeover = true;
        this._createIframe();

        // Safety: if iframe doesn't connect in 8 seconds, keep popup as bridge
        this._iframeTakeoverTimer = setTimeout(() => {
          this._awaitingIframeTakeover = false;
          console.log('GDrive: iframe takeover timed out. Popup remains as bridge.');
        }, 8000);
      } else if (this._awaitingIframeTakeover) {
        // Second 'ready' from the iframe — _bridgeWindow now points to iframe.
        // Safe to close the popup.
        this._awaitingIframeTakeover = false;
        if (this._iframeTakeoverTimer) {
          clearTimeout(this._iframeTakeoverTimer);
          this._iframeTakeoverTimer = null;
        }
        if (this._popup && !this._popup.closed) {
          this._popup.close();
        }
        this._popup = null;
        console.log('GDrive: iframe takeover successful. Popup closed.');
      }

      if (this._readyResolve) {
        this._readyResolve(true);
        this._readyResolve = null;
      }
      return;
    }

    if (msg.requestId !== undefined) {
      const pending = this._pendingRequests.get(msg.requestId);
      if (pending) {
        this._pendingRequests.delete(msg.requestId);
        if (msg.type === 'error') {
          pending.reject(new Error(msg.message || 'Unknown error from Google Drive'));
        } else {
          pending.resolve(msg);
        }
      }
      return;
    }

    if (msg.type === 'error') {
      console.error('Google Drive bridge error:', msg.message);
    }
  }

  _sendMessage(msg) {
    return new Promise((resolve, reject) => {
      if (!this._bridgeWindow) {
        reject(new Error(
          'Google Drive not connected. Please click "Google Drive" to connect.'
        ));
        return;
      }

      // Check if bridge window is still alive
      let bridgeDead = false;
      try {
        bridgeDead = this._bridgeWindow.closed;
      } catch (e) {
        // Cross-origin — assume alive
      }
      if (bridgeDead) {
        this._bridgeWindow = null;
        this.connected = false;
        reject(new Error(
          'Google Drive connection lost. Please reconnect via "Google Drive".'
        ));
        return;
      }

      const requestId = ++this._requestCounter;
      msg.requestId = requestId;

      this._pendingRequests.set(requestId, { resolve, reject });

      try {
        this._bridgeWindow.postMessage(msg, '*');
      } catch (e) {
        this._pendingRequests.delete(requestId);
        reject(new Error('Failed to send message to Google Drive bridge.'));
        return;
      }

      // Timeout after 5 minutes
      setTimeout(() => {
        if (this._pendingRequests.has(requestId)) {
          this._pendingRequests.delete(requestId);
          reject(new Error('Request timed out. The Google Drive operation took too long.'));
        }
      }, 300000);
    });
  }

  _cleanup() {
    if (this._iframeFallbackTimer) {
      clearTimeout(this._iframeFallbackTimer);
      this._iframeFallbackTimer = null;
    }
    if (this._iframeTakeoverTimer) {
      clearTimeout(this._iframeTakeoverTimer);
      this._iframeTakeoverTimer = null;
    }
    this._awaitingIframeTakeover = false;
    if (this._messageHandler) {
      window.removeEventListener('message', this._messageHandler);
      this._messageHandler = null;
    }
    if (this._popup && !this._popup.closed) {
      this._popup.close();
    }
    if (this._iframe) {
      this._iframe.remove();
    }
    this._popup = null;
    this._iframe = null;
    this._bridgeWindow = null;
    this.connected = false;

    for (const [id, pending] of this._pendingRequests) {
      pending.reject(new Error('Google Drive connection closed.'));
    }
    this._pendingRequests.clear();
  }
}
