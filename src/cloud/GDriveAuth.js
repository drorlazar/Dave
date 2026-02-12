// GDriveAuth.js - Google Drive authentication handling (client-side via GIS)
// Supports multiple simultaneous accounts

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

  /** Sign in (or add another account). Opens Google account picker. */
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

  /** Get all connected accounts */
  static getAccounts() {
    try {
      const client = getGDriveClient();
      return client.getAccounts();
    } catch {
      return [];
    }
  }

  /** Get the active account info */
  static getActiveAccount() {
    try {
      const client = getGDriveClient();
      return client.getActiveAccount();
    } catch {
      return null;
    }
  }

  /** Switch to a different account by email */
  static setActiveAccount(email) {
    try {
      const client = getGDriveClient();
      return client.setActiveAccount(email);
    } catch {
      return false;
    }
  }

  /** Logout a specific account (by email) or all accounts */
  static logout(email) {
    try {
      const client = getGDriveClient();
      client.removeAccount(email);
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
