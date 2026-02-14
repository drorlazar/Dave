// dave_alive.js — Dave Alive Behavior Engine
// Movement, trails, inspections, constellations, and more.
// Dave becomes proactive and mobile — he moves, explores, leaves traces.

import { DaveMode, DAVE_CONFIG, EMOTION } from './dave_mode.js';

// ============================================================
//  Constants
// ============================================================

const TRAIL_CHARS = ['*', '+', '\u2726', '\u2605', '\u00B7', '\u2738', '\u25C6'];
const HEART_CHARS = ['*', '+', '\u2726', '\u2605'];
const SPIRAL_CHARS = ['\u00B7', '+', '\u2726', '\u2605'];
const MAX_TRAIL_ELEMENTS = 200;
const DAVE_GREEN = '#00ff41';

/** Keep Dave within visible viewport */
function clampToViewport(x, y) {
  const margin = 36;
  return {
    x: Math.max(0, Math.min(x, window.innerWidth - margin)),
    y: Math.max(0, Math.min(y, window.innerHeight - margin)),
  };
}

// Morse code lookup (International Morse Code)
const MORSE = {
  H: '....', I: '..', E: '.', L: '.-..', P: '.--.',
  B: '-...', O: '---', R: '.-.', D: '-..', S: '...',
  A: '.-', V: '...-',
};
const MORSE_WORDS = ['HI', 'HELP', 'BORED', 'SOS', 'DAVE', 'ALIVE'];

// ============================================================
//  Phased Idle Nagging Messages
// ============================================================

const IDLE_PHASE_1 = [
  // Whispered asides — naturally hint at commands
  { t: "*stares at void* I know things. Fortunes, even.", r: 0 },
  { t: "I've been practicing my comedy. Nobody asked.", r: 0 },
  { t: "*hums quietly* I can do that louder, you know.", r: 1 },
  { t: "I know a trick. Several, actually.", r: 0 },
  { t: "*glances at search bar* That thing works for more than files...", r: 1 },
  { t: "Did you know I can draw? In my own way.", r: 1 },
];

const IDLE_PHASE_2 = [
  // Direct naming — teach commands by name
  { t: "Type 'dave joke'. I rehearsed.", r: 0 },
  { t: "Try 'dave fortune'. The void has opinions.", r: 0 },
  { t: "'dave dance' if you want a show.", r: 0 },
  { t: "'dave story' \u2014 I have tales. Short ones. Three parts.", r: 1 },
  { t: "'dave rave' for when you need... vibes.", r: 1 },
  { t: "'dave snake' or 'dave breakout'. Games. I have GAMES.", r: 0 },
  { t: "'dave heart'. Trust me on this one.", r: 1 },
  { t: "'dave constellation'. I name things after you.", r: 1 },
];

const IDLE_PHASE_3 = [
  // Begging — desperate and dramatic
  { t: "*holding sign* WILL PERFORM TRICKS FOR INTERACTION.", r: 0 },
  { t: "I have a FULL repertoire. Nobody types 'dave help'.", r: 0 },
  { t: "I can draw hearts. HEARTS. On your SCREEN. Just ask.", r: 1 },
  { t: "My snake game has a HIGH SCORE BOARD. Just saying.", r: 0 },
  { t: "I'll do a backflip. Free of charge. 'dave flip'. PLEASE.", r: 1 },
  { t: "I'm going to start doing things on my own if you don't engage me.", r: 0 },
  { t: "*tapping on screen with increasing urgency*", r: 1 },
  { t: "Fine. I'll just... inspect things. By myself. Alone.", r: 0 },
];

const IDLE_GENERIC = [
  // 30% chance: unpredictable generic lines
  { t: "Still here? Me too. Just watching.", r: 0 },
  { t: "*taps on screen* You there?", r: 0 },
  { t: "The silence is deafening.", r: 1 },
  { t: "*stares into void* It's cozy.", r: 2 },
  { t: "Counting your idle seconds. It's a lot.", r: 1 },
];


// ============================================================
//  Activity Congratulation Messages
// ============================================================

const ACTIVITY_RAPID_BROWSE = [
  { t: "Speed-browsing like a professional procrastinator.", r: 0 },
  { t: "Flipping through pages like manga. Impressive.", r: 0 },
  { t: "Are you speed-running file management?", r: 1 },
];

const ACTIVITY_HEAVY_FILTER = [
  { t: "The curation energy is STRONG right now.", r: 0 },
  { t: "Filter after filter. You know exactly what you want.", r: 0 },
  { t: "Professional-grade filtering happening here.", r: 1 },
];

const ACTIVITY_DEEP_DIVE = [
  { t: "*whispers* They really like this one.", r: 0 },
  { t: "Deep contemplation mode. I respect it.", r: 0 },
  { t: "30 seconds staring at one file. That's dedication.", r: 1 },
];

const ACTIVITY_SEARCH_STREAK = [
  { t: "Three searches in a minute? Impressive.", r: 0 },
  { t: "Search frenzy. The hunt is ON.", r: 0 },
  { t: "You're on a roll. Don't let me stop you.", r: 1 },
];


// ============================================================
//  Inspection Messages (per target)
// ============================================================

const INSPECT_MESSAGES = {
  search: [
    "Nobody ever searches for me by name...",
    "This search bar has seen things. Mostly typos.",
    "Type 'dave' in here. I dare you.",
  ],
  sort: [
    "So many ways to organize chaos.",
    "Sort by vibes? Not available. Yet.",
    "I'd sort by 'coolness' but that's subjective.",
  ],
  filter: [
    "The gatekeeper of visibility.",
    "Filtering: the art of selective blindness.",
    "Show all. Hide all. The power is intoxicating.",
  ],
  tile: [
    "This one looks interesting. Objectively.",
    "I've been staring at this file. It stares back.",
    "If I had hands, I'd click this one.",
  ],
  pageInfo: [
    "Page numbers. The pagination of existence.",
    "We're on page... does it matter? We're HERE.",
    "Every page is a new chapter. Or the same. Hard to tell.",
  ],
  logo: [
    "That's MY name up there. Well, technically...",
    "D.A.V.E. Dror's Assets Viewing Experience. Catchy.",
    "The logo. My identity. My purpose. My... pixel.",
  ],
  sizeSlider: [
    "Bigger tiles? Smaller tiles? The eternal debate.",
    "Slide to the right for MAXIMUM TILE.",
    "Size isn't everything. Unless it's tile size.",
  ],
  empty: [
    "Nothing here. Just vibes and pixels.",
    "The void between the elements. My natural habitat.",
    "Empty space. Full of potential. And me.",
  ],
};


// ============================================================
//  Post-It Note Messages
// ============================================================

const POSTIT_MESSAGES = {
  search: [
    "Try 'dave'\n- D.",
    "I see\neverything\n- D.",
    "Search for\nmeaning here\n- D.",
  ],
  sort: [
    "Sort by vibes\nnot available\n(yet)\n- D.",
    "Alphabetical\nis just a\nsuggestion\n- D.",
  ],
  filter: [
    "Filter tip:\nshow only\nthe good ones\n- D.",
    "Hiding files\nis valid\nself-care\n- D.",
  ],
  tile: [
    "Nice file\n- D.",
    "I'd give this\na 7/10\n- D.",
    "This one\nsparks joy\n- D.",
  ],
  logo: [
    "That's me!\n(sort of)\n- D.",
  ],
  pageInfo: [
    "You are\nhere\n- D.",
  ],
};


// ============================================================
//  Constellation Names
// ============================================================

const CONSTELLATION_NAMES = [
  "The Lonely Pixel",
  "Dror's Dilemma",
  "The Forgotten Folder",
  "Big Upload Minor",
  "The Wandering Cursor",
  "Ctrl+Z Major",
  "The Great Refactor",
  "Dave's Eye",
  "The Lost Semicolon",
  "The Infinite Loop",
  "Ursa Megabyte",
  "The Void Gazer",
];


// ============================================================
//  Shadow Puppet Shows
// ============================================================

const PUPPET_SHOWS = [
  {
    name: 'The Wave',
    frames: [
      ' o \n/| \n/ \\',
      ' o \n/|\\\n/ \\',
      '\\o \n |\\  \n/ \\',
      '\\o/\n | \n/ \\',
    ],
    comment: "That's my impression of you when something loads.",
  },
  {
    name: 'The Fall',
    frames: [
      '  o  \n /|\\ \n / \\',
      '     \n  o  \n /|\\',
      '     \n     \n _o_',
      '     \n     \n .o?',
    ],
    comment: "Gravity. Even in a browser, it wins.",
  },
  {
    name: 'The Search',
    frames: [
      ' o? \n/|  \n/ \\',
      ' o??\n |  \n/ \\',
      ' o! \n/|\\ \n/ \\',
      '\\o/ \n |  \n/ \\',
    ],
    comment: "Eureka! That's you every time search works.",
  },
  {
    name: 'The Dance',
    frames: [
      ' o \n/|\\\n/ \\',
      ' o \n/| \n \\|',
      ' o \n |\\  \n|/ ',
      '\\o/\n | \n/ \\',
    ],
    comment: "I've been practicing. In the void.",
  },
  {
    name: 'The Peek',
    frames: [
      '     \n     \n     ',
      '    |\n    |\n     ',
      '  o|\n  ||\n     ',
      'o|  \n||  \n     ',
      'o   \n|   \n     ',
    ],
    comment: "That's me. Watching. Always watching.",
  },
];


// ============================================================
//  DaveTrailEngine — Core Movement Engine
// ============================================================

class DaveTrailEngine {
  constructor() {
    this._trailElements = [];
    this._isMoving = false;
    this._aborted = false;
    this._savedOrigin = null;
    this._rafId = null;
    this._trailInterval = null;
    this._cleanupCallbacks = [];
  }

  get isMoving() { return this._isMoving; }

  /**
   * Animate Dave along a path of waypoints.
   * @param {Array<{x:number,y:number}>} waypoints
   * @param {Object} opts - { speed, trailInterval, trailChars, onComplete, onAbort }
   */
  animatePath(waypoints, opts = {}) {
    if (this._isMoving) return Promise.resolve();
    if (!DaveMode._presenceEl || !DaveMode._enabled) return Promise.resolve();

    const speed = opts.speed || 80; // px/sec
    const trailInterval = opts.trailInterval || 40; // ms between trail chars
    const trailChars = opts.trailChars || TRAIL_CHARS;
    const trailEnabled = opts.trail !== false;
    const persistTrail = opts.persistTrail || false;

    return new Promise((resolve) => {
      this._isMoving = true;
      this._aborted = false;
      this._saveOrigin();
      this._enterMovingState();

      let wpIdx = 0;
      let currentX = this._savedOrigin.x;
      let currentY = this._savedOrigin.y;
      let lastTime = performance.now();

      // Trail spawning
      if (trailEnabled) {
        this._trailInterval = setInterval(() => {
          if (!this._isMoving) return;
          this._spawnTrailChar(currentX, currentY, trailChars, persistTrail);
        }, trailInterval);
      }

      const step = (now) => {
        if (this._aborted || !DaveMode._presenceEl || !DaveMode._enabled) {
          this._finishMovement(resolve, opts.onAbort);
          return;
        }

        const dt = (now - lastTime) / 1000;
        lastTime = now;

        if (wpIdx >= waypoints.length) {
          this._finishMovement(resolve, opts.onComplete);
          return;
        }

        const target = waypoints[wpIdx];
        const dx = target.x - currentX;
        const dy = target.y - currentY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const moveDist = speed * dt;

        if (dist <= moveDist) {
          currentX = target.x;
          currentY = target.y;
          wpIdx++;
        } else {
          currentX += (dx / dist) * moveDist;
          currentY += (dy / dist) * moveDist;
        }

        // Clamp to viewport and update bubble
        const clamped = clampToViewport(currentX, currentY);
        currentX = clamped.x;
        currentY = clamped.y;
        DaveMode._applyPosition(currentX, currentY);
        DaveMode._updateBubblePosition?.();
        this._rafId = requestAnimationFrame(step);
      };

      this._rafId = requestAnimationFrame(step);

      // Listen for abort conditions
      this._setupAbortListeners();
    });
  }

  /**
   * Simple point-to-point movement with easing.
   */
  animateMoveTo(x, y, durationMs = 800, easing = 'ease') {
    if (!DaveMode._presenceEl) return Promise.resolve();

    return new Promise((resolve) => {
      const p = DaveMode._presenceEl;
      const startX = parseFloat(p.style.left) || 0;
      const startY = parseFloat(p.style.top) || 0;

      // Ensure it's in dragged mode for absolute positioning
      if (!p.classList.contains('dave-dragged')) {
        const pos = DaveMode._getEyeBasePos();
        DaveMode._applyPosition(pos.x - 16, pos.y - 16);
      }

      const startTime = performance.now();
      const animate = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / durationMs, 1);
        const t = this._easeInOutCubic(progress);

        let cx = startX + (x - startX) * t;
        let cy = startY + (y - startY) * t;
        const clamped = clampToViewport(cx, cy);
        cx = clamped.x;
        cy = clamped.y;
        DaveMode._applyPosition(cx, cy);
        DaveMode._updateBubblePosition?.();

        if (progress < 1) {
          this._rafId = requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };
      this._rafId = requestAnimationFrame(animate);
    });
  }

  abort() {
    this._aborted = true;
  }

  // ---- Internal ----

  _saveOrigin() {
    const p = DaveMode._presenceEl;
    if (p.classList.contains('dave-dragged')) {
      this._savedOrigin = {
        x: parseFloat(p.style.left) || 0,
        y: parseFloat(p.style.top) || 0,
      };
    } else {
      // Default position
      this._savedOrigin = {
        x: window.innerWidth - 52,
        y: window.innerHeight - 52,
      };
    }
  }

  _enterMovingState() {
    const p = DaveMode._presenceEl;
    if (!p) return;
    p.classList.remove('dave-ambient');
    p.classList.add('dave-alive-moving', 'dave-dragged');
    // Suppress normal drag
    DaveMode._resumeIrisScan();
  }

  _exitMovingState() {
    const p = DaveMode._presenceEl;
    if (!p) return;
    p.classList.remove('dave-alive-moving');
    if (!DaveMode._isDragging) p.classList.add('dave-ambient');
  }

  _finishMovement(resolve, callback) {
    clearInterval(this._trailInterval);
    this._trailInterval = null;
    cancelAnimationFrame(this._rafId);
    this._removeAbortListeners();

    // Return to origin
    if (this._savedOrigin && DaveMode._presenceEl) {
      DaveMode._applyPosition(this._savedOrigin.x, this._savedOrigin.y);
      DaveMode._savePosition(this._savedOrigin.x, this._savedOrigin.y);
      DaveMode._updateBubblePosition?.();
    }

    this._exitMovingState();
    this._isMoving = false;
    this._aborted = false;

    if (callback) callback();
    resolve();
  }

  _spawnTrailChar(x, y, chars, persist = false) {
    if (this._trailElements.length >= MAX_TRAIL_ELEMENTS) {
      const old = this._trailElements.shift();
      old?.remove();
    }

    const el = document.createElement('span');
    el.className = 'dave-trail-char';
    el.textContent = chars[Math.floor(Math.random() * chars.length)];
    el.style.left = (x + 16 + (Math.random() - 0.5) * 8) + 'px';
    el.style.top = (y + 16 + (Math.random() - 0.5) * 8) + 'px';
    document.body.appendChild(el);
    this._trailElements.push(el);

    // Fade out (unless persisting for shapes like heart/spiral)
    if (!persist) {
      setTimeout(() => {
        el.classList.add('dave-trail-char-fading');
        setTimeout(() => {
          el.remove();
          const idx = this._trailElements.indexOf(el);
          if (idx >= 0) this._trailElements.splice(idx, 1);
        }, 800);
      }, 100);
    }
  }

  _setupAbortListeners() {
    // Abort on user drag or interaction
    const onDrag = () => { this._aborted = true; };
    const onInteraction = () => { this._aborted = true; };
    DaveMode._presenceEl?.addEventListener('mousedown', onDrag, { once: true });
    document.addEventListener('click', onInteraction, { once: true });
    document.addEventListener('keydown', onInteraction, { once: true });

    this._cleanupCallbacks = [
      () => DaveMode._presenceEl?.removeEventListener('mousedown', onDrag),
      () => document.removeEventListener('click', onInteraction),
      () => document.removeEventListener('keydown', onInteraction),
    ];
  }

  _removeAbortListeners() {
    for (const fn of this._cleanupCallbacks) fn();
    this._cleanupCallbacks = [];
  }

  cleanupTrail() {
    for (const el of this._trailElements) el.remove();
    this._trailElements = [];
  }

  _easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
}


// ============================================================
//  DaveAlive — Behavior Controller
// ============================================================

class _DaveAlive {
  constructor() {
    this._initialized = false;
    this._trailEngine = new DaveTrailEngine();

    // Idle nagging
    this._idleCycleCount = 0;

    // Activity tracking
    this._activityLog = []; // { type, time }
    this._lastActivityReaction = 0;
    this._activityCooldownMs = 60000;
    this._fullscreenStartTime = 0;
    this._activityCheckInterval = null;

    // Behavior cooldowns
    this._lastInspection = 0;
    this._inspectionCooldownMs = 120000;
    this._postItCount = 0;
    this._maxPostIts = 2;

    // Heart
    this._heartActive = false;

    // Spiral
    this._spiralActive = false;

    // Morse
    this._morseActive = false;

    // Scroll parallax
    this._scrollHandler = null;
    this._scrollResetTimer = null;

    // Iris transformations
    this._irisOverlay = null;
    this._irisTimer = null;
    this._clockInterval = null;

    // Sleep on element
    this._sleepOnElementActive = false;
    this._sleepWakeHandler = null;

    // Constellation
    this._constellationSvg = null;

    // Shadow puppet
    this._puppetActive = false;

    // Event hooks
    this._hooks = [];
  }

  init() {
    if (this._initialized) return;
    this._initialized = true;

    // Wire into Dave Mode's idle cycle
    document.addEventListener('dave:idle', () => this._onIdleCycle());

    // Activity tracking events
    this._installActivityHooks();

    // Scroll parallax
    this._installScrollParallax();

    // Fullscreen tracking for deep dive detection
    document.addEventListener('dave:fullscreen', () => {
      this._fullscreenStartTime = Date.now();
    });
    document.addEventListener('dave:fullscreenExit', () => {
      if (this._fullscreenStartTime) {
        const duration = Date.now() - this._fullscreenStartTime;
        if (duration > 30000) {
          this._logActivity('deepDive');
        }
        this._fullscreenStartTime = 0;
      }
    });

    console.log('[DaveAlive] Initialized');
  }

  get trailEngine() { return this._trailEngine; }

  /**
   * Reset all behavior flags and movement state. Called on error recovery
   * to prevent Dave from getting permanently stuck.
   */
  _resetAllFlags() {
    this._trailEngine._isMoving = false;
    this._heartActive = false;
    this._spiralActive = false;
    this._sleepOnElementActive = false;
    this._puppetActive = false;
    this._morseActive = false;
    // Restore ambient state
    const p = DaveMode._presenceEl;
    if (p) {
      p.classList.remove('dave-alive-moving');
      if (!DaveMode._isDragging) p.classList.add('dave-ambient');
    }
    // Restore cursor follow in case an iris effect was active
    if (this._irisOverlay) {
      this._irisOverlay.remove();
      this._irisOverlay = null;
      this._exitIrisEffect();
    }
    clearTimeout(this._irisTimer);
    clearInterval(this._clockInterval);
    // Clean up any lingering DOM elements
    document.querySelectorAll('.dave-heart-particle, .dave-sub-drip, .dave-sub-drip-short, .dave-spiral-particle, .dave-puppet-screen').forEach(el => el.remove());
    this._trailEngine.cleanupTrail();
    DaveMode._startCursorFollow?.();
  }

  /**
   * Safely run an async behavior. If it throws, reset all flags and log the error.
   * Prevents a single behavior failure from bricking Dave for the rest of the session.
   */
  _safeRun(fn) {
    Promise.resolve().then(() => fn()).catch(err => {
      console.error('[DaveAlive] Behavior error, resetting state:', err);
      this._resetAllFlags();
    });
  }

  // ============================================================
  //  Feature 1: Phased Idle Nagging
  // ============================================================

  _onIdleCycle() {
    if (!DaveMode._enabled || !DaveMode._presenceEl) return;
    this._idleCycleCount++;

    // Dispatch to alive behaviors with probability checks
    // Priority: behaviors first, then nagging messages
    if (this._tryAliveBehavior()) return;

    // Fall through to nagging
    this._showIdleNag();
  }

  _showIdleNag() {
    // 30% chance of generic message for unpredictability
    if (Math.random() < 0.3) {
      const msg = this._pickFromPool(IDLE_GENERIC);
      if (msg) DaveMode._showBubble(msg, { force: true, emotion: EMOTION.EXISTENTIAL });
      return;
    }

    let pool;
    if (this._idleCycleCount <= 2) {
      pool = IDLE_PHASE_1;
    } else if (this._idleCycleCount <= 4) {
      pool = IDLE_PHASE_2;
    } else {
      pool = IDLE_PHASE_3;
    }

    const msg = this._pickFromPool(pool);
    if (msg) {
      const emotion = this._idleCycleCount <= 2 ? EMOTION.EXISTENTIAL
        : this._idleCycleCount <= 4 ? EMOTION.WARM : EMOTION.SASSY;
      DaveMode._showBubble(msg, { force: true, emotion });
    }
  }

  resetIdleCycles() {
    this._idleCycleCount = 0;
  }


  // ============================================================
  //  Feature 2: Active User Congratulations
  // ============================================================

  _installActivityHooks() {
    const on = (evt, handler) => {
      const bound = (e) => handler(e.detail || {});
      document.addEventListener(evt, bound);
      this._hooks.push({ evt, bound });
    };

    on('dave:pageRender', () => this._logActivity('pageNav'));
    on('dave:filter', () => this._logActivity('filter'));
    on('dave:search', (d) => {
      if (d.term) {
        this._logActivity('search');
        // Radar sweep while searching — 30% chance, 10s cooldown
        if (!this._irisOverlay && Math.random() < 0.3 &&
            Date.now() - (this._lastSearchRadar || 0) > 10000) {
          this._lastSearchRadar = Date.now();
          this.triggerRadarSweep(3000);
        }
      }
    });

    // Periodically check for activity patterns
    this._activityCheckInterval = setInterval(() => this._checkActivityPatterns(), 5000);
  }

  _logActivity(type) {
    this._activityLog.push({ type, time: Date.now() });
    // Prune entries older than 60s
    const cutoff = Date.now() - 60000;
    this._activityLog = this._activityLog.filter(a => a.time > cutoff);
    // Reset idle cycles on any user action
    this._idleCycleCount = 0;
  }

  _checkActivityPatterns() {
    if (!DaveMode._enabled) return;
    const now = Date.now();
    if (now - this._lastActivityReaction < this._activityCooldownMs) return;

    const recent30s = this._activityLog.filter(a => now - a.time < 30000);
    const recent20s = this._activityLog.filter(a => now - a.time < 20000);
    const recent60s = this._activityLog.filter(a => now - a.time < 60000);

    // Rapid browsing: 5+ page navs in 30s
    const pageNavs = recent30s.filter(a => a.type === 'pageNav');
    if (pageNavs.length >= 5) {
      this._congratulate(ACTIVITY_RAPID_BROWSE);
      return;
    }

    // Heavy filtering: 3+ filter changes in 20s
    const filters = recent20s.filter(a => a.type === 'filter');
    if (filters.length >= 3) {
      this._congratulate(ACTIVITY_HEAVY_FILTER);
      return;
    }

    // Search streak: 3+ searches in 60s
    const searches = recent60s.filter(a => a.type === 'search');
    if (searches.length >= 3) {
      this._congratulate(ACTIVITY_SEARCH_STREAK);
      return;
    }

    // Deep dive: handled by fullscreen exit event
    const deepDives = recent60s.filter(a => a.type === 'deepDive');
    if (deepDives.length > 0) {
      this._congratulate(ACTIVITY_DEEP_DIVE);
      return;
    }
  }

  _congratulate(pool) {
    this._lastActivityReaction = Date.now();
    const msg = this._pickFromPool(pool);
    if (msg) DaveMode._showBubble(msg, { force: true, emotion: EMOTION.IMPRESSED ? EMOTION.AMUSED : EMOTION.AMUSED });
  }


  // ============================================================
  //  Feature 3: Morse Code Blinking
  // ============================================================

  triggerMorse() {
    if (this._morseActive || !DaveMode._irisEl || !DaveMode._presenceEl) return;
    this._morseActive = true;

    const word = MORSE_WORDS[Math.floor(Math.random() * MORSE_WORDS.length)];

    // Build sequence of {type, duration} for clearer playback
    const sequence = [];
    for (const char of word) {
      const code = MORSE[char];
      if (!code) continue;
      for (const symbol of code) {
        sequence.push({ type: symbol === '.' ? 'dot' : 'dash', duration: symbol === '.' ? 150 : 400 });
        sequence.push({ type: 'gap', duration: 150 }); // inter-element gap
      }
      sequence.push({ type: 'charGap', duration: 400 }); // inter-character gap
    }

    // Create visual morse indicator near Dave
    const indicator = document.createElement('div');
    indicator.className = 'dave-morse-indicator';
    document.body.appendChild(indicator);

    // Position near Dave
    const positionIndicator = () => {
      if (!DaveMode._presenceEl) return;
      const r = DaveMode._presenceEl.getBoundingClientRect();
      indicator.style.left = (r.left + r.width / 2) + 'px';
      indicator.style.top = (r.top - 28) + 'px';
    };
    positionIndicator();

    // Display accumulates dots and dashes
    let display = '';
    let charIdx = 0;

    let idx = 0;
    const playNext = () => {
      if (idx >= sequence.length || !DaveMode._irisEl) {
        this._morseActive = false;
        // Show decoded word briefly
        indicator.textContent = word;
        indicator.classList.add('dave-morse-indicator-reveal');
        setTimeout(() => {
          indicator.classList.add('dave-morse-indicator-fading');
          setTimeout(() => indicator.remove(), 800);
        }, 2000);
        return;
      }

      const item = sequence[idx++];
      positionIndicator();

      if (item.type === 'charGap') {
        display += '  ';
        indicator.textContent = display;
        setTimeout(playNext, item.duration);
      } else if (item.type === 'gap') {
        setTimeout(playNext, item.duration);
      } else {
        // dot or dash — blink iris AND show visual symbol
        const symbol = item.type === 'dot' ? '\u00B7' : '\u2014';
        display += symbol;
        indicator.textContent = display;

        DaveMode._irisEl.classList.add('dave-morse-blink');
        setTimeout(() => {
          DaveMode._irisEl?.classList.remove('dave-morse-blink');
          setTimeout(playNext, 60);
        }, item.duration);
      }
    };

    playNext();
  }


  // ============================================================
  //  Feature 4: Scroll Parallax Reaction
  // ============================================================

  _installScrollParallax() {
    this._scrollHandler = (e) => {
      if (!DaveMode._enabled || !DaveMode._presenceEl || DaveMode._isDragging) return;
      if (this._trailEngine.isMoving) return;

      const deltaY = e.deltaY;
      const offset = Math.min(Math.abs(deltaY) * 0.05, 8);
      const direction = deltaY > 0 ? -1 : 1; // opposite to scroll

      const eye = DaveMode._presenceEl.querySelector('.dave-presence-eye');
      if (eye) {
        eye.style.transform = `translateY(${direction * offset}px)`;
        DaveMode._presenceEl.classList.add('dave-scroll-reacting');

        clearTimeout(this._scrollResetTimer);
        this._scrollResetTimer = setTimeout(() => {
          eye.style.transform = '';
          DaveMode._presenceEl?.classList.remove('dave-scroll-reacting');
        }, 300);
      }

      // Extreme scroll comment (20% chance for deltaY > 500)
      if (Math.abs(deltaY) > 500 && Math.random() < 0.2) {
        const now = Date.now();
        if (now - this._lastActivityReaction > 10000) {
          this._lastActivityReaction = now;
          DaveMode._showBubble("*grabs edge* SLOW DOWN.", { force: true, emotion: EMOTION.ALARMED });
        }
      }
    };

    window.addEventListener('wheel', this._scrollHandler, { passive: true });
  }


  // ============================================================
  //  Feature 5: Iris Transformations
  // ============================================================

  /**
   * Enter iris-effect mode: enlarge eye via scale, stop cursor follow, expand iris.
   * Returns the eye element for appending overlays.
   */
  _enterIrisEffect() {
    if (!DaveMode._irisEl) return null;
    const eyeEl = DaveMode._irisEl.parentElement;
    if (!eyeEl) return null;

    // Stop cursor following so iris is centered
    DaveMode._stopCursorFollow?.();
    DaveMode._irisEl.classList.remove('dave-cursor-follow');
    DaveMode._irisEl.style.transform = '';

    // Remove any lingering shrink classes from previous effect
    eyeEl.classList.remove('dave-eye-shrinking');
    DaveMode._irisEl.classList.remove('dave-iris-shrinking');

    // Enlarge eye (scale) + iris (width/height) via CSS classes
    eyeEl.classList.add('dave-eye-enlarged');
    DaveMode._irisEl.classList.add('dave-iris-enlarged');

    return eyeEl;
  }

  /**
   * Exit iris-effect mode: smooth shrink-back, then restore cursor follow.
   */
  _exitIrisEffect() {
    if (!DaveMode._irisEl) return;
    const eyeEl = DaveMode._irisEl.parentElement;

    // Swap to shrinking classes for smooth return animation
    eyeEl?.classList.remove('dave-eye-enlarged');
    DaveMode._irisEl.classList.remove('dave-iris-enlarged');
    eyeEl?.classList.add('dave-eye-shrinking');
    DaveMode._irisEl.classList.add('dave-iris-shrinking');

    // After shrink animation completes, clean up and restore
    setTimeout(() => {
      eyeEl?.classList.remove('dave-eye-shrinking');
      DaveMode._irisEl?.classList.remove('dave-iris-shrinking');
      DaveMode._resumeIrisScan?.();
      DaveMode._startCursorFollow?.();
    }, 450);
  }

  triggerRadarSweep(durationMs = 5000) {
    if (this._irisOverlay || !DaveMode._irisEl) return;

    const eyeEl = this._enterIrisEffect();
    if (!eyeEl) return;

    // Build radar: container > grid + sweep
    const container = document.createElement('div');
    container.className = 'dave-iris-radar-container';

    const grid = document.createElement('div');
    grid.className = 'dave-iris-radar-grid';
    container.appendChild(grid);

    const sweep = document.createElement('div');
    sweep.className = 'dave-iris-radar-sweep';
    container.appendChild(sweep);

    eyeEl.appendChild(container);
    this._irisOverlay = container;

    // Spawn pings at random positions every 1-2s
    const spawnPing = () => {
      const ping = document.createElement('div');
      ping.className = 'dave-iris-radar-ping';
      // Random position within the radar circle (polar coords -> cartesian)
      const angle = Math.random() * Math.PI * 2;
      const dist = 2 + Math.random() * 7; // 2-9px from center
      ping.style.left = (11 + dist * Math.cos(angle) - 1) + 'px';
      ping.style.top = (11 + dist * Math.sin(angle) - 1) + 'px';
      container.appendChild(ping);
      setTimeout(() => ping.remove(), 1500);
    };

    // First ping after a short delay, then periodic
    const firstPingTimer = setTimeout(spawnPing, 600);
    const pingInterval = setInterval(spawnPing, 1200 + Math.random() * 800);

    this._irisTimer = setTimeout(() => {
      clearTimeout(firstPingTimer);
      clearInterval(pingInterval);
      container.remove();
      this._exitIrisEffect();
      this._irisOverlay = null;
      this._irisTimer = null;
    }, durationMs);
  }

  triggerClockMode() {
    if (this._irisOverlay || !DaveMode._irisEl) return;

    const eyeEl = this._enterIrisEffect();
    if (!eyeEl) return;

    // Clock face container
    const face = document.createElement('div');
    face.className = 'dave-iris-clock-face';

    // 12 hour tick marks (built as tiny span elements)
    for (let i = 0; i < 12; i++) {
      const tick = document.createElement('span');
      tick.className = i % 3 === 0 ? 'dave-iris-clock-tick-major' : 'dave-iris-clock-tick';
      tick.style.transform = `rotate(${i * 30}deg)`;
      face.appendChild(tick);
    }

    const now = new Date();

    // Hour hand
    const hourAngle = ((now.getHours() % 12) / 12) * 360 + (now.getMinutes() / 60) * 30;
    const hourHand = document.createElement('div');
    hourHand.className = 'dave-iris-clock-hour';
    hourHand.style.transform = `rotate(${hourAngle}deg)`;
    face.appendChild(hourHand);

    // Minute hand
    const minuteAngle = (now.getMinutes() / 60) * 360 + (now.getSeconds() / 60) * 6;
    const minuteHand = document.createElement('div');
    minuteHand.className = 'dave-iris-clock-minute';
    minuteHand.style.transform = `rotate(${minuteAngle}deg)`;
    face.appendChild(minuteHand);

    // Seconds hand
    const secondAngle = (now.getSeconds() / 60) * 360;
    const secondHand = document.createElement('div');
    secondHand.className = 'dave-iris-clock-second';
    secondHand.style.transform = `rotate(${secondAngle}deg)`;
    face.appendChild(secondHand);

    eyeEl.appendChild(face);
    this._irisOverlay = face;

    // Tick all hands every second
    this._clockInterval = setInterval(() => {
      const t = new Date();
      const sAngle = (t.getSeconds() / 60) * 360;
      const mAngle = (t.getMinutes() / 60) * 360 + (t.getSeconds() / 60) * 6;
      const hAngle = ((t.getHours() % 12) / 12) * 360 + (t.getMinutes() / 60) * 30;
      secondHand.style.transform = `rotate(${sAngle}deg)`;
      minuteHand.style.transform = `rotate(${mAngle}deg)`;
      hourHand.style.transform = `rotate(${hAngle}deg)`;
    }, 1000);

    this._irisTimer = setTimeout(() => {
      clearInterval(this._clockInterval);
      this._clockInterval = null;
      face.remove();
      this._exitIrisEffect();
      this._irisOverlay = null;
      this._irisTimer = null;
    }, 5000);
  }

  triggerCompassMode(targetX, targetY) {
    if (this._irisOverlay || !DaveMode._irisEl) return;

    const eyeEl = this._enterIrisEffect();
    if (!eyeEl) return;

    const needle = document.createElement('div');
    needle.className = 'dave-iris-compass';
    eyeEl.appendChild(needle);
    this._irisOverlay = needle;

    // Point needle toward target
    const eyePos = DaveMode._getEyeBasePos();
    const dx = targetX - eyePos.x;
    const dy = targetY - eyePos.y;
    const angle = Math.atan2(dx, -dy) * (180 / Math.PI);
    needle.style.transform = `rotate(${angle}deg)`;

    this._irisTimer = setTimeout(() => {
      needle.remove();
      this._exitIrisEffect();
      this._irisOverlay = null;
      this._irisTimer = null;
    }, 8000);
  }


  // ============================================================
  //  Feature 6: Element Inspection
  // ============================================================

  async triggerInspection() {
    if (this._trailEngine.isMoving || !DaveMode._enabled || !DaveMode._presenceEl) return;
    if (Date.now() - this._lastInspection < this._inspectionCooldownMs) return;

    const target = this._pickInspectionTarget();
    if (!target) return;

    this._lastInspection = Date.now();
    const targetRect = target.el.getBoundingClientRect();
    const targetX = targetRect.left + targetRect.width / 2 - 16;
    const targetY = targetRect.top - 40; // Float above target

    // Save origin
    const p = DaveMode._presenceEl;
    const originX = parseFloat(p.style.left) || (window.innerWidth - 52);
    const originY = parseFloat(p.style.top) || (window.innerHeight - 52);

    // Ensure in absolute positioning mode
    if (!p.classList.contains('dave-dragged')) {
      DaveMode._applyPosition(originX, originY);
    }

    p.classList.remove('dave-ambient');
    p.classList.add('dave-alive-moving');

    // Fly to target
    await this._trailEngine.animateMoveTo(targetX, targetY, 800);

    // Point iris at element
    this.triggerCompassMode(targetRect.left + targetRect.width / 2, targetRect.top + targetRect.height / 2);

    // Add highlight glow
    const highlight = document.createElement('div');
    highlight.className = 'dave-inspect-highlight';
    highlight.style.left = targetRect.left - 4 + 'px';
    highlight.style.top = targetRect.top - 4 + 'px';
    highlight.style.width = targetRect.width + 8 + 'px';
    highlight.style.height = targetRect.height + 8 + 'px';
    document.body.appendChild(highlight);

    // Show comment
    const messages = INSPECT_MESSAGES[target.key] || INSPECT_MESSAGES.empty;
    const msg = messages[Math.floor(Math.random() * messages.length)];
    DaveMode._showBubble(msg, { force: true, emotion: EMOTION.CURIOUS });

    // Wait for reading
    await this._wait(4000);

    // Clean up
    highlight.remove();
    if (this._irisOverlay) {
      this._irisOverlay.remove();
      this._irisOverlay = null;
      this._exitIrisEffect();
      clearTimeout(this._irisTimer);
    }

    // Fly back
    await this._trailEngine.animateMoveTo(originX, originY, 600);

    p.classList.remove('dave-alive-moving');
    if (!DaveMode._isDragging) p.classList.add('dave-ambient');
    DaveMode._savePosition(originX, originY);
  }

  _pickInspectionTarget() {
    const candidates = [
      { sel: '#searchInput', key: 'search' },
      { sel: '#sortOptions', key: 'sort' },
      { sel: '.filter-toggle', key: 'filter' },
      { sel: '.model-tile', key: 'tile' },
      { sel: '#pageInfo', key: 'pageInfo' },
      { sel: '.logo, #appTitle, h1', key: 'logo' },
      { sel: '#sizeSlider, .size-slider', key: 'sizeSlider' },
    ];

    const valid = [];
    for (const c of candidates) {
      const el = document.querySelector(c.sel);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 &&
            rect.top >= 0 && rect.bottom <= window.innerHeight) {
          valid.push({ el, key: c.key });
        }
      }
    }

    if (valid.length === 0) return null;
    return valid[Math.floor(Math.random() * valid.length)];
  }


  // ============================================================
  //  Feature 7: Post-It Notes
  // ============================================================

  triggerPostIt() {
    if (this._postItCount >= this._maxPostIts) return;
    if (!DaveMode._enabled) return;

    const target = this._pickInspectionTarget();
    if (!target) return;

    const messages = POSTIT_MESSAGES[target.key] || POSTIT_MESSAGES.tile;
    const msg = messages[Math.floor(Math.random() * messages.length)];

    const rect = target.el.getBoundingClientRect();
    const tilt = (Math.random() - 0.5) * 6; // -3 to +3 deg tilt

    const note = document.createElement('div');
    note.className = 'dave-postit';
    note.style.left = (rect.right + 5) + 'px';
    note.style.top = (rect.top - 10) + 'px';
    note.style.transform = `rotate(${tilt}deg)`;
    note.innerHTML = msg.replace(/\n/g, '<br>');
    document.body.appendChild(note);

    this._postItCount++;

    requestAnimationFrame(() => note.classList.add('dave-postit-visible'));

    // Linger 15-20s then fade
    const linger = 15000 + Math.random() * 5000;
    setTimeout(() => {
      note.classList.remove('dave-postit-visible');
      note.classList.add('dave-postit-fading');
      setTimeout(() => {
        note.remove();
        this._postItCount--;
      }, 1000);
    }, linger);
  }


  // ============================================================
  //  Feature 8: Figure-8 Patrol
  // ============================================================

  async triggerPatrol() {
    if (this._trailEngine.isMoving || !DaveMode._enabled || !DaveMode._presenceEl) return;

    const p = DaveMode._presenceEl;
    const originX = parseFloat(p.style.left) || (window.innerWidth - 52);
    const originY = parseFloat(p.style.top) || (window.innerHeight - 52);

    if (!p.classList.contains('dave-dragged')) {
      DaveMode._applyPosition(originX, originY);
    }

    DaveMode._showBubble("Security patrol. Stand aside.", { force: true, emotion: EMOTION.SMUG });

    // Generate Lissajous figure-8 waypoints
    const A = 80; // x amplitude
    const B = 50; // y amplitude
    const cx = originX;
    const cy = originY - 60; // patrol area above Dave
    const waypoints = [];
    const steps = 60;

    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      waypoints.push({
        x: cx + A * Math.sin(t),
        y: cy + B * Math.sin(2 * t),
      });
    }

    p.classList.remove('dave-ambient');
    p.classList.add('dave-alive-moving', 'dave-dragged');

    // Manually animate with patrol trail
    let wpIdx = 0;
    let currentX = originX;
    let currentY = originY;
    const speed = 40; // px/sec — lazy patrol
    let lastTime = performance.now();
    let lastTrail = performance.now();

    await new Promise((resolve) => {
      const step = (now) => {
        if (!DaveMode._presenceEl || !DaveMode._enabled) { resolve(); return; }
        const dt = (now - lastTime) / 1000;
        lastTime = now;

        if (wpIdx >= waypoints.length) { resolve(); return; }

        const target = waypoints[wpIdx];
        const dx = target.x - currentX;
        const dy = target.y - currentY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const moveDist = speed * dt;

        if (dist <= moveDist) {
          currentX = target.x;
          currentY = target.y;
          wpIdx++;
        } else {
          currentX += (dx / dist) * moveDist;
          currentY += (dy / dist) * moveDist;
        }

        const clamped = clampToViewport(currentX, currentY);
        currentX = clamped.x;
        currentY = clamped.y;
        DaveMode._applyPosition(currentX, currentY);
        DaveMode._updateBubblePosition?.();

        // Sparse trail every 200ms
        if (now - lastTrail > 200) {
          lastTrail = now;
          const el = document.createElement('span');
          el.className = 'dave-patrol-trail-char';
          el.textContent = TRAIL_CHARS[Math.floor(Math.random() * TRAIL_CHARS.length)];
          el.style.left = (currentX + 16) + 'px';
          el.style.top = (currentY + 16) + 'px';
          document.body.appendChild(el);
          setTimeout(() => {
            el.style.transition = 'opacity 1s ease-out';
            el.style.opacity = '0';
            setTimeout(() => el.remove(), 1000);
          }, 500);
        }

        // 360 iris scan at crossing point (halfway)
        if (wpIdx === Math.floor(steps / 2)) {
          const iris = DaveMode._irisEl;
          if (iris && !iris.style.getPropertyValue('--patrol-scanned')) {
            iris.style.setProperty('--patrol-scanned', '1');
            // Quick spin via transform
            iris.style.transition = 'transform 0.6s ease';
            iris.style.transform = 'rotate(360deg)';
            setTimeout(() => {
              iris.style.transition = '';
              iris.style.transform = '';
              iris.style.removeProperty('--patrol-scanned');
            }, 700);
          }
        }

        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });

    // Return to origin
    await this._trailEngine.animateMoveTo(originX, originY, 600);

    p.classList.remove('dave-alive-moving');
    if (!DaveMode._isDragging) p.classList.add('dave-ambient');
    DaveMode._savePosition(originX, originY);

    DaveMode._showBubble("All clear. No unauthorized pixels detected.", { force: true, emotion: EMOTION.SMUG });
  }


  // ============================================================
  //  Feature 9: Sleeping on Elements
  // ============================================================

  async triggerSleepOnElement() {
    if (this._trailEngine.isMoving || this._sleepOnElementActive) return;
    if (!DaveMode._enabled || !DaveMode._presenceEl) return;

    const target = this._pickInspectionTarget();
    if (!target) return;

    this._sleepOnElementActive = true;
    const p = DaveMode._presenceEl;
    const originX = parseFloat(p.style.left) || (window.innerWidth - 52);
    const originY = parseFloat(p.style.top) || (window.innerHeight - 52);

    if (!p.classList.contains('dave-dragged')) {
      DaveMode._applyPosition(originX, originY);
    }

    const rect = target.el.getBoundingClientRect();
    const perchX = rect.left + rect.width / 2 - 16;
    const perchY = rect.top - 35;

    p.classList.remove('dave-ambient');
    p.classList.add('dave-alive-moving', 'dave-dragged');

    // Fly to perch
    await this._trailEngine.animateMoveTo(perchX, perchY, 800);
    p.classList.remove('dave-alive-moving');

    // Squash settle
    const eye = p.querySelector('.dave-presence-eye');
    if (eye) {
      eye.style.transition = 'transform 0.3s ease';
      eye.style.transform = 'scaleY(0.7) scaleX(1.1)';
      setTimeout(() => {
        eye.style.transform = 'scaleY(0.85) scaleX(1.05)';
      }, 300);
    }

    // Enter sleep mode
    DaveMode._resumeIrisScan();
    DaveMode._stopCursorFollow();

    // Floating Z characters
    let zzzInterval = setInterval(() => {
      if (!this._sleepOnElementActive) { clearInterval(zzzInterval); return; }
      const pRect = p.getBoundingClientRect();
      const sizes = [10, 14, 18];
      sizes.forEach((size, i) => {
        setTimeout(() => {
          const z = document.createElement('span');
          z.className = 'dave-alive-zzz';
          z.textContent = 'Z';
          z.style.left = (pRect.left + pRect.width / 2 + (Math.random() - 0.5) * 15) + 'px';
          z.style.top = (pRect.top - 5) + 'px';
          z.style.fontSize = size + 'px';
          z.style.setProperty('--zzz-drift', ((Math.random() - 0.5) * 20) + 'px');
          document.body.appendChild(z);
          setTimeout(() => z.remove(), 2500);
        }, i * 400);
      });
    }, 2000);

    // First set of Z's immediately
    const pRect = p.getBoundingClientRect();
    [10, 14, 18].forEach((size, i) => {
      setTimeout(() => {
        const z = document.createElement('span');
        z.className = 'dave-alive-zzz';
        z.textContent = 'Z';
        z.style.left = (pRect.left + pRect.width / 2 + (Math.random() - 0.5) * 15) + 'px';
        z.style.top = (pRect.top - 5) + 'px';
        z.style.fontSize = size + 'px';
        z.style.setProperty('--zzz-drift', ((Math.random() - 0.5) * 20) + 'px');
        document.body.appendChild(z);
        setTimeout(() => z.remove(), 2500);
      }, i * 400);
    });

    // Wake on any interaction
    const wake = () => {
      if (!this._sleepOnElementActive) return;
      this._sleepOnElementActive = false;
      clearInterval(zzzInterval);

      if (eye) {
        eye.style.transform = '';
        setTimeout(() => { eye.style.transition = ''; }, 500);
      }

      DaveMode._startCursorFollow();
      DaveMode._showBubble("*hop* Hm?! I was reviewing those files! ...in my mind!", { force: true, emotion: EMOTION.ALARMED });

      // Return to origin
      this._trailEngine.animateMoveTo(originX, originY, 600).then(() => {
        p.classList.remove('dave-alive-moving');
        if (!DaveMode._isDragging) p.classList.add('dave-ambient');
        DaveMode._savePosition(originX, originY);
      });
    };

    this._sleepWakeHandler = wake;
    document.addEventListener('click', wake, { once: true });
    document.addEventListener('keydown', wake, { once: true });
    DaveMode._presenceEl?.addEventListener('mousedown', wake, { once: true });

    // Auto-wake after 20s
    setTimeout(() => {
      if (this._sleepOnElementActive) wake();
    }, 20000);
  }


  // ============================================================
  //  Feature 10: Heart Trail
  // ============================================================

  async triggerHeartTrail() {
    if (this._trailEngine.isMoving || this._heartActive) return;
    if (!DaveMode._enabled || !DaveMode._presenceEl) return;
    this._heartActive = true;
    this._trailEngine._isMoving = true;

    const p = DaveMode._presenceEl;
    const originX = parseFloat(p.style.left) || (window.innerWidth - 52);
    const originY = parseFloat(p.style.top) || (window.innerHeight - 52);

    if (!p.classList.contains('dave-dragged')) {
      DaveMode._applyPosition(originX, originY);
    }

    // Heart center = Dave's current position
    const hcx = originX;
    const hcy = originY;
    const scale = 4;

    const waypoints = [];
    const steps = 80;
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const x = 16 * Math.pow(Math.sin(t), 3);
      const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
      waypoints.push({ x: hcx + x * scale, y: hcy + y * scale });
    }

    DaveMode._setEmotion(EMOTION.WARM);
    DaveMode._showBubble("Watch this...", { force: true, emotion: EMOTION.WARM });
    await this._wait(500);

    // Dave draws the heart over 2s
    // Each trail particle STAYS in place and continuously bleeds sub-drip particles
    const heartParticles = [];
    const dripIntervals = [];
    const totalDuration = 2000;
    const startTime = performance.now();
    let lastTrailTime = 0;

    p.classList.remove('dave-ambient');
    p.classList.add('dave-alive-moving', 'dave-dragged');

    await new Promise((resolve) => {
      const step = (now) => {
        if (!DaveMode._presenceEl || !DaveMode._enabled) { resolve(); return; }

        const elapsed = now - startTime;
        const progress = Math.min(elapsed / totalDuration, 1);

        const wpFloat = progress * steps;
        const wpIdx = Math.min(Math.floor(wpFloat), steps - 1);
        const wpFrac = wpFloat - wpIdx;
        const a = waypoints[wpIdx];
        const b = waypoints[Math.min(wpIdx + 1, steps)] || a;
        let cx = a.x + (b.x - a.x) * wpFrac;
        let cy = a.y + (b.y - a.y) * wpFrac;

        const clamped = clampToViewport(cx, cy);
        cx = clamped.x;
        cy = clamped.y;
        DaveMode._applyPosition(cx, cy);
        DaveMode._updateBubblePosition?.();

        // Spawn heart particle every ~35ms — stays in place, bleeds drips
        if (now - lastTrailTime > 35) {
          lastTrailTime = now;
          const el = document.createElement('span');
          el.className = 'dave-heart-particle';
          el.textContent = HEART_CHARS[Math.floor(Math.random() * HEART_CHARS.length)];
          const px = cx + 16 + (Math.random() - 0.5) * 6;
          const py = cy + 16 + (Math.random() - 0.5) * 6;
          el.style.left = px + 'px';
          el.style.top = py + 'px';
          document.body.appendChild(el);
          heartParticles.push(el);

          // Each particle bleeds sub-drip chars downward
          const dripId = setInterval(() => {
            const drip = document.createElement('span');
            drip.className = 'dave-sub-drip';
            drip.textContent = HEART_CHARS[Math.floor(Math.random() * HEART_CHARS.length)];
            drip.style.left = (px + (Math.random() - 0.5) * 8) + 'px';
            drip.style.top = py + 'px';
            drip.style.setProperty('--sub-drip-dist', (15 + Math.random() * 20) + 'px');
            document.body.appendChild(drip);
            setTimeout(() => drip.remove(), 1200);
          }, 280);
          dripIntervals.push(dripId);
        }

        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          resolve();
        }
      };
      requestAnimationFrame(step);
    });

    // Heart complete — stop bleeding, hold for a beat
    dripIntervals.forEach(id => clearInterval(id));
    await this._wait(600);

    // All main particles drip down and fade
    heartParticles.forEach(el => {
      el.style.setProperty('--fall-dist', (25 + Math.random() * 20) + 'px');
      el.classList.add('dave-heart-particle-fall');
    });

    // Return Dave to origin
    this._trailEngine._isMoving = false;
    p.classList.remove('dave-alive-moving');
    await this._trailEngine.animateMoveTo(originX, originY, 500);
    if (!DaveMode._isDragging) p.classList.add('dave-ambient');
    DaveMode._savePosition(originX, originY);

    DaveMode._showBubble("For you.", { force: true, emotion: EMOTION.WARM });

    // Cleanup after fall animation
    await this._wait(2000);
    heartParticles.forEach(el => el.remove());
    document.querySelectorAll('.dave-heart-particle, .dave-sub-drip').forEach(el => el.remove());
    this._heartActive = false;
  }


  // ============================================================
  //  Feature 11: Spiral-to-Fireworks
  // ============================================================

  async triggerSpiralFireworks() {
    if (this._trailEngine.isMoving || this._spiralActive || !DaveMode._enabled || !DaveMode._presenceEl) return;
    this._spiralActive = true;
    this._trailEngine._isMoving = true;

    const p = DaveMode._presenceEl;
    const originX = parseFloat(p.style.left) || (window.innerWidth - 52);
    const originY = parseFloat(p.style.top) || (window.innerHeight - 52);

    if (!p.classList.contains('dave-dragged')) {
      DaveMode._applyPosition(originX, originY);
    }

    // Smaller spiral: outside->inside, counterclockwise on screen
    const maxRadius = 100;
    const centerX = originX;
    const centerY = originY - maxRadius;
    const startAngle = Math.PI / 2; // first point = Dave's position

    const waypoints = [];
    const steps = 80;
    for (let i = 0; i <= steps; i++) {
      const progress = i / steps;
      const t = startAngle + progress * Math.PI * 6; // 3 rotations
      const r = maxRadius * (1 - progress);
      waypoints.push({
        x: centerX + r * Math.cos(t),
        y: centerY + r * Math.sin(t),
      });
    }

    const charSets = [
      ['\u00B7', '+'],
      ['+', '\u2726'],
      ['\u2726', '\u2605'],
      ['\u2605', '\u2605'],
    ];

    DaveMode._setEmotion(EMOTION.PROUD);
    p.classList.remove('dave-ambient');
    p.classList.add('dave-alive-moving', 'dave-dragged');

    // 1.5s spiral with bleeding drip trail (same as heart but shorter drips)
    const trailEls = [];
    const dripIntervals = [];
    const totalDuration = 1500;
    const startTime = performance.now();
    let lastTrailTime = 0;

    await new Promise((resolve) => {
      const step = (now) => {
        if (!DaveMode._presenceEl || !DaveMode._enabled) { resolve(); return; }

        const elapsed = now - startTime;
        const progress = Math.min(elapsed / totalDuration, 1);

        const wpFloat = progress * steps;
        const wpIdx = Math.min(Math.floor(wpFloat), steps - 1);
        const wpFrac = wpFloat - wpIdx;
        const a = waypoints[wpIdx];
        const b = waypoints[Math.min(wpIdx + 1, steps)] || a;
        let cx = a.x + (b.x - a.x) * wpFrac;
        let cy = a.y + (b.y - a.y) * wpFrac;

        const clamped = clampToViewport(cx, cy);
        cx = clamped.x;
        cy = clamped.y;
        DaveMode._applyPosition(cx, cy);
        DaveMode._updateBubblePosition?.();

        // Spawn trail char every ~15ms — dense trail, stays in place, bleeds short drips
        if (now - lastTrailTime > 15) {
          lastTrailTime = now;
          const charSet = charSets[Math.min(Math.floor(progress * 4), 3)];
          const el = document.createElement('span');
          el.className = 'dave-spiral-particle';
          el.textContent = charSet[Math.floor(Math.random() * charSet.length)];
          const px = cx + 16 + (Math.random() - 0.5) * 6;
          const py = cy + 16 + (Math.random() - 0.5) * 6;
          el.style.left = px + 'px';
          el.style.top = py + 'px';
          document.body.appendChild(el);
          trailEls.push(el);

          // Short bleeding drips from each particle
          const dripId = setInterval(() => {
            const drip = document.createElement('span');
            drip.className = 'dave-sub-drip dave-sub-drip-short';
            drip.textContent = charSet[Math.floor(Math.random() * charSet.length)];
            drip.style.left = (px + (Math.random() - 0.5) * 6) + 'px';
            drip.style.top = py + 'px';
            drip.style.setProperty('--sub-drip-dist', (10 + Math.random() * 12) + 'px');
            document.body.appendChild(drip);
            setTimeout(() => drip.remove(), 800);
          }, 350);
          dripIntervals.push(dripId);
        }

        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          resolve();
        }
      };
      requestAnimationFrame(step);
    });

    // Stop all bleeding drips
    dripIntervals.forEach(id => clearInterval(id));

    // Dave is at center — BOOM!
    await this._wait(100);
    DaveMode._triggerFireworks();
    DaveMode._showBubble("BOOM.", { force: true, emotion: EMOTION.PROUD });

    // Pulse trail then fade
    trailEls.forEach(el => el.classList.add('dave-spiral-particle-pulse'));

    // Return Dave to origin
    await this._wait(300);
    this._trailEngine._isMoving = false;
    p.classList.remove('dave-alive-moving');
    await this._trailEngine.animateMoveTo(originX, originY, 400);
    if (!DaveMode._isDragging) p.classList.add('dave-ambient');
    DaveMode._savePosition(originX, originY);

    // Aggressive cleanup
    await this._wait(800);
    trailEls.forEach(el => el.remove());
    document.querySelectorAll('.dave-spiral-particle, .dave-sub-drip, .dave-sub-drip-short').forEach(el => el.remove());
    this._trailEngine.cleanupTrail();
    this._spiralActive = false;
  }


  // ============================================================
  //  Feature 12: Constellation Creation
  // ============================================================

  async triggerConstellation() {
    if (this._trailEngine.isMoving || !DaveMode._enabled || !DaveMode._presenceEl) return;

    // Find 4-6 visible grid tiles
    const tiles = Array.from(document.querySelectorAll('.model-tile'));
    const visibleTiles = tiles.filter(t => {
      const r = t.getBoundingClientRect();
      return r.width > 0 && r.top >= 0 && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= window.innerWidth;
    });

    if (visibleTiles.length < 3) {
      DaveMode._showBubble("Not enough stars in the sky tonight...", { force: true, emotion: EMOTION.SAD });
      return;
    }

    // Pick 4-6 random tiles
    const count = Math.min(4 + Math.floor(Math.random() * 3), visibleTiles.length);
    const shuffled = visibleTiles.sort(() => Math.random() - 0.5).slice(0, count);
    const points = shuffled.map(t => {
      const r = t.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });

    const p = DaveMode._presenceEl;
    const originX = parseFloat(p.style.left) || (window.innerWidth - 52);
    const originY = parseFloat(p.style.top) || (window.innerHeight - 52);

    if (!p.classList.contains('dave-dragged')) {
      DaveMode._applyPosition(originX, originY);
    }

    DaveMode._setEmotion(EMOTION.WARM);
    DaveMode._showBubble("Hold on... I see something in the stars.", { force: true, emotion: EMOTION.WARM });
    await this._wait(1500);

    // Create SVG overlay for lines
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('dave-constellation-svg');
    svg.setAttribute('viewBox', `0 0 ${window.innerWidth} ${window.innerHeight}`);
    document.body.appendChild(svg);
    this._constellationSvg = svg;

    p.classList.remove('dave-ambient');
    p.classList.add('dave-alive-moving', 'dave-dragged');

    // Place star markers with particle emission
    const stars = [];
    const particleIntervals = [];
    for (const pt of points) {
      const star = document.createElement('span');
      star.className = 'dave-constellation-star';
      star.textContent = '\u2605';
      star.style.left = (pt.x - 7) + 'px';
      star.style.top = (pt.y - 7) + 'px';
      star.style.opacity = '0';
      document.body.appendChild(star);
      stars.push(star);
    }

    // Fly to each point, drawing lines between them
    for (let i = 0; i < points.length; i++) {
      const pt = points[i];

      // Fly to point
      await this._trailEngine.animateMoveTo(pt.x - 16, pt.y - 16, 600);

      // Reveal star and start particle emission
      stars[i].style.opacity = '1';
      const starPt = pt;
      const pInterval = setInterval(() => {
        for (let pi = 0; pi < 2; pi++) {
          const particle = document.createElement('span');
          particle.className = 'dave-constellation-particle';
          particle.textContent = TRAIL_CHARS[Math.floor(Math.random() * TRAIL_CHARS.length)];
          const angle = Math.random() * Math.PI * 2;
          particle.style.left = (starPt.x - 3) + 'px';
          particle.style.top = (starPt.y - 3) + 'px';
          particle.style.setProperty('--particle-dx', (Math.cos(angle) * 25) + 'px');
          particle.style.setProperty('--particle-dy', (Math.sin(angle) * 25) + 'px');
          document.body.appendChild(particle);
          setTimeout(() => particle.remove(), 1200);
        }
      }, 400);
      particleIntervals.push(pInterval);

      // Draw line to next point
      if (i > 0) {
        const prev = points[i - 1];
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', prev.x);
        line.setAttribute('y1', prev.y);
        line.setAttribute('x2', pt.x);
        line.setAttribute('y2', pt.y);
        line.classList.add('dave-constellation-line', 'dave-constellation-line-drawing');

        // Calculate stroke-dasharray from actual line length
        const lineLen = Math.sqrt(Math.pow(pt.x - prev.x, 2) + Math.pow(pt.y - prev.y, 2));
        line.style.strokeDasharray = lineLen;
        line.style.strokeDashoffset = lineLen;

        svg.appendChild(line);

        await this._wait(800);

        // Switch to pulse after draw
        line.classList.remove('dave-constellation-line-drawing');
        line.classList.add('dave-constellation-line-pulse');
      }
    }

    // Connect last to first to close the shape
    if (points.length >= 3) {
      const last = points[points.length - 1];
      const first = points[0];
      const closeLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      closeLine.setAttribute('x1', last.x);
      closeLine.setAttribute('y1', last.y);
      closeLine.setAttribute('x2', first.x);
      closeLine.setAttribute('y2', first.y);
      closeLine.classList.add('dave-constellation-line', 'dave-constellation-line-drawing');
      const lineLen = Math.sqrt(Math.pow(first.x - last.x, 2) + Math.pow(first.y - last.y, 2));
      closeLine.style.strokeDasharray = lineLen;
      closeLine.style.strokeDashoffset = lineLen;
      svg.appendChild(closeLine);
      await this._wait(800);
      closeLine.classList.remove('dave-constellation-line-drawing');
      closeLine.classList.add('dave-constellation-line-pulse');
    }

    // Name the constellation
    const name = CONSTELLATION_NAMES[Math.floor(Math.random() * CONSTELLATION_NAMES.length)];

    // Find center of all points
    const centerX = points.reduce((s, p) => s + p.x, 0) / points.length;
    const centerY = points.reduce((s, p) => s + p.y, 0) / points.length;

    const nameEl = document.createElement('div');
    nameEl.className = 'dave-constellation-name';
    nameEl.textContent = name;
    nameEl.style.left = (centerX - 60) + 'px';
    nameEl.style.top = (centerY - 20) + 'px';
    nameEl.style.width = '120px';
    document.body.appendChild(nameEl);

    DaveMode._showBubble(`I call this one "${name}".`, { force: true, emotion: EMOTION.PROUD });

    // Return to origin
    await this._trailEngine.animateMoveTo(originX, originY, 600);
    p.classList.remove('dave-alive-moving');
    if (!DaveMode._isDragging) p.classList.add('dave-ambient');
    DaveMode._savePosition(originX, originY);

    // Clean up after display (shorter time)
    setTimeout(() => {
      particleIntervals.forEach(id => clearInterval(id));
      svg.remove();
      this._constellationSvg = null;
      stars.forEach(s => s.remove());
      nameEl.remove();
      document.querySelectorAll('.dave-constellation-particle').forEach(el => el.remove());
    }, 4000);
  }


  // ============================================================
  //  Feature 13: Shadow Puppet Show
  // ============================================================

  async triggerShadowPuppet() {
    if (this._puppetActive || !DaveMode._enabled || !DaveMode._presenceEl) return;
    this._puppetActive = true;

    const p = DaveMode._presenceEl;
    const show = PUPPET_SHOWS[Math.floor(Math.random() * PUPPET_SHOWS.length)];

    // Hide bubble during show — don't let it obstruct
    DaveMode._hideBubble?.();
    p.classList.remove('dave-ambient');

    // Create floating CRT screen NEXT TO Dave (not inside eye)
    const pRect = p.getBoundingClientRect();
    const screen = document.createElement('div');
    screen.className = 'dave-puppet-screen';

    // Position screen to the left of Dave, or right if near left edge
    const screenWidth = 120;
    const screenHeight = 90;
    let screenX, screenY;
    if (pRect.left > screenWidth + 20) {
      screenX = pRect.left - screenWidth - 12;
      screen.classList.add('dave-puppet-screen-left');
    } else {
      screenX = pRect.right + 12;
      screen.classList.add('dave-puppet-screen-right');
    }
    screenY = pRect.top - (screenHeight / 2) + (pRect.height / 2);
    // Clamp screen to viewport
    screenY = Math.max(8, Math.min(screenY, window.innerHeight - screenHeight - 8));
    screenX = Math.max(8, Math.min(screenX, window.innerWidth - screenWidth - 8));

    screen.style.left = screenX + 'px';
    screen.style.top = screenY + 'px';

    // Title bar
    const title = document.createElement('div');
    title.className = 'dave-puppet-screen-title';
    title.textContent = show.name;
    screen.appendChild(title);

    // Stage area
    const stage = document.createElement('pre');
    stage.className = 'dave-puppet-stage';
    screen.appendChild(stage);

    document.body.appendChild(screen);

    // Eye gets excited glow during show
    p.classList.add('dave-puppet-mode');

    await this._wait(400);
    screen.classList.add('dave-puppet-screen-visible');
    await this._wait(300);

    // Play frames
    for (const frame of show.frames) {
      stage.textContent = frame;
      await this._wait(700);
    }

    // Hold last frame
    await this._wait(1000);

    // Commentary appears as bubble after show
    screen.classList.remove('dave-puppet-screen-visible');
    await this._wait(400);
    screen.remove();
    p.classList.remove('dave-puppet-mode');
    if (!DaveMode._isDragging) p.classList.add('dave-ambient');

    DaveMode._showBubble(show.comment, { force: true, emotion: EMOTION.SMUG });

    this._puppetActive = false;
  }


  // ============================================================
  //  Alive Behavior Dispatcher (from idle cycles)
  // ============================================================

  _tryAliveBehavior() {
    const cycle = this._idleCycleCount;

    // Feature 3: Morse code — 8% on cycle 3+
    if (cycle >= 3 && Math.random() < 0.08) {
      this._safeRun(() => this.triggerMorse());
      return true;
    }

    // Feature 5a: Radar sweep — 6% on cycle 2+
    if (cycle >= 2 && Math.random() < 0.06) {
      this._safeRun(() => this.triggerRadarSweep());
      return true;
    }

    // Feature 5b: Iris clock — 5% on cycle 2+
    if (cycle >= 2 && Math.random() < 0.05) {
      this._safeRun(() => this.triggerClockMode());
      return true;
    }

    // Feature 6: Inspection — 15% on cycle 3+, with cooldown
    if (cycle >= 3 && Math.random() < 0.15) {
      if (Date.now() - this._lastInspection >= this._inspectionCooldownMs) {
        this._safeRun(() => this.triggerInspection());
        return true;
      }
    }

    // Feature 7: Post-it — 10% on cycle 4+
    if (cycle >= 4 && Math.random() < 0.10) {
      this._safeRun(() => this.triggerPostIt());
      return true;
    }

    // Feature 10: Heart trail — 5% on cycle 4+
    if (cycle >= 4 && Math.random() < 0.05) {
      this._safeRun(() => this.triggerHeartTrail());
      return true;
    }

    // Feature 8: Patrol — 5% on cycle 5+
    if (cycle >= 5 && Math.random() < 0.05) {
      this._safeRun(() => this.triggerPatrol());
      return true;
    }

    // Feature 12: Constellation — 3% on cycle 5+
    if (cycle >= 5 && Math.random() < 0.03) {
      this._safeRun(() => this.triggerConstellation());
      return true;
    }

    // Feature 9: Sleep on element — 12% on cycle 6+
    if (cycle >= 6 && Math.random() < 0.12) {
      this._safeRun(() => this.triggerSleepOnElement());
      return true;
    }

    // Feature 11: Spiral — 3% on proud/amused emotion
    if (cycle >= 4 && Math.random() < 0.03) {
      this._safeRun(() => this.triggerSpiralFireworks());
      return true;
    }

    // Feature 13: Shadow puppet — 2% on cycle 7+
    if (cycle >= 7 && Math.random() < 0.02) {
      this._safeRun(() => this.triggerShadowPuppet());
      return true;
    }

    return false;
  }


  // ============================================================
  //  Helpers
  // ============================================================

  _pickFromPool(pool) {
    if (!pool || pool.length === 0) return null;
    const weighted = [];
    for (const msg of pool) {
      const w = msg.r === 2 ? 1 : msg.r === 1 ? 2 : 3;
      for (let i = 0; i < w; i++) weighted.push(msg);
    }
    const pick = weighted[Math.floor(Math.random() * weighted.length)];
    return pick.t;
  }

  _wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Cleanup on disable
  destroy() {
    clearInterval(this._activityCheckInterval);
    this._activityCheckInterval = null;
    if (this._scrollHandler) {
      window.removeEventListener('wheel', this._scrollHandler);
    }
    if (this._irisOverlay) {
      this._irisOverlay.remove();
      this._irisOverlay = null;
      this._exitIrisEffect();
    }
    clearTimeout(this._irisTimer);
    clearInterval(this._clockInterval);
    clearTimeout(this._scrollResetTimer);
    if (this._constellationSvg) {
      this._constellationSvg.remove();
    }
    this._trailEngine.cleanupTrail();
    this._trailEngine.abort();
    for (const { evt, bound } of this._hooks) {
      document.removeEventListener(evt, bound);
    }
    this._hooks = [];
    // Clean up all alive DOM elements
    document.querySelectorAll('.dave-postit, .dave-constellation-star, .dave-constellation-name, .dave-constellation-particle, .dave-alive-zzz, .dave-trail-char, .dave-patrol-trail-char, .dave-inspect-highlight, .dave-morse-indicator, .dave-puppet-screen, .dave-heart-particle, .dave-sub-drip, .dave-spiral-particle').forEach(el => el.remove());
  }
}


// ============================================================
//  Singleton Export
// ============================================================
export const DaveAlive = new _DaveAlive();
