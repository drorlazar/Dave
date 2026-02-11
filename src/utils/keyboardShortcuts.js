// keyboardShortcuts.js - Keyboard navigation and shortcuts

export class KeyboardShortcutManager {
  constructor() {
    this.shortcuts = new Map();
    this.enabled = true;
    this.init();
  }

  init() {
    // Add global keyboard event listener
    document.addEventListener('keydown', (e) => this.handleKeydown(e));
  }

  handleKeydown(event) {
    if (!this.enabled) return;

    // Don't handle shortcuts when typing in input fields
    if (event.target.matches('input, textarea, [contenteditable]')) {
      return;
    }

    // Build shortcut key string
    const keys = [];
    if (event.ctrlKey) keys.push('Ctrl');
    if (event.altKey) keys.push('Alt');
    if (event.shiftKey) keys.push('Shift');
    if (event.metaKey) keys.push('Meta');

    // Add the actual key
    const key = event.key.length === 1 ? event.key.toUpperCase() : event.key;
    keys.push(key);

    const shortcut = keys.join('+');

    // Check if we have a handler for this shortcut
    const handler = this.shortcuts.get(shortcut);
    if (handler) {
      event.preventDefault();
      handler(event);
    }
  }

  register(shortcut, handler, description) {
    this.shortcuts.set(shortcut, handler);
    console.log(`Registered shortcut: ${shortcut} - ${description}`);
  }

  unregister(shortcut) {
    this.shortcuts.delete(shortcut);
  }

  enable() {
    this.enabled = true;
  }

  disable() {
    this.enabled = false;
  }

  getShortcuts() {
    return Array.from(this.shortcuts.keys());
  }
}

// Navigation-specific shortcuts
export function setupNavigationShortcuts(shortcutManager, navigationCallbacks) {
  const {
    nextPage,
    prevPage,
    firstPage,
    lastPage,
    focusSearch,
    toggleTheme,
    toggleTreeView,
    selectAll,
    deselectAll,
    openFullscreen,
    closeFullscreen,
    navigateGrid,
    zoomIn,
    zoomOut,
    resetZoom
  } = navigationCallbacks;

  // Page navigation
  shortcutManager.register('ArrowRight', nextPage, 'Next page');
  shortcutManager.register('ArrowLeft', prevPage, 'Previous page');
  shortcutManager.register('Home', firstPage, 'First page');
  shortcutManager.register('End', lastPage, 'Last page');
  shortcutManager.register('PageDown', nextPage, 'Next page');
  shortcutManager.register('PageUp', prevPage, 'Previous page');

  // UI shortcuts
  shortcutManager.register('/', focusSearch, 'Focus search');
  shortcutManager.register('Ctrl+/', focusSearch, 'Focus search');
  shortcutManager.register('T', toggleTheme, 'Toggle theme');
  shortcutManager.register('B', toggleTreeView, 'Toggle tree view');
  shortcutManager.register('Ctrl+B', toggleTreeView, 'Toggle tree view');

  // Selection shortcuts
  shortcutManager.register('Ctrl+A', selectAll, 'Select all');
  shortcutManager.register('Ctrl+D', deselectAll, 'Deselect all');
  shortcutManager.register('Escape', () => {
    if (document.getElementById('fullscreenOverlay').style.display === 'flex') {
      closeFullscreen();
    } else {
      deselectAll();
    }
  }, 'Close fullscreen or deselect all');

  // Fullscreen
  shortcutManager.register('Enter', openFullscreen, 'Open selected in fullscreen');
  shortcutManager.register(' ', openFullscreen, 'Open selected in fullscreen');

  // Grid navigation (arrow keys when not on page boundaries)
  shortcutManager.register('ArrowUp', () => navigateGrid('up'), 'Navigate up in grid');
  shortcutManager.register('ArrowDown', () => navigateGrid('down'), 'Navigate down in grid');

  // Zoom controls
  shortcutManager.register('Ctrl+=', zoomIn, 'Zoom in');
  shortcutManager.register('Ctrl++', zoomIn, 'Zoom in');
  shortcutManager.register('Ctrl+-', zoomOut, 'Zoom out');
  shortcutManager.register('Ctrl+0', resetZoom, 'Reset zoom');

  // Help
  shortcutManager.register('?', showKeyboardHelp, 'Show keyboard shortcuts');
  shortcutManager.register('Shift+/', showKeyboardHelp, 'Show keyboard shortcuts');
}

// Show help / about dialog
function showKeyboardHelp() {
  const shortcuts = [
    { keys: '←/→', description: 'Previous/Next page' },
    { keys: 'Home/End', description: 'First/Last page' },
    { keys: '↑/↓', description: 'Navigate grid' },
    { keys: '/', description: 'Focus search' },
    { keys: 'T', description: 'Toggle theme' },
    { keys: 'B', description: 'Toggle tree view' },
    { keys: 'Enter/Space', description: 'Open in fullscreen' },
    { keys: 'Escape', description: 'Close fullscreen / deselect' },
    { keys: 'Ctrl+A', description: 'Select all' },
    { keys: 'Ctrl+D', description: 'Deselect all' },
    { keys: 'Ctrl+/- /0', description: 'Zoom in/out/reset' },
    { keys: 'Scroll (fullscreen)', description: 'Zoom image' },
    { keys: 'Drag (fullscreen)', description: 'Pan zoomed image' },
    { keys: '?', description: 'Show this help' }
  ];

  const helpContent = shortcuts.map(s =>
    `<div class="shortcut-item">
      <span class="shortcut-keys">${s.keys}</span>
      <span class="shortcut-desc">${s.description}</span>
    </div>`
  ).join('');

  // Create help modal
  const modal = document.createElement('div');
  modal.className = 'keyboard-help-modal';
  modal.innerHTML = `
    <div class="keyboard-help-content">
      <h2><i class="fa fa-cube" style="color:#9b77ff;margin-right:8px;"></i>D.A.V.E</h2>
      <p class="help-subtitle">Dror's Assets Viewing Experience</p>

      <div class="help-features">
        <div class="help-feature"><i class="fa fa-cube" style="color:#4e9af5;"></i> 3D Models (FBX, GLB)</div>
        <div class="help-feature"><i class="fa fa-image" style="color:#3dd68c;"></i> Images (PNG, JPG, GIF, SVG, WebP...)</div>
        <div class="help-feature"><i class="fa fa-video" style="color:#f5a623;"></i> Video (MP4, WebM, MOV...)</div>
        <div class="help-feature"><i class="fa fa-music" style="color:#9b77ff;"></i> Audio (MP3, WAV, OGG, FLAC...)</div>
        <div class="help-feature"><i class="fa fa-font" style="color:#f56565;"></i> Fonts (TTF, OTF, WOFF, WOFF2)</div>
        <div class="help-feature"><i class="fa fa-file-lines" style="color:#8a8fa0;"></i> Text &amp; Code (TXT, JSON, XML, MD...)</div>
        <div class="help-feature"><i class="fa fa-file" style="color:#8a8fa0;"></i> Other file types (tagged by extension)</div>
        <div class="help-feature"><i class="fa fa-cloud" style="color:#7c7cff;"></i> Cloud Storage (AWS S3, Google Drive)</div>
      </div>

      <div class="help-collapsible collapsed">
        <div class="help-collapsible-header">
          <i class="fa fa-keyboard" style="margin-right:8px;"></i>Keyboard Shortcuts
          <span class="help-collapse-icon">&#9656;</span>
        </div>
        <div class="help-collapsible-body">
          <div class="shortcuts-list">
            ${helpContent}
          </div>
        </div>
      </div>

      <div class="help-collapsible collapsed">
        <div class="help-collapsible-header">
          <i class="fa fa-link" style="margin-right:8px;"></i>Resources
          <span class="help-collapse-icon">&#9656;</span>
        </div>
        <div class="help-collapsible-body">
          <div class="help-resources">
            <a href="docs/cloud-setup.html" target="_blank"><i class="fa fa-cloud"></i> Cloud Storage Setup Guide</a>
            <a href="https://github.com/DrorLazar-Sett/Dave" target="_blank"><i class="fab fa-github"></i> GitHub Repository</a>
          </div>
        </div>
      </div>

      <button class="close-help">Close (Esc)</button>
    </div>
  `;

  document.body.appendChild(modal);

  // Collapsible section toggling
  modal.querySelectorAll('.help-collapsible-header').forEach(header => {
    header.addEventListener('click', () => {
      header.parentElement.classList.toggle('collapsed');
    });
  });

  // Close handlers
  const closeHelp = () => {
    modal.remove();
  };

  modal.querySelector('.close-help').addEventListener('click', closeHelp);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeHelp();
  });

  // Close on Escape
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeHelp();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

// Grid navigation helper
export class GridNavigator {
  constructor(containerSelector, itemSelector) {
    this.container = document.querySelector(containerSelector);
    this.itemSelector = itemSelector;
    this.currentIndex = -1;
  }

  getItems() {
    return Array.from(this.container.querySelectorAll(this.itemSelector));
  }

  getCurrentItem() {
    const items = this.getItems();
    return items[this.currentIndex] || null;
  }

  setFocus(index) {
    const items = this.getItems();

    // Remove previous focus
    items.forEach(item => item.classList.remove('keyboard-focus'));

    // Set new focus
    if (index >= 0 && index < items.length) {
      this.currentIndex = index;
      const item = items[index];
      item.classList.add('keyboard-focus');
      item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      return item;
    }

    return null;
  }

  navigate(direction) {
    const items = this.getItems();
    if (items.length === 0) return;

    // Get grid dimensions
    const firstItem = items[0];
    const itemWidth = firstItem.offsetWidth;
    const containerWidth = this.container.offsetWidth;
    const itemsPerRow = Math.floor(containerWidth / itemWidth);

    let newIndex = this.currentIndex;

    switch (direction) {
      case 'up':
        newIndex = Math.max(0, this.currentIndex - itemsPerRow);
        break;
      case 'down':
        newIndex = Math.min(items.length - 1, this.currentIndex + itemsPerRow);
        break;
      case 'left':
        newIndex = Math.max(0, this.currentIndex - 1);
        break;
      case 'right':
        newIndex = Math.min(items.length - 1, this.currentIndex + 1);
        break;
      case 'first':
        newIndex = 0;
        break;
      case 'last':
        newIndex = items.length - 1;
        break;
    }

    return this.setFocus(newIndex);
  }

  selectCurrent() {
    const item = this.getCurrentItem();
    if (item) {
      item.click();
      return true;
    }
    return false;
  }
}
