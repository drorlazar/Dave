# 3D Inspector Enhancement - Round 3

## Context

The 3D inspector system is already functional with toolbar, slide-in panel, material editor, animation bar, export tools, and bind-pose fix. This plan addresses 7 remaining enhancements requested by the user to improve export quality, UI layout, and add advanced material editing.

## Current State

- Branch: `feature/3d-inspector` (not yet pushed)
- Key files: `model_inspector.js` (1133 lines), `model_inspector_glb.js` (635 lines), `model_inspector_fbx.js` (478 lines), `model_inspector.css` (~1570 lines), `index.html`

---

## Task 1: Export Animation-Only GLB (rig + clip, no mesh geometry)

**Goal**: When clicking the per-animation download button, export a GLB containing ONLY the skeleton/rig and that animation clip - no mesh geometry or textures.

**Approach**: In `_doExport()`, add an `animOnly` flag. When true:
1. Before export, strip all mesh geometry by temporarily removing all Mesh children from the root
2. Strip all materials/textures
3. Export only the skeleton bones + the single animation clip
4. Restore meshes after export

**Files**: `src/viewers/model_inspector.js`

**Changes to `_handleExportAction`** (line ~832):
```javascript
case 'export-single-anim': {
  const idx = parseInt(...);
  const clips = this.adapter.getAnimationClips?.() || [];
  if (clips[idx]) {
    await this._doExport({ animOnly: true, forceAnims: [clips[idx]] });
  }
  break;
}
```

**Changes to `_doExport`** (line ~867):
- Add `animOnly` parameter to options
- When `animOnly === true`: temporarily remove all Mesh/SkinnedMesh geometry (set `mesh.visible = false` and exclude from export by removing mesh children, keeping only Bone hierarchy)
- Better approach: Create a temporary clone of just the skeleton hierarchy + add animations to it, export that instead. This avoids mutating the original scene.
- Actually simplest: use GLTFExporter with `{ binary: true, animations: [clip] }` but pass only the skeleton root (first Bone with no parent-bone), not the entire model root. The exporter will include the bone hierarchy + animation.
- **Final approach**: Find the root bone(s) from SkinnedMesh skeletons. Create a temporary Object3D, add cloned bone hierarchy to it. Export with the animation clip. This ensures only bones + animation are in the GLB.

Actually, the cleanest approach:
1. Temporarily hide all meshes (`mesh.visible = false`) and strip textures
2. Export the full root with `includeCustomExtensions: false`
3. The GLTFExporter respects `visible` - invisible meshes won't be exported
4. Restore visibility after

Wait, GLTFExporter does NOT skip invisible meshes by default. Let me use a different approach:

**Final approach**:
1. Temporarily remove all Mesh nodes from the tree (save parent refs)
2. Keep only Object3D/Group/Bone nodes (the skeleton hierarchy)
3. Export root with the animation clip
4. Re-attach meshes to their parents

```javascript
if (animOnly) {
  const removedMeshes = [];
  root.traverse(child => {
    if (child.isMesh || child.isSkinnedMesh) {
      removedMeshes.push({ mesh: child, parent: child.parent });
    }
  });
  removedMeshes.forEach(({ mesh, parent }) => {
    if (parent) parent.remove(mesh);
  });
  restorers.push(() => {
    removedMeshes.forEach(({ mesh, parent }) => {
      if (parent) parent.add(mesh);
    });
  });
}
```

**Download name suffix**: `_anim_<clipName>.glb`

---

## Task 2: Fix Deformed Model When Removing All Animations

**Problem**: When all animations are unchecked for export, the exported model is deformed because model-viewer's internal AnimationMixer is still driving bone transforms. The current `skeleton.pose()` call happens but bones get overwritten before/during export.

**Approach**: For GLB adapter, pause the model-viewer animation before resetting skeleton:
1. Before `skeleton.pose()`, call `this.adapter.mv?.pause()` (for GLB) to stop the mixer
2. Wait one frame for the pause to take effect
3. Then call `skeleton.pose()` + `updateMatrixWorld(true)`
4. Also need to update `skeleton.boneMatrices` via `skeleton.update()` after `pose()`
5. Export
6. Restore original bone transforms and resume playback if it was playing

**Changes to `_doExport`** (line ~894):
```javascript
if (animations.length === 0) {
  // Pause animation to prevent mixer from overwriting bones
  const wasPlaying = this.adapter.isPlaying?.();
  if (wasPlaying) {
    this.adapter.togglePlayback?.(); // pause
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); // wait 2 frames
  }

  const meshes = this.adapter.getAllMeshes?.() || [];
  for (const mesh of meshes) {
    if (mesh.isSkinnedMesh && mesh.skeleton) {
      const savedBones = mesh.skeleton.bones.map(bone => ({
        bone, pos: bone.position.clone(), rot: bone.quaternion.clone(), scale: bone.scale.clone()
      }));
      mesh.skeleton.pose();
      mesh.skeleton.update(); // update bone matrices
      restorers.push(() => {
        savedBones.forEach(({ bone, pos, rot, scale }) => {
          bone.position.copy(pos); bone.quaternion.copy(rot); bone.scale.copy(scale);
        });
        if (wasPlaying) this.adapter.togglePlayback?.(); // resume
      });
    }
  }
  root.updateMatrixWorld(true);
}
```

**Files**: `src/viewers/model_inspector.js`

---

## Task 3: Bigger Icons in Toolbar

**Goal**: Increase toolbar button and icon size for better visibility.

**Changes in `model_inspector.css`**:
- `.model-toolbar-btn`: `width: 36px; height: 36px` -> `width: 42px; height: 42px`
- `.model-toolbar-btn` font-size: `14px` -> `18px`
- SVG icons in toolbar buttons: `width="16" height="16"` -> `width="20" height="20"` (in `index.html`)

**Files**: `src/styles/model_inspector.css`, `index.html`

---

## Task 4: Replace Grid Icon with 3D Cube + Axes Arrows

**Goal**: Replace current grid icon SVG with a 3D cube wireframe with 3 colored axis arrows (R/G/B for X/Y/Z).

**New SVG** (in `index.html`, grid toolbar button):
```svg
<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke-width="1.2">
  <!-- Cube wireframe -->
  <path d="M5 8l7-4 7 4v8l-7 4-7-4z" stroke="currentColor"/>
  <path d="M5 8l7 4 7-4" stroke="currentColor"/>
  <path d="M12 12v8" stroke="currentColor"/>
  <!-- X axis (red) -->
  <line x1="12" y1="12" x2="20" y2="12" stroke="#e74c3c" stroke-width="1.5"/>
  <polyline points="18,10.5 20,12 18,13.5" stroke="#e74c3c" stroke-width="1.5" fill="none"/>
  <!-- Y axis (green) -->
  <line x1="12" y1="12" x2="12" y2="4" stroke="#2ecc71" stroke-width="1.5"/>
  <polyline points="10.5,6 12,4 13.5,6" stroke="#2ecc71" stroke-width="1.5" fill="none"/>
  <!-- Z axis (blue) -->
  <line x1="12" y1="12" x2="7" y2="16" stroke="#3498db" stroke-width="1.5"/>
  <polyline points="7.5,14 7,16 9,15.5" stroke="#3498db" stroke-width="1.5" fill="none"/>
</svg>
```

**Files**: `index.html`

---

## Task 5: Material Editor Popup with Texture Drag/Drop

**Goal**: Create a popup material editor that opens when clicking a material in the panel. It should show texture slots with drag/drop capability to load custom textures.

**UI Design**: A modal/popup overlay that appears centered over the viewer:
```
+------------------------------------------+
| Material: "Wood_Base"            [X]     |
|------------------------------------------|
| Color: [picker]   Roughness: [====] 0.5 |
| Metal: [====] 0.0  Emissive: [picker]   |
| Opacity: [====] 1.0  Side: [Front v]    |
|------------------------------------------|
| TEXTURE SLOTS                            |
| +--------+ +--------+ +--------+        |
| | Diffuse| | Normal | | Rough  |        |
| | [img]  | | [img]  | | [img]  |        |
| | 1024x  | | 1024x  | | empty  |        |
| +--------+ +--------+ +--------+        |
| +--------+ +--------+ +--------+        |
| | Metal  | | AO     | | Emiss  |        |
| | empty  | | empty  | | empty  |        |
| +--------+ +--------+ +--------+        |
|                                          |
| Drag & drop images onto texture slots    |
+------------------------------------------+
```

**Approach**:
1. Add a "popup edit" button (pencil icon) next to each material header in `_populateMaterials()`
2. When clicked, open a popup (`_openMaterialEditor(matIdx)`)
3. The popup is a `<div>` appended to `#fullscreenOverlay` with class `inspector-mat-editor-popup`
4. Shows all material properties (color, roughness, metalness, emissive, opacity, side, transparent) as interactive controls
5. Shows texture slots as a grid of cards. Each slot:
   - Shows a thumbnail preview if texture exists (draw to small canvas)
   - Shows slot name (Diffuse, Normal, etc.)
   - Shows resolution if loaded
   - Has a "remove" button (X) if texture exists
   - Accepts drag & drop of image files
   - Accepts click-to-browse (hidden file input)
6. On drop/file-select: load image as `THREE.Texture`, assign to material[prop], trigger render
7. Changes persist to export (they directly modify the Three.js material)

**Implementation**:
- Add `_openMaterialEditor(matIdx)` and `_closeMaterialEditor()` methods to `ModelInspectorPanel`
- Add popup HTML generation + event binding
- Add texture thumbnail generation (canvas drawImage)
- Add drag/drop handler per texture slot
- Add file input handler per texture slot
- CSS: centered popup, dark theme, texture grid, drag hover state

**Files**: `src/viewers/model_inspector.js`, `src/styles/model_inspector.css`

---

## Task 6: Move Toolbar Inside Preview Window (Floating Top-Right)

**Goal**: The toolbar should float inside the 3D preview area instead of being fixed to the viewport edge.

**Approach**:
1. Move `#model3dToolbar` from `#fullscreenOverlay` to inside `#fullscreenViewerWrap` in HTML
2. Change CSS from `position: fixed` to `position: absolute`
3. Set `#fullscreenViewerWrap` to `position: relative` (already is, verify)
4. Position toolbar: `top: 12px; right: 12px` with slight margin from edges
5. Update panel-open logic: when inspector panel opens, toolbar stays inside the viewer wrap (doesn't shift to accommodate panel)
6. The toolbar z-index should be above the viewer but below the inspector panel

**Changes in `index.html`**: Move `#model3dToolbar` div from after `#fullscreenContent` to inside `#fullscreenViewerWrap`, after `#fullscreenViewer`

**Changes in `model_inspector.css`**:
```css
.model-toolbar {
  position: absolute;  /* was: fixed */
  top: 12px;
  right: 12px;
  z-index: 10;  /* relative to wrapper */
}
```

**Changes in `model_inspector.js`**:
- `togglePanel()`: Remove logic that shifts toolbar right/left based on panel state (lines 88-91). Toolbar stays in its fixed position inside the viewer.
- Update `_show()` and `_hide()` - no changes needed since they just toggle display

**Files**: `index.html`, `src/styles/model_inspector.css`, `src/viewers/model_inspector.js`

---

## Task 7: Floating/Dockable Inspector Panel

**Goal**: Add option to undock the inspector panel as a floating, draggable window, with ability to dock it back to the right edge.

**UI**:
- Add a "float/dock" toggle button in the inspector panel header (next to close button)
- When clicked: panel becomes a floating, draggable, resizable window positioned center-screen
- When docked: returns to the original right-edge slide-in behavior

**Approach**:
1. Add toggle button in panel header: `<button class="inspector-float-toggle" title="Float/Dock"><i class="fa fa-window-restore"></i></button>`
2. State: `this._isFloating = false` on `ModelInspectorPanel`
3. When floating:
   - Remove `transform: translateX(0)` transition, set `position: fixed` with initial left/top (centered)
   - Add `width`, `height` as resizable
   - Enable drag via header (mousedown on header -> track mousemove)
   - CSS class: `.model-inspector-panel.floating`
   - Panel stays open and functional, just repositioned
4. When docking back:
   - Remove floating class, restore `transform` transition behavior
   - Reset position to right edge
5. Drag handler: on mousedown on header (not on buttons), track mousemove to update left/top, mouseup to stop

**CSS for floating mode**:
```css
.model-inspector-panel.floating {
  position: fixed;
  transform: none;
  top: 10%;
  left: calc(50% - 175px);
  border-radius: 8px;
  border: 1px solid #444;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  resize: both;
  overflow: auto;
  height: 70vh;
}
```

**Files**: `src/viewers/model_inspector.js`, `src/styles/model_inspector.css`, `index.html`

---

## Implementation Order

1. **Task 6**: Move toolbar inside preview (structural HTML change - do first)
2. **Task 3**: Bigger icons (quick CSS + HTML attr change)
3. **Task 4**: Replace grid icon SVG
4. **Task 2**: Fix deformed export (pause animation before skeleton.pose)
5. **Task 1**: Export animation-only GLB
6. **Task 7**: Floating/dockable inspector
7. **Task 5**: Material editor popup with texture drag/drop (largest task, do last)

## Files Modified

| File | Tasks |
|------|-------|
| `index.html` | 3, 4, 6, 7 |
| `src/viewers/model_inspector.js` | 1, 2, 5, 6, 7 |
| `src/styles/model_inspector.css` | 3, 5, 6, 7 |

## Verification

1. Open a GLB model in fullscreen - toolbar should float inside preview top-right
2. Icons should be larger and clearly visible
3. Grid icon shows 3D cube with colored axes
4. Open inspector, go to Export, uncheck all animations -> export -> model should be in T/A-pose (not deformed)
5. Click single-animation download button -> exported GLB should contain only skeleton + that clip (no mesh visible in viewer)
6. Click float button in inspector header -> panel becomes draggable floating window
7. Click dock button -> panel slides back to right edge
8. In Materials section, click edit button -> popup opens with texture slots
9. Drag an image file onto a texture slot -> texture loads and applies to material
10. Export model -> custom textures should be included in export
