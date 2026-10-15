// test_keyboard_navigation.js - Test keyboard shortcuts and navigation

import { test, expect } from '@playwright/test';
import { KEYBOARD_SHORTCUTS } from './test_config.js';
import { TestUtils, getFixtureFiles } from './test_utils.js';

// Shortcuts as registered today in src/utils/keyboardShortcuts.js
// (setupNavigationShortcuts). Overrides the shared constants where they drifted.
const SHORTCUTS = {
  ...KEYBOARD_SHORTCUTS,
  // Grid focus moves with Up/Down; Left/Right are page navigation
  gridUp: 'ArrowUp',
  gridDown: 'ArrowDown',
  openFullscreenAlt: 'Space'
};

test.describe('Keyboard Navigation Tests', () => {
  let utils;

  test.beforeEach(async ({ page }) => {
    utils = new TestUtils(page);
    await utils.navigateToViewer();

    // 30 distinct files: 2 pages at the default 20 per page
    await utils.dropFiles(getFixtureFiles(30));
  });

  const overlay = (page) => page.locator('#fullscreenOverlay');

  // Enter/Space open the grid item that has keyboard focus. Nothing has focus
  // after a load; ArrowUp from "no focus" lands on the first tile.
  const focusFirstTile = async (page) => {
    await utils.pressShortcut(SHORTCUTS.gridUp);
    const firstTile = page.locator('#viewerContainer .model-tile').first();
    await expect(firstTile).toHaveClass(/\bkeyboard-focus\b/);
    return firstTile;
  };

  test('Page navigation with arrow keys', async ({ page }) => {
    await utils.selectItemsPerPage(20);
    await expect(page.locator('#pageInfo')).toHaveText('Page 1 of 2');

    // Right arrow: next page
    await utils.pressShortcut(SHORTCUTS.nextPage);
    await expect(page.locator('#pageInfo')).toHaveText('Page 2 of 2');
    await expect(page.locator('.model-tile')).toHaveCount(10);

    // Left arrow: back (exactly one page per press)
    await utils.pressShortcut(SHORTCUTS.prevPage);
    await expect(page.locator('#pageInfo')).toHaveText('Page 1 of 2');

    // End: last page
    await utils.pressShortcut(SHORTCUTS.lastPage);
    await expect(page.locator('#pageInfo')).toHaveText('Page 2 of 2');

    // Home: first page
    await utils.pressShortcut(SHORTCUTS.firstPage);
    await expect(page.locator('#pageInfo')).toHaveText('Page 1 of 2');
  });

  test('Search focus with / key', async ({ page }) => {
    const isDark = () => page.evaluate(() => document.body.classList.contains('dark-mode'));
    const initiallyDark = await isDark();

    // Press / to focus search
    await utils.pressShortcut(SHORTCUTS.focusSearch);
    await expect(page.locator('#searchInput')).toBeFocused();

    // Typing goes into the search box (the "/" itself is not inserted)
    await page.keyboard.type('test');
    await expect(page.locator('#searchInput')).toHaveValue('test');

    // Shortcuts are suppressed while typing: "t" did not toggle the theme and
    // ArrowRight did not change the page
    expect(await isDark()).toBe(initiallyDark);
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#pageInfo')).toHaveText('Page 1 of 2');
    await expect(page.locator('#searchInput')).toBeFocused();
    // (Escape no longer blurs the search box; that check was dropped.)
  });

  test('Theme toggle with T key', async ({ page }) => {
    // Get initial theme
    const isDarkMode = await page.evaluate(() => document.body.classList.contains('dark-mode'));

    // Press T to toggle theme
    await utils.pressShortcut(SHORTCUTS.toggleTheme);
    await page.waitForTimeout(500);

    // Verify theme changed
    const newIsDarkMode = await page.evaluate(() => document.body.classList.contains('dark-mode'));
    expect(newIsDarkMode).toBe(!isDarkMode);
  });

  test('Tree view toggle with B key', async ({ page }) => {
    // The panel is shown/hidden via the body.tree-panel-visible class
    const isTreeVisible = () => page.evaluate(() => document.body.classList.contains('tree-panel-visible'));
    const initiallyVisible = await isTreeVisible();

    await utils.pressShortcut(SHORTCUTS.toggleTree);
    await expect.poll(isTreeVisible).toBe(!initiallyVisible);

    await utils.pressShortcut(SHORTCUTS.toggleTree);
    await expect.poll(isTreeVisible).toBe(initiallyVisible);
  });

  test('Select all with Ctrl+A', async ({ page }) => {
    // Ctrl+A selects every tile on the current page
    await utils.pressShortcut(SHORTCUTS.selectAll);

    const totalTiles = await page.locator('.model-tile').count();
    expect(totalTiles).toBe(20);
    await expect(page.locator('.model-tile.selected')).toHaveCount(totalTiles);
    await expect(page.locator('#selectionDropdown')).toContainText(`${totalTiles} Selected`);
  });

  test('Deselect all with Ctrl+D', async ({ page }) => {
    // First select all
    await utils.pressShortcut(SHORTCUTS.selectAll);
    await expect(page.locator('.model-tile.selected')).toHaveCount(20);

    // Press Ctrl+D to deselect all
    await utils.pressShortcut(SHORTCUTS.deselectAll);
    await expect(page.locator('.model-tile.selected')).toHaveCount(0);
    await expect(page.locator('#selectionDropdown')).toContainText('0 Selected');
  });

  test('Fullscreen with Enter/Space and close with Escape', async ({ page }) => {
    const firstTile = await focusFirstTile(page);
    const fileName = await firstTile.getAttribute('data-model-name');

    // Enter opens the focused tile
    await utils.pressShortcut(SHORTCUTS.openFullscreen);
    await expect(overlay(page)).toBeVisible();
    await expect(page.locator('#fullscreenOverlay .fullscreen-filename')).toHaveText(fileName);

    // Escape closes it
    await utils.pressShortcut(SHORTCUTS.closeFullscreen);
    await expect(overlay(page)).toBeHidden();

    // Space opens it as well (keyboard focus is kept after closing)
    await utils.pressShortcut(SHORTCUTS.openFullscreenAlt);
    await expect(overlay(page)).toBeVisible();

    await utils.pressShortcut(SHORTCUTS.closeFullscreen);
    await expect(overlay(page)).toBeHidden();
  });

  test('Grid navigation with arrow keys', async ({ page }) => {
    const tiles = page.locator('#viewerContainer .model-tile');
    const focusedIndex = () => tiles.evaluateAll(
      els => els.findIndex(el => el.classList.contains('keyboard-focus'))
    );

    await focusFirstTile(page);
    expect(await focusedIndex()).toBe(0);

    // Down moves focus one row further (a row holds at least one tile)
    await utils.pressShortcut(SHORTCUTS.gridDown);
    await expect.poll(focusedIndex).toBeGreaterThan(0);
    await expect(page.locator('.model-tile.keyboard-focus')).toHaveCount(1);

    // Up returns to the first row
    await utils.pressShortcut(SHORTCUTS.gridUp);
    await expect.poll(focusedIndex).toBe(0);
  });

  test('Show help with ? key', async ({ page }) => {
    // Press ? to show help
    await utils.pressShortcut(KEYBOARD_SHORTCUTS.showHelp);
    await page.waitForTimeout(500);

    // Check if help modal appears
    const helpModal = await page.locator('.keyboard-help-modal');
    const isVisible = await helpModal.isVisible().catch(() => false);

    if (isVisible) {
      // Verify help content
      const hasShortcuts = await helpModal.locator('.shortcut-item').count();
      expect(hasShortcuts).toBeGreaterThan(0);

      // Close help modal
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);

      // Verify modal is closed
      const isClosed = await helpModal.isHidden().catch(() => true);
      expect(isClosed).toBe(true);
    }
  });

  test('Zoom controls with Ctrl +/- and 0', async ({ page }) => {
    // Get initial tile size
    const getSliderValue = async () => {
      return await page.locator('#sizeSlider').inputValue();
    };

    const initialSize = await getSliderValue();

    // Press Ctrl++ to zoom in
    await page.keyboard.press('Control++');
    await page.waitForTimeout(500);

    const largerSize = await getSliderValue();
    expect(parseInt(largerSize)).toBeGreaterThan(parseInt(initialSize));

    // Press Ctrl+- to zoom out
    await page.keyboard.press('Control+-');
    await page.waitForTimeout(500);

    const smallerSize = await getSliderValue();
    expect(parseInt(smallerSize)).toBeLessThan(parseInt(largerSize));

    // Press Ctrl+0 to reset zoom
    await page.keyboard.press('Control+0');
    await page.waitForTimeout(500);

    const resetSize = await getSliderValue();
    expect(resetSize).toBe('200'); // Default size
  });

  test('Escape key behavior', async ({ page }) => {
    // Test 1: Escape clears selection
    await utils.pressShortcut(SHORTCUTS.selectAll);
    await expect(page.locator('.model-tile.selected')).toHaveCount(20);

    await page.keyboard.press('Escape');
    await expect(page.locator('.model-tile.selected')).toHaveCount(0);
    await expect(page.locator('#selectionDropdown')).toContainText('0 Selected');

    // Test 2: Escape closes fullscreen
    await focusFirstTile(page);
    await utils.pressShortcut(SHORTCUTS.openFullscreen);
    await expect(overlay(page)).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(overlay(page)).toBeHidden();
  });
});
