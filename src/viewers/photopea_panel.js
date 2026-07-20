/**
 * photopea_panel.js - Embedded "Edit in Photopea" panel for Dave
 *
 * Opens a full-screen overlay that hosts Photopea (https://www.photopea.com) in an
 * iframe and auto-injects the current image into it via Photopea's postMessage API.
 * No new tab, no clipboard, no manual paste.
 *
 * Protocol (see the photopea-automation skill):
 *   - Embed the iframe (must be served over HTTP, which Dave is).
 *   - The FIRST "done" message Photopea posts after load == ready signal.
 *   - Send the raw image bytes as an ArrayBuffer via postMessage; Photopea opens
 *     them as a document.
 *
 * If Photopea can't be framed / fails, we degrade to opening it in a new tab.
 */

import * as CloudStorage from '../cloud/CloudStorageProvider.js';

const PHOTOPEA_URL = 'https://www.photopea.com';
// Bare www.photopea.com now shows a marketing landing page inside an iframe. Passing
// a config in the URL hash boots straight into the editor app — which is what runs
// the postMessage API we rely on. An empty environment config is enough to launch it.
const PHOTOPEA_APP_URL = PHOTOPEA_URL + '#' + encodeURIComponent(JSON.stringify({ environment: {} }));

class PhotopeaPanel {
  constructor() {
    this.overlay = null;
    this.iframe = null;
    this.model = null;

    this._statusEl = null;
    this._onMessage = null;   // window 'message' listener
    this._onKeyDown = null;   // window 'keydown' (capture) listener
    this._readyTimer = null;

    this._ready = false;          // Photopea has sent its first "done"
    this._pendingBuffer = null;   // image bytes waiting to be injected
  }

  /**
   * Open the panel for a model and auto-load its image into Photopea.
   * @param {object} model - Dave asset model (must be an image).
   */
  async open(model) {
    if (this.overlay) this.close();   // guard against double-open
    this.model = model;

    // Build the overlay first so Photopea starts loading in parallel with the
    // byte fetch below (Photopea itself takes ~1-2s to boot).
    this._buildOverlay(model);

    let buffer;
    try {
      const blob = await this._getBlob(model);
      buffer = await blob.arrayBuffer();
    } catch (err) {
      console.error('[photopea] could not read image bytes:', err);
      this._fallbackToTab('Could not read the image here — opening Photopea in a new tab.');
      return;
    }

    // If we were closed while fetching, bail.
    if (!this.overlay) return;

    this._pendingBuffer = buffer;
    if (this._ready) this._inject();   // Photopea already booted -> inject now
  }

  _buildOverlay(model) {
    const overlay = document.createElement('div');
    overlay.className = 'pp-overlay';
    overlay.innerHTML = `
      <div class="pp-bar">
        <span class="pp-title"><i class="fa fa-pen-to-square"></i> Edit in Photopea<span class="pp-file"></span></span>
        <span class="pp-status">Loading Photopea&hellip;</span>
        <div class="pp-bar-actions">
          <button class="pp-btn pp-tab" title="Open in a new tab instead"><i class="fa fa-arrow-up-right-from-square"></i></button>
          <button class="pp-btn pp-close" title="Close (Esc)"><i class="fa fa-xmark"></i></button>
        </div>
      </div>
      <div class="pp-frame-wrap">
        <iframe class="pp-frame" src="${PHOTOPEA_APP_URL}" title="Photopea image editor"></iframe>
      </div>
    `;
    overlay.querySelector('.pp-file').textContent = model?.name ? ` — ${model.name}` : '';

    document.body.appendChild(overlay);
    this.overlay = overlay;
    this.iframe = overlay.querySelector('.pp-frame');
    this._statusEl = overlay.querySelector('.pp-status');

    overlay.querySelector('.pp-close').addEventListener('click', () => this.close());
    overlay.querySelector('.pp-tab').addEventListener('click', () => this._fallbackToTab(null));

    // Ready handshake + acks from Photopea.
    this._onMessage = (e) => {
      if (!this.iframe || e.source !== this.iframe.contentWindow) return;
      if (e.data === 'done' && !this._ready) {
        this._ready = true;
        this._setStatus('Loading image…');
        if (this._pendingBuffer) this._inject();
      }
    };
    window.addEventListener('message', this._onMessage);

    // Esc closes the panel. Bound on `window` in capture phase so it fires
    // BEFORE the image viewer's document-level capture handler (which would
    // otherwise close the viewer underneath us). Only works while focus is on
    // Dave — once you click into Photopea the iframe owns the keys, so the X
    // button is the always-available close.
    this._onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        e.stopPropagation();
        e.preventDefault();
        this.close();
      }
    };
    window.addEventListener('keydown', this._onKeyDown, true);

    // If Photopea never signals ready, nudge the user toward the tab fallback.
    this._readyTimer = setTimeout(() => {
      if (!this._ready && this.overlay) {
        this._setStatus('Photopea is taking a while— you can open it in a tab instead.');
      }
    }, 12000);
  }

  _inject() {
    if (!this._pendingBuffer || !this.iframe) return;
    try {
      // Photopea opens a posted ArrayBuffer as a new document.
      this.iframe.contentWindow.postMessage(this._pendingBuffer, '*');
      this._pendingBuffer = null;
      this._setStatus('Image loaded — edit away.');
      setTimeout(() => { if (this.overlay) this._setStatus(''); }, 2600);
    } catch (err) {
      console.error('[photopea] inject failed:', err);
      this._setStatus('Could not auto-load — drag the file into Photopea, or open it in a tab.');
    }
  }

  /**
   * Resolve the image to a Blob. Local drag-dropped files already carry a
   * Blob (model.file); everything else is fetched from its URL (Dave's server
   * sends permissive CORS, S3/GDrive resolve to fetchable URLs).
   */
  async _getBlob(model) {
    if (model.file instanceof Blob) return model.file;

    let url = null;
    if (model.remoteUrl) {
      url = model.remoteUrl;
    } else if (model.source === 's3' || model.source === 'gdrive') {
      url = await CloudStorage.getFileUrl(model);
    }
    if (!url) throw new Error('no fetchable image source on model');

    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`fetch failed: HTTP ${resp.status}`);
    return await resp.blob();
  }

  _fallbackToTab(message) {
    window.open(PHOTOPEA_APP_URL, '_blank', 'noopener');
    if (message) this._setStatus(message);
    // Give the user a moment to read the message, then dismiss the panel.
    setTimeout(() => this.close(), message ? 900 : 0);
  }

  _setStatus(text) {
    if (this._statusEl) this._statusEl.textContent = text || '';
  }

  close() {
    if (this._readyTimer) { clearTimeout(this._readyTimer); this._readyTimer = null; }
    if (this._onMessage) { window.removeEventListener('message', this._onMessage); this._onMessage = null; }
    if (this._onKeyDown) { window.removeEventListener('keydown', this._onKeyDown, true); this._onKeyDown = null; }
    if (this.overlay?.parentNode) this.overlay.parentNode.removeChild(this.overlay);

    this.overlay = null;
    this.iframe = null;
    this._statusEl = null;
    this.model = null;
    this._ready = false;
    this._pendingBuffer = null;
  }
}

export const photopeaPanel = new PhotopeaPanel();

// Expose for debugging / remote control, matching Dave's singleton convention.
if (typeof window !== 'undefined') window.photopeaPanel = photopeaPanel;
