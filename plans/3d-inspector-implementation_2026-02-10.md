# 3D Inspector Implementation - 2026-02-10

## Branch: feature/3d-inspector

## Files Created
- `src/viewers/model_inspector.js` - Main UI panel + toolbar controller
- `src/viewers/model_inspector_fbx.js` - FBX adapter (wraps FBXViewer)
- `src/viewers/model_inspector_glb.js` - GLB adapter (wraps model-viewer)
- `src/styles/model_inspector.css` - All inspector styles

## Files Modified
- `src/viewers/viewer_fbx.js` - Added loadedObject, animations, animation control methods, preserveDrawingBuffer
- `src/core/asset_loading.js` - Added imports, inspector creation in showFullscreen() for GLB+FBX
- `src/core/ui.js` - Added 3D keyboard shortcuts, toolbar/panel hiding in exitFullscreen()
- `index.html` - Added CSS link, toolbar+panel HTML in fullscreenOverlay

## Features
- Polycount (vertices, triangles, meshes, materials)
- Texture list with per-texture toggle
- Wireframe mode
- Animation controls (select, play/pause, scrubber, speed)
- Grid helper, bounding box, skeleton helper, normals helper
- Background presets (dark/light/checker/black/white)
- Lighting presets (default/studio/outdoor/dark/flat)
- Screenshot export (PNG)
- Keyboard shortcuts (W/G/I/R/C/N/B/S/P/Space/Esc)
