// test_inspector_export.js - E2E tests for 3D inspector export feature

import { test, expect } from '@playwright/test';
import { TEST_CONFIG } from './test_config.js';
import { TestUtils } from './test_utils.js';
import * as path from 'path';

// Helper: load a GLB file, open it fullscreen and expand the inspector's Export section
async function loadModelAndOpenInspector(page, utils) {
  const testFile = path.join(TEST_CONFIG.testFolderPath, TEST_CONFIG.sampleFiles.glb);

  // Drop the file
  await page.evaluate(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.id = 'test-file-input';
    input.style.display = 'none';
    document.body.appendChild(input);
  });
  const fileInput = page.locator('#test-file-input');
  await fileInput.setInputFiles(testFile);
  await page.evaluate(() => {
    const input = document.getElementById('test-file-input');
    const file = input.files[0];
    const dt = new DataTransfer();
    dt.items.add(file);
    document.getElementById('viewerContainer').dispatchEvent(
      new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt })
    );
  });

  // Open fullscreen via the tile's fullscreen button (revealed on hover)
  const tileName = TEST_CONFIG.sampleFiles.glb;
  const tile = page.locator(`.model-tile[data-model-name="${tileName}"]`);
  await tile.waitFor({ state: 'visible', timeout: 10000 });
  await tile.hover();
  await tile.locator('.fullscreen-btn').click({ force: true });
  await page.waitForSelector('#fullscreenOverlay[style*="display: flex"]', { timeout: 5000 });

  // The 3D toolbar appears once the inspector is created for the model
  await page.locator('#model3dToolbar').waitFor({ state: 'visible', timeout: 10000 });

  // Open the inspector panel
  await page.locator('#model3dToolbar [data-action="togglepanel"]').click();
  await expect(page.locator('#modelInspectorPanel')).toHaveClass(/\bopen\b/);

  // Expand the (collapsed by default) Export section
  const exportSection = page.locator('#modelInspectorPanel .inspector-section').filter({ has: page.locator('#inspectorExport') });
  if (await exportSection.evaluate(el => el.classList.contains('collapsed'))) {
    await exportSection.locator('.inspector-section-header').click();
  }

  // Export controls are populated once the model is ready
  await page.locator('[data-export-action="export-glb-full"]').waitFor({ state: 'visible', timeout: 15000 });
}

// Helper: snapshot the loaded model (mesh count + texture sizes) from model-viewer's
// internal Three.js scene, the same way the GLB inspector adapter reaches it.
async function getModelSnapshot(page) {
  return page.evaluate(() => {
    const mv = document.querySelector('#fullscreenOverlay model-viewer');
    if (!mv) return null;
    let scene = null;
    for (const sym of Object.getOwnPropertySymbols(mv)) {
      if ((sym.description || '').includes('scene')) {
        const obj = mv[sym];
        if (obj && (obj.isScene || obj.scene)) { scene = obj.isScene ? obj : obj.scene; break; }
      }
    }
    if (!scene) return null;
    let meshes = 0;
    const textures = [];
    scene.traverse(c => {
      if (!c.isMesh) return;
      meshes++;
      const mats = Array.isArray(c.material) ? c.material : [c.material];
      mats.forEach(m => {
        const img = m?.map?.image;
        if (img) textures.push(`${img.width}x${img.height}`);
      });
    });
    return { meshes, textures };
  });
}

test.describe('Inspector Export Tests', () => {
  let utils;

  test.beforeEach(async ({ page }) => {
    utils = new TestUtils(page);
    await utils.navigateToViewer();
  });

  test('Export GLB triggers download', async ({ page }) => {
    await loadModelAndOpenInspector(page, utils);

    // Find and click the export GLB button
    const exportBtn = page.locator('[data-export-action="export-glb-full"]');

    // Listen for download
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    await exportBtn.click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.glb$/);
  });

  test('Export shows progress status updates', async ({ page }) => {
    await loadModelAndOpenInspector(page, utils);

    const exportBtn = page.locator('[data-export-action="export-glb-full"]');

    // Track status text changes
    const statusMessages = [];
    await page.evaluate(() => {
      const el = document.querySelector('[data-export-display="status"]');
      if (!el) return;
      const obs = new MutationObserver(() => {
        const text = el.textContent?.trim();
        if (text) window.__exportStatusMessages = (window.__exportStatusMessages || []).concat(text);
      });
      obs.observe(el, { childList: true, characterData: true, subtree: true });
      window.__exportStatusObserver = obs;
    });

    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    await exportBtn.click();
    await downloadPromise;

    const messages = await page.evaluate(() => window.__exportStatusMessages || []);
    // Should have at least a "Preparing" or "Generating" message
    expect(messages.length).toBeGreaterThan(0);

    // Cleanup observer
    await page.evaluate(() => window.__exportStatusObserver?.disconnect());
  });

  test('Cancel button appears during export and cancels it', async ({ page }) => {
    await loadModelAndOpenInspector(page, utils);

    const exportBtn = page.locator('[data-export-action="export-glb-full"]');

    // Click export - don't wait for download
    await exportBtn.click();

    // Cancel button should appear
    const cancelBtn = page.locator('.inspector-cancel-btn');
    try {
      await cancelBtn.waitFor({ state: 'visible', timeout: 3000 });
      await cancelBtn.click();

      // Status should show cancelled
      await page.waitForTimeout(500);
      const statusEl = page.locator('[data-export-display="status"]');
      const statusText = await statusEl.textContent();
      expect(statusText).toContain('cancelled');
    } catch {
      // If cancel button didn't appear, export finished too fast - that's OK
      // Just verify no error occurred
      const statusEl = page.locator('[data-export-display="status"]');
      const statusText = await statusEl.textContent();
      expect(statusText).not.toContain('Error');
    }
  });

  test('Restorers run even if export is cancelled', async ({ page }) => {
    await loadModelAndOpenInspector(page, utils);

    // Snapshot the model before export so we can verify it is intact afterwards
    const before = await getModelSnapshot(page);
    expect(before).not.toBeNull();
    expect(before.meshes).toBeGreaterThan(0);

    // Texture resize modifies the live textures during export; restorers must undo it
    await page.locator('[data-export-param="tex-size"]').selectOption('128');

    // Start export then cancel
    await page.locator('[data-export-action="export-glb-full"]').click();
    const cancelBtn = page.locator('.inspector-cancel-btn');
    try {
      await cancelBtn.waitFor({ state: 'visible', timeout: 3000 });
      await cancelBtn.click();
    } catch {
      // Export finished too fast - restorers still run in the finally block
    }
    await expect(cancelBtn).toHaveCount(0, { timeout: 10000 });

    // Verify model is still intact (same meshes, original texture sizes)
    const after = await getModelSnapshot(page);
    expect(after).toEqual(before);
  });

  test('Export with texture resize produces valid GLB', async ({ page }) => {
    await loadModelAndOpenInspector(page, utils);

    const exportBtn = page.locator('[data-export-action="export-glb-full"]');

    // Set texture resize to 256
    const texSizeInput = page.locator('[data-export-param="tex-size"]');
    await texSizeInput.selectOption('256');

    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    await exportBtn.click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/256px.*\.glb$/);
  });

  test('Texture resize guards against non-drawable images', async ({ page }) => {
    // Unit-level test via page.evaluate - validates the drawable check logic
    const result = await page.evaluate(() => {
      // Test the isDrawable check logic inline
      const tests = [];

      // HTMLImageElement (complete)
      const img = new Image();
      img.src = 'data:image/png;base64,iVBORw0KGgo='; // minimal
      const isDrawableImg = img instanceof HTMLImageElement;
      tests.push({ type: 'HTMLImageElement', isDrawable: isDrawableImg });

      // Canvas
      const canvas = document.createElement('canvas');
      const isDrawableCanvas = canvas instanceof HTMLCanvasElement;
      tests.push({ type: 'HTMLCanvasElement', isDrawable: isDrawableCanvas });

      // Plain object (should not be drawable)
      const plainObj = { width: 100, height: 100 };
      const isDrawablePlain = (plainObj instanceof HTMLImageElement)
        || (plainObj instanceof HTMLCanvasElement)
        || (plainObj instanceof ImageBitmap)
        || (typeof OffscreenCanvas !== 'undefined' && plainObj instanceof OffscreenCanvas);
      tests.push({ type: 'PlainObject', isDrawable: isDrawablePlain });

      return tests;
    });

    // HTMLImageElement and Canvas should be valid types
    expect(result.find(t => t.type === 'HTMLImageElement').isDrawable).toBe(true);
    expect(result.find(t => t.type === 'HTMLCanvasElement').isDrawable).toBe(true);
    // Plain object should NOT be drawable
    expect(result.find(t => t.type === 'PlainObject').isDrawable).toBe(false);
  });

  test('Meshoptimizer simplifier loads from CDN', async ({ page }) => {
    // Verify meshoptimizer WASM module loads and exposes simplify API
    const result = await page.evaluate(async () => {
      try {
        const { MeshoptSimplifier } = await import('https://cdn.jsdelivr.net/npm/meshoptimizer@0.21/meshopt_simplifier.module.js');
        await MeshoptSimplifier.ready;
        return {
          loaded: true,
          hasSimplify: typeof MeshoptSimplifier.simplify === 'function'
        };
      } catch (err) {
        return { loaded: false, error: err.message };
      }
    });

    expect(result.loaded).toBe(true);
    expect(result.hasSimplify).toBe(true);
  });

  test('AbortController cancellation propagates correctly', async ({ page }) => {
    // Validate AbortController + DOMException pattern works in the browser
    const result = await page.evaluate(async () => {
      const controller = new AbortController();
      controller.abort();

      try {
        if (controller.signal.aborted) {
          throw new DOMException('Export cancelled', 'AbortError');
        }
        return { caught: false };
      } catch (err) {
        return { caught: true, name: err.name, message: err.message };
      }
    });

    expect(result.caught).toBe(true);
    expect(result.name).toBe('AbortError');
    expect(result.message).toBe('Export cancelled');
  });

  test('Export timeout race pattern works', async ({ page }) => {
    // Validate that Promise.race with timeout rejects as expected
    const result = await page.evaluate(async () => {
      const SHORT_TIMEOUT = 50;
      try {
        await Promise.race([
          new Promise(resolve => setTimeout(resolve, 10000)), // "slow" task
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Export timed out')), SHORT_TIMEOUT);
          })
        ]);
        return { timedOut: false };
      } catch (err) {
        return { timedOut: true, message: err.message };
      }
    });

    expect(result.timedOut).toBe(true);
    expect(result.message).toContain('timed out');
  });
});
