// helpTooltip.js - Interactive help tooltip for D.A.V.E logo

export class HelpTooltip {
  constructor() {
    this.tooltip = null;
    this.isVisible = false;
    this.hideTimeout = null;
    this.shortcuts = this.getShortcuts();
    this.init();
  }

  init() {
    try {
      this.createTooltip();
      this.attachEventListeners();
    } catch (error) {
      console.error('[HelpTooltip] Error during initialization:', error);
      // Remove tooltip if creation failed
      if (this.tooltip && this.tooltip.parentNode) {
        this.tooltip.parentNode.removeChild(this.tooltip);
      }
    }
  }

  getShortcuts() {
    return {
      navigation: [
        { keys: '←/→', description: 'Previous/Next page' },
        { keys: '↑/↓', description: 'Navigate grid' },
        { keys: 'Home/End', description: 'First/Last page' },
        { keys: 'PageUp/PageDown', description: 'Previous/Next page' }
      ],
      selection: [
        { keys: 'Ctrl+A', description: 'Select all' },
        { keys: 'Ctrl+D', description: 'Deselect all' },
        { keys: 'Enter/Space', description: 'Open in fullscreen' },
        { keys: 'Escape', description: 'Close fullscreen / Deselect' }
      ],
      ui: [
        { keys: 'T', description: 'Toggle dark/light theme' },
        { keys: 'B', description: 'Toggle folder tree view' },
        { keys: '/', description: 'Focus search' },
        { keys: '?', description: 'Show keyboard shortcuts' }
      ],
      zoom: [
        { keys: 'Ctrl + +/-', description: 'Zoom in/out' },
        { keys: 'Ctrl + 0', description: 'Reset zoom' },
        { keys: 'Scroll (fullscreen)', description: 'Zoom image' },
        { keys: 'Drag (fullscreen)', description: 'Pan zoomed image' }
      ],
      tree: [
        { keys: 'Ctrl+Shift+←', description: 'Collapse all folders' },
        { keys: 'Ctrl+Shift+→', description: 'Expand all folders' },
        { keys: 'Ctrl+Shift+S', description: 'Download folder as ZIP' }
      ]
    };
  }

  createTooltip() {
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'dave-help-tooltip';
    this.tooltip.innerHTML = `
      <div class="tooltip-arrow"></div>
      <div class="tooltip-content">
        <div class="tooltip-header">
          <h3>D.A.V.E Help & Info</h3>
          <span class="tooltip-version">v1.0.0</span>
        </div>
        
        <div class="tooltip-section about-section">
          <h4><i class="fa fa-info-circle"></i> About</h4>
          <p><strong>Dror's Assets Viewing Experience</strong></p>
          <p class="about-description">A powerful client-side web application for viewing and managing your digital assets including 3D models, images, videos, audio files, fonts, and documents.</p>
        </div>

        <div class="tooltip-section features-section">
          <h4><i class="fa fa-star"></i> Supported Assets</h4>
          <ul class="features-list">
            <li><i class="fa fa-cube" style="color:#4e9af5;"></i> 3D Models (FBX, GLB, OBJ, STL)</li>
            <li><i class="fa fa-image" style="color:#3dd68c;"></i> Images (PNG, JPG, GIF, SVG, WebP...)</li>
            <li><i class="fa fa-video" style="color:#f5a623;"></i> Video (MP4, WebM, MOV...)</li>
            <li><i class="fa fa-music" style="color:#9b77ff;"></i> Audio (MP3, WAV, OGG, FLAC...)</li>
            <li><i class="fa fa-font" style="color:#f56565;"></i> Fonts (TTF, OTF, WOFF, WOFF2)</li>
            <li><i class="fa fa-file-lines" style="color:#8a8fa0;"></i> Text & Code (TXT, JSON, XML, MD...)</li>
            <li><i class="fa fa-file" style="color:#8a8fa0;"></i> Other file types (tagged by extension)</li>
            <li><i class="fa fa-cloud" style="color:#7c7cff;"></i> Cloud Storage (AWS S3, Google Drive)</li>
          </ul>
        </div>

        <div class="tooltip-section tooltip-collapsible collapsed">
          <h4 class="tooltip-collapsible-header"><i class="fa fa-keyboard"></i> Keyboard Shortcuts <span class="tooltip-collapse-icon">&#9656;</span></h4>
          <div class="tooltip-collapsible-body">
            <div class="shortcuts-grid">
              ${this.renderShortcutCategories()}
            </div>
          </div>
        </div>

        <div class="tooltip-section tooltip-collapsible collapsed">
          <h4 class="tooltip-collapsible-header"><i class="fa fa-link"></i> Resources <span class="tooltip-collapse-icon">&#9656;</span></h4>
          <div class="tooltip-collapsible-body">
            <div class="resource-links">
              <a href="docs/cloud-setup.html" target="_blank" rel="noopener">
                <i class="fa fa-cloud"></i> Cloud Storage Setup Guide
              </a>
              <a href="https://github.com/drorlazar-sett/Dave" target="_blank" rel="noopener">
                <i class="fab fa-github"></i> GitHub Repository
              </a>
              <a href="https://github.com/drorlazar-sett/Dave/issues" target="_blank" rel="noopener">
                <i class="fa fa-bug"></i> Report Issues
              </a>
            </div>
          </div>
        </div>

        <div class="tooltip-footer">
          <p class="creator-credit">
            <i class="fa fa-code"></i> Created with passion by Dror Lazar
          </p>
          <p class="tip">
            <i class="fa fa-lightbulb"></i> <strong>Tip:</strong> Press <kbd>?</kbd> anytime for shortcuts
          </p>
        </div>
      </div>
    `;

    document.body.appendChild(this.tooltip);
  }

  renderShortcutCategories() {
    const categories = [
      { name: 'Navigation', icon: 'fa-arrows-alt', shortcuts: this.shortcuts.navigation },
      { name: 'Selection', icon: 'fa-hand-pointer', shortcuts: this.shortcuts.selection },
      { name: 'UI Controls', icon: 'fa-palette', shortcuts: this.shortcuts.ui },
      { name: 'Zoom', icon: 'fa-search-plus', shortcuts: this.shortcuts.zoom },
      { name: 'Tree View', icon: 'fa-folder-tree', shortcuts: this.shortcuts.tree }
    ];

    return categories.map(category => `
      <div class="shortcut-category">
        <h5><i class="fa ${category.icon}"></i> ${category.name}</h5>
        <div class="shortcut-items">
          ${category.shortcuts.map(s => `
            <div class="shortcut-item">
              <kbd>${s.keys}</kbd>
              <span>${s.description}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
  }

  attachEventListeners() {
    const logo = document.querySelector('.logo-container');
    if (!logo) {
      console.warn('[HelpTooltip] Logo container not found, skipping tooltip initialization');
      return;
    }

    // Make logo interactive
    logo.style.cursor = 'help';
    logo.setAttribute('title', 'Click for help & info');

    // Show on hover
    logo.addEventListener('mouseenter', () => {
      this.show();
    });

    // Hide on mouse leave (with delay)
    logo.addEventListener('mouseleave', () => {
      this.hideTimeout = setTimeout(() => {
        this.hide();
      }, 300);
    });

    // Toggle on click
    logo.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.isVisible) {
        this.hide();
      } else {
        this.show();
      }
    });

    // Keep tooltip visible when hovering over it
    this.tooltip.addEventListener('mouseenter', () => {
      clearTimeout(this.hideTimeout);
    });

    this.tooltip.addEventListener('mouseleave', () => {
      this.hideTimeout = setTimeout(() => {
        this.hide();
      }, 300);
    });

    // Hide on outside click
    document.addEventListener('click', (e) => {
      if (this.isVisible && !logo.contains(e.target) && !this.tooltip.contains(e.target)) {
        this.hide();
      }
    });

    // Collapsible section toggling
    this.tooltip.querySelectorAll('.tooltip-collapsible-header').forEach(header => {
      header.addEventListener('click', (e) => {
        e.stopPropagation();
        header.closest('.tooltip-collapsible').classList.toggle('collapsed');
      });
    });

    // Hide on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.hide();
      }
    });
  }

  show() {
    clearTimeout(this.hideTimeout);
    
    const logo = document.querySelector('.logo-container');
    const rect = logo.getBoundingClientRect();
    
    // Position tooltip below logo
    this.tooltip.style.top = `${rect.bottom + 10}px`;
    this.tooltip.style.left = `${rect.left}px`;
    
    // Show with animation
    this.tooltip.classList.add('visible');
    this.isVisible = true;

    // Adjust position if tooltip goes off-screen
    setTimeout(() => {
      const tooltipRect = this.tooltip.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Adjust horizontal position
      if (tooltipRect.right > viewportWidth - 20) {
        const newLeft = Math.max(20, viewportWidth - tooltipRect.width - 20);
        this.tooltip.style.left = `${newLeft}px`;
      }

      // Adjust vertical position if needed
      if (tooltipRect.bottom > viewportHeight - 20) {
        this.tooltip.style.top = `${rect.top - tooltipRect.height - 10}px`;
        this.tooltip.classList.add('top');
      }
    }, 10);
  }

  hide() {
    clearTimeout(this.hideTimeout);
    this.tooltip.classList.remove('visible', 'top');
    this.isVisible = false;
  }

  updateVersion(version) {
    const versionEl = this.tooltip.querySelector('.tooltip-version');
    if (versionEl) {
      versionEl.textContent = `v${version}`;
    }
  }
}

// Initialize when DOM is ready
export function initHelpTooltip() {
  try {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        try {
          new HelpTooltip();
          console.log('[HelpTooltip] Initialized successfully');
        } catch (error) {
          console.error('[HelpTooltip] Error during initialization:', error);
        }
      });
    } else {
      new HelpTooltip();
      console.log('[HelpTooltip] Initialized successfully');
    }
  } catch (error) {
    console.error('[HelpTooltip] Error during initialization:', error);
  }
}