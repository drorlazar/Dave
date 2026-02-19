// ui.js
import { renderPage, sortFiles, modelFiles, filteredModelFiles, updateFilteredModelFiles, showFullscreen } from './asset_loading.js';
import { currentFullscreenViewer } from './asset_loading.js';
import { debounce, throttle, throttleRAF } from '../utils/debounce.js';
import { activeFilters } from '../shared/filters.js';
import { showDAV9000Terminal, destroyDAV9000Terminal, isDAV9000Active, markHadFiles, scheduleTakeover, cancelTakeover, hasTerminalBeenShown } from './dav9000_terminal.js';


// Private state
let _currentPage = 0;
let _itemsPerPage = 20;
let _loadSubfolders = true;
let _subfolderDepth = 'all';
let _currentSort = { field: 'name', direction: 'asc' };
let _selectedFiles = new Set();
let _searchTerm = '';

// Cloud URL detection helper
function _isCloudUrl(text) {
  if (!text || text.length < 10) return false;
  return !!(
    text.match(/console\.aws\.amazon\.com\/s3/i) ||
    text.match(/^s3:\/\//i) ||
    text.match(/\.s3[.-].*\.amazonaws\.com/i) ||
    text.match(/drive\.google\.com/i)
  );
}

function clearSearch(searchInput) {
  searchInput.value = '';
  _searchTerm = '';
  setCurrentPage(0);
  updateFilteredModelFiles();
  renderPage(getCurrentPage());
  document.dispatchEvent(new CustomEvent('dave:search', { detail: { term: '' } }));
}

// Function to close all dropdowns
function closeAllDropdowns() {
  document.querySelectorAll('.dropdown').forEach(dropdown => {
    dropdown.classList.remove('active');
  });
}

// Track whether UI initialization has completed to prevent duplicate listener attachments
let uiInitialized = false;

// Initialize UI elements and return a promise
export function initializeUI() {
  console.log(`INIT DIAGNOSTICS: initializeUI called, uiInitialized=${uiInitialized}`);

  // Return the existing elements if we've already initialized
  if (uiInitialized && window.uiElements) {
    console.log('INIT DIAGNOSTICS: UI already initialized, returning existing elements');
    return Promise.resolve(window.uiElements);
  }

  return new Promise((resolve) => {
    if (document.readyState === 'loading') {
      console.log('INIT DIAGNOSTICS: Document still loading, adding DOMContentLoaded listener');
      document.addEventListener('DOMContentLoaded', initializeElements);
    } else {
      console.log('INIT DIAGNOSTICS: Document already loaded, initializing elements now');
      initializeElements();
    }

function initializeElements() {
      try {
        // Guard against multiple initializations
        if (uiInitialized) {
          console.log('INIT DIAGNOSTICS: Elements already initialized (double call), returning existing elements');
          resolve(window.uiElements);
          return;
        }

        console.log('INIT DIAGNOSTICS: Starting UI element initialization');

      // IMPORTANT: We no longer use cached references for critical UI elements that could cause
      // cross-button issues. All UI functions should use direct document.getElementById() instead.
      // This global cache is maintained for backward compatibility with other parts of the code.

      // Get all UI elements
      const darkModeRow = document.getElementById("darkModeRow");
      const subfolderToggle = document.getElementById("subfolderToggle");
      const prevPageBtn = document.getElementById("prevPage");
      const nextPageBtn = document.getElementById("nextPage");
      const sizeSlider = document.getElementById("sizeSlider");
      const sizeValue = document.getElementById("sizeValue");
      const pageInfo = document.getElementById("pageInfo");
      const fullscreenOverlay = document.getElementById('fullscreenOverlay');
      const returnButton = document.getElementById('returnButton');
      const fullscreenVideo = document.getElementById('fullscreenVideo');
      const fullscreenViewer = document.getElementById('fullscreenViewer');
      const selectionDropdown = document.getElementById('selectionDropdown');
      const itemsPerPageBtn = document.getElementById('itemsPerPageBtn');
      const sortBtn = document.getElementById('sortBtn');
      const searchInput = document.getElementById('searchInput');
      const searchClear = document.querySelector('.search-clear');

      // Store UI elements globally
      window.uiElements = {
        darkModeRow,
        subfolderToggle,
        prevPageBtn,
        nextPageBtn,
        sizeSlider,
        sizeValue,
        pageInfo,
        fullscreenOverlay,
        returnButton,
        fullscreenVideo,
        fullscreenViewer,
        selectionDropdown,
        itemsPerPageBtn,
        sortBtn,
        searchInput,
        searchClear
      };

      // Log all element IDs for debugging to verify correct elements are being found
      console.log('INIT DIAGNOSTICS: Element IDs found:');
      for (const [key, element] of Object.entries(window.uiElements)) {
        if (element) {
          console.log(`INIT DIAGNOSTICS: ${key} -> ${element.id || 'No ID'} (type: ${element.tagName})`);
        }
      }

      // Extra verification for our key buttons
      console.log('DIRECT LOOKUP TEST:');
      console.log(`itemsPerPageBtn directly from DOM: ${document.getElementById('itemsPerPageBtn')?.id || 'Not Found'}`);

      // Initialize event listeners
      if (searchInput) {
        const debouncedSearch = debounce((value) => {
          // Dave command system: "dave <command>" — suppress normal search for dave prefix
          const trimmed = value.trim().toLowerCase();
          if (trimmed === 'dave let me in') {
            searchInput.value = '';
            _searchTerm = '';
            document.dispatchEvent(new CustomEvent('dave:debugPanel'));
            return;
          }
          // If user is typing a dave command, don't search files — the dropdown handles it
          if (trimmed === 'dave' || (trimmed.startsWith('dave ') && trimmed !== 'dave let me in')) {
            return;
          }
          // Check if the value is a cloud storage URL
          if (window.handleCloudUrl && _isCloudUrl(value.trim())) {
            window.handleCloudUrl(value.trim());
            searchInput.value = '';
            _searchTerm = '';
            return;
          }
          _searchTerm = value.toLowerCase();
          setCurrentPage(0);
          updateFilteredModelFiles();
          renderPage(getCurrentPage());
          document.dispatchEvent(new CustomEvent('dave:search', { detail: { term: value } }));
        }, 300);

        searchInput.addEventListener('input', (e) => {
          debouncedSearch(e.target.value);
        });

        // Enter key: dispatch typed dave command (dropdown stays open for browsing)
        searchInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            const val = searchInput.value.trim().toLowerCase();
            if (val.startsWith('dave ') && val !== 'dave let me in') {
              const cmd = val.slice(5).trim();
              if (cmd) {
                e.preventDefault();
                // Don't clear input — dropdown stays open for further commands
                document.dispatchEvent(new CustomEvent('dave:command', { detail: { command: cmd } }));
                return;
              }
            }
          }
        });

        // Also handle paste events for instant cloud URL detection
        searchInput.addEventListener('paste', (e) => {
          setTimeout(() => {
            const val = searchInput.value.trim();
            if (window.handleCloudUrl && _isCloudUrl(val)) {
              window.handleCloudUrl(val);
              searchInput.value = '';
              _searchTerm = '';
            }
          }, 50);
        });
      }

      if (searchClear) {
        searchClear.addEventListener('click', () => clearSearch(searchInput));
      }

      if (sizeSlider && sizeValue) {
        document.documentElement.style.setProperty('--tile-size', `${sizeSlider.value}px`);
        sizeValue.textContent = `${sizeSlider.value}px`;
      }

      if (sortBtn) {
        setCurrentSort(_currentSort);
      }

      // Initialize subfolder toggle with default state
      setLoadSubfolders(_loadSubfolders, _subfolderDepth);

      // Initialize dark mode toggle (in settings dropdown)
      if (darkModeRow) {
        const indicator = document.getElementById('darkModeIndicator');
        const updateTheme = (isDark) => {
          if (isDark) {
            document.documentElement.classList.add('dark-mode');
            document.body.classList.add('dark-mode');
          } else {
            document.documentElement.classList.remove('dark-mode');
            document.body.classList.remove('dark-mode');
          }
          localStorage.setItem('theme', isDark ? 'dark' : 'light');
          // Clear custom theme so CSS custom property defaults take over
          localStorage.removeItem('dave_theme');
          localStorage.removeItem('dave_theme_css');
          const root = document.documentElement;
          root.style.removeProperty('--theme-bg');
          root.style.removeProperty('--theme-surface');
          root.style.removeProperty('--theme-text');
          root.style.removeProperty('--theme-border');
          root.style.removeProperty('--theme-accent');
          if (indicator) {
            indicator.textContent = isDark ? 'ON' : 'OFF';
            indicator.classList.toggle('off', !isDark);
          }
        };

        // Set initial indicator state
        const initialDark = document.body.classList.contains('dark-mode');
        if (indicator) {
          indicator.textContent = initialDark ? 'ON' : 'OFF';
          indicator.classList.toggle('off', !initialDark);
        }

        // Add click handler
        darkModeRow.addEventListener('click', (e) => {
          e.stopPropagation();
          const isDarkMode = document.body.classList.contains('dark-mode');
          updateTheme(!isDarkMode);
          document.dispatchEvent(new CustomEvent('dave:themeChange', { detail: { theme: isDarkMode ? 'light' : 'dark' } }));
        });
      }

      if (sizeSlider && sizeValue) {
        // Track the last size update for better performance
        let lastSize = sizeSlider.value;
        let lastRenderTime = 0;
        let rafPending = false;
        let currentSize = lastSize;
        let isSliderActive = false;

        // Initial size setup
        document.documentElement.style.setProperty('--tile-size', `${lastSize}px`);
        sizeValue.textContent = `${lastSize}px`;

        // For smoother updating during fast slider movement
        const updateSize = (timestamp) => {
          // Limit updates to once per ~16ms (roughly 60fps) for optimal performance
          if (timestamp - lastRenderTime > 16 || timestamp === 0) {
            // Update the CSS variable (causes layout recalculation)
            document.documentElement.style.setProperty('--tile-size', `${currentSize}px`);
            lastRenderTime = timestamp;
            lastSize = currentSize;
          }

          rafPending = false;

          // If size has changed again while we were rendering, schedule another update
          if (lastSize !== currentSize) {
            scheduleUpdate();
          }
        };

        const scheduleUpdate = () => {
          if (!rafPending) {
            rafPending = true;
            requestAnimationFrame(updateSize);
          }
        };

        // Mark slider as active when interaction begins
        sizeSlider.addEventListener("mousedown", () => {
          document.body.classList.add('tile-slider-active');
          isSliderActive = true;
        });

        // Mark slider as inactive when interaction ends
        document.addEventListener("mouseup", () => {
          if (isSliderActive) {
            document.body.classList.remove('tile-slider-active');
            isSliderActive = false;
          }
        });

        // For touch devices
        sizeSlider.addEventListener("touchstart", () => {
          document.body.classList.add('tile-slider-active');
          isSliderActive = true;
        });

        document.addEventListener("touchend", () => {
          if (isSliderActive) {
            document.body.classList.remove('tile-slider-active');
            isSliderActive = false;
          }
        });

        // Handle continuous slider movements with better throttling
        sizeSlider.addEventListener("input", (e) => {
          // Mark as active on first input (backup in case mousedown/touchstart missed)
          if (!isSliderActive) {
            document.body.classList.add('tile-slider-active');
            isSliderActive = true;
          }

          // Update display immediately - this is just text and doesn't cause reflow
          currentSize = e.target.value;
          sizeValue.textContent = `${currentSize}px`;

          // Schedule the update to happen optimally with browser rendering
          scheduleUpdate();
        });
      }

      // Dropdown button handlers
      document.querySelectorAll('.dropdown-btn:not(#sortBtn)').forEach(button => {
        button.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
        });
      });

      document.querySelectorAll('.dropdown').forEach(dropdown => {
        let closeTimeout;

        dropdown.addEventListener('mouseenter', () => {
          if (closeTimeout) {
            clearTimeout(closeTimeout);
          }
          closeAllDropdowns();
          dropdown.classList.add('active');
        });

        dropdown.addEventListener('mouseleave', () => {
          closeTimeout = setTimeout(() => {
            dropdown.classList.remove('active');
          }, 150);
        });
      });

      document.querySelectorAll('.dropdown-content').forEach(content => {
        content.addEventListener('mouseenter', () => {
          const dropdown = content.closest('.dropdown');
          if (dropdown) {
            dropdown.classList.add('active');
          }
        });
      });

      document.querySelectorAll('.subfolder-option').forEach(option => {
        option.addEventListener('click', (event) => {
          event.stopPropagation();
          const depth = option.dataset.depth;
          setLoadSubfolders(depth !== 'off', depth);
          closeAllDropdowns();
          renderPage(getCurrentPage());
        });
      });

      document.querySelectorAll('.items-option').forEach(option => {
        option.addEventListener('click', (event) => {
          event.stopPropagation();
          const value = parseInt(option.dataset.value);
          setItemsPerPage(value);
          setCurrentPage(0);
          closeAllDropdowns();
          renderPage(getCurrentPage());
        });
      });

      document.querySelectorAll('.sort-option').forEach(option => {
        option.addEventListener('click', (event) => {
          event.stopPropagation();
          const field = option.dataset.value;
          setCurrentSort({ field, direction: _currentSort.direction });
          sortFiles();
          closeAllDropdowns();
        });
      });

      // Initialize sort button state and handlers
      if (sortBtn) {
        // Set initial sort state
        setCurrentSort(_currentSort);

        // Handle sort direction toggle
        sortBtn.addEventListener('click', handleSortButtonClick);

        // Handle dropdown toggle
        const sortBtnDropdownIcon = sortBtn.querySelector('.fa-chevron-down');
        if (sortBtnDropdownIcon) {
          sortBtnDropdownIcon.addEventListener('click', handleSortDropdownToggle);
        }
      }

      document.querySelectorAll('.selection-option').forEach(option => {
        option.addEventListener('click', () => {
          const action = option.dataset.action;
          if (action === 'download') {
            downloadSelected(modelFiles);
          } else if (action === 'save') {
            saveSelection(modelFiles);
          } else if (action === 'clear') {
            clearSelection();
          } else if (action === 'selectAll') {
            selectAllFiles();
          }
          closeAllDropdowns();
        });
      });

      if (returnButton && fullscreenOverlay) {
        returnButton.addEventListener('click', () => {
          exitFullscreen(currentFullscreenViewer);
        });

        // Global keyboard shortcuts
        document.addEventListener('keydown', function(event) {
          // Grid view shortcuts
          const isFullscreen = window.getComputedStyle(fullscreenOverlay).display === 'flex';
          if (!isFullscreen) {
            if (event.ctrlKey && event.key === 'f') {
              event.preventDefault();
              searchInput.focus();
            } else if (event.key === 'PageUp') {
              event.preventDefault();
              if (!prevPageBtn.disabled) {
                setCurrentPage(getCurrentPage() - 1);
                renderPage(getCurrentPage());
              }
            } else if (event.key === 'PageDown') {
              event.preventDefault();
              if (!nextPageBtn.disabled) {
                setCurrentPage(getCurrentPage() + 1);
                renderPage(getCurrentPage());
              }
            } else if (event.key === 'ArrowLeft') {
              if (!prevPageBtn.disabled) {
                setCurrentPage(getCurrentPage() - 1);
                renderPage(getCurrentPage());
              }
            } else if (event.key === 'ArrowRight') {
              if (!nextPageBtn.disabled) {
                setCurrentPage(getCurrentPage() + 1);
                renderPage(getCurrentPage());
              }
            }
          }
          // Fullscreen view shortcuts
          else if (isFullscreen) {
            // 3D Inspector shortcuts
            if (currentFullscreenViewer?.inspector) {
              const inspector = currentFullscreenViewer.inspector;
              const key = event.key.toLowerCase();
              if (event.key === 'Escape') {
                if (inspector.handleEscape()) return; // panel consumed Escape
                exitFullscreen(currentFullscreenViewer);
                return;
              } else if (key === 'w') { inspector.toggleWireframe(); return; }
              else if (key === 'g') { inspector.toggleGrid(); return; }
              else if (key === 'i') { inspector.togglePanel(); return; }
              else if (key === 'r') { inspector.toggleAutoRotate(); return; }
              else if (key === 'c') { inspector.resetCamera(); return; }
              else if (key === 'n') { inspector.toggleNormals(); return; }
              else if (key === 'b') { inspector.toggleBounds(); return; }
              else if (key === 's') { inspector.toggleSkeleton(); return; }
              else if (key === 'p') { inspector.screenshot(); return; }
              else if (event.key === ' ') {
                event.preventDefault();
                inspector.togglePlayback();
                return;
              }
            }

            if (event.key === 'Escape') {
              exitFullscreen(currentFullscreenViewer);
            } else if (event.key === 'ArrowLeft') {
              navigateFullscreen('prev');
            } else if (event.key === 'ArrowRight') {
              navigateFullscreen('next');
            } else if (event.key === ' ' && currentFullscreenViewer?.type === 'video') {
              event.preventDefault();
              if (fullscreenVideo.paused) {
                fullscreenVideo.play();
              } else {
                fullscreenVideo.pause();
              }
            }
          }
        });

        fullscreenOverlay.addEventListener('click', function(event) {
          if (event.target === fullscreenOverlay) {
            exitFullscreen(currentFullscreenViewer);
          }
        });

        // Fullscreen navigation areas
        const prevNav = document.getElementById('prevNav');
        const nextNav = document.getElementById('nextNav');

        if (prevNav) {
          prevNav.addEventListener('click', () => navigateFullscreen('prev'));
        }

        if (nextNav) {
          nextNav.addEventListener('click', () => navigateFullscreen('next'));
        }
      }


      // Mark initialization as complete
      console.log('INIT DIAGNOSTICS: UI initialization complete, setting uiInitialized=true');
      uiInitialized = true;
      resolve(window.uiElements);

      } catch (error) {
        console.error('INIT ERROR: Failed to initialize UI:', error);
        console.error('Stack trace:', error.stack);
        // Try to provide a user-friendly error
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:red;color:white;padding:20px;border-radius:5px;z-index:9999';
        errorDiv.textContent = `UI initialization failed: ${error.message}`;
        document.body.appendChild(errorDiv);

        // Still resolve but with partial elements
        resolve(window.uiElements || {});
      }
    }
  });
}

// Export function to get UI elements
export function getUIElements() {
  return window.uiElements || {};
}


// Function to check if a file matches the search criteria
export const fileMatchesSearch = (file) => {
  if (!_searchTerm) return true;

  const searchTerms = _searchTerm.split(' ').filter(term => term.length > 0);
  if (searchTerms.length === 0) return true;

  const searchableContent = [
    file.name.toLowerCase(),
    file.type.toLowerCase(),
    file.fullPath?.toLowerCase() || ''
  ].join(' ');

  return searchTerms.every(term => searchableContent.includes(term));
};

// Getters
export const getCurrentPage = () => _currentPage;
export const getItemsPerPage = () => _itemsPerPage;
export const getLoadSubfolders = () => _loadSubfolders;
export const getSubfolderDepth = () => _subfolderDepth;
export const getCurrentSort = () => ({ ..._currentSort });
export const getSelectedFiles = () => new Set(_selectedFiles);
export const getSearchTerm = () => _searchTerm;

// Setters
export const setCurrentPage = (page) => {
  _currentPage = page;
  return _currentPage;
};

function updateItemsDropdownState(items) {
  const itemsDropdown = document.getElementById('itemsDropdown');
  if (!itemsDropdown) return;

  itemsDropdown.querySelectorAll('.items-option').forEach(option => {
    const checkmark = option.querySelector('.items-check');
    if (checkmark) {
      const isActive = parseInt(option.dataset.value) === items;
      checkmark.style.visibility = isActive ? 'visible' : 'hidden';
    }
  });
}

export const setItemsPerPage = (items) => {
  // Using direct DOM lookup instead of cached reference to avoid targeting the wrong button
  const itemsPerPageBtn = document.getElementById('itemsPerPageBtn');
  _itemsPerPage = items;

  // Only proceed if we found the button
  if (itemsPerPageBtn) {
    // Clear existing content
    while (itemsPerPageBtn.firstChild) {
      itemsPerPageBtn.removeChild(itemsPerPageBtn.firstChild);
    }

    // Add text node
    itemsPerPageBtn.appendChild(document.createTextNode(`${items} Items `));

    // Add icon
    const icon = document.createElement('i');
    icon.className = 'fa fa-chevron-down';
    itemsPerPageBtn.appendChild(icon);
  }

  // Update only items dropdown state
  updateItemsDropdownState(items);

  return _itemsPerPage;
};

function updateSubfoldersDropdownState(depth) {
  const subfolderDropdown = document.getElementById('subfolderDropdown');
  if (!subfolderDropdown) return;

  subfolderDropdown.querySelectorAll('.subfolder-option').forEach(option => {
    const checkmark = option.querySelector('.subfolder-check');
    if (checkmark) {
      const isActive = option.dataset.depth === depth;
      checkmark.style.visibility = isActive ? 'visible' : 'hidden';
    }
  });
}

export const setLoadSubfolders = (value, depth = 'off') => {
  // Using direct DOM lookup instead of cached reference for consistency with setItemsPerPage fix
  const subfolderToggle = document.getElementById('subfolderToggle');
  _loadSubfolders = value;
  _subfolderDepth = depth;

  // Only proceed if we found the button
  if (subfolderToggle) {
    // Clear existing content
    while (subfolderToggle.firstChild) {
      subfolderToggle.removeChild(subfolderToggle.firstChild);
    }

    // Add sitemap icon
    const sitemapIcon = document.createElement('i');
    sitemapIcon.className = `fa fa-sitemap${depth === 'off' ? '' : ' active'}`;
    subfolderToggle.appendChild(sitemapIcon);

    // Add text span
    const textSpan = document.createElement('span');
    textSpan.textContent = depth === 'off' ? '' : (depth === 'all' ? 'All' : depth);
    subfolderToggle.appendChild(textSpan);

    // Add chevron icon
    const chevronIcon = document.createElement('i');
    chevronIcon.className = 'fa fa-chevron-down';
    subfolderToggle.appendChild(chevronIcon);
  }

  // Update only subfolders dropdown state
  updateSubfoldersDropdownState(depth);

  return _loadSubfolders;
};

function updateSortDropdownState(field) {
  const sortDropdown = document.getElementById('sortDropdown');
  if (!sortDropdown) return;

  // Update sort options
  sortDropdown.querySelectorAll('.sort-option').forEach(option => {
    const checkmark = option.querySelector('.fa-check');
    if (checkmark) {
      const isActive = option.dataset.value === field;
      checkmark.style.visibility = isActive ? 'visible' : 'hidden';
    }
  });
}

export const setCurrentSort = (sort) => {
  // Using direct DOM lookup instead of cached reference for consistency
  const sortBtn = document.getElementById('sortBtn');
  _currentSort = { ...sort };

  // Update sort button text and icon
  if (sortBtn) {
    // Clear existing content
    while (sortBtn.firstChild) {
      sortBtn.removeChild(sortBtn.firstChild);
    }

    // Add text showing field and direction
    const directionIcon = document.createElement('i');
    directionIcon.className = _currentSort.direction === 'asc' ? 'fa fa-sort-down' : 'fa fa-sort-up';
    sortBtn.appendChild(directionIcon);

    // Add text showing field with capitalized first letter
    const capitalizedField = _currentSort.field.charAt(0).toUpperCase() + _currentSort.field.slice(1);
    sortBtn.appendChild(document.createTextNode(` ${capitalizedField} `));

    // Add dropdown icon
    const dropdownIcon = document.createElement('i');
    dropdownIcon.className = 'fa fa-chevron-down';
    sortBtn.appendChild(dropdownIcon);

    // Update button title
    sortBtn.title = `Sort by ${_currentSort.field} (${_currentSort.direction === 'asc' ? 'ascending' : 'descending'})`;
  }

  // Update dropdown state
  updateSortDropdownState(_currentSort.field);

  return _currentSort;
};

// Function to update pagination display
export function updatePagination(totalPages) {
  // Using direct DOM lookups instead of cached references for consistency
  const pageInfo = document.getElementById('pageInfo');
  const prevPageBtn = document.getElementById('prevPage');
  const nextPageBtn = document.getElementById('nextPage');

  totalPages = Math.max(1, totalPages || 1);

  if (pageInfo) {
    pageInfo.textContent = `Page ${_currentPage + 1} of ${totalPages}`;
  }

  if (prevPageBtn) {
    prevPageBtn.disabled = _currentPage === 0;
  }

  if (nextPageBtn) {
    nextPageBtn.disabled = _currentPage >= totalPages - 1;
  }
}

// Function to exit fullscreen
export function exitFullscreen(currentFullscreenViewer) {
  // Using direct DOM lookups instead of cached references for consistency
  const fullscreenOverlay = document.getElementById('fullscreenOverlay');
  const fullscreenVideo = document.getElementById('fullscreenVideo');
  // const fullscreenInfo = document.getElementById('fullscreenInfo'); // This was not used, so commented out

  // Hide the fullscreen overlay and info panel
  fullscreenOverlay.style.display = 'none';
  fullscreenOverlay.style.opacity = '0';
  document.body.style.overflow = '';

  // Hide 3D inspector toolbar and panel (safety net)
  const toolbar3d = document.getElementById('model3dToolbar');
  const inspectorPanel = document.getElementById('modelInspectorPanel');
  if (toolbar3d) toolbar3d.style.display = 'none';
  if (inspectorPanel) inspectorPanel.classList.remove('open');

  // Remove edit button
  const editBtn = document.getElementById('fullscreenEditBtn');
  if (editBtn) editBtn.remove();

  // Clear file information
  const fullscreenFilename = document.querySelector('.fullscreen-filename');
  const fullscreenDetails = document.querySelector('.fullscreen-details');
  const fullscreenPath = document.querySelector('.fullscreen-path');

  if (fullscreenFilename) fullscreenFilename.textContent = '';
  if (fullscreenDetails) fullscreenDetails.textContent = '';
  if (fullscreenPath) fullscreenPath.textContent = '';

  if (currentFullscreenViewer) {
    if (currentFullscreenViewer.type === 'video' && fullscreenVideo) {
      // Stop both fullscreen video and any preview video
      fullscreenVideo.pause();
      fullscreenVideo.currentTime = 0;
      fullscreenVideo.src = ''; // Clear src to stop loading
      if (currentFullscreenViewer.previewVideo) {
        currentFullscreenViewer.previewVideo.pause();
        currentFullscreenViewer.previewVideo.currentTime = 0;
      }
    } else if (currentFullscreenViewer.type === 'font' && currentFullscreenViewer.cleanup) {
        currentFullscreenViewer.cleanup(); // Call cleanup for font if defined
    } else if (currentFullscreenViewer.cleanup) {
      currentFullscreenViewer.cleanup();
    }
    // currentFullscreenViewer = null; // Explicitly set to null after cleanup
    document.dispatchEvent(new CustomEvent('dave:fullscreenExit'));
    return null; // Return null as per original logic
  }
  document.dispatchEvent(new CustomEvent('dave:fullscreenExit'));
  return null; // Return null if no viewer was active
}

// Function to update selection count in UI
export function updateSelectionCount() {
  // Using direct DOM lookup instead of cached reference for consistency
  const selectionDropdown = document.getElementById('selectionDropdown');
  const count = _selectedFiles.size;

  if (selectionDropdown) {
    selectionDropdown.innerHTML = `${count} Selected <i class="fa fa-chevron-down"></i>`;
  }
}

export function clearSelection() {
  _selectedFiles.clear();
  updateSelectionCount();
  document.dispatchEvent(new CustomEvent('dave:selection', { detail: { count: 0 } }));
  // Update selection state without full re-render
  document.querySelectorAll('.model-tile').forEach(tile => {
    tile.classList.remove('selected');
  });
}

export function saveSelection(modelFiles) {
  if (_selectedFiles.size === 0) return;

  const content = Array.from(_selectedFiles)
    .map(fileName => {
      const model = modelFiles.find(m => m.name === fileName);
      return model ? model.fullPath : fileName;
    })
    .join('\n');

  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'selected_files.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function downloadSelected(modelFiles) {
  if (_selectedFiles.size === 0) return;

  console.log(`DOWNLOAD DIAGNOSTICS: Starting download for ${_selectedFiles.size} selected files`);

  for (const fileName of _selectedFiles) {
    const model = modelFiles.find(m => m.name === fileName);
    if (model) {
      console.log(`DOWNLOAD DIAGNOSTICS: Processing ${fileName}, type=${model.type}`);

      try {
        let blob;

        if (model.file) {
          // Local file
          console.log(`DOWNLOAD DIAGNOSTICS: Creating blob from local file ${fileName}`);
          blob = new Blob([await model.file.arrayBuffer()]);
        } else if (model.source === 's3' || model.source === 'gdrive') {
          // Cloud file - fetch via URL
          console.log(`DOWNLOAD DIAGNOSTICS: Fetching cloud file ${fileName}`);
          const { getFileUrl } = await import('../cloud/CloudStorageProvider.js');
          const url = await getFileUrl(model);
          const response = await fetch(url);
          blob = await response.blob();
        }

        // Create download link and trigger download
        console.log(`DOWNLOAD DIAGNOSTICS: Creating object URL for ${fileName}`);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = model.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log(`DOWNLOAD DIAGNOSTICS: Download triggered for ${model.name}`);
      } catch (error) {
        console.error(`Error downloading ${model.name}:`, error);
        alert(`Failed to download ${model.name}: ${error.message}`);
      }
    }
  }
}

// Selection management function for UI interaction
export function toggleSelectionUI(fileName) {
  const isSelected = _selectedFiles.has(fileName);
  const tile = document.querySelector(`.model-tile[data-model-name="${fileName}"]`);

  if (isSelected) {
    _selectedFiles.delete(fileName);
    tile?.classList.remove('selected');
  } else {
    _selectedFiles.add(fileName);
    tile?.classList.add('selected');
  }
  updateSelectionCount();
  document.dispatchEvent(new CustomEvent('dave:selection', { detail: { count: _selectedFiles.size } }));
}

// Sort button click handler
function handleSortButtonClick(event) {
  if (!event.target.classList.contains('fa-chevron-down')) {
    event.preventDefault();
    event.stopPropagation();
    const newDirection = _currentSort.direction === 'asc' ? 'desc' : 'asc';
    setCurrentSort({ ..._currentSort, direction: newDirection });
    sortFiles();
    closeAllDropdowns();
  }
}

// Sort dropdown toggle handler
function handleSortDropdownToggle(event) {
  event.preventDefault();
  event.stopPropagation();
  const dropdown = event.target.closest('.dropdown');
  if (dropdown) {
    if (dropdown.classList.contains('active')) {
      dropdown.classList.remove('active');
    } else {
      closeAllDropdowns();
      dropdown.classList.add('active');
    }
  }
}

// Function to navigate in fullscreen mode
function navigateFullscreen(direction) {
  const currentIndex = filteredModelFiles.findIndex(file => file.name === currentFullscreenViewer?.fileName);
  if (currentIndex === -1) return;

  // Simply move to the next/previous item in the filtered files array
  // This respects the current sort order shown in the grid
  const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;

  if (newIndex >= 0 && newIndex < filteredModelFiles.length) {
    const nextFile = filteredModelFiles[newIndex];
    // const currentViewer = currentFullscreenViewer; // Not used
    exitFullscreen(currentFullscreenViewer); // currentFullscreenViewer is modified by exitFullscreen
    showFullscreen(nextFile);
  }
}

// --- Font Custom Text Modal Logic ---
let currentFontTileModel = null;
let currentFontTileFontId = null;

export function openCustomTextModal(model, fontId) {
  console.log('openCustomTextModal called with:', model, fontId);

  const modal = document.getElementById('customTextModal');
  const customTextInput = document.getElementById('customTextInput');
  const saveAsDefaultTextCheckbox = document.getElementById('saveAsDefaultFontText');
  const fontSizeSlider = document.getElementById('fontSizeSlider');
  const fontSizeValue = document.getElementById('fontSizeValue');
  const saveAsDefaultSizeCheckbox = document.getElementById('saveAsDefaultFontSize');

  if (!modal || !customTextInput || !saveAsDefaultTextCheckbox) {
    console.error("Custom text modal elements not found!");
    console.error("modal:", modal);
    console.error("customTextInput:", customTextInput);
    console.error("saveAsDefaultTextCheckbox:", saveAsDefaultTextCheckbox);
    return;
  }

  currentFontTileModel = model;
  currentFontTileFontId = fontId;

  // Load current custom text or default
  customTextInput.value = localStorage.getItem(`fontPreviewText_${model.name}`) || localStorage.getItem('fontPreviewText') || '';
  saveAsDefaultTextCheckbox.checked = !!localStorage.getItem('fontPreviewText'); // Check if a global default is set

  // Load current font size or default
  const savedFontSize = localStorage.getItem(`fontSize_${model.name}`) || localStorage.getItem('defaultFontSize') || '16';
  if (fontSizeSlider && fontSizeValue) {
    fontSizeSlider.value = savedFontSize;
    fontSizeValue.textContent = savedFontSize;
  }
  if (saveAsDefaultSizeCheckbox) {
    saveAsDefaultSizeCheckbox.checked = !!localStorage.getItem('defaultFontSize');
  }

  console.log('Before setting display - modal display:', modal.style.display);
  modal.style.display = 'flex';
  console.log('After setting display - modal display:', modal.style.display);
  console.log('Modal computed style:', window.getComputedStyle(modal).display);
  console.log('Modal offsetHeight:', modal.offsetHeight);
}

function closeCustomTextModal() {
  const modal = document.getElementById('customTextModal');
  if (modal) {
    modal.style.display = 'none';
  }
  currentFontTileModel = null;
  currentFontTileFontId = null;
}

function applyCustomFontText() {
  const customTextInput = document.getElementById('customTextInput');
  const saveAsDefaultTextCheckbox = document.getElementById('saveAsDefaultFontText');
  const fontSizeSlider = document.getElementById('fontSizeSlider');
  const saveAsDefaultSizeCheckbox = document.getElementById('saveAsDefaultFontSize');

  if (!customTextInput || !saveAsDefaultTextCheckbox || !currentFontTileModel) {
    console.error("Cannot apply custom text, elements or model missing.");
    return;
  }

  // Process text changes
  const newText = customTextInput.value;
  if (saveAsDefaultTextCheckbox.checked) {
    localStorage.setItem('fontPreviewText', newText);
    // Remove individual setting if setting as global default
    localStorage.removeItem(`fontPreviewText_${currentFontTileModel.name}`);
  } else {
    // Set individual text preference
    localStorage.setItem(`fontPreviewText_${currentFontTileModel.name}`, newText);
  }

  // Process font size changes
  const newFontSize = fontSizeSlider ? fontSizeSlider.value : '16';
  if (saveAsDefaultSizeCheckbox && saveAsDefaultSizeCheckbox.checked) {
    localStorage.setItem('defaultFontSize', newFontSize);
    // Remove individual size setting if using global default
    localStorage.removeItem(`fontSize_${currentFontTileModel.name}`);
  } else if (fontSizeSlider) {
    // Set individual font size preference
    localStorage.setItem(`fontSize_${currentFontTileModel.name}`, newFontSize);
  }

  // Update the specific tile's preview
  const currentTileTextContainer = document.querySelector(`.model-tile[data-model-name="${currentFontTileModel.name}"] .font-preview div`);
  if (currentTileTextContainer) {
    currentTileTextContainer.textContent = newText || "The quick brown fox jumps over the lazy dog"; // Fallback if empty
    if (currentFontTileFontId) {
        currentTileTextContainer.style.fontFamily = currentFontTileFontId;
    }
    currentTileTextContainer.style.fontSize = `${newFontSize}px`;
  }

  // If "Use text for all font previews" is checked, update all other visible font tiles
  if (saveAsDefaultTextCheckbox.checked) {
    document.querySelectorAll('.model-tile[data-model-type="font"]').forEach(fontTile => {
      const textContainer = fontTile.querySelector('.font-preview div');
      const modelName = fontTile.dataset.modelName;
      if (textContainer && modelName !== currentFontTileModel.name) { // Don't re-update the current tile
        textContainer.textContent = newText || "The quick brown fox jumps over the lazy dog";
      }
    });
  }

  // If "Use size for all font previews" is checked, update all other visible font tiles
  if (saveAsDefaultSizeCheckbox && saveAsDefaultSizeCheckbox.checked) {
    document.querySelectorAll('.model-tile[data-model-type="font"]').forEach(fontTile => {
      const textContainer = fontTile.querySelector('.font-preview div');
      const modelName = fontTile.dataset.modelName;
      if (textContainer && modelName !== currentFontTileModel.name) { // Don't re-update the current tile
        textContainer.style.fontSize = `${newFontSize}px`;
      }
    });
  }

  // Update fullscreen preview if it's showing this font (or applying to all)
  if (currentFullscreenViewer && currentFullscreenViewer.type === 'font') {
    const fullscreenTextElement = document.querySelector('#fullscreenViewer .fullscreen-font-display p');
    if (fullscreenTextElement) {
      // Apply text changes
      if (saveAsDefaultTextCheckbox.checked || currentFullscreenViewer.fileName === currentFontTileModel.name) {
        fullscreenTextElement.textContent = newText || "The quick brown fox jumps over the lazy dog. 0123456789";
        // Re-apply font family in case it's needed, though it should persist
        if (currentFullscreenViewer.fontId) {
          fullscreenTextElement.style.fontFamily = currentFullscreenViewer.fontId;
        }
      }

      // Apply font size changes
      if ((saveAsDefaultSizeCheckbox && saveAsDefaultSizeCheckbox.checked) ||
          currentFullscreenViewer.fileName === currentFontTileModel.name) {
        fullscreenTextElement.style.fontSize = `${newFontSize}px`;
        // Update the fullscreen slider if visible
        const fullscreenSizeSlider = document.getElementById('fullscreenFontSizeSlider');
        const fullscreenSizeValue = document.getElementById('fullscreenFontSizeValue');
        if (fullscreenSizeSlider && fullscreenSizeValue) {
          fullscreenSizeSlider.value = newFontSize;
          fullscreenSizeValue.textContent = newFontSize;
        }
      }
    }
  }

  closeCustomTextModal();
}

// Event listeners for the custom text modal and fullscreen font size control
// Function to get the current state of asset type filter options
function getAssetTypesFilterState(filterOptions) {
  let numChecked = 0;
  let numTotal = filterOptions.length;

  // Count how many filter options are active (have 'active' class)
  filterOptions.forEach(option => {
    if (option.classList.contains('active')) {
      numChecked++;
    }
  });

  return {
    numChecked,
    numTotal,
    allOn: (numChecked === numTotal && numTotal > 0),
    allOff: (numChecked === 0),
    someOn: (numChecked > 0 && numChecked < numTotal)
  };
}

// Function to update the eye icon button tooltip based on the current state
function updateAssetTypeFilterBtnTooltip(assetTypeFilterBtn, filterOptions) {
  if (!assetTypeFilterBtn) return;

  const state = getAssetTypesFilterState(filterOptions);

  if (state.allOn) {
    assetTypeFilterBtn.title = "Toggle all asset types OFF";
  } else if (state.allOff) {
    assetTypeFilterBtn.title = "Toggle all asset types ON";
  } else {
    assetTypeFilterBtn.title = "Turn all asset types ON";
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Asset type filter toggle button event handler initialization
  const assetTypeFilterBtn = document.getElementById('assetTypeFilterToggleBtn');
  const filterOptions = document.querySelectorAll('.filter-option');

  if (assetTypeFilterBtn && filterOptions.length > 0) {
    // Set initial tooltip
    updateAssetTypeFilterBtnTooltip(assetTypeFilterBtn, filterOptions);

    // Handle clicks on the eye icon button
    assetTypeFilterBtn.addEventListener('click', (event) => {
      // Only handle clicks on the eye icon or the button itself, not the dropdown chevron
      if (event.target.classList.contains('fa-chevron-down')) {
        return; // Let the dropdown behavior handle this
      }

      event.stopPropagation(); // Prevent dropdown from toggling

      const state = getAssetTypesFilterState(filterOptions);

      // Determine what to do based on current state
      let newVisibility = 'visible'; // Default for someOn or allOff case

      if (state.allOn) {
        // If all are ON, turn all OFF
        newVisibility = 'hidden';
      }

      // Update all filter options based on the current state
      filterOptions.forEach(option => {
        const type = option.dataset.type;

        if (state.allOn) {
          // Scenario 1: All were ON, so turn all OFF
          option.classList.remove('active');
          // The CSS rule ".dropdown-content label.filter-option.active i { opacity: 1; }"
          // and ".dropdown-content label.filter-option i { opacity: 0; }"
          // will handle the checkmark visibility based on the 'active' class.
          if (type && activeFilters) {
            activeFilters.delete(type);
          }
        } else {
          // Scenario 2 (All OFF) or Scenario 3 (Some ON): Turn all ON
          option.classList.add('active');
          // CSS will make the checkmark visible due to the 'active' class.
          if (type && activeFilters) {
            activeFilters.add(type);
          }
        }
      });

      // Update the displayed assets
      updateFilteredModelFiles();
      renderPage(getCurrentPage());

      // Update the tooltip to reflect the new state
      updateAssetTypeFilterBtnTooltip(assetTypeFilterBtn, filterOptions);

      // DO NOT close the dropdown: // closeAllDropdowns();
    });

    // Add event listeners to individual filter options to update eye icon tooltip
    filterOptions.forEach(option => {
      option.addEventListener('click', () => {
        // Let a small delay occur to ensure the checkmark state is updated
        setTimeout(() => {
          updateAssetTypeFilterBtnTooltip(assetTypeFilterBtn, filterOptions);
        }, 10);
      });
    });
  }

  const customTextModal = document.getElementById('customTextModal');
  if (!customTextModal) return;

  const closeButton = document.getElementById('customTextModalCloseButton');
  const applyButton = document.getElementById('applyCustomFontTextButton');
  const presetButtons = customTextModal.querySelectorAll('.preset-buttons button');
  const customTextInput = document.getElementById('customTextInput');
  const fontSizeSlider = document.getElementById('fontSizeSlider');
  const fontSizeValue = document.getElementById('fontSizeValue');
  const fullscreenFontSizeSlider = document.getElementById('fullscreenFontSizeSlider');
  const fullscreenFontSizeValue = document.getElementById('fullscreenFontSizeValue');

  // Modal event listeners
  if (closeButton) {
    closeButton.addEventListener('click', closeCustomTextModal);
  }
  if (applyButton) {
    applyButton.addEventListener('click', applyCustomFontText);
  }
  if (customTextInput && presetButtons) {
    presetButtons.forEach(button => {
      button.addEventListener('click', () => {
        customTextInput.value = button.dataset.text;
      });
    });
  }

  // New preset text buttons (simpler version without arrow toggles)
  const presetTextButtons = customTextModal.querySelectorAll('.preset-text-btn');
  if (presetTextButtons && customTextInput) {
    presetTextButtons.forEach(button => {
      button.addEventListener('click', () => {
        // Get the preset text from the data-text attribute
        const presetText = button.dataset.text || '';

        // Set the text in the input area
        customTextInput.value = presetText;

        // Update textBeforeAllCaps to match new value
        textBeforeAllCaps = presetText;

        // If "All Caps" is active, immediately convert to uppercase
        const toggleAllCapsText = document.getElementById('toggleAllCapsText');
        if (toggleAllCapsText && toggleAllCapsText.checked) {
          customTextInput.value = customTextInput.value.toUpperCase();
        }
      });
    });
  }

  // All caps toggle functionality
  let textBeforeAllCaps = '';
  const toggleAllCapsText = document.getElementById('toggleAllCapsText');
  const allCapsIconSpan = customTextModal.querySelector('.all-caps-icon');

  if (toggleAllCapsText && customTextInput && allCapsIconSpan) {
    // Initialize textBeforeAllCaps with the current input value
    textBeforeAllCaps = customTextInput.value;

    // Function to update icon text
    const updateAllCapsIcon = () => {
      if (toggleAllCapsText.checked) {
        allCapsIconSpan.textContent = 'AA';
      } else {
        allCapsIconSpan.textContent = 'Aa';
      }
    };

    // Set initial icon state
    updateAllCapsIcon();

    // When the "All Caps" toggle is checked/unchecked
    toggleAllCapsText.addEventListener('change', () => {
      if (toggleAllCapsText.checked) {
        // Store the current (mixed case) text before uppercasing it
        textBeforeAllCaps = customTextInput.value;
        // Convert to uppercase
        customTextInput.value = customTextInput.value.toUpperCase();
      } else {
        // Restore the text as it was before uppercasing
        customTextInput.value = textBeforeAllCaps;
      }
      updateAllCapsIcon(); // Update icon text
    });

    // When typing in the textarea while "All Caps" is active
    customTextInput.addEventListener('input', () => {
      if (toggleAllCapsText.checked) {
        // Save current cursor position
        const currentSelectionStart = customTextInput.selectionStart;
        const currentSelectionEnd = customTextInput.selectionEnd;

        // Update textBeforeAllCaps with the current (mixed case) input
        textBeforeAllCaps = customTextInput.value;

        // Convert to uppercase
        customTextInput.value = customTextInput.value.toUpperCase();

        // Restore cursor position
        customTextInput.setSelectionRange(currentSelectionStart, currentSelectionEnd);
      } else {
        // Keep textBeforeAllCaps synced with current input when not in All Caps mode
        textBeforeAllCaps = customTextInput.value;
      }
    });
  }

    // Font size slider in modal
    if (fontSizeSlider && fontSizeValue) {
      fontSizeSlider.addEventListener('input', () => {
        fontSizeValue.textContent = fontSizeSlider.value;

        // Live preview in the modal
        if (customTextInput) {
          customTextInput.style.fontSize = `${fontSizeSlider.value}px`;
        }
      });
    }

  // Fullscreen font size slider
  if (fullscreenFontSizeSlider && fullscreenFontSizeValue) {
    fullscreenFontSizeSlider.addEventListener('input', () => {
      fullscreenFontSizeValue.textContent = fullscreenFontSizeSlider.value;

      // Apply the font size change to the fullscreen font preview
      if (currentFullscreenViewer && currentFullscreenViewer.type === 'font') {
        const fullscreenTextElement = document.querySelector('#fullscreenViewer .fullscreen-font-display p');
        if (fullscreenTextElement) {
          fullscreenTextElement.style.fontSize = `${fullscreenFontSizeSlider.value}px`;
        }
      }
    });
  }

  // Close modal on Escape key
  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' && customTextModal.style.display === 'flex') {
      closeCustomTextModal();
    }
  });

  // Close modal on outside click
  customTextModal.addEventListener('click', function(event) {
    if (event.target === customTextModal) {
      closeCustomTextModal();
    }
  });
});


// Classic welcome messages - shown first, then DAV-9000 takes over
const welcomeMessages = [
  { icon: "fa-hand-sparkles", text: "Drop some files here. I promise I won't judge your folder names." },
  { icon: "fa-folder-open", text: "Drag a folder in and let's see what treasures you've been hoarding." },
  { icon: "fa-wand-magic-stars", text: "This empty canvas awaits your assets. No pressure." },
  { icon: "fa-fire", text: "Your 3D models called. They want to be viewed." },
  { icon: "fa-ghost", text: "It's eerily empty in here. Drop something before the ghosts move in." },
  { icon: "fa-mug-hot", text: "Grab a coffee, drag some files, enjoy the show." },
  { icon: "fa-rocket", text: "Houston, we have no assets. Drag a folder to launch." },
  { icon: "fa-face-grin-beam", text: "I'm Dave. I view assets. Feed me folders." },
  { icon: "fa-puzzle-piece", text: "Missing: your files. Last seen: on your desktop. Drag them here." },
  { icon: "fa-hat-wizard", text: "A wizard is never late, but your files might be. Drop them here." },
  { icon: "fa-box-open", text: "Unbox your creativity. Drag images, models, videos \u2014 anything goes." },
  { icon: "fa-couch", text: "Make yourself at home. Explore the settings, pick a theme, then load some files." },
  { icon: "fa-cloud-arrow-up", text: "Got files in S3 or Google Drive? Click the gear icon to connect." },
  { icon: "fa-gamepad", text: "Achievement unlocked: opened Dave. Next quest: drop some files." },
  { icon: "fa-cat", text: "If you were a cat, you'd knock files off the desktop and into here." },
  { icon: "fa-palette", text: "Try the themes in Settings \u2014 find your vibe, then load your assets." },
  { icon: "fa-eye", text: "I see nothing. Literally. Please drop a folder so I have a purpose." },
  { icon: "fa-tree", text: "Click the tree icon on the left to browse folders like a file explorer pro." },
  { icon: "fa-bolt", text: "Psst... you can paste S3 or Google Drive URLs in the search bar." },
  { icon: "fa-music", text: "I handle audio too. Yes, really. Try me." },
  { icon: "fa-skull-crossbones", text: "Psst... click the D.A.V.E. logo. Trust me. It's not a trap. Okay, it's a little bit of a trap." },
  { icon: "fa-floppy-disk", text: "Back in my day, we fit an entire game on a floppy. Now your PNGs are 47MB each." },
  { icon: "fa-dragon", text: "Here be dragons. And also GLBs, FBXs, and the occasional suspicious .obj file." },
  { icon: "fa-dice", text: "Fun fact: this message was chosen randomly from a pool of many. You're special. Kinda." },
  { icon: "fa-poo", text: "Even your worst assets deserve to be seen. I don't judge. Much." },
  { icon: "fa-terminal", text: "No terminal needed. No npm install. No build step. Just drag and drop like a civilized person." },
  { icon: "fa-brain", text: "I can view 3D models, images, videos, audio, fonts, PDFs, and text files. I'm basically overqualified." },
  { icon: "fa-user-secret", text: "Everything stays in your browser. Your files never leave your machine. I'm not that kind of app." },
  { icon: "fa-trophy", text: "You've stared at this empty screen for a while now. That's dedication. Now drop some files." },
  { icon: "fa-martini-glass", text: "Shaken, not stirred. The name's Dave. Just Dave." },
  { icon: "fa-cookie-bite", text: "No cookies, no tracking, no analytics. Just vibes and vertices." },
  { icon: "fa-face-dizzy", text: "Roses are red, this viewer is empty. Drag a folder in, don't leave me feeling contempt-y." },
  { icon: "fa-helicopter", text: "Get to the dropper! Drag files into the zone! NOW!" },
  { icon: "fa-dungeon", text: "You found a secret: the D.A.V.E. title is clickable. What happens next may surprise you." },
  { icon: "fa-person-running", text: "Speaking of running \u2014 try clicking the D.A.V.E. logo up top. You might find a classic game hiding in there." },
  { icon: "fa-explosion", text: "This page is so empty it echoes. HELLO... hello... hello..." },
  { icon: "fa-glasses", text: "I support dark mode, light mode, and 14 themes. I'm basically a fashion icon." },
  { icon: "fa-satellite-dish", text: "Connecting to the cloud? I speak S3 and Google Drive fluently. Check the gear icon." },
  { icon: "fa-chess-knight", text: "Your move. Drop a folder. I dare you." },
  { icon: "fa-anchor", text: "Anchored and ready. Waiting for your payload, captain." },
  { icon: "fa-masks-theater", text: "Comedy: this empty screen. Tragedy: you haven't dropped files yet." },
  { icon: "fa-spa", text: "Take a deep breath. Now drag a folder. Namaste." },
  { icon: "fa-dumpster-fire", text: "Even if your project folder is a dumpster fire, I'll display it beautifully." },
  { icon: "fa-binoculars", text: "I've been looking everywhere for your files. Have you checked your Downloads folder?" },
  { icon: "fa-gem", text: "Every asset is a gem. Even that placeholder cube you made in Blender at 3am." },
  { icon: "fa-fish", text: "There are plenty of files in the sea. Drag some into this net." },
  { icon: "fa-scroll", text: "Ancient proverb: a viewer without files is like a fish without a bicycle. Wait, that's not right." },
  { icon: "fa-ghost", text: "Boo! Still empty. The only thing haunting this page is unused potential." },
  { icon: "fa-pizza-slice", text: "Files are like pizza toppings. More is almost always better. Load 'em up." },
];

let _currentWelcomeMsg = null;

export function showWelcomeMessage() {
  const container = document.getElementById('viewerContainer');
  if (!container || container.children.length > 0) return;
  if (isDAV9000Active()) return;

  // If user already saw DAV-9000 this session (returning after clearing files),
  // skip the welcome joke and go straight to terminal with returning personality
  if (hasTerminalBeenShown()) {
    showDAV9000Terminal(container);
    return;
  }

  // First visit: show classic welcome joke
  if (!_currentWelcomeMsg) {
    _currentWelcomeMsg = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
  }
  container.innerHTML = `
    <div class="welcome-message">
      <i class="fa-solid ${_currentWelcomeMsg.icon}"></i>
      <p>${_currentWelcomeMsg.text}</p>
    </div>`;

  // Schedule DAV-9000 takeover after 10-20s idle
  scheduleTakeover(container);
}

// Selection helper functions for keyboard shortcuts
export function selectAllFiles() {
  const tiles = document.querySelectorAll('.model-tile');
  tiles.forEach(tile => {
    const fileName = tile.dataset.modelName;
    if (fileName && !_selectedFiles.has(fileName)) {
      _selectedFiles.add(fileName);
      tile.classList.add('selected');
    }
  });
  updateSelectionCount();
  document.dispatchEvent(new CustomEvent('dave:selection', { detail: { count: _selectedFiles.size } }));
}
