# Dave - HTML Structure & Loading Performance Audit
**Date:** 2026-02-14
**Scope:** `index.html`, CSS/JS loading chain, CDN dependencies, accessibility, security
**Branch:** `feature/full-dave-mode`

---

## 1. Script Loading Order

### Findings

**Inline theme script (lines 10-33):** Correctly placed in `<head>` before any CSS to prevent FOUC (Flash of Unstyled Content). This is an intentional and good pattern -- it reads from `localStorage` and applies theme CSS custom properties before first paint.

**Import map (lines 36-43):** Correctly declared before any `type="module"` scripts. This is required by the spec.

**Google Identity Services (line 58):** Uses `async defer` -- good, non-blocking.

**Counter.dev analytics (line 60):** **PROBLEM.** This script is loaded synchronously in the `<head>` with NO `async` or `defer` attribute:
```html
<script src="https://cdn.counter.dev/script.js" data-id="..." data-utcoffset="2"></script>
```
This is render-blocking. If `cdn.counter.dev` is slow or down, it will delay the entire page render. Additionally, the Help & About section claims "No server uploads, no tracking, no cookies, no analytics" while this script is actively tracking. The separate `src/scripts/analytics.js` file also implements tracking but respects `doNotTrack` -- the CDN script does not.

**Main application module (line 483):** `<script type="module" src="src/core/main.js">` at the bottom of `<body>`. Module scripts are deferred by default, so placement at the end is fine but not strictly necessary.

**Inline body script (line 63):**
```html
<script>if(localStorage.getItem('dave_theme')==='matrix')document.body.classList.add('matrix-theme');</script>
```
Small inline script, acceptable for preventing theme flash. However, this is a second theme-related inline script (the first is in head). These two pieces of theme logic are separated, which makes the theme initialization harder to reason about.

**model-viewer loaded on-demand (lines 501-506, 901-904):** Dynamically injected script for `@google/model-viewer`. This is loaded lazily only when a GLB file is encountered. Good pattern. However, it is loaded from `unpkg.com` with NO version pin:
```js
script.src = 'https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js';
```
This will fetch the latest version, which is a significant risk for breaking changes.

### Recommendations
1. Add `async` to the Counter.dev script, or remove it entirely given the privacy claims.
2. Pin `@google/model-viewer` to a specific version (e.g., `@google/model-viewer@2.2.0`).
3. Merge the two inline theme scripts into a single head script.

---

## 2. CSS Loading

### File Inventory (9 files, ~281 KB total uncompressed)

| File | Size | Purpose |
|------|------|---------|
| `styles.css` | 118.7 KB (5,789 lines) | Main application styles |
| `model_inspector.css` | 42.1 KB | 3D model inspector panel |
| `dave_mode.css` | 31.8 KB | Dave personality layer |
| `dave_alive.css` | 21.8 KB | Dave alive animations |
| `dav9000_terminal.css` | 17.1 KB | DAV-9000 terminal system |
| `dave_games.css` | 16.1 KB | Snake, Breakout, Music UI |
| `easter_egg.css` | 16.7 KB | Easter egg styles |
| `dave_debug.css` | 8.9 KB | Debug dashboard |
| `matrix_theme.css` | 8.1 KB | Matrix theme override |

### Findings

**All 9 CSS files are loaded in `<head>` as render-blocking `<link>` tags.** Every single one blocks first paint, including files for features that most users will never encounter on first load (games, debug panel, matrix theme, DAV-9000 terminal, easter eggs).

**Load order issue:** `model_inspector.css` is loaded BEFORE `styles.css` (line 8 vs line 48). If any selectors in the inspector CSS depend on cascade from the main styles, they could fail. More importantly, it means the browser starts parsing inspector styles before the core app styles.

**No CSS `@import` chains:** Good -- all CSS is loaded via HTML `<link>` tags, avoiding cascading import waterfalls.

**No CSS minification or concatenation:** Expected for a no-build project, but the total is substantial.

### Recommendations
1. Move `model_inspector.css` after `styles.css` for correct cascade order.
2. Consider lazy-loading non-critical CSS via JavaScript or `media="print" onload="this.media='all'"` pattern for: `dave_games.css`, `dave_debug.css`, `matrix_theme.css`, `easter_egg.css`, `dav9000_terminal.css`.
3. The main `styles.css` at 118 KB / 5,789 lines would benefit from splitting into critical (above-the-fold) and non-critical sections.

---

## 3. CDN Dependencies

### Complete External Resource Inventory

| Resource | URL | Versioned? | Fallback? |
|----------|-----|-----------|-----------|
| Three.js core | `unpkg.com/three@0.161.0/build/three.module.js` | Yes (0.161.0) | No |
| Three.js addons | `unpkg.com/three@0.161.0/examples/jsm/*` | Yes (0.161.0) | No |
| Font Awesome | `cdnjs.cloudflare.com/.../font-awesome/6.0.0-beta3/css/all.min.css` | Yes (beta3) | No |
| Google model-viewer | `unpkg.com/@google/model-viewer/dist/model-viewer.min.js` | **NO** | No |
| Google Identity Services | `accounts.google.com/gsi/client` | N/A (Google-managed) | No |
| Counter.dev | `cdn.counter.dev/script.js` | No | No |

### Findings

**Font Awesome 6.0.0-beta3:** Using a beta version from 2021. Font Awesome is now at 6.5+. Beta versions can have breaking changes and may eventually be removed from CDNs.

**unpkg.com as sole CDN:** Three.js, model-viewer all depend on unpkg.com. If unpkg goes down, the entire 3D viewing capability breaks. No SRI (Subresource Integrity) hashes on any CDN resource.

**No `<link rel="preconnect">` or `<link rel="dns-prefetch">`:** The page connects to at least 4 external origins:
- `unpkg.com`
- `cdnjs.cloudflare.com`
- `accounts.google.com`
- `cdn.counter.dev`

Without preconnect hints, each first request incurs DNS + TCP + TLS overhead.

**Three.js import map is correctly configured.** It maps both `three` (core) and `three/addons/` (examples) to versioned URLs. The addons are loaded on-demand via dynamic `import()` in the inspector code -- good pattern.

### Recommendations
1. Upgrade Font Awesome from 6.0.0-beta3 to a stable release.
2. Pin `@google/model-viewer` to a specific version.
3. Add SRI integrity hashes for all CDN scripts/stylesheets.
4. Add `<link rel="preconnect" href="https://unpkg.com">` and similar for other CDN origins.
5. Consider hosting critical CDN assets locally as fallback, especially Three.js core.

---

## 4. HTML Structure

### DOM Analysis

**Document structure:** The page is a single-page app with clear functional zones:
- `#topBar` (sticky nav with controls)
- `#treeFolderPanel` (side panel)
- `#cloudPathBar` (breadcrumb)
- `#viewerContainer` (main grid)
- `#fullscreenOverlay` (modal viewer with inspector)
- `#customTextModal` (font settings modal)

**Semantic HTML issues:**
- `#topBar` is a `<div>` -- should be `<header>` or `<nav>`.
- Dropdown menus use `<label>` elements (e.g., `<label class="source-option">`) for clickable menu items. Labels are semantically for form inputs, not menu actions. These should be `<button>` elements.
- `#viewerContainer` has no semantic element or ARIA role.
- The fullscreen overlay has no `role="dialog"` or `aria-modal="true"`.
- `#customTextModal` is a generic `<div class="modal">` with no dialog semantics.

**Accessibility (ARIA):**
- Only ONE element has ARIA attributes in the entire HTML: `<div id="folderTreeContainer" role="tree" aria-label="File and folder structure">`.
- No `aria-label` on the search input, navigation buttons, or any dropdown menus.
- No `aria-expanded` on any dropdown toggles.
- No `aria-selected` or `aria-checked` on filter/sort options.
- No skip-to-content link.
- Focus management: Only `:focus` styles exist for `.search-input`, `.close-button`, and `.settings-field input`. No visible focus indicators on navigation buttons, toolbar buttons, or dropdown items.
- No `tabindex` attributes declared in the HTML.

**Unnecessary wrapper divs:** Moderate. The structure is reasonably flat, but `#fullscreenViewerWrap` wrapping `#fullscreenViewer` seems redundant, and the icon buttons use `<i>` tags inside buttons which is fine for Font Awesome convention.

**Inline styles:** Several elements use `style="display:none"` (lines 334, 345, 356, 396, 407, 477, 487). This is a common pattern for initially hidden elements but makes it harder to override with CSS classes. The fullscreen overlay uses `style="opacity: 0"` which could be a CSS class.

**Inline styles in filter options (lines 162-201):** Each filter option has hardcoded `style="color: #..."` attributes. These should be CSS classes.

### Recommendations
1. Use semantic elements: `<header>`, `<nav>`, `<main>`, `<dialog>`.
2. Replace `<label>` menu items with `<button>` elements.
3. Add `role="dialog"` and `aria-modal="true"` to modals.
4. Add `aria-expanded`, `aria-label`, and keyboard navigation to all dropdowns.
5. Add visible focus indicators for all interactive elements.
6. Replace inline `style="color:..."` on filter options with CSS classes.
7. Add a skip-to-content link.

---

## 5. Import Map Analysis

```json
{
  "imports": {
    "three": "https://unpkg.com/three@0.161.0/build/three.module.js",
    "three/addons/": "https://unpkg.com/three@0.161.0/examples/jsm/"
  }
}
```

**Correctly configured.** The map provides:
- Bare specifier `three` -> core module
- Prefix mapping `three/addons/` -> examples directory

**Usage across the codebase (all legitimate):**
- `asset_loading.js`: `import * as THREE from 'three'` + OrbitControls + FBXLoader
- `viewer_fbx.js`: `import * as THREE from 'three'` + OrbitControls + FBXLoader
- `model_inspector_glb.js`: `import * as THREE from 'three'` + dynamic VertexNormalsHelper
- `model_inspector_fbx.js`: `import * as THREE from 'three'` + dynamic VertexNormalsHelper
- `model_inspector.js`: dynamic `import('three')` + GLTFExporter + SimplifyModifier + BufferGeometryUtils

**Duplication concern:** Both `asset_loading.js` and `viewer_fbx.js` import THREE + OrbitControls + FBXLoader. Since ES modules are cached, this does not cause duplicate downloads, but it does mean the FBX pipeline code is split across two files.

**No unused imports detected** in the import map itself.

---

## 6. Initial Load Cost Estimate

### HTTP Requests on First Load

| Category | Count | Estimated Size |
|----------|-------|---------------|
| HTML | 1 | ~22 KB |
| CSS (9 files) | 9 | ~281 KB |
| Font Awesome CSS + fonts | ~3-5 | ~100 KB (CSS) + ~150 KB (woff2 fonts) |
| JS: main.js + module tree | ~30-35 | ~750 KB |
| Three.js core | 1 | ~600 KB |
| Three.js addons (OrbitControls + FBXLoader) | ~3-5 | ~200 KB |
| Google Identity Services | 1 | ~80 KB |
| Counter.dev | 1 | ~5 KB |
| Favicon | 1 | ~5 KB |
| **TOTAL** | **~50-58** | **~2.2 MB** |

### Critical Path Analysis

The render-blocking chain is:
1. HTML parse begins
2. Inline theme script executes (fast, localStorage only)
3. Counter.dev script blocks (network fetch, NO async/defer)
4. 9 CSS files must all download and parse before first paint
5. Font Awesome CSS triggers font file downloads
6. `main.js` module begins loading, triggering its entire import tree

**Estimated Time to First Meaningful Paint (3G):** 4-6 seconds
**Estimated Time to First Meaningful Paint (broadband):** 1.5-2.5 seconds

The biggest bottlenecks are:
1. 9 render-blocking CSS files (~281 KB)
2. Three.js core (~600 KB) loaded eagerly via `asset_loading.js` even before any 3D content is needed
3. The synchronous Counter.dev script

---

## 7. Web Worker Analysis

**File:** `src/workers/folder_scanner_worker.js` (7.2 KB)

### Pattern Review

**Correct aspects:**
- Worker is created with `new Worker(baseUrl)` without `{ type: 'module' }` -- correct, since the worker uses `self.onmessage` and `self.postMessage` (classic worker pattern).
- File type detection is duplicated inline (necessary since classic workers cannot import ES modules).
- Streaming results pattern: worker posts `fileFound` messages as each file is discovered, not waiting for full scan. Good for perceived performance.
- Clean `scanComplete` message at the end.

**Issues found:**

1. **Worker path resolution (lines 369-371 of asset_loading.js):**
```js
const baseUrl = window.location.pathname.includes('/Dave/')
  ? '/Dave/src/workers/folder_scanner_worker.js'
  : '/src/workers/folder_scanner_worker.js';
```
This is brittle. It only handles two deployment scenarios (root and `/Dave/` subdirectory). Any other deployment path (e.g., `/apps/Dave/`, a different subdirectory) would break the worker.

2. **No worker termination:** After `scanComplete`, the worker is not explicitly terminated with `worker.terminate()`. If multiple folder scans are triggered, multiple workers could accumulate.

3. **Error handling gap:** If `scanDirectory` throws, the catch block in `self.onmessage` (lines 157-167) does NOT send `scanComplete` or `scanError`. The main thread could be left waiting indefinitely.

4. **File type mapping duplication:** The `FILE_TYPE_MAPPINGS` object in the worker is a copy of `fileTypeDetector.js`. If one is updated and the other is not, they drift. Consider generating the worker from a shared source or using a module worker in browsers that support it.

### Recommendations
1. Use `new URL('./workers/folder_scanner_worker.js', import.meta.url).href` for robust path resolution.
2. Call `worker.terminate()` after scan completion.
3. Ensure the error catch block always sends a final status message.
4. Add a comment referencing `fileTypeDetector.js` as the canonical source.

---

## 8. Mobile Responsiveness

### Viewport Configuration
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```
**Present and correct.** However, no `minimum-scale` or `maximum-scale` is set. This is fine for accessibility (allows pinch-zoom).

### Media Queries
Found 17 `@media` rules across the codebase:
- `styles.css`: 12 rules (breakpoints at 768px and 1200px)
- `dav9000_terminal.css`: 1 rule (700px)
- `dave_mode.css`: 1 rule (768px)
- `model_inspector.css`: 1 rule (768px)
- `easter_egg.css`: 2 rules (768px, 600px height)

**All use desktop-first approach** (`max-width`). This means the full desktop CSS is parsed first, then overridden for mobile. Mobile-first (`min-width`) would be more efficient for mobile devices.

### Touch Event Handling
Minimal touch support found:
- `ui.js`: `touchstart`/`touchend` on size slider only
- `dave_mode.js`: `touchstart`/`touchmove`/`touchend` for Dave presence dragging

**Missing touch handling:**
- No touch/swipe for fullscreen navigation (prev/next)
- No touch handling for tree folder panel resize
- No touch handling for dropdown menus
- Grid tiles rely on mouse events only

### Recommendations
1. Add swipe gestures for fullscreen prev/next navigation.
2. Ensure all dropdown menus are usable on touch devices (hover-based open is mouse-only).
3. Test tree panel resizer on touch devices.

---

## 9. Security

### Inline Scripts
Two inline scripts exist:
1. **Head theme script (lines 10-33):** Reads `localStorage`, applies CSS properties. Low risk -- no user-controlled data is inserted into the DOM.
2. **Body matrix theme script (line 63):** Simple `classList.add`. No risk.

**CSP impact:** Both inline scripts would require `'unsafe-inline'` or nonces in a Content-Security-Policy. The project has no CSP configured.

### innerHTML Usage (XSS Surface)

**181 instances of `innerHTML` across 23 files.** This is the primary XSS attack surface.

**High-risk patterns in `asset_loading.js`:**
```js
// Line 600: Uses file extension directly
audioHeader.innerHTML = '<i class="fa fa-music"></i> ' + ext;

// Line 804: File info display
fileInfo.innerHTML = `...`

// Line 427: Error messages with user content
viewerContainer.innerHTML = `...Critical worker error: ${error.message}...`;
```

The `ext` variable comes from file names. If a malicious file name contains HTML/JS (e.g., a file named `song<img src=x onerror=alert(1)>.mp3`), it could execute. However, the attack vector is limited because:
- Files come from the user's own filesystem (File System Access API) or cloud storage
- The user explicitly selects what to load
- There is no URL-based file loading from untrusted sources

**Other innerHTML patterns:** Most are template literals with Font Awesome icons or static content. The `helpTooltip.js` and `SettingsModal.js` files use `innerHTML` extensively for building UI, but with static HTML strings.

### model-viewer dynamic script injection
```js
const script = document.createElement('script');
script.src = 'https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js';
document.head.appendChild(script);
```
This pattern appears 4 times across 2 files. Without SRI, a compromised unpkg could serve malicious code.

### Counter.dev Analytics
The CDN script (`cdn.counter.dev/script.js`) runs in the page context with full DOM access. If this CDN is compromised, it has access to everything. The local `analytics.js` is a safer approach (tracking pixel only, respects DoNotTrack).

### Recommendations
1. Replace `innerHTML` with `textContent` + `createElement` where user-controlled data is interpolated (especially file names and error messages).
2. Add SRI hashes to all CDN scripts.
3. Prepare for CSP by consolidating inline scripts and using nonces.
4. Remove or replace the Counter.dev CDN script with the local analytics.js approach.
5. Consider using a DOMPurify library if rich HTML insertion from external data is needed.

---

## Summary: Priority Matrix

### Critical (Should fix)
| # | Issue | Impact |
|---|-------|--------|
| 1 | Counter.dev script is render-blocking (no async/defer) | First paint delay |
| 2 | model-viewer loaded without version pin | Breaking changes risk |
| 3 | Font Awesome using beta version (6.0.0-beta3) | Stability/removal risk |
| 4 | Worker path resolution is brittle | Breaks on non-standard deployments |

### High (Should plan)
| # | Issue | Impact |
|---|-------|--------|
| 5 | 9 render-blocking CSS files (~281 KB) | First paint blocked |
| 6 | Three.js loaded eagerly (~600 KB) even for non-3D use | Wasted bandwidth |
| 7 | No preconnect hints for 4 external CDN origins | Connection latency |
| 8 | 181 innerHTML usages with some user-data interpolation | XSS surface |
| 9 | No SRI hashes on any CDN resource | Supply chain risk |
| 10 | Worker never terminated after scan | Memory leak potential |

### Medium (Should improve)
| # | Issue | Impact |
|---|-------|--------|
| 11 | Almost zero ARIA attributes (1 element) | Accessibility failure |
| 12 | No focus indicators on most interactive elements | Keyboard nav unusable |
| 13 | Labels used as clickable menu items | Semantic HTML violation |
| 14 | No dialog semantics on modals | Screen reader unusable |
| 15 | Desktop-first CSS approach | Mobile parse overhead |
| 16 | No touch/swipe for fullscreen navigation | Mobile UX gap |
| 17 | model_inspector.css loaded before styles.css | Cascade order wrong |
| 18 | Two separate inline theme scripts | Maintainability |
| 19 | Privacy claims vs actual analytics tracking | User trust |

### Low (Nice to have)
| # | Issue | Impact |
|---|-------|--------|
| 20 | Inline styles on filter options | Maintainability |
| 21 | File type mapping duplication (worker vs fileTypeDetector.js) | Drift risk |
| 22 | Fullscreen overlay uses inline `style="opacity:0"` | CSS class preferred |
| 23 | No CSS minification | File size (mitigated by gzip) |

---

## Estimated Total Payload

| Category | Raw Size | Gzipped (est.) |
|----------|----------|----------------|
| HTML | 22 KB | 6 KB |
| CSS (9 local files) | 281 KB | ~45 KB |
| JS (46 local files) | 812 KB | ~150 KB |
| Three.js core | 600 KB | ~150 KB |
| Three.js addons (eager) | ~200 KB | ~50 KB |
| Font Awesome | ~250 KB | ~70 KB |
| External scripts (GIS, counter.dev) | ~85 KB | ~25 KB |
| **Total initial load** | **~2.25 MB** | **~496 KB** |

The gzipped total of ~496 KB exceeds the 200 KB performance budget target but is within acceptable range for a feature-rich asset viewer. The biggest optimization opportunity is deferring Three.js (~200 KB gzipped) until 3D content is actually encountered.
