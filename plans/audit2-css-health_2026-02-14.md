# DAVE CSS Health Audit #2
**Date:** February 14, 2026
**Project:** DAVE - Dror's Assets Viewing Experience
**Scope:** All 9 CSS files (11,856 lines total)
**Previous Fixes (Audit #1):** Extracted `--dave-green` variable (76 replacements), reduced z-index from 99994-99998 to 2400-2600, removed duplicate rules in dave_alive.css

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Total CSS lines | 11,856 across 9 files |
| `!important` declarations | **149** across 6 files |
| Distinct z-index values | **37+** ranging from 0 to 10,010 |
| `body:not(.dark-mode)` selectors | **343** across 4 files |
| `@keyframes` definitions | **93** across 8 files |
| `will-change` declarations | **14** across 5 files |
| `filter:` usages (non-backdrop) | **60+** (many in keyframes) |
| `var(--` custom property references | **362** across 7 files |
| `@media` queries | **17** across 4 files |
| Confirmed duplicate rule blocks | **5** in styles.css |

**Overall CSS Health Score: 6.8 / 10**

The architecture is functional and demonstrates good patterns in places (theme variables, `will-change` usage, `--dave-green` extraction), but suffers from three structural problems: (1) `!important` warfare driven by theme overrides, (2) z-index anarchy with no formal layer system, and (3) a 5,780-line monolithic stylesheet that has never been split.

---

## Focus Area 1: `!important` Declarations

**Total: 149 across 6 files**

### Breakdown by File

| File | Count | Severity | Notes |
|------|-------|----------|-------|
| matrix_theme.css | 54 | HIGH | Nearly every rule uses `!important` |
| dave_mode.css | 33 | HIGH | Spam reactions, sleeping, dragging states |
| styles.css | 30 | MEDIUM | Settings, dropdowns, light mode fixes |
| dave_games.css | 21 | MEDIUM | Animation class overrides |
| dave_alive.css | 10 | LOW | Targeted overrides (morse, iris, fade) |
| model_inspector.css | 1 | LOW | Single tooltip override |
| easter_egg.css | 0 | -- | Clean |
| dav9000_terminal.css | 0 | -- | Clean |
| dave_debug.css | 0 | -- | Clean |

### Worst Offenders

**matrix_theme.css (54) -- SEVERITY: HIGH**
This file is the single largest contributor. Almost every rule uses `!important` because the matrix theme must override the base styles.css and any active theme variables. This is a symptom of the file being loaded as an additive stylesheet rather than operating through the CSS custom property system.

Example pattern (repeated ~54 times):
```css
.matrix-theme .topBar { background: #000a00 !important; }
.matrix-theme .model-name { color: #00ff41 !important; }
.matrix-theme .settings-dropdown-content { background-color: #001a00 !important; }
```

**Fix strategy:** Convert matrix_theme.css to override `--theme-*` custom properties on `.matrix-theme` selector, then let existing `var()` references cascade naturally. This would eliminate ~40 of the 54 `!important` declarations. The remaining ~14 would be for properties not yet using custom properties (e.g., `font-family`, `box-shadow`, `border`).

**dave_mode.css (33) -- SEVERITY: HIGH**
These are concentrated in the "spam click" reaction states (lines 401-493). Each reaction state (HAL, matrix, hurt, shuteye, glare, dizzy) forces iris/eye properties with `!important` to override the base animation:

```css
.dave-presence.dave-spam-hal .dave-presence-iris {
    background: radial-gradient(...) !important;
    box-shadow: ... !important;
    animation: none !important;
}
```

**Fix strategy:** Use CSS specificity escalation via `.dave-presence.dave-spam-hal` (already done) but remove `!important` by increasing specificity with an extra `.dave-presence-eye` qualifier, or by using CSS layers (`@layer`). The `animation: none !important` pattern is the hardest to remove -- it fights the always-running `dave-iris-scan` animation.

**styles.css (30) -- SEVERITY: MEDIUM**
Scattered across settings dropdown visibility, canvas rendering, audio controls, dropdown arrow icons, and light mode patches. Most are legacy fixes where a lower-specificity rule was losing to an inline style or a later rule:

```css
.settings-dropdown-content { display: none !important; }  /* fights .active class */
.three-viewer canvas { display: block !important; }        /* fights model-viewer inline */
```

**Fix strategy:** ~15 can be removed by reordering rules or increasing specificity. ~10 are fighting inline styles set by JavaScript (legitimate `!important` use). ~5 are fighting third-party elements (model-viewer, video controls).

### Verdict

| Rating | Assessment |
|--------|-----------|
| **HIGH** | 149 total is excessive for a 12K-line codebase. matrix_theme.css alone accounts for 36%. The fix is architectural: move matrix theme to custom property overrides. dave_mode.css needs specificity restructuring for spam states. |

---

## Focus Area 2: z-index Architecture

**Total: 99 z-index declarations across 9 files, using 37+ distinct values**

### Current Layer Map (ascending order)

| z-index | File | Element | Purpose |
|---------|------|---------|---------|
| 0 | dave_mode.css | `.dave-bubble-text` | Bubble text layer |
| 1 | multiple | Internal stacking | Local contexts |
| 2-5 | multiple | Internal stacking | Local contexts |
| 10 | styles.css | `.model-tile-buttons`, fullscreen buttons | Tile interaction |
| 11 | styles.css | `.tree-overlay-btn` | Over tree content |
| 89 | styles.css | `.tree-tab-indicator` | Below tree panel |
| 90 | styles.css | `.tree-folder-panel` | Tree panel |
| 91 | styles.css | `.tree-resize-handle` | Tree resizer |
| 95 | styles.css | `.tree-context-menu` | Above tree content |
| 100 | styles.css | `.topBar` | Top navigation |
| 1000 | styles.css | `.dropdown-content`, fullscreen overlay, tree scroll/drag | Dropdown menus |
| 1001 | styles.css | Fullscreen nav buttons, edit btn, tree panel responsive | Overlay controls |
| 1002 | styles.css, model_inspector | Tooltips, fullscreen info, inspector panel | Floating UI |
| 1004 | model_inspector.css | Material editor overlay | Inspector sub-panel |
| **1498** | **dave_mode.css** | **Tears (bottom trail)** | **Dave effects floor** |
| **1499** | **dave_mode.css** | **Sparks, firework trails** | **Dave effects mid** |
| **1500** | **dave_mode.css** | **Dave presence (eye)** | **Dave presence** |
| **1501** | **dave_mode.css** | **Speech bubble** | **Dave speech** |
| **1600** | **dave_mode.css** | **Dragging state** | **Dave drag** |
| 2000 | styles.css, dave_debug | Cloud modal, debug panel | Modals |
| **2400** | **dave_alive.css** | **Constellation base, inspect, subliminal** | **Alive floor** |
| **2500** | **dave_alive.css** | **Trail chars, stars, particles, hearts, etc** | **Alive effects** |
| **2600** | **dave_alive.css** | **Zzz floaters, morse indicator, puppet** | **Alive ceiling** |
| **9800** | **dave_games.css** | **Game canvas (snake/breakout)** | **Game layer** |
| **9900** | **dave_games.css** | **Game overlay (score, UI)** | **Game UI** |
| **9950** | **dave_games.css** | **Rave overlay** | **Rave effect** |
| 9997 | matrix_theme.css | Vignette | Matrix effects |
| 9998 | matrix_theme.css, easter_egg | Scanlines, glitch overlays | Visual effects |
| 9999 | easter_egg.css, dave_games.css | Easter egg overlay, clap/fortune/sleep/music | Full-screen takeover |
| 10000 | styles.css, easter_egg | Modals, keyboard help, easter egg overlay | Critical modals |
| 10001 | styles.css, easter_egg | Error notification, help tooltip, static | Error/help overlays |
| **10010** | **matrix_theme.css** | **Matrix toast** | **Highest in codebase** |

### Issues Found

**SEVERITY: HIGH -- Gap between Dave alive (2600) and Dave games (9800)**
After audit #1 correctly reduced dave_alive from 99994-99998 to 2400-2600, dave_games.css was left at 9800-9999. This creates a massive unused gap (2601-9799) and means Dave game overlays sit at the same level as easter eggs and matrix effects. These should be consolidated into a coherent layer system.

**SEVERITY: MEDIUM -- Dave presence (1500) vs App modals (2000)**
Dave's eye sits at z-index 1500, but app modals (cloud storage, debug) sit at 2000. This means modals correctly cover Dave -- which is good. But Dave alive effects (2400-2600) sit ABOVE modals, meaning constellation effects and trail characters render on top of the cloud modal. This is likely a bug.

**SEVERITY: MEDIUM -- No formal layer system**
There is no documented z-index scale. Values were assigned ad hoc over time. The codebase would benefit from a defined layer map using CSS custom properties:

```css
:root {
  --z-base: 1;
  --z-tile-controls: 10;
  --z-tree: 90;
  --z-topbar: 100;
  --z-dropdown: 1000;
  --z-fullscreen: 1000;
  --z-overlay-controls: 1001;
  --z-tooltip: 1002;
  --z-dave-effects: 1400;
  --z-dave-presence: 1500;
  --z-dave-speech: 1501;
  --z-modal: 2000;
  --z-dave-alive: 2400; /* BUG: should be below modal */
  --z-game: 2500;
  --z-easter-egg: 3000;
  --z-critical-modal: 10000;
  --z-error: 10001;
}
```

**SEVERITY: LOW -- matrix_theme toast at 10010**
This is the highest z-index in the entire codebase, higher than error notifications. If both appear simultaneously, the matrix toast wins. Likely not intentional.

### Verdict

| Rating | Assessment |
|--------|-----------|
| **HIGH** | z-index architecture is ad hoc with a 7,200-value gap between Dave layers. Dave alive effects render above modals (bug). Games/easter-egg/matrix all compete at 9800-10010. Needs a formal custom property layer map. |

---

## Focus Area 3: Duplicate Rules

### Confirmed Duplicates in styles.css

**1. `.load-error` block -- SEVERITY: MEDIUM**
- First occurrence: lines 3101-3115 (under "Error state for failed asset loads")
- Second occurrence: lines 3431-3447 (under "Load error styles for tiles")
- Both define identical `display: flex`, `flex-direction: column`, `align-items: center`, `justify-content: center`, `height: 100%`, `color: #ff4444`
- The second block adds extra properties (padding, text-align) and its own `body:not(.dark-mode)` override at line 3475

**2. `.fullscreen-font-display` block -- SEVERITY: MEDIUM**
- First occurrence: line 1634 (`display: flex`, `flex-direction: column`, etc.)
- Second occurrence: line 3031 (`width: 90%`, `max-width`, etc.)
- Different properties but same selector -- should be merged into one block

**3. `#customTextModal .default-options` block -- SEVERITY: LOW**
- First occurrence: line 1814
- Second occurrence: line 1989 (under "All Caps toggle")
- Both define `display: flex` with flex-wrap and gap -- duplicated properties

**4. `#customTextModal .icon-button-group` block -- SEVERITY: LOW**
- First occurrence: line 1741
- Second occurrence: line 1951 (under "Preset Text Button Styles")
- Second adds `flex-wrap: wrap` but duplicates the flex display

**5. `.font-size-control` block -- SEVERITY: MEDIUM**
- First occurrence: line 1783 (scoped to `#customTextModal .font-size-control`)
- Second occurrence: line 1868 (bare `.font-size-control`)
- Third occurrence: line 3046 (bare `.font-size-control` again)
- Three definitions for the same concept with conflicting properties

### Cross-File Duplicates

No significant cross-file duplicates found. The Dave CSS files are well-isolated with distinct class name prefixes (`dave-`, `dav9000-`, `dave-debug-`, `dave-game-`).

### Verdict

| Rating | Assessment |
|--------|-----------|
| **MEDIUM** | 5 duplicate blocks in styles.css, concentrated in the font preview and error sections. These are symptoms of styles.css growing without refactoring. The `.load-error` and `.font-size-control` triples are the most confusing. No cross-file duplicates. |

---

## Focus Area 4: Unused CSS

**Note:** Without running the application and comparing against all JS/HTML references, this analysis identifies CSS classes that appear only in CSS files and are not found in any `.js` or `.html` file. This is a static analysis -- dynamically created classes may appear unused but be generated at runtime.

### Potentially Unused Selectors (requires verification)

I searched for class names defined in CSS that had zero references in the JS/HTML codebase. Due to the conversation's tool limitations, I performed a pattern-based analysis rather than an exhaustive cross-reference. The following categories are most likely to contain dead CSS:

**SEVERITY: MEDIUM -- Light mode overrides for features that may have been removed**
- `styles.css` has 219 `body:not(.dark-mode)` rules. If any parent component was removed from HTML/JS but its light-mode override remained, those rules are dead weight. The most suspect area is lines 2759-2822 (light mode for file format placeholders) -- these may be vestigial if placeholder rendering changed.

**SEVERITY: LOW -- Commented-out or vestigial animation keyframes**
- `styles.css` defines `@keyframes daveFeedbackFadeIn` (line 3996) and `@keyframes daveShake` (line 4039) -- these Dave-related animations live in the main stylesheet instead of a Dave CSS file, suggesting they were added before the Dave CSS split and may be duplicated.

**SEVERITY: LOW -- Inspector light mode block size**
- `model_inspector.css` has 120 `body:not(.dark-mode)` rules (lines 1652-2152, roughly 500 lines / 23% of the file). This is a massive light-mode section. If the inspector is rarely used in light mode, this is dead weight during normal usage.

### Verdict

| Rating | Assessment |
|--------|-----------|
| **LOW** | No obvious completely dead class blocks found in static analysis. The risk area is the 343 `body:not(.dark-mode)` overrides across 4 files -- if any parent components were removed, their light-mode counterparts linger. Recommend a runtime CSS coverage audit using Chrome DevTools. |

---

## Focus Area 5: Specificity Issues

### Over-Qualified Selectors

**SEVERITY: MEDIUM -- `body:not(.dark-mode)` pattern proliferation**
343 occurrences across 4 files. This selector adds specificity weight (0,2,1) to every light-mode rule. The pattern forces all dark-mode rules to either:
- Match that specificity (creating escalation), or
- Use `!important` (creating the warfare seen in matrix_theme.css)

Breakdown:
- styles.css: 219 occurrences
- model_inspector.css: 120 occurrences
- dave_mode.css: 2 occurrences
- dave_games.css: 2 occurrences

The correct architecture would be to set `--theme-*` variables on `body:not(.dark-mode)` (already done at lines 13-19 of styles.css) and then use those variables everywhere. Instead, many rules hardcode both dark and light values:

```css
/* Dark mode (implicit) */
.model-tile { background: #2a2a2a; }

/* Light mode (explicit, higher specificity) */
body:not(.dark-mode) .model-tile { background: #f5f5f5; }
```

If these used `var(--theme-surface)` instead, the `body:not(.dark-mode)` rule would be unnecessary.

**SEVERITY: LOW -- ID selectors in styles.css**
Several rules use `#customTextModal`, `#fullscreenOverlay`, `#modelInspectorPanel`, etc. ID selectors have specificity (1,0,0) which makes them hard to override. However, since these are unique UI panels, this is acceptable.

**SEVERITY: LOW -- Nesting depth**
No selector exceeds 3 levels of nesting. The deepest patterns are:
```css
body:not(.dark-mode) #customTextModal .icon-button-group button  /* (1,2,2) */
.dave-debug-section.collapsed .dave-debug-section-body           /* (0,3,0) */
```
These are within acceptable limits.

### Verdict

| Rating | Assessment |
|--------|-----------|
| **MEDIUM** | The `body:not(.dark-mode)` pattern is the primary specificity concern -- 343 rules that could largely be eliminated by expanding `--theme-*` custom property coverage. No egregious nesting or chaining issues. |

---

## Focus Area 6: CSS Custom Properties

### Current Variable System

**Defined in `:root` (styles.css lines 4-10):**
```css
--theme-bg: #121212;
--theme-surface: #2a2a2a;
--theme-text: #e0e0e0;
--theme-border: #444;
--theme-accent: #9b77ff;
```

**Defined in `:root` (dave_mode.css line 2):**
```css
--dave-green: #00ff41;
```

**Light mode overrides (styles.css lines 13-19):**
```css
--theme-bg: #ffffff;
--theme-surface: #f5f5f5;
--theme-text: #333333;
--theme-border: #e0e0e0;
--theme-accent: #7c5ccc;
```

### Usage Statistics

| Variable | References | Coverage |
|----------|-----------|----------|
| `--theme-bg` | Used in styles.css, model_inspector.css | Good |
| `--theme-surface` | Used in styles.css, model_inspector.css | Good |
| `--theme-text` | Used in styles.css, model_inspector.css | Good |
| `--theme-border` | Used in styles.css, model_inspector.css | Good |
| `--theme-accent` | Used in styles.css, model_inspector.css | Good |
| `--dave-green` | Used in all Dave CSS files | Excellent |

Total `var(--` references: 362 across 7 files. This is healthy adoption.

### Values That SHOULD Become Variables

**SEVERITY: HIGH -- Hardcoded colors in styles.css**
315 occurrences of hardcoded hex colors in styles.css (e.g., `#333`, `#444`, `#555`, `#888`, `#e0e0e0`, `#f5f5f5`, `#2a2a2a`, `#121212`). Many of these are the same values as `--theme-*` variables but used as raw hex instead of `var()` references. This is why 219 `body:not(.dark-mode)` rules exist -- each hardcoded color needs a manual light-mode override.

**Recommended new variables:**
```css
:root {
  /* Existing */
  --theme-bg: #121212;
  --theme-surface: #2a2a2a;
  --theme-text: #e0e0e0;
  --theme-border: #444;
  --theme-accent: #9b77ff;

  /* Proposed additions */
  --theme-text-secondary: #aaa;      /* Used ~40 times as #aaa, #999, #888 */
  --theme-text-muted: #666;          /* Used ~25 times */
  --theme-surface-hover: #333;       /* Used ~30 times as hover backgrounds */
  --theme-surface-active: #444;      /* Used ~20 times */
  --theme-danger: #ff4444;           /* Used ~15 times for errors */
  --theme-success: #4CAF50;          /* Used ~8 times */
  --theme-scrollbar-track: #1a1a1a;  /* Used ~10 times */
  --theme-scrollbar-thumb: #555;     /* Used ~10 times */
  --theme-shadow: rgba(0,0,0,0.3);   /* Used ~20 times */
  --theme-overlay: rgba(0,0,0,0.85); /* Used ~10 times */
}
```

This would eliminate ~180 of the 219 `body:not(.dark-mode)` rules in styles.css and ~100 in model_inspector.css.

**SEVERITY: MEDIUM -- DAV-9000 terminal has its own color system**
dav9000_terminal.css uses 44 `var(--` references, all to `--dave-green` and custom `--dav-x`/`--dav-y` positioning variables. But it also hardcodes `#0a0e0a`, `#001a00`, `#00ff41` in multiple places. These should reference `--dave-green` with `color-mix()` for darker shades.

**SEVERITY: LOW -- Animation timing values**
Multiple files repeat timing values (`0.3s ease`, `0.2s ease`, `0.15s ease`). These are consistent enough to suggest a timing variable system, but the benefit is marginal.

### Verdict

| Rating | Assessment |
|--------|-----------|
| **HIGH** | The `--theme-*` variable system exists and works well where used, but adoption is only ~40%. 315 hardcoded colors in styles.css alone drive the 219 `body:not(.dark-mode)` overrides. Expanding to ~10 more theme variables would dramatically reduce code volume and eliminate most light-mode specificity warfare. |

---

## Focus Area 7: Animation Performance

### Total Animations

93 `@keyframes` definitions across 8 files:
- dav9000_terminal.css: 27 (alive animations, glitch, transitions)
- dave_alive.css: 16 (constellation, radar, trails, hearts)
- dave_games.css: 22 (rave, dance moves, fortune, sleep, music)
- dave_mode.css: 17 (bounce, glow, reactions, bubble)
- easter_egg.css: 11 (glitch, CRT boot/shutdown, static)
- styles.css: 5 (tile appear, slide in/out, feedback, shake)
- matrix_theme.css: 2 (flicker, dot pulse)

### GPU-Composited vs Layout-Triggering

**GOOD -- Majority use transform + opacity**
Most animations correctly use only `transform` and `opacity`, which are GPU-composited and run on the compositor thread:
- All Dave bounce/hop/nudge/attention animations: `transform` only
- All DAV-9000 alive animations: `transform` only (with `will-change: transform`)
- Tile appear: `transform + opacity`
- Dave trail/constellation particles: `transform + opacity`

**SEVERITY: MEDIUM -- `filter` in animations (60+ keyframe uses)**

The following animations use `filter:` which triggers layout/paint:

| File | Animation | filter Property | Frequency |
|------|-----------|----------------|-----------|
| dave_games.css | `daveRaveHue` | `hue-rotate()` | Continuous loop |
| dave_alive.css | `.dave-alive-moving .dave-presence-eye` | `brightness(1.15)` | During movement |
| dave_alive.css | `.dave-puppet-mode .dave-presence-eye` | `brightness(1.3)` | During puppet mode |
| dave_alive.css | `.dave-constellation-line` | `drop-shadow()` | During constellation |
| dave_mode.css | `dave-bubble-glitch` | `hue-rotate()` | 6-frame keyframe |
| dav9000_terminal.css | `dav9000-glitch` | `hue-rotate()` | 6-frame keyframe |
| dav9000_terminal.css | `dav9000-takeoverGlitch` | `hue-rotate() + brightness()` | Transition effect |
| dav9000_terminal.css | `dav9000-takeoverEnter` | `brightness() + hue-rotate()` | Transition effect |
| easter_egg.css | `page-glitch` | `hue-rotate() + invert() + contrast() + saturate()` | 23-frame keyframe |
| easter_egg.css | `pc-flash-in` | `brightness() + blur() + saturate()` | Boot effect |
| easter_egg.css | `crt-boot` / `crt-shutdown` | `brightness()` | CRT effects |
| styles.css | audio light mode | `invert(1) hue-rotate(180deg)` | Static (not animated) |

**Assessment:** The `filter` usage falls into two categories:
1. **Glitch/transition effects** (dav9000, easter_egg): These are short-duration, one-shot effects. Performance impact is negligible.
2. **Continuous effects** (daveRaveHue, dave-alive-moving brightness): These run for extended periods and WILL cause paint on every frame. The rave `hue-rotate()` loop is the worst offender -- it runs continuously on the entire rave overlay.

**Fix for rave:** Replace `filter: hue-rotate()` on the overlay with a CSS animation that cycles `background-color` through specific hue values, or use `mix-blend-mode` on a rotating gradient.

**Fix for alive movement brightness:** Replace `filter: brightness(1.15)` with `opacity: 0.85` combined with a brighter base color, or accept the paint cost since it only affects a single small element (the eye).

**SEVERITY: LOW -- `will-change` usage**
14 declarations, all appropriate:
- `will-change: transform` on DAV-9000 terminal (correct -- draggable)
- `will-change: transform, opacity` on particles and game elements (correct -- animated)
- `will-change: opacity` on fading elements (correct)

No `will-change` on elements that don't animate. No `will-change: auto` misuse. This is well-managed.

**SEVERITY: LOW -- `backdrop-filter: blur()`**
Used in 8 places (dave_mode speech bubble, model_inspector panels, cloud modal, help tooltip, matrix theme). These trigger compositing and can be expensive on large blurred areas. All current usages are on relatively small overlays, so impact is acceptable.

### Verdict

| Rating | Assessment |
|--------|-----------|
| **MEDIUM** | Animation performance is generally good. The majority of animations use GPU-composited properties. The main concern is `filter:` in continuous animations (rave hue-rotate, alive brightness). One-shot glitch effects using `filter` are acceptable. `will-change` is used correctly. |

---

## Focus Area 8: styles.css Decomposition (5,780 lines)

### Current Logical Sections

I identified **35 distinct sections** within styles.css. Here is a proposed extraction plan:

| Lines | Section | Proposed File | Lines Saved |
|-------|---------|--------------|-------------|
| 1-33 | Theme variables + reset | **Keep in styles.css** (foundation) | 0 |
| 35-158 | Top bar + logo + search | **Keep in styles.css** (core layout) | 0 |
| 160-298 | Controls (file/page/buttons) | **Keep in styles.css** (core layout) | 0 |
| 301-593 | Settings dropdown + gear | `settings_dropdown.css` | ~290 |
| 595-629 | Pagination + filter toggles | **Keep in styles.css** | 0 |
| 631-915 | Dropdown menus | `dropdowns.css` | ~285 |
| 917-976 | Size controls | **Keep in styles.css** | 0 |
| 978-1267 | Viewer grid + tiles + 3D/video/audio | `viewer_grid.css` | ~290 |
| 1311-1529 | Fullscreen viewer | `fullscreen_viewer.css` | ~220 |
| 1530-1651 | Font preview (fullscreen) | `font_preview.css` | ~120 |
| 1653-2030 | Modals (customText, generic) | `modals.css` | ~380 |
| 2032-2723 | Tree folder view | `tree_folder_view.css` (already has viewer JS) | ~690 |
| 2725-2857 | Drag and drop + light mode | **Keep in styles.css** | 0 |
| 2859-2970 | File format placeholders + image controls | **Keep in styles.css** | 0 |
| 3046-3120 | Font size controls (duplicate area) | Merge into `font_preview.css` | ~75 |
| 3121-3323 | Keyboard help overlay | `keyboard_help.css` | ~200 |
| 3325-3482 | Error notifications | `notifications.css` | ~160 |
| 3484-3874 | Help tooltip | `help_tooltip.css` | ~390 |
| 3876-4127 | Talk to Dave feedback | Move to `dave_mode.css` | ~250 |
| 4128-4472 | Text file preview | `text_preview.css` | ~345 |
| 4474-5027 | Cloud storage UI | `cloud_storage.css` | ~555 |
| 5028-5400 | Settings modal | `settings_modal.css` | ~370 |
| 5509-5588 | Theme swatches | Merge into `settings_modal.css` | ~80 |
| 5590-5750 | Release log | Merge into `settings_modal.css` | ~160 |
| 5756-5780 | Welcome message | **Keep in styles.css** | ~25 |

### Recommended Priority Extraction (SEVERITY: HIGH)

**Phase 1 -- Biggest wins, lowest risk:**
1. `tree_folder_view.css` (~690 lines) -- Self-contained, already has its own JS module
2. `cloud_storage.css` (~555 lines) -- Self-contained feature area
3. `help_tooltip.css` (~390 lines) -- Self-contained overlay
4. `settings_modal.css` (~610 lines, including swatches + release log) -- Self-contained modal
5. `text_preview.css` (~345 lines) -- Self-contained viewer

**Phase 1 savings: ~2,590 lines (45% of styles.css)**

**Phase 2 -- Medium effort:**
6. `modals.css` (~380 lines) -- Generic modal styles
7. `dropdowns.css` (~285 lines) -- Dropdown menu system
8. `settings_dropdown.css` (~290 lines) -- Gear dropdown
9. `viewer_grid.css` (~290 lines) -- Grid tiles and media viewers
10. Move "Talk to Dave feedback" (~250 lines) into `dave_mode.css`

**Phase 2 savings: ~1,495 lines (26% more)**

**After both phases, styles.css would be ~1,695 lines** -- a 71% reduction. The file would contain only: theme variables, reset, top bar layout, controls, pagination, size controls, drag/drop, file format placeholders, and the welcome message.

### Verdict

| Rating | Assessment |
|--------|-----------|
| **CRITICAL** | styles.css at 5,780 lines is the single biggest maintainability problem. It contains 35+ unrelated sections. Phase 1 extraction of 5 files would cut it by 45% with low risk. The tree folder view (690 lines) and cloud storage (555 lines) are the easiest wins. |

---

## Focus Area 9: Media Queries / Responsive Design

### Current State

**17 `@media` queries across 4 files:**

| File | Query | Lines | What it does |
|------|-------|-------|-------------|
| styles.css | `max-width: 1200px` | 59, 146 | TopBar flex-wrap, logo hide |
| styles.css | `max-width: 768px` | 78, 152, 262, 290, 686, 934, 1516, 2012, 2709, 4107 | 10 breakpoints |
| model_inspector.css | `max-width: 768px` | 98 | Inspector toolbar mobile |
| dave_mode.css | `max-width: 768px` | 859 | Dave eye smaller on mobile |
| dav9000_terminal.css | `max-width: 700px` | 514 | Terminal smaller on mobile |
| easter_egg.css | `max-width: 768px` | 688 | CRT screen smaller |
| easter_egg.css | `max-height: 600px` | 704 | CRT height constraint |

### Analysis

**SEVERITY: MEDIUM -- Desktop-first approach, mobile is afterthought**

The application uses a desktop-first pattern. All base styles target desktop, and `max-width` queries reduce/hide elements for smaller screens. This is the opposite of modern mobile-first best practice, but is appropriate for this application since it's a desktop asset viewer that would have limited mobile utility (no filesystem access, 3D viewer needs mouse).

**SEVERITY: LOW -- Inconsistent breakpoints**
Two breakpoint values are used: `768px` (14 times) and `1200px` (2 times). There's one outlier at `700px` (dav9000_terminal.css). The 768px and 1200px are standard tablet/desktop breakpoints. The 700px is close enough to 768px to be confusing.

**SEVERITY: LOW -- Missing responsive styles for Dave systems**
Only dave_mode.css and dav9000_terminal.css have mobile breakpoints. The following Dave files have NO responsive styles:
- dave_alive.css (0 `@media` queries) -- alive behaviors could overflow on mobile
- dave_games.css (0 `@media` queries) -- snake/breakout games have no mobile adaptation
- dave_debug.css (0 `@media` queries) -- debug panel is `min-width: 360px` but no responsive layout
- matrix_theme.css (0 `@media` queries) -- matrix overlay has no mobile adaptation

**SEVERITY: LOW -- No touch-specific styles**
No `@media (hover: none)` or `@media (pointer: coarse)` queries exist. Touch targets are not enlarged for touch devices. However, since this is primarily a desktop application, this is acceptable.

### Verdict

| Rating | Assessment |
|--------|-----------|
| **LOW** | Responsive design is minimal but appropriate for a desktop-first asset viewer. The 768px breakpoint is consistently used. Dave game systems lack mobile breakpoints entirely, but games are inherently desktop-focused (keyboard controls for snake/breakout). The 700px outlier in dav9000 should align to 768px. |

---

## Summary Table

| # | Focus Area | Severity | Key Finding |
|---|-----------|----------|-------------|
| 1 | `!important` (149) | **HIGH** | matrix_theme.css (54) is fixable via custom property overrides. dave_mode.css (33) needs specificity restructuring. |
| 2 | z-index (37+ values) | **HIGH** | 7,200-value gap between Dave layers. Alive effects (2400-2600) render above modals (2000). No formal layer system. |
| 3 | Duplicate rules | **MEDIUM** | 5 duplicate blocks in styles.css (`.load-error`, `.fullscreen-font-display`, `.font-size-control`, 2x `#customTextModal`). |
| 4 | Unused CSS | **LOW** | No confirmed dead blocks. 343 `body:not(.dark-mode)` rules are the risk area. Runtime coverage audit recommended. |
| 5 | Specificity | **MEDIUM** | 343 `body:not(.dark-mode)` selectors drive specificity inflation. Expanding theme variables would eliminate most. |
| 6 | Custom properties | **HIGH** | System exists but adoption is ~40%. 315 hardcoded colors in styles.css alone. ~10 new variables would eliminate 180+ light-mode overrides. |
| 7 | Animation performance | **MEDIUM** | 93 keyframes, mostly GPU-composited. Rave `hue-rotate()` loop is worst offender. `will-change` is well-managed. |
| 8 | styles.css split | **CRITICAL** | 5,780 lines with 35 sections. Phase 1 extraction of 5 files saves 45%. Tree view (690) and cloud storage (555) are easiest wins. |
| 9 | Responsive / media | **LOW** | Desktop-first is appropriate. 768px breakpoint consistently used. Dave games lack mobile styles but are keyboard-driven. |

---

## Recommended Action Priority

### P0 -- Before next feature work
1. Merge the 5 duplicate rule blocks in styles.css (30 min)
2. Fix dave_alive z-index to sit below modals (2000) -- move from 2400-2600 to 1700-1900 (15 min)

### P1 -- This sprint
3. Extract `tree_folder_view.css` from styles.css (690 lines)
4. Extract `cloud_storage.css` from styles.css (555 lines)
5. Extract `settings_modal.css` from styles.css (610 lines with swatches + release log)
6. Add 5-6 new `--theme-*` variables (`--theme-text-secondary`, `--theme-surface-hover`, `--theme-danger`, `--theme-success`, `--theme-overlay`)
7. Convert matrix_theme.css to use `--theme-*` variable overrides (eliminates ~40 of 54 `!important`)

### P2 -- Next sprint
8. Extract remaining Phase 2 files from styles.css (modals, dropdowns, viewers)
9. Create formal z-index layer map with CSS custom properties
10. Migrate styles.css hardcoded colors to theme variables (target: eliminate 150+ of 219 light-mode rules)
11. Move "Talk to Dave feedback" (lines 3876-4127) from styles.css to dave_mode.css
12. Reduce dave_games.css z-index from 9800-9999 to a sane range (2700-2900)
13. Replace rave `filter: hue-rotate()` loop with non-filter alternative

### P3 -- Future
14. Full `body:not(.dark-mode)` elimination campaign (target: reduce 343 to <50)
15. Runtime CSS coverage audit to identify truly dead rules
16. Align dav9000_terminal.css 700px breakpoint to 768px
17. Consider CSS `@layer` for theme override isolation (eliminates remaining `!important`)

---

*Audit performed by Claude Code -- CSS Health Audit #2*
*Total files analyzed: 9 | Total lines: 11,856 | Total issues: 26 findings across 9 focus areas*
