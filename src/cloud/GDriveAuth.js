// GDriveAuth.js - Google Drive authentication handling (client-side via GIS)

import { getGDriveClient } from './CloudStorageProvider.js';

export class GDriveAuth {
  static checkStatus() {
    try {
      const client = getGDriveClient();
      return client.isAuthenticated();
    } catch {
      return false;
    }
  }

  static async login() {
    try {
      const client = getGDriveClient();
      return await client.requestToken();
    } catch (e) {
      console.error('Google Drive login error:', e);
      alert(e.message || 'Google Drive login failed.');
      return false;
    }
  }

  static logout() {
    try {
      const client = getGDriveClient();
      client.revokeToken();
    } catch {
      // Ignore errors during logout
    }
  }

  static updateStatusIndicator(isConnected) {
    const statusEl = document.getElementById('gdriveStatus');
    if (statusEl) {
      statusEl.textContent = isConnected ? 'Connected' : '';
      statusEl.classList.toggle('connected', isConnected);
    }
  }
}
