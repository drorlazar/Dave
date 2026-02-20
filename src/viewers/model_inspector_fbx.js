// model_inspector_fbx.js - FBX Inspector Adapter
// Wraps FBXViewer to expose unified inspector interface

import * as THREE from 'three';

const TEXTURE_PROPS = [
  'map', 'normalMap', 'specularMap', 'emissiveMap', 'aoMap',
  'roughnessMap', 'metalnessMap', 'bumpMap', 'alphaMap', 'envMap',
  'lightMap', 'displacementMap'
];

export class FBXInspectorAdapter {
  constructor(viewer) {
    this.viewer = viewer;
    this._readyCallbacks = [];
    this._originalTextures = new Map(); // key: `${meshUuid}_${matIdx}_${prop}`, value: texture
    this._gridHelper = null;
    this._boxHelper = null;
    this._skeletonHelper = null;
    this._normalsHelpers = []; // array of VertexNormalsHelper instances
    this._defaultLights = null; // snapshot of default lighting config

    // Listen for model loaded
    const originalCallback = viewer.onModelLoaded;
    viewer.onModelLoaded = (v) => {
      if (originalCallback) originalCallback(v);
      this._onModelReady();
    };

    // If model already loaded
    if (viewer.loadedObject) {
      setTimeout(() => this._onModelReady(), 0);
    }
  }

  _onModelReady() {
    this._readyCallbacks.forEach(cb => cb());
    this._readyCallbacks = [];
  }

  onReady(callback) {
    if (this.viewer?.loadedObject) {
      callback();
    } else {
      this._readyCallbacks.push(callback);
    }
  }

  // --- Stats ---

  getModelStats() {
    const obj = this.viewer?.loadedObject;
    if (!obj) return null;

    let vertices = 0, triangles = 0, meshCount = 0, materialCount = 0;
    const materialSet = new Set();

    obj.traverse((child) => {
      if (child.isMesh || child.isPoints) {
        meshCount++;
        const geo = child.geometry;
        vertices += geo.attributes.position?.count || 0;
        if (child.isPoints) {
          // Points don't have triangles
        } else if (geo.index) {
          triangles += geo.index.count / 3;
        } else {
          triangles += (geo.attributes.position?.count || 0) / 3;
        }
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach(m => { if (m) materialSet.add(m.uuid); });
      }
    });

    materialCount = materialSet.size;

    // Bounding box (of the scaled object in scene)
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());

    return {
      vertices: Math.round(vertices),
      triangles: Math.round(triangles),
      meshCount,
      materialCount,
      boundingBox: { x: size.x, y: size.y, z: size.z }
    };
  }

  getRenderInfo() {
    const info = this.viewer?.renderer?.info;
    if (!info) return null;
    return {
      drawCalls: info.render?.calls ?? 0,
      trianglesRendered: info.render?.triangles ?? 0,
      geometriesInGPU: info.memory?.geometries ?? 0,
      texturesInGPU: info.memory?.textures ?? 0
    };
  }

  // --- Textures ---

  getTextureInfo() {
    const obj = this.viewer?.loadedObject;
    if (!obj) return [];

    const textures = [];
    const seen = new Set();

    obj.traverse((child) => {
      if (!child.isMesh && !child.isPoints) return;
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
    const obj = this.viewer?.loadedObject;
    if (!obj) return;

    obj.traverse((child) => {
      if (!child.isMesh && !child.isPoints) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((mat, matIdx) => {
        if (!mat) return;
        const key = `${child.uuid}_${matIdx}_${type}`;

        if (!enabled) {
          // Store original and disable
          if (mat[type] && !this._originalTextures.has(key)) {
            this._originalTextures.set(key, mat[type]);
          }
          if (mat[type]) {
            mat[type] = null;
            mat.needsUpdate = true;
          }
        } else {
          // Restore original
          const original = this._originalTextures.get(key);
          if (original) {
            mat[type] = original;
            mat.needsUpdate = true;
          }
        }
      });
    });
  }

  // --- Wireframe ---

  setWireframe(enabled) {
    const obj = this.viewer?.loadedObject;
    if (!obj) return;

    obj.traverse((child) => {
      if (!child.isMesh && !child.isPoints) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach(mat => {
        if (mat) mat.wireframe = enabled;
      });
    });
  }

  // --- Animations ---

  getAnimations() {
    return this.viewer?.getAnimationList() || [];
  }

  playAnimation(index) {
    this.viewer?.playAnimationByIndex(index);
  }

  togglePlayback() {
    this.viewer?.togglePlayback();
  }

  isPlaying() {
    return this.viewer?.isAnimationPlaying ?? false;
  }

  seek(time) {
    this.viewer?.seekAnimation(time);
  }

  getCurrentTime() {
    return this.viewer?.getAnimationTime() ?? 0;
  }

  getDuration() {
    return this.viewer?.getAnimationDuration() ?? 0;
  }

  setPlaybackSpeed(speed) {
    this.viewer?.setAnimationSpeed(speed);
  }

  // --- Scene Controls ---

  setGridVisible(visible) {
    if (!this.viewer?.scene) return;

    if (visible && !this._gridHelper) {
      this._gridHelper = new THREE.GridHelper(10, 20, 0x555555, 0x333333);
      this._gridHelper.position.y = -0.75; // slightly below model center
      this.viewer.scene.add(this._gridHelper);
    } else if (!visible && this._gridHelper) {
      this.viewer.scene.remove(this._gridHelper);
      this._gridHelper.dispose();
      this._gridHelper = null;
    }
  }

  setBackground(type) {
    if (!this.viewer?.renderer) return;
    const colors = {
      dark: 0x3a3a3a,
      light: 0xe8e8e8,
      black: 0x111111,
      white: 0xffffff,
      checker: 0x888888 // Simplified - real checkerboard needs scene background texture
    };
    const color = colors[type] ?? colors.dark;
    this.viewer.renderer.setClearColor(color);
  }

  resetCamera() {
    if (!this.viewer?.controls || !this.viewer?.camera) return;
    this.viewer.controls.reset();
    this.viewer.camera.position.set(0, 1.6, 3);
    this.viewer.camera.lookAt(0, 0, 0);
  }

  setAutoRotate(enabled) {
    if (this.viewer?.controls) {
      this.viewer.controls.autoRotate = enabled;
      this.viewer.controls.autoRotateSpeed = 2.0;
    }
  }

  setLightingPreset(name) {
    const scene = this.viewer?.scene;
    if (!scene) return;

    // Remove existing lights
    const lightsToRemove = [];
    scene.traverse(child => {
      if (child.isLight) lightsToRemove.push(child);
    });
    lightsToRemove.forEach(l => scene.remove(l));

    const presets = {
      default: () => {
        scene.add(new THREE.AmbientLight(0xffffff, 0.8));
        const dir = new THREE.DirectionalLight(0xffffff, 0.8);
        dir.position.set(0.5, 1, 0.5);
        scene.add(dir);
      },
      studio: () => {
        scene.add(new THREE.AmbientLight(0xffffff, 0.4));
        const key = new THREE.DirectionalLight(0xffffff, 1.0);
        key.position.set(2, 3, 2);
        scene.add(key);
        const fill = new THREE.DirectionalLight(0xaaccff, 0.4);
        fill.position.set(-2, 1, 0);
        scene.add(fill);
        const rim = new THREE.DirectionalLight(0xffddaa, 0.3);
        rim.position.set(0, 1, -2);
        scene.add(rim);
      },
      outdoor: () => {
        scene.add(new THREE.AmbientLight(0x87ceeb, 0.6));
        const sun = new THREE.DirectionalLight(0xfff4e0, 1.2);
        sun.position.set(3, 5, 2);
        scene.add(sun);
      },
      dark: () => {
        scene.add(new THREE.AmbientLight(0x222233, 0.3));
        const spot = new THREE.DirectionalLight(0xffffff, 0.6);
        spot.position.set(1, 2, 1);
        scene.add(spot);
      },
      flat: () => {
        scene.add(new THREE.AmbientLight(0xffffff, 1.2));
      }
    };

    (presets[name] || presets.default)();
  }

  // --- Helpers ---

  hasSkeleton() {
    const obj = this.viewer?.loadedObject;
    if (!obj) return false;
    let found = false;
    obj.traverse(child => {
      if (child.isSkinnedMesh || child.isBone) found = true;
    });
    return found;
  }

  setBoundsVisible(visible) {
    const obj = this.viewer?.loadedObject;
    const scene = this.viewer?.scene;
    if (!obj || !scene) return;

    if (visible && !this._boxHelper) {
      this._boxHelper = new THREE.BoxHelper(obj, 0x9b77ff);
      scene.add(this._boxHelper);
    } else if (!visible && this._boxHelper) {
      scene.remove(this._boxHelper);
      this._boxHelper.dispose();
      this._boxHelper = null;
    }
  }

  async setNormalsVisible(visible) {
    const obj = this.viewer?.loadedObject;
    const scene = this.viewer?.scene;
    if (!obj || !scene) return;

    if (visible && this._normalsHelpers.length === 0) {
      try {
        const { VertexNormalsHelper } = await import('three/addons/helpers/VertexNormalsHelper.js');
        obj.traverse(child => {
          if (child.isMesh || child.isPoints) {
            const helper = new VertexNormalsHelper(child, 0.05, 0x00ff88);
            scene.add(helper);
            this._normalsHelpers.push(helper);
          }
        });
      } catch (err) {
        console.warn('Failed to load VertexNormalsHelper:', err);
      }
    } else if (!visible && this._normalsHelpers.length > 0) {
      this._normalsHelpers.forEach(h => {
        scene.remove(h);
        h.dispose();
      });
      this._normalsHelpers = [];
    }
  }

  setSkeletonVisible(visible) {
    const obj = this.viewer?.loadedObject;
    const scene = this.viewer?.scene;
    if (!obj || !scene) return;

    if (visible && !this._skeletonHelper) {
      this._skeletonHelper = new THREE.SkeletonHelper(obj);
      scene.add(this._skeletonHelper);
    } else if (!visible && this._skeletonHelper) {
      scene.remove(this._skeletonHelper);
      this._skeletonHelper.dispose();
      this._skeletonHelper = null;
    }
  }

  // --- Draco Detection ---

  async detectDraco() {
    return false; // Draco does not apply to FBX format
  }

  // --- Public accessors for tools ---

  getModelRoot() {
    return this.viewer?.loadedObject || null;
  }

  getScene() {
    return this.viewer?.scene || null;
  }

  getAnimationClips() {
    return this.viewer?.animations || [];
  }

  getAllMaterials() {
    const obj = this.viewer?.loadedObject;
    if (!obj) return [];
    const mats = [];
    const seen = new Set();
    obj.traverse(child => {
      if (!child.isMesh && !child.isPoints) return;
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
    const obj = this.viewer?.loadedObject;
    if (!obj) return [];
    const meshes = [];
    obj.traverse(child => {
      if (child.isMesh || child.isPoints) meshes.push(child);
    });
    return meshes;
  }

  // --- Screenshot ---

  async takeScreenshot() {
    const renderer = this.viewer?.renderer;
    if (!renderer) return null;

    // Force a render
    if (this.viewer.scene && this.viewer.camera) {
      renderer.render(this.viewer.scene, this.viewer.camera);
    }

    return new Promise(resolve => {
      renderer.domElement.toBlob(blob => resolve(blob), 'image/png');
    });
  }

  // --- Lifecycle ---

  dispose() {
    // Restore all textures
    this._originalTextures.forEach((tex, key) => {
      // Try to restore - best effort
    });
    this._originalTextures.clear();

    // Remove helpers
    const scene = this.viewer?.scene;
    if (scene) {
      if (this._gridHelper) {
        scene.remove(this._gridHelper);
        this._gridHelper.dispose();
      }
      if (this._boxHelper) {
        scene.remove(this._boxHelper);
        this._boxHelper.dispose();
      }
      if (this._skeletonHelper) {
        scene.remove(this._skeletonHelper);
        this._skeletonHelper.dispose();
      }
      this._normalsHelpers.forEach(h => {
        scene.remove(h);
        h.dispose();
      });
    }

    this._gridHelper = null;
    this._boxHelper = null;
    this._skeletonHelper = null;
    this._normalsHelpers = [];
    this.viewer = null;
  }
}
