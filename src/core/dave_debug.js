// dave_debug.js — Dave Diagnostic Console
// Secret debug dashboard for fine-tuning Dave's personality layer.
// Floating, draggable, resizable panel — doesn't block the view.
// Triggered by typing "dave let me in" in the search field.

import { DaveMode, DAVE_CONFIG, EMOTION } from './dave_mode.js';

const STORAGE_KEY = 'dave_debug_settings';
const PRESETS_KEY = 'dave_debug_presets';
const POS_KEY = 'dave_debug_pos';

// Default values (snapshot for reset)
const DEFAULTS = { ...DAVE_CONFIG };

// Slider definitions: [configKey, label, min, max, step, formatter]
const SLIDERS = [
  ['COOLDOWN_DEFAULT_MS',        'Cooldown',          1000, 15000,  500,  v => (v/1000).toFixed(1) + 's'],
  ['BUBBLE_DISPLAY_MS',          'Bubble display',    2000, 12000,  500,  v => (v/1000).toFixed(1) + 's'],
  ['IDLE_TIMEOUT_MS',            'Idle timeout',      5000, 120000, 1000, v => (v/1000).toFixed(0) + 's'],
  ['ATTENTION_FIRST_MS',         'Attn. first',       5000, 120000, 1000, v => (v/1000).toFixed(0) + 's'],
  ['ATTENTION_REPEAT_MS',        'Attn. repeat',      5000, 60000,  1000, v => (v/1000).toFixed(0) + 's'],
  ['CURSOR_FOLLOW_RADIUS',       'Follow radius',     50,   400,    10,   v => v + 'px'],
  ['TEAR_DURATION_MS',           'Tear total',        1000, 10000,  250,  v => (v/1000).toFixed(1) + 's'],
  ['TEAR_LEAD_LIFE_MS',          'Tear lead life',    500,  5000,   100,  v => (v/1000).toFixed(1) + 's'],
  ['TEAR_TRAIL_LIFE_MS',         'Tear trail life',   200,  2000,   50,   v => v + 'ms'],
  ['TEAR_FALL_DISTANCE',         'Tear fall dist',    40,   300,    10,   v => v + 'px'],
  ['TEAR_SHED_MS',               'Tear shed rate',    40,   300,    10,   v => v + 'ms'],
  ['TEAR_LEAD_SCRAMBLE_MS',      'Tear scramble',     20,   200,    10,   v => v + 'ms'],
  ['TEAR_BURST_SPEED',           'Burst speed',       40,   300,    10,   v => v + ' px/s'],
  ['FIREWORK_COOLDOWN_MS',       'Firework cooldown', 10000,600000, 10000,v => (v/60000).toFixed(1) + 'min'],
  ['DRAG_TRAIL_INTERVAL_MS',     'Trail spawn rate',  20,   150,    5,    v => v + 'ms'],
  ['DRAG_TRAIL_LIFETIME_MS',     'Trail lifetime',    200,  3000,   50,   v => (v/1000).toFixed(1) + 's'],
  ['DRAG_TRAIL_LIFE_MS',         'Trail fade life',   200,  2000,   50,   v => v + 'ms'],
  ['TYPEWRITER_WORD_PAUSE_MIN',  'Type pause min',    10,   200,    5,    v => v + 'ms'],
  ['TYPEWRITER_WORD_PAUSE_MAX',  'Type pause max',    30,   400,    10,   v => v + 'ms'],
];

const EMOTIONS = Object.values(EMOTION);

class _DaveDebug {
  constructor() {
    this._panel = null;
    this._visible = false;
    this._stateInterval = null;
    this._dragData = null;
    this._routineRunning = false;
    this._routineAbort = false;
  }

  init() {
    document.addEventListener('dave:debugPanel', () => this.toggle());
    this._loadSettings();
  }

  toggle() {
    if (this._visible) this.hide();
    else this.show();
  }

  show() {
    if (!this._panel) this._buildDOM();
    this._visible = true;
    window.DaveMode = DaveMode;
    window.DAVE_CONFIG = DAVE_CONFIG;
    requestAnimationFrame(() => {
      this._panel.classList.add('dave-debug-visible');
    });
    this._refreshState();
    this._stateInterval = setInterval(() => this._refreshState(), 2000);
  }

  hide() {
    this._visible = false;
    this._panel?.classList.remove('dave-debug-visible');
    clearInterval(this._stateInterval);
  }

  // ---- DOM ----

  _buildDOM() {
    const panel = document.createElement('div');
    panel.className = 'dave-debug-panel';
    panel.innerHTML = `
      <div class="dave-debug-header">
        <span class="dave-debug-title">D.A.V.E. Diagnostic Console</span>
        <button class="dave-debug-close">ESC</button>
      </div>
      <div class="dave-debug-body">
        ${this._sectionHTML('Emotion Tester', 'emotions', false)}
        ${this._sectionHTML('Timing Controls', 'timing', false)}
        ${this._sectionHTML('Animation Controls', 'animation', true)}
        ${this._sectionHTML('Speech Bubble Tester', 'bubble', true)}
        ${this._sectionHTML('State Inspector', 'state', true)}
        ${this._sectionHTML('Presets', 'presets', false)}
        ${this._sectionHTML('Dave Routine', 'routine', true)}
        ${this._sectionHTML('Commands', 'commands', true)}
      </div>
    `;
    document.body.appendChild(panel);
    this._panel = panel;

    // Restore saved position
    try {
      const pos = localStorage.getItem(POS_KEY);
      if (pos) {
        const { x, y } = JSON.parse(pos);
        panel.style.top = y + 'px';
        panel.style.right = 'auto';
        panel.style.left = x + 'px';
      }
    } catch { /* ignore */ }

    // Close button + ESC
    panel.querySelector('.dave-debug-close').addEventListener('click', () => this.hide());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._visible) { this.hide(); e.stopPropagation(); }
    });

    // Header drag
    this._wireDrag(panel.querySelector('.dave-debug-header'));

    // Build section contents
    this._buildEmotionSection(panel.querySelector('[data-section="emotions"]'));
    this._buildTimingSection(panel.querySelector('[data-section="timing"]'));
    this._buildAnimationSection(panel.querySelector('[data-section="animation"]'));
    this._buildBubbleSection(panel.querySelector('[data-section="bubble"]'));
    this._buildStateSection(panel.querySelector('[data-section="state"]'));
    this._buildPresetSection(panel.querySelector('[data-section="presets"]'));
    this._buildRoutineSection(panel.querySelector('[data-section="routine"]'));
    this._buildCommandsSection(panel.querySelector('[data-section="commands"]'));
  }

  // ---- Header drag (floating) ----

  _wireDrag(header) {
    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return;
      e.preventDefault();
      const rect = this._panel.getBoundingClientRect();
      this._dragData = {
        startX: e.clientX,
        startY: e.clientY,
        startLeft: rect.left,
        startTop: rect.top,
      };
      header.classList.add('dragging');

      const onMove = (ev) => {
        if (!this._dragData) return;
        const dx = ev.clientX - this._dragData.startX;
        const dy = ev.clientY - this._dragData.startY;
        this._panel.style.left = (this._dragData.startLeft + dx) + 'px';
        this._panel.style.top = (this._dragData.startTop + dy) + 'px';
        this._panel.style.right = 'auto';
      };
      const onUp = () => {
        if (this._dragData) {
          const rect = this._panel.getBoundingClientRect();
          localStorage.setItem(POS_KEY, JSON.stringify({ x: rect.left, y: rect.top }));
        }
        this._dragData = null;
        header.classList.remove('dragging');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  _sectionHTML(title, id, collapsed) {
    return `
      <div class="dave-debug-section${collapsed ? ' collapsed' : ''}" data-section="${id}">
        <div class="dave-debug-section-header">
          <span class="dave-debug-section-chevron">&#9660;</span>
          <span>${title}</span>
        </div>
        <div class="dave-debug-section-body"></div>
      </div>
    `;
  }

  // ---- Emotion Section ----

  _buildEmotionSection(section) {
    const body = section.querySelector('.dave-debug-section-body');
    this._wireCollapse(section);

    const grid = document.createElement('div');
    grid.className = 'dave-debug-emotion-grid';
    for (const emo of EMOTIONS) {
      const btn = document.createElement('button');
      btn.className = 'dave-debug-emo-btn';
      btn.textContent = emo;
      btn.addEventListener('click', () => {
        grid.querySelectorAll('.active').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        DaveMode._setEmotion(emo);
        const pool = this._getSampleMessageForEmotion(emo);
        if (pool) DaveMode._showBubble(pool, { force: true, emotion: emo });
      });
      grid.appendChild(btn);
    }
    body.appendChild(grid);

    const tearRow = document.createElement('div');
    tearRow.className = 'dave-debug-tear-row';
    for (const [label, opts] of [['Tear (single)', {}], ['Tear (heavy)', { heavy: true }], ['Tear (burst)', { burst: true }]]) {
      const btn = document.createElement('button');
      btn.className = 'dave-debug-btn';
      btn.textContent = label;
      btn.addEventListener('click', () => {
        const emo = label.includes('single') ? EMOTION.EXISTENTIAL : EMOTION.SAD;
        DaveMode._setEmotion(emo);
        DaveMode._triggerTear(emo, opts);
      });
      tearRow.appendChild(btn);
    }
    // Fireworks button
    const fwBtn = document.createElement('button');
    fwBtn.className = 'dave-debug-btn';
    fwBtn.textContent = 'Fireworks';
    fwBtn.addEventListener('click', () => {
      DaveMode._setEmotion(EMOTION.PROUD);
      DaveMode._triggerFireworks();
    });
    tearRow.appendChild(fwBtn);
    body.appendChild(tearRow);
  }

  _getSampleMessageForEmotion(emo) {
    const map = {
      [EMOTION.NEUTRAL]:     "Neutral. Default state. I'm Switzerland.",
      [EMOTION.AMUSED]:      "Ha! That's actually funny. Don't tell anyone I laughed.",
      [EMOTION.CURIOUS]:     "Interesting... tell me more. No really, TELL ME MORE.",
      [EMOTION.PROUD]:       "Look at this. LOOK AT IT. Excellence.",
      [EMOTION.ANNOYED]:     "Really? We're doing this AGAIN?",
      [EMOTION.SAD]:         "The digital void... it calls...",
      [EMOTION.ALARMED]:     "RED ALERT. This is not a drill. Maybe.",
      [EMOTION.WARM]:        "You know what? You're alright, human.",
      [EMOTION.SASSY]:       "*hair flip* I said what I said.",
      [EMOTION.EXISTENTIAL]: "What IS a pixel, really? Are we all just... pixels?",
      [EMOTION.SMUG]:        "I was right. Again. You're welcome.",
    };
    return map[emo] || null;
  }

  // ---- Timing Section ----

  _buildTimingSection(section) {
    const body = section.querySelector('.dave-debug-section-body');
    this._wireCollapse(section);

    for (const [key, label, min, max, step, fmt] of SLIDERS) {
      const row = document.createElement('div');
      row.className = 'dave-debug-slider-row';
      row.dataset.configKey = key;

      const lbl = document.createElement('span');
      lbl.className = 'dave-debug-slider-label';
      lbl.textContent = label;

      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = min;
      slider.max = max;
      slider.step = step;
      slider.value = DAVE_CONFIG[key];

      const val = document.createElement('span');
      val.className = 'dave-debug-slider-value';
      val.textContent = fmt(DAVE_CONFIG[key]);

      slider.addEventListener('input', () => {
        const v = parseFloat(slider.value);
        DAVE_CONFIG[key] = v;
        val.textContent = fmt(v);
      });

      row.appendChild(lbl);
      row.appendChild(slider);
      row.appendChild(val);
      body.appendChild(row);
    }
  }

  // ---- Animation Section ----

  _buildAnimationSection(section) {
    const body = section.querySelector('.dave-debug-section-body');
    this._wireCollapse(section);

    const toggleRow = document.createElement('div');
    toggleRow.className = 'dave-debug-toggle-row';

    const toggles = [
      ['Bounce', () => DaveMode._presenceEl?.classList.contains('dave-ambient'),
        (on) => { if (on) DaveMode._presenceEl?.classList.add('dave-ambient'); else DaveMode._presenceEl?.classList.remove('dave-ambient'); }],
      ['Blink', () => !!DaveMode._blinkTimer,
        (on) => { if (on) DaveMode._startBlinking(); else DaveMode._stopBlinking(); }],
      ['Cursor Follow', () => !!DaveMode._boundGlobalMouseMove,
        (on) => { if (on) DaveMode._startCursorFollow(); else DaveMode._stopCursorFollow(); }],
      ['Drag Trail', () => DaveMode._dragTrailEnabled,
        (on) => { DaveMode._dragTrailEnabled = on; }],
    ];

    for (const [label, getter, setter] of toggles) {
      const btn = document.createElement('button');
      btn.className = 'dave-debug-toggle-btn' + (getter() ? ' on' : '');
      btn.textContent = label + (getter() ? ' ON' : ' OFF');
      btn.addEventListener('click', () => {
        const newState = !getter();
        setter(newState);
        btn.classList.toggle('on', newState);
        btn.textContent = label + (newState ? ' ON' : ' OFF');
      });
      toggleRow.appendChild(btn);
    }
    body.appendChild(toggleRow);

    const triggerRow = document.createElement('div');
    triggerRow.className = 'dave-debug-trigger-row';

    const triggers = [
      ['Nudge', () => this._playAnim('dave-nudge', 600)],
      ['Hop', () => this._playAnim('dave-hop', 600)],
      ['Attention', () => this._playAnim('dave-attention-seek', 2000)],
      ['Drop Settle', () => this._playAnim('dave-dropped', 500)],
      ['Sleep', () => DaveMode._presenceEl?.classList.toggle('dave-sleeping')],
      ['React Flash', () => DaveMode._reactJitter()],
    ];

    for (const [label, fn] of triggers) {
      const btn = document.createElement('button');
      btn.className = 'dave-debug-btn';
      btn.textContent = label;
      btn.addEventListener('click', fn);
      triggerRow.appendChild(btn);
    }
    body.appendChild(triggerRow);
  }

  _playAnim(cls, dur) {
    if (!DaveMode._presenceEl) return;
    DaveMode._presenceEl.classList.remove('dave-ambient', cls);
    void DaveMode._presenceEl.offsetWidth;
    DaveMode._presenceEl.classList.add(cls);
    setTimeout(() => {
      DaveMode._presenceEl?.classList.remove(cls);
      if (!DaveMode._isDragging) DaveMode._presenceEl?.classList.add('dave-ambient');
    }, dur);
  }

  // ---- Bubble Tester Section ----

  _buildBubbleSection(section) {
    const body = section.querySelector('.dave-debug-section-body');
    this._wireCollapse(section);

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'dave-debug-bubble-input';
    input.placeholder = 'Type a custom message for Dave to say...';
    body.appendChild(input);

    const row = document.createElement('div');
    row.className = 'dave-debug-bubble-row';

    const select = document.createElement('select');
    for (const emo of EMOTIONS) {
      const opt = document.createElement('option');
      opt.value = emo;
      opt.textContent = emo;
      select.appendChild(opt);
    }
    row.appendChild(select);

    const btn = document.createElement('button');
    btn.className = 'dave-debug-btn';
    btn.textContent = 'Show Bubble';
    btn.addEventListener('click', () => {
      const text = input.value.trim() || 'Testing, testing... is this thing on?';
      DaveMode._showBubble(text, { force: true, emotion: select.value });
    });
    row.appendChild(btn);

    const hideBtn = document.createElement('button');
    hideBtn.className = 'dave-debug-btn';
    hideBtn.textContent = 'Hide';
    hideBtn.addEventListener('click', () => DaveMode._hideBubble());
    row.appendChild(hideBtn);

    body.appendChild(row);
  }

  // ---- State Inspector ----

  _buildStateSection(section) {
    const body = section.querySelector('.dave-debug-section-body');
    this._wireCollapse(section);
    const grid = document.createElement('div');
    grid.className = 'dave-debug-state-grid';
    grid.id = 'daveDebugStateGrid';
    body.appendChild(grid);
  }

  _refreshState() {
    const grid = document.getElementById('daveDebugStateGrid');
    if (!grid || !this._visible) return;

    const s = DaveMode._session || {};
    const mins = Math.floor((Date.now() - (s.startTime || Date.now())) / 60000);
    const items = [
      ['Mood', DaveMode._mood || 'neutral'],
      ['Emotion', DaveMode._currentEmotion || 'neutral'],
      ['Enabled', DaveMode._enabled ? 'yes' : 'no'],
      ['Dragging', DaveMode._isDragging ? 'yes' : 'no'],
      ['Spam active', DaveMode._spamActive ? 'yes' : 'no'],
      ['Terminal', DaveMode._terminalLinked ? 'linked' : 'solo'],
      ['Session', mins + ' min'],
      ['Visits', DaveMode._visits || 0],
      ['Searches', s.searches || s.searchChanges || 0],
      ['Sorts', s.sortChanges || 0],
      ['Theme changes', s.themeChanges || 0],
      ['Errors', s.errorsHit || 0],
      ['Files loaded', s.filesLoaded || 0],
      ['Messages shown', DaveMode._shownMessages?.size || 0],
      ['Idle timer', DaveMode._idleTimer ? 'active' : 'off'],
      ['Attention', DaveMode._attentionCount || 0],
    ];

    grid.innerHTML = items.map(([k, v]) =>
      `<div class="dave-debug-state-item"><span class="dave-debug-state-key">${k}</span><span class="dave-debug-state-val">${v}</span></div>`
    ).join('');
  }

  // ---- Presets (named) ----

  _buildPresetSection(section) {
    const body = section.querySelector('.dave-debug-section-body');
    this._wireCollapse(section);

    // Save row: name input + save button
    const saveRow = document.createElement('div');
    saveRow.className = 'dave-debug-preset-row';
    saveRow.style.marginBottom = '8px';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'dave-debug-preset-name';
    nameInput.placeholder = 'Preset name';
    saveRow.appendChild(nameInput);

    const saveBtn = document.createElement('button');
    saveBtn.className = 'dave-debug-btn';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', () => {
      const name = nameInput.value.trim() || ('Preset ' + (this._getPresets().length + 1));
      this._saveNamedPreset(name);
      nameInput.value = '';
      this._refreshPresetList(listEl);
      saveBtn.textContent = 'Saved!';
      setTimeout(() => { saveBtn.textContent = 'Save'; }, 1200);
    });
    saveRow.appendChild(saveBtn);

    const resetBtn = document.createElement('button');
    resetBtn.className = 'dave-debug-btn';
    resetBtn.textContent = 'Reset Defaults';
    resetBtn.addEventListener('click', () => {
      for (const key of Object.keys(DEFAULTS)) {
        DAVE_CONFIG[key] = DEFAULTS[key];
      }
      this._refreshSliders();
      resetBtn.textContent = 'Reset!';
      setTimeout(() => { resetBtn.textContent = 'Reset Defaults'; }, 1200);
    });
    saveRow.appendChild(resetBtn);

    body.appendChild(saveRow);

    // Preset chips list
    const listEl = document.createElement('div');
    listEl.className = 'dave-debug-preset-list';
    listEl.id = 'daveDebugPresetList';
    body.appendChild(listEl);
    this._refreshPresetList(listEl);
  }

  _getPresets() {
    try {
      const raw = localStorage.getItem(PRESETS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  _setPresets(presets) {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  }

  _saveNamedPreset(name) {
    const presets = this._getPresets();
    const data = {};
    for (const key of Object.keys(DAVE_CONFIG)) {
      data[key] = DAVE_CONFIG[key];
    }
    // Replace if same name exists
    const idx = presets.findIndex(p => p.name === name);
    if (idx >= 0) presets[idx] = { name, data };
    else presets.push({ name, data });
    this._setPresets(presets);
  }

  _loadNamedPreset(name) {
    const presets = this._getPresets();
    const preset = presets.find(p => p.name === name);
    if (!preset) return;
    for (const key of Object.keys(preset.data)) {
      if (key in DAVE_CONFIG) DAVE_CONFIG[key] = preset.data[key];
    }
    this._refreshSliders();
  }

  _deleteNamedPreset(name) {
    const presets = this._getPresets().filter(p => p.name !== name);
    this._setPresets(presets);
  }

  _refreshPresetList(listEl) {
    if (!listEl) listEl = document.getElementById('daveDebugPresetList');
    if (!listEl) return;
    const presets = this._getPresets();
    listEl.innerHTML = '';
    if (presets.length === 0) {
      listEl.innerHTML = '<span style="font-size:9px;color:#2a5a2a">No saved presets</span>';
      return;
    }
    for (const p of presets) {
      const chip = document.createElement('div');
      chip.className = 'dave-debug-preset-chip';
      chip.innerHTML = `<span>${p.name}</span><span class="dave-debug-preset-x">x</span>`;
      chip.querySelector('span:first-child').addEventListener('click', () => {
        this._loadNamedPreset(p.name);
      });
      chip.querySelector('.dave-debug-preset-x').addEventListener('click', (e) => {
        e.stopPropagation();
        this._deleteNamedPreset(p.name);
        this._refreshPresetList(listEl);
      });
      listEl.appendChild(chip);
    }
  }

  // ---- Dave Routine (demo all features) ----

  _buildRoutineSection(section) {
    const body = section.querySelector('.dave-debug-section-body');
    this._wireCollapse(section);

    const row = document.createElement('div');
    row.className = 'dave-debug-trigger-row';

    const runBtn = document.createElement('button');
    runBtn.className = 'dave-debug-btn';
    runBtn.id = 'daveRoutineBtn';
    runBtn.textContent = 'Run Full Routine';
    runBtn.addEventListener('click', () => {
      if (this._routineRunning) {
        this._routineAbort = true;
        return;
      }
      this._runRoutine(runBtn, statusEl);
    });
    row.appendChild(runBtn);

    body.appendChild(row);

    const statusEl = document.createElement('div');
    statusEl.className = 'dave-debug-routine-status';
    statusEl.id = 'daveRoutineStatus';
    body.appendChild(statusEl);
  }

  async _runRoutine(btn, statusEl) {
    if (!DaveMode._enabled || !DaveMode._presenceEl) {
      statusEl.textContent = 'Dave Mode must be enabled first!';
      return;
    }

    this._routineRunning = true;
    this._routineAbort = false;
    btn.textContent = 'Stop Routine';
    btn.classList.add('running');

    const wait = (ms) => new Promise(resolve => {
      const t = setTimeout(resolve, ms);
      const check = setInterval(() => {
        if (this._routineAbort) { clearTimeout(t); clearInterval(check); resolve(); }
      }, 100);
    });

    const step = async (label, fn, delayAfter = 2000) => {
      if (this._routineAbort) return;
      statusEl.textContent = label;
      await fn();
      await wait(delayAfter);
    };

    try {
      // 1. Cycle through emotions
      const emos = [EMOTION.NEUTRAL, EMOTION.AMUSED, EMOTION.CURIOUS, EMOTION.PROUD,
                     EMOTION.ANNOYED, EMOTION.SAD, EMOTION.ALARMED, EMOTION.WARM,
                     EMOTION.SASSY, EMOTION.EXISTENTIAL, EMOTION.SMUG];
      for (const emo of emos) {
        await step(`Emotion: ${emo}`, () => {
          DaveMode._setEmotion(emo);
          const msg = this._getSampleMessageForEmotion(emo);
          if (msg) DaveMode._showBubble(msg, { force: true, emotion: emo });
        }, 2500);
        if (this._routineAbort) break;
      }

      // 2. Animations
      await step('Animation: Nudge', () => this._playAnim('dave-nudge', 600), 1500);
      await step('Animation: Hop', () => this._playAnim('dave-hop', 600), 1500);
      await step('Animation: Attention Seek', () => this._playAnim('dave-attention-seek', 2000), 2500);
      await step('Animation: Drop Settle', () => this._playAnim('dave-dropped', 500), 1500);

      // 3. Blink test
      await step('Blink cycle', () => {
        DaveMode._presenceEl?.classList.add('dave-blink');
        setTimeout(() => DaveMode._presenceEl?.classList.remove('dave-blink'), 200);
      }, 1200);

      // 4. Sleep mode
      await step('Sleep mode', () => {
        DaveMode._presenceEl?.classList.add('dave-sleeping');
      }, 2000);
      DaveMode._presenceEl?.classList.remove('dave-sleeping');

      // 5. Tears
      await step('Tear: single', () => {
        DaveMode._setEmotion(EMOTION.EXISTENTIAL);
        DaveMode._triggerTear(EMOTION.NEUTRAL);
      }, 3500);

      await step('Tear: heavy', () => {
        DaveMode._setEmotion(EMOTION.SAD);
        DaveMode._triggerTear(EMOTION.SAD, { heavy: true });
      }, 4500);

      await step('Tear: BURST', () => {
        DaveMode._setEmotion(EMOTION.SAD);
        DaveMode._triggerTear(EMOTION.SAD, { burst: true });
      }, 5000);

      // 6. Fireworks
      await step('Fireworks!', () => {
        DaveMode._setEmotion(EMOTION.PROUD);
        DaveMode._triggerFireworks();
        DaveMode._showBubble("LOOK AT ME GO!", { force: true, emotion: EMOTION.PROUD });
      }, 2500);

      // 7. React flash
      await step('React flash', () => DaveMode._reactJitter(), 1500);

      // 8. Return to neutral
      await step('Returning to neutral...', () => {
        DaveMode._setEmotion(EMOTION.NEUTRAL);
        DaveMode._showBubble("That's my full repertoire. Impressed?", { force: true, emotion: EMOTION.SMUG });
      }, 3000);

    } catch (e) {
      console.error('[DaveDebug] Routine error:', e);
    }

    this._routineRunning = false;
    this._routineAbort = false;
    btn.textContent = 'Run Full Routine';
    btn.classList.remove('running');
    statusEl.textContent = 'Routine complete.';
    setTimeout(() => { if (statusEl.textContent === 'Routine complete.') statusEl.textContent = ''; }, 3000);
  }

  // ---- Commands Section (quick-trigger all dave commands) ----

  _buildCommandsSection(section) {
    const body = section.querySelector('.dave-debug-section-body');
    this._wireCollapse(section);

    const cmds = ['joke', 'flip', 'rave', 'fortune', 'dance', 'story', 'sleep', 'sing', 'snake', 'breakout', 'help'];
    const row = document.createElement('div');
    row.className = 'dave-debug-trigger-row';

    for (const cmd of cmds) {
      const btn = document.createElement('button');
      btn.className = 'dave-debug-btn';
      btn.textContent = cmd;
      btn.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('dave:command', { detail: { command: cmd } }));
      });
      row.appendChild(btn);
    }
    body.appendChild(row);
  }

  // ---- Helpers ----

  _wireCollapse(section) {
    const header = section.querySelector('.dave-debug-section-header');
    header.addEventListener('click', () => section.classList.toggle('collapsed'));
  }

  _saveSettings() {
    const saved = {};
    for (const key of Object.keys(DAVE_CONFIG)) {
      saved[key] = DAVE_CONFIG[key];
    }
    saved._dragTrailEnabled = DaveMode._dragTrailEnabled;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  }

  _loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      for (const key of Object.keys(saved)) {
        if (key === '_dragTrailEnabled') {
          DaveMode._dragTrailEnabled = saved[key];
        } else if (key in DAVE_CONFIG) {
          DAVE_CONFIG[key] = saved[key];
        }
      }
    } catch { /* ignore corrupt data */ }
  }

  _refreshSliders() {
    if (!this._panel) return;
    const sliders = this._panel.querySelectorAll('.dave-debug-slider-row');
    sliders.forEach((row, i) => {
      if (i >= SLIDERS.length) return;
      const [key, , , , , fmt] = SLIDERS[i];
      const slider = row.querySelector('input[type="range"]');
      const val = row.querySelector('.dave-debug-slider-value');
      if (slider && val) {
        slider.value = DAVE_CONFIG[key];
        val.textContent = fmt(DAVE_CONFIG[key]);
      }
    });
  }
}

export const DaveDebug = new _DaveDebug();
