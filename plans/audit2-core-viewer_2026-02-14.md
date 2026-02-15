# Dave Core Asset Viewer Architecture Audit #2
**Date:** February 14, 2026 | **Scope:** Non-Dave personality layer -- the actual asset viewing pipeline

---

## 1. asset_loading.js (1754 lines) -- The Monolith

### What It Does (10 Sections)

1. **Lazy-loading** (lines 68-175): IntersectionObserver, 500ms cleanup delay
2. **Utilities** (lines 177-261): formatFileSize, formatDate, generateThumbnail, loadFont
3. **File scanning** (lines 265-436): Deprecated getFilesFromDirectory + Web Worker pipeline
4. **Tile content loading** (lines 438-738): `loadTileContent()` -- 300-line if/else chain per file type
5. **Page rendering** (lines 740-824): `renderPage()` creates tiles, attaches handlers
6. **Fullscreen viewing** (lines 826-1240): `showFullscreen()` -- 415-line duplicate dispatch chain
7. **Folder navigation** (lines 1242-1336): handleFolderSelection, loadFolderFromPath
8. **Cloud integration** (lines 1338-1464): Cloud browser modal, source dropdown, path bar
9. **Toolbar wiring** (lines 1467-1525): Items-per-page, sort, pagination handlers
10. **Drag and drop** (lines 1527-1633): Cloud URL detection, folder drop, file processing
11. **Cloud URL handling** (lines 1649-1714): `handleCloudUrl()` on window
12. **Exports** (lines 1724-1754): 22 named exports

### Natural Split Points

| Extraction | Lines | Contents |
|-----------|-------|----------|
| `tile_renderer.js` | ~450 | loadTileContent, showFullscreen, IntersectionObserver, thumbnail gen |
| `file_ingestion.js` | ~400 | handleFolderPick, drag/drop, cloud URL, folder selection |
| `format_utils.js` | ~50 | formatFileSize, formatDate, formatTime (pure functions) |
| **Remaining core** | ~400 | renderPage, filter/sort, toolbar, state, exports |

### Critical Finding: Code Duplication

`loadTileContent()` (300 lines) and `showFullscreen()` (415 lines) contain nearly identical file-type dispatch logic. Each file type has a thumbnail path AND a fullscreen path that share URL acquisition, error handling, and viewer setup. This is exactly what the handler system was designed to solve, but it's disabled.

---

## 2. Handler System Health

### Status: Dormant but Complete

9 files, `const useNewHandler = false` at lines 483 and 866 gates the entire system.

### Divergence Analysis

The handlers are **already diverging** from legacy paths:

1. **ImageHandler** adds SVG-specific handling the legacy path doesn't have
2. **Model3DHandler** sets `auto-rotate` on GLB thumbnails; legacy doesn't
3. **TextHandler** is the ONLY handler actually exercised (imported at line 42, used at lines 714 and 1206)
4. **Model3DHandler** fullscreen does NOT create inspector panels -- legacy does. This is why the system was disabled.

**Verdict:** Structurally sound but functionally incomplete. Must add inspector support to Model3DHandler before re-enabling.

---

## 3. State Management: The Scattered Graph

### state.js (10 lines) -- DEAD CODE

The `updateFilteredModelFiles()` it exports is **shadowed** by a different function of the same name in `asset_loading.js` (line 315). Never imported by anything.

### Where State Actually Lives

| State | Location | Type |
|-------|----------|------|
| `modelFiles[]`, `filteredModelFiles[]` | asset_loading.js:63-64 | Module-level let |
| `lastDirectoryHandle`, `currentFullscreenViewer` | asset_loading.js:65-66 | Module-level let |
| `_currentPage`, `_itemsPerPage`, `_selectedFiles`, etc. | ui.js:10-16 | Module-level let + getters |
| `activeFilters` | shared/filters.js:5 | Exported Set (also on window) |
| `isTreeVisible`, `selectedTreeFolder` | tree_folder_view.js:13-19 | Module-level let |

### Circular Dependency: ui.js <-> asset_loading.js

- `ui.js` imports: `renderPage`, `sortFiles`, `modelFiles`, `filteredModelFiles`, `updateFilteredModelFiles`, `showFullscreen` from asset_loading.js
- `asset_loading.js` imports: `getCurrentPage`, `getItemsPerPage`, `setCurrentPage`, `updatePagination`, `fileMatchesSearch`, `getUIElements`, `initializeUI`, + 10 more from ui.js

These two files are effectively **one logical unit** split across two files. Any refactoring of one requires touching the other.

---

## 4. ui.js (1452 lines) -- Natural Splits

| Extraction | Lines | Contents |
|-----------|-------|----------|
| `font_modal.js` | ~200 | openCustomTextModal, closeCustomTextModal, applyCustomFontText |
| `selection_manager.js` | ~120 | _selectedFiles, updateSelectionCount, clearSelection, downloadSelected |
| `fullscreen_controller.js` | ~200 | exitFullscreen, navigateFullscreen, keyboard shortcuts |

---

## 5. Cloud Abstraction Quality

### Strengths
- Clean facade: `CloudStorageProvider.js` exports uniform `listFiles(source, params)`, `getFileUrl(model)`
- URL parsing centralized: `parseS3Url()`, `parseGDriveUrl()`, `isCloudUrl()`
- S3 multi-profile support, GDrive multi-account support

### Leaky Abstractions
1. **`_isCloudUrl()` duplicated in ui.js:19** -- same regex as `CloudStorage.isCloudUrl()` at line 115
2. **`window.handleCloudUrl` bridge** to avoid deepening circular dependency
3. **Model object shape is provider-specific** -- S3 has `cloudKey`/`cloudBucket`, GDrive has `cloudFileId`/`cloudGDriveAccount`. No interface validation.
4. **SettingsModal.js (826 lines)** mixes themes + credentials + release log

---

## 6. Inspector System -- Adapter Pattern

### Assessment: Working Well

- `ModelInspectorPanel` receives adapter (GLB or FBX) in constructor
- Both adapters present uniform interface: `getModelStats()`, `getMaterials()`, `toggleWireframe()`, etc.
- Adding new 3D format = new adapter only

### Risk
- **GLB adapter uses Symbol property iteration** (model_inspector_glb.js:42-79) to access model-viewer internals. Relies on unminified Symbol names. Model-viewer upgrade could silently break inspector.
- **Adapters don't integrate with handler system** -- inspector created in asset_loading.js, not Model3DHandler

---

## 7. Memory Management

### memoryManager.js (173 lines) -- Assessment

**Working:**
- FBX viewer lifecycle management prevents leaked WebGL renderers
- Disposal queue with 10s age threshold prevents premature cleanup during scroll
- `cleanupTile()` used by renderPage

**Dead Code:**
- **Blob URL tracking unused** -- blob URLs managed directly in IntersectionObserver
- **Model-viewer tracking unused** -- registerModelViewer/disposeModelViewer never called
- **No WebGL context limit** -- browsers cap at 8-16 contexts, no enforcement

---

## 8. Error Boundaries

### errorHandler.js Assessment

**Working:**
- Individual tile failures show error icon without breaking other tiles
- FBX errors caught at viewer + tile level
- Cloud fetch failures bubble to tile handler
- Web Worker has onerror handler

**Dead Code:**
- `withErrorHandling()`, `withErrorRecovery()`, `retryOperation()` -- defined but NEVER called anywhere

**Gaps:**
- **Model-viewer CDN script load has no error/timeout** -- CDN outage silently hangs
- No retry for failed thumbnails
- Worker scan errors don't reliably reach UI

---

## 9. Scalability (10,000+ files)

### Pipeline Assessment

| Stage | Approach | Scalability |
|-------|----------|-------------|
| Scanning | Worker posts fileFound per file | OK -- browser batches events |
| Sorting | `localeCompare` full sort | OK for 10K, slow at 100K+ |
| Filtering | `Array.filter()` new array per keystroke (300ms debounce) | OK for 10K |
| Rendering | Pagination: only N tiles per page (default 20) | Excellent |
| Memory | IntersectionObserver disposes off-screen | Good |

### Bottlenecks

1. **No virtual scrolling** -- high items-per-page creates all tiles eagerly
2. **`filteredModelFiles` recreated on every filter/search** -- new array allocation
3. **Selected files uses `model.name` as key** -- collision for same-name files in different folders
4. **Thumbnail data URLs persist on model objects** -- 10K data URL strings in memory
5. **No WebGL context cap** -- 20+ FBX tiles = 20+ WebGL contexts (browser limit: 8-16)

---

## Summary

| Area | Severity | Finding |
|------|----------|---------|
| ui.js <-> asset_loading.js circular dependency | **HIGH** | Effectively one unit, impossible to refactor independently |
| 700+ lines duplicated dispatch code | **HIGH** | loadTileContent + showFullscreen have identical file-type chains |
| state.js dead code | **HIGH** | Shadowed function, never imported |
| _isCloudUrl duplicated | MEDIUM | Same regex in ui.js and CloudStorageProvider |
| Memory manager blob/model-viewer tracking unused | MEDIUM | Dead code within active module |
| Model-viewer CDN load no error handling | MEDIUM | Silently hangs on CDN outage |
| Error handler HOFs dead code | MEDIUM | withErrorHandling, retryOperation never called |
| File selection name collision | MEDIUM | model.name not model.fullPath as Set key |
| GLB inspector Symbol access | MEDIUM | Fragile against model-viewer upgrades |
| No WebGL context limit | LOW | Browser silently drops oldest contexts |
