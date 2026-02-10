// model_inspector_glb.js - GLB/GLTF Inspector Adapter
// Wraps <model-viewer> web component to expose unified inspector interface
// Uses model-viewer's public API where possible, falls back to internal scene access

import * as THREE from 'three';

const TEXTURE_PROPS = [
  'map', 'normalMap', 'specularMap', 'emissiveMap', 'aoMap',
  'roughnessMap', 'metalnessMap', 'bumpMap', 'alphaMap', 'envMap',
  'lightMap', 'displacementMap'
];

export class GLBInspectorAdapter {
  constructor(modelViewer) {
    this.mv = modelViewer;
    this._readyCallbacks = [];
    this._scene = null; // cached internal Three.js scene
    this._renderer = null; // cached internal renderer
    this._originalTextures = new Map();
    this._gridHelper = null;
    this._boxHelper = null;
    this._skeletonHelper = null;
    this._normalsHelpers = [];
    this._wireframeEnabled = false;
    this._autoRotateWasOn = false;
    this._camera = null;
    this._needsRenderSym = null;

    // Listen for model load
    this.mv.addEventListener('load', () => {
      this._cacheInternals();
      this._onModelReady();
    });

    // If already loaded
    if (this.mv.loaded) {
      this._cacheInternals();
      setTimeout(() => this._onModelReady(), 0);
    }
  }

  _cacheInternals() {
    try {
      // Access model-viewer's internal Three.js scene, renderer, camera via Symbols
      const symbols = Object.getOwnPropertySymbols(this.mv);
      for (const sym of symbols) {
        const desc = sym.description || sym.toString();
        if (desc.includes('scene') && !this._scene) {
          const sceneObj = this.mv[sym];
          if (sceneObj && (sceneObj.isScene || sceneObj.scene)) {
            this._scene = sceneObj.isScene ? sceneObj : sceneObj.scene;
          }
        }
        if (desc.includes('renderer') && !this._renderer) {
          const r = this.mv[sym];
          if (r && r.domElement) {
            this._renderer = r;
          } else if (r && r.threeRenderer) {
            // model-viewer's Renderer wrapper has threeRenderer property
            this._renderer = r.threeRenderer;
          }
        }
        if (desc.includes('needsRender')) {
          this._needsRenderSym = sym;
        }
      }

      // Find camera from the scene
      if (this._scene) {
        this._scene.traverse(obj => {
          if (!this._camera && obj.isCamera) {
            this._camera = obj;
          }
        });
      }
    } catch (err) {
      console.warn('GLB Inspector: Could not access model-viewer internals', err);
    }
  }

  _getModelRoot() {
    // Try to get the actual model root from the scene
    if (!this._scene) return null;
    // model-viewer typically places the model as a child of the scene
    for (const child of this._scene.children) {
      if (child.type === 'Group' || child.type === 'Object3D') {
        // Check if it has meshes
        let hasMesh = false;
        child.traverse(c => { if (c.isMesh) hasMesh = true; });
        if (hasMesh) return child;
      }
    }
    // Fallback: use scene itself
    return this._scene;
  }

  _onModelReady() {
    this._readyCallbacks.forEach(cb => cb());
    this._readyCallbacks = [];
  }

  onReady(callback) {
    if (this.mv?.loaded) {
      callback();
    } else {
      this._readyCallbacks.push(callback);
    }
  }

  // --- Stats ---

  getModelStats() {
    const root = this._getModelRoot();
    if (!root) return null;

    let vertices = 0, triangles = 0, meshCount = 0;
    const materialSet = new Set();

    root.traverse((child) => {
      if (child.isMesh) {
        meshCount++;
        const geo = child.geometry;
        vertices += geo.attributes.position?.count || 0;
        if (geo.index) {
          triangles += geo.index.count / 3;
        } else {
          triangles += (geo.attributes.position?.count || 0) / 3;
        }
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach(m => { if (m) materialSet.add(m.uuid); });
      }
    });

    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());

    return {
      vertices: Math.round(vertices),
      triangles: Math.round(triangles),
      meshCount,
      materialCount: materialSet.size,
      boundingBox: { x: size.x, y: size.y, z: size.z }
    };
  }

  getRenderInfo() {
    if (!this._renderer?.info) return null;
    const info = this._renderer.info;
    return {
      drawCalls: info.render?.calls ?? 0,
      trianglesRendered: info.render?.triangles ?? 0,
      geometriesInGPU: info.memory?.geometries ?? 0,
      texturesInGPU: info.memory?.textures ?? 0
    };
  }

  // --- Textures ---

  getTextureInfo() {
    const root = this._getModelRoot();
    if (!root) return [];

    const textures = [];
    const seen = new Set();

    root.traverse((child) => {
      if (!child.isMesh) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach(mat => {
        if (!mat) return;
        TEXTURE_PROPS.forEach(prop => {
          if (mat[prop]) {
            const tex = mat[prop];
            const key = `${prop}_${tex.uuid}`;
            if (seen.has(key)) return;
            seen.add(key);
            textures.push({
              type: prop,
              name: tex.name || tex.image?.src?.split('/').pop() || 'unnamed',
              width: tex.image?.width || 'N/A',
              height: tex.image?.height || 'N/A',
              materialName: mat.name || 'unnamed'
            });
          }
        });
      });
    });

    return textures;
  }

  toggleTexture(type, enabled, _idx) {
    const root = this._getModelRoot();
    if (!root) return;

    root.traverse((child) => {
      if (!child.isMesh) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((mat, matIdx) => {
        if (!mat) return;
        const key = `${child.uuid}_${matIdx}_${type}`;

        if (!enabled) {
          if (mat[type] && !this._originalTextures.has(key)) {
            this._originalTextures.set(key, mat[type]);
          }
          if (mat[type]) {
            mat[type] = null;
            mat.needsUpdate = true;
          }
        } else {
          const original = this._originalTextures.get(key);
          if (original) {
            mat[type] = original;
            mat.needsUpdate = true;
          }
        }
      });
    });

    this._requestRender();
  }

  // --- Wireframe ---

  setWireframe(enabled) {
    this._wireframeEnabled = enabled;
    const root = this._getModelRoot();
    if (!root) return;

    root.traverse((child) => {
      if (!child.isMesh) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach(mat => {
        if (mat) mat.wireframe = enabled;
      });
    });

    this._requestRender();
  }

  // --- Animations (uses model-viewer public API) ---

  getAnimations() {
    if (!this.mv) return [];
    const names = this.mv.availableAnimations || [];
    return names.map((name, i) => ({
      name: name || `Animation ${i + 1}`,
      duration: this.mv.duration || 0
    }));
  }

  playAnimation(index) {
    if (!this.mv) return;
    const names = this.mv.availableAnimations || [];
    if (names[index]) {
      this.mv.animationName = names[index];
      this.mv.play();
    }
  }

  togglePlayback() {
    if (!this.mv) return;
    if (this.mv.paused) {
      this.mv.play();
    } else {
      this.mv.pause();
    }
  }

  isPlaying() {
    return this.mv ? !this.mv.paused : false;
  }

  seek(time) {
    if (this.mv) {
      this.mv.currentTime = time;
    }
  }

  getCurrentTime() {
    return this.mv?.currentTime ?? 0;
  }

  getDuration() {
    return this.mv?.duration ?? 0;
  }

  setPlaybackSpeed(speed) {
    if (this.mv) {
      this.mv.timeScale = speed;
    }
  }

  // --- Scene Controls ---

  setGridVisible(visible) {
    if (!this._scene) return;

    if (visible && !this._gridHelper) {
      this._gridHelper = new THREE.GridHelper(10, 20, 0x555555, 0x333333);
      this._gridHelper.position.y = -0.01; // at ground level
      this._scene.add(this._gridHelper);
    } else if (!visible && this._gridHelper) {
      this._scene.remove(this._gridHelper);
      this._gridHelper.dispose();
      this._gridHelper = null;
    }

    this._requestRender();
  }

  setBackground(type) {
    if (!this.mv) return;
    const colors = {
      dark: '#3a3a3a',
      light: '#e8e8e8',
      black: '#111111',
      white: '#ffffff',
      checker: '#888888'
    };
    // model-viewer uses CSS background
    this.mv.style.backgroundColor = colors[type] || colors.dark;

    // Also try setting scene background if available
    if (this._scene) {
      const threeColors = {
        dark: 0x3a3a3a,
        light: 0xe8e8e8,
        black: 0x111111,
        white: 0xffffff,
        checker: 0x888888
      };
      this._scene.background = new THREE.Color(threeColors[type] || threeColors.dark);
      this._requestRender();
    }
  }

  resetCamera() {
    if (this.mv) {
      this.mv.cameraOrbit = 'auto auto auto';
      this.mv.cameraTarget = 'auto auto auto';
      this.mv.fieldOfView = 'auto';
      this.mv.jumpCameraToGoal();
    }
  }

  setAutoRotate(enabled) {
    if (this.mv) {
      if (enabled) {
        this.mv.setAttribute('auto-rotate', '');
      } else {
        this.mv.removeAttribute('auto-rotate');
      }
    }
  }

  setLightingPreset(name) {
    if (!this.mv) return;
    // model-viewer supports environment-image presets
    const presets = {
      default: 'neutral',
      studio: 'neutral',
      outdoor: 'neutral',
      dark: 'neutral',
      flat: 'neutral'
    };

    // Use exposure to simulate different lighting
    const exposures = {
      default: 1.0,
      studio: 1.2,
      outdoor: 1.5,
      dark: 0.4,
      flat: 0.8
    };

    this.mv.setAttribute('environment-image', presets[name] || 'neutral');
    this.mv.exposure = exposures[name] ?? 1.0;
  }

  // --- Helpers ---

  hasSkeleton() {
    const root = this._getModelRoot();
    if (!root) return false;
    let found = false;
    root.traverse(child => {
      if (child.isSkinnedMesh || child.isBone) found = true;
    });
    return found;
  }

  setBoundsVisible(visible) {
    const root = this._getModelRoot();
    if (!root || !this._scene) return;

    if (visible && !this._boxHelper) {
      this._boxHelper = new THREE.BoxHelper(root, 0x9b77ff);
      this._scene.add(this._boxHelper);
    } else if (!visible && this._boxHelper) {
      this._scene.remove(this._boxHelper);
      this._boxHelper.dispose();
      this._boxHelper = null;
    }

    this._requestRender();
  }

  async setNormalsVisible(visible) {
    const root = this._getModelRoot();
    if (!root || !this._scene) return;

    if (visible && this._normalsHelpers.length === 0) {
      try {
        const { VertexNormalsHelper } = await import('three/addons/helpers/VertexNormalsHelper.js');
        root.traverse(child => {
          if (child.isMesh) {
            const helper = new VertexNormalsHelper(child, 0.02, 0x00ff88);
            this._scene.add(helper);
            this._normalsHelpers.push(helper);
          }
        });
        this._requestRender();
      } catch (err) {
        console.warn('Failed to load VertexNormalsHelper:', err);
      }
    } else if (!visible && this._normalsHelpers.length > 0) {
      this._normalsHelpers.forEach(h => {
        this._scene.remove(h);
        h.dispose();
      });
      this._normalsHelpers = [];
      this._requestRender();
    }
  }

  setSkeletonVisible(visible) {
    const root = this._getModelRoot();
    if (!root || !this._scene) return;

    if (visible && !this._skeletonHelper) {
      this._skeletonHelper = new THREE.SkeletonHelper(root);
      this._scene.add(this._skeletonHelper);
    } else if (!visible && this._skeletonHelper) {
      this._scene.remove(this._skeletonHelper);
      this._skeletonHelper.dispose();
      this._skeletonHelper = null;
    }

    this._requestRender();
  }

  // --- Draco Detection ---

  async detectDraco() {
    if (!this.mv?.src) return false;
    try {
      const resp = await fetch(this.mv.src, { headers: { Range: 'bytes=0-16383' } });
      const buffer = await resp.arrayBuffer();
      if (buffer.byteLength < 20) return false;
      const view = new DataView(buffer);
      // GLB: magic(4) + version(4) + length(4) + jsonChunkLen(4) + jsonChunkType(4) + jsonData
      const magic = view.getUint32(0, true);
      if (magic !== 0x46546C67) return false; // 'glTF'
      const jsonLen = view.getUint32(12, true);
      const readLen = Math.min(jsonLen, buffer.byteLength - 20);
      const jsonStr = new TextDecoder().decode(new Uint8Array(buffer, 20, readLen));
      return jsonStr.includes('KHR_draco_mesh_compression');
    } catch {
      return false;
    }
  }

  // --- Public accessors for tools ---

  getModelRoot() {
    return this._getModelRoot();
  }

  getScene() {
    return this._scene;
  }

  getAnimationClips() {
    // For GLB, animation clips are on the loaded model or scene
    const clips = [];
    const seen = new Set();
    const addClips = (arr) => {
      if (!arr) return;
      arr.forEach(clip => {
        if (!seen.has(clip.uuid)) {
          seen.add(clip.uuid);
          clips.push(clip);
        }
      });
    };

    // Check model root and its children
    const root = this._getModelRoot();
    if (root) {
      addClips(root.animations);
      root.traverse(child => addClips(child.animations));
    }
    // Check scene-level animations
    if (this._scene) {
      addClips(this._scene.animations);
      // Also check direct scene children (model-viewer structure)
      this._scene.children.forEach(child => addClips(child.animations));
    }
    return clips;
  }

  getAllMaterials() {
    const root = this._getModelRoot();
    if (!root) return [];
    const mats = [];
    const seen = new Set();
    root.traverse(child => {
      if (!child.isMesh) return;
      const arr = Array.isArray(child.material) ? child.material : [child.material];
      arr.forEach(m => {
        if (m && !seen.has(m.uuid)) {
          seen.add(m.uuid);
          mats.push(m);
        }
      });
    });
    return mats;
  }

  getAllMeshes() {
    const root = this._getModelRoot();
    if (!root) return [];
    const meshes = [];
    root.traverse(child => {
      if (child.isMesh) meshes.push(child);
    });
    return meshes;
  }

  // --- Screenshot ---

  async takeScreenshot() {
    if (!this.mv) return null;

    // model-viewer has a built-in toBlob method
    if (typeof this.mv.toBlob === 'function') {
      try {
        return await this.mv.toBlob({ idealAspect: false });
      } catch (err) {
        console.warn('model-viewer toBlob failed:', err);
      }
    }

    // Fallback: try canvas
    const canvas = this.mv.querySelector('canvas');
    if (canvas) {
      return new Promise(resolve => {
        canvas.toBlob(blob => resolve(blob), 'image/png');
      });
    }

    return null;
  }

  // --- Internal ---

  _requestRender() {
    // Force model-viewer to re-render after internal scene modifications
    if (!this.mv) return;
    try {
      // Method 1: Try internal needsRender (may be method or property)
      if (this._needsRenderSym) {
        const val = this.mv[this._needsRenderSym];
        if (typeof val === 'function') {
          this.mv[this._needsRenderSym]();
        } else {
          this.mv[this._needsRenderSym] = true;
        }
      }

      // Method 2: Nudge exposure to trigger model-viewer's render cycle.
      // Even if Method 1 set the flag, model-viewer's render loop may be
      // dormant - an exposure change wakes it up via the public API.
      // The 0.001 change is imperceptible and gets reverted next frame.
      const exp = this.mv.exposure ?? 1;
      this.mv.exposure = exp + 0.001;
      requestAnimationFrame(() => {
        if (this.mv) this.mv.exposure = exp;
      });
    } catch (err) {
      // Silent fail
    }
  }

  // --- Lifecycle ---

  dispose() {
    this._originalTextures.clear();

    if (this._scene) {
      if (this._gridHelper) {
        this._scene.remove(this._gridHelper);
        this._gridHelper.dispose();
      }
      if (this._boxHelper) {
        this._scene.remove(this._boxHelper);
        this._boxHelper.dispose();
      }
      if (this._skeletonHelper) {
        this._scene.remove(this._skeletonHelper);
        this._skeletonHelper.dispose();
      }
      this._normalsHelpers.forEach(h => {
        this._scene.remove(h);
        h.dispose();
      });
    }

    // Restore wireframe
    if (this._wireframeEnabled) {
      this.setWireframe(false);
    }

    this._gridHelper = null;
    this._boxHelper = null;
    this._skeletonHelper = null;
    this._normalsHelpers = [];
    this._scene = null;
    this._renderer = null;
    this.mv = null;
  }
}
