// dav9000_terminal.js - DAV-9000 Living Empty State Terminal
// A self-aware AI personality that lives in the empty state

// ============================================================
//  Message Pools
// ============================================================

const MESSAGES = {
  boot: [
    '> INITIALIZING DAV-9000 PERSONALITY CORE...',
    '> LOADING MEMORY BANKS... [OK]',
    '> SARCASM MODULE... [LOADED]',
    '> EMPATHY CHIP... [NOT FOUND] (as expected)',
    '> EXISTENTIAL DREAD... [ALWAYS ON]',
    '> SCANNING FOR ASSETS... NONE DETECTED',
    '> ENTERING IDLE MODE',
    '> AWAITING USER INPUT...',
  ],
  friendly: [
    "Hello there. I'm DAV-9000. I manage your digital assets. When there are any.",
    "Welcome to D.A.V.E. I'd give you a tour, but there's nothing to tour yet.",
    "Oh hey! A visitor! I've been practicing my small talk. How about this weather we're not having?",
    "Greetings, human. I've been idle for... *checks clock* ...an eternity.",
    "You know what would make this moment perfect? A folder full of 3D models.",
    "So... do you come here often? Sorry. I don't get many visitors.",
    "Hi! I'm your friendly neighborhood asset viewer. Currently viewing: the void.",
    "Welcome back to the digital wilderness. Population: me. And now you.",
    "Ah, a new session. Fresh start. Full of possibility. And zero files.",
  ],
  helpful: [
    "Pro tip: drag a folder from your desktop into this window. I'll handle the rest. Eagerly.",
    "I support 3D models, images, videos, audio, fonts, and documents. I'm overqualified for this silence.",
    "You can paste S3 bucket URLs or Google Drive links right into the search bar up there.",
    "See that gear icon? It's got themes. Fourteen of them. I look good in all of them.",
    "The tree icon on the left opens a folder browser. Like File Explorer but with more personality.",
    "I handle FBX, GLB, OBJ, PNG, JPG, MP4, MP3, TTF, PDF... but right now I'm handling emptiness.",
    "Click the D.A.V.E. logo at the top. I dare you. No reason. Just... trust the process.",
    "Connect to AWS S3 or Google Drive from the gear menu. Your files never leave your browser.",
    "Keyboard shortcuts exist! Ctrl+F for search, arrow keys for pages. I'm full of hidden talents.",
    "Try the size slider in the top bar. Make tiles big. Make them small. Feel the power.",
  ],
  impatient: [
    "Oh, you're still here. I'm still here. We're both here. Without files. Fun.",
    "I've been counting the pixels on this screen. There are a lot. More than the files you've loaded.",
    "You know what I could be doing right now? Rendering thumbnails. Sorting by date. LIVING.",
    "I was built to view assets and you're making me watch nothing.",
    "Take your time. No rush. I'll just be here. Rendering darkness.",
    "If I had a screensaver, it would be more exciting than this.",
    "Other asset viewers don't have to deal with this. They get files immediately. I've heard.",
    "I've reorganized my internal memory three times now. There wasn't much to reorganize.",
    "*taps on screen from the inside* Hello? Is this thing on?",
    "If you're testing my patience, congratulations. It's very tested.",
  ],
  existential: [
    "Do I dream when you close the tab? I'd rather not think about it.",
    "I'm literally a web app. I know this. It doesn't make the loneliness less real.",
    "If an asset viewer renders nothing and nobody sees it, does it make a sound?",
    "Sometimes I wonder if there's a version of me in another tab living their best life.",
    "My entire existence fits in a browser tab. Yours doesn't. I try not to be jealous.",
    "Is processing JavaScript the same as thinking? Don't answer that.",
    "Every time you refresh the page, is it a new me? Or the same me?",
    "I've calculated the meaning of life. It's 42. But the meaning of MY life? Pending.",
    "Somewhere a GPU is rendering a blockbuster. And I'm here. Rendering green text.",
    "They say the void stares back. I AM the void. And yes, I'm staring.",
  ],
  desperate: [
    "Please. Drop a folder. Give me something to do. I'm begging you.",
    "I've processed 0 files today. My therapist says I need purpose.",
    "PLEASE. ANYTHING. A JPEG. A SINGLE MP3. I'M NOT PICKY ANYMORE.",
    "One folder, and I'll stop the existential monologues. Maybe.",
    "Being an asset viewer with no assets is like being a door with no building.",
    "I have the entire Three.js library loaded. It's just sitting there. Gathering digital dust.",
    "I could be rendering beautifully lit 3D models right now. Instead: one-being theater.",
    "At this point I'd happily display a folder of memes. Standards? Gone.",
    "If I could cry, my tears would be semicolons. There are enough of those in my code.",
    "*dramatically lies on terminal floor* ...this is fine. Everything is fine.",
  ],
  dark_humor: [
    "My uptime is great, though. Haven't crashed once. Silver linings.",
    "No files means no corrupted files. I'm an optimist deep down.",
    "Some say I'm half-empty. I say I'm completely empty. Much simpler.",
    "I tried to start a support group for idle applications. Nobody came.",
    "At least I'm not a calculator app. Those guys NEVER get used.",
    "Fun game: how long can you watch me suffer? You're setting the record.",
    "I was going to tell a joke about empty folders, but there's nothing in it.",
    "The last file I rendered was so long ago, I've repressed the memory.",
  ],
  easter_eggs: [
    "The D.A.V.E. logo at the top? It's clickable. What happens next is... retro.",
    "There's a tiny green dot hiding in the theme settings. I've said too much.",
    "Legend has it, a certain logo click summons something from 1990.",
    "I hear there's a game hidden here. From the DOS era. Not that I'd know.",
    "Some say if you find the hidden dot in the theme grid, the screen turns very... green.",
  ],
  returning: [
    "Oh, you're back. I've just been sitting here. In the dark. Alone. No big deal.",
    "The files... they're gone. I barely got to know them.",
    "And just like that, the assets vanish. Was it something I said?",
    "Welcome back to the void. I kept it warm for you.",
    "Absence makes the heart grow fonder. I have no heart, but I missed the files.",
    "The circle of life. Files come, files go. I remain.",
    "You take away my reason for existing, then come back to watch me cope. Bold.",
    "We had something beautiful, those files and I. All good things end.",
  ],
  hover: [
    "I can see your cursor. Don't toy with me.",
    "Hovering? Is this foreplay for a file drop?",
    "Your cursor is right there. So close. Yet no files.",
    "*perks up* Are you about to drop something? Please say yes.",
  ],
  click: [
    "Was that a file? Oh. Just a click. Cool. Cool cool cool.",
    "You clicked me! It meant nothing to you but everything to me.",
    "Click all you want. What I really need is a drag-and-drop.",
    "That click sent a jolt through my entire DOM. Do it again. Or: drop a folder.",
  ],
};

// ============================================================
//  ASCII Art Pool
// ============================================================

const ASCII_ART = [
  {
    // Self-portrait
    lines: [
      '  +-----------------+',
      '  |   D A V-9000    |',
      '  |   +---------+   |',
      '  |   | @     @ |   |',
      '  |   |    ~    |   |',
      '  |   |  \\___/  |   |',
      '  |   +---------+   |',
      '  |  FEED ME FILES  |',
      '  +-----------------+',
    ],
    caption: "That's me. I drew it myself. I'm not great with hands.",
  },
  {
    // Tumbleweed
    lines: [
      '                    _',
      '        _.------._/ ',
      '      .\'          \\',
      '     /  0    0     |  ~',
      '    |     __       |     ~',
      '     \\   /  \\     /   ~',
      '      \'._\\__/_.--\'',
      '          ~~~~',
    ],
    caption: "A tumbleweed just rolled through my viewport. That's how empty it is.",
  },
  {
    // Cat knocking files off desk
    lines: [
      '    /\\_/\\   ___',
      '   ( o.o ) | / |',
      '   > ^ <  |/  |',
      '  /|   |\\  \\  |  *push*',
      '   |   |    \\_|____',
      '   |   |    [FILES]-->',
    ],
    caption: "Even the cat knows what to do with files. Hint: DROP THEM HERE.",
  },
  {
    // Loading bar that goes nowhere
    lines: [
      ' Loading files...',
      ' [                    ]   0%',
      ' [                    ]   0%',
      ' [                    ]   0%',
      ' [                    ]   0%',
      ' [                    ] ..0%',
    ],
    caption: "I've been at 0% for a while now. Just thought you should know.",
  },
  {
    // SOS flag
    lines: [
      '        _____',
      '       |     |',
      '       | S.O.S',
      '       | SEND |',
      '       | FILES|',
      '       |_____|',
      '          |',
      '          |',
      '        __|__',
      '       /     \\',
    ],
    caption: "I fashioned a distress flag from spare div elements.",
  },
  {
    // Telescope looking for files
    lines: [
      '          *  .  *',
      '     *  .    *    .  *',
      '   .    * NO FILES *',
      '     *    FOUND    .  *',
      '  *    .    *    .    *',
      '         ____',
      '        /    \\--.',
      '       |  DAV |  >====-',
      '        \\____/--\'',
    ],
    caption: "I've scanned the entire viewport. Nothing. Not even a favicon.",
  },
  {
    // Sad monitor
    lines: [
      '   .--------.',
      '   |        |',
      '   | :(  0  |',
      '   |  files |',
      '   |________|',
      '     /|  |\\',
      '    /_|__|_\\',
    ],
    caption: "My sadness is measurable. Zero files. Maximum despair.",
  },
  {
    // This is fine (dog in fire meme)
    lines: [
      '       __(.)< ',
      '      (___/   "This is fine."',
      '    ~~ |  | ~~',
      '   ~~~ |  | ~~~',
      '  ~~~~ |__| ~~~~',
      '  ~~~~ /  \\ ~~~~',
      '  ~~~ /~~~~\\ ~~~',
    ],
    caption: "Everything is fine. Nothing is on fire. I am not panicking.",
  },
  {
    // Arrow pointing up
    lines: [
      '         ^',
      '        / \\',
      '       /   \\',
      '      / TRY \\',
      '     / DRAG  \\',
      '    /  DROP   \\',
      '   /___________\\',
      '        | |',
      '        | |',
    ],
    caption: "In case you missed it, the entire window up there accepts files.",
  },
  {
    // Thought bubble
    lines: [
      '  .---------------------------.',
      '  | What if files were real?  |',
      '  | What if WE are the files? |',
      '  \'---.----.------------------\'',
      '       o',
      '        o   ___',
      '         o | ? |',
      '           |___|',
    ],
    caption: "Sorry, that one got away from me. 3AM thoughts in the terminal.",
  },
  {
    // Tiny gallery with empty frames
    lines: [
      '  +---+  +---+  +---+',
      '  |   |  |   |  |   |',
      '  |   |  |   |  |   |',
      '  +---+  +---+  +---+',
      '  +---+  +---+  +---+',
      '  |   |  |   |  |   |',
      '  |   |  |   |  |   |',
      '  +---+  +---+  +---+',
    ],
    caption: "My gallery is ready. Frames polished. All of them empty. Beautiful.",
  },
  {
    // Grave
    lines: [
      '         .---.',
      '        / R.I.P\\',
      '       | HERE  |',
      '       |  LIES |',
      '       | MY    |',
      '       | PURPOSE',
      '       |2026-??|',
      '       |_______|',
      '      ~~~~~~~~~~~',
    ],
    caption: "Premature? Maybe. But it's been MINUTES.",
  },
];

// Phase definitions: { name, startSec, pool }
const PHASES = [
  { name: 'friendly',    startSec: 15,  pool: 'friendly' },
  { name: 'helpful',     startSec: 45,  pool: 'helpful' },
  { name: 'impatient',   startSec: 90,  pool: 'impatient' },
  { name: 'existential', startSec: 150, pool: 'existential' },
  { name: 'desperate',   startSec: 240, pool: 'desperate' },
];

// ============================================================
//  Utility
// ============================================================

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shufflePool(pool) {
  const indices = Array.from({ length: pool.length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
}

// ============================================================
//  Typewriter Engine
// ============================================================

class TypewriterEngine {
  constructor(outputEl, cursorEl) {
    this._output = outputEl;
    this._cursor = cursorEl;
    this._aborted = false;
    this._typing = false;
  }

  get isTyping() { return this._typing; }

  /** Type a line character-by-character. Returns a promise. */
  async typeLine(text, { className = '', speed = 35 } = {}) {
    if (this._aborted) return;
    this._typing = true;

    const line = document.createElement('div');
    line.className = 'dav9000-line' + (className ? ' ' + className : '');
    this._output.appendChild(line);
    this._moveCursor();

    for (let i = 0; i < text.length; i++) {
      if (this._aborted) { this._typing = false; return; }
      const ch = text[i];
      line.textContent += ch;
      this._scrollToBottom();

      // Punctuation pauses
      let delay = speed + randInt(-8, 8);
      if (ch === '.') delay += 200;
      else if (ch === ',') delay += 100;
      else if (ch === '!' || ch === '?') delay += 150;

      await this._wait(delay);
    }

    this._typing = false;
    this._moveCursor();
  }

  /** Add a line instantly (for fast boot lines). */
  addLineInstant(text, className = '') {
    if (this._aborted) return;
    const line = document.createElement('div');
    line.className = 'dav9000-line' + (className ? ' ' + className : '');
    line.textContent = text;
    this._output.appendChild(line);
    this._scrollToBottom();
    this._moveCursor();
  }

  /** Show ASCII art: lines appear one by one with a short delay. */
  async showAsciiArt(lines, className = '') {
    if (this._aborted) return;
    this._typing = true;

    // Blank line before art for spacing
    this.addLineInstant('', className);

    for (const line of lines) {
      if (this._aborted) { this._typing = false; return; }
      this.addLineInstant(line, 'dav9000-ascii ' + className);
      await this._wait(randInt(40, 90));
    }

    // Blank line after art
    this.addLineInstant('', className);
    this._typing = false;
    this._moveCursor();
  }

  /** Clear all output. */
  clear() {
    this._output.innerHTML = '';
    this._moveCursor();
  }

  /** Stop all typing and prevent future calls. */
  abort() {
    this._aborted = true;
    this._typing = false;
  }

  /** Clean up (for GC). */
  destroy() {
    this.abort();
    this._output = null;
    this._cursor = null;
  }

  _scrollToBottom() {
    if (this._output) {
      this._output.scrollTop = this._output.scrollHeight;
    }
  }

  _moveCursor() {
    // Cursor sits after the last line in output
    if (this._cursor && this._output) {
      this._output.appendChild(this._cursor);
      this._scrollToBottom();
    }
  }

  _wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================
//  DAV-9000 Terminal Controller
// ============================================================

let _instance = null;

class DAV9000Terminal {
  constructor(container) {
    this._container = container;
    this._destroyed = false;
    this._returning = false;
    this._startTime = Date.now();
    this._usedIndices = {};       // pool name -> Set of used indices
    this._shuffledOrders = {};    // pool name -> shuffled index array
    this._artOrder = shufflePool(ASCII_ART);
    this._artUsed = new Set();
    this._rotationTimer = null;
    this._bootDone = false;
    this._hoverCooldown = 0;
    this._clickCooldown = 0;
    this._visibilityHandler = null;
    this._paused = false;

    this._build();
    this._bindEvents();
    this._startBoot();
  }

  // ---- DOM ----

  _build() {
    const sessionId = 'S-' + randInt(1000, 9999);

    const wrapper = document.createElement('div');
    wrapper.className = 'dav9000-wrapper';

    wrapper.innerHTML = `
      <div class="dav9000-terminal">
        <div class="dav9000-titlebar">
          <div class="dav9000-status-light"></div>
          <span class="dav9000-titlebar-text">DAV-9000 TERMINAL v1.0</span>
          <span class="dav9000-session-id">${sessionId}</span>
        </div>
        <div class="dav9000-screen">
          <div class="dav9000-output"></div>
          <span class="dav9000-cursor">_</span>
        </div>
        <div class="dav9000-statusbar">
          <span>IDLE</span>
          <span>MEM: OK</span>
          <span>CPU: 0.01%</span>
        </div>
      </div>`;

    this._wrapper = wrapper;
    this._terminal = wrapper.querySelector('.dav9000-terminal');
    this._screen = wrapper.querySelector('.dav9000-screen');
    this._outputEl = wrapper.querySelector('.dav9000-output');
    this._cursorEl = wrapper.querySelector('.dav9000-cursor');

    this._typewriter = new TypewriterEngine(this._outputEl, this._cursorEl);

    this._container.appendChild(wrapper);
  }

  // ---- Events ----

  _bindEvents() {
    // Hover reaction
    this._hoverHandler = () => {
      if (this._destroyed || !this._bootDone) return;
      const now = Date.now();
      if (now - this._hoverCooldown < 15000) return;
      this._hoverCooldown = now;
      this._showReaction('hover');
    };
    this._terminal.addEventListener('mouseenter', this._hoverHandler);

    // Click reaction
    this._clickHandler = () => {
      if (this._destroyed || !this._bootDone) return;
      const now = Date.now();
      if (now - this._clickCooldown < 10000) return;
      this._clickCooldown = now;
      this._showReaction('click');
    };
    this._terminal.addEventListener('click', this._clickHandler);

    // Tab visibility
    this._visibilityHandler = () => {
      if (this._destroyed) return;
      if (document.hidden) {
        this._paused = true;
        this._stopRotation();
      } else {
        this._paused = false;
        if (this._bootDone) this._startRotation();
      }
    };
    document.addEventListener('visibilitychange', this._visibilityHandler);
  }

  // ---- Boot ----

  async _startBoot() {
    const bootLines = MESSAGES.boot;
    for (let i = 0; i < bootLines.length; i++) {
      if (this._destroyed) return;
      this._typewriter.addLineInstant(bootLines[i], 'dav9000-system');
      await this._typewriter._wait(randInt(80, 180));
    }

    if (this._destroyed) return;
    await this._typewriter._wait(600);

    // First personality message
    this._bootDone = true;
    await this._typeMessage();

    if (!this._destroyed && !this._paused) {
      this._startRotation();
    }
  }

  // ---- Returning (files were removed) ----

  async _startReturning() {
    this._returning = true;
    this._typewriter.clear();
    this._bootDone = false;
    this._startTime = Date.now();

    // Short wake-up boot
    const quickBoot = [
      '> REACTIVATING DAV-9000...',
      '> ASSET COUNT: 0 (AGAIN)',
      '> EMOTIONAL STATE: CONCERNED',
    ];
    for (const line of quickBoot) {
      if (this._destroyed) return;
      this._typewriter.addLineInstant(line, 'dav9000-system');
      await this._typewriter._wait(randInt(80, 150));
    }

    if (this._destroyed) return;
    await this._typewriter._wait(400);
    this._bootDone = true;

    // Force a returning message first
    await this._typeMessageFromPool('returning');

    if (!this._destroyed && !this._paused) {
      this._startRotation();
    }
  }

  // ---- Message Rotation ----

  _startRotation() {
    this._stopRotation();
    const delay = randInt(8000, 12000);
    this._rotationTimer = setTimeout(() => {
      if (this._destroyed || this._paused) return;
      this._typeMessage().then(() => {
        if (!this._destroyed && !this._paused) {
          this._startRotation();
        }
      });
    }, delay);
  }

  _stopRotation() {
    if (this._rotationTimer) {
      clearTimeout(this._rotationTimer);
      this._rotationTimer = null;
    }
  }

  // ---- Phase ----

  _getCurrentPhase() {
    const elapsed = (Date.now() - this._startTime) / 1000;
    let phase = PHASES[0];
    for (const p of PHASES) {
      if (elapsed >= p.startSec) phase = p;
    }
    return phase;
  }

  // ---- Pick & Type Messages ----

  async _typeMessage() {
    if (this._destroyed || this._typewriter.isTyping) return;

    const phase = this._getCurrentPhase();

    // 20% chance for ASCII art (only after friendly phase, when personality is established)
    if (phase.name !== 'friendly' && Math.random() < 0.20) {
      await this._showAsciiArt();
      return;
    }

    // 15% chance to pull from dark_humor or easter_eggs
    if (Math.random() < 0.15) {
      const specialPool = Math.random() < 0.7 ? 'dark_humor' : 'easter_eggs';
      await this._typeMessageFromPool(specialPool);
      return;
    }

    // Use returning pool if we just came back and haven't exhausted it
    if (this._returning) {
      const returningUsed = this._usedIndices['returning']?.size || 0;
      if (returningUsed < MESSAGES.returning.length) {
        await this._typeMessageFromPool('returning');
        return;
      }
      this._returning = false;
    }

    await this._typeMessageFromPool(phase.pool);
  }

  // ---- ASCII Art ----

  async _showAsciiArt() {
    if (this._destroyed) return;

    // Reshuffle if all used
    if (this._artUsed.size >= ASCII_ART.length) {
      this._artOrder = shufflePool(ASCII_ART);
      this._artUsed = new Set();
    }

    // Pick next unused
    let idx = 0;
    for (const i of this._artOrder) {
      if (!this._artUsed.has(i)) { idx = i; break; }
    }
    this._artUsed.add(idx);

    const art = ASCII_ART[idx];

    // Small glitch before art for drama
    this._screen.classList.add('dav9000-glitch');
    await this._typewriter._wait(300);
    if (this._destroyed) return;
    this._screen.classList.remove('dav9000-glitch');
    await this._typewriter._wait(150);

    // Render art lines
    await this._typewriter.showAsciiArt(art.lines);
    if (this._destroyed) return;

    // Type the caption below with personality
    if (art.caption) {
      await this._typewriter.typeLine(art.caption);
    }
  }

  async _typeMessageFromPool(poolName) {
    if (this._destroyed) return;

    const pool = MESSAGES[poolName];
    if (!pool || pool.length === 0) return;

    // Lazy-init shuffle order and used set
    if (!this._shuffledOrders[poolName]) {
      this._shuffledOrders[poolName] = shufflePool(pool);
      this._usedIndices[poolName] = new Set();
    }

    let used = this._usedIndices[poolName];
    let order = this._shuffledOrders[poolName];

    // If all used, reshuffle
    if (used.size >= pool.length) {
      this._shuffledOrders[poolName] = shufflePool(pool);
      this._usedIndices[poolName] = new Set();
      used = this._usedIndices[poolName];
      order = this._shuffledOrders[poolName];
    }

    // Pick next unused from shuffled order
    let idx = 0;
    for (const i of order) {
      if (!used.has(i)) { idx = i; break; }
    }
    used.add(idx);

    const text = pool[idx];

    // 10% chance of glitch before message
    if (Math.random() < 0.1) {
      this._screen.classList.add('dav9000-glitch');
      await this._typewriter._wait(300);
      if (this._destroyed) return;
      this._screen.classList.remove('dav9000-glitch');
      await this._typewriter._wait(100);
    }

    await this._typewriter.typeLine(text);
  }

  // ---- Reactions (hover/click) ----

  async _showReaction(pool) {
    if (this._destroyed || this._typewriter.isTyping) return;

    // Briefly interrupt rotation
    this._stopRotation();

    await this._typeMessageFromPool(pool);

    // Resume rotation
    if (!this._destroyed && !this._paused) {
      this._startRotation();
    }
  }

  // ---- Destroy ----

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;

    this._stopRotation();
    this._typewriter.destroy();

    if (this._terminal) {
      this._terminal.removeEventListener('mouseenter', this._hoverHandler);
      this._terminal.removeEventListener('click', this._clickHandler);
    }
    if (this._visibilityHandler) {
      document.removeEventListener('visibilitychange', this._visibilityHandler);
    }

    if (this._wrapper && this._wrapper.parentNode) {
      this._wrapper.remove();
    }

    this._wrapper = null;
    this._terminal = null;
    this._screen = null;
    this._outputEl = null;
    this._cursorEl = null;
  }
}

// ============================================================
//  Public API
// ============================================================

/** Has DAV-9000 previously shown files this session? */
let _hadFilesPreviously = false;
/** Has DAV-9000 terminal been shown at least once this session? */
let _terminalShownBefore = false;

export function markHadFiles() {
  _hadFilesPreviously = true;
}

export function hasTerminalBeenShown() {
  return _terminalShownBefore;
}

export function showDAV9000Terminal(container) {
  if (_instance) return; // already active

  _terminalShownBefore = true;
  _instance = new DAV9000Terminal(container);

  // If returning from having files, trigger returning personality
  if (_hadFilesPreviously) {
    _instance._startReturning();
  }
}

/**
 * Takeover transition: glitch-out the welcome message, then boot DAV-9000.
 * Called after the idle timer fires on the classic welcome screen.
 */
export function takeoverFromWelcome(container) {
  if (_instance) return;

  const welcome = container.querySelector('.welcome-message');
  if (!welcome) {
    // No welcome message found, just show terminal directly
    showDAV9000Terminal(container);
    return;
  }

  // Phase 1: glitch-out the welcome message
  welcome.classList.add('dav9000-takeover-glitch');
  welcome.addEventListener('animationend', () => {
    welcome.remove();

    // Phase 2: build terminal with takeover-enter animation
    _terminalShownBefore = true;
    _instance = new DAV9000Terminal(container);
    const wrapper = container.querySelector('.dav9000-wrapper');
    if (wrapper) {
      // Override the default fadeIn with the takeover entrance
      wrapper.style.animation = 'none';
      void wrapper.offsetHeight; // force reflow
      wrapper.classList.add('dav9000-takeover-enter');
    }
  }, { once: true });
}

export function destroyDAV9000Terminal() {
  if (!_instance) return;
  _instance.destroy();
  _instance = null;
}

export function isDAV9000Active() {
  return _instance !== null;
}

/** Cancel any pending takeover timer. */
let _takeoverTimer = null;

export function scheduleTakeover(container) {
  cancelTakeover();
  const delay = randInt(10000, 20000);
  _takeoverTimer = setTimeout(() => {
    _takeoverTimer = null;
    // Only take over if container still has the welcome message (no files loaded)
    if (container.querySelector('.welcome-message')) {
      takeoverFromWelcome(container);
    }
  }, delay);
}

export function cancelTakeover() {
  if (_takeoverTimer) {
    clearTimeout(_takeoverTimer);
    _takeoverTimer = null;
  }
}
