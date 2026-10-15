// test_config.js - Test configuration and constants

import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Sample assets shipped with the repo; global_setup.js flattens them into testFolderPath
export const EXAMPLES_DIR = path.resolve(__dirname, '../../examples');

// Port the Dave server runs on during tests (playwright.config.js starts it)
export const TEST_PORT = Number(process.env.DAVE_TEST_PORT) || 8080;

export const TEST_CONFIG = {
  // Flat folder of fixture files (built by global_setup.js)
  testFolderPath: path.resolve(__dirname, '../.fixtures'),

  // Server configuration
  serverUrl: `http://localhost:${TEST_PORT}`,
  viewerUrl: `http://localhost:${TEST_PORT}/`,

  // Test timeouts
  defaultTimeout: 30000,
  fileLoadTimeout: 10000,

  // Sample files for specific tests (all from examples/)
  sampleFiles: {
    fbx: 'simple-cube.fbx',
    glb: 'duck.glb',
    jpg: 'portrait1.jpg',
    png: 'icon1.png',
    svg: 'computer_icon.svg',
    mp4: 'sample_video.mp4',
    mov: 'sample.mov',
    mp3: 'kalimba-melody.mp3',
    wav: 'notification-sound.wav',
    ttf: 'Roboto-Regular.ttf',
    pdf: 'us_constitution.pdf',
    webp: 'city1.webp'
  },

  // Performance benchmarks
  performance: {
    pageLoadTime: 2000,      // 2 seconds
    thumbnailLoadTime: 1000, // 1 second
    searchResponseTime: 300, // 300ms
    memoryLeakThreshold: 50  // 50MB increase is concerning
  },

  // UI elements to test
  uiElements: {
    viewerContainer: '#viewerContainer',
    searchInput: '#searchInput',
    themeToggle: '#themeToggle',
    sizeSlider: '#sizeSlider',
    itemsPerPageBtn: '#itemsPerPageBtn',
    sortButton: '#sortButton',
    filterButton: '#filterButton',
    folderPicker: '#folderPicker',
    treeFolderToggle: '#treeFolderToggle',
    fullscreenOverlay: '#fullscreenOverlay',
    returnButton: '#returnButton'
  }
};

// File type mappings for validation
export const FILE_TYPE_MAP = {
  '.glb': '3d',
  '.fbx': '3d',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.png': 'image',
  '.svg': 'image',
  '.webp': 'image',
  '.mp4': 'video',
  '.mov': 'video',
  '.mkv': 'video',
  '.mp3': 'audio',
  '.ogg': 'audio',
  '.ttf': 'font',
  '.pdf': 'document',
  '.psd': 'other',
  '.txt': 'other'
};

// Keyboard shortcuts to test
export const KEYBOARD_SHORTCUTS = {
  nextPage: 'ArrowRight',
  prevPage: 'ArrowLeft',
  firstPage: 'Home',
  lastPage: 'End',
  focusSearch: '/',
  toggleTheme: 't',
  toggleTree: 'b',
  selectAll: 'Control+a',
  deselectAll: 'Control+d',
  openFullscreen: 'Enter',
  closeFullscreen: 'Escape',
  showHelp: '?'
};
