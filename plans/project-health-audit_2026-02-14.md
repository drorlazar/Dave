# DAVE Project Health Audit

**Date**: 2026-02-14 | **Branch**: `feature/site-checkup` | **Auditor**: Claude Opus 4.6

---

## EXECUTIVE SUMMARY

Dave has grown from a simple asset viewer into a **37,790-line codebase** (1.2 MB source) with a full personality system, cloud storage, 3D inspection, and autonomous behaviors. The app is functional and creative, but rapid feature growth has introduced architectural debt that will slow expansion if not addressed.

**Overall Health Score: 7.2/10**

| Area | Score | Verdict |
|------|-------|---------|
| Core Asset Viewer | 8/10 | Solid, stable, well-tested |
| Cloud Storage | 8/10 | Clean abstraction, good separation |
| 3D Inspector | 7/10 | Works well, some large files |
| Dave Personality | 6.5/10 | Creative and fun, but monolithic |
| CSS Architecture | 6/10 | Sprawling, specificity wars |
| Performance | 7/10 | Good patterns, some leak risks |
| Expandability | 6/10 | Adding behaviors works, but fragile |
| Code Organization | 6.5/10 | Growing pains visible |

---

## 1. PROJECT INVENTORY

### Codebase Size

| Category | Files | Lines | % of Total |
|----------|-------|-------|------------|
| **JavaScript** | 36 | 23,519 | 62% |
| **CSS** | 10 | 12,180 | 32% |
| **HTML** | 4 | 2,091 | 6% |
| **TOTAL** | **50** | **37,790** | **100%** |

### Size by System

| System | JS Lines | CSS Lines | Total | % |
|--------|----------|-----------|-------|---|
| **Dave Personality** | 5,717 | 2,693 | 8,410 | 22% |
| **Dave Games & Commands** | 2,254 | 588 | 2,842 | 8% |
| **Dave Debug** | 865 | 403 | 1,268 | 3% |
| **DAV-9000 Terminal** | 1,325 | 525 | 1,850 | 5% |
| **Core App (UI + Loading)** | 3,396 | 5,789 | 9,185 | 24% |
| **Viewers & Inspectors** | 4,585 | 2,152 | 6,737 | 18% |
| **Cloud Storage** | 2,726 | 0 | 2,726 | 7% |
| **Handlers** | 1,624 | 0 | 1,624 | 4% |
| **Utilities** | 1,480 | 0 | 1,480 | 4% |
| **Easter Eggs & Themes** | 673 | 1,029 | 1,702 | 4% |

**Key insight**: Dave-related code (personality + games + debug + terminal) = **14,370 lines (38% of the codebase)**. The persona is now larger than the asset viewer itself.

### Top 10 Largest Files

| # | File | Lines | KB | Role |
|---|------|-------|----|------|
| 1 | styles/styles.css | 5,789 | 168 | Main app styles |
| 2 | core/dave_mode.js | 2,275 | 79 | Dave personality engine |
| 3 | styles/model_inspector.css | 2,152 | 68 | 3D inspector styles |
| 4 | core/dave_alive.js | 2,117 | 71 | Autonomous behaviors |
| 5 | core/asset_loading.js | 1,751 | 67 | Asset pipeline |
| 6 | viewers/model_inspector.js | 1,585 | 52 | 3D inspector |
| 7 | viewers/tree_folder_view.js | 1,545 | 52 | Tree view |
| 8 | core/ui.js | 1,452 | 58 | UI management |
| 9 | core/dav9000_terminal.js | 1,325 | 43 | DAV-9000 terminal |
| 10 | games/dave_commands.js | 1,012 | 34 | Command routing |

---

## 2. ARCHITECTURE ANALYSIS

### Module Dependency Graph

```
main.js (entry point)
  +-- asset_loading.js (heaviest, 14 imports)
  |     +-- handlers/*.js (7 handlers)
  |     +-- cloud/*.js (4 modules)
  |     +-- viewers/*.js (3 viewers)
  |     +-- utils/*.js (3 utilities)
  +-- ui.js
  |     +-- asset_loading.js (circular ref via named imports)
  |     +-- dav9000_terminal.js
  +-- dave_mode.js (standalone, 1 import)
  +-- dave_alive.js --> dave_mode.js
  +-- dave_debug.js --> dave_mode.js + dave_alive.js
  +-- dave_commands.js --> dave_mode.js + dave_alive.js + games/*.js
```

### What's Working Well

1. **Handler Factory Pattern** -- Clean `BaseAssetHandler` -> specific handlers. Adding a new file type = one new handler file.
2. **Cloud Storage Abstraction** -- `CloudStorageProvider.js` cleanly wraps S3 and GDrive. Adding a new provider is straightforward.
3. **3D Inspector Adapters** -- GLB and FBX adapters share a common interface via `ModelInspectorPanel`.
4. **Dave Event System** -- `dave:command`, `dave:idle`, `dave:search` events decouple the personality from core functionality.
5. **Web Worker for Scanning** -- Folder scanning offloaded to worker thread, keeps UI responsive.
6. **Safety Wrapper** -- `_safeRun()` pattern prevents cascading behavior failures.
7. **Design Language Document** -- `plans/dave-design-language_2026-02-14.md` captures visual rules for consistency.

### Architectural Issues

#### CRITICAL: dave_mode.js is a God Object (2,275 lines)

`dave_mode.js` handles:
- Dave's presence (eye, iris, cursor tracking)
- Emotion system (11 emotions, color transitions)
- Speech bubbles (creation, positioning, lifecycle)
- Idle detection and nagging
- File commentary
- Sort/filter reactions
- Error/loading messages
- Configuration (DAVE_CONFIG, EMOTION constants)
- Iris scanning (colors, timing)
- Drag behavior
- Digital tears
- Fireworks system
- All micro-interactions

**This is the #1 bottleneck for expansion.** Every new Dave feature must understand 2,275 lines of context. A new developer (or AI) touching this file risks breaking 15 different subsystems.

**Recommendation**: Split into focused modules:
- `dave_presence.js` (eye, iris, cursor, drag, positioning) ~400 lines
- `dave_emotions.js` (emotion system, colors, transitions) ~300 lines
- `dave_speech.js` (speech bubbles, commentary, reactions) ~500 lines
- `dave_effects.js` (tears, fireworks, particles) ~400 lines
- `dave_config.js` (DAVE_CONFIG, EMOTION constants, exports) ~200 lines
- `dave_mode.js` (orchestrator, init, public API) ~500 lines

#### HIGH: asset_loading.js is Also Monolithic (1,751 lines)

Handles file scanning, rendering, pagination, fullscreen, video scrubbing, audio waveforms, drag-drop, cloud URL handling, and 3D model loading. All in one file.

**Recommendation**: Extract:
- `fullscreen_viewer.js` (fullscreen overlay, media controls, scrubbing)
- `pagination.js` (page management, navigation)
- `grid_renderer.js` (tile creation, lazy loading)

#### MEDIUM: styles.css is the Largest File (5,789 lines)

One CSS file for the entire app UI. Adding Dave styles required 5 separate new CSS files because this one was already unmanageable.

**Recommendation**: Split into:
- `layout.css` (grid, flexbox structure)
- `components.css` (buttons, dropdowns, modals)
- `fullscreen.css` (viewer overlay)
- `responsive.css` (media queries)

---

## 3. PERFORMANCE AUDIT

### Timer Management (Leak Risk)

| Pattern | Count | Risk |
|---------|-------|------|
| `setInterval` | 33 | HIGH -- must all be tracked and cleared |
| `setTimeout` | 132 | MEDIUM -- one-shots, but long delays can outlive components |
| `addEventListener` | 297 | see below |
| `removeEventListener` | 48 | **6:1 ratio** -- potential leak |
| `requestAnimationFrame` | 51 | see below |
| `cancelAnimationFrame` | 15 | **3.4:1 ratio** -- some may not cancel |
| `document.createElement` | 276 | MEDIUM -- must pair with removal |

**The addEventListener/removeEventListener ratio of 6:1 is concerning.** While many listeners are added once at init (and legitimately never removed), some in dave_alive.js and dave_mode.js are added during behaviors and should be removed.

### Specific Leak Risks

1. **dave_alive.js**: Trail particles use `setInterval` for sub-drips. The `_resetAllFlags()` cleanup handles this, but if `_safeRun()` doesn't catch a synchronous error before the interval is set, the interval leaks.

2. **dave_mode.js**: The iris scan `setInterval` runs continuously when Dave Mode is on. If Dave Mode is toggled rapidly, multiple intervals could stack.

3. **Scroll handler** in dave_alive.js: Added to `window` with `{ passive: true }` but never removed if Dave Mode is disabled.

4. **mousemove handlers**: Multiple files add mousemove listeners to `document` during drag operations. Most properly remove them in mouseup handlers, but edge cases (tab switch during drag) could leak.

### DOM Query Patterns

| File | querySelector calls | Risk |
|------|-------------------|------|
| ui.js | 33 | LOW -- mostly at init |
| asset_loading.js | 21 | MEDIUM -- some in render loops |
| dave_mode.js | 13 | LOW -- cached in `_presenceEl` |
| dave_alive.js | 9 | LOW -- mostly cleanup sweeps |

**Good practice**: `dave_mode.js` caches DOM references (`_presenceEl`, `_irisEl`). This pattern should be used everywhere.

### Animation Performance

**Good**: All Dave animations use `transform` and `opacity` (GPU-composited properties). `will-change` is used appropriately (10 instances, not overused).

**Concern**: Trail particles in dave_alive.js create/destroy DOM elements at 15-40ms intervals. At peak (spiral with sub-drips), this could be 200+ elements. Each removal triggers a micro-reflow. Consider using a particle pool pattern instead of create/destroy.

### First Load Analysis

| Resource Type | Count | Notes |
|---------------|-------|-------|
| CSS files | 10 | All loaded in `<head>`, render-blocking |
| JS entry | 1 | `main.js` as `type="module"` (deferred) |
| JS modules | ~30 | Loaded on demand via ES module resolution |
| CDN resources | 3 | Font Awesome, Google Identity, Counter.dev |
| Import map | 1 | Three.js (loaded only when 3D model opened) |

**Issue**: 10 CSS files all load before first paint. Only `styles.css` is needed initially. Dave CSS files could be lazy-loaded when Dave Mode is enabled.

---

## 4. DAVE SYSTEM DEEP DIVE

### State Management

Dave's state is distributed across multiple locations:

| State | Location | Persistence |
|-------|----------|-------------|
| Dave Mode on/off | `localStorage('dave_full_mode')` | Persistent |
| Current emotion | `DaveMode._currentEmotion` | Session |
| Is dragging | `DaveMode._isDragging` | Session |
| Position | CSS `top`/`left` on `.dave-presence` | Session |
| Idle cycle count | `DaveAlive._idleCycleCount` | Session |
| Behavior active flags | `DaveAlive._heartActive`, etc. | Session |
| Debug panel open | `DaveDebug._panelVisible` | Session |
| Command history | `DaveCommands._history` | Session |
| Sleep state | `DaveAlive._sleepOnElementActive` | Session |

**Problem**: No single source of truth. If you need "Is Dave currently doing something?", you must check 7+ flags across 2 classes. The `_resetAllFlags()` method partially addresses this, but it's a band-aid.

**Recommendation**: Create a `DaveState` singleton:
```javascript
DaveState = {
  mode: 'idle', // idle | moving | inspecting | sleeping | playing | commanding
  emotion: EMOTION.NEUTRAL,
  position: { x, y },
  flags: { isDragging, isSpeaking, isAnimating },
  canInterrupt: () => true/false,
}
```

### Adding New Behaviors -- Current Friction

To add a new behavior today, you must:
1. Write the behavior method in `dave_alive.js` (with trail engine, particles, etc.)
2. Add a flag in the constructor (`this._newBehaviorActive = false`)
3. Add a guard check in `_tryAliveBehavior()`
4. Add probability entry in `_tryAliveBehavior()` dispatch table
5. Clean up in `_resetAllFlags()`
6. Add CSS in `dave_alive.css`
7. (Optional) Add command in `dave_commands.js`
8. (Optional) Add debug button in `dave_debug.js`

That's **5-8 files** for one behavior. Not terrible, but the probability table in `_tryAliveBehavior()` is becoming a wall of if/else that's hard to reason about.

**Recommendation**: Behavior registry pattern:
```javascript
DaveAlive.registerBehavior({
  name: 'newThing',
  tier: 3,
  minCycles: 5,
  chance: 0.05,
  guard: () => !this._flags.newThingActive,
  execute: async () => { /* ... */ },
  cleanup: () => { /* ... */ },
});
```

### Dave Command System Health

The command system in `dave_commands.js` (1,012 lines) is well-structured with a clean routing pattern:
```javascript
const commands = { 'joke': fn, 'flip': fn, ... };
```

But several commands contain **inline behavior code** (joke, fortune, flip, dance, story contain 50-100 lines of animation logic each). These should call into shared animation utilities.

### Speech Bubble Reuse

Speech bubbles are created in at least 3 places:
- `DaveMode.say()` -- the canonical method
- `DaveAlive` methods -- some create bubbles directly
- `dave_commands.js` -- some commands create custom bubbles

All should route through `DaveMode.say()` exclusively.

---

## 5. CSS AUDIT

### Specificity Conflicts

**157 `!important` declarations** across CSS files:

| File | !important Count | Severity |
|------|-----------------|----------|
| matrix_theme.css | 54 | HIGH -- theme override war |
| dave_mode.css | 32 | HIGH -- fighting app styles |
| dave_games.css | 29 | MEDIUM -- game overlay needs |
| styles.css | 27 | MEDIUM -- accumulated fixes |
| dave_alive.css | 9 | LOW -- targeted overrides |
| model_inspector.css | 1 | LOW |

**Root cause**: The main `styles.css` (5,789 lines) uses broad selectors. Dave styles need `!important` to override them. Matrix theme needs `!important` to override everything.

**Recommendation**: Adopt a specificity strategy:
- Base styles: class selectors only (`.grid-item`, `.toolbar`)
- Theme overrides: `body.matrix-theme .grid-item` (body class + element class)
- Dave styles: `.dave-presence .dave-*` (scoped under Dave root)
- Never `!important` in base styles

### z-index Chaos

Currently using z-indexes from 0 to 99999 with **37 distinct values**:

| Range | Purpose | Values Used |
|-------|---------|-------------|
| 1-11 | App layers | 1, 2, 3, 4, 5, 10, 11 |
| 89-100 | Overlay content | 89, 90, 91, 95, 100 |
| 1000-1600 | Modals, panels | 1000, 1001, 1002, 1004, 1498-1600 |
| 2000 | Top modals | 2000 |
| 9800-10010 | Fullscreen layers | 9800, 9900, 9950, 9997-10010 |
| 99993-99999 | Dave system | 99993-99999 |

The Dave system occupies z-index 99993-99999 which works but is fragile. If any future feature needs to be above Dave, there's almost no room.

**Recommendation**: Define a z-index scale in CSS custom properties:
```css
:root {
  --z-base: 1;
  --z-dropdown: 100;
  --z-modal: 1000;
  --z-fullscreen: 2000;
  --z-dave: 3000;
  --z-dave-overlay: 3100;
}
```

### CSS File Organization -- What's Good

Dave CSS files are well-organized by feature:
- `dave_mode.css` -- presence, speech, emotions, tears
- `dave_alive.css` -- trails, particles, iris effects, sleep
- `dave_games.css` -- game overlays, canvas styling
- `dave_debug.css` -- debug panel

This is the right pattern. Main `styles.css` should be split similarly.

---

## 6. EXPANDABILITY ASSESSMENT

### What's Easy to Add

| Feature Type | Difficulty | Files Touched |
|-------------|------------|---------------|
| New file handler | Easy | 1 new handler + factory registration |
| New cloud provider | Easy | 1 new client + provider registration |
| New dave command | Easy | 1 entry in dave_commands.js |
| New dave game | Medium | 1 new game file + command entry |
| New idle behavior | Medium | dave_alive.js + dave_alive.css + debug |
| New iris effect | Medium | dave_alive.js + dave_alive.css |
| New emotion | Hard | dave_mode.js + dave_mode.css + dave_alive.css |

### What's Hard to Add

1. **New Dave communication channel** (e.g., Dave writes on the grid, Dave rearranges tiles) -- requires deep integration with asset_loading.js
2. **Dave memory across sessions** -- no persistence layer beyond localStorage for mode toggle
3. **Dave interactions with specific file types** -- handler system is disconnected from Dave
4. **Multi-Dave** (multiple personality instances) -- everything is singleton/static
5. **Dave on mobile** -- no touch event equivalents for drag, cursor follow, hover reactions

### Growth Trajectory Concern

At current growth rate:
- **dave_mode.js**: 2,275 lines and growing. Every emotion, reaction, and UI integration goes here.
- **dave_alive.js**: 2,117 lines. Every new behavior adds ~100-200 lines.
- **dave_commands.js**: 1,012 lines. Each new command adds 30-80 lines.

**Projection**: At 20 more behaviors + 10 more commands, we'll have ~7,000 lines of Dave JS spread across 3 files. This is manageable if we refactor dave_mode.js first.

---

## 7. SECURITY & ROBUSTNESS

### Good Practices Found
- `.env` in `.gitignore`
- Cloud credentials in localStorage (not committed)
- No inline `eval()` or `Function()` constructors
- User input sanitized before DOM insertion (search input)
- CORS handling for S3 pre-signed URLs

### Concerns
- `innerHTML` used in several places for speech bubbles and game UI -- should use `textContent` where possible
- Counter.dev analytics script loaded without SRI hash
- No Content-Security-Policy headers configured
- Google Identity Services loaded without subresource integrity

---

## 8. RECOMMENDATIONS -- PRIORITY ORDER

### P0: Must-Do Before Push

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 1 | Verify all Dave behaviors work with Dave Mode OFF | Prevents crashes for non-Dave users | 1 hour |
| 2 | Test light mode + Dave Mode combo | Visual bugs likely | 30 min |
| 3 | Verify scroll/resize handler cleanup when Dave Mode toggled | Memory leak prevention | 30 min |

### P1: Do This Sprint

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 4 | Extract `dave_config.js` from dave_mode.js | Shared constants, clean imports | 2 hours |
| 5 | Lazy-load Dave CSS files | Faster first paint for non-Dave users | 1 hour |
| 6 | Add particle pool to dave_alive.js | Performance under heavy effects | 3 hours |
| 7 | Standardize all speech through `DaveMode.say()` | Consistency, prevents orphan bubbles | 2 hours |

### P2: Next Sprint

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 8 | Split dave_mode.js into 5 focused modules | Massive expandability improvement | 1 day |
| 9 | Split styles.css into logical chunks | CSS maintainability | 4 hours |
| 10 | Behavior registry pattern in dave_alive.js | Easier to add/modify behaviors | 4 hours |
| 11 | z-index CSS custom properties | Prevents layering bugs | 2 hours |
| 12 | DaveState singleton | Single source of truth for Dave state | 3 hours |

### P3: Future

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 13 | Split asset_loading.js | Core app maintainability | 1 day |
| 14 | Touch event support for Dave | Mobile Dave experience | 4 hours |
| 15 | Dave persistence (remember user across sessions) | Deeper personality | 1 day |
| 16 | Performance monitoring (behavior timing, DOM count) | Catch regressions | 3 hours |

---

## 9. THE NUMBERS THAT MATTER

```
Total Source Code:        37,790 lines (1.2 MB)
Dave System:              14,370 lines (38% of codebase)
Core App:                 23,420 lines (62% of codebase)

Files Created for Dave:   15 files
External Dependencies:    3 CDN resources
CSS !important:           157 occurrences
z-index Values:           37 distinct values
window.* Globals:         ~25 exposed
Timer Patterns:           33 setInterval + 132 setTimeout
Event Listeners:          297 added / 48 removed (6:1 ratio)
DOM createElement:        276 calls across 26 files

Commits to Date:          73 total
Dave-related Commits:     23 (31%)
```

---

## 10. VERDICT

Dave is a **genuinely creative and technically impressive** personality system built in pure vanilla JS with no build tools. The particle effects, iris transformations, trail engine, and autonomous behaviors are well-crafted and performant.

**The main risk is monolithic files.** `dave_mode.js` (2,275 lines) and `styles.css` (5,789 lines) are the bottlenecks. Every new feature increases the cognitive load of working in these files. The refactoring recommendations above would unlock faster, safer expansion.

**The good news**: The event-driven architecture (`dave:command`, `dave:idle`) is the right foundation. The handler factory, cloud abstraction, and inspector adapters prove the codebase can support clean patterns. The Dave system just needs the same treatment.

**Bottom line**: The house is solid. The Dave wing needs some interior walls.

---

*Generated by comprehensive 5-agent audit on 2026-02-14*
