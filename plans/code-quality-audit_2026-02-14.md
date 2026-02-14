# Code Quality & Performance Audit Report
**Project:** Dave - Dror's Assets Viewing Experience
**Date:** 2026-02-14
**Scope:** JavaScript code quality and runtime performance across core modules, Dave personality system, and games

---

## Executive Summary

The codebase is well-organized with clear module boundaries, good use of ES6 patterns, and thoughtful error recovery (e.g., `_safeRun` in DaveAlive). However, the Dave personality system (dave_mode.js, dave_alive.js, dave_commands.js, games) has significant memory leak vectors due to DOM elements being created in large quantities with only timeout-based cleanup, event listeners added to `document` without centralized removal, and `setInterval` timers that can orphan if async flows throw mid-execution. The asset loading path has one critical leaked event listener pattern. Overall the core asset viewer is solid; the Dave layer needs tightening.

---

## 1. DOM Manipulation Patterns

### 1.1 [Medium] Repeated `document.getElementById` in UI setters

**Files:** `src/core/ui.js:602`, `ui.js:642`, `ui.js:691`, `ui.js:728-730`, `ui.js:750`, `ui.js:804`

Every call to `setItemsPerPage`, `setLoadSubfolders`, `setCurrentSort`, `updatePagination`, `exitFullscreen`, and `updateSelectionCount` performs fresh `document.getElementById` lookups. These are called on every page navigation, sort, and filter change. While `getElementById` is O(1) in browsers, the six repeated lookups per setter add up in rapid-fire scenarios (slider drag, fast pagination).

**Recommendation:** These were intentionally changed from cached refs (comment says "to avoid targeting the wrong button"), so the tradeoff is acceptable. However, consider caching at the *function scope* level with a module-level `getElement(id)` helper that caches per-frame using a WeakRef or a simple Map cleared on `renderPage`.

### 1.2 [Low] `querySelectorAll` in `closeAllDropdowns`

**File:** `src/core/ui.js:40-43`

```js
function closeAllDropdowns() {
  document.querySelectorAll('.dropdown').forEach(dropdown => {
    dropdown.classList.remove('active');
  });
}
```

Called on every dropdown interaction, sort click, filter click, and items-per-page click. The dropdown count is small and fixed, so this is fine, but could be cached once at init time.

### 1.3 [Medium] `querySelectorAll` in cleanup sweeps

**Files:** `src/core/dave_alive.js:638`, `dave_alive.js:1595`, `dave_alive.js:1733`, `dave_alive.js:1902`, `dave_alive.js:2109`, `src/core/dave_mode.js:1907`

Multiple places use broad `querySelectorAll` with long selector lists to do cleanup sweeps:
```js
document.querySelectorAll('.dave-heart-particle, .dave-sub-drip, .dave-sub-drip-short, .dave-spiral-particle, .dave-puppet-screen').forEach(el => el.remove());
```

These are safety nets for when individual element tracking fails. They traverse the entire DOM. In `_resetAllFlags` (line 638) this is acceptable as error recovery. But in normal flows (end of heart trail, end of spiral), the code already tracks elements in arrays -- the querySelectorAll sweep should not be necessary if tracking is correct.

**Recommendation:** Keep the sweeps in `_resetAllFlags` and `destroy` only. Remove redundant sweeps from normal flow paths (lines 1595, 1733) since those arrays already contain all the elements.

---

## 2. Memory Leak Potential

### 2.1 [Critical] Video scrub bar adds document-level listeners without removal

**File:** `src/core/asset_loading.js:570-577`

```js
document.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  updateVideoTime(e);
});

document.addEventListener('mouseup', () => {
  isDragging = false;
});
```

These listeners are added **once per video tile load** (inside `loadTileContent`). They are anonymous functions, so they cannot be removed. When a video tile scrolls out of view, the IntersectionObserver cleans up the DOM elements but these listeners persist on `document` forever. Loading 20 video tiles creates 40 permanent document listeners. On each page re-render, another set accumulates.

**Recommendation:** Store named references and remove them in the tile cleanup path, or use AbortController per tile.

### 2.2 [High] `_checkActivityPatterns` interval is never cleared

**File:** `src/core/dave_alive.js:726`

```js
setInterval(() => this._checkActivityPatterns(), 5000);
```

This runs every 5 seconds forever. It is set up in `_installActivityHooks` which is called from `init()`. The `destroy()` method on line 2087 removes event hooks but does **not** clear this interval because its ID is never stored.

**Recommendation:** Store the interval ID (e.g., `this._activityCheckInterval = setInterval(...)`) and clear it in `destroy()`.

### 2.3 [High] `_setupAutoBehaviors` interval in DaveCommands is never cleared

**File:** `src/games/dave_commands.js:254`

```js
setInterval(() => {
  if (!DaveMode._enabled) return;
  if (DaveMode._presenceEl?.classList.contains('dave-sleeping')) {
    this._tryAutoBehavior('idle');
  }
}, 30000);
```

This 30-second polling interval runs forever once `init()` is called. DaveCommands is a singleton and has no `destroy()` method, so this interval can never be cleared.

Additionally, the event listeners added by `_setupAutoBehaviors` (lines 221-258) for `dave:sort`, `dave:themeChange`, `dave:filesLoaded`, `dave:error`, `dave:selectionChange` are never removed.

**Recommendation:** Add a `destroy()` method to DaveCommands, or at minimum guard the interval with a stored ID.

### 2.4 [High] Drip intervals in heart/spiral trails can leak on abort

**File:** `src/core/dave_alive.js:1551-1561` (heart), `1689-1698` (spiral)

Each heart/spiral particle spawns a `setInterval` that creates DOM elements every 280-350ms:
```js
const dripId = setInterval(() => {
  const drip = document.createElement('span');
  // ...
  document.body.appendChild(drip);
  setTimeout(() => drip.remove(), 1200);
}, 280);
```

These intervals are stored in `dripIntervals` and cleared at lines 1574/1712. However, if the async behavior throws between interval creation and the cleanup line (or if `_safeRun` catches and calls `_resetAllFlags`), the `dripIntervals` local array is lost. The `_resetAllFlags` method does a querySelectorAll sweep which catches orphaned DOM elements, but the intervals themselves keep running, creating and immediately orphaning new DOM elements.

**Recommendation:** Store drip interval IDs on the instance (`this._activeDripIntervals`) so `_resetAllFlags` can clear them.

### 2.5 [High] Constellation particle intervals can leak for 4+ seconds

**File:** `src/core/dave_alive.js:1812-1826`, cleanup at `1897`

Particle intervals for constellation stars are stored in `particleIntervals`, but cleanup happens in a `setTimeout(() => {...}, 4000)`. If Dave Mode is disabled or `destroy()` is called during those 4 seconds, the intervals keep running. The `destroy` method does a querySelectorAll sweep for `.dave-constellation-particle`, but the intervals themselves are not cleared.

**Recommendation:** Track these intervals on the instance and clear in `destroy()`.

### 2.6 [Medium] `_shownMessages` Set grows unbounded

**File:** `src/core/dave_mode.js:424`, used at line 2151

```js
this._shownMessages = new Set();
```

Every message text shown to the user is added to this Set and never pruned. Over a long session with diverse interactions, this accumulates hundreds of strings. Not a severe leak, but unbounded.

**Recommendation:** Cap at ~100 entries or use a fixed-size ring buffer.

### 2.7 [Medium] Sleep Z-character intervals in `triggerSleepOnElement`

**File:** `src/core/dave_alive.js:1400`

The `zzzInterval` is a local variable. If the auto-wake timer at line 1463 fires, it calls `wake()` which clears it. But if `_resetAllFlags` is called externally (from `_safeRun` error recovery), the `zzzInterval` local is unreachable and keeps running.

Similarly in `dave_commands.js:874`, the sleep Z interval is local and could leak if `destroy()` interrupts the sleep flow.

### 2.8 [Medium] Keydown listener in game overlay is never removed

**File:** `src/games/dave_commands.js:992-997`

```js
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && this._currentGame) {
    e.stopPropagation();
    this._closeGame();
  }
});
```

This is added in `_ensureOverlay()` and persists forever. It has a guard (`this._currentGame`) so it is harmless when no game is active, but it still fires on every keydown globally.

### 2.9 [Low] `mousedown` listener in command dropdown

**File:** `src/games/dave_commands.js:341-347`

Global `mousedown` listener added once in `_setupDropdown`. It has proper guards but runs on every mousedown event globally.

---

## 3. Animation Performance

### 3.1 [High] Firework sparks use per-element `style.left`/`style.top` on every rAF frame

**File:** `src/core/dave_mode.js:1961-2017`

Each of the 35-50 firework sparks has its own `requestAnimationFrame` callback that writes `style.left`, `style.top`, `style.color`, `style.textShadow`, `style.fontSize`, and `style.opacity` on every frame. That is up to 300 individual style writes per frame across all sparks. These are non-compositable properties and trigger layout recalculation.

**Recommendation:** Use `transform: translate(x, y)` instead of `left/top`. Move color/opacity changes to CSS custom properties or opacity-only transitions. Better yet, consolidate all sparks into a single canvas or use a single rAF loop that batch-updates all elements.

### 3.2 [High] Tear system: per-element rAF + per-element style writes

**File:** `src/core/dave_mode.js:1811-1886`

Each tear lead char and each trail char gets its own independent `requestAnimationFrame` callback writing `style.left`, `style.top`, `style.opacity`. Burst tears can spawn 8-13 lead chars simultaneously, each shedding trail chars, creating 20-40 concurrent rAF loops. All writes are `left/top` (layout-triggering).

The `_tearDropIntervals` array stores both `setInterval` IDs and `requestAnimationFrame` IDs interchangeably, then calls `clearTimeout`, `clearInterval`, and `cancelAnimationFrame` on all of them (line 1898-1901). This works but is wasteful and confusing.

**Recommendation:** Use `transform: translate()` instead of `left/top`. Use a single rAF loop for all tear particles. Separate rAF IDs from interval IDs.

### 3.3 [Medium] Drag trail: `getBoundingClientRect` on every interval tick

**File:** `src/core/dave_mode.js:2077`

```js
const rect = this._presenceEl.getBoundingClientRect();
```

Called every 50ms during drag. `getBoundingClientRect` forces layout flush. Since the drag handler already computes the position via `_applyPosition`, the coordinates should be passed through rather than re-read from the DOM.

### 3.4 [Medium] Layout thrashing in `_seekAttention`

**File:** `src/core/dave_mode.js:978-979`

```js
this._presenceEl.classList.remove('dave-ambient', ...anims);
void this._presenceEl.offsetWidth;  // force reflow
this._presenceEl.classList.add(pick);
```

This is an intentional reflow trigger to restart a CSS animation. Necessary pattern but should be documented as such (the `void offsetWidth` pattern). Used in 6 places across the codebase.

### 3.5 [Medium] Scroll parallax uses `querySelector` on every wheel event

**File:** `src/core/dave_alive.js:877`

```js
const eye = DaveMode._presenceEl.querySelector('.dave-presence-eye');
```

Called on every `wheel` event (even though `{ passive: true }`). The eye element is a direct child that never changes -- it should be cached.

### 3.6 [Low] Canvas games redraw grid lines every frame

**Files:** `src/games/dave_snake.js:315-322`, `dave_breakout.js:436`

Both Snake and Breakout redraw a full grid of lines on every frame. Since the grid is static, it could be drawn once onto an offscreen canvas and composited.

---

## 4. Code Organization Issues

### 4.1 [High] `dave_mode.js` is a 2275-line god class

**File:** `src/core/dave_mode.js` (2275 lines)

The `_DaveMode` class handles: DOM building, drag system, blink system, cursor following, attention seeking, terminal coordination, mood system, speech bubble (with typewriter engine), bubble positioning, emotion system, tear physics (with burst/heavy/single variants), firework system (with trail/crackle subsystems), drag trail system, message selection, action tracking, idle detection, and 10+ event handlers. This is a single class with 60+ methods.

**Recommendation:** Extract into focused modules:
- `dave_eye.js` -- blink, cursor follow, iris transformations
- `dave_bubble.js` -- speech bubble, typewriter, positioning
- `dave_tears.js` -- tear/firework particle systems
- `dave_drag.js` -- drag handling, trail
- `dave_mode.js` -- orchestrator, event hooks, mood/emotion state

### 4.2 [High] `asset_loading.js` is a 1700+ line file mixing concerns

**File:** `src/core/asset_loading.js`

Combines: tile content loading (all 7+ file types), fullscreen viewer (all 7+ file types with zoom/pan/controls), file scanning, sorting, filtering, folder picker, cloud URL handling, thumbnail generation, and model-viewer script loading. The `showFullscreen` function alone is ~350 lines.

**Recommendation:** Extract per-type fullscreen handlers into the existing handler pattern (`src/handlers/`), which is currently disabled (`useNewHandler = false` at line 483).

### 4.3 [Medium] `ui.js` has 1453 lines mixing UI init, font modal logic, welcome messages

**File:** `src/core/ui.js`

The `initializeElements` function (lines 67-546) is a single giant function that initializes all UI. The font custom text modal logic (lines 950-1356) is a completely independent feature mixed inline.

### 4.4 [Medium] Duplicated weighted message picking

**Files:** `src/core/dave_mode.js:2144-2156` (`_pickMessage`), `src/core/dave_alive.js:2071-2079` (`_pickFromPool`)

Both implement nearly identical weighted random selection from message pools with `r` rarity fields. The only difference is `_pickMessage` also does deduplication via `_shownMessages`.

**Recommendation:** Extract a shared utility function.

### 4.5 [Medium] Duplicated movement/position patterns in dave_alive.js

**File:** `src/core/dave_alive.js`

The pattern of "save origin, enter moving state, fly to target, do something, fly back, restore ambient" appears in: `triggerInspection` (1098-1161), `triggerPatrol` (1237-1351), `triggerSleepOnElement` (1358-1466), `triggerHeartTrail` (1473-1597), `triggerSpiralFireworks` (1604-1736), `triggerConstellation` (1743-1903). Each reimplements the setup/teardown boilerplate.

**Recommendation:** Extract a `_withMovement(async (engine) => {...})` wrapper.

### 4.6 [Low] Some functions exceed 100 lines

Notable offenders:
- `showFullscreen` in `asset_loading.js`: ~350 lines
- `initializeElements` in `ui.js`: ~480 lines
- `triggerConstellation` in `dave_alive.js`: ~160 lines
- `_triggerTear` in `dave_mode.js`: ~115 lines
- `_cmdRave` in `dave_commands.js`: ~85 lines (close)

---

## 5. Global State / Coupling

### 5.1 [High] Extensive `window.*` globals

**Files:** Various (see grep results)

The codebase exposes the following on `window`:
- `window.uiElements` -- all cached UI element references
- `window.APP_DEBUG` -- debug configuration
- `window.handleCloudUrl` -- cloud URL handler
- `window.assetLoading` -- asset loading API surface
- `window.shortcutManager` / `window.gridNavigator` -- input managers
- `window.DaveMode` / `window.DAVE_CONFIG` -- Dave debug access
- `window._daveAliveLoaded` -- flag for feature detection
- `window.activeFilters` -- filter state
- `window.memoryManager` -- memory manager

That is 10+ globals. Most are for debugging, but `window.uiElements`, `window.activeFilters`, and `window.handleCloudUrl` are used in production paths.

**Recommendation:** `window.uiElements` is the most problematic as it is used by `initializeUI` for deduplication (line 53). Use a module-level variable instead. Debug-only globals should be gated behind `APP_DEBUG.enabled`.

### 5.2 [High] Dave systems deeply coupled via direct property access

**Files:** `dave_alive.js`, `dave_commands.js`, `dave_music.js` all reach into `DaveMode._presenceEl`, `DaveMode._irisEl`, `DaveMode._isDragging`, `DaveMode._bubbleEl`, `DaveMode._twGen`, `DaveMode._bubbleTimer`, etc.

These are all prefixed with `_` (indicating private), yet accessed externally. This creates tight coupling where changes to DaveMode internals break three other files.

**Recommendation:** Expose a public API on DaveMode for what external consumers need:
- `DaveMode.getPresenceElement()`
- `DaveMode.getIrisElement()`
- `DaveMode.isDragging`
- `DaveMode.showBubble(text, opts)` (already exists as `_showBubble`)

### 5.3 [Medium] Circular dependency risk

**Files:** `dave_mode.js` imports from `dav9000_terminal.js`. `dave_alive.js` imports from `dave_mode.js`. `dave_commands.js` imports from `dave_mode.js` + `dave_alive.js`. `dave_music.js` imports from `dave_mode.js`.

All Dave personality modules import from `dave_mode.js`. Since `dave_mode.js` is the root, and nothing in `dave_mode.js` imports from the others (it uses `window._daveAliveLoaded` for feature detection instead), there is no actual circular dependency. But the `window._daveAliveLoaded` flag is a code smell indicating the modules want to communicate but avoid import cycles.

### 5.4 [Medium] Module-level DOM queries in asset_loading.js

**File:** `src/core/asset_loading.js:53-61`

```js
const folderPickerButton = document.getElementById("folderPicker");
const viewerContainer = document.getElementById("viewerContainer");
const filterOptions = document.querySelectorAll('.filter-option');
// ...
```

These execute at module parse time. If the module is imported before the DOM is ready, they return null. Currently safe because `main.js` awaits `initializeUI()` which waits for DOMContentLoaded, but fragile if import order changes.

---

## 6. Performance Bottlenecks

### 6.1 [Medium] `_checkActivityPatterns` filters array 4 times

**File:** `src/core/dave_alive.js:743-745`

```js
const recent30s = this._activityLog.filter(a => now - a.time < 30000);
const recent20s = this._activityLog.filter(a => now - a.time < 20000);
const recent60s = this._activityLog.filter(a => now - a.time < 60000);
```

Three full array scans every 5 seconds. Then each result is filtered again by type (lines 748-769). Could be a single pass with bucketing.

### 6.2 [Medium] `_pickMessage` weighted expansion

**File:** `src/core/dave_mode.js:2146-2153`

```js
const weighted = [];
for (const msg of pool) {
  const w = msg.r === 2 ? 1 : msg.r === 1 ? 2 : 3;
  for (let i = 0; i < w; i++) weighted.push(msg);
}
```

Creates a new expanded array on every message pick. For a pool of 7 messages, this creates ~14 entries. Called frequently during user interactions. Use weighted random selection without array expansion:
```js
const totalWeight = pool.reduce((s, m) => s + (m.r === 2 ? 1 : m.r === 1 ? 2 : 3), 0);
let r = Math.random() * totalWeight;
```

### 6.3 [Low] `_spawnFood` in Snake has theoretical infinite loop

**File:** `src/games/dave_snake.js:422-431`

```js
do {
  pos = { x: Math.floor(Math.random() * this._cols), y: Math.floor(Math.random() * this._rows) };
} while (this._snake.some(s => s.x === pos.x && s.y === pos.y));
```

If the snake fills most of the grid (20x20 = 400 cells), random search becomes very slow. Theoretical worst case is infinite for a full board, though practically the speed increase prevents the snake from growing that large.

### 6.4 [Low] Linear search in `navigateFullscreen`

**File:** `src/core/ui.js:934`

```js
const currentIndex = filteredModelFiles.findIndex(file => file.name === currentFullscreenViewer?.fileName);
```

Linear scan on every left/right arrow in fullscreen. For typical file counts (< 1000) this is negligible.

### 6.5 [Low] Linear search in `downloadSelected`

**File:** `src/core/ui.js:849`

```js
const model = modelFiles.find(m => m.name === fileName);
```

Called in a loop over selected files. O(n*m) where n = selected, m = total files. For typical use (< 100 selected) this is fine.

### 6.6 [Low] Constellation uses `.sort(() => Math.random() - 0.5)` for shuffling

**File:** `src/core/dave_alive.js:1760`

This is a biased shuffle. Not a correctness issue for random constellation tile selection, but worth noting as a pattern to avoid in more sensitive contexts.

---

## 7. Missing Error Handling

### 7.1 [Medium] No try/catch in `loadTileContent` for cloud file URL fetching

**File:** `src/core/asset_loading.js:478`

```js
fileUrl = await CloudStorage.getFileUrl(model);
```

If the cloud provider throws (expired token, network error), the outer try/catch at line 729 catches it, but by then the `fileUrl` might be undefined and used in a `model-viewer` src attribute, causing a silent failure.

### 7.2 [Medium] No error boundary for DaveAlive behaviors beyond `_safeRun`

**File:** `src/core/dave_alive.js:647-652`

`_safeRun` catches errors from behavior functions and calls `_resetAllFlags`. However, if `_resetAllFlags` itself throws (e.g., `_exitIrisEffect` accesses a removed element), the error is logged but the instance may be left in a broken state.

### 7.3 [Low] `handleFolderSelection` uses `getParent()` which may not exist

**File:** `src/core/asset_loading.js:1261`

```js
current = await current.getParent();
```

`getParent()` is not a standard File System Access API method. This is wrapped in a try/catch, so it fails silently, which is correct.

---

## 8. Positive Patterns Worth Noting

1. **`_safeRun` pattern** (dave_alive.js:647) -- Good defensive programming for optional personality behaviors.
2. **`WeakMap` for tile states** (asset_loading.js:76-78) -- Properly avoids memory leaks for tile metadata.
3. **IntersectionObserver for lazy loading** (asset_loading.js:80) -- Efficient tile content loading with cleanup on scroll-out.
4. **Debounced search** (ui.js:134) -- Proper input debouncing.
5. **RAF-throttled size slider** (ui.js:266-288) -- Good pattern for avoiding layout thrashing during slider drag.
6. **Singleton pattern** for DaveMode, DaveAlive, DaveCommands, DaveMusicMode -- Consistent and prevents duplicate initialization.
7. **Event hook cleanup in DaveMode** (`_removeHooks` properly removes all listeners).
8. **DaveTrailEngine abort system** (dave_alive.js:493-511) -- Clean abort-on-interaction pattern.

---

## Summary by Severity

| Severity | Count | Key Items |
|----------|-------|-----------|
| Critical | 1 | Leaked video scrub listeners per tile |
| High | 7 | Unclearable intervals, firework/tear layout thrashing, god class, deep coupling |
| Medium | 14 | DOM sweep redundancy, unbounded Set, reflow reads in hot paths, missing error handling |
| Low | 8 | Biased shuffle, infinite loop edge case, linear searches, cached references |

---

## Recommended Priority Actions

1. **Fix video scrub listener leak** (Critical) -- Immediate, prevents listener accumulation on every page render with video tiles.
2. **Store and clear all `setInterval` IDs** (High) -- Add missing interval storage in `dave_alive.js:726` and `dave_commands.js:254`.
3. **Switch firework/tear particles to `transform`** (High) -- Replace `style.left/top` with `translate()` for composited animations.
4. **Extract DaveMode subsystems** (High) -- Reduce the 2275-line class into focused modules.
5. **Expose public API on DaveMode** (High) -- Stop external files from accessing `_` prefixed members.
