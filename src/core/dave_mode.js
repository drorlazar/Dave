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

// Mutable config — debug dashboard can override at runtime
const DAVE_CONFIG = {
  COOLDOWN_DEFAULT_MS: 7000,
  COOLDOWN_BUSY_MS: 12000,
  BUBBLE_DISPLAY_MS: 5500,
  BUBBLE_FADE_MS: 250,
  IDLE_TIMEOUT_MS: 35000,
  REACT_JITTER_MS: 300,
  RAPID_ACTION_WINDOW_MS: 2000,
  BLINK_MIN_MS: 2500,
  BLINK_MAX_MS: 6000,
  BLINK_DURATION_MS: 120,
  ATTENTION_FIRST_MS: 50000,
  ATTENTION_REPEAT_MS: 25000,
  CURSOR_FOLLOW_RADIUS: 150,
  CURSOR_FOLLOW_MAX_DISP: 3.5,
  CURSOR_IDLE_MS: 2000,
  SPAM_WINDOW_MS: 2500,
  SPAM_THRESHOLD: 4,
  TERMINAL_CHECK_MS: 2000,
  TEAR_DURATION_MS: 5000,
  TEAR_TRAIL_MAX: 7,
  TEAR_STEP_MS: 80,
  TEAR_LEAD_SCRAMBLE_MS: 50,
  DRAG_TRAIL_INTERVAL_MS: 50,
  DRAG_TRAIL_LIFETIME_MS: 750,
  TEAR_LEAD_LIFE_MS: 2000,
  TEAR_TRAIL_LIFE_MS: 750,
  TEAR_FALL_DISTANCE: 120,
  TEAR_SHED_MS: 120,
  DRAG_TRAIL_LIFE_MS: 600,
  TEAR_BURST_SPEED: 120,
  FIREWORK_COOLDOWN_MS: 180000,
  TYPEWRITER_WORD_PAUSE_MIN: 40,
  TYPEWRITER_WORD_PAUSE_MAX: 120,
};

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
//  Emotion System
// ============================================================
// Each emotion drives eye color, bubble text color, and optional tear
const EMOTION = {
  NEUTRAL:     'neutral',
  AMUSED:      'amused',
  CURIOUS:     'curious',
  PROUD:       'proud',
  ANNOYED:     'annoyed',
  SAD:         'sad',
  ALARMED:     'alarmed',
  WARM:        'warm',
  SASSY:       'sassy',
  EXISTENTIAL: 'existential',
  SMUG:        'smug',
};

// Map message contexts to emotions (used by event handlers)
const EMOTION_MAP = {
  'search.active':     EMOTION.CURIOUS,
  'search.cleared':    EMOTION.NEUTRAL,
  'sort.name':         EMOTION.NEUTRAL,
  'sort.size':         EMOTION.CURIOUS,
  'sort.type':         EMOTION.NEUTRAL,
  'sort.date':         EMOTION.NEUTRAL,
  'sort.repeated':     EMOTION.ANNOYED,
  'filter.on':         EMOTION.SMUG,
  'filter.off':        EMOTION.NEUTRAL,
  'filter.empty':      EMOTION.SAD,
  'theme.darkMode':    EMOTION.SMUG,
  'theme.lightMode':   EMOTION.ANNOYED,
  'theme.generic':     EMOTION.CURIOUS,
  'theme.repeated':    EMOTION.SASSY,
  'filesLoaded.small': EMOTION.WARM,
  'filesLoaded.medium':EMOTION.AMUSED,
  'filesLoaded.large': EMOTION.PROUD,
  'filesLoaded.massive':EMOTION.PROUD,
  'fullscreen.glb':    EMOTION.CURIOUS,
  'fullscreen.fbx':    EMOTION.CURIOUS,
  'fullscreen.image':  EMOTION.WARM,
  'fullscreen.video':  EMOTION.AMUSED,
  'fullscreen.audio':  EMOTION.WARM,
  'fullscreen.font':   EMOTION.CURIOUS,
  'fullscreen.generic':EMOTION.NEUTRAL,
  'pagination.forward': EMOTION.NEUTRAL,
  'pagination.backward':EMOTION.CURIOUS,
  'selection.first':   EMOTION.CURIOUS,
  'selection.growing': EMOTION.AMUSED,
  'selection.large':   EMOTION.ANNOYED,
  'selection.cleared': EMOTION.NEUTRAL,
  'error':             EMOTION.ALARMED,
  'idle':              EMOTION.EXISTENTIAL,
  'presenceClick':     EMOTION.AMUSED,
  'drag.drop':         EMOTION.AMUSED,
  'drag.corner':       EMOTION.SAD,
  'toggle.off':        EMOTION.SAD,
  'toggle.on':         EMOTION.PROUD,
};

// Emotions that can trigger tears (digital matrix stream from eye)
const TEAR_EMOTIONS = new Set([EMOTION.SAD, EMOTION.EXISTENTIAL]);
// Emotions with a chance of a single subtle tear
const SUBTLE_TEAR_EMOTIONS = new Set([EMOTION.ANNOYED, EMOTION.ALARMED]);
// Emotions that can trigger fireworks (excited reactions)
const FIREWORK_EMOTIONS = new Set([EMOTION.PROUD, EMOTION.AMUSED, EMOTION.SMUG]);

const TEAR_CHARS = 'ABCDEFGHKMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz01'; // pragma: allowlist secret


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

    // Emotion + tear
    this._currentEmotion = EMOTION.NEUTRAL;
    this._tearEl = null;
    this._tearTimer = null;
    this._tearDropIntervals = [];   // one per drop column

    // Drag trail
    this._dragTrailInterval = null;
    this._dragTrailEnabled = true;

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
      this._showBubble(this._pickFromArray(pool), { force: true, emotion: EMOTION.PROUD });
    }
  }

  disable(showReaction = true) {
    if (!this._enabled) return;

    if (showReaction) {
      this._setEmotion(EMOTION.SAD);
      this._triggerTear(EMOTION.SAD, { burst: true });
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
    this._stopTear();
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
      <div class="dave-tear"></div>
      <div class="dave-presence-pulse"></div>
    `;
    document.body.appendChild(p);
    this._presenceEl = p;
    this._irisEl = p.querySelector('.dave-presence-iris');
    this._tearEl = p.querySelector('.dave-tear');

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
    this._startDragTrail();

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
    this._clearEmotion();
    this._stopTear();

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
    this._stopDragTrail();
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
            this._triggerTear(EMOTION.SAD, { heavy: true });
            this._comment(MSG.drag.corner, {}, { force: true, emotion: EMOTION.SAD });
          } else {
            this._comment(MSG.drag.drop, {}, { force: true, emotion: EMOTION.AMUSED });
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
    const delay = DAVE_CONFIG.BLINK_MIN_MS + Math.random() * (DAVE_CONFIG.BLINK_MAX_MS - DAVE_CONFIG.BLINK_MIN_MS);
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
          }, DAVE_CONFIG.BLINK_DURATION_MS);
        }, 140);
      } else {
        this._scheduleBlink();
      }
    }, DAVE_CONFIG.BLINK_DURATION_MS);
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

    if (dist < DAVE_CONFIG.CURSOR_FOLLOW_RADIUS && dist > 5) {
      // Inside radius: follow cursor
      const factor = Math.min(dist / DAVE_CONFIG.CURSOR_FOLLOW_RADIUS, 1);
      const ix = (dx / dist) * DAVE_CONFIG.CURSOR_FOLLOW_MAX_DISP * factor;
      const iy = (dy / dist) * DAVE_CONFIG.CURSOR_FOLLOW_MAX_DISP * factor;

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
      }, DAVE_CONFIG.CURSOR_IDLE_MS);

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
    this._attentionTimer = setTimeout(() => this._seekAttention(), DAVE_CONFIG.ATTENTION_FIRST_MS);
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

    this._attentionTimer = setTimeout(() => this._seekAttention(), DAVE_CONFIG.ATTENTION_REPEAT_MS);
  }


  // ============================================================
  //  Terminal Coordination
  // ============================================================

  _startTerminalCheck() {
    this._terminalCheckInterval = setInterval(() => this._updateTerminalLink(), DAVE_CONFIG.TERMINAL_CHECK_MS);
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
      const ix = (dx / dist) * DAVE_CONFIG.CURSOR_FOLLOW_MAX_DISP;
      const iy = (dy / dist) * DAVE_CONFIG.CURSOR_FOLLOW_MAX_DISP;
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

    // Apply emotion color
    const emotion = opts.emotion || EMOTION.NEUTRAL;
    this._setEmotion(emotion);

    // Trigger tear if appropriate
    if (TEAR_EMOTIONS.has(emotion) || SUBTLE_TEAR_EMOTIONS.has(emotion)) {
      this._triggerTear(emotion);
    }

    // Fireworks for excited emotions — rare and special
    if (FIREWORK_EMOTIONS.has(emotion)) {
      const now = Date.now();
      const cooldown = DAVE_CONFIG.FIREWORK_COOLDOWN_MS;
      const elapsed = now - (this._lastFireworksTime || 0);
      if (elapsed >= cooldown && Math.random() < 0.15) {
        this._lastFireworksTime = now;
        this._triggerFireworks();
      }
    }

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
    }, DAVE_CONFIG.BUBBLE_DISPLAY_MS);
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
    this._clearEmotion();

    setTimeout(() => {
      this._bubbleEl?.classList.remove('dave-bubble-exiting', 'dave-bubble-glitch');
    }, DAVE_CONFIG.BUBBLE_FADE_MS);
  }


  // ============================================================
  //  Bubble Positioning
  // ============================================================

  _updateBubblePosition() {
    if (!this._bubbleEl || !this._presenceEl) return;

    // Always reset all 4 sides first to prevent stretching
    // (fixed elements stretch when both top+bottom or left+right are set)
    this._bubbleEl.style.top = 'auto';
    this._bubbleEl.style.bottom = 'auto';
    this._bubbleEl.style.left = 'auto';
    this._bubbleEl.style.right = 'auto';

    const isDragged = this._presenceEl.classList.contains('dave-dragged');

    // Non-dragged: default CSS positioning (bubble above eye at bottom-right)
    if (!isDragged) {
      this._bubbleEl.style.bottom = '60px';
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
        await this._tw(DAVE_CONFIG.TYPEWRITER_WORD_PAUSE_MIN + Math.random() * (DAVE_CONFIG.TYPEWRITER_WORD_PAUSE_MAX - DAVE_CONFIG.TYPEWRITER_WORD_PAUSE_MIN), gen);
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
    }, DAVE_CONFIG.REACT_JITTER_MS);
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
    if (!term) this._comment(MSG.search.cleared, {}, { emotion: EMOTION.NEUTRAL });
    else this._comment(MSG.search.active, { term }, { emotion: EMOTION.CURIOUS });
  }

  _onSort({ field, direction }) {
    this._trackAction('sort');
    this._resetIdleTimer();
    this._reactJitter();
    if (this._session.sortChanges > 3 && Math.random() < 0.4) {
      this._comment(MSG.sort.repeated, { repeatCount: this._session.sortChanges }, { emotion: EMOTION.ANNOYED });
    } else {
      this._comment(MSG.sort[field] || MSG.sort.name, { field, direction }, { emotion: EMOTION.NEUTRAL });
    }
  }

  _onFilter({ count, total }) {
    this._trackAction('filter');
    this._resetIdleTimer();
    this._reactJitter();
    if (count === 0) this._comment(MSG.filter.empty, {}, { emotion: EMOTION.SAD });
    else if (count === total) this._comment(MSG.filter.off, {}, { emotion: EMOTION.NEUTRAL });
    else this._comment(MSG.filter.on, { count, total }, { emotion: EMOTION.SMUG });
  }

  _onThemeChange({ theme }) {
    this._trackAction('theme');
    this._resetIdleTimer();
    this._reactJitter();
    if (this._session.themeChanges > 3 && Math.random() < 0.4) {
      this._comment(MSG.theme.repeated, { themeChanges: this._session.themeChanges }, { emotion: EMOTION.SASSY });
      return;
    }
    if (theme === 'dark') { this._comment(MSG.theme.darkMode, {}, { emotion: EMOTION.SMUG }); return; }
    if (theme === 'light') { this._comment(MSG.theme.lightMode, {}, { emotion: EMOTION.ANNOYED }); return; }
    const specific = MSG.theme.specific[theme];
    this._comment(specific || MSG.theme.generic, { themeId: theme }, { emotion: EMOTION.CURIOUS });
  }

  _onPageRender({ page, total }) {
    this._resetIdleTimer();
    const now = Date.now();
    if (now - this._lastPageTime < DAVE_CONFIG.RAPID_ACTION_WINDOW_MS) {
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
    this._comment(MSG.pagination[dir] || MSG.pagination.forward, { page: page + 1, total }, { emotion: EMOTION.NEUTRAL });
  }

  _onFilesLoaded({ count }) {
    this._session.filesLoaded = count;
    this._resetIdleTimer();
    this._reactJitter();
    this._updateMood(MOOD.IMPRESSED);
    let pool, emo;
    if (count >= 500) { pool = MSG.filesLoaded.massive; emo = EMOTION.PROUD; }
    else if (count >= 100) { pool = MSG.filesLoaded.large; emo = EMOTION.PROUD; }
    else if (count >= 20) { pool = MSG.filesLoaded.medium; emo = EMOTION.AMUSED; }
    else { pool = MSG.filesLoaded.small; emo = EMOTION.WARM; }
    this._comment(pool, { count }, { force: true, emotion: emo });
  }

  _onFullscreen({ name, type }) {
    this._trackAction('fullscreen');
    this._resetIdleTimer();
    this._reactJitter();
    const map = { glb: 'glb', fbx: 'fbx', video: 'video', image: 'image',
      mp3: 'audio', wav: 'audio', ogg: 'audio', font: 'font' };
    const key = map[type] || 'generic';
    const emoMap = { glb: EMOTION.CURIOUS, fbx: EMOTION.CURIOUS, image: EMOTION.WARM, video: EMOTION.AMUSED, audio: EMOTION.WARM, font: EMOTION.CURIOUS };
    this._comment(MSG.fullscreen[key] || MSG.fullscreen.generic, { name, type }, { emotion: emoMap[key] || EMOTION.NEUTRAL });
  }

  _onSelection({ count }) {
    this._trackAction('selection');
    this._resetIdleTimer();
    this._reactJitter();
    if (count === 0) this._comment(MSG.selection.cleared, {}, { emotion: EMOTION.NEUTRAL });
    else if (count === 1) this._comment(MSG.selection.first, {}, { emotion: EMOTION.CURIOUS });
    else if (count >= 20) this._comment(MSG.selection.large, { count }, { emotion: EMOTION.ANNOYED });
    else this._comment(MSG.selection.growing, { count }, { emotion: EMOTION.AMUSED });
  }

  _onError({ name, type }) {
    this._session.errorsHit++;
    this._resetIdleTimer();
    this._reactJitter();
    this._comment(MSG.error, { name, type }, { emotion: EMOTION.ALARMED });
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
        this._showBubble(this._pickMessage(MSG.terminalRelay, {}), { force: true, terminalRelay: true, emotion: EMOTION.AMUSED });
      }
      return;
    }

    // Spam detection
    const now = Date.now();
    this._clickTimestamps.push(now);
    this._clickTimestamps = this._clickTimestamps.filter(t => now - t < DAVE_CONFIG.SPAM_WINDOW_MS);

    if (this._clickTimestamps.length >= DAVE_CONFIG.SPAM_THRESHOLD && !this._spamActive) {
      this._clickTimestamps = [];
      this._handleSpamClick();
      return;
    }

    // Normal click
    if (this._bubbleEl?.classList.contains('dave-bubble-visible')) {
      this._hideBubble();
    } else {
      this._showBubble(this._pickMessage(MSG.presenceClick, {}), { force: true, emotion: EMOTION.AMUSED });
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

    // Show message with matching emotion
    const spamEmotions = { hal: EMOTION.ALARMED, matrix: EMOTION.EXISTENTIAL, hurt: EMOTION.ALARMED, shuteye: EMOTION.SAD, glare: EMOTION.ANNOYED, dizzy: EMOTION.SASSY };
    const msg = this._pickFromArray(reaction.pool);
    this._showBubble(msg, { force: true, emotion: spamEmotions[reaction.id] || EMOTION.NEUTRAL });

    // Tears for dramatic spam reactions
    if (reaction.id === 'shuteye') this._triggerTear(EMOTION.SAD, { burst: true });
    else if (reaction.id === 'hurt') this._triggerTear(EMOTION.ALARMED);

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
    if (text) this._showBubble(text, { emotion: opts.emotion, ...opts });
  }

  // ============================================================
  //  Emotion + Tear System
  // ============================================================

  _setEmotion(emotion) {
    this._currentEmotion = emotion || EMOTION.NEUTRAL;
    if (this._presenceEl) {
      if (emotion && emotion !== EMOTION.NEUTRAL) {
        this._presenceEl.setAttribute('data-emotion', emotion);
      } else {
        this._presenceEl.removeAttribute('data-emotion');
      }
    }
  }

  _clearEmotion() {
    this._currentEmotion = EMOTION.NEUTRAL;
    // Fade emotion back to neutral after bubble hides (delayed for smooth transition)
    setTimeout(() => {
      if (this._currentEmotion === EMOTION.NEUTRAL) {
        this._presenceEl?.removeAttribute('data-emotion');
      }
    }, 600);
  }

  /**
   * Position-based tear: lead char falls from eye center leaving trail chars behind.
   * Lead: 2s lifespan, falls ~120px, scrambles chars, fades in last 25%.
   * Trail: each shed char lives 750ms, scrambles, fades to death.
   */
  _triggerTear(emotion, opts = {}) {
    if (!this._presenceEl) return;
    const subtle = SUBTLE_TEAR_EMOTIONS.has(emotion);
    const burst = opts.burst === true;
    const heavy = opts.heavy === true;

    if (subtle && !burst && !heavy && Math.random() > 0.3) return;

    this._stopTear();

    const rect = this._presenceEl.getBoundingClientRect();
    const eyeCX = rect.left + rect.width / 2;
    const eyeCY = rect.top + rect.height / 2;
    const color = this._getIrisColor();

    if (burst) {
      // Burst: fountain of tears — shoot up fast, arc over, rain down.
      // Two rapid waves (0-80ms gap) for a sudden "gush" that stops quickly.
      // Each stream gets randomized lifespan, gravity (mass), drag, and shed rate
      // so they break apart naturally instead of moving in lockstep.
      const baseSpeed = DAVE_CONFIG.TEAR_BURST_SPEED;
      const baseGrav = baseSpeed * 1.8;
      const wave1 = 8 + Math.floor(Math.random() * 3);
      for (let i = 0; i < wave1; i++) {
        const spread = (Math.random() - 0.5) * 30;
        const spreadRad = (spread * Math.PI) / 180;
        const speed = baseSpeed * (0.7 + Math.random() * 0.6); // wider speed range
        const vx = Math.sin(spreadRad) * speed;
        const vy = -Math.cos(spreadRad) * speed;
        const delay = Math.random() * 80;
        const tid = setTimeout(() => {
          this._startTearStream(eyeCX + (Math.random() - 0.5) * 12, eyeCY, color, {
            vx, vy,
            gravity: baseGrav * (0.7 + Math.random() * 0.6),   // ±30% mass variation
            drag: 0.96 + Math.random() * 0.035,                // 0.960-0.995 — some float longer
            lifeMul: 0.7 + Math.random() * 0.6,                // 70-130% lifespan
            trailLifeMul: 0.6 + Math.random() * 0.8,           // 60-140% trail life
            shedMul: 0.7 + Math.random() * 0.6,                // faster/slower shedding
          });
        }, delay);
        this._tearDropIntervals.push(tid);
      }
      // Wave 2: weaker follow-up
      const wave2 = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < wave2; i++) {
        const spread = (Math.random() - 0.5) * 24;
        const spreadRad = (spread * Math.PI) / 180;
        const speed = baseSpeed * (0.5 + Math.random() * 0.4);
        const vx = Math.sin(spreadRad) * speed;
        const vy = -Math.cos(spreadRad) * speed;
        const delay = 100 + Math.random() * 100;
        const tid = setTimeout(() => {
          this._startTearStream(eyeCX + (Math.random() - 0.5) * 8, eyeCY, color, {
            vx, vy,
            gravity: baseGrav * (0.6 + Math.random() * 0.5),
            drag: 0.96 + Math.random() * 0.035,
            lifeMul: 0.6 + Math.random() * 0.5,
            trailLifeMul: 0.5 + Math.random() * 0.7,
            shedMul: 0.8 + Math.random() * 0.5,
          });
        }, delay);
        this._tearDropIntervals.push(tid);
      }
    } else if (heavy) {
      // Heavy: 4-5 streams spread across eye width, falling straight down.
      // Each stream gets randomized fall distance, lifespan, and shed rate.
      const dropCount = 4 + Math.floor(Math.random() * 2);
      const spreadPx = 28;
      for (let d = 0; d < dropCount; d++) {
        const offsetX = ((d / (dropCount - 1)) - 0.5) * spreadPx;
        const delay = Math.random() * 400;
        const tid = setTimeout(() => {
          this._startTearStream(eyeCX + offsetX + (Math.random() - 0.5) * 6, eyeCY, color, {
            lifeMul: 0.7 + Math.random() * 0.6,
            trailLifeMul: 0.6 + Math.random() * 0.8,
            fallMul: 0.7 + Math.random() * 0.6,
            shedMul: 0.7 + Math.random() * 0.6,
          });
        }, delay);
        this._tearDropIntervals.push(tid);
      }
    } else {
      // Single: exactly 1 stream straight down
      this._startTearStream(eyeCX, eyeCY, color);
    }

    const duration = burst ? DAVE_CONFIG.TEAR_DURATION_MS + 2000 : DAVE_CONFIG.TEAR_DURATION_MS;
    this._tearTimer = setTimeout(() => this._stopTear(), duration);
  }

  /** Single lead char that sheds trail chars as it moves.
   *  Default: linear fall straight down (single/heavy tears).
   *  With { vx, vy, gravity }: drag-based physics with "hang at apex" (burst).
   *  Per-stream multipliers (lifeMul, trailLifeMul, fallMul, shedMul, drag) randomize each stream. */
  _startTearStream(startX, startY, color, streamOpts = {}) {
    const lifeMul = streamOpts.lifeMul || 1;
    const trailLifeMul = streamOpts.trailLifeMul || 1;
    const fallMul = streamOpts.fallMul || 1;
    const shedMul = streamOpts.shedMul || 1;

    const leadLife = DAVE_CONFIG.TEAR_LEAD_LIFE_MS * lifeMul;
    const trailLife = DAVE_CONFIG.TEAR_TRAIL_LIFE_MS * trailLifeMul;
    const fallDist = DAVE_CONFIG.TEAR_FALL_DISTANCE * fallMul;
    const shedInterval = DAVE_CONFIG.TEAR_SHED_MS * shedMul;
    const scrambleMs = DAVE_CONFIG.TEAR_LEAD_SCRAMBLE_MS;
    const fadeStart = 0.75;

    // Physics mode uses per-frame drag + gravity (not raw projectile formula).
    // Drag creates the "hang at apex" effect — velocity decays exponentially,
    // then gravity slowly wins and pulls the tear down.
    const hasPhysics = streamOpts.vx != null;
    let vx = streamOpts.vx || 0;
    let vy = streamOpts.vy || 0;
    const grav = streamOpts.gravity || 0;
    const drag = streamOpts.drag || 0.98;

    const lead = document.createElement('span');
    lead.className = 'dave-tear-lead-char';
    lead.textContent = this._rndTearChar();
    lead.style.left = startX + 'px';
    lead.style.top = startY + 'px';
    lead.style.color = '#fff';
    lead.style.textShadow = `0 0 8px ${color}, 0 0 16px ${color}`;
    document.body.appendChild(lead);

    let posX = startX, posY = startY;
    const born = performance.now();
    let lastShed = born;
    const dt = 1 / 60;

    const animate = () => {
      const now = performance.now();
      const elapsed = now - born;
      const progress = Math.min(elapsed / leadLife, 1);

      if (hasPhysics) {
        // Drag-based: decelerate, then gravity pulls down
        vx *= drag;
        vy *= drag;
        vy += grav * dt;
        posX += vx * dt;
        posY += vy * dt;
      } else {
        // Simple linear fall straight down
        const dist = progress * fallDist;
        posX = startX + Math.sin(elapsed * 0.01) * 1.5;
        posY = startY + dist;
      }

      lead.style.left = posX + 'px';
      lead.style.top = posY + 'px';

      // Fade in last 25%
      if (progress > fadeStart) {
        const fadeProg = (progress - fadeStart) / (1 - fadeStart);
        lead.style.opacity = (1 - fadeProg).toString();
      }

      // Shed trail char periodically
      if (now - lastShed >= shedInterval) {
        lastShed = now;
        this._spawnTearTrailChar(posX, posY, color, trailLife);
      }

      if (progress < 1 && lead.parentNode) {
        this._tearDropIntervals.push(requestAnimationFrame(animate));
      } else {
        lead.remove();
      }
    };

    const scrambleId = setInterval(() => {
      if (!lead.parentNode) { clearInterval(scrambleId); return; }
      lead.textContent = this._rndTearChar();
    }, scrambleMs);
    this._tearDropIntervals.push(scrambleId);

    this._tearDropIntervals.push(requestAnimationFrame(animate));
  }

  /** Trail char left behind by a falling lead — fades and scrambles over its lifespan. */
  _spawnTearTrailChar(x, y, color, lifeMs) {
    const ch = document.createElement('span');
    ch.className = 'dave-tear-trail-char';
    ch.textContent = this._rndTearChar();
    ch.style.left = x + 'px';
    ch.style.top = y + 'px';
    ch.style.color = color;
    ch.style.textShadow = `0 0 5px ${color}`;
    ch.style.opacity = '0.8';
    document.body.appendChild(ch);

    const born = performance.now();

    // Scramble + fade loop
    const tick = () => {
      const age = performance.now() - born;
      if (age >= lifeMs || !ch.parentNode) { ch.remove(); return; }
      // Fade linearly
      ch.style.opacity = (0.8 * (1 - age / lifeMs)).toString();
      // Scramble char
      if (Math.random() < 0.35) ch.textContent = this._rndTearChar();
      this._tearDropIntervals.push(requestAnimationFrame(tick));
    };
    this._tearDropIntervals.push(requestAnimationFrame(tick));
  }

  _rndTearChar() {
    return TEAR_CHARS[Math.floor(Math.random() * TEAR_CHARS.length)];
  }

  _getIrisColor() {
    if (!this._presenceEl) return '#00ff41';
    return getComputedStyle(this._presenceEl).getPropertyValue('--dave-iris').trim() || '#00ff41';
  }

  _stopTear() {
    for (const id of this._tearDropIntervals) {
      clearTimeout(id);
      clearInterval(id);
      cancelAnimationFrame(id);
    }
    this._tearDropIntervals = [];
    clearTimeout(this._tearTimer);
    this._tearTimer = null;
    // Clean up any lingering tear elements
    document.querySelectorAll('.dave-tear-lead-char, .dave-tear-trail-char').forEach(el => el.remove());
  }

  // ---- Fireworks ----
  // Research-based: three phases (burst→hang→fall), drag deceleration,
  // color shift white→color→dim, secondary crackle sparks at end.

  _triggerFireworks() {
    if (!this._presenceEl) return;
    const rect = this._presenceEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const irisColor = this._getIrisColor();

    const SPARKS = ['*', '+', '·', '✦', '✧'];
    const PALETTE = [irisColor, '#ffdd44', '#ff8844', '#44ffaa', '#ff44aa', '#44aaff'];
    // Pick 2-3 dominant colors for this burst (real fireworks use a limited palette)
    const burstColors = [];
    for (let i = 0; i < 2 + Math.round(Math.random()); i++) {
      burstColors.push(PALETTE[Math.floor(Math.random() * PALETTE.length)]);
    }

    const count = 35 + Math.floor(Math.random() * 15); // 35-50 main sparks
    const drag = 0.97;   // velocity multiplier per frame (~3% drag)
    const gravity = 60;   // px/s² — gentle gravity so sparks "hang"
    const fps60dt = 1 / 60;

    // All sparks fire within 20ms — instant burst
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      // Same speed ±20% for spherical burst shape
      const baseSpd = 160 + Math.random() * 80; // 160-240 px/s
      let vx = Math.cos(angle) * baseSpd;
      let vy = Math.sin(angle) * baseSpd;
      const sparkColor = burstColors[Math.floor(Math.random() * burstColors.length)];
      const life = 1200 + Math.random() * 800; // 1.2-2.0s
      const hasTrail = Math.random() < 0.4; // 40% of sparks leave trails
      const hasCrackle = Math.random() < 0.2; // 20% spawn secondary crackle

      const spark = document.createElement('span');
      spark.className = 'dave-firework-spark';
      spark.textContent = SPARKS[Math.floor(Math.random() * SPARKS.length)];
      spark.style.left = cx + 'px';
      spark.style.top = cy + 'px';
      // Phase 1: start white-hot
      spark.style.color = '#ffffff';
      spark.style.textShadow = `0 0 8px ${sparkColor}, 0 0 16px ${sparkColor}`;
      document.body.appendChild(spark);

      let posX = cx, posY = cy;
      const born = performance.now();
      let lastTrailTime = born;
      let crackled = false;

      const tick = () => {
        const now = performance.now();
        const elapsed = now - born;
        if (elapsed >= life || !spark.parentNode) { spark.remove(); return; }
        const progress = elapsed / life; // 0→1

        // Apply drag (exponential deceleration — creates "hang" effect)
        vx *= drag;
        vy *= drag;
        // Apply gravity
        vy += gravity * fps60dt;

        posX += vx * fps60dt;
        posY += vy * fps60dt;
        spark.style.left = posX + 'px';
        spark.style.top = posY + 'px';

        // Color shift: white(0-15%) → bright color(15-50%) → dimmed(50-100%)
        if (progress < 0.15) {
          spark.style.color = '#ffffff';
        } else if (progress < 0.5) {
          spark.style.color = sparkColor;
          const glowFade = 1 - (progress - 0.15) / 0.35;
          spark.style.textShadow = `0 0 ${6 * glowFade}px ${sparkColor}, 0 0 ${12 * glowFade}px ${sparkColor}`;
        } else {
          spark.style.color = sparkColor;
          spark.style.textShadow = 'none';
        }

        // Size shrink in final 40%
        if (progress > 0.6) {
          const shrink = 1 - (progress - 0.6) / 0.4;
          spark.style.fontSize = (11 * Math.max(shrink, 0.3)) + 'px';
        }

        // Fade: hold full opacity until 50%, then fade out
        if (progress > 0.5) {
          const fadeProg = (progress - 0.5) / 0.5;
          spark.style.opacity = (1 - fadeProg).toString();
        }

        // Trail: leave ghost afterimage every 80ms
        if (hasTrail && now - lastTrailTime > 80 && progress < 0.7) {
          lastTrailTime = now;
          this._spawnFireworkTrail(posX, posY, sparkColor, progress);
        }

        // Crackle: secondary micro-burst at 85% life
        if (hasCrackle && !crackled && progress > 0.85) {
          crackled = true;
          this._spawnCrackle(posX, posY, sparkColor);
        }

        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  }

  /** Tiny ghost afterimage left by a firework spark */
  _spawnFireworkTrail(x, y, color, progress) {
    const ghost = document.createElement('span');
    ghost.className = 'dave-firework-trail';
    ghost.textContent = '.';
    ghost.style.left = x + 'px';
    ghost.style.top = y + 'px';
    ghost.style.color = color;
    ghost.style.opacity = String(0.5 * (1 - progress));
    document.body.appendChild(ghost);
    setTimeout(() => ghost.remove(), 300);
  }

  /** Secondary micro-sparks when a firework crackles at end of life */
  _spawnCrackle(x, y, color) {
    const n = 4 + Math.floor(Math.random() * 4); // 4-7 micro-sparks
    for (let i = 0; i < n; i++) {
      const sp = document.createElement('span');
      sp.className = 'dave-firework-spark';
      sp.textContent = '·';
      sp.style.left = x + 'px';
      sp.style.top = y + 'px';
      sp.style.color = '#ffffff';
      sp.style.textShadow = `0 0 4px ${color}`;
      sp.style.fontSize = '8px';
      document.body.appendChild(sp);

      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 40;
      let vx = Math.cos(angle) * speed;
      let vy = Math.sin(angle) * speed;
      const life = 250 + Math.random() * 200;
      const born = performance.now();

      const tick = () => {
        const elapsed = performance.now() - born;
        if (elapsed >= life || !sp.parentNode) { sp.remove(); return; }
        vx *= 0.94;
        vy *= 0.94;
        vy += 40 / 60;
        const px = parseFloat(sp.style.left) + vx / 60;
        const py = parseFloat(sp.style.top) + vy / 60;
        sp.style.left = px + 'px';
        sp.style.top = py + 'px';
        sp.style.opacity = String(1 - elapsed / life);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  }

  // ---- Drag Trail ----
  _startDragTrail() {
    if (!this._dragTrailEnabled) return;
    this._stopDragTrail();
    this._dragTrailInterval = setInterval(() => {
      if (!this._presenceEl || !this._isDragging) return;
      const rect = this._presenceEl.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      this._spawnDragTrailChar(cx, cy);
    }, DAVE_CONFIG.DRAG_TRAIL_INTERVAL_MS);
  }

  _stopDragTrail() {
    if (this._dragTrailInterval) {
      clearInterval(this._dragTrailInterval);
      this._dragTrailInterval = null;
    }
  }

  _spawnDragTrailChar(x, y) {
    const color = this._getIrisColor();
    const lifetime = DAVE_CONFIG.DRAG_TRAIL_LIFETIME_MS;

    // Lead falling char
    const ch = document.createElement('span');
    ch.className = 'dave-drag-trail-char';
    ch.textContent = this._rndTearChar();
    const jitter = (Math.random() - 0.5) * 14;
    ch.style.left = (x + jitter) + 'px';
    ch.style.top = y + 'px';
    ch.style.color = color;
    ch.style.textShadow = `0 0 6px ${color}`;
    document.body.appendChild(ch);

    // Scramble while falling
    let sc = 0;
    const sid = setInterval(() => {
      if (sc >= 3 || !ch.parentNode) { clearInterval(sid); return; }
      ch.textContent = this._rndTearChar();
      sc++;
    }, 80);
    setTimeout(() => ch.remove(), lifetime);

    // Trail behind it: 2 chars that stay roughly where the lead was
    for (let i = 0; i < 2; i++) {
      setTimeout(() => {
        const tr = document.createElement('span');
        tr.className = 'dave-drag-trail-char dave-drag-trail-fade';
        tr.textContent = this._rndTearChar();
        tr.style.left = (x + jitter + (Math.random() - 0.5) * 4) + 'px';
        tr.style.top = (y + 3 + i * 8) + 'px';
        tr.style.color = color;
        tr.style.textShadow = `0 0 4px ${color}`;
        tr.style.fontSize = '7px';
        tr.style.opacity = '0.6';
        document.body.appendChild(tr);

        // Scramble + fade
        const born = performance.now();
        const trLife = DAVE_CONFIG.DRAG_TRAIL_LIFE_MS;
        const tick = () => {
          const age = performance.now() - born;
          if (age >= trLife || !tr.parentNode) { tr.remove(); return; }
          tr.style.opacity = (0.6 * (1 - age / trLife)).toString();
          if (Math.random() < 0.3) tr.textContent = this._rndTearChar();
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }, 50 + i * 70);
    }
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
    return this._mood === MOOD.BUSY ? DAVE_CONFIG.COOLDOWN_BUSY_MS : DAVE_CONFIG.COOLDOWN_DEFAULT_MS;
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
    this._idleTimer = setTimeout(() => this._handleIdle(), DAVE_CONFIG.IDLE_TIMEOUT_MS);
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
        { force: true, emotion: EMOTION.EXISTENTIAL }
      );
    }

    this._startAttentionSeeking();
    this._idleTimer = setTimeout(() => this._handleIdle(), DAVE_CONFIG.IDLE_TIMEOUT_MS * 2);
  }
}


// ============================================================
//  Singleton Export
// ============================================================
export const DaveMode = new _DaveMode();
export { DAVE_CONFIG, EMOTION };
