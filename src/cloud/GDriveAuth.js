// GDriveAuth.js - Google Drive authentication handling (via Apps Script popup bridge)

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
      console.error('Google Drive connection error:', e);
      alert(e.message || 'Google Drive connection failed.');
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
      if (isConnected) {
        const client = getGDriveClient();
        statusEl.textContent = client.userEmail
          ? `Connected (${client.userEmail})`
          : 'Connected';
      } else {
        statusEl.textContent = '';
      }
      statusEl.classList.toggle('connected', isConnected);
    }
  }
}
