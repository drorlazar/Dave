# Fix: 3D Inspector Export Hangs on Large Models

**Date:** 2026-02-20
**Branch:** `fix/inspector-export-hang`
**Status:** Implemented

## Summary

### Phase 1: Export pipeline fixes

1. **try/finally for restorers** - Scene graph modifications are now always restored, even on error/cancel
2. **AbortController + timeout** - Export can be cancelled via Cancel button; 60s timeout prevents infinite hangs
3. **Texture resize guards** - Validates drawable source before drawImage; try/catch around each texture
4. **Progress feedback** - Status updates at each stage ("Resizing textures...", "Simplifying mesh 2/5...", etc.)

### Phase 2: Replace SimplifyModifier with meshoptimizer

Three.js's `SimplifyModifier` had two fatal flaws:
- **O(n^2) performance** - hangs on 500K+ vertex models
- **Destroys UV seams** - collapses vertices across texture boundaries, creating holes/tears

Replaced with **meshoptimizer** (WASM, loaded from CDN):
- Topology-preserving simplification (no holes, no tears)
- O(n log n) performance - handles millions of vertices in seconds
- `LockBorder` flag prevents boundary edge collapse
- Graceful fallback (skip simplification if CDN unreachable)

### Phase 3: Point cloud (THREE.Points) support

Both adapters (GLB + FBX) only checked `child.isMesh`, missing point cloud models entirely. Added `child.isPoints` checks across all traversals so point clouds show correct stats, materials, and can be exported.

## Files Modified

| File | Changes |
|------|---------|
| `src/viewers/model_inspector.js` | Export pipeline fixes, meshoptimizer integration, Points support in export |
| `src/viewers/model_inspector_glb.js` | Points support in all traversals (9 locations) |
| `src/viewers/model_inspector_fbx.js` | Points support in all traversals (7 locations) |
| `src/styles/model_inspector.css` | Added `.inspector-cancel-btn` styles |
| `tests/e2e/test_inspector_export.js` | New E2E test suite (8 tests) |
