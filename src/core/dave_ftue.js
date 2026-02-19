// dave_ftue.js — First Time User Experience Tour
// Dave himself guides first-time users through the app.
// State machine: IDLE → STARTING → STEP_N → FAREWELL → DONE

import { DaveMode, EMOTION } from './dave_mode.js';
import { DaveAlive } from './dave_alive.js';
import { cancelTakeover, destroyDAV9000Terminal } from './dav9000_terminal.js';

// ============================================================
//  Constants
// ============================================================

const STORAGE_COMPLETED = 'dave_ftue_completed';
const STORAGE_SKIPPED   = 'dave_ftue_skipped';
const STORAGE_VERSION   = 'dave_ftue_version';
const FIRST_ENABLED_KEY = 'dave_fullmode_first';
const FTUE_VERSION      = '1';

const STATES = {
  IDLE:     'IDLE',
  STARTING: 'STARTING',
  RUNNING:  'RUNNING',
  FAREWELL: 'FAREWELL',
  DONE:     'DONE',
};

const SPOTLIGHT_PADDING = 12;

// Tour step definitions
const STEPS = [
  {
    // Step 0: Introduction — no highlight
    target: null,
    emotion: EMOTION.PROUD,
    text: "Oh. OH. A new face. *adjusts pixels* Welcome to D.A.V.E. \u2014 that's me.\nI'm your asset viewer. I also have opinions. Let me show you around MY place.",
    duration: 7000,
    effect: 'jitter',
  },
  {
    // Step 1: Source Picker
    target: '#sourceDropdown',
    emotion: EMOTION.WARM,
    text: "This is where the magic starts. Pick a local folder, connect to S3, or Google Drive.\nDrag-and-drop works too \u2014 I'm not picky. Well, I AM, but not about this.",
    duration: 7000,
  },
  {
    // Step 2: Search Input
    target: '.search-wrapper',
    emotion: EMOTION.CURIOUS,
    text: "Search bar. Finds files, filters results. You can also paste cloud URLs right in here.\nIt multitasks. Like me. Except I also have feelings.",
    duration: 7000,
  },
  {
    // Step 3: Viewer Container
    target: '#viewerContainer',
    emotion: EMOTION.EXISTENTIAL,
    text: "This is the main stage. Your files show up here as tiles.\nClick any tile to preview it full-screen. Right now it's... empty.\n*stares into void* I'm used to it.",
    duration: 6000,
  },
  {
    // Step 4: Size Slider
    target: '.size-control',
    emotion: EMOTION.AMUSED,
    text: "Tile size control. Slide right for BIG. Slide left for tiny.\nI don't judge your preferences.",
    duration: 6000,
  },
  {
    // Step 5: Sort & Filter
    target: '#sortBtn',
    secondTarget: '#assetTypeFilterToggleBtn',
    emotion: EMOTION.SMUG,
    text: "Sort by name, size, type, or date. The eye icon next to it? That's your filter \u2014\nshow only the file types you care about. Organization is self-care.",
    duration: 7000,
  },
  {
    // Step 6: Settings Gear
    target: '#settingsDropdown',
    emotion: EMOTION.SASSY,
    text: "Settings. Themes \u2014 I look good in all fourteen of them. Cloud storage connections.\nAnd... a toggle with my name on it. We'll get to that.",
    duration: 7000,
    postIt: true,
  },
  {
    // Step 7: Folder Tree
    target: '#treeFolderToggle',
    emotion: EMOTION.NEUTRAL,
    text: "This tab opens a folder tree sidebar. Like a file explorer, but with better company.\n*gestures at self*",
    duration: 6000,
  },
  {
    // Step 8: Page Controls
    target: '.pageControls',
    emotion: EMOTION.NEUTRAL,
    text: "Page navigation. Arrow keys work too. You can change how many tiles per page\nif you're a \"see everything at once\" person. I respect that.",
    duration: 5000,
  },
];


// ============================================================
//  _DaveFTUE class
// ============================================================

class _DaveFTUE {
  constructor() {
    this._state = STATES.IDLE;
    this._running = false;
    this._aborted = false;
    this._currentStep = -1;
    this._overlay = null;
    this._spotlight = null;
    this._progressEl = null;
    this._skipBtn = null;
    this._bootEl = null;
    this._postItEl = null;
    this._postItTimer = null;
    this._waypoints = [];
    this._resizeHandler = null;
    this._escHandler = null;
    this._currentTargetRect = null;
    this._bubbleDismissResolve = null;
    this._originalDismissHandler = null;
  }

  // ============================================================
  //  Public API
  // ============================================================

  init() {
    if (this._shouldAutoStart()) {
      setTimeout(() => this.start(), 2000);
    }
  }

  start(force = false) {
    if (this._running) return;
    if (!force && !this._shouldAutoStart()) return;

    this._running = true;
    this._aborted = false;
    this._state = STATES.STARTING;
    this._currentStep = -1;

    this._prepareTour().then(() => this._runTour());
  }

  skip() {
    if (!this._running || this._aborted) return;
    this._aborted = true;
    if (this._bubbleDismissResolve) {
      this._bubbleDismissResolve();
      this._bubbleDismissResolve = null;
    }
    this._skipFarewell();
  }

  // ============================================================
  //  Detection
  // ============================================================

  _shouldAutoStart() {
    if (localStorage.getItem(STORAGE_COMPLETED) === 'true') return false;
    if (localStorage.getItem(STORAGE_SKIPPED) === 'true') return false;
    if (localStorage.getItem(FIRST_ENABLED_KEY)) return false;
    return true;
  }

  // ============================================================
  //  Preparation
  // ============================================================

  async _prepareTour() {
    // Suppress DAV-9000 terminal
    try { cancelTakeover(); } catch { /* ok */ }
    try { destroyDAV9000Terminal(); } catch { /* ok */ }

    // Enable Dave Mode silently
    if (!DaveMode._enabled) {
      DaveMode.enable(false);
      await this._wait(500);
    }

    // Suppress idle behaviors
    DaveAlive._ftueActive = true;

    // Stop cursor follow during tour
    DaveMode._stopCursorFollow();

    // Create tour DOM
    this._createOverlay();
    this._createSpotlight();
    this._createProgressDots();
    this._createSkipButton();
    this._wireEscKey();
    this._wireResize();
  }

  // ============================================================
  //  Tour Flow
  // ============================================================

  async _runTour() {
    this._state = STATES.RUNNING;

    // Boot sequence
    await this._showBootSequence();
    if (this._aborted) return;

    // Run each step
    for (let i = 0; i < STEPS.length; i++) {
      if (this._aborted) return;
      this._currentStep = i;
      await this._runStep(i);
    }

    if (this._aborted) return;

    // Farewell
    await this._farewell();
  }

  async _runStep(index) {
    const step = STEPS[index];
    if (this._aborted) return;

    // Resolve target element(s)
    let targetEl = null;
    let targetRect = null;

    if (step.target) {
      targetEl = document.querySelector(step.target);
      if (!targetEl) {
        // Element not found — skip step silently
        console.warn(`[FTUE] Step ${index}: target "${step.target}" not found, skipping`);
        return;
      }
      targetRect = targetEl.getBoundingClientRect();

      // If there's a second target, expand rect to cover both
      if (step.secondTarget) {
        const el2 = document.querySelector(step.secondTarget);
        if (el2) {
          const r2 = el2.getBoundingClientRect();
          const x1 = Math.min(targetRect.left, r2.left);
          const y1 = Math.min(targetRect.top, r2.top);
          const x2 = Math.max(targetRect.right, r2.right);
          const y2 = Math.max(targetRect.bottom, r2.bottom);
          targetRect = { left: x1, top: y1, right: x2, bottom: y2, width: x2 - x1, height: y2 - y1 };
        }
      }

      this._currentTargetRect = targetRect;

      // Fly Dave to near the target
      const flyX = targetRect.left + targetRect.width / 2;
      const flyY = Math.max(targetRect.bottom + 20, targetRect.top - 50);
      try {
        await DaveAlive.trailEngine.animateMoveTo(
          Math.min(flyX, window.innerWidth - 50),
          Math.min(flyY, window.innerHeight - 50),
          700
        );
      } catch { /* ok */ }

      // Show spotlight
      this._updateSpotlight(targetRect);
      this._spotlight.classList.add('visible');

      // Update overlay clip-path
      this._updateOverlayClipPath(targetRect);

      // Leave waypoint marker
      this._leaveWaypoint(targetRect);

    } else {
      // No target (intro step) — hide spotlight
      this._spotlight.classList.remove('visible');
      this._overlay.style.clipPath = '';
      this._currentTargetRect = null;
    }

    // Update progress dots
    this._updateProgress(index);

    // Apply effect
    if (step.effect === 'jitter') {
      DaveMode._reactJitter();
    }

    // Set emotion
    DaveMode._setEmotion(step.emotion);

    // Show speech bubble and wait for dismiss or timeout
    await this._showBubbleAndWait(step.text, step.emotion, step.duration);

    // Post-it on settings gear after Step 6
    if (step.postIt) {
      this._leavePostIt();
    }
  }

  // ============================================================
  //  Boot Sequence
  // ============================================================

  async _showBootSequence() {
    const boot = document.createElement('div');
    boot.className = 'dave-ftue-boot';
    document.body.appendChild(boot);
    this._bootEl = boot;

    const lines = [
      '> FTUE MODULE LOADED',
      '> PERSONALITY: ENTHUSIASTIC (OVERRIDE)',
      '> BEGINNING GUIDED TOUR...',
    ];

    await this._wait(200);
    boot.classList.add('visible');

    for (let i = 0; i < lines.length; i++) {
      if (this._aborted) break;
      const lineEl = document.createElement('div');
      lineEl.className = 'line';
      lineEl.textContent = lines[i];
      lineEl.style.animationDelay = `${i * 0.15}s`;
      boot.appendChild(lineEl);
      await this._wait(500);
    }

    await this._wait(1000);

    // Fade out boot text
    boot.classList.remove('visible');
    await this._wait(400);
    boot.remove();
    this._bootEl = null;
  }

  // ============================================================
  //  Bubble with advance-on-dismiss
  // ============================================================

  async _showBubbleAndWait(text, emotion, autoAdvanceMs) {
    if (this._aborted) return;

    // Show bubble with force
    DaveMode._showBubble(text, { force: true, emotion });

    // Create a promise that resolves on bubble dismiss click OR timeout
    return new Promise((resolve) => {
      this._bubbleDismissResolve = resolve;
      let resolved = false;

      const done = () => {
        if (resolved) return;
        resolved = true;
        this._bubbleDismissResolve = null;
        if (this._originalDismissHandler) {
          this._restoreDismissHandler();
        }
        resolve();
      };

      // Intercept dismiss button click to advance immediately
      this._interceptDismissButton(done);

      // Auto-advance timeout
      setTimeout(done, autoAdvanceMs);
    });
  }

  _interceptDismissButton(callback) {
    const dismissBtn = DaveMode._bubbleEl?.querySelector('.dave-bubble-dismiss');
    if (!dismissBtn) return;

    // Store original handler by cloning the element
    const newBtn = dismissBtn.cloneNode(true);
    dismissBtn.parentNode.replaceChild(newBtn, dismissBtn);

    newBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      DaveMode._hideBubble();
      callback();
    });

    // Store reference for restore
    this._originalDismissHandler = newBtn;
  }

  _restoreDismissHandler() {
    // The bubble DOM gets rebuilt each time DaveMode._buildDOM() runs,
    // so no restore needed — the dismiss button is fresh each time.
    this._originalDismissHandler = null;
  }

  // ============================================================
  //  Overlay + Spotlight
  // ============================================================

  _createOverlay() {
    const el = document.createElement('div');
    el.className = 'dave-ftue-overlay';
    document.body.appendChild(el);
    this._overlay = el;
  }

  _createSpotlight() {
    const el = document.createElement('div');
    el.className = 'dave-ftue-spotlight';
    document.body.appendChild(el);
    this._spotlight = el;
  }

  _updateSpotlight(rect) {
    const p = SPOTLIGHT_PADDING;
    this._spotlight.style.left   = (rect.left - p) + 'px';
    this._spotlight.style.top    = (rect.top - p) + 'px';
    this._spotlight.style.width  = (rect.width + p * 2) + 'px';
    this._spotlight.style.height = (rect.height + p * 2) + 'px';
  }

  _updateOverlayClipPath(rect) {
    const p = SPOTLIGHT_PADDING;
    const x1 = rect.left - p;
    const y1 = rect.top - p;
    const x2 = rect.left + rect.width + p;
    const y2 = rect.top + rect.height + p;
    const W = window.innerWidth;
    const H = window.innerHeight;

    // Polygon that covers the full viewport except a rectangular hole
    this._overlay.style.clipPath = `polygon(
      0 0, ${W}px 0, ${W}px ${H}px, 0 ${H}px, 0 0,
      ${x1}px ${y1}px, ${x1}px ${y2}px, ${x2}px ${y2}px, ${x2}px ${y1}px, ${x1}px ${y1}px
    )`;
  }

  // ============================================================
  //  Progress Dots
  // ============================================================

  _createProgressDots() {
    const container = document.createElement('div');
    container.className = 'dave-ftue-progress';
    for (let i = 0; i < STEPS.length; i++) {
      const dot = document.createElement('div');
      dot.className = 'dave-ftue-dot';
      container.appendChild(dot);
    }
    document.body.appendChild(container);
    this._progressEl = container;
  }

  _updateProgress(stepIndex) {
    if (!this._progressEl) return;
    const dots = this._progressEl.querySelectorAll('.dave-ftue-dot');
    dots.forEach((dot, i) => {
      dot.classList.remove('active', 'completed');
      if (i < stepIndex) dot.classList.add('completed');
      else if (i === stepIndex) dot.classList.add('active');
    });
  }

  // ============================================================
  //  Skip Button + ESC
  // ============================================================

  _createSkipButton() {
    const btn = document.createElement('button');
    btn.className = 'dave-ftue-skip';
    btn.textContent = 'Skip Tour [ESC]';
    btn.addEventListener('click', () => this.skip());
    document.body.appendChild(btn);
    this._skipBtn = btn;
  }

  _wireEscKey() {
    this._escHandler = (e) => {
      if (e.key === 'Escape' && this._running) {
        e.stopPropagation();
        e.preventDefault();
        this.skip();
      }
    };
    document.addEventListener('keydown', this._escHandler, true);
  }

  // ============================================================
  //  Resize Handler
  // ============================================================

  _wireResize() {
    let timeout;
    this._resizeHandler = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (this._currentTargetRect && this._spotlight.classList.contains('visible')) {
          // Re-query the target element
          const step = STEPS[this._currentStep];
          if (step?.target) {
            const el = document.querySelector(step.target);
            if (el) {
              let rect = el.getBoundingClientRect();
              if (step.secondTarget) {
                const el2 = document.querySelector(step.secondTarget);
                if (el2) {
                  const r2 = el2.getBoundingClientRect();
                  const x1 = Math.min(rect.left, r2.left);
                  const y1 = Math.min(rect.top, r2.top);
                  const x2 = Math.max(rect.right, r2.right);
                  const y2 = Math.max(rect.bottom, r2.bottom);
                  rect = { left: x1, top: y1, right: x2, bottom: y2, width: x2 - x1, height: y2 - y1 };
                }
              }
              this._currentTargetRect = rect;
              this._updateSpotlight(rect);
              this._updateOverlayClipPath(rect);
            }
          }
        }
      }, 150);
    };
    window.addEventListener('resize', this._resizeHandler);
  }

  // ============================================================
  //  Waypoint Markers
  // ============================================================

  _leaveWaypoint(rect) {
    const wp = document.createElement('div');
    wp.className = 'dave-ftue-waypoint';
    wp.textContent = '+';
    wp.style.left = (rect.left + rect.width / 2 - 5) + 'px';
    wp.style.top  = (rect.top - 20) + 'px';
    document.body.appendChild(wp);
    this._waypoints.push(wp);
  }

  _fadeWaypoints() {
    for (const wp of this._waypoints) {
      wp.classList.add('fading');
    }
    setTimeout(() => {
      for (const wp of this._waypoints) wp.remove();
      this._waypoints = [];
    }, 1500);
  }

  // ============================================================
  //  Post-It Note
  // ============================================================

  _leavePostIt() {
    const gear = document.querySelector('#settingsDropdown');
    if (!gear) return;

    const gearRect = gear.getBoundingClientRect();
    const postIt = document.createElement('div');
    postIt.className = 'dave-ftue-postit';
    postIt.textContent = '"Full Dave Mode" is in here - D.';
    postIt.style.left = (gearRect.right + 8) + 'px';
    postIt.style.top  = (gearRect.top - 5) + 'px';
    document.body.appendChild(postIt);
    this._postItEl = postIt;

    // Auto-remove after 30s
    this._postItTimer = setTimeout(() => {
      this._removePostIt();
    }, 30000);
  }

  _removePostIt() {
    clearTimeout(this._postItTimer);
    if (this._postItEl) {
      this._postItEl.classList.add('removing');
      setTimeout(() => {
        this._postItEl?.remove();
        this._postItEl = null;
      }, 600);
    }
  }

  // ============================================================
  //  Farewell (natural end)
  // ============================================================

  async _farewell() {
    if (this._aborted) return;
    this._state = STATES.FAREWELL;

    // Hide spotlight + overlay
    this._spotlight.classList.remove('visible');
    this._overlay.style.clipPath = '';

    // Fly Dave home
    const homeX = window.innerWidth - 60;
    const homeY = window.innerHeight - 60;
    try {
      await DaveAlive.trailEngine.animateMoveTo(homeX, homeY, 700);
    } catch { /* ok */ }

    if (this._aborted) return;

    // Part 1: WARM
    DaveMode._setEmotion(EMOTION.WARM);
    await this._showBubbleAndWait(
      "And that's the tour. Not bad for a web app, right?",
      EMOTION.WARM, 4000
    );
    if (this._aborted) return;

    await this._wait(1500);
    if (this._aborted) return;

    // Part 2: SAD + tear
    DaveMode._setEmotion(EMOTION.SAD);
    DaveMode._triggerTear(EMOTION.SAD);
    await this._showBubbleAndWait(
      "Now here's the thing. I'm going to turn myself off.\nYou can find me in Settings \u2014 that gear icon \u2014 under \"Full Dave Mode\".\nToggle me ON whenever you want the company. I'll be... waiting. In the void.",
      EMOTION.SAD, 7000
    );
    if (this._aborted) return;

    await this._wait(1500);
    if (this._aborted) return;

    // Part 3: PROUD + fireworks
    DaveMode._setEmotion(EMOTION.PROUD);
    DaveMode._triggerFireworks();
    await this._showBubbleAndWait(
      "*straightens pixels* It was nice meeting you. Now go view some assets.\nThat IS what we're both here for. ...Right?",
      EMOTION.PROUD, 5000
    );
    if (this._aborted) return;

    // Fade waypoints
    this._fadeWaypoints();

    // Set completed
    localStorage.setItem(STORAGE_COMPLETED, 'true');
    localStorage.setItem(STORAGE_VERSION, FTUE_VERSION);

    // Disable Dave after farewell
    await this._wait(1000);
    DaveMode.disable(false);

    this._cleanup();
  }

  // ============================================================
  //  Skip Farewell
  // ============================================================

  async _skipFarewell() {
    this._state = STATES.FAREWELL;

    // Clear spotlight immediately
    this._spotlight.classList.remove('visible');
    this._overlay.style.clipPath = '';

    // Fly Dave home
    const homeX = window.innerWidth - 60;
    const homeY = window.innerHeight - 60;
    try {
      DaveAlive.trailEngine._isMoving = false; // force-abort any in-progress movement
      await DaveAlive.trailEngine.animateMoveTo(homeX, homeY, 500);
    } catch { /* ok */ }

    // Show skip summary
    DaveMode._setEmotion(EMOTION.WARM);
    DaveMode._showBubble(
      "No worries. Quick version: drop files here, they show up as tiles,\nclick to preview. I'm under Settings > Full Dave Mode if you want me around.\n*salutes*",
      { force: true, emotion: EMOTION.WARM }
    );

    // Wait for bubble to display
    await this._wait(6000);

    // Set skipped
    localStorage.setItem(STORAGE_SKIPPED, 'true');
    localStorage.setItem(STORAGE_VERSION, FTUE_VERSION);

    // Disable Dave
    DaveMode.disable(false);

    // Fade waypoints
    this._fadeWaypoints();

    this._cleanup();
  }

  // ============================================================
  //  Cleanup
  // ============================================================

  _cleanup() {
    this._state = STATES.DONE;
    this._running = false;

    // Restore alive system
    DaveAlive._ftueActive = false;

    // Remove tour DOM
    this._overlay?.remove();
    this._overlay = null;
    this._spotlight?.remove();
    this._spotlight = null;
    this._progressEl?.remove();
    this._progressEl = null;
    this._skipBtn?.remove();
    this._skipBtn = null;
    this._bootEl?.remove();
    this._bootEl = null;

    // Post-it stays (auto-removes itself after 30s)

    // Remove event listeners
    if (this._escHandler) {
      document.removeEventListener('keydown', this._escHandler, true);
      this._escHandler = null;
    }
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
      this._resizeHandler = null;
    }

    // Clean up any remaining waypoints that weren't faded
    for (const wp of this._waypoints) wp.remove();
    this._waypoints = [];

    this._currentTargetRect = null;
    this._bubbleDismissResolve = null;
  }

  // ============================================================
  //  Utility
  // ============================================================

  _wait(ms) {
    return new Promise((resolve) => {
      const id = setTimeout(() => {
        resolve();
      }, ms);

      // Allow abort to break waits
      if (this._aborted) {
        clearTimeout(id);
        resolve();
      }
    });
  }
}


// ============================================================
//  Singleton Export
// ============================================================

export const DaveFTUE = new _DaveFTUE();
