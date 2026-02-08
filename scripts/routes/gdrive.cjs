const { google } = require('googleapis');
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const CONFIG_DIR = path.join(__dirname, '..', '..', 'config');
const CREDENTIALS_PATH = path.join(CONFIG_DIR, 'gdrive-credentials.json');
const TOKENS_PATH = path.join(CONFIG_DIR, 'gdrive-tokens.json');
const REDIRECT_URI = process.env.GDRIVE_REDIRECT_URI || 'http://localhost:7777/api/gdrive/callback';
const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];

let oauth2Client = null;

function getOAuth2Client() {
  if (oauth2Client) return oauth2Client;

  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error('Google Drive credentials not found. Place your OAuth credentials in config/gdrive-credentials.json');
  }

  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
  const { client_id, client_secret } = credentials.installed || credentials.web || {};

  if (!client_id || !client_secret) {
    throw new Error('Invalid gdrive-credentials.json: missing client_id or client_secret');
  }

  oauth2Client = new google.auth.OAuth2(client_id, client_secret, REDIRECT_URI);

  // Load saved tokens if they exist
  if (fs.existsSync(TOKENS_PATH)) {
    const tokens = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf8'));
    oauth2Client.setCredentials(tokens);
  }

  // Auto-save refreshed tokens
  oauth2Client.on('tokens', (tokens) => {
    try {
      let existing = {};
      if (fs.existsSync(TOKENS_PATH)) {
        existing = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf8'));
      }
      const merged = { ...existing, ...tokens };
      fs.writeFileSync(TOKENS_PATH, JSON.stringify(merged, null, 2));
    } catch (err) {
      console.error('Failed to save refreshed tokens:', err.message);
    }
  });

  return oauth2Client;
}

// Initiate OAuth flow
router.get('/auth', (req, res) => {
  try {
    const authUrl = getOAuth2Client().generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent'
    });
    res.redirect(authUrl);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// OAuth callback
router.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('Missing authorization code');

  try {
    const { tokens } = await getOAuth2Client().getToken(code);
    oauth2Client.setCredentials(tokens);

    // Ensure config directory exists
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));

    // Close the popup with a success message
    res.send(`
      <html><body style="background:#1e1e1e;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
        <div style="text-align:center">
          <h2 style="color:#9b77ff">Google Drive Connected</h2>
          <p>You can close this window now.</p>
          <script>setTimeout(() => window.close(), 1500);</script>
        </div>
      </body></html>
    `);
  } catch (error) {
    console.error('GDrive callback error:', error.message);
    res.status(500).send(`Authentication failed: ${error.message}`);
  }
});

// Check authentication status
router.get('/status', (req, res) => {
  try {
    const client = getOAuth2Client();
    const hasTokens = client.credentials && client.credentials.access_token;
    res.json({ authenticated: !!hasTokens });
  } catch {
    res.json({ authenticated: false });
  }
});

// Logout - clear saved tokens
router.get('/logout', (req, res) => {
  try {
    if (fs.existsSync(TOKENS_PATH)) {
      fs.unlinkSync(TOKENS_PATH);
    }
    if (oauth2Client) {
      oauth2Client.revokeCredentials().catch(() => {});
      oauth2Client = null;
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List files in a folder
router.get('/list', async (req, res) => {
  const { folderId = 'root', pageToken } = req.query;

  try {
    const drive = google.drive({ version: 'v3', auth: getOAuth2Client() });

    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, thumbnailLink)',
      orderBy: 'folder,name',
      pageSize: 200,
      pageToken: pageToken || undefined,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });

    const items = response.data.files.map(f => ({
      id: f.id,
      name: f.name,
      type: f.mimeType === 'application/vnd.google-apps.folder' ? 'directory' : 'file',
      mimeType: f.mimeType,
      size: parseInt(f.size) || 0,
      lastModified: f.modifiedTime,
      thumbnailLink: f.thumbnailLink
    }));

    res.json({ items, nextPageToken: response.data.nextPageToken });
  } catch (error) {
    console.error('GDrive list error:', error.message);
    if (error.code === 401) {
      return res.status(401).json({ error: 'Authentication expired. Please re-login.' });
    }
    res.status(500).json({ error: error.message });
  }
});

// List files recursively across subfolders
router.get('/list-recursive', async (req, res) => {
  const { folderId = 'root', maxDepth = 'all' } = req.query;
  const depthLimit = maxDepth === 'all' ? Infinity : parseInt(maxDepth) || 1;

  try {
    const drive = google.drive({ version: 'v3', auth: getOAuth2Client() });
    const allFiles = [];

    async function scanFolder(currentFolderId, currentDepth, pathPrefix) {
      let pageToken = undefined;
      do {
        const response = await drive.files.list({
          q: `'${currentFolderId}' in parents and trashed = false`,
          fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime)',
          orderBy: 'name',
          pageSize: 200,
          pageToken: pageToken || undefined,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true
        });

        for (const f of response.data.files) {
          if (f.mimeType === 'application/vnd.google-apps.folder') {
            // Recurse into subfolder if within depth limit
            if (currentDepth < depthLimit) {
              await scanFolder(f.id, currentDepth + 1, pathPrefix + f.name + '/');
            }
          } else {
            allFiles.push({
              id: f.id,
              name: f.name,
              type: 'file',
              mimeType: f.mimeType,
              size: parseInt(f.size) || 0,
              lastModified: f.modifiedTime,
              fullPath: pathPrefix + f.name
            });
          }
        }

        pageToken = response.data.nextPageToken;
      } while (pageToken);
    }

    await scanFolder(folderId, 0, '');
    res.json({ files: allFiles });
  } catch (error) {
    console.error('GDrive list-recursive error:', error.message);
    if (error.code === 401) {
      return res.status(401).json({ error: 'Authentication expired. Please re-login.' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Get file download URL (returns proxy URL since GDrive needs auth)
router.get('/file-url', (req, res) => {
  const { fileId } = req.query;
  if (!fileId) return res.status(400).json({ error: 'fileId parameter is required' });
  res.json({ url: `/api/gdrive/proxy/${fileId}` });
});

// Proxy file content
router.get('/proxy/:fileId', async (req, res) => {
  try {
    const drive = google.drive({ version: 'v3', auth: getOAuth2Client() });

    // Get file metadata for content type
    const meta = await drive.files.get({
      fileId: req.params.fileId,
      fields: 'name,mimeType,size',
      supportsAllDrives: true
    });

    res.set({
      'Content-Type': meta.data.mimeType,
      'Content-Disposition': `inline; filename="${meta.data.name}"`,
      'Cache-Control': 'public, max-age=3600'
    });
    if (meta.data.size) {
      res.set('Content-Length', meta.data.size);
    }

    // Stream the file content
    const response = await drive.files.get(
      { fileId: req.params.fileId, alt: 'media', supportsAllDrives: true },
      { responseType: 'stream' }
    );

    response.data.pipe(res);
  } catch (error) {
    console.error('GDrive proxy error:', error.message);
    if (error.code === 401) {
      return res.status(401).json({ error: 'Authentication expired. Please re-login.' });
    }
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
