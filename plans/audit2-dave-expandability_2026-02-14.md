# Audit #2: Dave System Expandability & Architecture Quality
**Date:** February 14, 2026 | **Scope:** 15 Dave files, 14,370 lines

---

## 1. Coupling Assessment

### Dependency Graph (import direction)

```
main.js
  +-- dave_mode.js (DaveMode, init)
  +-- dave_debug.js (DaveDebug, init)
  +-- dave_commands.js (DaveCommands, init)
  +-- dave_alive.js (DaveAlive, init)

dave_mode.js
  +-- dav9000_terminal.js (isDAV9000Active only)

dave_alive.js
  +-- dave_mode.js (DaveMode, DAVE_CONFIG, EMOTION)

dave_debug.js
  +-- dave_mode.js (DaveMode, DAVE_CONFIG, EMOTION)
  +-- dave_alive.js (DaveAlive)

dave_commands.js
  +-- dave_mode.js (DaveMode, EMOTION)
  +-- dave_music.js, dave_snake.js, dave_breakout.js
  +-- dave_alive.js (DaveAlive)

dave_music.js / dave_snake.js / dave_breakout.js
  +-- dave_mode.js (DaveMode, EMOTION)
```

**Finding: dave_mode.js is the god object.** Every Dave file imports from it.

### Private Property Access Violations (40+ cross-module)

- `dave_alive.js:294` -- `DaveMode._presenceEl`, `DaveMode._enabled`
- `dave_alive.js:354` -- `DaveMode._applyPosition()`
- `dave_alive.js:435` -- `DaveMode._resumeIrisScan()`
- `dave_alive.js:625` -- `DaveMode._presenceEl`, `DaveMode._isDragging`
- `dave_commands.js:498` -- `clearTimeout(DaveMode._bubbleTimer)` (reaching into timer internals)
- `dave_commands.js:503` -- `DaveMode._bubbleEl?.querySelector('.dave-bubble-text')` (DOM internals)
- `dave_commands.js:810-812` -- `DaveMode._twGen++`, `DaveMode._twTimeout` (modifying typewriter state)
- `dave_music.js:80-84` -- `DaveMode._irisEl`, `DaveMode._presenceEl?.classList`

**No public API surface on DaveMode.** Everything is underscore-prefixed "private" but consumed externally.

### Core-Dave Coupling: CLEAN

Core files (ui.js, asset_loading.js) dispatch custom events; Dave listens. Core never imports from Dave. This is the right pattern.

---

## 2. State Management

### localStorage Keys (7)

| Key | File | Purpose |
|-----|------|---------|
| `dave_fullmode_enabled` | dave_mode.js:9 | On/off toggle |
| `dave_fullmode_visits` | dave_mode.js:10 | Visit counter |
| `dave_fullmode_first` | dave_mode.js:11 | First activation timestamp |
| `dave_fullmode_pos` | dave_mode.js:12 | Eye position {x,y} |
| `dave_debug_settings` | dave_debug.js:9 | Config slider overrides |
| `dave_debug_presets` | dave_debug.js:10 | Named preset configurations |
| `dave_debug_pos` | dave_debug.js:11 | Debug panel position |

### In-Memory State: 83 Mutable Properties Across 5 Singletons

- `DaveMode`: ~40 properties (emotions, drag, timers, session tracking)
- `DaveAlive`: ~20 properties (behavior flags, cooldowns, activity log)
- `DaveCommands`: ~10 properties (game state, timers)
- `DaveMusicMode`: ~8 properties (intervals, iris state)
- `DaveDebug`: ~5 properties (visibility, routine state)

**No centralized Dave state object.** No way to query "is Dave busy?" without checking multiple flags in multiple objects.

### CSS Class-Based State

The presence element carries significant state via CSS classes: `dave-ambient`, `dave-dragging`, `dave-sleeping`, `dave-speaking`, `dave-alive-moving`, `dave-puppet-mode`, `dave-sing-mode`, etc. Dual state system (JS + CSS).

---

## 3. Adding Behavior #14

Walk-through for adding a hypothetical "dave periscope" behavior:

**File 1: `dave_alive.js`** (minimum required):
1. Add guard flag in constructor (~line 576)
2. Add to `_resetAllFlags()` (line 617-642)
3. Add cleanup to `destroy()` (line 2088-2113)
4. Add `async triggerPeriscope()` method
5. Register in `_tryAliveBehavior()` (lines 1993-2064)
6. Add CSS class to destroy cleanup string (line 2112)

**File 2: `dave_commands.js`** (if user command):
1. Add to `COMMANDS` array (line 15-33)
2. Add handler in `_route()` (line 452-485)

**File 3: `dave_debug.js`** (if debug button):
1. Add button in `_buildAliveSection()` (lines 700-793)

**File 4: CSS** -- Styles for new visual elements

**Total: 2-4 files, 3-5 manual registration points in dave_alive.js alone.** Pattern is consistent but no formal registry.

---

## 4. Adding a `dave fireworks` Command

**File 1: `dave_commands.js`** -- The only required file:
1. Add to `COMMANDS` array: `{ name: 'fireworks', icon: '*', desc: 'Dave launches fireworks' }`
2. Add handler in `_route()`: `'fireworks': () => DaveMode._triggerFireworks()`

**Total: 1 file, 2 lines.** This is the best-designed extensibility point.

---

## 5. Event System Health

### Complete Event Map

| Event | Dispatched From | Consumed By |
|-------|----------------|-------------|
| `dave:search` | ui.js:35,158 | dave_mode.js, dave_alive.js |
| `dave:sort` | asset_loading.js:310 | dave_mode.js, dave_commands.js |
| `dave:filter` | asset_loading.js:325 | dave_mode.js, dave_alive.js |
| `dave:themeChange` | ui.js:249, SettingsModal.js:542,585 | dave_mode.js, dave_commands.js |
| `dave:pageRender` | asset_loading.js:818 | dave_mode.js, dave_alive.js |
| `dave:filesLoaded` | asset_loading.js:403,1412 | dave_mode.js, dave_commands.js |
| `dave:fullscreen` | asset_loading.js:827 | dave_mode.js, dave_alive.js |
| `dave:fullscreenExit` | ui.js:794,797 | dave_commands.js, dave_alive.js |
| `dave:selection` | ui.js:815,902,1451 | dave_mode.js |
| `dave:error` | asset_loading.js:735 | dave_mode.js, dave_commands.js |
| `dave:idle` | dave_mode.js:2247 | dave_alive.js, dave_commands.js |
| `dave:command` | ui.js:174, dave_commands.js:391,426, dave_debug.js:811 | dave_commands.js |
| `dave:debugPanel` | ui.js:140, dave_commands.js:476 | dave_debug.js |

### Issues

1. **BUG: `dave:selectionChange` vs `dave:selection` mismatch.** `dave_commands.js:247` listens for `dave:selectionChange` but ui.js dispatches `dave:selection`. The auto-behavior for `selection.cleared` is dead code.

2. **No documentation.** No central registry defining event contracts.

3. **Missing events:** `dave:behaviorStart`/`dave:behaviorEnd`, `dave:stateChange`, `dave:dragStart`/`dave:dragEnd`.

4. **Redundant tracking.** Both `dave_mode.js` and `dave_commands.js` independently track sort/filter counts.

---

## 6. Configuration Extraction

### Duplicated Constants

| Value | Occurrences | What |
|-------|-------------|------|
| `'#00ff41'` | 20+ times across 5 JS files | Dave's green (should use DAVE_CONFIG or CSS var) |
| `window.innerWidth - 52` | 7 times in dave_alive.js | Default eye X position |
| `window.innerHeight - 52` | 7 times in dave_alive.js | Default eye Y position |
| `_getIrisColor()` | 3 implementations | Same logic duplicated in dave_mode, dave_music, dave_commands |
| `_pickFromPool()` | 2 implementations | Weighted random in dave_alive vs dave_mode |
| `raveColors` | 2 copies in dave_commands.js | Rave color palette defined twice |

---

## 7. Testing Surface

**Current testability: F grade.**

- **Singletons everywhere.** Classes not exported, only pre-instantiated singletons.
- **DOM-coupled.** Every method directly manipulates `document`.
- **Timer-heavy.** 5-10 chained setTimeout/setInterval per behavior, no fake timer injection.
- **No dependency injection.** Direct singleton references.
- **Private API is the only API.** All coordination through `DaveMode._` properties.

**What's testable today (E2E only):** Command routing, event flow, localStorage persistence.

---

## 8. dave_mode.js Split Points

### Natural Extractions

| Split | Lines | Risk | Description |
|-------|-------|------|-------------|
| `dave_messages.js` | ~324 | Zero | Pure data: MSG object, SPAM_REACTIONS, all message pools |
| `dave_effects.js` | ~400 | Low | Tear physics + fireworks + crackle + drag trail. Interface: `triggerTear(pos, color)`, `triggerFireworks(pos, color)` |
| `dave_bubble.js` | ~190 | Low | Speech bubble display, positioning, hover pause, matrix typewriter |
| **Total extractable** | **~724** | | **32% of file** |

**Minimum viable:** Extract `dave_messages.js` (324 lines, zero risk, pure data).

---

## Summary Scorecard

| Area | Grade | Key Issue |
|------|-------|-----------|
| Core-Dave decoupling | **A** | Clean event-based. Core never imports Dave. |
| Dave inter-file coupling | **D** | 40+ private property accesses. No public API. |
| State management | **C-** | 83 properties, 5 singletons, no central store. |
| Adding behaviors | **B** | Well-established pattern, 3-5 manual registration points. |
| Adding commands | **A** | Single file, 2-line change. Best extensibility point. |
| Event system | **B-** | Good architecture, `selectionChange` bug, no docs. |
| Configuration | **C** | DAVE_CONFIG exists but #00ff41 20+ times, innerWidth-52 7 times. |
| Testability | **F** | Singletons, no DI, DOM-coupled, zero test infrastructure. |
| Monolith risk | **C** | Clear split points, 324-724 lines extractable. |
