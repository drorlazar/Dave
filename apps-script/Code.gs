// Code.gs - Google Apps Script bridge for Dave (Digital Assets Viewer)
//
// DEPLOYMENT:
//   1. Go to https://script.google.com → New Project
//   2. Paste this file as Code.gs
//   3. Create Bridge.html (from the companion file)
//   4. Deploy → New Deployment → Web App
//      - Execute as: "User accessing the web app"
//      - Who has access: "Anyone with Google account"
//   5. Copy the deployment URL and update APPS_SCRIPT_URL in Dave's GDriveClient.js

/**
 * Serves the Bridge HTML page when the web app is opened.
 */
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('Bridge')
    .setTitle('Dave - Google Drive')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Returns connection status and the current user's email.
 */
function ping() {
  return {
    status: 'ok',
    email: Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail() || ''
  };
}

/**
 * Lists files and folders in a given Drive folder.
 * @param {string} folderId - The Google Drive folder ID, or 'root' for My Drive.
 * @returns {Object} { items: Array<{id, name, mimeType, type, size, modifiedTime}> }
 */
function listFiles(folderId) {
  var folder = (folderId === 'root')
    ? DriveApp.getRootFolder()
    : DriveApp.getFolderById(folderId);

  var items = [];

  // Subfolders
  var folders = folder.getFolders();
  while (folders.hasNext()) {
    var f = folders.next();
    items.push({
      id: f.getId(),
      name: f.getName(),
      mimeType: 'application/vnd.google-apps.folder',
      type: 'directory',
      size: 0,
      modifiedTime: f.getLastUpdated().toISOString()
    });
  }

  // Files
  var files = folder.getFiles();
  while (files.hasNext()) {
    var file = files.next();
    items.push({
      id: file.getId(),
      name: file.getName(),
      mimeType: file.getMimeType(),
      type: 'file',
      size: file.getSize(),
      modifiedTime: file.getLastUpdated().toISOString()
    });
  }

  // Sort: folders first, then alphabetically
  items.sort(function(a, b) {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return { items: items };
}

/**
 * Lists files recursively across subfolders.
 * @param {string} folderId - Starting folder ID or 'root'.
 * @param {string|number} maxDepth - Max recursion depth ('all' or a number).
 * @returns {Object} { files: Array<{id, name, mimeType, type, size, modifiedTime, fullPath}> }
 */
function listFilesRecursive(folderId, maxDepth) {
  var depthLimit = (maxDepth === 'all' || maxDepth === undefined) ? 999 : parseInt(maxDepth, 10) || 999;
  var allFiles = [];

  function scanFolder(currentFolderId, currentDepth, pathPrefix) {
    var folder = (currentFolderId === 'root')
      ? DriveApp.getRootFolder()
      : DriveApp.getFolderById(currentFolderId);

    var files = folder.getFiles();
    while (files.hasNext()) {
      var file = files.next();
      allFiles.push({
        id: file.getId(),
        name: file.getName(),
        mimeType: file.getMimeType(),
        type: 'file',
        size: file.getSize(),
        modifiedTime: file.getLastUpdated().toISOString(),
        fullPath: pathPrefix + file.getName()
      });
    }

    if (currentDepth < depthLimit) {
      var subfolders = folder.getFolders();
      while (subfolders.hasNext()) {
        var sub = subfolders.next();
        scanFolder(sub.getId(), currentDepth + 1, pathPrefix + sub.getName() + '/');
      }
    }
  }

  scanFolder(folderId, 0, '');
  return { files: allFiles };
}

/**
 * Downloads a file and returns its content as base64.
 * @param {string} fileId - Google Drive file ID.
 * @returns {Object} { name, mimeType, size, content (base64), encoding }
 */
function downloadFile(fileId) {
  var file = DriveApp.getFileById(fileId);
  var size = file.getSize();
  var name = file.getName();
  var mimeType = file.getMimeType();

  // Apps Script has ~50MB response limit. Base64 inflates by ~33%.
  // Use 30MB as a safe cutoff.
  var MAX_SIZE = 30 * 1024 * 1024;

  if (size > MAX_SIZE) {
    return {
      error: 'file_too_large',
      message: 'File is too large (' + Math.round(size / 1024 / 1024) + 'MB). Maximum is 30MB for streaming.',
      name: name,
      size: size,
      mimeType: mimeType
    };
  }

  var blob = file.getBlob();
  var base64 = Utilities.base64Encode(blob.getBytes());

  return {
    name: name,
    mimeType: mimeType,
    size: size,
    content: base64,
    encoding: 'base64'
  };
}

/**
 * Lists files shared with the current user.
 * Returns folders and files, sorted with folders first.
 * @returns {Object} { items: Array<{id, name, mimeType, type, size, modifiedTime}> }
 */
function listSharedWithMe() {
  var items = [];
  var files = DriveApp.searchFiles('sharedWithMe = true');
  var count = 0;
  var MAX_ITEMS = 200;

  while (files.hasNext() && count < MAX_ITEMS) {
    var file = files.next();
    var isFolder = file.getMimeType() === 'application/vnd.google-apps.folder';
    items.push({
      id: file.getId(),
      name: file.getName(),
      mimeType: file.getMimeType(),
      type: isFolder ? 'directory' : 'file',
      size: isFolder ? 0 : file.getSize(),
      modifiedTime: file.getLastUpdated().toISOString()
    });
    count++;
  }

  items.sort(function(a, b) {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return { items: items };
}

/**
 * Lists starred files/folders.
 * @returns {Object} { items: Array }
 */
function listStarred() {
  var items = [];
  var files = DriveApp.searchFiles('starred = true');
  var count = 0;
  var MAX_ITEMS = 200;

  while (files.hasNext() && count < MAX_ITEMS) {
    var file = files.next();
    var isFolder = file.getMimeType() === 'application/vnd.google-apps.folder';
    items.push({
      id: file.getId(),
      name: file.getName(),
      mimeType: file.getMimeType(),
      type: isFolder ? 'directory' : 'file',
      size: isFolder ? 0 : file.getSize(),
      modifiedTime: file.getLastUpdated().toISOString()
    });
    count++;
  }

  items.sort(function(a, b) {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return { items: items };
}

/**
 * Lists recently modified files (last 30 days).
 * @returns {Object} { items: Array }
 */
function listRecent() {
  var items = [];
  var thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  var dateStr = Utilities.formatDate(thirtyDaysAgo, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");

  var files = DriveApp.searchFiles('modifiedDate > "' + dateStr + '" and mimeType != "application/vnd.google-apps.folder"');
  var count = 0;
  var MAX_ITEMS = 100;

  while (files.hasNext() && count < MAX_ITEMS) {
    var file = files.next();
    items.push({
      id: file.getId(),
      name: file.getName(),
      mimeType: file.getMimeType(),
      type: 'file',
      size: file.getSize(),
      modifiedTime: file.getLastUpdated().toISOString()
    });
    count++;
  }

  // Sort by modified time descending (most recent first)
  items.sort(function(a, b) {
    return new Date(b.modifiedTime) - new Date(a.modifiedTime);
  });

  return { items: items };
}
