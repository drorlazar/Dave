// test_ui_interactions.js - Test UI interactions

import { test, expect } from '@playwright/test';
import { TEST_CONFIG } from './test_config.js';
import { TestUtils, getFixtureFiles } from './test_utils.js';
import * as path from 'path';

test.describe('UI Interaction Tests', () => {
  let utils;

  // fbx, glb, jpg, mp3, mp4 - one tile per filter type used below
  const testFiles = [
    TEST_CONFIG.sampleFiles.fbx,
    TEST_CONFIG.sampleFiles.glb,
    TEST_CONFIG.sampleFiles.jpg,
    TEST_CONFIG.sampleFiles.mp3,
    TEST_CONFIG.sampleFiles.mp4
  ];

  test.beforeEach(async ({ page }) => {
    utils = new TestUtils(page);
    await utils.navigateToViewer();
    await utils.dropFiles(testFiles.map(f => path.join(TEST_CONFIG.testFolderPath, f)));
  });

  const tileNames = (page) =>
    page.locator('#viewerContainer .model-tile').evaluateAll(tiles => tiles.map(t => t.dataset.modelName));

  test('Search functionality with debouncing', async ({ page }) => {
    // Test search
    const startTime = Date.now();
    await utils.searchFor('fbx');

    // Verify debouncing (should wait ~300ms)
    const searchTime = Date.now() - startTime;
    expect(searchTime).toBeGreaterThan(250);

    // Verify search results
    const visibleTiles = await utils.getVisibleTiles();
    expect(visibleTiles).toBe(1); // Should only show FBX file

    // Clear search
    await page.fill('#searchInput', '');
    await page.waitForTimeout(350);

    // All files should be visible again
    const allTiles = await utils.getVisibleTiles();
    expect(allTiles).toBe(5);
  });

  test('Pagination controls', async ({ page }) => {
    // 25 distinct files: 2 pages at 20 per page
    await utils.dropFiles(getFixtureFiles(25));

    await utils.selectItemsPerPage(20);
    await expect(page.locator('.model-tile')).toHaveCount(20);
    expect(await utils.getPageInfo()).toEqual({ page: 1, total: 2 });
    await expect(page.locator('#prevPage')).toBeDisabled();

    // Navigate to page 2
    await page.click('#nextPage');
    await expect(page.locator('#pageInfo')).toHaveText('Page 2 of 2');
    await expect(page.locator('.model-tile')).toHaveCount(5);
    await expect(page.locator('#nextPage')).toBeDisabled();

    // And back
    await page.click('#prevPage');
    await expect(page.locator('#pageInfo')).toHaveText('Page 1 of 2');

    // 50 items per page fits everything on one page
    await utils.selectItemsPerPage(50);
    await expect(page.locator('.model-tile')).toHaveCount(25);
    await expect(page.locator('#pageInfo')).toHaveText('Page 1 of 1');
  });

  test('Sorting functionality', async ({ page }) => {
    // Default sort is by name, ascending
    await expect(page.locator('#sortBtn')).toContainText('Name');
    const ascNames = await tileNames(page);
    expect(ascNames).toEqual([...ascNames].sort((a, b) => a.localeCompare(b)));

    // Clicking the sort button itself flips the direction
    await page.click('#sortBtn');
    await expect.poll(() => tileNames(page)).toEqual([...ascNames].reverse());

    // Pick "size" from the sort dropdown (opens on hover)
    await page.hover('#sortBtn');
    await page.click('#sortDropdown .sort-option[data-value="size"]');
    await expect(page.locator('#sortBtn')).toContainText('Size');

    // Tiles are now ordered by file size (direction carried over: descending)
    const sizes = await page.locator('#viewerContainer .model-tile')
      .evaluateAll(tiles => tiles.map(t => t.model.size ?? t.model.file?.size ?? 0));
    expect(sizes).toEqual([...sizes].sort((a, b) => b - a));
  });

  test('Filter by file type', async ({ page }) => {
    const filterOption = (type) => page.locator(`.filter-option[data-type="${type}"]`);

    // All types start enabled; the eye button turns every type off
    await page.click('#assetTypeFilterToggleBtn');
    await expect(page.locator('.model-tile')).toHaveCount(0);

    // Enable the 3D model types (dropdown opens on hover)
    await page.hover('#assetTypeFilterToggleBtn');
    await filterOption('fbx').click();
    await filterOption('glb').click();
    await expect(page.locator('.model-tile')).toHaveCount(2);
    expect((await tileNames(page)).sort()).toEqual(
      [TEST_CONFIG.sampleFiles.fbx, TEST_CONFIG.sampleFiles.glb].sort()
    );

    // Add images
    await filterOption('image').click();
    await expect(page.locator('.model-tile')).toHaveCount(3);
    await expect(page.locator(`.model-tile[data-model-name="${TEST_CONFIG.sampleFiles.jpg}"]`)).toBeVisible();

    // Eye button with some types on turns all types back on
    await page.click('#assetTypeFilterToggleBtn');
    await expect(page.locator('.model-tile')).toHaveCount(5);
  });

  test('Theme toggle', async ({ page }) => {
    const isDark = () => page.evaluate(() => document.body.classList.contains('dark-mode'));

    const isDarkMode = await isDark();

    // Toggle theme
    await utils.toggleTheme();
    await expect.poll(isDark).toBe(!isDarkMode);

    // Toggle back
    await utils.toggleTheme();
    await expect.poll(isDark).toBe(isDarkMode);
  });

  test('Tile size slider', async ({ page }) => {
    // Get initial tile size
    const initialSize = await page.evaluate(() => {
      const tile = document.querySelector('.model-tile');
      return tile ? tile.offsetWidth : 0;
    });

    // Increase size
    await utils.setTileSize(300);
    await page.waitForTimeout(500);

    const largerSize = await page.evaluate(() => {
      const tile = document.querySelector('.model-tile');
      return tile ? tile.offsetWidth : 0;
    });

    expect(largerSize).toBeGreaterThan(initialSize);

    // Decrease size
    await utils.setTileSize(150);
    await page.waitForTimeout(500);

    const smallerSize = await page.evaluate(() => {
      const tile = document.querySelector('.model-tile');
      return tile ? tile.offsetWidth : 0;
    });

    expect(smallerSize).toBeLessThan(largerSize);
  });

  test('File selection', async ({ page }) => {
    const tiles = page.locator('#viewerContainer .model-tile');
    const firstTile = tiles.nth(0);
    const secondTile = tiles.nth(1);

    // A plain click on the tile body does not select it
    await firstTile.locator('.model-name, .video-name').click();
    await expect(firstTile).not.toHaveClass(/\bselected\b/);
    expect(await utils.getSelectionCount()).toBe(0);

    // The check indicator toggles selection
    await utils.toggleTileSelection(firstTile);
    await expect(firstTile).toHaveClass(/\bselected\b/);
    await expect(page.locator('#selectionDropdown')).toContainText('1 Selected');

    await utils.toggleTileSelection(secondTile);
    await expect(secondTile).toHaveClass(/\bselected\b/);
    await expect(page.locator('#selectionDropdown')).toContainText('2 Selected');

    // Toggling the first again deselects it
    await utils.toggleTileSelection(firstTile);
    await expect(firstTile).not.toHaveClass(/\bselected\b/);
    await expect(page.locator('#selectionDropdown')).toContainText('1 Selected');

    // Shift+click on an indicator selects the range from the last toggled
    // tile (the first one, index 0) through this one
    await utils.toggleTileSelection(tiles.nth(3), ['Shift']);
    await expect(page.locator('.model-tile.selected')).toHaveCount(4); // tiles 1-4
    await expect(tiles.nth(4)).not.toHaveClass(/\bselected\b/);
    await expect(page.locator('#selectionDropdown')).toContainText('4 Selected');
  });

  test('Tree folder view toggle', async ({ page }) => {
    // The panel is shown/hidden via the body.tree-panel-visible class
    const isTreeVisible = () => page.evaluate(() => document.body.classList.contains('tree-panel-visible'));
    const initiallyVisible = await isTreeVisible();

    expect(initiallyVisible).toBe(false); // fresh profile: panel starts closed

    // The side tab opens the panel
    await page.click('#treeFolderToggle');
    await expect.poll(isTreeVisible).toBe(true);
    await expect(page.locator('#treeFolderPanel')).toBeVisible();

    // The open panel covers the side tab; it is closed with its own X button
    await page.click('#treeClosePanel');
    await expect.poll(isTreeVisible).toBe(false);
  });

  test('Download selected file', async ({ page }) => {
    // There is no standalone download button any more; downloading is an
    // action in the selection dropdown.
    const fileName = TEST_CONFIG.sampleFiles.jpg;
    await utils.toggleTileSelection(fileName);
    await expect(page.locator('#selectionDropdown')).toContainText('1 Selected');

    await page.hover('#selectionDropdown');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('.selection-option[data-action="download"]')
    ]);

    // A single selected file downloads directly under its own name
    expect(download.suggestedFilename()).toBe(fileName);
  });

  test('Fullscreen mode navigation', async ({ page }) => {
    // Open fullscreen from the tile's expand button
    const fileName = TEST_CONFIG.sampleFiles.jpg;
    await utils.openFullscreen(fileName);

    // Check filename is displayed
    await expect(page.locator('#fullscreenOverlay .fullscreen-filename')).toHaveText(fileName);

    // Close fullscreen
    await utils.closeFullscreen();
    await expect(page.locator('#fullscreenOverlay .fullscreen-filename')).toHaveText('');
  });
});
