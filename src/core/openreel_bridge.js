// OpenReel bridge — hands the current selection to the vendored OpenReel
// editor served from Dave's own directory on the same origin.
//
// Message contract on BroadcastChannel('dave-openreel'):
//   Dave     -> { type: 'dave:ping' }                   (polled until ready)
//   OpenReel -> { type: 'openreel:ready' }              (on boot and per ping)
//   Dave     -> { type: 'dave:import', files: [File] }
//   OpenReel -> { type: 'openreel:imported', count }
//   OpenReel -> { type: 'openreel:import-error', error }

const CHANNEL_NAME = 'dave-openreel';
// Resolved against Dave's base so it works both at http://localhost:7777/ and
// under a project sub-path such as https://drorlazar.github.io/Dave/.
const EDITOR_PATH = 'vendor/openreel/index.html#/editor';
const EDITOR_URL = new URL(EDITOR_PATH, document.baseURI).href;
const PING_INTERVAL_MS = 500;
const TIMEOUT_MS = 20000;

const EDITABLE_EXTENSIONS = new Set([
  'mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v',
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp',
  'mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'
]);

function showNotification(message, severity = 'info') {
  if (window.errorHandler?.showNotification) {
    window.errorHandler.showNotification(message, severity);
    return;
  }
  const toast = document.createElement('div');
  toast.className = 've-toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2200);
}

function isEditable(model) {
  const type = (model.file?.type || '').toLowerCase();
  if (type.startsWith('video/') || type.startsWith('image/') || type.startsWith('audio/')) {
    return true;
  }
  const ext = (model.name || '').split('.').pop().toLowerCase();
  return EDITABLE_EXTENSIONS.has(ext);
}

/**
 * Collects the selected models that carry a local File object and are of a
 * media type OpenReel can edit.
 * @param {Set<string>|Array<string>} selectedNames
 * @param {Array<Object>} modelFiles
 * @returns {Array<File>}
 */
export async function collectEditableFiles(selectedNames, modelFiles) {
  const models = Array.from(selectedNames)
    .map(name => modelFiles.find(m => m.name === name))
    .filter(model => model && isEditable(model));

  const files = await Promise.all(models.map(model => hydrateFile(model)));
  return files.filter(Boolean);
}

/**
 * Returns a File for the model: the local File when present, otherwise fetched
 * from its remote-control URL or cloud source.
 */
async function hydrateFile(model) {
  if (model.file instanceof File) return model.file;

  try {
    let url = model.remoteUrl || null;
    if (!url && (model.source === 's3' || model.source === 'gdrive')) {
      const { getFileUrl } = await import('../cloud/CloudStorageProvider.js');
      url = await getFileUrl(model);
    }
    if (!url) return null;

    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new File([blob], model.name, { type: blob.type || '' });
  } catch (error) {
    console.warn(`Could not fetch ${model.name} for OpenReel:`, error);
    return null;
  }
}

/**
 * Opens OpenReel in a new tab and pushes the given files into its media library.
 * @param {Array<File>} files
 */
export function sendFilesToOpenReel(files, { skipOpen = false } = {}) {
  if (!files || files.length === 0) {
    showNotification('No video, image or audio files in the selection', 'warning');
    return;
  }

  if (typeof BroadcastChannel === 'undefined') {
    showNotification('This browser does not support the OpenReel bridge', 'error');
    return;
  }

  let channel;
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
  } catch (error) {
    console.error('OpenReel bridge unavailable:', error);
    showNotification('Could not open the OpenReel bridge', 'error');
    return;
  }

  let settled = false;
  let pingTimer = null;
  let timeoutTimer = null;
  let sent = false;

  const cleanup = () => {
    clearInterval(pingTimer);
    clearTimeout(timeoutTimer);
    try {
      channel.close();
    } catch (error) {
      console.warn('OpenReel channel close failed:', error);
    }
  };

  channel.onmessage = (event) => {
    const data = event?.data;
    if (!data || typeof data !== 'object' || settled) return;

    if (data.type === 'openreel:ready' && !sent) {
      sent = true;
      clearInterval(pingTimer);
      try {
        channel.postMessage({ type: 'dave:import', files });
      } catch (error) {
        settled = true;
        cleanup();
        console.error('OpenReel import send failed:', error);
        showNotification('Could not send the selection to OpenReel', 'error');
      }
      return;
    }

    if (data.type === 'openreel:imported') {
      settled = true;
      cleanup();
      const count = Number(data.count) || 0;
      showNotification(
        count === 1 ? 'Sent 1 file to OpenReel' : `Sent ${count} files to OpenReel`,
        'info'
      );
      return;
    }

    if (data.type === 'openreel:import-error') {
      settled = true;
      cleanup();
      showNotification(`OpenReel import failed: ${data.error || 'unknown error'}`, 'error');
    }
  };

  if (!skipOpen) window.open(EDITOR_URL, '_blank');

  const ping = () => {
    try {
      channel.postMessage({ type: 'dave:ping' });
    } catch (error) {
      console.warn('OpenReel ping failed:', error);
    }
  };
  ping();
  pingTimer = setInterval(ping, PING_INTERVAL_MS);

  timeoutTimer = setTimeout(() => {
    if (settled) return;
    settled = true;
    cleanup();
    showNotification('OpenReel did not respond — try again once the editor has loaded', 'error');
  }, TIMEOUT_MS);
}

/**
 * Entry point used by the selection dropdown.
 * @param {Set<string>|Array<string>} selectedNames
 * @param {Array<Object>} modelFiles
 */
export async function editSelectionInOpenReel(selectedNames, modelFiles) {
  // Open the tab synchronously inside the click gesture so the popup is not
  // blocked, then hydrate files (may fetch remote/cloud assets) and hand over.
  const editorWindow = window.open(EDITOR_URL, '_blank');
  const files = await collectEditableFiles(selectedNames, modelFiles);
  if (files.length === 0 && editorWindow) {
    try { editorWindow.close(); } catch { /* COOP may block */ }
  }
  sendFilesToOpenReel(files, { skipOpen: true });
}
