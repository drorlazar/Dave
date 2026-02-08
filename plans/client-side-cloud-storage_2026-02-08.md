# Client-Side Cloud Storage Rework + Subfolder Drag-and-Drop Fix

## Context

DAVE's cloud storage features (S3 + Google Drive) currently require the Express server running locally. This means they don't work on GitHub Pages (`https://drorlazar-sett.github.io/Dave/`). The goal is to make cloud features work **everywhere** - static hosting included - by moving all cloud operations to the browser.

Additionally, dragging/pasting cloud URLs doesn't respect the subfolder toggle setting - it only loads files from the immediate folder, ignoring subfolders.

---

## Bug Fix: Drag-and-Drop Subfolder Support

**File**: `src/core/asset_loading.js` - `handleCloudUrl()` (line ~1433)

**Problem**: `handleCloudUrl()` always calls `CloudStorage.listFiles()` (current folder only). It should check `getLoadSubfolders()` and use `CloudStorage.listFilesRecursive()` when subfolders are enabled.

**Fix**: Before calling `listFiles`, check subfolder state:
```js
const loadSubs = getLoadSubfolders();
const depth = getSubfolderDepth();
if (loadSubs && depth !== 'off') {
  const files = await CloudStorage.listFilesRecursive(source, { ...params, maxDepth: depth });
  // dispatch cloudFilesLoaded
} else {
  const { files } = await CloudStorage.listFiles(source, params);
  // existing logic
}
```

Apply this pattern to both the S3 block (line ~1443) and the GDrive block (line ~1466).

---

## Client-Side Cloud Rework

### New Files

#### 1. `src/cloud/CredentialStore.js` - localStorage credential storage
Replaces `scripts/routes/config.cjs` server endpoints.

- `getS3Credentials()` → `{ accessKeyId, secretAccessKey, region, bucket }` or `null`
- `saveS3Credentials({ accessKeyId, secretAccessKey, region, bucket })`
- `clearS3Credentials()`
- `getGDriveConfig()` → `{ clientId }` or `null`
- `saveGDriveConfig({ clientId })`
- `clearGDriveConfig()`
- `getStatus()` → same shape as old `/api/config/status` response

Keys: `dave_s3_credentials`, `dave_gdrive_config` in localStorage.

#### 2. `src/cloud/S3Client.js` - Browser S3 client with SigV4 signing
Replaces `scripts/routes/s3.cjs` server endpoints.

**SigV4 signing** via Web Crypto API (`crypto.subtle`):
- `hmacSHA256(key, message)` - HMAC-SHA256 using `crypto.subtle.sign`
- `sha256(message)` - SHA-256 hash using `crypto.subtle.digest`
- `getSigningKey(secretKey, dateStamp, region, service)` - derive signing key
- `signRequest(method, url, headers, payload)` - full SigV4 Authorization header

**S3 operations**:
- `listObjects(prefix, delimiter)` → `{ folders: [], contents: [] }` - calls `GET /?list-type=2` with SigV4, parses XML response via `DOMParser`
- `listObjectsRecursive(prefix, maxDepth)` → `{ files: [] }` - no delimiter, client-side depth filtering
- `generatePresignedUrl(key, expiresIn)` → URL string - query-string SigV4 auth, usable in `<img>/<video>/<audio> src`

**S3 bucket endpoint**: `https://{bucket}.s3.{region}.amazonaws.com/`

**XML parsing**: `DOMParser` for S3 ListObjectsV2 responses (CommonPrefixes, Contents, IsTruncated, NextContinuationToken).

**CORS requirement**: S3 buckets must have CORS configured allowing the origin + headers (`Authorization`, `x-amz-date`, `x-amz-content-sha256`).

#### 3. `src/cloud/GDriveClient.js` - Browser Google Drive client via GIS
Replaces `scripts/routes/gdrive.cjs` server endpoints.

**Auth** via Google Identity Services (GIS) library:
- `init(clientId)` - creates `google.accounts.oauth2.initTokenClient`
- `requestToken()` → `Promise<boolean>` - opens consent popup
- `isAuthenticated()` → boolean - checks token validity
- `revokeToken()` - calls `google.accounts.oauth2.revoke`

**Drive REST API v3** (direct fetch with Bearer token):
- `listFiles(folderId)` → `{ items: [] }` - `GET https://www.googleapis.com/drive/v3/files?q='folderId'+in+parents`
- `listFilesRecursive(folderId, maxDepth)` → `{ files: [] }` - recursive folder scan
- `getFileBlob(fileId)` → `Blob` - `GET .../files/{id}?alt=media`
- `getFileObjectUrl(fileId)` → objectURL string - fetch blob, create `URL.createObjectURL`

**Token management**: Tokens expire in 1 hour. On 401, clear token and throw specific error for UI to handle re-auth.

**OAuth client type**: Must be "Web application" (not "Desktop"). Only needs `client_id` (no secret for browser flow). Authorized JavaScript origins: `https://drorlazar-sett.github.io` + `http://localhost:7777`.

### Modified Files

#### 4. `src/cloud/CloudStorageProvider.js` - Replace fetch('/api/...') with direct clients
- Import `CredentialStore`, `S3Client`, `GDriveClient`
- Lazy-init singleton `s3Client` and `gdriveClient` from stored credentials
- `listS3Files()`: replace `fetch('/api/s3/list')` with `s3Client.listObjects()`
- `listGDriveFiles()`: replace `fetch('/api/gdrive/list')` with `gdriveClient.listFiles()`
- `listS3FilesRecursive()`: replace `fetch('/api/s3/list-recursive')` with `s3Client.listObjectsRecursive()`
- `listGDriveFilesRecursive()`: replace `fetch('/api/gdrive/list-recursive')` with `gdriveClient.listFilesRecursive()`
- `getFileUrl()` for S3: replace `fetch('/api/s3/signed-url')` with `s3Client.generatePresignedUrl()`
- `getFileUrl()` for GDrive: replace `/api/gdrive/proxy/` with `gdriveClient.getFileObjectUrl()`
- Export `getGDriveClient()` for use by `GDriveAuth.js`
- **All exported function signatures stay identical** - no changes needed in consumers

#### 5. `src/cloud/GDriveAuth.js` - Use GIS instead of server popup
- `checkStatus()`: check `gdriveClient.isAuthenticated()` instead of `fetch('/api/gdrive/status')`
- `login()`: call `gdriveClient.requestToken()` instead of `window.open('/api/gdrive/auth')`
- `logout()`: call `gdriveClient.revokeToken()` instead of `fetch('/api/gdrive/logout')`
- `updateStatusIndicator()`: unchanged (pure DOM)

#### 6. `src/cloud/SettingsModal.js` - Use CredentialStore instead of server API
- `loadStatus()`: call `CredentialStore.getStatus()` (synchronous) instead of `fetch('/api/config/status')`
- `saveS3()`: call `CredentialStore.saveS3Credentials()` instead of `POST /api/config/s3`
- `saveGDrive()`: change from credentials JSON textarea to single **Client ID** text input. Call `CredentialStore.saveGDriveConfig({ clientId })` instead of `POST /api/config/gdrive`
- Add security notice about localStorage credential storage
- Remove "Is the server running?" error messages

#### 7. `index.html` - Add GIS script tag
```html
<script src="https://accounts.google.com/gsi/client" async defer></script>
```

#### 8. `src/core/asset_loading.js` - Subfolder fix (see bug fix section above)

#### 9. `docs/CLOUD_STORAGE.md` - Update setup guide
- S3: Add CORS configuration instructions (bucket permissions)
- GDrive: Change from "Desktop app" to "Web application" OAuth type
- GDrive: Simplify to just entering Client ID (not full JSON)
- Remove all references to server being required
- Add GitHub Pages specific instructions

### Unchanged (server routes kept as dead code)
- `scripts/routes/s3.cjs`, `scripts/routes/gdrive.cjs`, `scripts/routes/config.cjs`, `scripts/server.cjs` - left intact for anyone who wants server-side proxy

---

## Implementation Order

1. `CredentialStore.js` (new, no dependencies)
2. `S3Client.js` (new, most complex - SigV4 signing)
3. `GDriveClient.js` (new, depends on GIS script)
4. `index.html` (add GIS script tag)
5. `CloudStorageProvider.js` (rewrite internals, keep API stable)
6. `GDriveAuth.js` (adapt to GIS)
7. `SettingsModal.js` (adapt to localStorage + Client ID)
8. `asset_loading.js` (subfolder drag-and-drop fix)
9. `docs/CLOUD_STORAGE.md` (update instructions)

---

## Verification

1. Start server locally, open Settings, enter S3 credentials, browse S3 bucket - files render in grid
2. Open Settings, enter GDrive Client ID, click Source > Google Drive - GIS popup appears, browse folders, load files
3. Paste S3 URL in search bar with subfolder toggle set to "2" - loads files from 2 levels deep
4. Drag Google Drive URL into DAVE with subfolder toggle set to "all" - loads all nested files
5. Deploy to GitHub Pages - verify S3 and GDrive both work without any server
6. Verify pre-signed URLs work for images, videos, audio, 3D models
7. Verify Google Drive blob URLs work for all file types
8. Verify localStorage persists credentials across page reloads
9. Existing local folder loading still works unchanged
