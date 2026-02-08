// CloudBrowserModal.js - Modal dialog for browsing cloud storage folders

import { listFiles, listFilesRecursive } from './CloudStorageProvider.js';

export class CloudBrowserModal {
  constructor() {
    this.modal = null;
    this.currentSource = null;
    this.currentPath = '';
    this.currentFolderId = 'root';
    this.currentBucket = '';
    this.breadcrumbs = [];
    this.lastLoadedFiles = [];
    this.lastLoadedFolders = [];
    this.includeSubfolders = false;
    this.subfolderDepth = 'all';
  }

  open(source, { bucket, prefix, folderId } = {}) {
    this.currentSource = source;

    if (source === 's3') {
      this.currentBucket = bucket || 'apollo-tasks';
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
    } else {
      this.currentFolderId = folderId || 'root';
      this.breadcrumbs = [{ name: 'My Drive', folderId: 'root' }];

      if (folderId && folderId !== 'root') {
        this.breadcrumbs.push({ name: 'Shared Folder', folderId: folderId });
      }
    }

    this.createModal();
    this.loadFolder();
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
        <div class="cloud-breadcrumb" id="cloudBreadcrumb"></div>
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

  updateBreadcrumb() {
    const crumbEl = this.modal.querySelector('#cloudBreadcrumb');
    crumbEl.innerHTML = '';

    this.breadcrumbs.forEach((crumb, i) => {
      if (i > 0) {
        const sep = document.createElement('span');
        sep.className = 'cloud-breadcrumb-sep';
        sep.textContent = ' / ';
        crumbEl.appendChild(sep);
      }

      const item = document.createElement('span');
      item.className = 'cloud-breadcrumb-item';
      item.textContent = crumb.name;
      if (i < this.breadcrumbs.length - 1) {
        item.classList.add('clickable');
        item.addEventListener('click', () => this.navigateToBreadcrumb(i));
      }
      crumbEl.appendChild(item);
    });
  }

  navigateToBreadcrumb(index) {
    this.breadcrumbs = this.breadcrumbs.slice(0, index + 1);
    const crumb = this.breadcrumbs[index];

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
        ? { bucket: this.currentBucket, prefix: this.currentPath }
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

      // Show message if empty
      if (folders.length === 0 && files.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'cloud-empty';
        empty.textContent = 'This folder is empty';
        listEl.appendChild(empty);
      }

      const hasContent = files.length > 0 || folders.length > 0;
      countEl.textContent = `${files.length} supported file${files.length !== 1 ? 's' : ''} in this folder` +
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
          ? { bucket: this.currentBucket, prefix: this.currentPath, maxDepth: this.subfolderDepth }
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
        detail: { files }
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
