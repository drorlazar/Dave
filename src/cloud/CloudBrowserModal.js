// CloudBrowserModal.js - Modal dialog for browsing cloud storage folders

import { listFiles, listFilesRecursive, listGDriveSpecial, getGDriveClient } from './CloudStorageProvider.js';
import { CredentialStore } from './CredentialStore.js';

// Map file extensions to Font Awesome icons
const FILE_TYPE_ICONS = {
  // 3D Models
  glb: 'fa-cube', gltf: 'fa-cube', fbx: 'fa-cube', obj: 'fa-cube',
  stl: 'fa-cube', ply: 'fa-cube', dae: 'fa-cube', '3ds': 'fa-cube',
  // Images
  jpg: 'fa-image', jpeg: 'fa-image', png: 'fa-image', gif: 'fa-image',
  webp: 'fa-image', svg: 'fa-image', bmp: 'fa-image', ico: 'fa-image',
  tiff: 'fa-image', tif: 'fa-image',
  // Video
  mp4: 'fa-film', webm: 'fa-film', mov: 'fa-film', avi: 'fa-film',
  mkv: 'fa-film', ogv: 'fa-film',
  // Audio
  mp3: 'fa-music', wav: 'fa-music', ogg: 'fa-music', flac: 'fa-music',
  m4a: 'fa-music', oga: 'fa-music',
  // Fonts
  ttf: 'fa-font', otf: 'fa-font', woff: 'fa-font', woff2: 'fa-font',
  // Documents
  pdf: 'fa-file-pdf',
  // Text/Code
  txt: 'fa-file-lines', md: 'fa-file-lines', json: 'fa-file-code',
  xml: 'fa-file-code', csv: 'fa-file-lines', yaml: 'fa-file-code',
  yml: 'fa-file-code', log: 'fa-file-lines', ini: 'fa-file-lines',
  cfg: 'fa-file-lines', conf: 'fa-file-lines', toml: 'fa-file-code',
};

function getFileIcon(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  return FILE_TYPE_ICONS[ext] || 'fa-file';
}

function getFileIconColor(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  if (['glb','gltf','fbx','obj','stl','ply','dae','3ds'].includes(ext)) return '#7c7cff';
  if (['jpg','jpeg','png','gif','webp','svg','bmp','ico','tiff','tif'].includes(ext)) return '#4caf50';
  if (['mp4','webm','mov','avi','mkv','ogv'].includes(ext)) return '#e57373';
  if (['mp3','wav','ogg','flac','m4a','oga'].includes(ext)) return '#ffb74d';
  if (['ttf','otf','woff','woff2'].includes(ext)) return '#90caf9';
  if (['pdf'].includes(ext)) return '#ef5350';
  return '#888';
}

function formatSize(bytes) {
  if (!bytes || bytes === 0) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

export class CloudBrowserModal {
  constructor() {
    this.modal = null;
    this.currentSource = null;
    this.currentPath = '';
    this.currentFolderId = 'root';
    this.currentBucket = '';
    this.currentProfileId = null;
    this.breadcrumbs = [];
    this.lastLoadedFiles = [];
    this.lastLoadedFolders = [];
    this.includeSubfolders = false;
    this.subfolderDepth = 'all';
    this._specialSection = null; // 'shared', 'starred', 'recent', or null
  }

  open(source, { bucket, prefix, folderId, profileId } = {}) {
    this.currentSource = source;
    this._specialSection = null;
    this.currentProfileId = profileId || null;

    if (source === 's3') {
      // If no explicit profile and multiple profiles exist, show picker
      const profiles = CredentialStore.getS3Profiles();
      if (!profileId && !bucket && profiles.length > 1) {
        this.createModal();
        this.showS3ProfilePicker(profiles);
        return;
      }

      // Resolve profile to get bucket
      if (profileId) {
        const profile = CredentialStore.getS3Profile(profileId);
        if (profile) {
          this.currentProfileId = profileId;
          this.currentBucket = bucket || profile.bucket;
        }
      } else if (profiles.length === 1) {
        this.currentProfileId = profiles[0].id;
        this.currentBucket = bucket || profiles[0].bucket;
      } else {
        const defaultId = CredentialStore.getDefaultS3ProfileId();
        const profile = profiles.find(p => p.id === defaultId) || profiles[0];
        if (profile) {
          this.currentProfileId = profile.id;
          this.currentBucket = bucket || profile.bucket;
        }
      }

      this.currentBucket = this.currentBucket || 'my-bucket';
      this.currentPath = prefix || '';
      this.breadcrumbs = [{ name: this.currentBucket, path: '' }];

      if (prefix) {
        const parts = prefix.replace(/\/$/, '').split('/');
        let accumulated = '';
        for (const part of parts) {
          accumulated += part + '/';
          this.breadcrumbs.push({ name: part, path: accumulated });
        }
      }
      if (!this.modal) this.createModal();
      this.loadFolder();
    } else {
      this.currentFolderId = folderId || 'root';

      if (folderId && folderId !== 'root') {
        this.breadcrumbs = [{ name: 'Google Drive', folderId: '__root__', isHome: true }];
        this.breadcrumbs.push({ name: 'Folder', folderId: folderId });
        this.createModal();
        this.loadFolder();
      } else {
        this.breadcrumbs = [{ name: 'Google Drive', folderId: '__root__', isHome: true }];
        this.createModal();
        this.showGDriveHome();
      }
    }
  }

  createModal() {
    const existing = document.getElementById('cloudBrowserModal');
    if (existing) existing.remove();

    const sourceIcon = this.currentSource === 's3' ? 'fa-cloud' : 'fab fa-google-drive';
    const sourceLabel = this.currentSource === 's3' ? 'AWS S3' : 'Google Drive';

    this.modal = document.createElement('div');
    this.modal.id = 'cloudBrowserModal';
    this.modal.className = 'cloud-modal-overlay';
    this.modal.innerHTML = `
      <div class="cloud-modal-content">
        <div class="cloud-modal-header">
          <span class="cloud-modal-title">
            <i class="fa ${sourceIcon}"></i>
            Browse ${sourceLabel}
          </span>
          <button class="cloud-modal-close" id="cloudBrowserClose" title="Close">&times;</button>
        </div>
        <div class="cloud-nav-bar">
          <button class="cloud-nav-btn" id="cloudBackBtn" title="Go back" disabled>
            <i class="fa fa-arrow-left"></i>
          </button>
          <div class="cloud-breadcrumb" id="cloudBreadcrumb"></div>
        </div>
        <div class="cloud-file-list" id="cloudFileList">
          <div class="cloud-loading"><i class="fa fa-spinner fa-spin"></i> Loading...</div>
        </div>
        <div class="cloud-modal-footer">
          <div class="cloud-footer-left">
            <span class="cloud-file-count" id="cloudFileCount"></span>
          </div>
          <div class="cloud-footer-right">
            <label class="cloud-subfolder-toggle" title="Include files from subfolders">
              <input type="checkbox" id="cloudSubfolders">
              <i class="fa fa-sitemap"></i>
              <span>Subfolders</span>
              <select id="cloudDepth" class="cloud-depth-select" disabled>
                <option value="1">1 level</option>
                <option value="2">2 levels</option>
                <option value="3">3 levels</option>
                <option value="all" selected>All</option>
              </select>
            </label>
            <button class="btn cloud-load-btn" id="cloudLoadFolder">
              <i class="fa fa-download"></i> Load Files
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(this.modal);

    // Event listeners
    this.modal.querySelector('#cloudBrowserClose').addEventListener('click', () => this.close());
    this.modal.querySelector('#cloudLoadFolder').addEventListener('click', () => this.loadSelectedFolder());
    this.modal.querySelector('#cloudBackBtn').addEventListener('click', () => this.goUp());
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });

    const subfolderCheckbox = this.modal.querySelector('#cloudSubfolders');
    const depthSelect = this.modal.querySelector('#cloudDepth');
    subfolderCheckbox.addEventListener('change', () => {
      this.includeSubfolders = subfolderCheckbox.checked;
      depthSelect.disabled = !subfolderCheckbox.checked;
    });
    depthSelect.addEventListener('change', () => {
      this.subfolderDepth = depthSelect.value;
    });

    this._escHandler = (e) => { if (e.key === 'Escape') this.close(); };
    document.addEventListener('keydown', this._escHandler);
  }

  goUp() {
    if (this.breadcrumbs.length <= 1) {
      if (this.currentSource === 'gdrive') {
        this.breadcrumbs = [{ name: 'Google Drive', folderId: '__root__', isHome: true }];
        this._specialSection = null;
        this.showGDriveHome();
      }
      return;
    }

    const parentCrumb = this.breadcrumbs[this.breadcrumbs.length - 2];
    if (parentCrumb && parentCrumb.isHome) {
      this.breadcrumbs = [{ name: 'Google Drive', folderId: '__root__', isHome: true }];
      this._specialSection = null;
      this.showGDriveHome();
      return;
    }

    this.navigateToBreadcrumb(this.breadcrumbs.length - 2);
  }

  showGDriveHome() {
    const listEl = this.modal.querySelector('#cloudFileList');
    const countEl = this.modal.querySelector('#cloudFileCount');
    const loadBtn = this.modal.querySelector('#cloudLoadFolder');
    listEl.innerHTML = '';
    countEl.textContent = 'Select a section to browse';
    loadBtn.disabled = true;

    // Account selector bar
    this._renderAccountBar(listEl);

    const sections = [
      { icon: 'fa-hard-drive', label: 'My Drive', action: () => this._enterMyDrive() },
      { icon: 'fa-users', label: 'Shared with me', action: () => this._enterSpecialSection('shared', 'Shared with me') },
      { icon: 'fa-star', label: 'Starred', action: () => this._enterSpecialSection('starred', 'Starred') },
      { icon: 'fa-clock', label: 'Recent', action: () => this._enterSpecialSection('recent', 'Recent') },
    ];

    sections.forEach(section => {
      const item = document.createElement('div');
      item.className = 'cloud-item cloud-section-item';
      item.innerHTML = `
        <i class="fa ${section.icon} cloud-section-icon"></i>
        <span class="cloud-item-name">${section.label}</span>
        <i class="fa fa-chevron-right cloud-item-arrow"></i>
      `;
      item.addEventListener('click', section.action);
      listEl.appendChild(item);
    });

    this.updateBreadcrumb();
  }

  _renderAccountBar(listEl) {
    try {
      const client = getGDriveClient();
      const accounts = client.getAccounts();
      if (accounts.length === 0) return;

      const bar = document.createElement('div');
      bar.className = 'gdrive-account-bar';

      accounts.forEach(account => {
        const pill = document.createElement('button');
        pill.className = 'gdrive-account-pill' + (account.email === client.activeEmail ? ' active' : '');
        const initial = (account.name || account.email || '?')[0].toUpperCase();
        pill.innerHTML = `
          ${account.picture
            ? `<img class="gdrive-account-avatar" src="${account.picture}" alt="" referrerpolicy="no-referrer">`
            : `<span class="gdrive-account-avatar gdrive-account-initial">${initial}</span>`
          }
          <span class="gdrive-account-name">${account.name || account.email}</span>
        `;
        pill.addEventListener('click', () => {
          client.setActiveAccount(account.email);
          // Re-render home to update active state
          this.showGDriveHome();
        });
        bar.appendChild(pill);
      });

      // Add account button
      const addBtn = document.createElement('button');
      addBtn.className = 'gdrive-add-account-btn';
      addBtn.innerHTML = '<i class="fa fa-plus"></i> Add account';
      addBtn.addEventListener('click', async () => {
        const success = await client.requestToken();
        if (success) {
          this.showGDriveHome();
        }
      });
      bar.appendChild(addBtn);

      listEl.appendChild(bar);
    } catch {
      // Silently skip if client not available
    }
  }

  _enterMyDrive() {
    this.currentFolderId = 'root';
    this._specialSection = null;
    this.breadcrumbs = [
      { name: 'Google Drive', folderId: '__root__', isHome: true },
      { name: 'My Drive', folderId: 'root' }
    ];
    this.loadFolder();
  }

  async _enterSpecialSection(section, label) {
    this._specialSection = section;
    this.breadcrumbs = [
      { name: 'Google Drive', folderId: '__root__', isHome: true },
      { name: label, specialSection: section }
    ];

    const listEl = this.modal.querySelector('#cloudFileList');
    const countEl = this.modal.querySelector('#cloudFileCount');
    const loadBtn = this.modal.querySelector('#cloudLoadFolder');
    listEl.innerHTML = '<div class="cloud-loading"><i class="fa fa-spinner fa-spin"></i> Loading...</div>';
    countEl.textContent = '';
    loadBtn.disabled = true;

    try {
      const { folders, files } = await listGDriveSpecial(section);
      this.lastLoadedFiles = files;
      this.lastLoadedFolders = folders;

      listEl.innerHTML = '';

      folders.forEach(folder => {
        const item = document.createElement('div');
        item.className = 'cloud-item cloud-folder-item';
        item.innerHTML = `
          <i class="fa fa-folder cloud-folder-icon"></i>
          <span class="cloud-item-name">${folder.name}</span>
          <i class="fa fa-chevron-right cloud-item-arrow"></i>
        `;
        item.addEventListener('click', () => this.navigateToFolder(folder));
        listEl.appendChild(item);
      });

      files.forEach(file => {
        const item = document.createElement('div');
        item.className = 'cloud-item cloud-file-item';
        const icon = getFileIcon(file.name);
        const iconColor = getFileIconColor(file.name);
        const size = formatSize(file.size);
        item.innerHTML = `
          <i class="fa ${icon} cloud-file-icon" style="color:${iconColor}"></i>
          <span class="cloud-item-name">${file.name}</span>
          ${size ? `<span class="cloud-item-size">${size}</span>` : ''}
        `;
        listEl.appendChild(item);
      });

      if (folders.length === 0 && files.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'cloud-empty';
        empty.textContent = `No items in ${label}`;
        listEl.appendChild(empty);
      }

      countEl.textContent = `${files.length} file${files.length !== 1 ? 's' : ''}` +
        (folders.length > 0 ? ` + ${folders.length} folder${folders.length !== 1 ? 's' : ''}` : '');
      loadBtn.disabled = files.length === 0 && folders.length === 0;

      this.updateBreadcrumb();
    } catch (error) {
      listEl.innerHTML = `<div class="cloud-error"><i class="fa fa-exclamation-triangle"></i> ${error.message}</div>`;
      console.error('Cloud browser error:', error);
    }
  }

  updateBreadcrumb() {
    const crumbEl = this.modal.querySelector('#cloudBreadcrumb');
    const backBtn = this.modal.querySelector('#cloudBackBtn');
    crumbEl.innerHTML = '';

    if (this.currentSource === 'gdrive') {
      backBtn.disabled = this.breadcrumbs.length <= 1 && this.breadcrumbs[0]?.isHome;
    } else {
      backBtn.disabled = this.breadcrumbs.length <= 1;
    }

    this.breadcrumbs.forEach((crumb, i) => {
      if (i > 0) {
        const sep = document.createElement('span');
        sep.className = 'cloud-breadcrumb-sep';
        sep.textContent = ' / ';
        crumbEl.appendChild(sep);
      }

      const item = document.createElement('span');
      item.className = 'cloud-breadcrumb-item';
      if (crumb.isHome) {
        item.innerHTML = `<i class="fab fa-google-drive"></i> ${crumb.name}`;
      } else {
        item.textContent = crumb.name;
      }
      if (i < this.breadcrumbs.length - 1) {
        item.classList.add('clickable');
        item.addEventListener('click', () => this.navigateToBreadcrumb(i));
      }
      crumbEl.appendChild(item);
    });
  }

  navigateToBreadcrumb(index) {
    const crumb = this.breadcrumbs[index];

    if (crumb.isHome) {
      this.breadcrumbs = [crumb];
      this._specialSection = null;
      this.showGDriveHome();
      return;
    }

    if (crumb.specialSection) {
      this.breadcrumbs = this.breadcrumbs.slice(0, index + 1);
      this._enterSpecialSection(crumb.specialSection, crumb.name);
      return;
    }

    this.breadcrumbs = this.breadcrumbs.slice(0, index + 1);

    if (this.currentSource === 's3') {
      this.currentPath = crumb.path || '';
    } else {
      this.currentFolderId = crumb.folderId || 'root';
    }

    this.loadFolder();
  }

  async loadFolder() {
    const listEl = this.modal.querySelector('#cloudFileList');
    const countEl = this.modal.querySelector('#cloudFileCount');
    const loadBtn = this.modal.querySelector('#cloudLoadFolder');
    listEl.innerHTML = '<div class="cloud-loading"><i class="fa fa-spinner fa-spin"></i> Loading...</div>';
    countEl.textContent = '';
    loadBtn.disabled = true;

    try {
      const params = this.currentSource === 's3'
        ? { bucket: this.currentBucket, prefix: this.currentPath, profileId: this.currentProfileId }
        : { folderId: this.currentFolderId };

      const { folders, files } = await listFiles(this.currentSource, params);
      this.lastLoadedFiles = files;
      this.lastLoadedFolders = folders;

      listEl.innerHTML = '';

      // Render folders
      folders.forEach(folder => {
        const item = document.createElement('div');
        item.className = 'cloud-item cloud-folder-item';
        item.innerHTML = `
          <i class="fa fa-folder cloud-folder-icon"></i>
          <span class="cloud-item-name">${folder.name}</span>
          <i class="fa fa-chevron-right cloud-item-arrow"></i>
        `;
        item.addEventListener('click', () => this.navigateToFolder(folder));
        listEl.appendChild(item);
      });

      // Render files with type icons and sizes
      files.forEach(file => {
        const item = document.createElement('div');
        item.className = 'cloud-item cloud-file-item';
        const icon = getFileIcon(file.name);
        const iconColor = getFileIconColor(file.name);
        const size = formatSize(file.size);
        item.innerHTML = `
          <i class="fa ${icon} cloud-file-icon" style="color:${iconColor}"></i>
          <span class="cloud-item-name">${file.name}</span>
          ${size ? `<span class="cloud-item-size">${size}</span>` : ''}
        `;
        listEl.appendChild(item);
      });

      // Show message if empty
      if (folders.length === 0 && files.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'cloud-empty';
        empty.textContent = 'This folder is empty';
        listEl.appendChild(empty);
      }

      const hasContent = files.length > 0 || folders.length > 0;
      countEl.textContent = `${files.length} file${files.length !== 1 ? 's' : ''} in this folder` +
        (folders.length > 0 ? ` + ${folders.length} subfolder${folders.length !== 1 ? 's' : ''}` : '');
      loadBtn.disabled = !hasContent;

      this.updateBreadcrumb();
    } catch (error) {
      listEl.innerHTML = `<div class="cloud-error"><i class="fa fa-exclamation-triangle"></i> ${error.message}</div>`;
      console.error('Cloud browser error:', error);
    }
  }

  navigateToFolder(folder) {
    if (this.currentSource === 's3') {
      this.currentPath = folder.path;
      this.breadcrumbs.push({ name: folder.name, path: folder.path });
    } else {
      this.currentFolderId = folder.id;
      this.breadcrumbs.push({ name: folder.name, folderId: folder.id });
    }
    this.loadFolder();
  }

  showS3ProfilePicker(profiles) {
    const listEl = this.modal.querySelector('#cloudFileList');
    const countEl = this.modal.querySelector('#cloudFileCount');
    const loadBtn = this.modal.querySelector('#cloudLoadFolder');
    listEl.innerHTML = '';
    countEl.textContent = 'Select an S3 profile to browse';
    loadBtn.disabled = true;

    const defaultId = CredentialStore.getDefaultS3ProfileId();

    profiles.forEach(profile => {
      const item = document.createElement('div');
      item.className = 'cloud-item cloud-section-item';
      const keyHint = profile.accessKeyId ? profile.accessKeyId.substring(0, 4) + '****' : '';
      const isDefault = profile.id === defaultId;
      item.innerHTML = `
        <i class="fab fa-aws cloud-section-icon" style="color:#ff9900"></i>
        <span class="cloud-item-name">
          ${profile.label || profile.bucket}
          ${isDefault ? '<span style="font-size:0.7rem;color:#ff9900;margin-left:6px">Default</span>' : ''}
        </span>
        <span class="cloud-item-size">${profile.region} &middot; ${profile.bucket}</span>
        <i class="fa fa-chevron-right cloud-item-arrow"></i>
      `;
      item.addEventListener('click', () => {
        this.currentProfileId = profile.id;
        this.currentBucket = profile.bucket;
        this.currentPath = '';
        this.breadcrumbs = [{ name: profile.bucket || profile.label, path: '' }];
        this.loadFolder();
      });
      listEl.appendChild(item);
    });

    this.updateBreadcrumb();
  }

  async loadSelectedFolder() {
    const loadBtn = this.modal.querySelector('#cloudLoadFolder');
    const countEl = this.modal.querySelector('#cloudFileCount');
    loadBtn.disabled = true;
    loadBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Loading...';

    try {
      let files;

      if (this.includeSubfolders && this.lastLoadedFolders.length > 0) {
        // Recursive load including subfolders
        countEl.textContent = 'Scanning subfolders...';
        const params = this.currentSource === 's3'
          ? { bucket: this.currentBucket, prefix: this.currentPath, maxDepth: this.subfolderDepth, profileId: this.currentProfileId }
          : { folderId: this.currentFolderId, maxDepth: this.subfolderDepth };
        files = await listFilesRecursive(this.currentSource, params);
      } else {
        // Current folder only
        files = this.lastLoadedFiles;
      }

      if (files.length === 0) {
        countEl.textContent = 'No supported files found';
        loadBtn.innerHTML = '<i class="fa fa-download"></i> Load Files';
        loadBtn.disabled = false;
        return;
      }

      window.dispatchEvent(new CustomEvent('cloudFilesLoaded', {
        detail: {
          files,
          folders: this.lastLoadedFolders,
          context: {
            source: this.currentSource,
            breadcrumbs: [...this.breadcrumbs],
            path: this.currentPath,
            folderId: this.currentFolderId,
            bucket: this.currentBucket,
            profileId: this.currentProfileId,
            specialSection: this._specialSection
          }
        }
      }));
      this.close();
    } catch (error) {
      console.error('Error loading cloud files:', error);
      countEl.textContent = `Error: ${error.message}`;
      loadBtn.innerHTML = '<i class="fa fa-download"></i> Load Files';
      loadBtn.disabled = false;
    }
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
