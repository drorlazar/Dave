// GDriveClient.js - Google Drive client via Apps Script popup bridge
//
// Instead of OAuth Client IDs, this opens the Apps Script web app in a popup.
// The popup handles Google authorization and communicates via postMessage.
// All Drive API calls happen server-side in Apps Script (as the authorized user).

// TODO: Replace with your deployed Apps Script URL after deployment
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzo82A_YVtEdZiAJ9y3UJUmdG94bCvcBSqh0cHywy-RQeTx2bUu3lpLtR7tQv5rxlc2Kw/exec';

export class GDriveClient {
  constructor() {
    this.popup = null;
    this._bridgeWindow = null; // The actual iframe window inside the popup (for postMessage)
    this.connected = false;
    this.userEmail = null;
    this._pendingRequests = new Map(); // requestId → { resolve, reject }
    this._requestCounter = 0;
    this._messageHandler = null;
    this._readyResolve = null;
  }

  /**
   * No-op for backward compatibility. No config needed.
   */
  init() {}

  /**
   * Opens the Apps Script popup and waits for the user to authorize.
   * Must be called from a user gesture (click handler) to avoid popup blockers.
   * @returns {Promise<boolean>} true if connected successfully
   */
  requestToken() {
    return new Promise((resolve) => {
      // If already connected and popup is open, just return
      if (this.connected && this.popup && !this.popup.closed) {
        resolve(true);
        return;
      }

      // Clean up any previous state
      this._cleanup();

      // Set up the message listener before opening popup
      this._setupMessageListener();

      // Store resolve for when 'ready' message arrives
      this._readyResolve = resolve;

      // Open the popup
      const width = 420;
      const height = 350;
      const left = window.screenX + Math.round((window.outerWidth - width) / 2);
      const top = window.screenY + Math.round((window.outerHeight - height) / 2);

      this.popup = window.open(
        APPS_SCRIPT_URL,
        'dave-gdrive-bridge',
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=no`
      );

      if (!this.popup) {
        this._readyResolve = null;
        alert('Popup was blocked. Please allow popups for this site and try again.');
        resolve(false);
        return;
      }

      // Timeout: if no ready message in 60 seconds, fail
      setTimeout(() => {
        if (this._readyResolve) {
          this._readyResolve = null;
          resolve(false);
        }
      }, 60000);
    });
  }

  /**
   * Returns true if the popup bridge is open and authorized.
   */
  isAuthenticated() {
    return this.connected && !!this.popup && !this.popup.closed;
  }

  /**
   * Closes the popup and resets connection state.
   */
  revokeToken() {
    this._cleanup();
    this.connected = false;
    this.userEmail = null;
  }

  /**
   * Lists files and folders in a given Drive folder.
   * @param {string} folderId - 'root' or a Google Drive folder ID
   * @returns {Promise<{items: Array}>}
   */
  async listFiles(folderId = 'root') {
    const result = await this._sendMessage({ type: 'list', folderId });
    return result.data || { items: [] };
  }

  /**
   * Lists files recursively across subfolders.
   * @param {string} folderId - Starting folder ID
   * @param {string|number} maxDepth - 'all' or a number
   * @returns {Promise<{files: Array}>}
   */
  async listFilesRecursive(folderId = 'root', maxDepth = 'all') {
    const result = await this._sendMessage({
      type: 'listRecursive',
      folderId,
      maxDepth: String(maxDepth)
    });
    return result.data || { files: [] };
  }

  /**
   * Downloads a file and returns it as a Blob.
   * @param {string} fileId - Google Drive file ID
   * @returns {Promise<Blob>}
   */
  async getFileBlob(fileId) {
    const result = await this._sendMessage({ type: 'download', fileId });
    const data = result.data;

    if (data.error === 'file_too_large') {
      throw new Error(data.message || 'File too large for Apps Script download.');
    }

    // Decode base64 content to Blob
    const binaryString = atob(data.content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new Blob([bytes], { type: data.mimeType || 'application/octet-stream' });
  }

  /**
   * Downloads a file and returns a blob object URL.
   * @param {string} fileId - Google Drive file ID
   * @returns {Promise<string>} Object URL for the file
   */
  async getFileObjectUrl(fileId) {
    const blob = await this.getFileBlob(fileId);
    return URL.createObjectURL(blob);
  }

  // ── Internal methods ──

  /**
   * Set up the window message listener to receive messages from the popup.
   */
  _setupMessageListener() {
    if (this._messageHandler) {
      window.removeEventListener('message', this._messageHandler);
    }

    this._messageHandler = (event) => {
      // Accept messages from the popup or any iframe inside it
      // (Apps Script serves HTML in a sandboxed iframe, so event.source
      // is the iframe window, not the popup top-level window)
      if (!this.popup) return;

      const msg = event.data;
      if (!msg || !msg.type) return;

      // Capture the actual source window (the iframe inside the popup)
      // so we can send messages back to it
      if (event.source && event.source !== window) {
        this._bridgeWindow = event.source;
      }

      this._onMessage(msg);
    };

    window.addEventListener('message', this._messageHandler);
  }

  /**
   * Handle incoming messages from the popup bridge.
   */
  _onMessage(msg) {
    // Handle the 'ready' message (sent when popup finishes auth)
    if (msg.type === 'ready') {
      this.connected = true;
      this.userEmail = msg.email || null;
      if (this._readyResolve) {
        this._readyResolve(true);
        this._readyResolve = null;
      }
      return;
    }

    // Handle responses to requests (matched by requestId)
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

    // Handle unsolicited errors
    if (msg.type === 'error') {
      console.error('Google Drive bridge error:', msg.message);
    }
  }

  /**
   * Send a message to the popup and return a Promise for the response.
   * @param {Object} msg - Message to send (must have a 'type' property)
   * @returns {Promise<Object>} The response message from the popup
   */
  _sendMessage(msg) {
    return new Promise((resolve, reject) => {
      if (!this.popup || this.popup.closed) {
        reject(new Error(
          'Google Drive connection lost. The bridge window was closed. ' +
          'Please click "Google Drive" again to reconnect.'
        ));
        return;
      }

      const requestId = ++this._requestCounter;
      msg.requestId = requestId;

      this._pendingRequests.set(requestId, { resolve, reject });

      // Send to the bridge iframe inside the popup (captured via event.source)
      // Falls back to the popup top-level window if bridge not yet captured
      const target = this._bridgeWindow || this.popup;
      target.postMessage(msg, '*');

      // Timeout after 5 minutes (Apps Script has a 6-minute execution limit)
      setTimeout(() => {
        if (this._pendingRequests.has(requestId)) {
          this._pendingRequests.delete(requestId);
          reject(new Error('Request timed out. The Google Drive operation took too long.'));
        }
      }, 300000);
    });
  }

  /**
   * Clean up popup and listeners.
   */
  _cleanup() {
    if (this._messageHandler) {
      window.removeEventListener('message', this._messageHandler);
      this._messageHandler = null;
    }
    if (this.popup && !this.popup.closed) {
      this.popup.close();
    }
    this.popup = null;
    this._bridgeWindow = null;
    this.connected = false;

    // Reject any pending requests
    for (const [id, pending] of this._pendingRequests) {
      pending.reject(new Error('Google Drive connection closed.'));
    }
    this._pendingRequests.clear();
  }
}
