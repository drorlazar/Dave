// SettingsModal.js - In-app settings for cloud storage credentials (localStorage-based)

import { CredentialStore } from './CredentialStore.js';

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
            <i class="fa fa-gear"></i>
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
          <div class="settings-section">
            <div class="settings-section-header">
              <i class="fa fa-cloud"></i> AWS S3
              <span class="settings-status" id="s3Status"></span>
            </div>
            <div class="settings-form" id="s3Form">
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
          <div class="settings-section">
            <div class="settings-section-header">
              <i class="fab fa-google-drive"></i> Google Drive
              <span class="settings-status" id="gdriveConfigStatus"></span>
            </div>
            <div class="settings-form" id="gdriveForm">
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
            <a href="docs/CLOUD_STORAGE.md" target="_blank">Cloud Storage Guide</a>.
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

    this._escHandler = (e) => { if (e.key === 'Escape') this.close(); };
    document.addEventListener('keydown', this._escHandler);
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
      // Pre-fill the client ID (not sensitive)
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
      // Reinitialize the GDrive client with new client ID
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
}
