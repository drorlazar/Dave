// googleDriveAPI.js - Google Drive API integration module

/**
 * SETUP INSTRUCTIONS:
 * To use Google Drive integration, you need to create Google Cloud credentials:
 *
 * 1. Go to https://console.cloud.google.com/
 * 2. Create a new project or select existing one
 * 3. Enable Google Drive API
 * 4. Create OAuth 2.0 Client ID (Web application)
 *    - Add authorized JavaScript origins: http://localhost:7777
 *    - Add authorized redirect URIs: http://localhost:7777
 * 5. Create an API Key
 * 6. Replace the placeholder values below with your credentials
 */

// !!! REPLACE THESE WITH YOUR ACTUAL CREDENTIALS !!!
const CLIENT_ID = 'YOUR_CLIENT_ID.apps.googleusercontent.com';
const API_KEY = 'YOUR_API_KEY';

// Discovery doc URL for APIs used by the quickstart
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';

// Authorization scopes required by the API
// Using readonly scope to list and read files
const SCOPES = 'https://www.googleapis.com/auth/drive.readonly';

// State management
let tokenClient;
let gapiInited = false;
let gisInited = false;
let accessToken = null;

/**
 * Initialize the Google API client
 */
export function initializeGoogleAPI() {
  return new Promise((resolve, reject) => {
    // Check if already initialized
    if (gapiInited && gisInited) {
      resolve();
      return;
    }

    // Check if APIs are loaded
    const checkInterval = setInterval(() => {
      if (window.gapi && window.google) {
        clearInterval(checkInterval);

        // Initialize gapi
        gapi.load('client', async () => {
          try {
            await gapi.client.init({
              apiKey: API_KEY,
              discoveryDocs: [DISCOVERY_DOC],
            });
            gapiInited = true;
            console.log('[GoogleDrive] GAPI initialized');

            // Initialize Google Identity Services
            if (window.google && window.google.accounts) {
              tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: CLIENT_ID,
                scope: SCOPES,
                callback: '', // defined later
              });
              gisInited = true;
              console.log('[GoogleDrive] GIS initialized');
              resolve();
            } else {
              reject(new Error('Google Identity Services not loaded'));
            }
          } catch (err) {
            reject(err);
          }
        });
      }
    }, 100);

    // Timeout after 10 seconds
    setTimeout(() => {
      clearInterval(checkInterval);
      if (!gapiInited || !gisInited) {
        reject(new Error('Google API initialization timeout'));
      }
    }, 10000);
  });
}

/**
 * Request user authorization and get access token
 */
export function authorizeGoogleDrive() {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error('Google API not initialized'));
      return;
    }

    tokenClient.callback = async (resp) => {
      if (resp.error !== undefined) {
        reject(resp);
        return;
      }

      accessToken = gapi.client.getToken().access_token;
      console.log('[GoogleDrive] Authorization successful');
      resolve(accessToken);
    };

    // Check if already have a valid token
    if (gapi.client.getToken() === null) {
      // Prompt the user to select a Google Account and ask for consent
      tokenClient.requestAccessToken({prompt: 'consent'});
    } else {
      // Skip display of account chooser and consent dialog for an existing session
      tokenClient.requestAccessToken({prompt: ''});
    }
  });
}

/**
 * Sign out from Google Drive
 */
export function signOutGoogleDrive() {
  const token = gapi.client.getToken();
  if (token !== null) {
    google.accounts.oauth2.revoke(token.access_token);
    gapi.client.setToken('');
    accessToken = null;
    console.log('[GoogleDrive] Signed out');
  }
}

/**
 * Extract folder ID from Google Drive URL
 * Supports various Google Drive URL formats:
 * - https://drive.google.com/drive/folders/FOLDER_ID
 * - https://drive.google.com/drive/u/0/folders/FOLDER_ID
 * - https://drive.google.com/drive/folders/FOLDER_ID?usp=sharing
 */
export function extractFolderIdFromUrl(url) {
  if (!url) return null;

  // Remove whitespace
  url = url.trim();

  // Pattern for folder URLs
  const folderPattern = /\/folders\/([a-zA-Z0-9_-]+)/;
  const match = url.match(folderPattern);

  if (match && match[1]) {
    return match[1];
  }

  // If it's just an ID (no URL), return as is
  if (/^[a-zA-Z0-9_-]+$/.test(url)) {
    return url;
  }

  return null;
}

/**
 * List all files in a Google Drive folder
 * @param {string} folderId - The ID of the folder
 * @param {boolean} includeSubfolders - Whether to include files from subfolders
 * @returns {Promise<Array>} Array of file objects
 */
export async function listFilesInFolder(folderId, includeSubfolders = false) {
  if (!gapiInited) {
    throw new Error('Google API not initialized');
  }

  try {
    const files = [];
    let pageToken = null;

    do {
      const params = {
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, webContentLink, thumbnailLink, fileExtension)',
        pageSize: 1000,
      };

      if (pageToken) {
        params.pageToken = pageToken;
      }

      // For shared folders, we need to use supportsAllDrives
      params.supportsAllDrives = true;
      params.includeItemsFromAllDrives = true;

      const response = await gapi.client.drive.files.list(params);
      const result = response.result;

      if (result.files && result.files.length > 0) {
        files.push(...result.files);
      }

      pageToken = result.nextPageToken;
    } while (pageToken);

    console.log(`[GoogleDrive] Found ${files.length} files in folder ${folderId}`);

    // If includeSubfolders is true, recursively get files from subfolders
    if (includeSubfolders) {
      const folders = files.filter(file => file.mimeType === 'application/vnd.google-apps.folder');
      for (const folder of folders) {
        const subFiles = await listFilesInFolder(folder.id, true);
        files.push(...subFiles);
      }
    }

    return files;
  } catch (err) {
    console.error('[GoogleDrive] Error listing files:', err);
    throw err;
  }
}

/**
 * Get folder metadata
 * @param {string} folderId - The ID of the folder
 * @returns {Promise<Object>} Folder metadata
 */
export async function getFolderMetadata(folderId) {
  if (!gapiInited) {
    throw new Error('Google API not initialized');
  }

  try {
    const response = await gapi.client.drive.files.get({
      fileId: folderId,
      fields: 'id, name, mimeType, createdTime, modifiedTime',
      supportsAllDrives: true,
    });

    return response.result;
  } catch (err) {
    console.error('[GoogleDrive] Error getting folder metadata:', err);
    throw err;
  }
}

/**
 * List folders in user's Google Drive (root level)
 * @returns {Promise<Array>} Array of folder objects
 */
export async function listUserFolders() {
  if (!gapiInited) {
    throw new Error('Google API not initialized');
  }

  try {
    const response = await gapi.client.drive.files.list({
      q: "mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false",
      fields: 'files(id, name, modifiedTime)',
      pageSize: 100,
      orderBy: 'name',
    });

    return response.result.files || [];
  } catch (err) {
    console.error('[GoogleDrive] Error listing folders:', err);
    throw err;
  }
}

/**
 * Get download URL for a file
 * For Google Workspace files (Docs, Sheets, etc.), we export them
 * For regular files, we use the webContentLink
 * @param {Object} file - File object from Google Drive API
 * @returns {string} Download URL
 */
export function getFileDownloadUrl(file) {
  if (!file) return null;

  // Google Workspace files need to be exported
  if (file.mimeType.startsWith('application/vnd.google-apps.')) {
    // Determine export format based on type
    let exportMimeType = 'application/pdf'; // default

    if (file.mimeType === 'application/vnd.google-apps.document') {
      exportMimeType = 'application/pdf';
    } else if (file.mimeType === 'application/vnd.google-apps.spreadsheet') {
      exportMimeType = 'application/pdf';
    } else if (file.mimeType === 'application/vnd.google-apps.presentation') {
      exportMimeType = 'application/pdf';
    }

    return `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=${encodeURIComponent(exportMimeType)}&access_token=${accessToken}`;
  }

  // Regular files
  if (file.webContentLink) {
    return file.webContentLink;
  }

  // Fallback: use API endpoint with access token
  return `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&access_token=${accessToken}`;
}

/**
 * Convert Google Drive file to app's file format
 * @param {Object} driveFile - File object from Google Drive API
 * @returns {Object} File object compatible with app's asset loading system
 */
export function convertToAppFileFormat(driveFile) {
  // Get file extension from name or fileExtension field
  let extension = driveFile.fileExtension || '';
  if (!extension && driveFile.name) {
    const nameParts = driveFile.name.split('.');
    if (nameParts.length > 1) {
      extension = nameParts[nameParts.length - 1].toLowerCase();
    }
  }

  return {
    name: driveFile.name,
    size: parseInt(driveFile.size) || 0,
    type: driveFile.mimeType || '',
    lastModified: new Date(driveFile.modifiedTime).getTime(),
    webkitRelativePath: driveFile.name, // For display purposes
    // Add Google Drive specific metadata
    googleDrive: {
      id: driveFile.id,
      downloadUrl: getFileDownloadUrl(driveFile),
      thumbnailLink: driveFile.thumbnailLink,
      isGoogleDrive: true,
    },
    // Add extension for handler factory
    extension: extension,
  };
}

/**
 * Check if API credentials are configured
 * @returns {boolean} True if credentials are set
 */
export function areCredentialsConfigured() {
  return CLIENT_ID !== 'YOUR_CLIENT_ID.apps.googleusercontent.com' &&
         API_KEY !== 'YOUR_API_KEY';
}

// Global callbacks for script loading
window.gapiLoaded = function() {
  console.log('[GoogleDrive] GAPI script loaded');
};

window.gisLoaded = function() {
  console.log('[GoogleDrive] GIS script loaded');
};
