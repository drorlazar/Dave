// GDriveClient.js - Browser-based Google Drive client using Google Identity Services (GIS)

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const SCOPE = 'https://www.googleapis.com/auth/drive.readonly';

export class GDriveClient {
  constructor() {
    this.accessToken = null;
    this.tokenExpiresAt = 0;
    this.tokenClient = null;
    this.clientId = null;
  }

  // Initialize with a Google OAuth Client ID
  init(clientId) {
    this.clientId = clientId;
    // GIS library may not be loaded yet (async script). We initialize lazily in _ensureTokenClient.
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
    // We don't set callback here; requestToken creates a Promise-based wrapper
    this.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: this.clientId,
      scope: SCOPE,
      callback: () => {} // overridden in requestToken
    });
  }

  // Request an access token (opens consent popup). Must be called from a user gesture.
  requestToken() {
    return new Promise((resolve) => {
      try {
        this._ensureTokenClient();
      } catch (e) {
        console.error('GDrive init error:', e);
        resolve(false);
        return;
      }

      this.tokenClient.callback = (tokenResponse) => {
        if (tokenResponse && tokenResponse.access_token) {
          this.accessToken = tokenResponse.access_token;
          // Tokens typically expire in 3600 seconds; use expires_in if available
          const expiresIn = tokenResponse.expires_in ? parseInt(tokenResponse.expires_in, 10) : 3600;
          this.tokenExpiresAt = Date.now() + (expiresIn * 1000) - 60000; // 1 min buffer
          resolve(true);
        } else {
          resolve(false);
        }
      };

      this.tokenClient.error_callback = (error) => {
        console.error('GDrive token error:', error);
        resolve(false);
      };

      this.tokenClient.requestAccessToken();
    });
  }

  isAuthenticated() {
    return !!(this.accessToken && Date.now() < this.tokenExpiresAt);
  }

  revokeToken() {
    if (this.accessToken) {
      try {
        google.accounts.oauth2.revoke(this.accessToken);
      } catch (e) {
        // ignore
      }
      this.accessToken = null;
      this.tokenExpiresAt = 0;
    }
  }

  // Make an authenticated fetch to Google APIs
  async _fetch(url) {
    if (!this.accessToken) {
      throw new Error('Not authenticated with Google Drive. Please sign in first.');
    }

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${this.accessToken}` }
    });

    if (response.status === 401) {
      this.accessToken = null;
      this.tokenExpiresAt = 0;
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
