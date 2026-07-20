// SettingsModal.js - In-app settings for cloud storage credentials and appearance

import { CredentialStore } from './CredentialStore.js';
import { MatrixRain } from '../matrix_rain.js';
import { RezmasonRain } from '../matrix_rain_rezmason.js';

// ── Matrix theme state (module-level) ──
let matrixThemeRain = null;
let matrixModeIndex = 0;

const MATRIX_THEME_COLORS = {
  id: 'matrix', accent: '#00ff41', bg: '#0a0a0a', surface: '#0d1a0d',
  text: '#00ff41', border: '#0a3a0a', mode: 'dark'
};

const MATRIX_MODE_NAMES = [
  "Dror's Matrix", 'Classic', '3D', 'Mirror', 'Resurrections',
  'Trinity', 'Operator', 'Megacity', 'Awakening'
];

const MATRIX_MODE_PARAMS = [
  null, // index 0 = custom MatrixRain
  'version=classic',
  'version=3d',
  'version=classic&fallSpeed=-0.3&glyphFlip=true&rippleTypeName=circle&rippleSpeed=0.2&rippleThickness=0.25',
  'version=resurrections',
  'version=trinity',
  'version=operator',
  'version=megacity',
  'version=classic&skipIntro=false',
];

function startMatrixBackground(modeIndex) {
  stopMatrixBackground();
  if (modeIndex === 0) {
    matrixThemeRain = new MatrixRain();
    matrixThemeRain.start(1);
    matrixThemeRain.canvas.style.opacity = '0.10';
  } else {
    const params = MATRIX_MODE_PARAMS[modeIndex];
    matrixThemeRain = new RezmasonRain(params);
    matrixThemeRain.start(1);
    matrixThemeRain.container.style.opacity = '0.10';
  }
}

function stopMatrixBackground() {
  if (matrixThemeRain) {
    matrixThemeRain.stop();
    matrixThemeRain = null;
  }
}

let _matrixToastTimer = null;
function showMatrixModeToast(modeName) {
  let toast = document.querySelector('.matrix-mode-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'matrix-mode-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = modeName;
  toast.classList.add('visible');
  clearTimeout(_matrixToastTimer);
  _matrixToastTimer = setTimeout(() => toast.classList.remove('visible'), 2000);
}

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
const SYSTEM_THEME_KEY = 'dave_system_theme';

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

          <a href="docs/cloud-setup.html" target="_blank" class="settings-guide-card">
            <div class="guide-card-icon"><i class="fa fa-book"></i></div>
            <div class="guide-card-text">
              <div class="guide-card-title">Need help setting up?</div>
              <div class="guide-card-sub">Step-by-step guide for S3 and Google Drive</div>
            </div>
            <i class="fa fa-arrow-right guide-card-arrow"></i>
          </a>

          <!-- S3 Section -->
          <div class="settings-section collapsed">
            <div class="settings-section-header settings-collapsible-header">
              <i class="fa fa-cloud"></i> AWS S3
              <span class="settings-status" id="s3Status"></span>
              <span class="settings-collapse-icon">&#9656;</span>
            </div>
            <div class="settings-form settings-collapsible-body" id="s3Form">
              <div class="s3-profile-list" id="s3ProfileList"></div>
              <button class="btn s3-add-profile-btn" id="s3AddProfile">
                <i class="fa fa-plus"></i> Add S3 Profile
              </button>
              <div class="s3-profile-form" id="s3ProfileForm" style="display:none">
                <input type="hidden" id="s3EditProfileId" value="">
                <div class="settings-field">
                  <label for="s3ProfileLabel">Profile Name</label>
                  <input type="text" id="s3ProfileLabel" placeholder="e.g. Work Assets, Personal" autocomplete="off">
                </div>
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
                    <label for="s3Bucket">Bucket</label>
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
                    <i class="fa fa-save"></i> Save Profile
                  </button>
                  <button class="btn settings-clear-btn" id="s3CancelEdit" title="Cancel">
                    <i class="fa fa-times"></i> Cancel
                  </button>
                </div>
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

    // S3 profile buttons
    this.modal.querySelector('#s3AddProfile').addEventListener('click', () => this.showS3ProfileForm());
    this.modal.querySelector('#s3Save').addEventListener('click', () => this.saveS3());
    this.modal.querySelector('#s3CancelEdit').addEventListener('click', () => this.hideS3ProfileForm());

    // GDrive buttons
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
      const count = data.s3.profileCount;
      s3Status.textContent = `${count} profile${count !== 1 ? 's' : ''}`;
      s3Status.className = 'settings-status configured';
    } else {
      s3Status.textContent = 'Not configured';
      s3Status.className = 'settings-status';
    }
    this.renderS3Profiles();

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

  renderS3Profiles() {
    const listEl = this.modal.querySelector('#s3ProfileList');
    const profiles = CredentialStore.getS3Profiles();
    const defaultId = CredentialStore.getDefaultS3ProfileId();
    listEl.innerHTML = '';

    if (profiles.length === 0) {
      listEl.innerHTML = '<div class="s3-no-profiles">No S3 profiles configured yet.</div>';
      return;
    }

    profiles.forEach(p => {
      const card = document.createElement('div');
      card.className = 's3-profile-card' + (p.id === defaultId ? ' default' : '');
      const keyHint = p.accessKeyId ? p.accessKeyId.substring(0, 4) + '****' : '****';
      card.innerHTML = `
        <div class="s3-profile-info">
          <div class="s3-profile-label">${p.label || p.bucket || 'Untitled'}${p.id === defaultId ? ' <span class="s3-default-badge">Default</span>' : ''}</div>
          <div class="s3-profile-details">${p.region} &middot; ${p.bucket} &middot; ${keyHint}</div>
        </div>
        <div class="s3-profile-actions">
          ${p.id !== defaultId ? '<button class="s3-profile-action" data-action="default" title="Set as default"><i class="fa fa-star"></i></button>' : ''}
          <button class="s3-profile-action" data-action="edit" title="Edit"><i class="fa fa-pen"></i></button>
          <button class="s3-profile-action" data-action="delete" title="Delete"><i class="fa fa-trash"></i></button>
        </div>
      `;

      card.querySelector('[data-action="edit"]').addEventListener('click', () => this.editS3Profile(p.id));
      card.querySelector('[data-action="delete"]').addEventListener('click', () => this.deleteS3Profile(p.id));
      const defaultBtn = card.querySelector('[data-action="default"]');
      if (defaultBtn) {
        defaultBtn.addEventListener('click', () => {
          CredentialStore.setDefaultS3ProfileId(p.id);
          this.renderS3Profiles();
        });
      }

      listEl.appendChild(card);
    });
  }

  showS3ProfileForm(profileId) {
    const form = this.modal.querySelector('#s3ProfileForm');
    const addBtn = this.modal.querySelector('#s3AddProfile');
    form.style.display = '';
    addBtn.style.display = 'none';

    // Clear or fill form
    if (profileId) {
      const p = CredentialStore.getS3Profile(profileId);
      if (p) {
        this.modal.querySelector('#s3EditProfileId').value = p.id;
        this.modal.querySelector('#s3ProfileLabel').value = p.label || '';
        this.modal.querySelector('#s3AccessKey').value = p.accessKeyId || '';
        this.modal.querySelector('#s3SecretKey').value = p.secretAccessKey || '';
        this.modal.querySelector('#s3Region').value = p.region || 'eu-central-1';
        this.modal.querySelector('#s3Bucket').value = p.bucket || '';
        return;
      }
    }

    this.modal.querySelector('#s3EditProfileId').value = '';
    this.modal.querySelector('#s3ProfileLabel').value = '';
    this.modal.querySelector('#s3AccessKey').value = '';
    this.modal.querySelector('#s3SecretKey').value = '';
    this.modal.querySelector('#s3Region').value = 'eu-central-1';
    this.modal.querySelector('#s3Bucket').value = '';
  }

  hideS3ProfileForm() {
    const form = this.modal.querySelector('#s3ProfileForm');
    const addBtn = this.modal.querySelector('#s3AddProfile');
    form.style.display = 'none';
    addBtn.style.display = '';
    this.modal.querySelector('#s3Hint').textContent = '';
    this.modal.querySelector('#s3Hint').className = 'settings-hint';
  }

  editS3Profile(profileId) {
    this.showS3ProfileForm(profileId);
  }

  deleteS3Profile(profileId) {
    const profile = CredentialStore.getS3Profile(profileId);
    const label = profile?.label || 'this profile';
    if (!confirm(`Delete S3 profile "${label}"?`)) return;

    CredentialStore.deleteS3Profile(profileId);
    const { clearS3ClientCache } = window.__cloudStorageProvider || {};
    // Dynamic import to clear cache
    import('./CloudStorageProvider.js').then(m => m.clearS3ClientCache?.(profileId)).catch(() => {});

    this.renderS3Profiles();
    // Update status badge
    const profiles = CredentialStore.getS3Profiles();
    const s3Status = this.modal.querySelector('#s3Status');
    if (profiles.length > 0) {
      s3Status.textContent = `${profiles.length} profile${profiles.length !== 1 ? 's' : ''}`;
      s3Status.className = 'settings-status configured';
    } else {
      s3Status.textContent = 'Not configured';
      s3Status.className = 'settings-status';
    }
  }

  saveS3() {
    const hint = this.modal.querySelector('#s3Hint');
    const editId = this.modal.querySelector('#s3EditProfileId').value;
    const label = this.modal.querySelector('#s3ProfileLabel').value.trim();
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
      CredentialStore.saveS3Profile({
        id: editId || undefined,
        label: label || bucket || 'Untitled',
        accessKeyId,
        secretAccessKey,
        region,
        bucket
      });
      // Clear S3 client cache for this profile
      import('./CloudStorageProvider.js').then(m => m.clearS3ClientCache?.(editId || undefined)).catch(() => {});

      hint.textContent = editId ? 'Profile updated!' : 'Profile saved!';
      hint.className = 'settings-hint success';
      setTimeout(() => this.hideS3ProfileForm(), 800);
      this.renderS3Profiles();

      const profiles = CredentialStore.getS3Profiles();
      const s3Status = this.modal.querySelector('#s3Status');
      s3Status.textContent = `${profiles.length} profile${profiles.length !== 1 ? 's' : ''}`;
      s3Status.className = 'settings-status configured';
    } catch (e) {
      hint.textContent = e.message;
      hint.className = 'settings-hint error';
    }
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
    // ── Matrix theme special-case ──
    if (themeId === 'matrix') {
      const t = MATRIX_THEME_COLORS;
      localStorage.setItem(THEME_STORAGE_KEY, 'matrix');
      localStorage.setItem('dave_theme_css', JSON.stringify({
        bg: t.bg, surface: t.surface, text: t.text,
        border: t.border, accent: t.accent, mode: t.mode
      }));

      document.documentElement.classList.add('dark-mode');
      document.body.classList.add('dark-mode');
      document.body.classList.add('matrix-theme');
      localStorage.setItem('theme', 'dark');

      const indicator = document.getElementById('darkModeIndicator');
      if (indicator) { indicator.textContent = 'ON'; indicator.classList.remove('off'); }

      const root = document.documentElement;
      root.style.setProperty('--theme-bg', t.bg);
      root.style.setProperty('--theme-surface', t.surface);
      root.style.setProperty('--theme-text', t.text);
      root.style.setProperty('--theme-border', t.border);
      root.style.setProperty('--theme-accent', t.accent);

      startMatrixBackground(matrixModeIndex);
      document.dispatchEvent(new CustomEvent('dave:themeChange', { detail: { theme: 'matrix' } }));
      return;
    }

    // ── Normal themes: clean up matrix if active ──
    document.body.classList.remove('matrix-theme');
    stopMatrixBackground();

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
    document.dispatchEvent(new CustomEvent('dave:themeChange', { detail: { theme: themeId } }));
  }

  // --- System theme (follow OS colour scheme) ---

  static isSystemThemeEnabled() {
    return localStorage.getItem(SYSTEM_THEME_KEY) === 'true';
  }

  static systemPrefersDark() {
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  /**
   * Apply the OS colour scheme, ignoring (but preserving) any saved custom theme
   * so it can be restored when the user turns System Theme back off.
   */
  static applySystemTheme() {
    document.body.classList.remove('matrix-theme');
    stopMatrixBackground();

    const root = document.documentElement;
    // Drop custom theme variables so the built-in dark/light CSS defaults apply.
    ['--theme-bg', '--theme-surface', '--theme-text', '--theme-border', '--theme-accent']
      .forEach(prop => root.style.removeProperty(prop));

    const prefersDark = SettingsModal.systemPrefersDark();
    root.classList.toggle('dark-mode', prefersDark);
    document.body.classList.toggle('dark-mode', prefersDark);

    // Keep the (dimmed) dark-mode indicator informative
    const indicator = document.getElementById('darkModeIndicator');
    if (indicator) {
      indicator.textContent = prefersDark ? 'ON' : 'OFF';
      indicator.classList.toggle('off', !prefersDark);
    }

    // De-highlight theme swatches — none is "active" while following the system
    document.querySelectorAll('#themeGridDD .theme-swatch, #themeGrid .theme-swatch')
      .forEach(s => s.classList.remove('active'));

    document.dispatchEvent(new CustomEvent('dave:themeChange', {
      detail: { theme: prefersDark ? 'system-dark' : 'system-light' }
    }));
  }

  /** Enable/disable "follow system" mode. */
  static setSystemTheme(enabled) {
    if (enabled) {
      localStorage.setItem(SYSTEM_THEME_KEY, 'true');
      SettingsModal.applySystemTheme();
    } else {
      localStorage.removeItem(SYSTEM_THEME_KEY);
      // Restore the saved custom theme, else honour the manual light/dark pref.
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved) {
        if (saved === 'matrix') matrixModeIndex = 0;
        SettingsModal.applyTheme(saved);
      } else {
        const wantLight = localStorage.getItem('theme') === 'light';
        const root = document.documentElement;
        root.classList.toggle('dark-mode', !wantLight);
        document.body.classList.toggle('dark-mode', !wantLight);
        const indicator = document.getElementById('darkModeIndicator');
        if (indicator) {
          indicator.textContent = wantLight ? 'OFF' : 'ON';
          indicator.classList.toggle('off', wantLight);
        }
      }
    }
    SettingsModal._updateSystemThemeIndicator();
  }

  /** Clear the flag without re-applying (used when the user picks a theme explicitly). */
  static _clearSystemThemeFlag() {
    if (localStorage.getItem(SYSTEM_THEME_KEY)) {
      localStorage.removeItem(SYSTEM_THEME_KEY);
    }
    SettingsModal._updateSystemThemeIndicator();
  }

  static _updateSystemThemeIndicator() {
    const enabled = SettingsModal.isSystemThemeEnabled();
    const indicator = document.getElementById('systemThemeIndicator');
    if (indicator) {
      indicator.textContent = enabled ? 'ON' : 'OFF';
      indicator.classList.toggle('off', !enabled);
    }
    // Dim the manual controls that System Theme overrides (still clickable —
    // interacting with them takes back manual control).
    const darkRow = document.getElementById('darkModeRow');
    if (darkRow) darkRow.classList.toggle('settings-row-disabled', enabled);
    const themeGrid = document.getElementById('themeGridDD');
    if (themeGrid) themeGrid.classList.toggle('settings-section-disabled', enabled);
  }

  static _attachSystemThemeListener() {
    if (SettingsModal._systemThemeListenerAttached || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (SettingsModal.isSystemThemeEnabled()) SettingsModal.applySystemTheme();
    };
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else if (mq.addListener) mq.addListener(handler); // Safari < 14
    SettingsModal._systemThemeListenerAttached = true;
  }

  static initTheme() {
    SettingsModal._attachSystemThemeListener();

    // System Theme takes precedence over any saved custom theme.
    if (SettingsModal.isSystemThemeEnabled()) {
      SettingsModal.applySystemTheme();
      return;
    }

    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved) {
      if (saved === 'matrix') matrixModeIndex = 0;
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

      // Hidden matrix trigger: tiny green dot absolutely positioned in grid corner
      themeGrid.style.position = 'relative';
      const trigger = document.createElement('button');
      trigger.className = 'matrix-trigger';
      trigger.title = '';
      trigger.innerHTML = '<div class="matrix-trigger-dot"></div>';
      themeGrid.appendChild(trigger);

      themeGrid.addEventListener('click', (e) => {
        // ── Matrix trigger click ──
        if (e.target.closest('.matrix-trigger')) {
          // Picking a theme explicitly overrides "follow system"
          SettingsModal._clearSystemThemeFlag();
          // If matrix is already active, advance to next mode; otherwise start at 0
          const isActive = document.body.classList.contains('matrix-theme');
          if (isActive) {
            matrixModeIndex = (matrixModeIndex + 1) % MATRIX_MODE_NAMES.length;
          } else {
            matrixModeIndex = 0;
          }
          SettingsModal.applyTheme('matrix');
          showMatrixModeToast(MATRIX_MODE_NAMES[matrixModeIndex]);
          // Deactivate all normal swatches
          themeGrid.querySelectorAll('.theme-swatch').forEach(s => s.classList.remove('active'));
          return;
        }

        const swatch = e.target.closest('.theme-swatch');
        if (!swatch) return;
        // Picking a theme explicitly overrides "follow system"
        SettingsModal._clearSystemThemeFlag();
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

    // System Theme toggle row
    const systemThemeRow = document.getElementById('systemThemeRow');
    if (systemThemeRow) {
      SettingsModal._updateSystemThemeIndicator();
      systemThemeRow.addEventListener('click', (e) => {
        e.stopPropagation();
        SettingsModal.setSystemTheme(!SettingsModal.isSystemThemeEnabled());
      });
    }

    // A manual dark-mode toggle also counts as taking back control from the OS.
    const darkModeRow = document.getElementById('darkModeRow');
    if (darkModeRow) {
      darkModeRow.addEventListener('click', () => {
        if (SettingsModal.isSystemThemeEnabled()) SettingsModal._clearSystemThemeFlag();
      });
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
        version: '2.7.0', date: 'Jul 20, 2026', title: 'Edit in Photopea',
        features: [
          'Edit any image in Photopea without leaving Dave — an embedded editor panel opens with the image already loaded',
          'Injects the image straight into Photopea via its postMessage API — no clipboard, no manual paste',
          'Available from the image viewer toolbar and the grid-tile hover edit button; works for local and cloud images',
          'Falls back to opening Photopea in a new tab if it can\'t be embedded',
        ]
      },
      {
        version: '2.6.0', date: 'Jul 20, 2026', title: 'AI Files, System Theme & Text Viewer Upgrades',
        features: [
          'New "AI Files" filter category for Markdown, JSON and YAML — distinct from plain Text, still text-rendered',
          'OS/system junk (.DS_Store, Thumbs.db, .git, __MACOSX, …) filtered out at scan, drop and display',
          'Text viewer: true browser fullscreen (F), large-file guard, empty-file placeholder, and markdown list rendering',
          'System Theme setting follows the OS light/dark scheme live, with manual override when you pick a theme',
        ]
      },
      {
        version: '2.5.0', date: 'May 25, 2026', title: 'Multi-select Workflow + Saved Defaults',
        features: [
          'Shift-click range selection on the grid, anchored on the global filtered list so ranges span across pages',
          'Bulk download bundles 2+ selected files into a timestamped dave_download_<YYYY-MM-DD_HH-MM-SS>.zip',
          'Selection auto-clears after a download completes',
          'Save as Default persists tile size, items per page, and active filters across sessions',
        ]
      },
      {
        version: '2.4.0', date: 'Feb 15, 2026', title: 'Project Health Audit #4 — Deep Overhaul',
        features: [
          'CSS monolith split: styles.css reduced from 5,780 to 2,868 lines (-50.4%), 3 new CSS files extracted',
          'CSS custom properties: 33 variables (10 theme + 12 z-index layer map + 11 other), 210 var(--theme-*) usages',
          'Three.js lazy loading: ~800KB deferred until 3D content is first encountered via dynamic import()',
          '13 CSS files deferred via media="print" onload pattern (15 blocking reduced to 2)',
          'Font Awesome upgraded from 6.0.0-beta3 to 6.7.2',
          'Accessibility: 10 aria-labels, 6 landmark roles, skip-link, focus-visible outlines',
          'rAF tracking via Set-based _activeRAFs for bulk cancel on cleanup',
          'Worker path uses import.meta.url for deployment-agnostic resolution',
          'dave_mode.js reduced from 2,273 to 1,923 lines via message data extraction',
          'Overall health score: 7.6 → 8.5 (+0.9 across 3 audit iterations)',
        ]
      },
      {
        version: '2.3.0', date: 'Feb 14, 2026', title: 'Site Health Audit & Fixes',
        features: [
          'Fixed Dave alive effects rendering above modals (z-index 99994 reduced to 2400-2600)',
          'Fixed video scrub listener leak (mousemove/mouseup no longer accumulate permanently)',
          'Fireworks and tears now use GPU-composited transform instead of layout-triggering left/top',
          'Extracted --dave-green CSS custom property (76 usages across 5 files)',
          'Pinned model-viewer to v3.5.0 (was unpinned, risking silent breakage)',
          'Fixed interval cleanup gaps: activity check and auto-behavior intervals now properly cleared',
          'Counter.dev script no longer render-blocking (async defer)',
          'Added CDN preconnect hints for faster loading',
        ]
      },
      {
        version: '2.2.0', date: 'Feb 14, 2026', title: 'Dave Goes Full Alive',
        features: [
          '13 autonomous behaviors across 3 tiers: subtle, medium, and dramatic',
          'Trail engine: Dave moves around screen leaving glowing character trails',
          'Iris effects: radar sweep with ping dots, analog clock with second hand, compass needle',
          'Heart trail, spiral-to-fireworks, constellation creation, shadow puppet show',
          'Element inspection, post-it notes, figure-8 patrol, sleeping on elements',
          'Phased idle nagging with escalating command hints',
          'Activity tracking: Dave notices rapid browsing, filtering, deep dives',
          'Morse code blinking, scroll parallax reactions',
          'Safety wrapper: _safeRun() prevents Dave from becoming permanently unresponsive',
          '11 new dave commands: heart, spiral, constellation, show, patrol, and more',
        ]
      },
      {
        version: '2.1.0', date: 'Feb 13, 2026', title: 'Full Dave Mode',
        features: [
          'Toggleable Full Dave Mode: Dave\'s personality on every interaction (settings gear > Full Dave Mode)',
          'Dave Presence: glowing green eye indicator watches from the bottom-right when active',
          'CRT-styled speech bubbles with typewriter text, scanlines, and blinking cursor',
          'Dave comments on search, sort, filter, theme changes, file loading, errors, and more',
          'Mood system: Dave\'s tone shifts between neutral, impressed, bored, busy, and snarky',
          '150+ unique context-aware messages with rarity weighting',
          'Session memory and idle detection: Dave knows what you\'ve been doing',
          'Persistent toggle: Dave remembers you across visits',
        ]
      },
      {
        version: '2.0.0', date: 'Feb 12, 2026', title: 'Cloud Storage Refinements',
        features: [
          'Multi-bucket S3: save multiple profiles with different credentials per bucket',
          'Multi-account Google Drive: sign into multiple accounts simultaneously and switch between them',
          'Prominent setup guide card in Cloud Storage Settings modal',
          'Collapsible guide sections in cloud-setup.html (start compacted, expand on click)',
          'Dave-tone alternative guides: peeking cards reveal funnier step-by-step instructions',
        ]
      },
      {
        version: '1.9.0', date: 'Feb 12, 2026', title: 'Talk to Dave',
        features: [
          'Revised About section: Dave speaks in his own voice now',
          '"Talk to Dave" feedback section with mini terminal, typewriter responses, and GitHub Issues integration',
          'Dave personality/tone guide for contributors (docs/tone.md)',
        ]
      },
      {
        version: '1.8.0', date: 'Feb 12, 2026', title: 'DAV-9000 Living Terminal',
        features: [
          'Self-aware CRT terminal with 120+ messages, ASCII art, and 6 escalating personality phases',
          'Fourth wall break: welcome joke first, then glitch-transition to DAV-9000 takeover',
          'Terminal comes alive: 12 physical animations (hop, shake, peek, spin, sink, etc.)',
          'Draggable terminal window with bounce-settle, comedic reactions to drag and drop',
        ]
      },
      {
        version: '1.7.0', date: 'Feb 12, 2026', title: 'Matrix Theme Easter Egg',
        features: [
          'Hidden Matrix theme trigger in theme grid (find the green dot!)',
          '9 Matrix rain modes cycle on each click with background rain at 10% opacity',
          'Full Matrix UI: CRT scanlines, vignette, green glow, monospace font',
        ]
      },
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
