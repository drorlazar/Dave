// test_utils.js - Test utility functions

import { expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { TEST_CONFIG } from './test_config.js';

// Extensions that show up as tiles with the default (all-on) type filters;
// used to pick deterministic fixture sets. Some loadable types (.gltf, .obj,
// .stl, .flac, .pdf, ...) match no filter category and are hidden from the
// grid, so they are left out here.
const MEDIA_EXTENSIONS = new Set([
  '.glb', '.fbx', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp',
  '.mp4', '.webm', '.mov', '.mp3', '.wav', '.ogg', '.ttf', '.otf', '.woff', '.woff2'
]);

// Absolute paths of the first `count` distinct media fixtures (sorted by name)
export function getFixtureFiles(count) {
  const names = fs.readdirSync(TEST_CONFIG.testFolderPath)
    .filter(name => MEDIA_EXTENSIONS.has(path.extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b));
  if (names.length < count) {
    throw new Error(`Need ${count} media fixtures but only ${names.length} exist in ${TEST_CONFIG.testFolderPath}`);
  }
  return names.slice(0, count).map(name => path.join(TEST_CONFIG.testFolderPath, name));
}

export class TestUtils {
  constructor(page) {
    this.page = page;
  }

  // Navigation helpers
  async navigateToViewer() {
    await this.page.goto(TEST_CONFIG.viewerUrl);
    await this.page.waitForLoadState('networkidle');
  }

  // File operation helpers
  async dragAndDropFile(filePath) {
    const fileInput = await this.page.locator('input[type="file"]');
    await fileInput.setInputFiles(filePath);
  }

  async dragAndDropFolder(folderPath) {
    // Simulate folder drop using File System Access API
    await this.page.evaluate((path) => {
      window.testFolderPath = path;
      // Trigger folder selection event
      document.dispatchEvent(new CustomEvent('test-folder-drop', { detail: { path } }));
    }, folderPath);
  }

  // Drop files onto the grid the way a user drag-and-drop does. A drop
  // replaces whatever was loaded before. Waits until `expectedTiles` tiles
  // (default: min(files, 20 per page)) are rendered.
  async dropFiles(filePaths, expectedTiles) {
    const inputId = `test-drop-input-${Date.now()}`;
    await this.page.evaluate((id) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.id = id;
      input.multiple = true;
      input.style.display = 'none';
      document.body.appendChild(input);
    }, inputId);

    await this.page.locator(`#${inputId}`).setInputFiles(filePaths);

    await this.page.evaluate((id) => {
      const input = document.getElementById(id);
      const dataTransfer = new DataTransfer();
      Array.from(input.files).forEach(file => dataTransfer.items.add(file));
      input.remove();
      document.getElementById('viewerContainer').dispatchEvent(new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer
      }));
    }, inputId);

    const tiles = this.page.locator('#viewerContainer .model-tile');
    await expect(tiles).toHaveCount(expectedTiles ?? Math.min(filePaths.length, 20));
  }

  // UI interaction helpers
  async searchFor(text) {
    const searchInput = await this.page.locator(TEST_CONFIG.uiElements.searchInput);
    await searchInput.fill(text);
    await this.page.waitForTimeout(350); // Wait for debounce
  }

  // Toolbar dropdowns open on hover (.dropdown gets .active on mouseenter)
  async selectItemsPerPage(count) {
    await this.page.hover('#itemsPerPageBtn');
    await this.page.click(`#itemsDropdown .items-option[data-value="${count}"]`);
  }

  // Dark mode lives in the settings dropdown (#darkModeRow)
  async toggleTheme() {
    await this.page.hover('#settingsDropdown > .dropdown-btn');
    await this.page.click('#darkModeRow');
  }

  // Selection is toggled through the tile's check indicator (plain tile
  // clicks do not select). Pass a tile locator or a file name.
  async toggleTileSelection(tileOrName, modifiers = []) {
    const tile = typeof tileOrName === 'string'
      ? this.page.locator(`.model-tile[data-model-name="${tileOrName}"]`)
      : tileOrName;
    await tile.hover();
    await tile.locator('.selection-indicator').click({ modifiers });
  }

  async getSelectionCount() {
    const text = await this.page.locator('#selectionDropdown').textContent();
    const match = text.match(/(\d+)\s+Selected/);
    return match ? parseInt(match[1], 10) : NaN;
  }

  async getPageInfo() {
    const text = await this.page.locator('#pageInfo').textContent();
    const match = text.match(/Page (\d+) of (\d+)/);
    return match ? { page: parseInt(match[1], 10), total: parseInt(match[2], 10) } : null;
  }

  async setTileSize(size) {
    const slider = await this.page.locator(TEST_CONFIG.uiElements.sizeSlider);
    await slider.fill(size.toString());
    await slider.dispatchEvent('input');
  }

  // Validation helpers
  async getTileCount() {
    const tiles = await this.page.locator('.model-tile');
    return await tiles.count();
  }

  async getVisibleTiles() {
    return await this.page.locator('.model-tile:visible').count();
  }

  async verifyFileInGrid(fileName) {
    const tile = await this.page.locator(`.model-tile[data-model-name="${fileName}"]`);
    return await tile.isVisible();
  }

  async verifyThumbnailLoaded(fileName) {
    const tile = await this.page.locator(`.model-tile[data-model-name="${fileName}"]`);
    const hasContent = await tile.locator('.placeholder').count() === 0;
    return hasContent;
  }

  // Performance measurement
  async measurePageLoadTime() {
    const startTime = Date.now();
    await this.navigateToViewer();
    const loadTime = Date.now() - startTime;
    return loadTime;
  }

  async measureSearchResponseTime(searchTerm) {
    const startTime = Date.now();
    await this.searchFor(searchTerm);
    await this.page.waitForFunction(() => {
      const tiles = document.querySelectorAll('.model-tile');
      return tiles.length > 0 || document.querySelector('.no-files-message');
    });
    return Date.now() - startTime;
  }

  // Memory helpers
  async getMemoryUsage() {
    return await this.page.evaluate(() => {
      if (performance.memory) {
        return {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
        };
      }
      return null;
    });
  }

  async checkForMemoryLeaks(initialMemory, currentMemory) {
    if (!initialMemory || !currentMemory) return false;

    const increase = currentMemory.usedJSHeapSize - initialMemory.usedJSHeapSize;
    const increaseInMB = increase / (1024 * 1024);

    return increaseInMB > TEST_CONFIG.performance.memoryLeakThreshold;
  }

  // Error checking
  async getConsoleErrors() {
    const errors = [];
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    return errors;
  }

  async checkForErrors() {
    // Check for error notifications
    const errorNotifications = await this.page.locator('.error-notification').count();

    // Check for error placeholders
    const errorPlaceholders = await this.page.locator('.asset-placeholder.error').count();

    return {
      hasErrors: errorNotifications > 0 || errorPlaceholders > 0,
      errorCount: errorNotifications + errorPlaceholders
    };
  }

  // Keyboard shortcuts
  async pressShortcut(shortcut) {
    await this.page.keyboard.press(shortcut);
  }

  // Fullscreen helpers
  // The overlay is shown/hidden via its display style (flex / none)
  async openFullscreen(fileName) {
    const tile = this.page.locator(`.model-tile[data-model-name="${fileName}"]`);
    await tile.hover();
    await tile.locator('.fullscreen-btn').click();
    await expect(this.page.locator(TEST_CONFIG.uiElements.fullscreenOverlay)).toBeVisible();
  }

  async closeFullscreen() {
    await this.page.keyboard.press('Escape');
    await expect(this.page.locator(TEST_CONFIG.uiElements.fullscreenOverlay)).toBeHidden();
  }

  // Assertion helpers
  async assertElementVisible(selector) {
    const element = await this.page.locator(selector);
    const isVisible = await element.isVisible();
    if (!isVisible) {
      throw new Error(`Element ${selector} is not visible`);
    }
  }

  async assertElementCount(selector, expectedCount) {
    const count = await this.page.locator(selector).count();
    if (count !== expectedCount) {
      throw new Error(`Expected ${expectedCount} elements matching ${selector}, but found ${count}`);
    }
  }

  async assertTextContent(selector, expectedText) {
    const element = await this.page.locator(selector);
    const text = await element.textContent();
    if (!text.includes(expectedText)) {
      throw new Error(`Expected text "${expectedText}" not found in element ${selector}. Found: "${text}"`);
    }
  }

  // Screenshot helpers
  async takeScreenshot(name) {
    await this.page.screenshot({
      path: `tests/screenshots/${name}.png`,
      fullPage: true
    });
  }

  // Cleanup
  async cleanup() {
    // Clear any test data
    await this.page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  }
}

// Test result reporter
export class TestReporter {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
  }

  addResult(testName, passed, details = {}) {
    this.results.push({
      testName,
      passed,
      details,
      timestamp: new Date().toISOString()
    });
  }

  generateReport() {
    const endTime = Date.now();
    const duration = endTime - this.startTime;
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;

    return {
      summary: {
        total: this.results.length,
        passed,
        failed,
        duration: `${duration}ms`,
        passRate: `${((passed / this.results.length) * 100).toFixed(2)}%`
      },
      results: this.results
    };
  }

  saveReport(filepath) {
    const report = this.generateReport();
    const fs = require('fs');
    fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
  }
}
