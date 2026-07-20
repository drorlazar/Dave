// systemFiles.js - Detect generic OS "junk" / system files and folders that
// should never appear in an asset viewer: macOS metadata (.DS_Store, AppleDouble
// ._sidecars, .Spotlight-V100, .Trashes), Windows shell junk (Thumbs.db,
// desktop.ini, $RECYCLE.BIN) and hidden dot-entries / VCS folders (.git, .svn).
//
// NOTE: workers can't import ES modules, so folder_scanner_worker.js keeps an
// inline copy of this logic. Keep the two in sync when editing.

// Known junk FILE names that do NOT start with a dot (matched case-insensitively).
const SYSTEM_FILE_NAMES = new Set([
  'thumbs.db',
  'ehthumbs.db',
  'ehthumbs_vista.db',
  'desktop.ini',
  'iconcache.db',
  'icon\r',       // macOS custom folder-icon sidecar ("Icon" + carriage return)
]);

// Known system/junk DIRECTORY names that do NOT start with a dot
// (matched case-insensitively).
const SYSTEM_DIR_NAMES = new Set([
  '$recycle.bin',
  'recycler',
  'system volume information',
  '__macosx',
]);

function baseName(name) {
  return String(name == null ? '' : name).split(/[\\/]/).pop().trim();
}

/**
 * True for generic OS/system junk files that should be hidden from the viewer.
 * Covers every dotfile (e.g. .DS_Store, ._resourcefork, .localized) plus a set
 * of well-known non-dot junk files (Thumbs.db, desktop.ini, ...).
 * @param {string} name - file name or path
 * @returns {boolean}
 */
export function isSystemFile(name) {
  const base = baseName(name);
  if (!base) return false;
  if (base.charAt(0) === '.') return true;           // all dotfiles
  return SYSTEM_FILE_NAMES.has(base.toLowerCase());
}

/**
 * True for directories that should not be scanned/recursed into
 * (hidden dot-folders like .git / .svn plus known system folders).
 * @param {string} name - directory name or path
 * @returns {boolean}
 */
export function isSystemDir(name) {
  const base = baseName(name);
  if (!base) return false;
  if (base.charAt(0) === '.') return true;           // hidden folders (.git, .Trashes, ...)
  return SYSTEM_DIR_NAMES.has(base.toLowerCase());
}

/**
 * Convenience helper: should this directory entry be ignored entirely?
 * @param {string} name
 * @param {'file'|'directory'} kind
 * @returns {boolean}
 */
export function isSystemEntry(name, kind) {
  return kind === 'directory' ? isSystemDir(name) : isSystemFile(name);
}
