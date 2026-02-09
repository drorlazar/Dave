// test_text_files.js - Test text file loading and viewer functionality

import { test, expect } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_FILES_DIR = path.resolve(__dirname, '../../test_text_files');

// Helper: drop files onto viewerContainer
async function dropFiles(page, filePaths) {
  const inputId = 'test-text-input-' + Date.now();

  await page.evaluate((id) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.id = id;
    input.multiple = true;
    input.style.display = 'none';
    document.body.appendChild(input);
  }, inputId);

  const fileInput = page.locator(`#${inputId}`);
  await fileInput.setInputFiles(filePaths);

  await page.evaluate((id) => {
    const input = document.getElementById(id);
    const dataTransfer = new DataTransfer();
    for (const file of input.files) {
      dataTransfer.items.add(file);
    }
    const dropEvent = new DragEvent('drop', {
      bubbles: true,
      cancelable: true,
      dataTransfer: dataTransfer
    });
    document.getElementById('viewerContainer').dispatchEvent(dropEvent);
  }, inputId);
}

test.describe('Text File Support', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Text files appear in grid after drag and drop', async ({ page }) => {
    const files = [
      path.join(TEST_FILES_DIR, 'notes.txt'),
      path.join(TEST_FILES_DIR, 'readme.md'),
      path.join(TEST_FILES_DIR, 'sample.json'),
      path.join(TEST_FILES_DIR, 'config.yaml'),
      path.join(TEST_FILES_DIR, 'data.csv'),
      path.join(TEST_FILES_DIR, 'app.log'),
    ];

    await dropFiles(page, files);
    await page.waitForTimeout(2000);

    // All 6 files should appear as tiles
    const tiles = page.locator('.model-tile');
    await expect(tiles).toHaveCount(6);

    // Verify each file is present by name
    for (const name of ['notes.txt', 'readme.md', 'sample.json', 'config.yaml', 'data.csv', 'app.log']) {
      const tile = page.locator(`.model-tile[data-model-name="${name}"]`);
      await expect(tile).toBeVisible();
    }
  });

  test('Text tiles show preview content and format badge', async ({ page }) => {
    await dropFiles(page, [path.join(TEST_FILES_DIR, 'sample.json')]);
    await page.waitForTimeout(2000);

    const tile = page.locator('.model-tile[data-model-name="sample.json"]');
    await expect(tile).toBeVisible();

    // Should have a text-preview element
    const preview = tile.locator('.text-preview');
    await expect(preview).toBeVisible();

    // Should have format badge
    const badge = tile.locator('.text-format-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText('JSON');

    // Should have pre content with actual file text
    const content = tile.locator('.text-preview-content');
    await expect(content).toBeVisible();
    const text = await content.textContent();
    expect(text).toContain('"name"');
  });

  test('Markdown file shows MD badge', async ({ page }) => {
    await dropFiles(page, [path.join(TEST_FILES_DIR, 'readme.md')]);
    await page.waitForTimeout(2000);

    const badge = page.locator('.model-tile[data-model-name="readme.md"] .text-format-badge');
    await expect(badge).toHaveText('MD');
  });

  test('Fullscreen viewer opens for text file', async ({ page }) => {
    await dropFiles(page, [path.join(TEST_FILES_DIR, 'notes.txt')]);
    await page.waitForTimeout(2000);

    // Click fullscreen button
    const fsBtn = page.locator('.model-tile[data-model-name="notes.txt"] .fullscreen-btn');
    await fsBtn.click();
    await page.waitForTimeout(1000);

    // Overlay should be visible
    const overlay = page.locator('#fullscreenOverlay');
    await expect(overlay).toBeVisible();

    // Should have the text fullscreen wrapper
    const wrapper = page.locator('.text-fullscreen-wrapper');
    await expect(wrapper).toBeVisible();

    // Should have toolbar
    const toolbar = page.locator('.text-toolbar');
    await expect(toolbar).toBeVisible();

    // Should have content area with the file text
    const pre = page.locator('.text-fullscreen-pre');
    await expect(pre).toBeVisible();
    const text = await pre.textContent();
    expect(text).toContain('Assets Viewing Experience');
  });

  test('Fullscreen zoom controls work', async ({ page }) => {
    await dropFiles(page, [path.join(TEST_FILES_DIR, 'notes.txt')]);
    await page.waitForTimeout(2000);

    const fsBtn = page.locator('.model-tile[data-model-name="notes.txt"] .fullscreen-btn');
    await fsBtn.click();
    await page.waitForTimeout(1000);

    const pre = page.locator('.text-fullscreen-pre');
    const initialSize = await pre.evaluate(el => parseFloat(getComputedStyle(el).fontSize));

    // Click zoom in
    const zoomIn = page.locator('.text-toolbar-btn').filter({ has: page.locator('.fa-plus') });
    await zoomIn.click();
    await page.waitForTimeout(200);

    const newSize = await pre.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
    expect(newSize).toBeGreaterThan(initialSize);

    // Click zoom out
    const zoomOut = page.locator('.text-toolbar-btn').filter({ has: page.locator('.fa-minus') });
    await zoomOut.click();
    await zoomOut.click();
    await page.waitForTimeout(200);

    const smallerSize = await pre.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
    expect(smallerSize).toBeLessThan(newSize);
  });

  test('Word wrap toggle works', async ({ page }) => {
    await dropFiles(page, [path.join(TEST_FILES_DIR, 'notes.txt')]);
    await page.waitForTimeout(2000);

    const fsBtn = page.locator('.model-tile[data-model-name="notes.txt"] .fullscreen-btn');
    await fsBtn.click();
    await page.waitForTimeout(1000);

    const pre = page.locator('.text-fullscreen-pre');

    // Word wrap is on by default
    await expect(pre).toHaveClass(/text-wrap/);

    // Click wrap toggle (align-left icon)
    const wrapBtn = page.locator('.text-toolbar-btn').filter({ has: page.locator('.fa-align-left') });
    await wrapBtn.click();
    await page.waitForTimeout(200);

    // Word wrap should be off now
    await expect(pre).not.toHaveClass(/text-wrap/);

    // Toggle back on
    await wrapBtn.click();
    await page.waitForTimeout(200);
    await expect(pre).toHaveClass(/text-wrap/);
  });

  test('Line numbers toggle works', async ({ page }) => {
    await dropFiles(page, [path.join(TEST_FILES_DIR, 'notes.txt')]);
    await page.waitForTimeout(2000);

    const fsBtn = page.locator('.model-tile[data-model-name="notes.txt"] .fullscreen-btn');
    await fsBtn.click();
    await page.waitForTimeout(1000);

    const pre = page.locator('.text-fullscreen-pre');

    // Line numbers on by default
    await expect(pre).toHaveClass(/text-line-numbers/);
    const lineNums = page.locator('.text-line-number');
    const count = await lineNums.count();
    expect(count).toBeGreaterThan(0);

    // Toggle off
    const lineNumBtn = page.locator('.text-toolbar-btn').filter({ has: page.locator('.fa-list-ol') });
    await lineNumBtn.click();
    await page.waitForTimeout(200);

    await expect(pre).not.toHaveClass(/text-line-numbers/);
  });

  test('JSON formatted toggle works', async ({ page }) => {
    await dropFiles(page, [path.join(TEST_FILES_DIR, 'sample.json')]);
    await page.waitForTimeout(2000);

    const fsBtn = page.locator('.model-tile[data-model-name="sample.json"] .fullscreen-btn');
    await fsBtn.click();
    await page.waitForTimeout(1000);

    // Click the format toggle (indent icon)
    const formatBtn = page.locator('.text-toolbar-btn').filter({ has: page.locator('.fa-indent') });
    await expect(formatBtn).toBeVisible();
    await formatBtn.click();
    await page.waitForTimeout(200);

    // Button should be active
    await expect(formatBtn).toHaveClass(/active/);

    // Content should contain formatted JSON
    const pre = page.locator('.text-fullscreen-pre');
    const text = await pre.textContent();
    expect(text).toContain('"name"');
  });

  test('Markdown rendered toggle works', async ({ page }) => {
    await dropFiles(page, [path.join(TEST_FILES_DIR, 'readme.md')]);
    await page.waitForTimeout(2000);

    const fsBtn = page.locator('.model-tile[data-model-name="readme.md"] .fullscreen-btn');
    await fsBtn.click();
    await page.waitForTimeout(1000);

    // Click the render toggle (eye icon)
    const renderBtn = page.locator('.text-toolbar-btn').filter({ has: page.locator('.fa-eye') });
    await expect(renderBtn).toBeVisible();
    await renderBtn.click();
    await page.waitForTimeout(200);

    // Should show rendered markdown
    const pre = page.locator('.text-fullscreen-pre');
    await expect(pre).toHaveClass(/text-rendered-md/);

    // Should contain rendered HTML elements
    const h1 = pre.locator('h1');
    await expect(h1).toBeVisible();

    const strong = pre.locator('strong');
    const count = await strong.count();
    expect(count).toBeGreaterThan(0);
  });

  test('Copy button works', async ({ page }) => {
    await dropFiles(page, [path.join(TEST_FILES_DIR, 'notes.txt')]);
    await page.waitForTimeout(2000);

    const fsBtn = page.locator('.model-tile[data-model-name="notes.txt"] .fullscreen-btn');
    await fsBtn.click();
    await page.waitForTimeout(1000);

    // Grant clipboard permissions
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

    // Click copy button
    const copyBtn = page.locator('.text-toolbar-btn').filter({ has: page.locator('.fa-copy') });
    await copyBtn.click();
    await page.waitForTimeout(500);

    // Button should temporarily show checkmark
    const checkIcon = copyBtn.locator('.fa-check');
    await expect(checkIcon).toBeVisible();
  });

  test('Text filter toggle hides/shows text files', async ({ page }) => {
    await dropFiles(page, [
      path.join(TEST_FILES_DIR, 'notes.txt'),
      path.join(TEST_FILES_DIR, 'sample.json'),
    ]);
    await page.waitForTimeout(2000);

    // Should have 2 tiles
    await expect(page.locator('.model-tile')).toHaveCount(2);

    // Click the filter dropdown
    await page.click('#assetTypeFilterToggleBtn');
    await page.waitForTimeout(200);

    // Click the "Text" filter to disable it
    const textFilter = page.locator('.filter-option[data-type="text"]');
    await textFilter.click();
    await page.waitForTimeout(500);

    // Should have 0 tiles
    await expect(page.locator('.model-tile')).toHaveCount(0);

    // Re-enable
    await textFilter.click();
    await page.waitForTimeout(500);

    await expect(page.locator('.model-tile')).toHaveCount(2);
  });

  test('Keyboard shortcuts work in fullscreen', async ({ page }) => {
    await dropFiles(page, [path.join(TEST_FILES_DIR, 'notes.txt')]);
    await page.waitForTimeout(2000);

    const fsBtn = page.locator('.model-tile[data-model-name="notes.txt"] .fullscreen-btn');
    await fsBtn.click();
    await page.waitForTimeout(1000);

    const pre = page.locator('.text-fullscreen-pre');
    const initialSize = await pre.evaluate(el => parseFloat(getComputedStyle(el).fontSize));

    // Press + to zoom in
    await page.keyboard.press('+');
    await page.waitForTimeout(200);

    const largerSize = await pre.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
    expect(largerSize).toBeGreaterThan(initialSize);

    // Press - to zoom out
    await page.keyboard.press('-');
    await page.keyboard.press('-');
    await page.waitForTimeout(200);

    const smallerSize = await pre.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
    expect(smallerSize).toBeLessThan(largerSize);
  });
});
