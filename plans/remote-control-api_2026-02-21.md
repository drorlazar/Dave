# Dave Remote Control API

## Context

Dave is a powerful asset viewer but currently has no way for external tools to programmatically control it. AI coding agents (like Claude Code) create images, 3D models, and other files but have no way to show them to the user through Dave. This feature adds a lightweight remote control API so Claude Code can: open files in Dave, trigger annotation mode for user feedback, navigate between files, and read state back (what's loaded, what annotations exist).

## Architecture

Two communication layers:
1. **URL query parameters** - one-shot: `open "http://localhost:7777?file=/path/to/img.png&action=annotate"`
2. **REST API + SSE** - interactive: `curl POST /api/control/show -d '{"files":[...]}'`

Files served from disk via `GET /api/file?path=/absolute/path`.

## Files to Create

### 1. `scripts/routes/control.cjs` (~130 lines)

Express router with:

**SSE channel** `GET /api/control/events`
- Maintains set of connected browser clients
- Buffers commands if no client connected yet
- Auto-reconnect handled by EventSource

**Command endpoints:**
- `POST /api/control/show` - `{ files: ["/path/a.png", ...], fullscreen: 0, clear: true }`
- `POST /api/control/annotate` - `{ fileIndex: 0, tool: "arrow", color: "#ff3333" }`
- `POST /api/control/navigate` - `{ action: "next|prev|close|fullscreen:N|page:N|zoom:fit|zoom:100|zoom:N" }`

**State request/response:**
- `GET /api/control/state` - broadcasts `report_state` via SSE, waits for browser POST back
- `POST /api/control/state-report` - browser posts state JSON here, resolves pending GET

**File serving:**
- `GET /api/file?path=/absolute/path` - serves file from disk with correct MIME type
- Validates: `path.resolve()`, rejects null bytes, blocks `/etc/`, `/proc/`, `/sys/`
- 500MB size guard, `stat.isFile()` check

### 2. `src/core/remote_control.js` (~200 lines)

ES6 module, singleton `RemoteControl` class:

**SSE connection** - connects to `/api/control/events`, auto-reconnects

**Command dispatch** - routes SSE messages by `type`:

- `show` handler:
  - Builds file entries with `remoteUrl: /api/file?path=...` (reusing existing `cloudFilesLoaded` pattern at `asset_loading.js:1374`)
  - Fires `window.dispatchEvent(new CustomEvent('cloudFilesLoaded', { detail: { files } }))`
  - If `fullscreen` index specified, calls `AssetLoading.showFullscreen(target)` after render

- `annotate` handler:
  - Imports `imageViewer` from `../viewers/image_viewer.js`
  - Ensures file is open fullscreen, calls `imageViewer._activateAnnotation()`
  - Sets tool/color on `imageViewer._annotationModule` if specified

- `navigate` handler:
  - Maps actions to existing Dave functions (keyboard events, `showFullscreen`, `imageViewer._zoomToFit`)

- `report_state` handler:
  - Collects state from `AssetLoading`, `UI`, `imageViewer`
  - POSTs JSON back to `/api/control/state-report`

**URL parameter handler** (called once on init):
  - Reads `?file=`, `?files=`, `?action=`, `?fullscreen=`, `?tool=`, `?color=`
  - Triggers show/annotate via same handlers
  - Cleans URL with `history.replaceState`

## Files to Modify

### 3. `scripts/server.cjs` (1 line)

Add at line 29 (after config route):
```javascript
app.use('/api/control', require('./routes/control.cjs'));
```

### 4. `src/core/asset_loading.js` (6 lines, 2 locations)

Add `remoteUrl` as a third URL source in both `loadTileContent` (line 506) and `showFullscreen` (line 922):

```javascript
// Before: only model.file and cloud sources
if (model.remoteUrl) {
  fileUrl = model.remoteUrl;
} else if (model.file) {
```

This lets files loaded via the remote control API get their content from `/api/file?path=...` without needing blob URLs or cloud storage.

### 5. `src/core/main.js` (3 lines)

At end of `initializeUI().then()` block, before keyboard shortcuts:
```javascript
import { remoteControl } from './remote_control.js';
try { remoteControl.init(); } catch (e) { console.error('[Main] RemoteControl init error:', e); }
```

## Existing Code to Reuse

| What | Where | How |
|------|-------|-----|
| `cloudFilesLoaded` event | `asset_loading.js:1374` | Fire this to inject files into Dave's grid |
| `showFullscreen(model)` | `asset_loading.js:860` | Open any file fullscreen |
| `imageViewer.open()` | `image_viewer.js:71` | Already called by showFullscreen for images |
| `imageViewer._activateAnnotation()` | `image_viewer.js:820` | Lazy-loads annotation module and activates |
| `imageViewer._annotationModule` | `image_viewer.js:31` | Direct access to tool/color/strokes |
| `filteredModelFiles` | `asset_loading.js` | Current file list for state reporting |
| `UI.getCurrentPage()` etc. | `ui.js` | State getters for reporting |
| Express route pattern | `scripts/routes/config.cjs` | Follow same `express.Router()` pattern |

## Usage Examples

```bash
# Simple: open a file in browser
open "http://localhost:7777?file=/Users/dror/project/screenshot.png"

# Open with annotation mode
open "http://localhost:7777?file=/path/img.png&action=annotate&tool=arrow"

# Rich: load files via API
curl -X POST http://localhost:7777/api/control/show \
  -H 'Content-Type: application/json' \
  -d '{"files":["/path/a.png","/path/b.png"], "fullscreen": 0}'

# Trigger annotation mode
curl -X POST http://localhost:7777/api/control/annotate \
  -H 'Content-Type: application/json' \
  -d '{"tool":"arrow","color":"#ff3333"}'

# Read state (what annotations did user draw?)
curl http://localhost:7777/api/control/state

# Navigate
curl -X POST http://localhost:7777/api/control/navigate \
  -H 'Content-Type: application/json' \
  -d '{"action":"next"}'
```

## Implementation Order

1. `scripts/routes/control.cjs` - server routes (testable with curl immediately)
2. `src/core/remote_control.js` - client bridge
3. `scripts/server.cjs` - mount the route (1 line)
4. `src/core/asset_loading.js` - add `remoteUrl` support (6 lines)
5. `src/core/main.js` - import and init remote control (3 lines)

## Verification

1. Start server: `node scripts/server.cjs`
2. Open Dave in browser: `http://localhost:7777`
3. Test URL params: `http://localhost:7777?file=/path/to/any/image.png`
4. Test REST API with curl:
   - `curl -X POST http://localhost:7777/api/control/show -H 'Content-Type: application/json' -d '{"files":["/path/to/image.png"], "fullscreen": 0}'`
   - `curl -X POST http://localhost:7777/api/control/annotate -H 'Content-Type: application/json' -d '{"tool":"arrow"}'`
   - `curl http://localhost:7777/api/control/state`
5. Verify SSE reconnection: refresh browser, commands still arrive
6. Verify file serving: `curl http://localhost:7777/api/file?path=/path/to/any/file.png -o test.png`
