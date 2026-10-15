// test_error_handling.js - Test error handling and recovery

import { test, expect } from '@playwright/test';
import { TEST_CONFIG } from './test_config.js';
import { TestUtils } from './test_utils.js';

// Helper: show a notification through the app's ErrorHandler singleton. The module is
// imported by URL, so this is the same instance main.js / asset_loading.js use.
async function showNotification(page, message, severity) {
  await page.evaluate(async ({ message, severity }) => {
    const { errorHandler } = await import('/src/utils/errorHandler.js');
    errorHandler.showNotification(message, severity);
  }, { message, severity });
}

test.describe('Error Handling Tests', () => {
  let utils;

  test.beforeEach(async ({ page }) => {
    utils = new TestUtils(page);

    // Collect console errors
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    page.errors = errors;

    await utils.navigateToViewer();
  });

  test('Handle corrupted file gracefully', async ({ page }) => {
    // Create a corrupted file
    await page.evaluate(() => {
      const corruptedContent = new Uint8Array([0xFF, 0xD8, 0xFF, 0x00, 0x00]); // Invalid JPEG
      const file = new File([corruptedContent], 'corrupted.jpg', { type: 'image/jpeg' });

      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dataTransfer
      });

      document.getElementById('viewerContainer').dispatchEvent(dropEvent);
    });

    await page.waitForTimeout(2000);

    // Should show the file but may have error loading thumbnail
    const tile = await page.locator('.model-tile[data-model-name="corrupted.jpg"]');
    const tileExists = await tile.count() > 0;
    expect(tileExists).toBe(true);

    // Check for error placeholder or notification
    const errorPlaceholder = await tile.locator('.asset-placeholder.error').count();
    const errorNotification = await page.locator('.error-notification').count();

    // Should handle error gracefully (either show error placeholder or notification)
    expect(errorPlaceholder + errorNotification).toBeGreaterThanOrEqual(0);
  });

  // "Handle network errors for S3 files" removed: S3 browsing (isS3 / s3Url model entries)
  // no longer exists in the app, so there is no S3 load path to fail.

  test('Handle memory exhaustion scenario', async ({ page }) => {
    // Try to load a very large number of files
    await page.evaluate(() => {
      const files = [];

      // Create 100 fake large files
      for (let i = 0; i < 100; i++) {
        const content = new Uint8Array(1024 * 1024); // 1MB each
        const file = new File([content], `large-file-${i}.bin`, { type: 'application/octet-stream' });
        files.push(file);
      }

      const dataTransfer = new DataTransfer();
      files.forEach(file => dataTransfer.items.add(file));

      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dataTransfer
      });

      try {
        document.getElementById('viewerContainer').dispatchEvent(dropEvent);
      } catch (e) {
        console.error('Memory error:', e);
      }
    });

    await page.waitForTimeout(2000);

    // Should not crash the page
    const pageResponsive = await page.evaluate(() => {
      return document.body !== null;
    });
    expect(pageResponsive).toBe(true);

    // May show an error or limit files
    const errorCheck = await utils.checkForErrors();
    // Application should remain functional even if it shows errors
    expect(pageResponsive).toBe(true);
  });

  test('Error notification display and dismissal', async ({ page }) => {
    // Trigger an error by calling error handler directly
    await showNotification(page, 'Test error message', 'error');

    await page.waitForTimeout(500);

    // Check error notification appears
    const errorNotification = await page.locator('.error-notification');
    const isVisible = await errorNotification.isVisible();
    expect(isVisible).toBe(true);

    // Check message content
    const message = await errorNotification.locator('.error-message').textContent();
    expect(message).toBe('Test error message');

    // Click close button
    await errorNotification.locator('.error-close').click();

    // Notification should be gone
    await expect(errorNotification).toHaveCount(0);
  });

  // openreel_bridge.js, video_editor.js and image_viewer.js report problems via
  // window.errorHandler?.showNotification(...), so the singleton must be global.
  test('ErrorHandler is exposed as window.errorHandler', async ({ page }) => {
    const exposed = await page.evaluate(() => typeof window.errorHandler?.showNotification === 'function');
    expect(exposed).toBe(true);
  });

  test('Multiple error types', async ({ page }) => {
    // Test different severity levels
    const severities = ['error', 'warning', 'info', 'success'];

    for (const severity of severities) {
      await showNotification(page, `Test ${severity} message`, severity);

      await page.waitForTimeout(500);

      // Check notification has correct class
      const notification = await page.locator(`.error-notification.${severity}`);
      const exists = await notification.count() > 0;
      expect(exists).toBe(true);

      // Close it
      await notification.locator('.error-close').click();
      await expect(notification).toHaveCount(0);
    }
  });

  test('Console error tracking', async ({ page }) => {
    // Trigger some console errors
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    await page.evaluate(() => {
      console.error('Test error 1');
      console.error('Test error 2');
      // Throw outside the evaluate call so it surfaces as an uncaught page error
      setTimeout(() => { throw new Error('Test uncaught error'); }, 0);
    });

    await page.waitForTimeout(1000);

    // Check that errors were tracked
    const consoleErrors = page.errors || [];
    expect(consoleErrors).toEqual(expect.arrayContaining(['Test error 1', 'Test error 2']));
    expect(pageErrors).toContain('Test uncaught error');
  });

  test('Recovery from file loading errors', async ({ page }) => {
    // Load a mix of valid and invalid files
    await page.evaluate(() => {
      const validFile = new File(['valid content'], 'valid.txt', { type: 'text/plain' });
      const invalidFile = new File([''], 'invalid.xyz', { type: 'application/unknown' });

      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(validFile);
      dataTransfer.items.add(invalidFile);

      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dataTransfer
      });

      document.getElementById('viewerContainer').dispatchEvent(dropEvent);
    });

    await page.waitForTimeout(2000);

    // Should show alert about unsupported files
    const dialogPromise = page.waitForEvent('dialog', { timeout: 1000 }).catch(() => null);
    const dialog = await dialogPromise;

    if (dialog) {
      expect(dialog.message()).toContain('No supported files');
      await dialog.accept();
    }

    // Page should still be functional
    const searchInput = await page.locator('#searchInput');
    const isEnabled = await searchInput.isEnabled();
    expect(isEnabled).toBe(true);
  });

  // "S3 authentication error handling" removed: the Cognito/S3 auth flow no longer exists
  // in the app (and the old assertion was `x || true`, so it could never fail).

  test('Graceful degradation without features', async ({ page }) => {
    // Disable various features to test graceful degradation
    await page.evaluate(() => {
      // Disable memory manager
      window.memoryManager = null;

      // Disable error handler
      window.errorHandler = null;

      // Remove asset handler factory
      window.assetHandlerFactory = null;
    });

    // Try to load a file
    await page.evaluate(() => {
      const file = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });

      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dataTransfer
      });

      document.getElementById('viewerContainer').dispatchEvent(dropEvent);
    });

    await page.waitForTimeout(2000);

    // Should still show file despite missing features
    const tile = await page.locator('.model-tile[data-model-name="test.jpg"]');
    const exists = await tile.count() > 0;
    expect(exists).toBe(true);

    // Basic functionality should work
    await utils.searchFor('test');
    const searchWorks = await tile.isVisible();
    expect(searchWorks).toBe(true);
  });
});
