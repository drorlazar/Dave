// GDriveClient.js - Browser-based Google Drive client using Google Identity Services (GIS)
// Supports multiple simultaneous Google accounts

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const USERINFO_API = 'https://www.googleapis.com/oauth2/v3/userinfo';
const SCOPE = 'https://www.googleapis.com/auth/drive.readonly';

export class GDriveClient {
  constructor() {
    /** @type {Map<string, {accessToken: string, tokenExpiresAt: number, email: string, name: string, picture: string}>} */
    this.accounts = new Map();
    this.activeEmail = null;
    this.tokenClient = null;
    this.clientId = null;
  }

  // Initialize with a Google OAuth Client ID
  init(clientId) {
    this.clientId = clientId;
    this.tokenClient = null; // force re-init on next use
  }

  _ensureTokenClient() {
    if (this.tokenClient) return;
    if (!this.clientId) {
      throw new Error('Google Drive Client ID not configured. Open Settings to add it.');
    }
    if (typeof google === 'undefined' || !google.accounts?.oauth2) {
      throw new Error(
        'Google Sign-In library not loaded. It may be blocked by an ad blocker or content security policy. ' +
        'Try disabling ad blockers for this site.'
      );
    }
    this.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: this.clientId,
      scope: SCOPE,
      prompt: '',   // overridden per-request
      callback: () => {} // overridden in requestToken
    });
  }

  /**
   * Request an access token (opens consent popup).
   * Uses prompt: 'select_account' to allow choosing a different account.
   */
  requestToken() {
    return new Promise((resolve) => {
      try {
        this._ensureTokenClient();
      } catch (e) {
        console.error('GDrive init error:', e);
        resolve(false);
        return;
      }

      this.tokenClient.callback = async (tokenResponse) => {
        if (tokenResponse && tokenResponse.access_token) {
          const token = tokenResponse.access_token;
          const expiresIn = tokenResponse.expires_in ? parseInt(tokenResponse.expires_in, 10) : 3600;
          const tokenExpiresAt = Date.now() + (expiresIn * 1000) - 60000;

          // Fetch user info to identify which account this token belongs to
          try {
            const userInfo = await this._fetchUserInfo(token);
            const account = {
              accessToken: token,
              tokenExpiresAt,
              email: userInfo.email,
              name: userInfo.name || userInfo.email,
              picture: userInfo.picture || ''
            };
            this.accounts.set(userInfo.email, account);
            this.activeEmail = userInfo.email;
          } catch {
            // Fallback: store with generic key if userinfo fails
            const fallbackKey = 'account-' + this.accounts.size;
            this.accounts.set(fallbackKey, {
              accessToken: token,
              tokenExpiresAt,
              email: fallbackKey,
              name: 'Google Account',
              picture: ''
            });
            this.activeEmail = fallbackKey;
          }

          resolve(true);
        } else {
          resolve(false);
        }
      };

      this.tokenClient.error_callback = (error) => {
        console.error('GDrive token error:', error);
        resolve(false);
      };

      // Force account picker when adding accounts
      this.tokenClient.requestAccessToken({
        prompt: this.accounts.size > 0 ? 'select_account' : ''
      });
    });
  }

  async _fetchUserInfo(token) {
    const response = await fetch(USERINFO_API, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to fetch user info');
    return response.json();
  }

  /** Get the active account info (or null) */
  getActiveAccount() {
    if (!this.activeEmail) return null;
    const account = this.accounts.get(this.activeEmail);
    if (!account || Date.now() >= account.tokenExpiresAt) return null;
    return account;
  }

  /** Get all connected accounts */
  getAccounts() {
    return Array.from(this.accounts.values()).filter(a => Date.now() < a.tokenExpiresAt);
  }

  /** Switch active account by email */
  setActiveAccount(email) {
    if (this.accounts.has(email)) {
      this.activeEmail = email;
      return true;
    }
    return false;
  }

  /** Remove a specific account (or all if no email given) */
  removeAccount(email) {
    if (email) {
      const account = this.accounts.get(email);
      if (account) {
        try { google.accounts.oauth2.revoke(account.accessToken); } catch {}
        this.accounts.delete(email);
        if (this.activeEmail === email) {
          const remaining = this.getAccounts();
          this.activeEmail = remaining.length > 0 ? remaining[0].email : null;
        }
      }
    } else {
      // Remove all
      for (const account of this.accounts.values()) {
        try { google.accounts.oauth2.revoke(account.accessToken); } catch {}
      }
      this.accounts.clear();
      this.activeEmail = null;
    }
  }

  isAuthenticated() {
    return !!this.getActiveAccount();
  }

  // Legacy compat
  revokeToken() {
    this.removeAccount();
  }

  // Make an authenticated fetch to Google APIs (uses active account's token)
  async _fetch(url) {
    const account = this.getActiveAccount();
    if (!account) {
      throw new Error('Not authenticated with Google Drive. Please sign in first.');
    }

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${account.accessToken}` }
    });

    if (response.status === 401) {
      // Mark this account's token as expired
      account.tokenExpiresAt = 0;
      throw new Error('Google Drive session expired. Please sign in again.');
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(`Google Drive error: ${err.error?.message || response.statusText}`);
    }

    return response;
  }

  // List files and folders in a given folder
  async listFiles(folderId = 'root') {
    const allItems = [];
    let pageToken = null;

    do {
      const params = new URLSearchParams({
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime)',
        orderBy: 'folder, name',
        pageSize: '200',
        supportsAllDrives: 'true',
        includeItemsFromAllDrives: 'true'
      });
      if (pageToken) params.set('pageToken', pageToken);

      const response = await this._fetch(`${DRIVE_API}/files?${params}`);
      const data = await response.json();

      if (data.files) {
        for (const file of data.files) {
          allItems.push({
            id: file.id,
            name: file.name,
            mimeType: file.mimeType,
            type: file.mimeType === 'application/vnd.google-apps.folder' ? 'directory' : 'file',
            size: file.size ? parseInt(file.size, 10) : 0,
            modifiedTime: file.modifiedTime || ''
          });
        }
      }

      pageToken = data.nextPageToken || null;
    } while (pageToken);

    return { items: allItems };
  }

  // List files recursively across subfolders with optional depth limit
  async listFilesRecursive(folderId = 'root', maxDepth = 'all') {
    const depthLimit = maxDepth === 'all' ? Infinity : parseInt(maxDepth, 10) || Infinity;
    const allFiles = [];

    const scanFolder = async (currentFolderId, currentDepth, pathPrefix) => {
      const { items } = await this.listFiles(currentFolderId);

      for (const item of items) {
        if (item.type === 'directory') {
          if (currentDepth < depthLimit) {
            await scanFolder(item.id, currentDepth + 1, pathPrefix + item.name + '/');
          }
        } else {
          allFiles.push({
            id: item.id,
            name: item.name,
            mimeType: item.mimeType,
            type: 'file',
            size: item.size,
            modifiedTime: item.modifiedTime,
            fullPath: pathPrefix + item.name
          });
        }
      }
    };

    await scanFolder(folderId, 0, '');
    return { files: allFiles };
  }

  // List files shared with the current user
  async listSharedWithMe(pageSize = 200) {
    const allItems = [];
    let pageToken = null;

    do {
      const params = new URLSearchParams({
        q: 'sharedWithMe = true and trashed = false',
        fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime)',
        orderBy: 'folder, name',
        pageSize: String(pageSize),
        supportsAllDrives: 'true',
        includeItemsFromAllDrives: 'true'
      });
      if (pageToken) params.set('pageToken', pageToken);

      const response = await this._fetch(`${DRIVE_API}/files?${params}`);
      const data = await response.json();

      if (data.files) {
        for (const file of data.files) {
          allItems.push({
            id: file.id,
            name: file.name,
            mimeType: file.mimeType,
            type: file.mimeType === 'application/vnd.google-apps.folder' ? 'directory' : 'file',
            size: file.size ? parseInt(file.size, 10) : 0,
            modifiedTime: file.modifiedTime || ''
          });
        }
      }

      pageToken = data.nextPageToken || null;
    } while (pageToken);

    return { items: allItems };
  }

  // List starred files and folders
  async listStarred(pageSize = 200) {
    const allItems = [];
    let pageToken = null;

    do {
      const params = new URLSearchParams({
        q: 'starred = true and trashed = false',
        fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime)',
        orderBy: 'folder, name',
        pageSize: String(pageSize),
        supportsAllDrives: 'true',
        includeItemsFromAllDrives: 'true'
      });
      if (pageToken) params.set('pageToken', pageToken);

      const response = await this._fetch(`${DRIVE_API}/files?${params}`);
      const data = await response.json();

      if (data.files) {
        for (const file of data.files) {
          allItems.push({
            id: file.id,
            name: file.name,
            mimeType: file.mimeType,
            type: file.mimeType === 'application/vnd.google-apps.folder' ? 'directory' : 'file',
            size: file.size ? parseInt(file.size, 10) : 0,
            modifiedTime: file.modifiedTime || ''
          });
        }
      }

      pageToken = data.nextPageToken || null;
    } while (pageToken);

    return { items: allItems };
  }

  // List recently modified files (last 30 days)
  async listRecent(pageSize = 100) {
    const allItems = [];
    let pageToken = null;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    do {
      const params = new URLSearchParams({
        q: `modifiedTime > '${thirtyDaysAgo}' and trashed = false`,
        fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime)',
        orderBy: 'modifiedTime desc',
        pageSize: String(pageSize),
        supportsAllDrives: 'true',
        includeItemsFromAllDrives: 'true'
      });
      if (pageToken) params.set('pageToken', pageToken);

      const response = await this._fetch(`${DRIVE_API}/files?${params}`);
      const data = await response.json();

      if (data.files) {
        for (const file of data.files) {
          allItems.push({
            id: file.id,
            name: file.name,
            mimeType: file.mimeType,
            type: file.mimeType === 'application/vnd.google-apps.folder' ? 'directory' : 'file',
            size: file.size ? parseInt(file.size, 10) : 0,
            modifiedTime: file.modifiedTime || ''
          });
        }
      }

      pageToken = data.nextPageToken || null;
    } while (pageToken);

    return { items: allItems };
  }

  // Download file content as a Blob
  async getFileBlob(fileId) {
    const response = await this._fetch(
      `${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`
    );
    return response.blob();
  }

  // Get an object URL for a file (fetch blob, create objectURL)
  async getFileObjectUrl(fileId) {
    const blob = await this.getFileBlob(fileId);
    return URL.createObjectURL(blob);
  }
}
