# Cloud Folder Tree View Integration

**Date**: 2026-02-22 | **Branch**: `feat/cloud-tree-view`

## Context

When loading files from Google Drive or S3 via the Cloud Browser Modal, the tree folder panel stays empty. The tree view (`src/viewers/tree_folder_view.js`) is hardcoded for local folders only - it uses the File System Access API (`FileSystemDirectoryHandle`) and has no cloud awareness. Meanwhile, the cloud storage system already returns folder structure data (`{ folders, files }` from `CloudStorageProvider.listFiles()`), but this data is never passed to the tree view.

**Goal**: When cloud files are loaded, populate the tree panel with the cloud folder hierarchy. Clicking a cloud folder in the tree loads its files into the grid. Expanding a cloud folder lazily fetches its subfolders via API.

---

## Files to Modify

### 1. `src/viewers/tree_folder_view.js` (~80 lines added)

**New state variables** (top of file, ~line 18):
```javascript
let cloudContext = null;        // Stored cloud context for current session
let isTreeDrivenLoad = false;   // Re-entry guard
```

**New function: `buildCloudFolderStructure(context, folders)`**
- Converts cloud browser context + folders array into the tree node format
- Root node name: bucket name (S3) or last breadcrumb name (GDrive)
- Each child node gets `cloudSource` descriptor instead of `handle`:
  - S3: `{ type: 's3', bucket, prefix, profileId }`
  - GDrive: `{ type: 'gdrive', folderId, accountEmail }`
- `children: undefined` on leaf nodes (lazy-loadable)

**New function: `processCloudFilesLoaded(context, folders)`**
- Entry point when `cloudFilesLoaded` fires (analogous to `processFolderDrop` for local)
- Sets `currentSourceType`, clears `currentDirectoryHandle`, stores `cloudContext`
- Calls `buildCloudFolderStructure` then `renderFolderTree`
- Shows tree panel if hidden

**New function: `listCloudSubfolders(cloudSource)`**
- Dynamically imports `CloudStorageProvider.listFiles`
- S3: calls with `{ bucket, prefix, profileId }` → returns folders
- GDrive: calls with `{ folderId }` → returns folders
- Returns array of `{ name, path|id }`

**New function: `loadCloudFolderFiles(folder)`**
- Sets `isTreeDrivenLoad = true` (re-entry guard)
- Calls `CloudStorageProvider.listFiles` for the folder's cloud source
- Dispatches `cloudFilesLoaded` event with files + context (reusing existing asset_loading.js handler)
- `finally` resets `isTreeDrivenLoad = false`

**Modify: `initTreeFolderView()`** (~line 531)
- Add `cloudFilesLoaded` event listener:
  ```javascript
  window.addEventListener('cloudFilesLoaded', (event) => {
    if (isTreeDrivenLoad) return; // Don't rebuild tree when tree initiated the load
    const { context, folders } = event.detail;
    if (context?.source && (context.source === 's3' || context.source === 'gdrive')) {
      processCloudFilesLoaded(context, folders || []);
    }
  });
  ```

**Modify: `addFolderToTree()`** (~line 811-822)
- Extend `canHaveChildren` logic to include cloud folders:
  ```javascript
  canHaveChildren = (folder.handle && (!Array.isArray(folder.children) || folder.children.length > 0))
    || (folder.cloudSource && (!Array.isArray(folder.children) || folder.children.length > 0));
  ```
- When `canHaveChildren` and `folder.cloudSource`, still create the child `<ul>`

**Modify: `expandSubfolders()`** (~line 884-902)
- After existing `if (folder.handle)` block, add `else if (folder.cloudSource)`:
  - Show loading spinner on the `li`
  - Call `listCloudSubfolders(folder.cloudSource)`
  - Convert returned folders to tree nodes with proper `cloudSource` descriptors
  - Set `folder.children = [...]`
  - Remove spinner
  - Falls through to existing `addFolderToTree` loop at line 904

**Modify: `loadFilesFromSelectedFolder()`** (~line 1001-1037)
- Change `else` block at line 1035 from throwing error to handling cloud:
  ```javascript
  } else if (folder.cloudSource) {
    console.log(`Loading cloud files from folder: ${folder.name}`);
    await loadCloudFolderFiles(folder);
  } else {
    throw new Error("Folder source is not recognized.");
  }
  ```

**Modify: `refreshCurrentFolder()`** (~line 1506-1514)
- Add cloud refresh path:
  ```javascript
  if (currentDirectoryHandle) {
    // existing local logic
  } else if (cloudContext) {
    const { listFiles } = await import('../cloud/CloudStorageProvider.js');
    const params = cloudContext.source === 's3'
      ? { bucket: cloudContext.bucket, prefix: cloudContext.path, profileId: cloudContext.profileId }
      : { folderId: cloudContext.folderId };
    const { folders } = await listFiles(cloudContext.source, params);
    processCloudFilesLoaded(cloudContext, folders);
  }
  ```

**Modify: `reloadFolderStructure()`** (~line 1492)
- Wrap existing `currentDirectoryHandle` check, add cloud path

**Modify: exports** (~line 1540)
- Add `processCloudFilesLoaded` to exports

### 2. `src/cloud/CloudBrowserModal.js` (~5 lines changed)

**Modify: `loadSelectedFolder()`** (~line 589)
- Add `folders` to the `cloudFilesLoaded` event detail:
  ```javascript
  window.dispatchEvent(new CustomEvent('cloudFilesLoaded', {
    detail: {
      files,
      folders: this.lastLoadedFolders,  // ADD THIS
      context: { ...existing context... }
    }
  }));
  ```

### 3. `src/styles/tree_folder_view.css` (~20 lines added)

Cloud source badge on root node + loading spinner for expanding folders.

---

## Existing Code Reused

| What | Where | How |
|------|-------|-----|
| `listFiles(source, params)` | `CloudStorageProvider.js:140` | Returns `{ folders, files }` - we call this for lazy subfolder expansion |
| `cloudFilesLoaded` event | `asset_loading.js:1379` | Existing handler sets `modelFiles` and renders grid - we reuse for tree-driven loads |
| `renderFolderTree(folderData)` | `tree_folder_view.js:759` | Works with any tree node structure - no changes needed |
| `addFolderToTree(folder, parent)` | `tree_folder_view.js:798` | Minor change to `canHaveChildren` logic |
| `selectFolder(li, folder)` | `tree_folder_view.js:981` | Already generic, works with any `folder` object |
| `lastLoadedFolders` | `CloudBrowserModal.js:66` | Already cached, just needs to be included in event |

## Cloud Folder Data Shapes (from CloudStorageProvider)

**S3 folders**: `{ name: "textures", path: "models/textures/", type: "directory" }`
**GDrive folders**: `{ name: "textures", id: "abc123XYZ", type: "directory" }`

---

## Edge Cases

1. **Re-entry guard**: When tree-driven load dispatches `cloudFilesLoaded`, the tree's own listener must skip via `isTreeDrivenLoad` flag
2. **Switching local ↔ cloud**: `processFolderDrop` clears cloud state; `processCloudFilesLoaded` clears local state
3. **Empty cloud folders**: `listCloudSubfolders` returns `[]` → chevron removed
4. **Auth expiry mid-navigation**: Wrap `listCloudSubfolders` in try/catch, log error, mark `folder.children = []`
5. **GDrive special sections** (Shared/Starred/Recent): Flat lists - show folders as flat top-level items
6. **Expand-all on cloud**: Cap depth at 3 levels to limit API calls
7. **Folder download**: Disable for cloud folders (defer to separate feature)

---

## Implementation Order

1. `CloudBrowserModal.js` - Add `folders` to event (1 line change)
2. `tree_folder_view.js` - Add state vars, `buildCloudFolderStructure`, `processCloudFilesLoaded`, event listener
3. `tree_folder_view.js` - Modify `addFolderToTree` canHaveChildren logic
4. `tree_folder_view.js` - Add `listCloudSubfolders`, modify `expandSubfolders` for cloud
5. `tree_folder_view.js` - Add `loadCloudFolderFiles`, modify `loadFilesFromSelectedFolder` for cloud
6. `tree_folder_view.js` - Modify `refreshCurrentFolder` and `reloadFolderStructure` for cloud
7. `tree_folder_view.css` - Add cloud badge and loading spinner styles
8. Test with S3 and Google Drive

---

## Verification

1. `node scripts/server.cjs` - start server
2. Open http://localhost:7777
3. **S3 test**: Connect S3 bucket → click "Load Files" → verify tree panel shows folder hierarchy with orange "S3" badge
4. **GDrive test**: Connect Google Drive → navigate to folder → click "Load Files" → verify tree shows hierarchy with blue "GDrive" badge
5. **Lazy expand**: Click chevron on cloud folder → verify spinner → subfolders load
6. **Folder selection**: Click cloud folder name → verify grid updates
7. **Back to local**: Drop local folder → verify tree switches to local mode
8. **Refresh**: Click refresh with cloud folder → verify tree rebuilds
9. **Empty folder**: Expand cloud folder with no subfolders → verify chevron disappears
10. Run existing tests: `cd tests && npm test`
