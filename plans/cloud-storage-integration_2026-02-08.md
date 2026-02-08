# Cloud Storage Integration Plan - Google Drive & AWS S3

## Context

DAVE currently only loads files from the local filesystem using the File System Access API. The goal is to add two cloud storage sources (Google Drive and AWS S3) so users can browse, view, and interact with remote assets the same way they do with local files. This involves:
- Upgrading the server to proxy cloud API calls (keeping credentials server-side)
- Extending the client to handle URL-based files (not just `File` objects)
- UI changes: dropdown source picker, cloud folder browser, URL pasting, link drag-and-drop

---

## Step 1: Server - Convert to Express + Add Dependencies

**Files**: `scripts/server.cjs`, `package.json`

- Rewrite `server.cjs` from raw `http.createServer` to Express
- Preserve existing behavior: static file serving, URL rewriting (`/styles/` -> `/src/styles/`), CORS headers, favicon handling
- Mount API routes: `/api/s3/*` and `/api/gdrive/*` before static middleware
- Add dependencies to root `package.json`:
  ```
  express, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, googleapis, dotenv
  ```

## Step 2: AWS S3 API Routes

**New file**: `scripts/routes/s3.cjs`

Routes:
- `GET /api/s3/list?bucket=&prefix=&delimiter=/` - List objects and "folders" at a prefix
- `GET /api/s3/signed-url?bucket=&key=` - Generate pre-signed URL (1-hour expiry)
- `GET /api/s3/proxy?bucket=&key=` - Stream file content through server (fallback for CORS issues)

Credential loading: Use `dotenv` to load from `.env` at project root. Create `.env` with:
```
AWS_ACCESS_KEY_ID=<your-access-key>
AWS_SECRET_ACCESS_KEY=<your-secret-key>
AWS_REGION=eu-central-1
AWS_DEFAULT_BUCKET=<your-bucket-name>
```

## Step 3: Google Drive API Routes

**New file**: `scripts/routes/gdrive.cjs`

Routes:
- `GET /api/gdrive/auth` - Redirect to Google OAuth consent screen
- `GET /api/gdrive/callback` - OAuth callback, exchange code for tokens, save to `config/gdrive-tokens.json`
- `GET /api/gdrive/status` - Check if authenticated (tokens exist and valid)
- `GET /api/gdrive/logout` - Clear saved tokens
- `GET /api/gdrive/list?folderId=root&pageToken=` - List files in a folder
- `GET /api/gdrive/file-url?fileId=` - Return proxy URL for a file
- `GET /api/gdrive/proxy/:fileId` - Stream file content (with proper Content-Type, Content-Disposition)

Config files:
- `config/gdrive-credentials.json` - User places their OAuth client credentials here
- `config/gdrive-tokens.json` - Auto-generated after first login
- Add both + `config/` to `.gitignore`

Token refresh is handled automatically by the `googleapis` library.

## Step 4: Client - Cloud Storage Provider Module

**New file**: `src/cloud/CloudStorageProvider.js`

Central abstraction for cloud operations:
- `listFiles(source, params)` - Calls `/api/s3/list` or `/api/gdrive/list`, returns `{ folders, files }` where files are model objects
- `getFileUrl(model)` - Returns a signed URL (S3) or proxy URL (GDrive) for loading file content
- `parseCloudUrl(url)` - Parses S3 console URLs and Google Drive URLs into source + params

Model object extension for cloud files:
```js
{
  name, type, subtype, fullPath, size, lastModified,  // existing fields
  file: null,                     // null for cloud files (File object for local)
  source: 'local' | 's3' | 'gdrive',  // NEW
  cloudKey: string,               // S3 object key (NEW)
  cloudBucket: string,            // S3 bucket name (NEW)
  cloudFileId: string             // Google Drive file ID (NEW)
}
```

## Step 5: Client - Adapt Asset Loading for Cloud Files

**File**: `src/core/asset_loading.js`

Key changes at specific locations:

1. **`loadTileContent()` (line ~461)**: Replace `URL.createObjectURL(model.file)` with conditional:
   - If `model.file` exists -> `URL.createObjectURL(model.file)` (local, unchanged)
   - If `model.source === 's3'` or `'gdrive'` -> `await CloudStorageProvider.getFileUrl(model)`

2. **`renderPage()` (line ~764)**: Access `model.size` / `model.lastModified` with fallback to `model.file?.size` / `model.file?.lastModified`

3. **`sortFiles()` (line ~277-300)**: Same fallback pattern for size and date comparisons

4. **`showFullscreen()` (line ~825)**: Same conditional URL creation as `loadTileContent()`

5. **`handleDrop()` (line ~1244)**: Add URL/text detection before file processing - check `e.dataTransfer.getData('text/plain')` for cloud URLs

6. **Lazy loading cleanup (line ~94-164)**: Skip `URL.revokeObjectURL()` for cloud files (no blob URL to revoke)

7. **Add `cloudFilesLoaded` event listener**: When cloud browser selects a folder, receive files and load them into the grid via existing `modelFiles` -> `updateFilteredModelFiles()` -> `renderPage()` flow

**File**: `src/handlers/BaseAssetHandler.js` (line ~47)
- Modify `getFileUrl(model)` to use `CloudStorageProvider.getFileUrl()` when `model.file` is null

**File**: `src/handlers/TextHandler.js`
- Add URL-based text fetching when `model.file` is null (use `fetch(url).then(r => r.text())`)

**File**: `src/core/ui.js` (download function, line ~732-767)
- For cloud files, fetch blob via URL instead of `model.file.arrayBuffer()`

## Step 6: UI - Source Dropdown

**File**: `index.html` (line 50-52)

Convert the `#folderPicker` button into a dropdown following existing pattern:
```html
<div class="dropdown" id="sourceDropdown">
  <button class="btn dropdown-btn" title="Choose file source">
    <i class="fa fa-folder-open"></i> Source <i class="fa fa-chevron-down"></i>
  </button>
  <div class="dropdown-content">
    <label class="source-option" data-source="local">
      <i class="fa fa-folder-open"></i> Local Folder
    </label>
    <label class="source-option" data-source="s3">
      <i class="fa fa-cloud"></i> AWS S3
    </label>
    <label class="source-option" data-source="gdrive">
      <i class="fab fa-google-drive"></i> Google Drive
      <span id="gdriveStatus" class="source-status"></span>
    </label>
  </div>
</div>
```

The existing dropdown CSS/JS (mouseenter/mouseleave toggle with `.active` class) applies automatically.

**File**: `src/core/asset_loading.js` (line ~1158)
- Replace `folderPickerButton.addEventListener("click", ...)` with source-option click handlers
- "Local Folder" calls existing `handleFolderSelection()`
- "AWS S3" opens cloud browser modal with S3
- "Google Drive" checks auth status, triggers login if needed, then opens cloud browser

## Step 7: UI - Cloud Browser Modal

**New file**: `src/cloud/CloudBrowserModal.js`

A modal dialog (similar to existing `customTextModal` pattern) for navigating cloud folders:
- Header with source icon and title
- Breadcrumb navigation (click to go back to parent)
- Scrollable list of folders (click to navigate into) and file count summary
- "Load this folder" button to load all supported files into the grid
- Close on X button or clicking outside

Dispatches `cloudFilesLoaded` custom event when user selects a folder.

## Step 8: UI - Google Drive Auth Flow

**New file**: `src/cloud/GDriveAuth.js`

- `checkStatus()` - Calls `GET /api/gdrive/status`
- `login()` - Opens popup to `/api/gdrive/auth`, polls for popup close, verifies auth
- `logout()` - Calls `GET /api/gdrive/logout`
- Updates `#gdriveStatus` indicator in source dropdown

## Step 9: URL Pasting in Search Input

**File**: `src/core/ui.js` (search input handler, line ~121)

Add URL detection in the debounced search handler:
- Detect S3 URLs: `console.aws.amazon.com/s3/buckets/...`, `s3://...`, `*.s3.amazonaws.com/...`
- Detect Google Drive URLs: `drive.google.com/drive/folders/...`
- Parse URL to extract bucket/prefix (S3) or folder ID (GDrive)
- Open cloud browser modal pre-navigated to that location, or load files directly

URL parsing examples:
- `https://eu-central-1.console.aws.amazon.com/s3/buckets/apollo-tasks?region=eu-central-1&prefix=1058/solution_paths/1/.workspace/` -> bucket: `apollo-tasks`, prefix: `1058/solution_paths/1/.workspace/`
- `https://drive.google.com/drive/folders/1MOx99s5sVpeQaprJECjj58qajUO9Zfbh` -> folderId: `1MOx99s5sVpeQaprJECjj58qajUO9Zfbh`

## Step 10: Drag & Drop Cloud Links

**File**: `src/core/asset_loading.js` (handleDrop, line ~1244)

Before existing folder/file detection, check `e.dataTransfer.getData('text/plain')` for cloud URLs. If detected, parse and load via `CloudStorageProvider`.

## Step 11: CSS Additions

**File**: `src/styles/styles.css`

Add styles for:
- `.source-option` - icon + label layout in source dropdown
- `.source-status` / `.source-status.connected` - auth status indicator
- Cloud browser modal: `.cloud-browser-content`, `.cloud-browser-header`, `.cloud-browser-breadcrumb`, `.cloud-browser-list`, `.cloud-item`, `.cloud-folder`, `.cloud-browser-actions`
- Light mode variants using existing `body:not(.dark-mode)` pattern

## Step 12: Configuration & Gitignore

**New file**: `.env` (already gitignored) - AWS credentials
**New dir**: `config/` - Google Drive OAuth config
**File**: `.gitignore` - Add `config/` directory

---

## New Files Created
```
scripts/routes/s3.cjs          - S3 API routes
scripts/routes/gdrive.cjs      - Google Drive API routes
src/cloud/CloudStorageProvider.js - Cloud abstraction layer
src/cloud/CloudBrowserModal.js  - Folder browser UI
src/cloud/GDriveAuth.js        - Google Drive auth handling
.env                           - AWS credentials (gitignored)
config/                        - GDrive OAuth config dir (gitignored)
```

## Modified Files
```
scripts/server.cjs             - Rewrite to Express with API routing
package.json                   - Add server dependencies
index.html                     - Source dropdown, cloud browser modal anchor
src/core/asset_loading.js      - Cloud-aware file loading, URL drops, event listener
src/core/ui.js                 - URL detection in search, cloud download support
src/handlers/BaseAssetHandler.js - Cloud URL resolution in getFileUrl()
src/handlers/TextHandler.js    - URL-based text content fetching
src/styles/styles.css          - Cloud browser modal, source dropdown styles
.gitignore                     - Add config/ directory
```

## Verification

1. **S3 browsing**: Start server -> Click Source -> AWS S3 -> Browse folders in `apollo-tasks` bucket -> Load a folder -> Verify tiles render with images/videos/3D models
2. **S3 URL paste**: Paste `https://eu-central-1.console.aws.amazon.com/s3/buckets/apollo-tasks?region=eu-central-1&prefix=1058/solution_paths/1/.workspace/` in search input -> Should load that S3 path
3. **Google Drive auth**: Click Source -> Google Drive -> Login popup appears -> Authenticate -> Browse folders -> Load assets
4. **GDrive URL paste**: Paste `https://drive.google.com/drive/folders/1MOx99s5sVpeQaprJECjj58qajUO9Zfbh` in search input -> Should load that folder
5. **Drag & drop**: Drag an S3 or GDrive URL from browser address bar into DAVE -> Should load that path
6. **Local folder**: Source -> Local Folder still works exactly as before
7. **All existing tests pass**: `cd tests && npm test` (on port 8080)
