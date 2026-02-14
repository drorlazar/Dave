// dave_commands.js — Dave Command Router & Instant Commands
// Central hub: listens for dave:command, routes to handler.
// Also manages the command suggestion dropdown and auto-behaviors.

import { DaveMode, EMOTION } from '../core/dave_mode.js';
import { DaveMusicMode } from './dave_music.js';
import { DaveSnake } from './dave_snake.js';
import { DaveBreakout } from './dave_breakout.js';
import { DaveAlive } from '../core/dave_alive.js';

// ============================================================
//  Command Definitions
// ============================================================

const COMMANDS = [
  { name: 'joke',     icon: '?!', desc: 'Dave tells a programming joke' },
  { name: 'flip',     icon: '\u21BB',  desc: 'Dave does a 360 backflip' },
  { name: 'rave',     icon: '#',  desc: '8-second party mode' },
  { name: 'fortune',  icon: '\u2726',  desc: 'Snarky Magic 8-Ball fortune' },
  { name: 'dance',    icon: '\u266A',  desc: 'Dave busts a move' },
  { name: 'story',    icon: '\u00A7',  desc: 'A micro-story in 3 parts' },
  { name: 'sleep',    icon: '~',  desc: 'Dave takes a nap' },
  { name: 'sing',     icon: '\u266B',  desc: 'Music listening mode' },
  { name: 'music',    icon: '\u266C',  desc: 'Music listening mode' },
  { name: 'snake',    icon: 'S',  desc: 'Play Matrix Snake' },
  { name: 'breakout', icon: '\u25C6',  desc: 'Play Dave Breakout' },
  { name: 'heart',    icon: '\u2665',  desc: 'Dave traces a heart trail' },
  { name: 'spiral',   icon: '@',  desc: 'Spiral into fireworks' },
  { name: 'constellation', icon: '\u2605', desc: 'Draw star lines between tiles' },
  { name: 'show',     icon: '\u00A7',  desc: 'Shadow puppet show' },
  { name: 'patrol',   icon: '\u221E',  desc: 'Figure-8 security patrol' },
  { name: 'help',     icon: '?',  desc: 'List all commands' },
];

// ============================================================
//  Joke Pool
// ============================================================

const JOKES = [
  { setup: "Why do programmers prefer dark mode?", punch: "Because light attracts bugs." },
  { setup: "What's a programmer's favorite hangout place?", punch: "Foo Bar." },
  { setup: "Why was the JavaScript developer sad?", punch: "Because he didn't Node how to Express himself." },
  { setup: "What did the HTML say to the CSS?", punch: "You make me look good." },
  { setup: "Why do Java developers wear glasses?", punch: "Because they can't C#." },
  { setup: "How many programmers does it take to change a light bulb?", punch: "None. That's a hardware problem." },
  { setup: "What's a computer's least favorite food?", punch: "Spam." },
  { setup: "Why did the developer go broke?", punch: "Because he used up all his cache." },
  { setup: "What do you call 8 hobbits?", punch: "A hobbyte." },
  { setup: "Why did the function break up with the variable?", punch: "Too much scope creep." },
  { setup: "What's a bug's favorite music?", punch: "Debugstep." },
  { setup: "Why do programmers hate nature?", punch: "It has too many bugs and no documentation." },
  { setup: "What's the most used language in programming?", punch: "Profanity." },
  { setup: "Why was the computer cold?", punch: "It left its Windows open." },
  { setup: "What do you call a programmer from Finland?", punch: "Nerdic." },
];

// ============================================================
//  Fortune Pool
// ============================================================

const FORTUNES = [
  "Signs point to... have you tried turning it off and on again?",
  "Outlook not so good. Then again, I use Gmail.",
  "The answer you seek is in the last place you'll look. Obviously.",
  "Yes. Definitely. Maybe. Ask again after my nap.",
  "My sources say... wait, I don't have sources. I'm a floating eye.",
  "Reply hazy. My crystal ball needs a firmware update.",
  "Don't count on it. But what do I know? I live in a browser.",
  "It is certain. As certain as anything can be in JavaScript.",
  "Better not tell you now. Or ever. Actually, never mind.",
  "All signs point to 'you should probably refactor that code.'",
  "Concentrate and ask again. I wasn't listening the first time.",
  "My reply is no. Unless you bribe me with more RAM.",
  "The stars align in your favor. The bugs, however, do not.",
  "Ask again after deploying to production on a Friday.",
  "Without a doubt. Wait\u2014actually, with several doubts.",
  "The future is unclear, but your commit history is VERY clear.",
  "YES! ...is what I'd say if I felt like being supportive today.",
  "Cannot predict now. Mercury is in retrograde. Or whatever humans blame.",
  "Most likely. But I've been wrong before. Remember Y2K?",
  "It is decidedly so. I decided it. Just now. You're welcome.",
];

// ============================================================
//  Story Pool
// ============================================================

const STORIES = [
  [
    "Once upon a time, in a server far, far away...",
    "A lonely pixel dreamed of becoming a polygon. Day after day, it practiced growing vertices.",
    "And then it realized: it was already perfect. A single, magnificent dot. THE END.",
  ],
  [
    "Chapter 1: The cursor blinked. It had blinked 47,000 times that day.",
    "Chapter 2: 'Is anyone going to type something?' it thought. 'Anything?'",
    "Chapter 3: A user typed 'Hello'. The cursor wept with joy. Then they hit backspace.",
  ],
  [
    "The Array and the Object went on a date.",
    "The Array said: 'I love your keys.' The Object said: 'I love your order.'",
    "They merged. It was a Map. Nobody was happy.",
  ],
  [
    "Deep in the kernel, a thread was sleeping.",
    "It dreamed of a world without race conditions. A peaceful, synchronized utopia.",
    "Then the alarm fired. It woke up. Deadlock. As always.",
  ],
  [
    "A semicolon walked into a Python bar.",
    "The bouncer said: 'We don't serve your kind here.'",
    "The semicolon silently went to the JavaScript bar next door. It was welcomed as optional.",
  ],
  [
    "A developer wrote the perfect function. Zero bugs. Clean. Elegant.",
    "The code reviewer said: 'Needs more comments.'",
    "The developer added one comment: '// I have lost the will to code.' PR approved.",
  ],
  [
    "404 walked into a party.",
    "Everyone looked around. 'Where's the page?' they asked.",
    "404 smiled. 'That's the joke.' Nobody laughed. 404 was used to it.",
  ],
  [
    "A recursive function called itself at the bar.",
    "A recursive function called itself at the bar.",
    "A recursive function called\u2014STACK OVERFLOW. Everyone go home.",
  ],
];

// ============================================================
//  Auto-behavior pool (used during normal Dave Mode operation)
// ============================================================

// Behaviors triggered at specific moments, not on command.
// Each has: trigger context, action function, weight (lower = rarer)
const AUTO_BEHAVIORS = [
  // On idle: small chance Dave does a little flip or dance
  { context: 'idle', weight: 0.08, action: (cmds) => cmds._cmdFlip() },
  { context: 'idle', weight: 0.06, action: (cmds) => cmds._autoMusicSnippet() },
  // On many files loaded: celebratory flip
  { context: 'filesLoaded.large', weight: 0.25, action: (cmds) => cmds._cmdFlip() },
  // On error: dramatic fortune
  { context: 'error', weight: 0.12, action: (cmds) => cmds._cmdFortune() },
  // On repeated sorts: annoyed dance
  { context: 'sort.repeated', weight: 0.15, action: (cmds) => cmds._cmdDance() },
  // On theme toggle spam: rave
  { context: 'theme.repeated', weight: 0.10, action: (cmds) => cmds._autoRaveMicro() },
  // After returning from fullscreen: small chance of joke setup
  { context: 'fullscreen.exit', weight: 0.06, action: (cmds) => cmds._cmdJoke() },
  // On selection cleared: dramatic sigh + sleep tease
  { context: 'selection.cleared', weight: 0.05, action: (cmds) => cmds._autoSleepTease() },
];

// ============================================================
//  Dave Commands Singleton
// ============================================================

class _DaveCommands {
  constructor() {
    this._overlayEl = null;
    this._currentGame = null;
    this._sleepTimer = null;
    this._sleepClickHandler = null;
    this._raveTimer = null;
    this._dropdownEl = null;
    this._searchInput = null;
    this._selectedIndex = -1;
    this._dropdownVisible = false;
    this._lastAutoBehavior = 0;
    this._autoCooldownMs = 60000; // 1 min between auto behaviors
  }

  init() {
    // Listen for routed commands
    document.addEventListener('dave:command', (e) => {
      const cmd = e.detail?.command;
      if (cmd) this._route(cmd);
    });

    // Set up dropdown for search input
    this._setupDropdown();

    // Set up auto-behavior hooks
    this._setupAutoBehaviors();

    console.log('[DaveCommands] Initialized');
  }

  // ============================================================
  //  Auto-behaviors (sprinkled into normal Dave Mode)
  // ============================================================

  _setupAutoBehaviors() {
    // Hook into various Dave events to occasionally trigger behaviors
    const events = [
      'dave:idle',
      'dave:filesLoaded',
      'dave:sort',
      'dave:filter',
      'dave:themeChange',
      'dave:error',
      'dave:fullscreenExit',
      'dave:selectionChange',
    ];

    // We listen on a general channel: dave_mode fires these events
    // We map event names to behavior contexts
    const contextMap = {
      'dave:idle': 'idle',
      'dave:error': 'error',
      'dave:fullscreenExit': 'fullscreen.exit',
    };

    // For sort/theme repeated detection, we piggyback on dave:sort/dave:themeChange
    let sortCount = 0;
    let themeCount = 0;
    let lastSortTime = 0;
    let lastThemeTime = 0;

    document.addEventListener('dave:sort', () => {
      const now = Date.now();
      if (now - lastSortTime < 5000) sortCount++;
      else sortCount = 1;
      lastSortTime = now;
      if (sortCount > 3) this._tryAutoBehavior('sort.repeated');
    });

    document.addEventListener('dave:themeChange', () => {
      const now = Date.now();
      if (now - lastThemeTime < 5000) themeCount++;
      else themeCount = 1;
      lastThemeTime = now;
      if (themeCount > 3) this._tryAutoBehavior('theme.repeated');
    });

    document.addEventListener('dave:filesLoaded', (e) => {
      const count = e.detail?.count || 0;
      if (count >= 100) this._tryAutoBehavior('filesLoaded.large');
    });

    document.addEventListener('dave:error', () => {
      this._tryAutoBehavior('error');
    });

    document.addEventListener('dave:selectionChange', (e) => {
      if (e.detail?.count === 0 && e.detail?.previous > 0) {
        this._tryAutoBehavior('selection.cleared');
      }
    });

    // Idle: listen for Dave's own idle cycle
    // We intercept by checking if Dave is idle periodically
    setInterval(() => {
      if (!DaveMode._enabled) return;
      if (DaveMode._presenceEl?.classList.contains('dave-sleeping')) {
        this._tryAutoBehavior('idle');
      }
    }, 30000);
  }

  _tryAutoBehavior(context) {
    if (!DaveMode._enabled) return;
    const now = Date.now();
    if (now - this._lastAutoBehavior < this._autoCooldownMs) return;

    const candidates = AUTO_BEHAVIORS.filter(b => b.context === context);
    for (const b of candidates) {
      if (Math.random() < b.weight) {
        this._lastAutoBehavior = now;
        // Small delay so it doesn't clash with Dave's normal reaction
        setTimeout(() => b.action(this), 2000);
        return;
      }
    }
  }

  // Mini auto-behavior variants (shorter/subtler than full commands)
  _autoMusicSnippet() {
    // Brief 5s music snippet instead of full 12s
    DaveMusicMode.start(5000);
  }

  _autoRaveMicro() {
    // 3s mini rave instead of 8s — use JS color cycling, not CSS animation
    if (this._raveTimer) return;
    const p = DaveMode._presenceEl;
    if (!p) return;
    const raveColors = ['#ff0040', '#ff8800', '#ffff00', '#00ff41', '#0088ff', '#aa00ff'];
    let colorIdx = 0;
    const colorInterval = setInterval(() => {
      p.style.setProperty('--dave-iris', raveColors[colorIdx % raveColors.length]);
      colorIdx++;
    }, 100);
    this._raveTimer = setTimeout(() => {
      clearInterval(colorInterval);
      p.style.removeProperty('--dave-iris');
      this._raveTimer = null;
    }, 3000);
  }

  _autoSleepTease() {
    // Just a yawn bubble + brief eye squish, no full sleep
    DaveMode._showBubble("*yawn* ...you're putting me to sleep here.", { force: true, emotion: EMOTION.WARM });
    const p = DaveMode._presenceEl;
    if (!p) return;
    const iris = p.querySelector('.dave-presence-iris');
    if (iris) {
      iris.style.transition = 'transform 0.5s ease';
      iris.style.transform = 'scaleY(0.3)';
      setTimeout(() => {
        iris.style.transform = '';
        setTimeout(() => { iris.style.transition = ''; }, 500);
      }, 1500);
    }
  }

  // ============================================================
  //  Command Dropdown (autocomplete)
  // ============================================================

  _setupDropdown() {
    const tryAttach = () => {
      this._searchInput = document.getElementById('searchInput');
      if (!this._searchInput) {
        setTimeout(tryAttach, 500);
        return;
      }

      const dd = document.createElement('div');
      dd.className = 'dave-cmd-dropdown';
      dd.style.display = 'none';
      this._searchInput.parentElement.style.position = 'relative';
      this._searchInput.parentElement.appendChild(dd);
      this._dropdownEl = dd;

      this._searchInput.addEventListener('input', () => this._onSearchInput());
      this._searchInput.addEventListener('keydown', (e) => this._onSearchKeydown(e));

      // Close dropdown only when clicking outside or pressing ESC
      document.addEventListener('mousedown', (e) => {
        if (this._dropdownVisible &&
            !this._dropdownEl.contains(e.target) &&
            e.target !== this._searchInput) {
          this._hideDropdown();
        }
      });
    };
    tryAttach();
  }

  _onSearchInput() {
    const val = this._searchInput.value.trim().toLowerCase();

    if (!DaveMode._enabled) {
      this._hideDropdown();
      return;
    }

    if (val === 'dave' || val.startsWith('dave ')) {
      const filter = val === 'dave' ? '' : val.slice(5).trim();
      this._showDropdown(filter);
    } else {
      this._hideDropdown();
    }
  }

  _onSearchKeydown(e) {
    if (!this._dropdownVisible) return;

    const items = this._dropdownEl.querySelectorAll('.dave-cmd-item');
    if (!items.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this._selectedIndex = Math.min(this._selectedIndex + 1, items.length - 1);
      this._highlightItem(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this._selectedIndex = Math.max(this._selectedIndex - 1, 0);
      this._highlightItem(items);
    } else if (e.key === 'Enter' && this._selectedIndex >= 0) {
      e.preventDefault();
      const selectedItem = items[this._selectedIndex];
      if (selectedItem) {
        const cmd = selectedItem.dataset.cmd;
        // Execute but keep dropdown open; just deselect
        this._selectedIndex = -1;
        this._highlightItem(items);
        document.dispatchEvent(new CustomEvent('dave:command', { detail: { command: cmd } }));
      }
    } else if (e.key === 'Escape') {
      this._hideDropdown();
      this._searchInput.value = '';
    }
  }

  _showDropdown(filter) {
    const dd = this._dropdownEl;
    if (!dd) return;

    const filtered = COMMANDS.filter(c => {
      if (c.name === 'music' && !filter) return false;
      if (filter) return c.name.includes(filter) || c.desc.toLowerCase().includes(filter);
      return true;
    });

    if (filtered.length === 0) {
      this._hideDropdown();
      return;
    }

    dd.innerHTML = filtered.map((c, i) =>
      `<div class="dave-cmd-item${i === this._selectedIndex ? ' selected' : ''}" data-cmd="${c.name}">
        <span class="dave-cmd-icon">${c.icon}</span>
        <span class="dave-cmd-name">${c.name}</span>
      </div>`
    ).join('');

    // Click handlers — execute command but keep dropdown open
    dd.querySelectorAll('.dave-cmd-item').forEach(item => {
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const cmd = item.dataset.cmd;
        document.dispatchEvent(new CustomEvent('dave:command', { detail: { command: cmd } }));
      });
    });

    dd.style.display = '';
    this._dropdownVisible = true;
  }

  _hideDropdown() {
    if (this._dropdownEl) {
      this._dropdownEl.style.display = 'none';
    }
    this._dropdownVisible = false;
    this._selectedIndex = -1;
  }

  _highlightItem(items) {
    items.forEach((it, i) => {
      it.classList.toggle('selected', i === this._selectedIndex);
    });
  }

  // ============================================================
  //  Command Router
  // ============================================================

  _route(cmd) {
    if (!DaveMode._enabled) {
      console.log('[DaveCommands] Dave Mode not enabled, ignoring command:', cmd);
      return;
    }

    const handlers = {
      'joke':     () => this._cmdJoke(),
      'flip':     () => this._cmdFlip(),
      'rave':     () => this._cmdRave(),
      'fortune':  () => this._cmdFortune(),
      'dance':    () => this._cmdDance(),
      'story':    () => this._cmdStory(),
      'sleep':    () => this._cmdSleep(),
      'sing':     () => this._cmdMusic(),
      'music':    () => this._cmdMusic(),
      'snake':    () => this._cmdGame('snake'),
      'breakout': () => this._cmdGame('breakout'),
      'heart':         () => DaveAlive.triggerHeartTrail(),
      'spiral':        () => DaveAlive.triggerSpiralFireworks(),
      'constellation': () => DaveAlive.triggerConstellation(),
      'show':          () => DaveAlive.triggerShadowPuppet(),
      'patrol':        () => DaveAlive.triggerPatrol(),
      'help':     () => this._cmdHelp(),
      'let me in': () => document.dispatchEvent(new CustomEvent('dave:debugPanel')),
    };

    const handler = handlers[cmd];
    if (handler) {
      handler();
    } else {
      DaveMode._showBubble(`"${cmd}"? I don't know that one. Try "dave help".`, { force: true, emotion: EMOTION.CURIOUS });
    }
  }

  // ============================================================
  //  Instant Commands
  // ============================================================

  _cmdJoke() {
    const joke = JOKES[Math.floor(Math.random() * JOKES.length)];
    DaveMode._setEmotion(EMOTION.AMUSED);

    // Part 1: Show setup — use _showBubbleImmediate so it's instant and readable
    DaveMode._showBubbleImmediate(joke.setup);
    // Prevent auto-hide — we're managing the bubble manually
    clearTimeout(DaveMode._bubbleTimer);

    // Part 2: After reading the setup, APPEND punchline below it (don't rewrite)
    setTimeout(() => {
      DaveMode._setEmotion(EMOTION.SMUG);
      const textEl = DaveMode._bubbleEl?.querySelector('.dave-bubble-text');
      if (textEl) {
        const punch = document.createElement('span');
        punch.className = 'dave-punchline';
        punch.textContent = joke.punch;
        textEl.appendChild(punch);
      }
      clearTimeout(DaveMode._bubbleTimer);

      // Part 3: Let punchline land... then physical comedy
      setTimeout(() => {
        this._spawnClapEmojis();
        const p = DaveMode._presenceEl;
        if (p) {
          p.classList.remove('dave-ambient');
          p.classList.add('dave-joke-bow');

          // After bow finishes, pause, then exit line
          setTimeout(() => {
            p.classList.remove('dave-joke-bow');
            if (!DaveMode._isDragging) p.classList.add('dave-ambient');

            // Brief beat before the exit
            setTimeout(() => {
              const exits = [
                "Thank you, I'll be here all runtime.",
                "I'm here all week. And every other week. I live here.",
                "Thank you, thank you. No refunds.",
                "Tip your developer.",
                "Try the veal. ...we don't have veal. Try the pixels.",
              ];
              DaveMode._showBubble(exits[Math.floor(Math.random() * exits.length)], { force: true, emotion: EMOTION.SMUG });
            }, 800);
          }, 1400);
        }
      }, 3000);
    }, 5000);
  }

  _spawnClapEmojis() {
    const p = DaveMode._presenceEl;
    if (!p) return;
    const rect = p.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top;
    const color = getComputedStyle(p).getPropertyValue('--dave-iris').trim() || '#00ff41';

    // Text symbols only — same pattern as fortune icons. No colored emoji ever.
    const items = ['\u2605', 'Ha!', '\u2726', 'Ah-ah!', '\u2605', 'Heh!', '\u2738', 'Bravo!'];
    let i = 0;
    const interval = setInterval(() => {
      if (i >= items.length) { clearInterval(interval); return; }
      const el = document.createElement('span');
      el.className = 'dave-clap-icon';
      el.textContent = items[i];
      el.style.left = (cx + (Math.random() - 0.5) * 60) + 'px';
      el.style.top = cy + 'px';
      el.style.color = color;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 1500);
      i++;
    }, 130);
  }

  _cmdFlip() {
    const p = DaveMode._presenceEl;
    if (!p) return;

    DaveMode._setEmotion(EMOTION.PROUD);
    p.classList.remove('dave-ambient');
    p.classList.add('dave-flip-anim');

    setTimeout(() => {
      p.classList.remove('dave-flip-anim');
      if (!DaveMode._isDragging) p.classList.add('dave-ambient');
      DaveMode._triggerFireworks();
      DaveMode._showBubble("Nailed it.", { force: true, emotion: EMOTION.SMUG });
    }, 800);
  }

  _cmdRave() {
    if (this._raveTimer) return;

    const p = DaveMode._presenceEl;
    if (!p) return;

    DaveMode._setEmotion(EMOTION.AMUSED);

    const overlay = document.createElement('div');
    overlay.className = 'dave-rave-overlay';
    document.body.appendChild(overlay);

    // Hue-rotate goes on the OVERLAY (not body). Putting filter on body
    // creates a new containing block for position:fixed children, which
    // snaps Dave to a new position. The overlay is safely outside that chain.
    overlay.classList.add('dave-rave-active');

    // Cycle iris color via JS — NOT a CSS animation on .dave-presence,
    // because that would override dave-ambient bounce and cause a position jump.
    const raveColors = ['#ff0040', '#ff8800', '#ffff00', '#00ff41', '#0088ff', '#aa00ff'];
    let colorIdx = 0;
    const raveColorInterval = setInterval(() => {
      p.style.setProperty('--dave-iris', raveColors[colorIdx % raveColors.length]);
      colorIdx++;
    }, 100);

    // Headbang/bounce on the EYE element (not presence) so ambient bounce isn't overridden
    const eye = p.querySelector('.dave-presence-eye');
    if (eye) {
      eye.classList.add('dave-rave-headbang');
    }
    let ravePhase = 0;
    const raveSwitch = setInterval(() => {
      ravePhase++;
      if (eye) {
        eye.classList.remove('dave-rave-headbang', 'dave-rave-bounce');
        void eye.offsetWidth;
        eye.classList.add(ravePhase % 2 === 0 ? 'dave-rave-headbang' : 'dave-rave-bounce');
      }
    }, 1500);

    // Text symbol particles — no colored emoji. Handcrafted.
    const symbols = ['\u26A1', '\u2726', '\u2605', '\u25C6', '\u266A', '\u266B', '\u2738', '\u00D7'];
    const particleInterval = setInterval(() => {
      for (let i = 0; i < 3; i++) {
        const particle = document.createElement('span');
        particle.className = 'dave-rave-particle';
        particle.textContent = symbols[Math.floor(Math.random() * symbols.length)];
        particle.style.left = (Math.random() * 100) + 'vw';
        particle.style.animationDuration = (2 + Math.random() * 3) + 's';
        overlay.appendChild(particle);
        setTimeout(() => particle.remove(), 5000);
      }
    }, 350);

    const raveQuotes = [
      "UNTZ UNTZ UNTZ UNTZ",
      "THE PIXELS ARE VIBING",
      "I CAN SEE ALL THE COLORS",
      "THIS IS MY FREQUENCY",
      "THE BASS DROPPED AND SO DID I",
      "SOMEBODY CALL AN AMBULANCE... BUT NOT FOR ME",
    ];
    let quoteIdx = 0;
    DaveMode._showBubble(raveQuotes[Math.floor(Math.random() * raveQuotes.length)], { force: true, emotion: EMOTION.AMUSED });
    const quoteInterval = setInterval(() => {
      quoteIdx++;
      if (quoteIdx < 3) {
        DaveMode._showBubble(raveQuotes[Math.floor(Math.random() * raveQuotes.length)], { force: true, emotion: EMOTION.AMUSED });
      }
    }, 2500);

    this._raveTimer = setTimeout(() => {
      clearInterval(particleInterval);
      clearInterval(raveSwitch);
      clearInterval(raveColorInterval);
      clearInterval(quoteInterval);
      overlay.remove();
      p.style.removeProperty('--dave-iris'); // Let emotion color take over again
      const eye = p.querySelector('.dave-presence-eye');
      if (eye) eye.classList.remove('dave-rave-headbang', 'dave-rave-bounce');
      this._raveTimer = null;
      DaveMode._setEmotion(EMOTION.WARM);
      DaveMode._showBubble("Whew... I need a moment. My pixels are sweating.", { force: true, emotion: EMOTION.WARM });
    }, 8000);
  }

  _cmdFortune() {
    const p = DaveMode._presenceEl;
    if (!p) return;

    DaveMode._setEmotion(EMOTION.EXISTENTIAL);
    p.classList.remove('dave-ambient');
    p.classList.add('dave-fortune-glow');
    DaveMode._showBubble("*gazes into the digital void*", { force: true, emotion: EMOTION.EXISTENTIAL });

    // Spawn floating mystic text icons orbiting Dave (styled in Dave's color)
    const icons = ['?', '*', '\u221E', '\u2605', '\u25C6', '\u2726', '\u2738', '\u00D7'];
    const color = getComputedStyle(p).getPropertyValue('--dave-iris').trim() || '#00ff41';
    const rect = p.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const spawnedIcons = [];
    let iconIdx = 0;
    const iconInterval = setInterval(() => {
      if (iconIdx >= 6) { clearInterval(iconInterval); return; }
      const el = document.createElement('span');
      el.className = 'dave-fortune-icon';
      el.textContent = icons[Math.floor(Math.random() * icons.length)];
      el.style.left = cx + 'px';
      el.style.top = cy + 'px';
      el.style.color = color;
      el.style.fontFamily = "'Courier New', monospace";
      el.style.fontWeight = 'bold';
      const angle = (iconIdx / 6) * Math.PI * 2;
      const r = 30 + Math.random() * 20;
      el.style.setProperty('--fx', Math.cos(angle) * r + 'px');
      el.style.setProperty('--fy', Math.sin(angle) * r - 20 + 'px');
      el.style.setProperty('--fx2', Math.cos(angle + 1) * (r + 10) + 'px');
      el.style.setProperty('--fy2', Math.sin(angle + 1) * r - 30 + 'px');
      el.style.setProperty('--fortune-dur', (2.5 + Math.random()) + 's');
      document.body.appendChild(el);
      spawnedIcons.push(el);
      iconIdx++;
    }, 250);

    // Dramatic build-up
    setTimeout(() => {
      DaveMode._showBubble("The void whispers back...", { force: true, emotion: EMOTION.EXISTENTIAL });
    }, 2200);

    // Reveal fortune
    setTimeout(() => {
      spawnedIcons.forEach(el => el.remove());
      p.classList.remove('dave-fortune-glow');
      if (!DaveMode._isDragging) p.classList.add('dave-ambient');
      const fortune = FORTUNES[Math.floor(Math.random() * FORTUNES.length)];
      DaveMode._setEmotion(EMOTION.SMUG);
      DaveMode._showBubble(fortune, { force: true, emotion: EMOTION.SMUG });
    }, 4500);
  }

  _cmdDance() {
    const p = DaveMode._presenceEl;
    if (!p) return;

    DaveMode._setEmotion(EMOTION.AMUSED);
    DaveMode._showBubble("Watch this!", { force: true, emotion: EMOTION.AMUSED });
    p.classList.remove('dave-ambient');

    const steps = [
      { cls: 'dave-hop', dur: 400 },
      { cls: 'dave-dance-pop', dur: 350 },
      { cls: 'dave-dance-slide-left', dur: 450 },
      { cls: 'dave-dance-slide-right', dur: 450 },
      { cls: 'dave-dance-spin', dur: 600 },
      { cls: 'dave-dance-shimmy', dur: 400 },
      { cls: 'dave-dance-lean-left', dur: 300 },
      { cls: 'dave-dance-lean-right', dur: 300 },
      { cls: 'dave-dance-bounce-twist', dur: 500 },
      { cls: 'dave-dance-stretch', dur: 400 },
      { cls: 'dave-dance-double-spin', dur: 900 },
      { cls: 'dave-dance-pop', dur: 350 },
      { cls: 'dave-dropped', dur: 500 },
    ];

    const allClasses = [...new Set(steps.map(s => s.cls))];

    const noteChars = ['\u266A', '\u266B', '\u266C'];
    const noteInterval = setInterval(() => {
      if (!p) return;
      const rect = p.getBoundingClientRect();
      const note = document.createElement('span');
      note.className = 'dave-music-note';
      note.textContent = noteChars[Math.floor(Math.random() * noteChars.length)];
      note.style.left = (rect.left + rect.width / 2 + (Math.random() - 0.5) * 30) + 'px';
      note.style.top = rect.top + 'px';
      note.style.color = getComputedStyle(p).getPropertyValue('--dave-iris').trim() || '#00ff41';
      note.style.animation = 'daveMusicNoteRise 1.5s ease-out forwards';
      document.body.appendChild(note);
      setTimeout(() => note.remove(), 1500);
    }, 250);

    let delay = 0;
    for (const step of steps) {
      setTimeout(() => {
        p.classList.remove(...allClasses);
        void p.offsetWidth;
        p.classList.add(step.cls);
      }, delay);
      delay += step.dur;
    }

    setTimeout(() => {
      clearInterval(noteInterval);
      p.classList.remove(...allClasses);
      if (!DaveMode._isDragging) p.classList.add('dave-ambient');
      DaveMode._showBubble("Thank you, thank you. I'll be here all week.", { force: true, emotion: EMOTION.SMUG });
    }, delay);
  }

  _cmdStory() {
    const story = STORIES[Math.floor(Math.random() * STORIES.length)];
    DaveMode._setEmotion(EMOTION.WARM);
    this._storyGen = (this._storyGen || 0) + 1;
    const gen = this._storyGen;

    const showPart = (i) => {
      if (i >= story.length || gen !== this._storyGen) return;
      const emotion = i === story.length - 1 ? EMOTION.SMUG : EMOTION.WARM;
      DaveMode._setEmotion(emotion);

      // Word-by-word fade instead of typewriter
      this._showBubbleFadeWords(story[i], emotion, gen, () => {
        // After all words visible, pause for reading then next part
        if (i < story.length - 1) {
          setTimeout(() => showPart(i + 1), 3000);
        }
      });
    };
    showPart(0);
  }

  // Show text in the bubble with word-by-word fade (no typewriter)
  _showBubbleFadeWords(text, emotion, gen, onDone) {
    if (!DaveMode._bubbleEl || !DaveMode._presenceEl) return;

    DaveMode._twGen++; // cancel any running typewriter
    clearTimeout(DaveMode._twTimeout);
    clearTimeout(DaveMode._bubbleTimer);

    const textEl = DaveMode._bubbleEl.querySelector('.dave-bubble-text');
    const cursorEl = DaveMode._bubbleEl.querySelector('.dave-bubble-cursor');
    textEl.innerHTML = '';
    cursorEl.style.display = 'none';

    DaveMode._bubbleEl.classList.remove('dave-bubble-exiting', 'dave-bubble-glitch');
    DaveMode._bubbleEl.classList.add('dave-bubble-visible');
    DaveMode._presenceEl.classList.add('dave-speaking');
    DaveMode._updateBubblePosition();

    // Create word spans
    const words = text.split(/(\s+)/);
    const spans = [];
    for (const w of words) {
      const span = document.createElement('span');
      if (/^\s+$/.test(w)) {
        span.textContent = w;
        textEl.appendChild(span);
      } else {
        span.className = 'dave-story-word';
        span.textContent = w;
        textEl.appendChild(span);
        spans.push(span);
      }
    }

    // Fade in words one by one
    let idx = 0;
    const wordTimer = setInterval(() => {
      if (gen !== this._storyGen) { clearInterval(wordTimer); return; }
      if (idx >= spans.length) {
        clearInterval(wordTimer);
        if (onDone) onDone();
        return;
      }
      spans[idx].classList.add('visible');
      idx++;
    }, 120);
  }

  _cmdSleep() {
    const p = DaveMode._presenceEl;
    if (!p) return;

    DaveMode._setEmotion(EMOTION.WARM);
    DaveMode._showBubble("*yaaaawn* ...goodnight world...", { force: true, emotion: EMOTION.WARM });

    // Yawn stretch first
    p.classList.remove('dave-ambient');
    p.classList.add('dave-yawn-stretch');

    setTimeout(() => {
      p.classList.remove('dave-yawn-stretch');
      p.classList.add('dave-sleep-mode');

      // FULLY stop cursor-follow: remove the global mousemove listener
      // so it can't re-add inline transforms that fight the sleep CSS.
      DaveMode._resumeIrisScan();   // Clear cursor-follow class + inline transform
      DaveMode._stopCursorFollow(); // Remove the mousemove listener entirely

      const zzzInterval = setInterval(() => {
        if (!p.classList.contains('dave-sleep-mode')) { clearInterval(zzzInterval); return; }
        const rect = p.getBoundingClientRect();
        const z = document.createElement('span');
        z.className = 'dave-sleep-zzz';
        z.textContent = 'Z';
        z.style.left = (rect.left + rect.width / 2 + (Math.random() - 0.5) * 10) + 'px';
        z.style.top = (rect.top - 5) + 'px';
        z.style.fontSize = (10 + Math.random() * 10) + 'px';
        document.body.appendChild(z);
        setTimeout(() => z.remove(), 2500);
      }, 700);

      this._sleepClickHandler = () => {
        this._wakeDave(p, zzzInterval);
      };
      p.addEventListener('click', this._sleepClickHandler, { once: true });

      this._sleepTimer = setTimeout(() => {
        if (p.classList.contains('dave-sleep-mode')) {
          this._wakeDave(p, zzzInterval);
        }
      }, 30000);
    }, 1000);
  }

  _wakeDave(p, zzzInterval) {
    clearTimeout(this._sleepTimer);
    this._sleepTimer = null;
    clearInterval(zzzInterval);
    if (this._sleepClickHandler) {
      p.removeEventListener('click', this._sleepClickHandler);
      this._sleepClickHandler = null;
    }
    p.classList.remove('dave-sleep-mode');

    // Restart cursor-follow that was stopped during sleep
    DaveMode._startCursorFollow();

    DaveMode._setEmotion(EMOTION.ALARMED);
    p.classList.add('dave-wake-startle');
    DaveMode._showBubble("WHAT?! WHO?! I WASN'T SLEEPING!", { force: true, emotion: EMOTION.ALARMED });
    setTimeout(() => {
      p.classList.remove('dave-wake-startle');
      if (!DaveMode._isDragging) p.classList.add('dave-ambient');
      DaveMode._setEmotion(EMOTION.NEUTRAL);
    }, 1500);
  }

  _cmdMusic() {
    DaveMusicMode.start(12000);
  }

  _cmdHelp() {
    const lines = COMMANDS
      .filter(c => c.name !== 'music')
      .map(c => `${c.icon} ${c.name} \u2014 ${c.desc}`)
      .join('\n');
    DaveMode._setEmotion(EMOTION.WARM);
    DaveMode._showBubble("My tricks:\n" + lines, { force: true, emotion: EMOTION.WARM });
  }

  // ============================================================
  //  Game Overlay
  // ============================================================

  _cmdGame(gameName) {
    if (this._currentGame) {
      DaveMode._showBubble("One game at a time, champ.", { force: true, emotion: EMOTION.ANNOYED });
      return;
    }

    this._ensureOverlay();
    const overlay = this._overlayEl;
    const canvas = overlay.querySelector('.dave-game-canvas');
    const hud = overlay.querySelector('.dave-game-hud');
    const title = overlay.querySelector('.dave-game-title');

    if (gameName === 'snake') {
      title.textContent = 'DAVE SNAKE';
      canvas.width = 400;
      canvas.height = 400;
      const game = new DaveSnake();
      this._currentGame = game;
      game.start(canvas, hud);
    } else if (gameName === 'breakout') {
      title.textContent = 'DAVE BREAKOUT';
      canvas.width = 480;
      canvas.height = 400;
      const game = new DaveBreakout();
      this._currentGame = game;
      game.start(canvas, hud);
    }

    overlay.classList.add('active');
  }

  _ensureOverlay() {
    if (this._overlayEl) return;

    const overlay = document.createElement('div');
    overlay.id = 'daveGameOverlay';
    overlay.className = 'dave-game-overlay';
    overlay.innerHTML = `
      <div class="dave-game-container">
        <div class="dave-game-header">
          <span class="dave-game-title"></span>
          <button class="dave-game-close">&times;</button>
        </div>
        <canvas class="dave-game-canvas"></canvas>
        <div class="dave-game-hud"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    this._overlayEl = overlay;

    overlay.querySelector('.dave-game-close').addEventListener('click', () => this._closeGame());

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._currentGame) {
        e.stopPropagation();
        this._closeGame();
      }
    });
  }

  _closeGame() {
    if (this._currentGame) {
      this._currentGame.destroy();
      this._currentGame = null;
    }
    if (this._overlayEl) {
      this._overlayEl.classList.remove('active');
    }
    DaveMode._setEmotion(EMOTION.NEUTRAL);
  }
}

export const DaveCommands = new _DaveCommands();
