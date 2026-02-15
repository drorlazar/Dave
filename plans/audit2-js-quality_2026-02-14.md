# DAVE Audit #2 -- JavaScript Quality & Memory Health

**Date:** February 14, 2026
**Scope:** 7 core files (12,002 lines total)
**Focus:** Event listener hygiene, memory leaks, error handling, code organization, performance, dead code, import health
**Rating Scale:** CRITICAL / HIGH / MEDIUM / LOW

---

## Table of Contents

1. [Event Listener Hygiene](#1-event-listener-hygiene)
2. [Memory Leak Patterns](#2-memory-leak-patterns)
3. [Error Handling Gaps](#3-error-handling-gaps)
4. [Code Organization](#4-code-organization)
5. [Performance Issues](#5-performance-issues)
6. [Dead Code](#6-dead-code)
7. [Import Chain Health](#7-import-chain-health)
8. [Summary Scoreboard](#8-summary-scoreboard)

---

## 1. Event Listener Hygiene

### Per-File addEventListener / removeEventListener Ratios

| File | addEventListener | removeEventListener | Ratio |
|------|:---:|:---:|:---:|
| ui.js | 39 | 0 | **39:0** |
| asset_loading.js | 28 | 5 | 5.6:1 |
| dave_mode.js | 12 | 6 | 2:1 |
| dave_alive.js | 11 | 5 | 2.2:1 |
| dav9000_terminal.js | (not in scope -- good cleanup patterns noted) | | |

### Findings

#### F1.1 -- ui.js: Zero removeEventListener calls [HIGH]

`ui.js` registers **39 event listeners** and removes **zero**. Every listener persists for the lifetime of the page. While many are on persistent DOM elements (buttons, dropdowns), the following are noteworthy:

- **`document.addEventListener("mouseup", ...)`** at `ui.js:297` -- global, never removed.
- **`document.addEventListener("touchend", ...)`** at `ui.js:310` -- global, never removed.
- **`document.addEventListener("keydown", ...)`** at `ui.js:435` -- global keyboard shortcut handler, never removed.
- **`document.addEventListener("keydown", ...)`** at `ui.js:1344` -- **second** global keydown handler (for modal Escape), stacks with the one at line 435. Never removed.

Both global keydown listeners fire on every keypress for the life of the page. If `initializeUI()` were ever called twice (it has a guard, but still), they would double-register.

#### F1.2 -- dave_alive.js: 3 document listeners never removed [HIGH]

In `dave_alive.js init()` (lines 586-606), three `document.addEventListener` calls are made directly without tracking:

```
586:  document.addEventListener('dave:idle', () => this._onIdleCycle());
595:  document.addEventListener('dave:fullscreen', () => { ... });
598:  document.addEventListener('dave:fullscreenExit', () => { ... });
```

These are **anonymous arrow functions** -- they cannot be removed even if `destroy()` tried. The `destroy()` method at line 2088 only removes listeners tracked in `this._hooks` (lines 2107-2109) and the scroll handler (line 2092). These three are orphaned.

If Dave Mode is toggled off and on repeatedly, these listeners **accumulate**.

#### F1.3 -- dave_alive.js: Sleep wake handlers partially orphaned [MEDIUM]

`triggerSleepOnElement` at lines 1459-1461 registers three `{ once: true }` wake handlers:

```
1459:  document.addEventListener('click', wake, { once: true });
1460:  document.addEventListener('keydown', wake, { once: true });
1461:  DaveMode._presenceEl?.addEventListener('mousedown', wake, { once: true });
```

When any one fires, the other two remain registered until they individually fire. The `wake` function guards against double-execution (`if (!this._sleepOnElementActive) return`), but the listeners themselves linger. If `destroy()` is called during sleep, these are not cleaned up.

#### F1.4 -- asset_loading.js: Video scrub listener never removed [MEDIUM]

`scrubBarContainer.addEventListener('mousemove', updateVideoTime)` at `asset_loading.js:594` is added when a video tile is created. There is no corresponding removal when the tile is scrolled out of view or replaced. The `updateVideoTime` closure captures a reference to the video element.

#### F1.5 -- dave_mode.js: Drag listeners properly paired [OK]

Document-level `mousemove`/`mouseup`/`touchmove`/`touchend` listeners added in `_onDragStart` (lines 751-754) are properly removed in `_onDragEnd`. This is correct.

---

## 2. Memory Leak Patterns

#### F2.1 -- dave_mode.js: Fire-and-forget requestAnimationFrame loops [CRITICAL]

Firework spark animation (lines 2012-2014) and crackle micro-spark animation (lines 2063-2065) both use recursive `requestAnimationFrame(tick)` without storing the rAF ID for cancellation:

```javascript
// Line 2012 (firework sparks)
requestAnimationFrame(tick);   // inside tick -- no ID stored

// Line 2063 (crackle sparks)
requestAnimationFrame(tick);   // inside tick -- no ID stored
```

These animations run until `progress >= 1` or `elapsed >= life`, but there is **no way to cancel them externally**. If Dave Mode is toggled off while fireworks are active, the rAF loops continue ticking, reading `style.left`/`style.top` from orphaned DOM elements.

The `_stopTear()` method (line 1896) demonstrates the intent to cancel rAF IDs, but firework/crackle IDs are never collected.

#### F2.2 -- dave_mode.js: Drag trail rAF loops also fire-and-forget [HIGH]

`_spawnDragTrailChar` (lines 2130-2137) spawns trail characters with recursive rAF loops:

```javascript
2135:  requestAnimationFrame(tick);   // inside tick -- no ID stored
2137:  requestAnimationFrame(tick);   // initial kick -- no ID stored
```

These are created at 50ms intervals during drag (line 2073). If `_stopDragTrail()` is called, it clears the interval that spawns new chars, but any already-spawned rAF loops keep running.

#### F2.3 -- dave_mode.js: Tear cleanup mixes timer ID types [MEDIUM]

`_stopTear()` (lines 1897-1901) calls all three cleanup functions on every stored ID:

```javascript
for (const id of this._tearDropIntervals) {
  clearTimeout(id);
  clearInterval(id);
  cancelAnimationFrame(id);
}
```

The array `_tearDropIntervals` stores rAF IDs (lines 1882, 1884), but the triple-clear pattern is a code smell indicating the author was unsure which type each ID was. While not technically a leak (all three are safe to call with any ID), it signals architectural confusion. The name `_tearDropIntervals` is also misleading since it stores rAF IDs, not interval IDs.

#### F2.4 -- dave_mode.js: Firework trails appended to body with setTimeout cleanup [MEDIUM]

`_spawnFireworkTrail` (line 2027-2028) appends a `<span>` to `document.body` and removes it via `setTimeout(() => ghost.remove(), 300)`. If the element is already removed (e.g., by `destroy()` DOM cleanup), the `remove()` call is a no-op, which is fine. But if many fireworks fire simultaneously, 200+ elements can accumulate on `document.body` with no tracking or ability to bulk-remove.

#### F2.5 -- tree_folder_view.js: hasSubdirCache grows unboundedly [MEDIUM]

`hasSubdirCache` (line 22) is a `Map` that caches subdirectory existence checks by path key. It is never cleared or evicted. For users who browse many directories in a single session, this map grows without bound.

```javascript
22: const hasSubdirCache = new Map();
```

No `hasSubdirCache.clear()` call exists anywhere in the file.

#### F2.6 -- dave_mode.js: _lastFireworksTime not initialized in constructor [LOW]

`_lastFireworksTime` is used at line 1113 with a fallback `(this._lastFireworksTime || 0)`, but it is never initialized in the constructor or any `init()` method. It is only set when fireworks actually fire (line 1115). The `|| 0` fallback prevents a bug, but the field should be declared for clarity and to avoid hidden class transitions in V8.

---

## 3. Error Handling Gaps

#### F3.1 -- asset_loading.js: Module-level DOM queries run at import time [HIGH]

Lines 53-61 of `asset_loading.js` execute `document.getElementById` and `document.querySelectorAll` at **module evaluation time**:

```javascript
53: const folderPickerButton = document.getElementById("folderPicker");
55: const viewerContainer = document.getElementById("viewerContainer");
56: const filterOptions = document.querySelectorAll('.filter-option');
57: const itemsOptions = document.querySelectorAll('.items-option');
59: const itemsBtn = document.getElementById('itemsPerPageBtn');
60: const sortOptions = document.querySelectorAll('.sort-option');
61: const sortDirectionBtn = document.querySelector('.sort-direction');
```

If the module is imported before the DOM is ready (e.g., without `defer`), these return `null` or empty NodeLists. The code proceeds to add event listeners to `itemsOptions` (line 1467) and `sortOptions` (line 1486) -- if these are empty, the `forEach` simply does nothing, silently failing.

The `index.html` uses `<script type="module">` which is deferred by default, so this works in practice. But it is fragile -- any change to loading strategy breaks it silently.

#### F3.2 -- dave_alive.js: Behavior trigger functions lack try-catch [MEDIUM]

The behavior trigger functions (`triggerPatrol`, `triggerConstellation`, `triggerHeartTrail`, `triggerSpiralFireworks`, `triggerSleepOnElement`) are complex multi-step async operations that manipulate DOM, CSS classes, and timers. None have try-catch wrappers. A single error in any step leaves Dave in an inconsistent state (e.g., `dave-alive-moving` class stuck, trail engine active).

The `_safeRun` wrapper exists in `dave_mode.js` but is not used for `dave_alive.js` behavior triggers.

#### F3.3 -- asset_loading.js: showFullscreen has no top-level error boundary [MEDIUM]

`showFullscreen` (lines 826-1240) is a 415-line async function that handles 6+ file types. Individual sections have try-catch (e.g., model loading), but there is no top-level catch that would clean up the fullscreen overlay if an unexpected error occurs mid-setup. A thrown error could leave the fullscreen overlay visible with partial content.

#### F3.4 -- ui.js: exitFullscreen does not null out currentFullscreenViewer [LOW]

`exitFullscreen` (ui.js lines ~748-798) hides the overlay and calls cleanup, but `currentFullscreenViewer` in `asset_loading.js` is not set to `null` after the call. Stale reference could cause issues if code checks `currentFullscreenViewer` for truthiness after exit.

---

## 4. Code Organization

### Functions Exceeding 100 Lines

| File | Function | Lines | Span |
|------|----------|:-----:|------|
| asset_loading.js | `showFullscreen` | ~415 | 826-1240 |
| asset_loading.js | `loadTileContent` | ~300 | 438-738 |
| model_inspector.js | `_openMaterialEditor` | ~250 | 487-740 |
| model_inspector.js | `_doExport` | ~180 | 1279-1456 |
| dave_alive.js | `triggerConstellation` | ~160 | 1744-1905 |
| dave_alive.js | `triggerSpiralFireworks` | ~130 | 1605-1737 |
| dave_alive.js | `triggerHeartTrail` | ~125 | 1474-1598 |
| dave_alive.js | `triggerPatrol` | ~115 | 1238-1352 |
| model_inspector.js | `_populateExport` | ~105 | 1003-1107 |

#### F4.1 -- asset_loading.js: Two monolithic functions [HIGH]

`loadTileContent` (300 lines) and `showFullscreen` (415 lines) are the two largest functions in the codebase. Both contain massive `if/else` chains branching on file type (`model3d`, `video`, `audio`, `image`, `font`, `document`). Each branch is essentially an independent rendering pipeline jammed into one function.

#### F4.2 -- dave_alive.js: Behavior functions are self-contained but bloated [MEDIUM]

The four behavior trigger functions (patrol, constellation, heartTrail, spiralFireworks) each exceed 100 lines. They follow the same structural pattern: guard -> setup -> animate -> cleanup. The animation loops within them (DOM creation, rAF ticks, setTimeout cascades) account for most of the bulk.

#### F4.3 -- model_inspector.js: Material editor is a standalone subsystem [MEDIUM]

`_openMaterialEditor` at 250 lines builds an entire form UI imperatively with `createElement` chains. This is effectively a component that should be extracted.

#### F4.4 -- Duplicate event listener wiring [MEDIUM]

`itemsOptions` and `sortOptions` receive click listeners in **two places**:

1. Inside `initializeUI()` via `ui.js` lines 370-398 (within the `option.addEventListener('click', ...)` blocks).
2. At module scope in `asset_loading.js` lines 1467-1497.

The `asset_loading.js` listeners handle pagination/rendering. The `ui.js` listeners handle active class toggling and state updates. Both fire on the same click. This split is confusing and makes the click flow hard to trace.

---

## 5. Performance Issues

#### F5.1 -- dave_mode.js: style.left / style.top in animation loops [HIGH]

26 instances of `style.left = ... + 'px'` and `style.top = ... + 'px'` in `dave_mode.js`, many inside `requestAnimationFrame` loops:

- **Firework sparks** (lines 1948-1949, 2058-2061): `style.left`/`style.top` updated every frame.
- **Crackle sparks** (lines 2038-2039, 2060-2061): Same pattern.
- **Tear physics** (lines 1865-1866): `style.left`/`style.top` per frame.
- **Drag trail chars** (lines 2098-2099, 2119-2120): Per-spawn (not per-frame, but high frequency).
- **Firework trail ghosts** (lines 2023-2024): Per-spawn.

Using `style.left`/`style.top` forces layout recalculation. These should use `transform: translate()` for GPU-composited positioning. At peak fireworks (200+ elements), this generates significant layout thrash.

The `_applyPosition` method for the main Dave element (line 833-834) also uses `style.left`/`style.top` during drag, which is called on every mousemove.

#### F5.2 -- dave_mode.js: Forced reflow via offsetWidth read [LOW]

Line 979: `void this._presenceEl.offsetWidth` forces a synchronous layout reflow to restart CSS animations. This is a known pattern for animation restart and is intentional, but it occurs during the attention-seeking animation cycle.

#### F5.3 -- dave_mode.js: parseFloat on style.left in animation loop [MEDIUM]

Crackle spark `tick` function (lines 2058-2059):

```javascript
const px = parseFloat(sp.style.left) + vx / 60;
const py = parseFloat(sp.style.top) + vy / 60;
```

Reading `style.left` and parsing it every frame instead of maintaining position in a local variable. This pattern appears in the firework crackle system and adds unnecessary string parsing overhead per frame per spark.

#### F5.4 -- dave_mode.js: getBoundingClientRect in setInterval [MEDIUM]

`_startDragTrail` (line 2075) calls `this._presenceEl.getBoundingClientRect()` every 50ms inside a `setInterval`. `getBoundingClientRect()` forces layout if dirty. During active drag (which moves elements via `style.left`/`style.top`), layout is almost always dirty.

---

## 6. Dead Code

#### F6.1 -- asset_loading.js: useNewHandler = false -- entire handler system disabled [HIGH]

Two instances of `const useNewHandler = false;` at lines 483 and 866 disable the new `AssetHandlerFactory` system. The `if (useNewHandler ...)` blocks (lines 485-498 and 868-903) are dead code. The entire `src/handlers/` directory (7 files: `BaseAssetHandler.js`, `AssetHandlerFactory.js`, `ImageHandler.js`, `VideoHandler.js`, `AudioHandler.js`, `Model3DHandler.js`, `FontHandler.js`, `DocumentHandler.js`) is imported but never executed at runtime.

#### F6.2 -- asset_loading.js: getFilesFromDirectory deprecated [MEDIUM]

`getFilesFromDirectory` (lines 269-284) is marked deprecated with a `console.warn` on line 270. It was replaced by the Web Worker scan. The function is still defined and presumably exported (it was in scope at module level). It should be removed.

#### F6.3 -- tree_folder_view.js: DEBUG_MODE constant [LOW]

`const DEBUG_MODE = false;` at line 289 is deprecated in favor of `window.APP_DEBUG.modules.treeFolderView`. The constant still exists and is checked at line 282. No code sets it to `true`.

#### F6.4 -- asset_loading.js: activeFbxViewers commented out [LOW]

Lines 50-51:
```javascript
// Deprecated - now managed by memoryManager
// export const activeFbxViewers = new Set();
```

Commented-out code that should be removed.

---

## 7. Import Chain Health

#### F7.1 -- Circular dependency risk: dave_mode.js <-> dave_alive.js [MEDIUM]

`dave_alive.js` imports from `dave_mode.js`:
```javascript
import { DaveMode } from './dave_mode.js';
```

`dave_mode.js` imports from `dave_alive.js`:
```javascript
// (checked via the DaveAlive usage patterns)
```

Both files are singletons that reference each other at runtime. ES modules handle circular imports via live bindings, so this works, but it creates a tight coupling that makes extraction/splitting difficult. The `DaveAlive` singleton calls `DaveMode._showBubble()`, `DaveMode._presenceEl`, `DaveMode._irisEl`, `DaveMode._isDragging`, `DaveMode._savePosition()`, etc. -- all private-by-convention properties accessed cross-module.

#### F7.2 -- asset_loading.js: Heavy import fan-out [LOW]

`asset_loading.js` imports from 14+ modules. This is the heaviest import fan-out in the codebase. It acts as a hub module connecting UI state, cloud storage, handlers, filters, viewers, and the Dave system. While not a bug, it indicates this file has too many responsibilities.

#### F7.3 -- Private property access across module boundaries [MEDIUM]

`dave_alive.js` accesses 10+ underscore-prefixed properties of `DaveMode`:

- `DaveMode._presenceEl` (multiple lines)
- `DaveMode._irisEl` (multiple lines)
- `DaveMode._showBubble()` (multiple lines)
- `DaveMode._isDragging` (multiple lines)
- `DaveMode._savePosition()` (multiple lines)
- `DaveMode._startCursorFollow()` / `_stopCursorFollow()`
- `DaveMode._resumeIrisScan()`

These are implementation details exposed as pseudo-public API. Any refactor of `dave_mode.js` internals risks breaking `dave_alive.js` silently.

---

## 8. Summary Scoreboard

### By Severity

| Severity | Count | IDs |
|----------|:-----:|-----|
| CRITICAL | 1 | F2.1 |
| HIGH | 6 | F1.1, F1.2, F3.1, F4.1, F5.1, F6.1 |
| MEDIUM | 12 | F1.3, F1.4, F2.3, F2.4, F2.5, F3.2, F3.3, F4.2, F4.3, F4.4, F5.3, F5.4, F6.2, F7.1, F7.3 |
| LOW | 4 | F2.6, F3.4, F5.2, F6.3, F6.4, F7.2 |

### By Category

| Category | CRIT | HIGH | MED | LOW |
|----------|:----:|:----:|:---:|:---:|
| Event Listener Hygiene | 0 | 2 | 2 | 0 |
| Memory Leaks | 1 | 1 | 3 | 1 |
| Error Handling | 0 | 1 | 2 | 1 |
| Code Organization | 0 | 1 | 3 | 0 |
| Performance | 0 | 1 | 2 | 1 |
| Dead Code | 0 | 1 | 1 | 2 |
| Import Health | 0 | 0 | 2 | 1 |

### Top 5 Priorities

1. **F2.1 [CRITICAL]** -- Fire-and-forget rAF loops in fireworks/crackle. Uncancellable animation frames that run after Dave Mode is disabled.
2. **F1.2 [HIGH]** -- dave_alive.js leaks 3 document listeners per toggle cycle. Accumulates on repeated enable/disable.
3. **F5.1 [HIGH]** -- style.left/top in animation loops (26 instances). Layout thrash at peak particle counts (200+).
4. **F4.1 [HIGH]** -- loadTileContent (300 lines) and showFullscreen (415 lines) are unmaintainable monoliths.
5. **F6.1 [HIGH]** -- Entire handler system is dead code behind `useNewHandler = false`. 7+ files imported but never executed.

### Per-File Health

| File | Lines | Findings | Worst Severity | Health |
|------|:-----:|:--------:|:--------------:|:------:|
| dave_mode.js | 2,273 | 9 | CRITICAL | Needs attention |
| dave_alive.js | 2,120 | 5 | HIGH | Fair |
| asset_loading.js | 1,754 | 7 | HIGH | Needs attention |
| ui.js | 1,452 | 3 | HIGH | Fair |
| model_inspector.js | 1,585 | 2 | MEDIUM | Good |
| tree_folder_view.js | 1,545 | 2 | MEDIUM | Good |
| dav9000_terminal.js | 1,325 | 0 | -- | Solid |

---

*End of Audit #2. 23 findings across 7 files. 1 CRITICAL, 6 HIGH, 15 MEDIUM, 6 LOW.*
