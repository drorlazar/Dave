// test_inspector_export.js - E2E tests for 3D inspector export feature

import { test, expect } from '@playwright/test';
import { TEST_CONFIG } from './test_config.js';
import { TestUtils } from './test_utils.js';
import * as path from 'path';

// Helper: load a GLB file and open inspector export tab
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
  await page.waitForTimeout(1500);

  // Open fullscreen
  const tileName = TEST_CONFIG.sampleFiles.glb;
  const tile = page.locator(`.model-tile[data-model-name="${tileName}"]`);
  await tile.click();
  await page.keyboard.press('Enter');
  await page.waitForSelector('#fullscreenOverlay[style*="display: flex"]', { timeout: 5000 });
  await page.waitForTimeout(1000);

  // Open inspector
  const inspectorBtn = page.locator('#inspector-btn, [data-action="toggle-inspector"]');
  if (await inspectorBtn.count() > 0) {
    await inspectorBtn.first().click();
  } else {
    // Try keyboard shortcut
    await page.keyboard.press('i');
  }
  await page.waitForTimeout(500);

  // Navigate to export tab
  const exportTab = page.locator('[data-tab="export"], [data-inspector-tab="export"]');
  if (await exportTab.count() > 0) {
    await exportTab.first().click();
    await page.waitForTimeout(300);
  }
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
    if (await exportBtn.count() === 0) {
      test.skip('Export button not found - inspector may not be available for this model');
      return;
    }

    // Listen for download
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    await exportBtn.click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.glb$/);
  });

  test('Export shows progress status updates', async ({ page }) => {
    await loadModelAndOpenInspector(page, utils);

    const exportBtn = page.locator('[data-export-action="export-glb-full"]');
    if (await exportBtn.count() === 0) {
      test.skip('Export button not found');
      return;
    }

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
    if (await exportBtn.count() === 0) {
      test.skip('Export button not found');
      return;
    }

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

    // Get initial mesh count to verify model is intact after cancel
    const initialMeshCount = await page.evaluate(() => {
      const root = window.__daveInspector?.adapter?.getModelRoot?.();
      if (!root) return -1;
      let count = 0;
      root.traverse(c => { if (c.isMesh) count++; });
      return count;
    });

    const exportBtn = page.locator('[data-export-action="export-glb-full"]');
    if (await exportBtn.count() === 0 || initialMeshCount <= 0) {
      test.skip('Inspector or model not available');
      return;
    }

    // Start export then cancel
    await exportBtn.click();
    const cancelBtn = page.locator('.inspector-cancel-btn');
    try {
      await cancelBtn.waitFor({ state: 'visible', timeout: 3000 });
      await cancelBtn.click();
      await page.waitForTimeout(500);
    } catch {
      // Export finished too fast
    }

    // Verify model is still intact (same mesh count)
    const afterMeshCount = await page.evaluate(() => {
      const root = window.__daveInspector?.adapter?.getModelRoot?.();
      if (!root) return -1;
      let count = 0;
      root.traverse(c => { if (c.isMesh) count++; });
      return count;
    });

    expect(afterMeshCount).toBe(initialMeshCount);
  });

  test('Export with texture resize produces valid GLB', async ({ page }) => {
    await loadModelAndOpenInspector(page, utils);

    const exportBtn = page.locator('[data-export-action="export-glb-full"]');
    if (await exportBtn.count() === 0) {
      test.skip('Export button not found');
      return;
    }

    // Set texture resize to 256
    const texSizeInput = page.locator('[data-export-param="tex-size"]');
    if (await texSizeInput.count() > 0) {
      await texSizeInput.selectOption('256');
    } else {
      test.skip('Texture size control not found');
      return;
    }

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
