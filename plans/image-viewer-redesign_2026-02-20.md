# Image Viewer Redesign

## Context

The current full image viewer has UI elements (return button top-left, edit button top-right, zoom buttons bottom-center, file info bottom-left, navigation arrows on sides) scattered across the screen, obstructing image viewing. This redesign consolidates everything into a clean bottom toolbar with auto-hide, adds a zoom slider, export capabilities, and an annotation/drawing tool.

## Branch

Create feature branch `feat/image-viewer-redesign` from `main` before any changes.

---

## New Files

| File | Purpose | ~Lines |
|------|---------|--------|
| `src/viewers/image_viewer.js` | Main viewer controller (toolbar, zoom/pan, navigation, mini-map, auto-hide) | 700 |
| `src/viewers/image_annotation.js` | Canvas overlay for annotation/drawing tools | 400 |
| `src/viewers/image_export.js` | Export dialog (format, quality, size, clipboard) | 200 |
| `src/styles/image_viewer.css` | All new viewer styles (prefixed `iv-`) | 400 |

## Modified Files

| File | Change |
|------|--------|
| `index.html` | Add `<link>` for image_viewer.css, add toolbar/panel HTML containers inside `#fullscreenOverlay` |
| `src/core/asset_loading.js` | Replace image block (lines 1050-1143) with delegation to `imageViewer.open()` |
| `src/core/ui.js` | Add guard at line 469 so image viewer handles its own keys; update `navigateFullscreen()` at line 945 |
| `src/styles/styles.css` | Add z-index vars for `iv-*` layers; add `.iv-fullscreen` rules to hide old UI elements |

---

## Architecture

### Bottom Toolbar (replaces all scattered UI)
- Fixed to bottom, full width, 52px height, frosted glass (`backdrop-filter: blur(12px)`)
- **Left section**: filename + dimensions (compact)
- **Center section**: prev/next nav with counter, zoom slider + presets (Fit/100%), tool buttons (annotate, export, info, rotate, background toggle)
- **Right section**: edit-in-editor button (conditional), close button
- Auto-hides after 3s of mouse inactivity, reappears on mouse move
- Stays visible when panels are open or annotation mode is active

### Zoom Controls
- Horizontal slider with **logarithmic mapping** (10 = 0.1x, 100 = 1x, 1000 = 10x)
- Percentage label next to slider
- Quick presets: **Fit** (contain in viewport) and **100%** (actual pixels)
- Mouse wheel zoom (cursor-centered) - reuse existing algorithm from `asset_loading.js:1072-1089`
- Double-click: toggle between 100% (at click point) and Fit
- Scale range: 0.1x to 10x

### Mini-Map
- Appears in bottom-right corner when zoomed beyond fit-scale
- Tiny canvas thumbnail of full image with draggable viewport rectangle
- Hidden when export panel is open (same position)

### Navigation
- In-place image swap (no `exitFullscreen`/`showFullscreen` cycle - just swap `img.src`, reset zoom, update toolbar)
- Side hover areas remain but narrower (60px) and fully transparent until hover
- Toolbar has prev/next buttons with "3 / 24" counter
- Arrow keys still work

### Export Panel (`image_export.js`)
- Slides up from bottom-right, above toolbar
- **Format**: PNG / JPG / WEBP toggle buttons
- **Quality**: slider (10-100%), hidden for PNG
- **Size**: Original / 50% / 25% / Custom (with locked aspect ratio)
- **Include annotations**: checkbox (if annotations exist)
- **Actions**: Download (blob + anchor click) and Copy to Clipboard (`navigator.clipboard.write`)

### Annotation Tool (`image_annotation.js`)
- Canvas overlay positioned to match image bounds exactly
- **Coordinates stored in normalized image space (0-1)** so annotations survive zoom/pan
- When active: pan disabled, cursor = crosshair, annotation sub-toolbar slides up above main toolbar
- **Tools**: freehand pen, straight line, arrow, rectangle, circle, text
- **Options**: color picker + 6 presets, stroke width slider (1-20px)
- **Actions**: undo/redo stack, clear all, toggle visibility
- Annotations persist during navigation within session, lost on close unless exported
- Export integration: `renderToCanvas()` bakes annotations onto export canvas

### Additional Features
- **Rotation**: 90-degree increments (R key), applied via CSS transform
- **Background toggle**: dark (default) / checkerboard (for transparency checking)
- **Image info panel**: slides up from bottom-left with dimensions, file size, type, date, path

### Keyboard Shortcuts (when image viewer is active)

| Key | Action |
|-----|--------|
| Escape | Close (or exit annotation mode first) |
| Left/Right | Navigate images |
| +/- | Zoom in/out |
| 0 or F | Fit to screen |
| 1 | 100% zoom |
| R | Rotate 90 CW |
| D | Toggle background |
| A | Toggle annotation mode |
| E | Open export |
| I | Toggle info panel |
| Ctrl+Z / Ctrl+Shift+Z | Undo/redo annotation |
| Space | Toggle toolbar visibility |

---

## Integration Details

### asset_loading.js (lines 1050-1143)
Replace the entire image block with:
```js
} else if (model.type === "image") {
  fullscreenViewer.style.display = 'block';
  fullscreenVideo.style.display = 'none';
  const { imageViewer } = await import('../viewers/image_viewer.js');
  const currentIndex = filteredModelFiles.findIndex(f => f.name === model.name);
  await imageViewer.open(model, fileUrl, filteredModelFiles, currentIndex);
  currentFullscreenViewer = {
    type: 'image',
    element: imageViewer.img,
    fileName: model.name,
    imageViewer,
    cleanup: () => {
      imageViewer.close();
      if (needsCleanup && fileUrl) URL.revokeObjectURL(fileUrl);
    }
  };
```

### ui.js keyboard handler (line 469)
Add image viewer guard before existing 3D inspector check:
```js
else if (isFullscreen) {
  if (currentFullscreenViewer?.imageViewer) {
    if (event.key === 'Escape') exitFullscreen(currentFullscreenViewer);
    return; // image_viewer.js handles all other keys
  }
  // ... existing 3D inspector shortcuts ...
```

### ui.js navigateFullscreen (line 945)
Add early return for image viewer:
```js
function navigateFullscreen(direction) {
  if (currentFullscreenViewer?.imageViewer) {
    currentFullscreenViewer.imageViewer.navigate(direction);
    return;
  }
  // ... existing logic ...
```

### styles.css
Add to `:root` z-index map:
```css
--z-iv-annotation: calc(var(--z-fullscreen) + 2);
--z-iv-toolbar:    calc(var(--z-fullscreen) + 3);
--z-iv-panel:      calc(var(--z-fullscreen) + 4);
```
Hide old elements when image viewer is active:
```css
.iv-fullscreen #returnButton,
.iv-fullscreen .fullscreen-info,
.iv-fullscreen .fullscreen-edit-btn,
.iv-fullscreen .image-controls { display: none !important; }

.iv-fullscreen #fullscreenViewer {
  width: 100%; height: calc(100% - 52px);
  max-width: 100%; max-height: calc(100vh - 52px);
}
```

### Backward Compatibility
- Non-image types (video, audio, 3D, fonts, documents) continue using existing UI unchanged
- `.iv-fullscreen` class only added to overlay when image viewer is active
- Old `ImageHandler.js` stays as-is (already disabled via `useNewHandler = false`)

---

## Implementation Phases

### Phase 1: Core Toolbar + Zoom Slider
Create `image_viewer.js` and `image_viewer.css`. Bottom toolbar with zoom slider, presets, navigation, close. Wire into `asset_loading.js` and `ui.js`. Auto-hide behavior.

### Phase 2: Mini-Map + Info + Rotation + Background
Mini-map canvas with draggable viewport. Info panel. Rotation transforms. Checkerboard background toggle.

### Phase 3: Export
Create `image_export.js`. Format/quality/size panel. Download and clipboard actions.

### Phase 4: Annotation
Create `image_annotation.js`. Canvas overlay with normalized coords. Drawing tools, colors, undo/redo. Annotation toolbar. Export integration.

### Phase 5: Polish
Trackpad pinch-to-zoom, smooth zoom transitions, responsive layout, light theme testing, keyboard help dialog update.

---

## Verification
1. `node scripts/server.cjs` - start the server
2. Open http://localhost:7777, load a folder with images
3. Open an image in fullscreen - verify bottom toolbar appears, old UI elements are hidden
4. Test zoom slider, Fit/100% presets, mouse wheel zoom, double-click zoom
5. Test auto-hide: stop moving mouse for 3s, verify toolbar fades; move mouse, verify it returns
6. Navigate between images with arrows - verify in-place swap (no flicker)
7. Test annotation: activate, draw shapes, undo/redo, toggle visibility
8. Test export: download as PNG/JPG/WEBP, copy to clipboard, export with annotations
9. Test rotation, background toggle, info panel
10. Verify non-image assets (video, 3D, audio) still use old UI correctly
11. Test in light mode
