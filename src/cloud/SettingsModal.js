// SettingsModal.js - In-app settings for cloud storage credentials and appearance

import { CredentialStore } from './CredentialStore.js';

const THEMES = [
  { id: 'default',    name: 'Default',      accent: '#9b77ff', bg: '#1e1e1e', surface: '#2a2a2a', text: '#e0e0e0', border: '#444', mode: 'dark' },
  { id: 'midnight',   name: 'Midnight',     accent: '#64b5f6', bg: '#0d1117', surface: '#161b22', text: '#c9d1d9', border: '#30363d', mode: 'dark' },
  { id: 'monokai',    name: 'Monokai',      accent: '#a6e22e', bg: '#272822', surface: '#2e2f28', text: '#f8f8f2', border: '#49483e', mode: 'dark' },
  { id: 'dracula',    name: 'Dracula',      accent: '#bd93f9', bg: '#282a36', surface: '#343746', text: '#f8f8f2', border: '#44475a', mode: 'dark' },
  { id: 'nord',       name: 'Nord',         accent: '#88c0d0', bg: '#2e3440', surface: '#3b4252', text: '#eceff4', border: '#4c566a', mode: 'dark' },
  { id: 'solarized',  name: 'Solarized',    accent: '#268bd2', bg: '#002b36', surface: '#073642', text: '#93a1a1', border: '#586e75', mode: 'dark' },
  { id: 'cyberpunk',  name: 'Cyberpunk',    accent: '#ff2d95', bg: '#0a0a1a', surface: '#12122a', text: '#e0d0ff', border: '#2a1a4a', mode: 'dark' },
  { id: 'forest',     name: 'Forest',       accent: '#66bb6a', bg: '#1a2416', surface: '#22301c', text: '#c8dcc0', border: '#3a5030', mode: 'dark' },
  { id: 'ocean',      name: 'Ocean',        accent: '#4dd0e1', bg: '#0a1929', surface: '#132f4c', text: '#b2bac2', border: '#1e4976', mode: 'dark' },
  { id: 'sunset',     name: 'Sunset',       accent: '#ff7043', bg: '#1c1410', surface: '#2a1e18', text: '#e0cfc0', border: '#4a3528', mode: 'dark' },
  { id: 'rose-pine',  name: 'Rose Pine',    accent: '#ebbcba', bg: '#191724', surface: '#1f1d2e', text: '#e0def4', border: '#393552', mode: 'dark' },
  { id: 'light',      name: 'Light',        accent: '#7c5ccc', bg: '#ffffff', surface: '#f5f5f5', text: '#333333', border: '#e0e0e0', mode: 'light' },
  { id: 'paper',      name: 'Paper',        accent: '#d4882a', bg: '#faf8f0', surface: '#f0ece0', text: '#3a3530', border: '#ddd5c8', mode: 'light' },
  { id: 'arctic',     name: 'Arctic',       accent: '#5e81ac', bg: '#eceff4', surface: '#e5e9f0', text: '#2e3440', border: '#d8dee9', mode: 'light' },
];

const THEME_STORAGE_KEY = 'dave_theme';

export class SettingsModal {
  constructor() {
    this.modal = null;
    this._escHandler = null;
  }

  open() {
    this.createModal();
    this.loadStatus();
  }

  createModal() {
    const existing = document.getElementById('settingsModal');
    if (existing) existing.remove();

    this.modal = document.createElement('div');
    this.modal.id = 'settingsModal';
    this.modal.className = 'cloud-modal-overlay';
    this.modal.innerHTML = `
      <div class="cloud-modal-content settings-modal-content">
        <div class="cloud-modal-header">
          <span class="cloud-modal-title">
            <i class="fa fa-cloud"></i>
            Cloud Storage Settings
          </span>
          <button class="cloud-modal-close" id="settingsClose" title="Close">&times;</button>
        </div>
        <div class="settings-body">

          <div class="settings-warning">
            <i class="fa fa-shield-halved"></i>
            Credentials are stored in your browser's local storage. Use scoped, read-only credentials.
          </div>

          <!-- S3 Section -->
          <div class="settings-section collapsed">
            <div class="settings-section-header settings-collapsible-header">
              <i class="fa fa-cloud"></i> AWS S3
              <span class="settings-status" id="s3Status"></span>
              <span class="settings-collapse-icon">&#9656;</span>
            </div>
            <div class="settings-form settings-collapsible-body" id="s3Form">
              <div class="settings-field">
                <label for="s3AccessKey">Access Key ID</label>
                <input type="text" id="s3AccessKey" placeholder="AKIA..." autocomplete="off">
              </div>
              <div class="settings-field">
                <label for="s3SecretKey">Secret Access Key</label>
                <input type="password" id="s3SecretKey" placeholder="Enter secret key" autocomplete="off">
                <button class="settings-toggle-vis" title="Show/hide" tabindex="-1"><i class="fa fa-eye"></i></button>
              </div>
              <div class="settings-field-row">
                <div class="settings-field">
                  <label for="s3Region">Region</label>
                  <input type="text" id="s3Region" placeholder="eu-central-1" value="eu-central-1">
                </div>
                <div class="settings-field">
                  <label for="s3Bucket">Default Bucket</label>
                  <input type="text" id="s3Bucket" placeholder="my-bucket">
                </div>
              </div>
              <p class="settings-description">
                Your S3 bucket must have
                <a href="https://docs.aws.amazon.com/AmazonS3/latest/userguide/cors.html" target="_blank" rel="noopener">CORS configured</a>
                to allow requests from this site.
              </p>
              <div class="settings-hint" id="s3Hint"></div>
              <div class="settings-btn-row">
                <button class="btn settings-save-btn" id="s3Save">
                  <i class="fa fa-save"></i> Save
                </button>
                <button class="btn settings-clear-btn" id="s3Clear" title="Remove saved S3 credentials">
                  <i class="fa fa-trash"></i>
                </button>
              </div>
            </div>
          </div>

          <!-- Google Drive Section -->
          <div class="settings-section collapsed">
            <div class="settings-section-header settings-collapsible-header">
              <i class="fab fa-google-drive"></i> Google Drive
              <span class="settings-status" id="gdriveConfigStatus"></span>
              <span class="settings-collapse-icon">&#9656;</span>
            </div>
            <div class="settings-form settings-collapsible-body" id="gdriveForm">
              <p class="settings-description">
                Create a <strong>Web application</strong> OAuth 2.0 Client ID in
                <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener">Google Cloud Console</a>,
                enable the Google Drive API, and add this site's URL as an authorized JavaScript origin.
                Then paste the Client ID below.
              </p>
              <div class="settings-field">
                <label for="gdriveClientId">OAuth Client ID</label>
                <input type="text" id="gdriveClientId" placeholder="123456789.apps.googleusercontent.com" autocomplete="off">
              </div>
              <div class="settings-hint" id="gdriveHint"></div>
              <div class="settings-btn-row">
                <button class="btn settings-save-btn" id="gdriveSave">
                  <i class="fa fa-save"></i> Save
                </button>
                <button class="btn settings-clear-btn" id="gdriveClear" title="Remove saved Google Drive config">
                  <i class="fa fa-trash"></i>
                </button>
              </div>
            </div>
          </div>

          <!-- Help Link -->
          <div class="settings-help">
            <i class="fa fa-circle-info"></i>
            For setup instructions, see the
            <a href="docs/cloud-setup.html" target="_blank">Cloud Storage Guide</a>.
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(this.modal);

    // Event listeners
    this.modal.querySelector('#settingsClose').addEventListener('click', () => this.close());
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });

    // Collapsible section toggling
    this.modal.querySelectorAll('.settings-collapsible-header').forEach(header => {
      header.addEventListener('click', (e) => {
        if (e.target.closest('.settings-status')) return;
        header.closest('.settings-section').classList.toggle('collapsed');
      });
    });

    // Toggle password visibility
    this.modal.querySelector('.settings-toggle-vis').addEventListener('click', (e) => {
      const input = this.modal.querySelector('#s3SecretKey');
      const icon = e.currentTarget.querySelector('i');
      if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fa fa-eye-slash';
      } else {
        input.type = 'password';
        icon.className = 'fa fa-eye';
      }
    });

    // Save/clear buttons
    this.modal.querySelector('#s3Save').addEventListener('click', () => this.saveS3());
    this.modal.querySelector('#s3Clear').addEventListener('click', () => this.clearS3());
    this.modal.querySelector('#gdriveSave').addEventListener('click', () => this.saveGDrive());
    this.modal.querySelector('#gdriveClear').addEventListener('click', () => this.clearGDrive());

    // Theme swatch clicks
    this.modal.querySelectorAll('.theme-swatch').forEach(swatch => {
      swatch.addEventListener('click', () => {
        const themeId = swatch.dataset.theme;
        SettingsModal.applyTheme(themeId);
        // Update active state in grid
        this.modal.querySelectorAll('.theme-swatch').forEach(s => s.classList.toggle('active', s.dataset.theme === themeId));
      });
    });

    this._escHandler = (e) => { if (e.key === 'Escape') this.close(); };
    document.addEventListener('keydown', this._escHandler);
  }

  _themeSwatchesHTML() {
    const current = localStorage.getItem(THEME_STORAGE_KEY) || 'default';
    return THEMES.map(t => `
      <button class="theme-swatch${t.id === current ? ' active' : ''}" data-theme="${t.id}" title="${t.name}">
        <div class="theme-swatch-preview" style="background:${t.bg};border-color:${t.border}">
          <div class="theme-swatch-bar" style="background:${t.surface}"></div>
          <div class="theme-swatch-accent" style="background:${t.accent}"></div>
          <div class="theme-swatch-text" style="background:${t.text}"></div>
        </div>
        <span class="theme-swatch-name">${t.name}</span>
      </button>
    `).join('');
  }

  _releaseLogHTML() {
    return SettingsModal._releaseLogEntriesHTML();
  }

  loadStatus() {
    const data = CredentialStore.getStatus();

    const s3Status = this.modal.querySelector('#s3Status');
    const gdriveStatus = this.modal.querySelector('#gdriveConfigStatus');

    if (data.s3.configured) {
      s3Status.textContent = 'Configured';
      s3Status.className = 'settings-status configured';
      const hint = this.modal.querySelector('#s3Hint');
      hint.textContent = `Key: ${data.s3.accessKeyHint} | Region: ${data.s3.region} | Bucket: ${data.s3.bucket}`;
      this.modal.querySelector('#s3Region').value = data.s3.region || 'eu-central-1';
      this.modal.querySelector('#s3Bucket').value = data.s3.bucket || '';
    } else {
      s3Status.textContent = 'Not configured';
      s3Status.className = 'settings-status';
    }

    if (data.gdrive.credentialsConfigured) {
      gdriveStatus.textContent = 'Configured';
      gdriveStatus.className = 'settings-status configured';
      const config = CredentialStore.getGDriveConfig();
      if (config) {
        this.modal.querySelector('#gdriveClientId').value = config.clientId;
      }
    } else {
      gdriveStatus.textContent = 'Not configured';
      gdriveStatus.className = 'settings-status';
    }
  }

  saveS3() {
    const hint = this.modal.querySelector('#s3Hint');
    const accessKeyId = this.modal.querySelector('#s3AccessKey').value.trim();
    const secretAccessKey = this.modal.querySelector('#s3SecretKey').value.trim();
    const region = this.modal.querySelector('#s3Region').value.trim();
    const bucket = this.modal.querySelector('#s3Bucket').value.trim();

    if (!accessKeyId || !secretAccessKey) {
      hint.textContent = 'Both Access Key ID and Secret Access Key are required.';
      hint.className = 'settings-hint error';
      return;
    }

    try {
      CredentialStore.saveS3Credentials({ accessKeyId, secretAccessKey, region, bucket });
      hint.textContent = 'S3 credentials saved!';
      hint.className = 'settings-hint success';
      this.modal.querySelector('#s3Status').textContent = 'Configured';
      this.modal.querySelector('#s3Status').className = 'settings-status configured';
      this.modal.querySelector('#s3AccessKey').value = '';
      this.modal.querySelector('#s3SecretKey').value = '';
    } catch (e) {
      hint.textContent = e.message;
      hint.className = 'settings-hint error';
    }
  }

  clearS3() {
    CredentialStore.clearS3Credentials();
    this.modal.querySelector('#s3Status').textContent = 'Not configured';
    this.modal.querySelector('#s3Status').className = 'settings-status';
    this.modal.querySelector('#s3Hint').textContent = 'S3 credentials removed.';
    this.modal.querySelector('#s3Hint').className = 'settings-hint';
    this.modal.querySelector('#s3AccessKey').value = '';
    this.modal.querySelector('#s3SecretKey').value = '';
  }

  async saveGDrive() {
    const hint = this.modal.querySelector('#gdriveHint');
    const clientId = this.modal.querySelector('#gdriveClientId').value.trim();

    if (!clientId) {
      hint.textContent = 'Please enter the OAuth Client ID.';
      hint.className = 'settings-hint error';
      return;
    }

    if (!clientId.includes('.apps.googleusercontent.com')) {
      hint.textContent = 'Client ID should end with .apps.googleusercontent.com';
      hint.className = 'settings-hint error';
      return;
    }

    try {
      CredentialStore.saveGDriveConfig({ clientId });
      hint.textContent = 'Google Drive Client ID saved! You can now sign in via Source > Google Drive.';
      hint.className = 'settings-hint success';
      this.modal.querySelector('#gdriveConfigStatus').textContent = 'Configured';
      this.modal.querySelector('#gdriveConfigStatus').className = 'settings-status configured';
      const { getGDriveClient } = await import('./CloudStorageProvider.js');
      const client = getGDriveClient();
      client.init(clientId);
    } catch (e) {
      hint.textContent = e.message;
      hint.className = 'settings-hint error';
    }
  }

  clearGDrive() {
    CredentialStore.clearGDriveConfig();
    this.modal.querySelector('#gdriveConfigStatus').textContent = 'Not configured';
    this.modal.querySelector('#gdriveConfigStatus').className = 'settings-status';
    this.modal.querySelector('#gdriveHint').textContent = 'Google Drive config removed.';
    this.modal.querySelector('#gdriveHint').className = 'settings-hint';
    this.modal.querySelector('#gdriveClientId').value = '';
  }

  close() {
    if (this._escHandler) {
      document.removeEventListener('keydown', this._escHandler);
    }
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
  }

  // --- Theme system ---

  static applyTheme(themeId) {
    const theme = THEMES.find(t => t.id === themeId);
    if (!theme) return;

    localStorage.setItem(THEME_STORAGE_KEY, themeId);
    // Save theme CSS values for pre-render inline script
    localStorage.setItem('dave_theme_css', JSON.stringify({
      bg: theme.bg, surface: theme.surface, text: theme.text,
      border: theme.border, accent: theme.accent, mode: theme.mode
    }));

    // Set dark/light mode class
    const isLight = theme.mode === 'light';
    if (isLight) {
      document.documentElement.classList.remove('dark-mode');
      document.body.classList.remove('dark-mode');
    } else {
      document.documentElement.classList.add('dark-mode');
      document.body.classList.add('dark-mode');
    }
    localStorage.setItem('theme', isLight ? 'light' : 'dark');

    // Update dark mode toggle indicator if visible
    const indicator = document.getElementById('darkModeIndicator');
    if (indicator) {
      indicator.textContent = isLight ? 'OFF' : 'ON';
      indicator.classList.toggle('off', isLight);
    }

    // Apply CSS custom properties
    const root = document.documentElement;
    root.style.setProperty('--theme-bg', theme.bg);
    root.style.setProperty('--theme-surface', theme.surface);
    root.style.setProperty('--theme-text', theme.text);
    root.style.setProperty('--theme-border', theme.border);
    root.style.setProperty('--theme-accent', theme.accent);
  }

  static initTheme() {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved) {
      SettingsModal.applyTheme(saved);
    }
  }

  /** Populate theme swatches + release log in the settings dropdown */
  static initDropdownSections() {
    const themeGrid = document.getElementById('themeGridDD');
    const releaseLogBody = document.getElementById('releaseLogBody');
    if (!themeGrid && !releaseLogBody) return;

    // Theme swatches
    if (themeGrid) {
      const current = localStorage.getItem(THEME_STORAGE_KEY) || 'default';
      themeGrid.innerHTML = THEMES.map(t => `
        <button class="theme-swatch${t.id === current ? ' active' : ''}" data-theme="${t.id}" title="${t.name}">
          <div class="theme-swatch-preview" style="background:${t.bg};border-color:${t.border}">
            <div class="theme-swatch-bar" style="background:${t.surface}"></div>
            <div class="theme-swatch-accent" style="background:${t.accent}"></div>
            <div class="theme-swatch-text" style="background:${t.text}"></div>
          </div>
          <span class="theme-swatch-name">${t.name}</span>
        </button>
      `).join('');

      themeGrid.addEventListener('click', (e) => {
        const swatch = e.target.closest('.theme-swatch');
        if (!swatch) return;
        const themeId = swatch.dataset.theme;
        SettingsModal.applyTheme(themeId);
        themeGrid.querySelectorAll('.theme-swatch').forEach(s =>
          s.classList.toggle('active', s.dataset.theme === themeId)
        );
        // Also update modal swatches if open
        const modalGrid = document.getElementById('themeGrid');
        if (modalGrid) {
          modalGrid.querySelectorAll('.theme-swatch').forEach(s =>
            s.classList.toggle('active', s.dataset.theme === themeId)
          );
        }
      });
    }

    // Release log
    if (releaseLogBody) {
      releaseLogBody.innerHTML = SettingsModal._releaseLogEntriesHTML();
    }

    // Collapsible section toggles
    document.querySelectorAll('.settings-dd-section-header').forEach(header => {
      header.addEventListener('click', () => {
        header.closest('.settings-dd-section').classList.toggle('collapsed');
      });
    });
  }

  static _releaseLogEntriesHTML() {
    const releases = [
      {
        version: '1.6.0', date: 'Feb 11, 2026', title: 'Settings & UX Overhaul',
        features: [
          'Tree view side tab toggle + expand/collapse dropdown',
          '50 whimsical welcome messages for empty state',
          'Themed scrollbars, honest edit tooltips, dropdown z-index fix',
        ]
      },
      {
        version: '1.5.0', date: 'Feb 11, 2026', title: 'Themes & Release Log',
        features: [
          '14 color themes with live preview swatches',
          'Theme picker and release log in settings dropdown',
          'CSS custom properties for full UI theming',
        ]
      },
      {
        version: '1.4.0', date: 'Feb 11, 2026', title: '3D Inspector - Material Editor & Export',
        features: [
          'Material editor with per-material property editing and texture drag & drop',
          'Export animation-only GLB (rig + clip, no mesh)',
          'Floating/dockable inspector panel',
          'Toolbar inside 3D preview, larger icons, new grid icon',
        ]
      },
      {
        version: '1.3.0', date: 'Feb 11, 2026', title: '3D Model Inspector',
        features: [
          'Inspector toolbar: wireframe, grid, auto-rotate, screenshot',
          'Slide-in panel with Stats, Materials, Animations, Export',
          'Animation transport bar with scrub, speed, selection',
          'Export tools: GLB with/without textures, mesh simplification',
        ]
      },
      {
        version: '1.2.0', date: 'Feb 10, 2026', title: 'Easter Eggs & Effects',
        features: [
          'Dangerous Dave easter egg, Matrix rain, CRT power-on animation',
        ]
      },
      {
        version: '1.1.0', date: 'Feb 9, 2026', title: 'Cloud Storage & Image Viewer',
        features: [
          'Client-side AWS S3 and Google Drive integration',
          'Cloud folder browser, fullscreen image viewer with zoom/pan',
        ]
      },
      {
        version: '1.0.0', date: 'Feb 6, 2026', title: 'Text Files & Testing',
        features: [
          'Text file support with markdown rendering',
          'Playwright E2E test suite',
        ]
      },
      {
        version: '0.9.0', date: 'Jul 2025', title: 'Initial Release',
        features: [
          'Grid asset viewer for 3D models, images, videos, audio, fonts',
          'Drag & drop, search, pagination, dark/light mode',
        ]
      },
    ];

    return releases.map((r, i) => `
      <div class="release-entry${i === 0 ? ' latest' : ''}">
        <div class="release-header">
          <span class="release-version">${r.version}</span>
          <span class="release-date">${r.date}</span>
          ${i === 0 ? '<span class="release-badge">Latest</span>' : ''}
        </div>
        <div class="release-title">${r.title}</div>
        <ul class="release-features">
          ${r.features.map(f => `<li>${f}</li>`).join('')}
        </ul>
      </div>
    `).join('');
  }
}
