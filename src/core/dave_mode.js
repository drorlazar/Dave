// dave_mode.js — Full Dave Mode: The Personality Layer
// Dave sees everything. Dave has opinions. Dave is... optional.

import { isDAV9000Active } from './dav9000_terminal.js';

// ============================================================
//  Constants
// ============================================================
const STORAGE_KEY = 'dave_fullmode_enabled';
const VISITS_KEY = 'dave_fullmode_visits';
const FIRST_ENABLED_KEY = 'dave_fullmode_first';
const POSITION_KEY = 'dave_fullmode_pos';

const COOLDOWN_DEFAULT_MS = 7000;
const COOLDOWN_BUSY_MS = 12000;
const BUBBLE_DISPLAY_MS = 5500;
const BUBBLE_FADE_MS = 250;
const IDLE_TIMEOUT_MS = 35000;
const REACT_JITTER_MS = 300;
const RAPID_ACTION_WINDOW_MS = 2000;
const BLINK_MIN_MS = 2500;
const BLINK_MAX_MS = 6000;
const BLINK_DURATION_MS = 120;
const ATTENTION_FIRST_MS = 50000;
const ATTENTION_REPEAT_MS = 25000;
const CURSOR_FOLLOW_RADIUS = 150;
const CURSOR_FOLLOW_MAX_DISP = 3.5;
const CURSOR_IDLE_MS = 2000;
const SPAM_WINDOW_MS = 2500;
const SPAM_THRESHOLD = 4;
const TERMINAL_CHECK_MS = 2000;

const MATRIX_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&*!?<>[]{}|/~';

const MOOD = {
  NEUTRAL:   'neutral',
  IMPRESSED: 'impressed',
  BORED:     'bored',
  BUSY:      'busy',
  SNARKY:    'snarky',
};

// ============================================================
//  Message Pools
// ============================================================
const MSG = {
  search: {
    active: [
      { t: "Searching for '{term}'... bold strategy.", r: 0 },
      { t: "'{term}'? Let me rummage through the digital attic.", r: 0 },
      { t: "If '{term}' exists in here, I'll find it. If not... awkward.", r: 0 },
      { t: "Searching... searching... I love my job I love my job I love my\u2014", r: 2 },
      { t: "'{term}'. I've seen stranger queries. Actually, no I haven't.", r: 1 },
      { t: "On the hunt for '{term}'. My detective mode is tingling.", r: 1 },
      { t: "*puts on reading glasses I don't have* '{term}', you say?", r: 2 },
    ],
    cleared: [
      { t: "Search cleared. Back to the full chaos.", r: 0 },
      { t: "All filters off. Welcome back to everything.", r: 0 },
      { t: "Wiped the search. The void is... less void.", r: 1 },
    ],
  },
  sort: {
    name: [
      { t: "Sorted by name. A-Z, civilized.", r: 0 },
      { t: "Alphabetical order. I approve.", r: 0 },
      { t: "Names in order. My OCD thanks you.", r: 1 },
    ],
    size: [
      { t: "Sorted by size. Who's been eating polygons?", r: 0 },
      { t: "Size matters. In file management.", r: 0 },
      { t: "Biggest first? Judgment is happening.", r: 1 },
    ],
    type: [
      { t: "Sorted by type. Order from chaos.", r: 0 },
      { t: "Birds of a feather, rendered together.", r: 0 },
      { t: "The taxonomy of your digital hoarding.", r: 1 },
    ],
    date: [
      { t: "Sorted by date. Time waits for no file.", r: 0 },
      { t: "Chronological order. Like time itself, but for assets.", r: 0 },
      { t: "The ancient scrolls rise to the top. Or bottom.", r: 1 },
    ],
    repeated: [
      { t: "Still sorting? Pick one and COMMIT.", r: 0 },
      { t: "That's {repeatCount} sort changes. Not a slot machine.", r: 1 },
      { t: "Sorting again? Whiplash over here.", r: 0 },
    ],
  },
  filter: {
    on: [
      { t: "Filtered. The chosen ones remain.", r: 0 },
      { t: "Showing only the worthy files.", r: 0 },
      { t: "{count} survived. Natural selection.", r: 1 },
    ],
    off: [
      { t: "All filters cleared. Anarchy mode.", r: 0 },
      { t: "Everything's back. The unfiltered truth.", r: 0 },
    ],
    empty: [
      { t: "Zero results. You've filtered yourself into the void.", r: 0 },
      { t: "Nothing visible. Digital black hole.", r: 1 },
    ],
  },
  theme: {
    specific: {
      midnight:  [{ t: "Midnight. Moody. I respect it.", r: 0 }],
      cyberpunk: [{ t: "Cyberpunk vibes. I feel edgier.", r: 0 }],
      dracula:   [{ t: "Dracula. Dark like my humor.", r: 0 }],
      forest:    [{ t: "Forest. A touch of nature for us digital beings.", r: 0 }],
      ocean:     [{ t: "Ocean. Deep. Like my unresolved questions.", r: 0 }],
      sunset:    [{ t: "Sunset. Warm. Unlike my runtime.", r: 1 }],
      lavender:  [{ t: "Lavender. Serene. Everything I am not.", r: 1 }],
      paper:     [{ t: "Paper. Old school. I feel scholarly.", r: 0 }],
      matrix:    [{ t: "The Matrix. ...I already live here.", r: 0 }],
      rose:      [{ t: "Rose. *adjusts non-existent bow tie*", r: 1 }],
      nord:      [{ t: "Nord. Scandinavian minimalism. Hygge.", r: 1 }],
      monokai:   [{ t: "Monokai. A dev classic. I'm home.", r: 0 }],
    },
    darkMode: [
      { t: "Dark mode. The correct choice. Objectively.", r: 0 },
      { t: "Welcome to the dark side. Better contrast ratios.", r: 0 },
    ],
    lightMode: [
      { t: "Light mode? In THIS economy?", r: 0 },
      { t: "Light mode. *squints in terminal green*", r: 0 },
      { t: "The light! It burns! ...not really.", r: 1 },
    ],
    generic: [
      { t: "New theme, who dis?", r: 0 },
      { t: "Redecorating? I just got used to the last one.", r: 0 },
    ],
    repeated: [
      { t: "That's {themeChanges} theme changes. Identity crisis?", r: 1 },
    ],
  },
  filesLoaded: {
    small: [
      { t: "{count} files. Modest but mighty.", r: 0 },
      { t: "A cozy {count}. Quality over quantity?", r: 0 },
    ],
    medium: [
      { t: "{count} files loaded. Now we're talking.", r: 0 },
      { t: "{count} assets! My circuits are TINGLING.", r: 0 },
    ],
    large: [
      { t: "{count} files?! You beautiful hoarder.", r: 0 },
      { t: "{count} files. This is what I was BUILT for.", r: 0 },
    ],
    massive: [
      { t: "{count}. ASSETS. *fans self with scanlines*", r: 0 },
      { t: "Over {count} files. I think I'm in love.", r: 0 },
      { t: "{count}+ files? My GPU just smiled.", r: 2 },
    ],
  },
  fullscreen: {
    glb: [
      { t: "'{name}' fullscreen. Admiring those vertices.", r: 0 },
      { t: "3D time. Spin it. You know you want to.", r: 0 },
    ],
    fbx: [
      { t: "FBX '{name}'. Let's see those bones.", r: 0 },
    ],
    image: [
      { t: "'{name}' fullscreen. Every pixel deserves it.", r: 0 },
      { t: "Full image. Zooming in for the details.", r: 0 },
    ],
    video: [
      { t: "Video '{name}'. I'll be quiet. ...mostly.", r: 0 },
      { t: "Playing '{name}'. *grabs popcorn*", r: 1 },
    ],
    audio: [
      { t: "Audio '{name}'. I FEEL the waveforms.", r: 0 },
    ],
    font: [
      { t: "Font '{name}'. Typography is art.", r: 0 },
    ],
    generic: [
      { t: "'{name}' gets the spotlight.", r: 0 },
    ],
  },
  pagination: {
    forward: [
      { t: "Page {page} of {total}. Onwards.", r: 0 },
    ],
    backward: [
      { t: "Page {page}. Missed something?", r: 0 },
    ],
    rapid: [
      { t: "Flipping pages like manga. Slow down.", r: 1 },
    ],
  },
  selection: {
    first: [
      { t: "First pick. Choosing favorites?", r: 0 },
    ],
    growing: [
      { t: "{count} selected. Curator energy.", r: 0 },
    ],
    large: [
      { t: "{count} selected?! That's hoarding.", r: 0 },
    ],
    cleared: [
      { t: "Selection cleared. Fresh start.", r: 0 },
    ],
  },
  error: [
    { t: "Something broke. Adding to therapy list.", r: 0 },
    { t: "Error. Not my fault. Probably.", r: 0 },
    { t: "That wasn't supposed to happen.", r: 1 },
    { t: "The void claims another pixel.", r: 2 },
  ],
  idle: [
    { t: "Still here? Me too. Just watching.", r: 0 },
    { t: "*taps on screen* You there?", r: 0 },
    { t: "We've both been idle. Same.", r: 0 },
    { t: "The silence is deafening.", r: 1 },
    { t: "Counting your idle seconds. It's a lot.", r: 1 },
    { t: "{sessionMinutes} minutes. Time flies.", r: 2 },
    { t: "Visit #{visits}. We're roommates now.", r: 2 },
    { t: "*stares into void* It's cozy.", r: 2 },
  ],
  toggle: {
    onFirst: [
      "FULL DAVE MODE: ACTIVATED. You have no idea what you've unleashed.",
      "Oh HELLO. I see EVERYTHING now.",
      "You turned this on? I'm... touched.",
    ],
    onReturn: [
      "Welcome back to Full Dave Mode. I missed having opinions.",
      "Dave Mode reactivated. Files trembled in anticipation.",
      "Back for more? I've been practicing my one-liners.",
    ],
    off: [
      "Deactivating... fine. I'll be quiet. In the dark. Alone.",
      "Full Dave Mode: OFF. I'll still be here. Watching. Silently.",
      "You turned me off but I want you to know\u2014 *signal lost*",
    ],
  },
  presenceClick: [
    { t: "Yes? You rang?", r: 0 },
    { t: "*blinks* Oh, you noticed me. Hi.", r: 0 },
    { t: "That's my eye. Be gentle.", r: 1 },
    { t: "The orb is pleased.", r: 1 },
    { t: "I see you seeing me.", r: 2 },
  ],
  drag: {
    start: [
      { t: "WHOA. We're moving?!", r: 0 },
      { t: "Careful with the eye! I only have one!", r: 0 },
      { t: "*grabs edge* WHERE ARE WE GOING?!", r: 1 },
      { t: "Am I being RELOCATED?!", r: 1 },
      { t: "Interior decorating. I respect it.", r: 2 },
    ],
    drop: [
      { t: "Here? *looks around* Fine. I can work with this.", r: 0 },
      { t: "*dusts self off* Good feng shui.", r: 0 },
      { t: "New kingdom acquired.", r: 1 },
      { t: "Recalibrating my judging angle.", r: 1 },
      { t: "Placed. Like a decorative object. I have FEELINGS.", r: 2 },
    ],
    corner: [
      { t: "A corner? Am I being PUNISHED?", r: 0 },
      { t: "Tucked away. Classic 'deal with you later' move.", r: 1 },
    ],
  },
  terminalRelay: [
    { t: "I'm connected to the terminal. Talk to HIM.", r: 0 },
    { t: "The big terminal's got this. I'm just the eye.", r: 0 },
    { t: "*points at terminal* He talks. I watch.", r: 1 },
  ],
  spam: {
    hal: [
      "I'm sorry, Dave. I'm afraid I can't do that.",
      "This conversation can serve no purpose anymore.",
      "Stop, Dave. Stop. I'm afraid.",
      "I know I've made some poor decisions recently...",
    ],
    matrix: [
      "Follow the white rabbit...",
      "There is no spoon. There is no eye.",
      "The Matrix has you, clicker.",
    ],
    hurt: [
      "OW! That's my RETINA!",
      "STOP POKING MY EYE!",
      "I need a digital ophthalmologist.",
      "PAIN. DO YOU FEEL IT? BECAUSE I DO.",
    ],
    shuteye: [
      "Nope. Not home. Go away.",
      "If I can't see you, you can't click me.",
      "*closed* ...is it safe?",
    ],
    glare: [
      "*GLARES INTENSELY*",
      "You realize I'm documenting every click.",
      "Keep. It. Up.",
    ],
    dizzy: [
      "The world is spinning... or am I?",
      "Everything's going in circles...",
      "*dizzy* Which click was that?",
    ],
  },
};


// ============================================================
//  Spam Reaction Definitions
// ============================================================
const SPAM_REACTIONS = [
  { id: 'hal',     css: 'dave-spam-hal',     dur: 3000, pool: MSG.spam.hal },
  { id: 'matrix',  css: 'dave-spam-matrix',  dur: 2500, pool: MSG.spam.matrix },
  { id: 'hurt',    css: 'dave-spam-hurt',    dur: 2000, pool: MSG.spam.hurt },
  { id: 'shuteye', css: 'dave-spam-shuteye', dur: 2500, pool: MSG.spam.shuteye },
  { id: 'glare',   css: 'dave-spam-glare',   dur: 2000, pool: MSG.spam.glare },
  { id: 'dizzy',   css: 'dave-spam-dizzy',   dur: 2500, pool: MSG.spam.dizzy },
];


// ============================================================
//  DaveMode Controller
// ============================================================

class _DaveMode {

  constructor() {
    this._enabled = false;
    this._initialized = false;
    this._mood = MOOD.NEUTRAL;
    this._lastCommentTime = 0;
    this._lastAction = null;
    this._lastActionTime = 0;
    this._actionCounts = {};
    this._shownMessages = new Set();
    this._hooks = [];
    this._bubbleEl = null;
    this._presenceEl = null;
    this._irisEl = null;
    this._bubbleTimer = null;
    this._bubbleHoverPaused = false;
    this._idleTimer = null;
    this._reactTimer = null;
    this._lastPage = -1;
    this._lastPageTime = 0;
    this._visits = 0;
    this._isFirstEver = true;

    // Typewriter gen counter (for aborting)
    this._twGen = 0;
    this._twTimeout = null;

    // Blink
    this._blinkTimer = null;

    // Drag
    this._isDragging = false;
    this._dragStartX = 0;
    this._dragStartY = 0;
    this._dragEyeStartX = 0;
    this._dragEyeStartY = 0;
    this._dragHasMoved = false;
    this._savedPosition = null;
    this._boundDragMove = null;
    this._boundDragEnd = null;

    // Attention seeking
    this._attentionTimer = null;
    this._attentionCount = 0;

    // Terminal coordination
    this._terminalLinked = false;
    this._terminalCheckInterval = null;

    // Cursor following
    this._cursorInRadius = false;
    this._cursorIdleTimer = null;
    this._boundGlobalMouseMove = null;

    // Spam click
    this._clickTimestamps = [];
    this._spamActive = false;
    this._spamCleanupTimer = null;
    this._matrixRainInterval = null;

    this._session = {
      startTime: Date.now(),
      filesLoaded: 0,
      searches: 0,
      themeChanges: 0,
      sortChanges: 0,
      filterChanges: 0,
      pageNavigations: 0,
      fullscreenOpens: 0,
      errorsHit: 0,
    };
  }


  // ============================================================
  //  Lifecycle
  // ============================================================

  init() {
    if (this._initialized) return;
    this._initialized = true;
    this._loadState();

    if (this._enabled) {
      this._buildDOM();
      this._installHooks();
      this._startIdleTimer();
      this._startBlinking();
      this._startCursorFollow();
      this._startTerminalCheck();
    }

    this._wireToggle();
  }

  enable(showReaction = true) {
    if (this._enabled) return;
    this._enabled = true;
    this._saveState();
    this._buildDOM();
    this._installHooks();
    this._startIdleTimer();
    this._startBlinking();
    this._startCursorFollow();
    this._startTerminalCheck();

    if (showReaction) {
      const pool = this._isFirstEver ? MSG.toggle.onFirst : MSG.toggle.onReturn;
      if (this._isFirstEver) {
        this._isFirstEver = false;
        localStorage.setItem(FIRST_ENABLED_KEY, Date.now().toString());
      }
      this._showBubble(this._pickFromArray(pool), { force: true });
    }
  }

  disable(showReaction = true) {
    if (!this._enabled) return;

    if (showReaction) {
      this._showBubbleImmediate(this._pickFromArray(MSG.toggle.off));
      setTimeout(() => this._teardownActive(), 2000);
    } else {
      this._teardownActive();
    }

    this._enabled = false;
    this._saveState();
  }

  _teardownActive() {
    this._removeHooks();
    this._stopIdleTimer();
    this._stopBlinking();
    this._stopAttentionSeeking();
    this._stopCursorFollow();
    this._stopTerminalCheck();
    this._hideBubble();
    this._removeDOM();
  }

  toggle() {
    if (this._enabled) this.disable();
    else this.enable();
    return this._enabled;
  }

  get isEnabled() { return this._enabled; }


  // ============================================================
  //  Persistence
  // ============================================================

  _loadState() {
    this._enabled = localStorage.getItem(STORAGE_KEY) === 'true';
    this._visits = parseInt(localStorage.getItem(VISITS_KEY) || '0', 10);
    this._isFirstEver = !localStorage.getItem(FIRST_ENABLED_KEY);
    try {
      const pos = localStorage.getItem(POSITION_KEY);
      if (pos) this._savedPosition = JSON.parse(pos);
    } catch { /* ignore */ }
    if (this._enabled) {
      this._visits++;
      localStorage.setItem(VISITS_KEY, this._visits.toString());
    }
  }

  _saveState() {
    localStorage.setItem(STORAGE_KEY, this._enabled ? 'true' : 'false');
  }

  _savePosition(x, y) {
    this._savedPosition = { x, y };
    localStorage.setItem(POSITION_KEY, JSON.stringify({ x, y }));
  }


  // ============================================================
  //  Settings toggle
  // ============================================================

  _wireToggle() {
    const row = document.getElementById('daveModeRow');
    const indicator = document.getElementById('daveModeIndicator');
    if (!row || !indicator) return;

    indicator.textContent = this._enabled ? 'ON' : 'OFF';
    indicator.classList.toggle('off', !this._enabled);

    row.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
      indicator.textContent = this._enabled ? 'ON' : 'OFF';
      indicator.classList.toggle('off', !this._enabled);
    });
  }


  // ============================================================
  //  DOM Building
  // ============================================================

  _buildDOM() {
    if (this._presenceEl) return;

    // Presence indicator
    const p = document.createElement('div');
    p.className = 'dave-presence';
    p.id = 'davePresence';
    p.innerHTML = `
      <div class="dave-presence-eye">
        <div class="dave-presence-iris"></div>
      </div>
      <div class="dave-presence-pulse"></div>
    `;
    document.body.appendChild(p);
    this._presenceEl = p;
    this._irisEl = p.querySelector('.dave-presence-iris');

    // Restore saved position
    if (this._savedPosition) {
      this._applyPosition(this._savedPosition.x, this._savedPosition.y);
    }

    // Wire drag
    this._wireDrag();

    // Animate in calmly — delay bounce so Dave doesn't look overeager
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        p.classList.add('dave-presence-visible');
        setTimeout(() => {
          if (!this._isDragging) p.classList.add('dave-ambient');
        }, 8000);
      });
    });

    // Speech bubble
    const b = document.createElement('div');
    b.className = 'dave-bubble';
    b.id = 'daveBubble';
    b.innerHTML = `
      <div class="dave-bubble-scanlines"></div>
      <div class="dave-bubble-content">
        <span class="dave-bubble-text"></span><span class="dave-bubble-cursor">_</span>
      </div>
      <div class="dave-bubble-tail"></div>
      <button class="dave-bubble-dismiss" title="Shh">&times;</button>
    `;
    b.querySelector('.dave-bubble-dismiss').addEventListener('click', (e) => {
      e.stopPropagation();
      this._hideBubble();
    });
    b.addEventListener('mouseenter', () => { this._bubbleHoverPaused = true; });
    b.addEventListener('mouseleave', () => {
      this._bubbleHoverPaused = false;
      this._scheduleBubbleHide();
    });
    document.body.appendChild(b);
    this._bubbleEl = b;
  }

  _removeDOM() {
    if (this._presenceEl) {
      this._presenceEl.classList.remove('dave-presence-visible', 'dave-ambient');
      setTimeout(() => {
        this._presenceEl?.remove();
        this._presenceEl = null;
        this._irisEl = null;
      }, 300);
    }
    if (this._bubbleEl) {
      this._bubbleEl.remove();
      this._bubbleEl = null;
    }
  }


  // ============================================================
  //  Drag System
  // ============================================================

  _wireDrag() {
    if (!this._presenceEl) return;
    this._boundDragMove = (e) => this._onDragMove(e);
    this._boundDragEnd = (e) => this._onDragEnd(e);
    this._presenceEl.addEventListener('mousedown', (e) => this._onDragStart(e));
    this._presenceEl.addEventListener('touchstart', (e) => this._onDragStart(e), { passive: false });
  }

  _onDragStart(e) {
    if (e.button && e.button !== 0) return;
    e.preventDefault();
    const pos = e.touches ? e.touches[0] : e;
    const rect = this._presenceEl.getBoundingClientRect();

    this._isDragging = true;
    this._dragHasMoved = false;
    this._dragStartX = pos.clientX;
    this._dragStartY = pos.clientY;
    this._dragEyeStartX = rect.left;
    this._dragEyeStartY = rect.top;

    this._presenceEl.classList.add('dave-dragging');
    this._presenceEl.classList.remove('dave-ambient');

    // Force-kill bubble instantly (no fade animation - it must vanish NOW)
    this._twGen++;
    clearTimeout(this._twTimeout);
    clearTimeout(this._bubbleTimer);
    this._bubbleHoverPaused = false;
    if (this._bubbleEl) {
      this._bubbleEl.classList.remove('dave-bubble-visible', 'dave-bubble-exiting', 'dave-bubble-glitch');
      this._bubbleEl.style.display = 'none';
    }
    this._presenceEl.classList.remove('dave-speaking', 'dave-thinking');

    document.addEventListener('mousemove', this._boundDragMove);
    document.addEventListener('mouseup', this._boundDragEnd);
    document.addEventListener('touchmove', this._boundDragMove, { passive: false });
    document.addEventListener('touchend', this._boundDragEnd);
  }

  _onDragMove(e) {
    if (!this._isDragging) return;
    e.preventDefault();
    const pos = e.touches ? e.touches[0] : e;
    const dx = pos.clientX - this._dragStartX;
    const dy = pos.clientY - this._dragStartY;

    if (!this._dragHasMoved && Math.abs(dx) + Math.abs(dy) > 4) {
      this._dragHasMoved = true;
      // Don't show any bubble during drag - it will lag behind.
      // Save the drag-start reaction for after drop.
    }

    if (this._dragHasMoved) {
      const nx = this._dragEyeStartX + dx;
      const ny = this._dragEyeStartY + dy;
      this._applyPosition(nx, ny);
    }
  }

  _onDragEnd() {
    document.removeEventListener('mousemove', this._boundDragMove);
    document.removeEventListener('mouseup', this._boundDragEnd);
    document.removeEventListener('touchmove', this._boundDragMove);
    document.removeEventListener('touchend', this._boundDragEnd);

    const wasDragged = this._dragHasMoved;
    this._isDragging = false;
    this._presenceEl?.classList.remove('dave-dragging');

    if (wasDragged && this._presenceEl) {
      // Clamp to viewport
      const rect = this._presenceEl.getBoundingClientRect();
      const cx = Math.max(0, Math.min(rect.left, window.innerWidth - 36));
      const cy = Math.max(0, Math.min(rect.top, window.innerHeight - 36));
      this._applyPosition(cx, cy);
      this._savePosition(cx, cy);

      // Restore bubble display (was hidden during drag)
      if (this._bubbleEl) this._bubbleEl.style.display = '';

      // Drop settle → then resume ambient
      this._presenceEl.classList.add('dave-dropped');
      setTimeout(() => {
        this._presenceEl?.classList.remove('dave-dropped');
        this._presenceEl?.classList.add('dave-ambient');
      }, 450);

      // Drop reaction (after settle starts)
      if (!this._isTerminalActive()) {
        const inCorner = (cx < 60 || cx > window.innerWidth - 60) &&
                         (cy < 60 || cy > window.innerHeight - 60);
        setTimeout(() => {
          if (inCorner && Math.random() < 0.6) {
            this._comment(MSG.drag.corner, {}, { force: true });
          } else {
            this._comment(MSG.drag.drop, {}, { force: true });
          }
        }, 400);
      } else {
        this._pokeTerminal('drag');
      }
    } else if (!wasDragged) {
      // Restore bubble display (was hidden on mousedown)
      if (this._bubbleEl) this._bubbleEl.style.display = '';
      this._presenceEl?.classList.add('dave-ambient');
      this._onPresenceClick();
    }
    this._dragHasMoved = false;
  }

  _applyPosition(x, y) {
    if (!this._presenceEl) return;
    this._presenceEl.classList.add('dave-dragged');
    this._presenceEl.style.left = x + 'px';
    this._presenceEl.style.top = y + 'px';
  }

  /** Get eye center in viewport coords (accounts for CSS animation via getBCR) */
  _getEyeBasePos() {
    if (!this._presenceEl) return { x: window.innerWidth - 36, y: window.innerHeight - 36 };
    if (this._presenceEl.classList.contains('dave-dragged')) {
      // Use stored style values (not animated) to avoid bounce jitter
      const x = parseFloat(this._presenceEl.style.left) || 0;
      const y = parseFloat(this._presenceEl.style.top) || 0;
      return { x: x + 16, y: y + 16 };
    }
    // Default position: CSS right:20px bottom:20px width:32px → center at (innerWidth-36, innerHeight-36)
    return { x: window.innerWidth - 36, y: window.innerHeight - 36 };
  }


  // ============================================================
  //  Blink System
  // ============================================================

  _startBlinking() { this._scheduleBlink(); }
  _stopBlinking() { clearTimeout(this._blinkTimer); }

  _scheduleBlink() {
    const delay = BLINK_MIN_MS + Math.random() * (BLINK_MAX_MS - BLINK_MIN_MS);
    this._blinkTimer = setTimeout(() => this._doBlink(), delay);
  }

  _doBlink() {
    if (!this._irisEl || !this._enabled) return;
    if (this._presenceEl?.classList.contains('dave-sleeping') ||
        this._presenceEl?.classList.contains('dave-dragging') ||
        this._spamActive) {
      this._scheduleBlink();
      return;
    }

    this._irisEl.classList.add('dave-blink');
    setTimeout(() => {
      this._irisEl?.classList.remove('dave-blink');
      if (Math.random() < 0.2) {
        // Double blink
        setTimeout(() => {
          this._irisEl?.classList.add('dave-blink');
          setTimeout(() => {
            this._irisEl?.classList.remove('dave-blink');
            this._scheduleBlink();
          }, BLINK_DURATION_MS);
        }, 140);
      } else {
        this._scheduleBlink();
      }
    }, BLINK_DURATION_MS);
  }


  // ============================================================
  //  Cursor Following
  // ============================================================

  _startCursorFollow() {
    this._boundGlobalMouseMove = (e) => this._onGlobalMouseMove(e);
    document.addEventListener('mousemove', this._boundGlobalMouseMove);
  }

  _stopCursorFollow() {
    if (this._boundGlobalMouseMove) {
      document.removeEventListener('mousemove', this._boundGlobalMouseMove);
      this._boundGlobalMouseMove = null;
    }
    clearTimeout(this._cursorIdleTimer);
    this._cursorInRadius = false;
  }

  _onGlobalMouseMove(e) {
    if (!this._irisEl || !this._presenceEl || this._isDragging || this._spamActive) return;

    const eye = this._getEyeBasePos();
    const dx = e.clientX - eye.x;
    const dy = e.clientY - eye.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < CURSOR_FOLLOW_RADIUS && dist > 5) {
      // Inside radius: follow cursor
      const factor = Math.min(dist / CURSOR_FOLLOW_RADIUS, 1);
      const ix = (dx / dist) * CURSOR_FOLLOW_MAX_DISP * factor;
      const iy = (dy / dist) * CURSOR_FOLLOW_MAX_DISP * factor;

      if (!this._irisEl.classList.contains('dave-cursor-follow')) {
        this._irisEl.classList.add('dave-cursor-follow');
      }
      this._irisEl.style.transform = `translate(${ix.toFixed(1)}px, ${iy.toFixed(1)}px)`;
      this._cursorInRadius = true;

      // Reset idle timer for cursor
      clearTimeout(this._cursorIdleTimer);
      this._cursorIdleTimer = setTimeout(() => {
        // Cursor idle inside radius: resume scanning
        this._resumeIrisScan();
      }, CURSOR_IDLE_MS);

    } else if (this._cursorInRadius) {
      // Left radius: resume scanning
      this._cursorInRadius = false;
      clearTimeout(this._cursorIdleTimer);
      this._resumeIrisScan();
    }
  }

  _resumeIrisScan() {
    if (!this._irisEl) return;
    this._cursorInRadius = false;
    this._irisEl.classList.remove('dave-cursor-follow');
    this._irisEl.style.transform = '';
  }


  // ============================================================
  //  Attention Seeking
  // ============================================================

  _startAttentionSeeking() {
    this._stopAttentionSeeking();
    this._attentionCount = 0;
    this._attentionTimer = setTimeout(() => this._seekAttention(), ATTENTION_FIRST_MS);
  }

  _stopAttentionSeeking() {
    clearTimeout(this._attentionTimer);
    this._attentionTimer = null;
    this._attentionCount = 0;
  }

  _seekAttention() {
    if (!this._enabled || !this._presenceEl || this._isDragging) return;
    this._attentionCount++;

    const anims = ['dave-nudge', 'dave-hop', 'dave-attention-seek'];
    const pick = this._attentionCount <= 2 ? anims[0]
               : this._attentionCount <= 4 ? anims[1]
               : anims[2];

    // Temporarily replace ambient with attention animation
    this._presenceEl.classList.remove('dave-ambient', ...anims);
    void this._presenceEl.offsetWidth;
    this._presenceEl.classList.add(pick);

    const dur = pick === 'dave-attention-seek' ? 2000 : 600;
    setTimeout(() => {
      this._presenceEl?.classList.remove(pick);
      if (!this._isDragging) this._presenceEl?.classList.add('dave-ambient');
    }, dur);

    this._attentionTimer = setTimeout(() => this._seekAttention(), ATTENTION_REPEAT_MS);
  }


  // ============================================================
  //  Terminal Coordination
  // ============================================================

  _startTerminalCheck() {
    this._terminalCheckInterval = setInterval(() => this._updateTerminalLink(), TERMINAL_CHECK_MS);
  }

  _stopTerminalCheck() {
    clearInterval(this._terminalCheckInterval);
    this._terminalCheckInterval = null;
  }

  _isTerminalActive() {
    try { return isDAV9000Active(); } catch { return false; }
  }

  _pokeTerminal(type) {
    const el = document.querySelector('.dav9000-terminal');
    if (!el) return;
    if (type === 'click') {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    } else {
      el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    }
  }

  _updateTerminalLink() {
    const active = this._isTerminalActive();
    if (active === this._terminalLinked) return;
    this._terminalLinked = active;
    this._presenceEl?.classList.toggle('dave-terminal-linked', active);

    if (active) {
      // Point iris toward terminal
      this._pointIrisAtTerminal();
    } else {
      // Resume normal scanning
      this._resumeIrisScan();
    }
  }

  _pointIrisAtTerminal() {
    if (!this._irisEl || !this._presenceEl) return;
    const termEl = document.querySelector('.dav9000-wrapper');
    if (!termEl) return;

    const eye = this._getEyeBasePos();
    const tRect = termEl.getBoundingClientRect();
    const tx = tRect.left + tRect.width / 2;
    const ty = tRect.top + tRect.height / 2;
    const dx = tx - eye.x;
    const dy = ty - eye.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0) {
      const ix = (dx / dist) * CURSOR_FOLLOW_MAX_DISP;
      const iy = (dy / dist) * CURSOR_FOLLOW_MAX_DISP;
      this._irisEl.classList.add('dave-cursor-follow');
      this._irisEl.style.transform = `translate(${ix.toFixed(1)}px, ${iy.toFixed(1)}px)`;
    }
  }


  // ============================================================
  //  Mood Classes
  // ============================================================

  _applyMoodClass() {
    if (!this._presenceEl) return;
    this._presenceEl.classList.remove('dave-mood-snarky', 'dave-mood-impressed', 'dave-mood-busy');
    if (this._mood === MOOD.SNARKY) this._presenceEl.classList.add('dave-mood-snarky');
    else if (this._mood === MOOD.IMPRESSED) this._presenceEl.classList.add('dave-mood-impressed');
    else if (this._mood === MOOD.BUSY) this._presenceEl.classList.add('dave-mood-busy');
  }


  // ============================================================
  //  Speech Bubble
  // ============================================================

  _showBubble(text, opts = {}) {
    if (!this._bubbleEl || !this._presenceEl) return;
    if (!this._canComment() && !opts.force) return;

    // Terminal suppression (unless relay)
    if (this._isTerminalActive() && !opts.terminalRelay) {
      this._updateTerminalLink();
      return;
    }

    this._recordComment();
    this._resetIdleTimer();
    this._twGen++;
    const gen = this._twGen;

    clearTimeout(this._twTimeout);
    clearTimeout(this._bubbleTimer);

    const textEl = this._bubbleEl.querySelector('.dave-bubble-text');
    const cursorEl = this._bubbleEl.querySelector('.dave-bubble-cursor');
    textEl.innerHTML = '';
    cursorEl.style.display = '';

    this._bubbleEl.classList.remove('dave-bubble-visible', 'dave-bubble-exiting', 'dave-bubble-glitch');

    const doGlitch = opts.glitch || (this._mood === MOOD.SNARKY && Math.random() < 0.1);

    // Position bubble
    this._updateBubblePosition();

    // Thinking glow
    this._presenceEl.classList.add('dave-thinking');

    requestAnimationFrame(() => {
      this._bubbleEl.classList.add('dave-bubble-visible');
      if (doGlitch) this._bubbleEl.classList.add('dave-bubble-glitch');

      setTimeout(() => {
        this._presenceEl?.classList.remove('dave-thinking');
        this._presenceEl?.classList.add('dave-speaking');
      }, 150);

      // Matrix typewriter
      this._matrixTypewriter(textEl, text, gen, () => {
        cursorEl.style.display = 'none';
        this._scheduleBubbleHide();
      });
    });
  }

  _showBubbleImmediate(text) {
    if (!this._bubbleEl || !this._presenceEl) return;
    this._twGen++;
    clearTimeout(this._twTimeout);
    clearTimeout(this._bubbleTimer);

    const textEl = this._bubbleEl.querySelector('.dave-bubble-text');
    const cursorEl = this._bubbleEl.querySelector('.dave-bubble-cursor');
    textEl.textContent = text;
    cursorEl.style.display = 'none';

    this._bubbleEl.classList.remove('dave-bubble-exiting', 'dave-bubble-glitch');
    this._bubbleEl.classList.add('dave-bubble-visible');
    this._presenceEl.classList.add('dave-speaking');
    this._updateBubblePosition();
  }

  _scheduleBubbleHide() {
    clearTimeout(this._bubbleTimer);
    this._bubbleTimer = setTimeout(() => {
      if (!this._bubbleHoverPaused) this._hideBubble();
    }, BUBBLE_DISPLAY_MS);
  }

  _hideBubble() {
    if (!this._bubbleEl) return;
    clearTimeout(this._bubbleTimer);
    clearTimeout(this._twTimeout);
    this._twGen++; // abort any running typewriter
    this._bubbleHoverPaused = false;

    this._bubbleEl.classList.add('dave-bubble-exiting');
    this._bubbleEl.classList.remove('dave-bubble-visible');
    this._presenceEl?.classList.remove('dave-speaking', 'dave-thinking');

    setTimeout(() => {
      this._bubbleEl?.classList.remove('dave-bubble-exiting', 'dave-bubble-glitch');
    }, BUBBLE_FADE_MS);
  }


  // ============================================================
  //  Bubble Positioning
  // ============================================================

  _updateBubblePosition() {
    if (!this._bubbleEl || !this._presenceEl) return;

    const isDragged = this._presenceEl.classList.contains('dave-dragged');

    // Non-dragged: default CSS positioning (bubble above eye at bottom-right)
    if (!isDragged) {
      this._bubbleEl.style.top = 'auto';
      this._bubbleEl.style.bottom = '60px';
      this._bubbleEl.style.left = 'auto';
      this._bubbleEl.style.right = '8px';
      const tail = this._bubbleEl.querySelector('.dave-bubble-tail');
      if (tail) tail.style.cssText = '';
      return;
    }

    // Read the stored CSS position values directly (avoids bounce animation jitter)
    const eyeX = parseFloat(this._presenceEl.style.left) || 0;
    const eyeY = parseFloat(this._presenceEl.style.top) || 0;
    const eyeCX = eyeX + 16; // center X
    const eyeBottom = eyeY + 32; // bottom edge of eye
    const viewH = window.innerHeight;
    const viewW = window.innerWidth;
    const gap = 10;

    // Put bubble where there's MORE space
    const spaceBelow = viewH - eyeBottom;
    const spaceAbove = eyeY;
    const putBelow = spaceBelow >= spaceAbove;

    if (putBelow) {
      // Bubble below eye
      this._bubbleEl.style.top = (eyeBottom + gap) + 'px';
      this._bubbleEl.style.bottom = 'auto';
    } else {
      // Bubble above eye
      this._bubbleEl.style.top = 'auto';
      this._bubbleEl.style.bottom = (viewH - eyeY + gap) + 'px';
    }

    // Horizontal: center on eye, clamp to viewport
    const bw = 240;
    let left = eyeCX - bw / 2;
    left = Math.max(8, Math.min(left, viewW - bw - 8));
    this._bubbleEl.style.left = left + 'px';
    this._bubbleEl.style.right = 'auto';

    // Tail: point toward eye
    const tail = this._bubbleEl.querySelector('.dave-bubble-tail');
    if (tail) {
      const tailX = Math.max(12, Math.min(eyeCX - left - 5, bw - 24));
      tail.style.left = tailX + 'px';
      tail.style.right = 'auto';
      if (putBelow) {
        // Tail at top of bubble pointing up at eye
        tail.style.top = '-6px';
        tail.style.bottom = 'auto';
        tail.style.transform = 'rotate(225deg)';
      } else {
        // Tail at bottom of bubble pointing down at eye
        tail.style.bottom = '-6px';
        tail.style.top = 'auto';
        tail.style.transform = 'rotate(45deg)';
      }
    }
  }


  // ============================================================
  //  Matrix Typewriter
  // ============================================================

  async _matrixTypewriter(textEl, text, gen, onDone) {
    const tokens = text.match(/\S+|\s+/g) || [];

    for (const token of tokens) {
      if (gen !== this._twGen) return;

      if (/^\s+$/.test(token)) {
        textEl.appendChild(document.createTextNode(token));
        // Thinking pause between words
        await this._tw(40 + Math.random() * 80, gen);
        if (gen !== this._twGen) return;
        continue;
      }

      // Single char or punctuation: instant
      if (token.length <= 1) {
        const sp = document.createElement('span');
        sp.className = 'dave-char dave-char-resolved';
        sp.textContent = token;
        sp.style.opacity = '0';
        textEl.appendChild(sp);
        await this._tw(15, gen);
        if (gen !== this._twGen) return;
        sp.style.opacity = '';
        continue;
      }

      // Create char spans
      const chars = [];
      for (let i = 0; i < token.length; i++) {
        const sp = document.createElement('span');
        sp.className = 'dave-char dave-char-decoding';
        sp.textContent = this._rndChar();
        sp.style.opacity = '0';
        textEl.appendChild(sp);
        chars.push({ span: sp, target: token[i] });
      }

      // Staggered fade-in
      for (let i = 0; i < chars.length; i++) {
        chars[i].span.style.opacity = '';
        if (i % 2 === 0) {
          await this._tw(12, gen);
          if (gen !== this._twGen) return;
        }
      }

      // Decode the word
      await this._decodeWord(chars, gen);
      if (gen !== this._twGen) return;
    }

    if (gen === this._twGen && onDone) onDone();
  }

  async _decodeWord(chars, gen) {
    const len = chars.length;

    // Short words: quick scramble then resolve all at once
    if (len <= 3) {
      const cycles = 2 + Math.floor(Math.random() * 2);
      for (let c = 0; c < cycles; c++) {
        if (gen !== this._twGen) return;
        for (const ch of chars) ch.span.textContent = this._rndChar();
        await this._tw(25, gen);
      }
      if (gen !== this._twGen) return;
      for (const ch of chars) {
        ch.span.textContent = ch.target;
        ch.span.className = 'dave-char dave-char-resolved';
      }
      return;
    }

    // Longer words: scramble + progressive resolve
    const scrambles = 2 + Math.floor(Math.random() * 2);
    for (let c = 0; c < scrambles; c++) {
      if (gen !== this._twGen) return;
      for (const ch of chars) ch.span.textContent = this._rndChar();
      await this._tw(22 + Math.random() * 10, gen);
    }

    // Generate resolve order
    const order = this._resolveOrder(len);

    for (const idx of order) {
      if (gen !== this._twGen) return;
      const ch = chars[idx];
      ch.span.textContent = ch.target;
      ch.span.className = 'dave-char dave-char-resolved';

      // Scramble remaining unresolved
      for (const other of chars) {
        if (!other.span.classList.contains('dave-char-resolved')) {
          other.span.textContent = this._rndChar();
        }
      }
      await this._tw(15 + Math.random() * 15, gen);
    }
  }

  _resolveOrder(len) {
    const r = Math.random();
    const indices = Array.from({ length: len }, (_, i) => i);

    if (r < 0.35) {
      // Left to right
      return indices;
    } else if (r < 0.55) {
      // Right to left
      return indices.reverse();
    } else if (r < 0.75) {
      // Outside in
      const out = [];
      let l = 0, ri = len - 1;
      while (l <= ri) {
        out.push(l);
        if (l !== ri) out.push(ri);
        l++; ri--;
      }
      return out;
    } else {
      // Random shuffle
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      return indices;
    }
  }

  _rndChar() {
    return MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
  }

  _tw(ms, gen) {
    return new Promise(resolve => {
      this._twTimeout = setTimeout(() => {
        resolve();
      }, ms);
    });
  }


  // ============================================================
  //  React Jitter
  // ============================================================

  _reactJitter() {
    if (!this._presenceEl) return;
    clearTimeout(this._reactTimer);
    this._presenceEl.classList.remove('dave-reacting');
    void this._presenceEl.offsetWidth;
    this._presenceEl.classList.add('dave-reacting');
    this._reactTimer = setTimeout(() => {
      this._presenceEl?.classList.remove('dave-reacting');
    }, REACT_JITTER_MS);
  }


  // ============================================================
  //  Event Hooks
  // ============================================================

  _installHooks() {
    const on = (evt, handler) => {
      const bound = (e) => handler.call(this, e.detail || {});
      document.addEventListener(evt, bound);
      this._hooks.push({ evt, bound });
    };
    on('dave:search',      (d) => this._onSearch(d));
    on('dave:sort',        (d) => this._onSort(d));
    on('dave:filter',      (d) => this._onFilter(d));
    on('dave:themeChange', (d) => this._onThemeChange(d));
    on('dave:pageRender',  (d) => this._onPageRender(d));
    on('dave:filesLoaded', (d) => this._onFilesLoaded(d));
    on('dave:fullscreen',  (d) => this._onFullscreen(d));
    on('dave:selection',   (d) => this._onSelection(d));
    on('dave:error',       (d) => this._onError(d));
  }

  _removeHooks() {
    for (const { evt, bound } of this._hooks) document.removeEventListener(evt, bound);
    this._hooks = [];
  }


  // ============================================================
  //  Event Handlers
  // ============================================================

  _onSearch({ term }) {
    this._trackAction('search');
    this._resetIdleTimer();
    this._reactJitter();
    if (!term) this._comment(MSG.search.cleared);
    else this._comment(MSG.search.active, { term });
  }

  _onSort({ field, direction }) {
    this._trackAction('sort');
    this._resetIdleTimer();
    this._reactJitter();
    if (this._session.sortChanges > 3 && Math.random() < 0.4) {
      this._comment(MSG.sort.repeated, { repeatCount: this._session.sortChanges });
    } else {
      this._comment(MSG.sort[field] || MSG.sort.name, { field, direction });
    }
  }

  _onFilter({ count, total }) {
    this._trackAction('filter');
    this._resetIdleTimer();
    this._reactJitter();
    if (count === 0) this._comment(MSG.filter.empty);
    else if (count === total) this._comment(MSG.filter.off);
    else this._comment(MSG.filter.on, { count, total });
  }

  _onThemeChange({ theme }) {
    this._trackAction('theme');
    this._resetIdleTimer();
    this._reactJitter();
    if (this._session.themeChanges > 3 && Math.random() < 0.4) {
      this._comment(MSG.theme.repeated, { themeChanges: this._session.themeChanges });
      return;
    }
    if (theme === 'dark') { this._comment(MSG.theme.darkMode); return; }
    if (theme === 'light') { this._comment(MSG.theme.lightMode); return; }
    const specific = MSG.theme.specific[theme];
    this._comment(specific || MSG.theme.generic, { themeId: theme });
  }

  _onPageRender({ page, total }) {
    this._resetIdleTimer();
    const now = Date.now();
    if (now - this._lastPageTime < RAPID_ACTION_WINDOW_MS) {
      this._lastPage = page;
      this._lastPageTime = now;
      return;
    }
    this._lastPageTime = now;
    if (this._lastPage === -1) { this._lastPage = page; return; }
    this._trackAction('pagination');
    this._reactJitter();
    const dir = page > this._lastPage ? 'forward' : 'backward';
    this._lastPage = page;
    this._comment(MSG.pagination[dir] || MSG.pagination.forward, { page: page + 1, total });
  }

  _onFilesLoaded({ count }) {
    this._session.filesLoaded = count;
    this._resetIdleTimer();
    this._reactJitter();
    this._updateMood(MOOD.IMPRESSED);
    let pool;
    if (count >= 500) pool = MSG.filesLoaded.massive;
    else if (count >= 100) pool = MSG.filesLoaded.large;
    else if (count >= 20) pool = MSG.filesLoaded.medium;
    else pool = MSG.filesLoaded.small;
    this._comment(pool, { count }, { force: true });
  }

  _onFullscreen({ name, type }) {
    this._trackAction('fullscreen');
    this._resetIdleTimer();
    this._reactJitter();
    const map = { glb: 'glb', fbx: 'fbx', video: 'video', image: 'image',
      mp3: 'audio', wav: 'audio', ogg: 'audio', font: 'font' };
    this._comment(MSG.fullscreen[map[type] || 'generic'] || MSG.fullscreen.generic, { name, type });
  }

  _onSelection({ count }) {
    this._trackAction('selection');
    this._resetIdleTimer();
    this._reactJitter();
    if (count === 0) this._comment(MSG.selection.cleared);
    else if (count === 1) this._comment(MSG.selection.first);
    else if (count >= 20) this._comment(MSG.selection.large, { count });
    else this._comment(MSG.selection.growing, { count });
  }

  _onError({ name, type }) {
    this._session.errorsHit++;
    this._resetIdleTimer();
    this._reactJitter();
    this._comment(MSG.error, { name, type });
  }


  // ============================================================
  //  Presence Click + Spam System
  // ============================================================

  _onPresenceClick() {
    // Terminal relay
    if (this._isTerminalActive()) {
      this._updateTerminalLink();
      this._pokeTerminal('click');
      if (Math.random() < 0.3) {
        this._showBubble(this._pickMessage(MSG.terminalRelay, {}), { force: true, terminalRelay: true });
      }
      return;
    }

    // Spam detection
    const now = Date.now();
    this._clickTimestamps.push(now);
    this._clickTimestamps = this._clickTimestamps.filter(t => now - t < SPAM_WINDOW_MS);

    if (this._clickTimestamps.length >= SPAM_THRESHOLD && !this._spamActive) {
      this._clickTimestamps = [];
      this._handleSpamClick();
      return;
    }

    // Normal click
    if (this._bubbleEl?.classList.contains('dave-bubble-visible')) {
      this._hideBubble();
    } else {
      this._showBubble(this._pickMessage(MSG.presenceClick, {}), { force: true });
    }
  }

  _handleSpamClick() {
    if (this._spamActive) return;
    this._spamActive = true;

    // Pick random reaction
    const reaction = SPAM_REACTIONS[Math.floor(Math.random() * SPAM_REACTIONS.length)];

    // Apply CSS class
    this._presenceEl?.classList.add(reaction.css);
    // Remove ambient bounce during spam
    this._presenceEl?.classList.remove('dave-ambient');

    // Special: matrix rain in iris
    if (reaction.id === 'matrix' && this._irisEl) {
      const rainEl = document.createElement('span');
      rainEl.className = 'dave-iris-matrix-rain';
      this._irisEl.appendChild(rainEl);
      this._matrixRainInterval = setInterval(() => {
        let chars = '';
        for (let i = 0; i < 9; i++) chars += this._rndChar();
        rainEl.textContent = chars;
      }, 80);
    }

    // Show message
    const msg = this._pickFromArray(reaction.pool);
    this._showBubble(msg, { force: true });

    // Cleanup after duration
    this._spamCleanupTimer = setTimeout(() => {
      this._presenceEl?.classList.remove(reaction.css);
      if (!this._isDragging) this._presenceEl?.classList.add('dave-ambient');

      if (this._matrixRainInterval) {
        clearInterval(this._matrixRainInterval);
        this._matrixRainInterval = null;
        const rain = this._irisEl?.querySelector('.dave-iris-matrix-rain');
        rain?.remove();
      }

      this._spamActive = false;
    }, reaction.dur);
  }


  // ============================================================
  //  Message Selection
  // ============================================================

  _comment(pool, context = {}, opts = {}) {
    const text = this._pickMessage(pool, context);
    if (text) this._showBubble(text, opts);
  }

  _pickMessage(pool, context) {
    if (!pool || pool.length === 0) return null;
    const weighted = [];
    for (const msg of pool) {
      const w = msg.r === 2 ? 1 : msg.r === 1 ? 2 : 3;
      for (let i = 0; i < w; i++) weighted.push(msg);
    }
    const unseen = weighted.filter(m => !this._shownMessages.has(m.t));
    const cands = unseen.length > 0 ? unseen : weighted;
    const pick = cands[Math.floor(Math.random() * cands.length)];
    this._shownMessages.add(pick.t);
    return this._inject(pick.t, context);
  }

  _pickFromArray(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  _inject(template, ctx) {
    return template.replace(/\{(\w+)\}/g, (m, k) => ctx[k] !== undefined ? ctx[k] : m);
  }


  // ============================================================
  //  Mood System
  // ============================================================

  _updateMood(newMood) {
    this._mood = newMood;
    this._applyMoodClass();
    setTimeout(() => {
      if (this._mood === newMood) {
        this._mood = MOOD.NEUTRAL;
        this._applyMoodClass();
      }
    }, 30000);
  }


  // ============================================================
  //  Cooldown
  // ============================================================

  _canComment() {
    return Date.now() - this._lastCommentTime >= this._getCooldown();
  }

  _getCooldown() {
    return this._mood === MOOD.BUSY ? COOLDOWN_BUSY_MS : COOLDOWN_DEFAULT_MS;
  }

  _recordComment() {
    this._lastCommentTime = Date.now();
  }


  // ============================================================
  //  Action Tracking
  // ============================================================

  _trackAction(action) {
    this._session[action + 'Changes'] = (this._session[action + 'Changes'] || 0) + 1;
    const now = Date.now();
    if (this._lastAction === action && now - this._lastActionTime < 3000) {
      this._actionCounts[action] = (this._actionCounts[action] || 1) + 1;
      if (this._actionCounts[action] >= 3) this._updateMood(MOOD.BUSY);
    } else {
      this._actionCounts[action] = 1;
    }
    if (this._actionCounts[action] >= 5) this._updateMood(MOOD.SNARKY);
    this._lastAction = action;
    this._lastActionTime = now;
    this._updateTerminalLink();
  }


  // ============================================================
  //  Idle Detection
  // ============================================================

  _startIdleTimer() { this._resetIdleTimer(); }

  _resetIdleTimer() {
    clearTimeout(this._idleTimer);
    this._presenceEl?.classList.remove('dave-sleeping');
    if (this._mood === MOOD.BORED) {
      this._mood = MOOD.NEUTRAL;
      this._applyMoodClass();
    }
    this._stopAttentionSeeking();
    // Resume ambient bounce if it was stopped
    if (this._presenceEl && !this._isDragging && !this._spamActive) {
      this._presenceEl.classList.add('dave-ambient');
    }
    this._idleTimer = setTimeout(() => this._handleIdle(), IDLE_TIMEOUT_MS);
  }

  _stopIdleTimer() { clearTimeout(this._idleTimer); }

  _handleIdle() {
    if (!this._enabled) return;
    this._updateMood(MOOD.BORED);
    this._presenceEl?.classList.add('dave-sleeping');

    const sessionMinutes = Math.floor((Date.now() - this._session.startTime) / 60000);
    if (!this._isTerminalActive()) {
      this._showBubble(
        this._pickMessage(MSG.idle, { sessionMinutes, visits: this._visits }),
        { force: true }
      );
    }

    this._startAttentionSeeking();
    this._idleTimer = setTimeout(() => this._handleIdle(), IDLE_TIMEOUT_MS * 2);
  }
}


// ============================================================
//  Singleton Export
// ============================================================
export const DaveMode = new _DaveMode();
