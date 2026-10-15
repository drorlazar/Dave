// shared/filters.js
// Shared filter state to avoid circular dependencies

// Initialize active filters
export const FILTER_CATEGORIES = ['fbx', 'glb', 'video', 'mp3', 'wav', 'ogg', 'image', 'font', 'ai', 'text', 'other'];
export const activeFilters = new Set(FILTER_CATEGORIES);

// Subtypes that belong to a filter category other than their own name
const SUBTYPE_CATEGORY = { gltf: 'glb' };

// Filter category an asset falls under: its subtype or type when a filter exists for it,
// otherwise 'other' (so accepted types with no button of their own - .obj, .stl, .flac,
// .m4a, .pdf, ... - still show while "Other" is on).
export function getFilterCategory(item) {
  if (FILTER_CATEGORIES.includes(item.subtype)) return item.subtype;
  if (SUBTYPE_CATEGORY[item.subtype]) return SUBTYPE_CATEGORY[item.subtype];
  if (FILTER_CATEGORIES.includes(item.type)) return item.type;
  return 'other';
}

// Make activeFilters accessible globally for UI components
window.activeFilters = activeFilters;
