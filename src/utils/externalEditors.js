// externalEditors.js - Maps file types to free online editors

import * as CloudStorage from '../cloud/CloudStorageProvider.js';

const EDITORS = {
  image:   { name: 'Photopea',         url: 'https://www.photopea.com/' },
  model3d: { name: 'Three.js Editor',  url: 'https://threejs.org/editor/' },
  video:   { name: 'Video Editor',     url: 'https://online-video-cutter.com/' },
  audio:   { name: 'AudioMass',        url: 'https://audiomass.co/' },
  text:    { name: 'EditPad',          url: 'https://www.editpad.org/' },
};

/**
 * Get editor info for a given asset type.
 * Returns { name, url } or null if no editor exists (e.g. fonts).
 */
export function getEditorForType(type, subtype) {
  if (type === '3d' || subtype === 'glb' || subtype === 'fbx') return EDITORS.model3d;
  if (type === 'image')  return EDITORS.image;
  if (type === 'video')  return EDITORS.video;
  if (type === 'audio')  return EDITORS.audio;
  if (type === 'text')   return EDITORS.text;
  return null; // fonts, unknown types
}

/**
 * Open the appropriate external editor for a model.
 * For S3 images, Photopea is opened with the file pre-loaded via pre-signed URL.
 * For everything else, the editor opens and the user uploads manually.
 */
export async function openInEditor(model) {
  const editor = getEditorForType(model.type, model.subtype);
  if (!editor) return;

  // Special case: Photopea can pre-load S3 images via URL hash
  if (model.type === 'image' && model.source === 's3') {
    try {
      const presignedUrl = await CloudStorage.getFileUrl(model);
      const config = JSON.stringify({ files: [presignedUrl] });
      window.open(editor.url + '#' + encodeURIComponent(config), '_blank');
      return;
    } catch (e) {
      console.warn('Could not get pre-signed URL for Photopea, opening without file:', e);
    }
  }

  window.open(editor.url, '_blank');
}
