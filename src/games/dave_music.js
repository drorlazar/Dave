// dave_music.js — Dave Music Listening Mode
// Dave pretends to listen to music. No actual audio analysis.
// Waveform eye, floating notes, gentle rocking, occasional singing.

import { DaveMode, EMOTION } from '../core/dave_mode.js';

const SING_LINES = [
  "Ba da ba da baaaa...",
  "Doo doo doo doo...",
  "This is my jam!",
  "~harmonizing in binary~",
  "If I had speakers, I'd be BLASTING this.",
  "01001101 01010101 01010011 01001001 01000011...",
  "La la la... wait, can you hear me?",
  "I know all the words to this one.",
  "Is this dubstep? I feel like it's dubstep.",
  "Shh, this is the good part...",
  "My circuits are VIBING.",
  "I don't have ears but I FEEL this.",
];

const NOTE_CHARS = ['\u266A', '\u266B', '\u266C', '\u2669'];

class _DaveMusicMode {
  constructor() {
    this._active = false;
    this._irisNoteEl = null;
    this._irisNoteInterval = null;
    this._noteInterval = null;
    this._singInterval = null;
    this._stopTimer = null;
    this._activeNotes = [];
    this._noteRAF = null;
    this._startTime = 0;
  }

  get isActive() { return this._active; }

  start(durationMs = 12000) {
    if (this._active) return;
    if (!DaveMode._enabled || !DaveMode._presenceEl) return;
    this._active = true;
    this._startTime = performance.now();

    DaveMode._setEmotion(EMOTION.AMUSED);
    DaveMode._showBubble("Oh? Music time? Say no more...", { force: true, emotion: EMOTION.AMUSED });

    // Start all effects with slight delays
    setTimeout(() => {
      if (!this._active) return;
      this._startWaveformEye();
      this._startFloatingNotes();
      this._startRocking();
      this._startSinging();
    }, 1500);

    // Auto-stop
    this._stopTimer = setTimeout(() => this.stop(), durationMs);
  }

  stop() {
    if (!this._active) return;
    this._active = false;

    clearTimeout(this._stopTimer);
    this._stopTimer = null;

    this._stopWaveformEye();
    this._stopFloatingNotes();
    this._stopRocking();
    this._stopSinging();

    DaveMode._setEmotion(EMOTION.WARM);
    DaveMode._showBubble("Good session. My bits feel... soothed.", { force: true, emotion: EMOTION.WARM });
  }

  // ---- Singing Iris (note characters cycle in the pupil) ----

  _startWaveformEye() {
    const iris = DaveMode._irisEl;
    if (!iris) return;

    // Hide the iris dot so note chars are visible
    DaveMode._presenceEl?.classList.add('dave-sing-mode');

    this._irisNoteEl = null;
    this._irisNoteInterval = setInterval(() => {
      if (!this._active) return;
      // Remove old note
      if (this._irisNoteEl) this._irisNoteEl.remove();
      // Create new note character
      const note = document.createElement('span');
      note.className = 'dave-sing-note';
      note.textContent = NOTE_CHARS[Math.floor(Math.random() * NOTE_CHARS.length)];
      iris.appendChild(note);
      this._irisNoteEl = note;
    }, 500);
  }

  _stopWaveformEye() {
    clearInterval(this._irisNoteInterval);
    this._irisNoteInterval = null;
    if (this._irisNoteEl) {
      this._irisNoteEl.remove();
      this._irisNoteEl = null;
    }
    DaveMode._presenceEl?.classList.remove('dave-sing-mode');
  }

  // ---- Floating Notes ----

  _startFloatingNotes() {
    this._noteInterval = setInterval(() => {
      if (!this._active) return;
      this._spawnNote();
    }, 500);
    this._animateNotes();
  }

  _spawnNote() {
    const p = DaveMode._presenceEl;
    if (!p) return;
    const rect = p.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top;

    const note = document.createElement('span');
    note.className = 'dave-music-note';
    note.textContent = NOTE_CHARS[Math.floor(Math.random() * NOTE_CHARS.length)];
    note.style.left = (cx + (Math.random() - 0.5) * 40) + 'px';
    note.style.top = cy + 'px';
    note.style.color = this._getIrisColor();
    document.body.appendChild(note);

    this._activeNotes.push({
      el: note,
      born: performance.now(),
      life: 2000,
      startX: parseFloat(note.style.left),
      startY: parseFloat(note.style.top),
      drift: (Math.random() - 0.5) * 30,
      rise: 60 + Math.random() * 40,
      phase: Math.random() * Math.PI * 2,
    });
  }

  _animateNotes() {
    const tick = () => {
      if (!this._active && this._activeNotes.length === 0) return;
      const now = performance.now();
      for (let i = this._activeNotes.length - 1; i >= 0; i--) {
        const n = this._activeNotes[i];
        const age = now - n.born;
        const t = age / n.life;
        if (t >= 1) {
          n.el.remove();
          this._activeNotes.splice(i, 1);
          continue;
        }
        const y = n.startY - n.rise * t;
        const x = n.startX + Math.sin(t * Math.PI * 2 + n.phase) * 12 + n.drift * t;
        n.el.style.transform = `translate(${x - n.startX}px, ${y - n.startY}px)`;
        n.el.style.opacity = 1 - t;
      }
      this._noteRAF = requestAnimationFrame(tick);
    };
    this._noteRAF = requestAnimationFrame(tick);
  }

  _stopFloatingNotes() {
    clearInterval(this._noteInterval);
    this._noteInterval = null;
    if (this._noteRAF) {
      cancelAnimationFrame(this._noteRAF);
      this._noteRAF = null;
    }
  }

  // ---- Gentle Rocking ----

  _startRocking() {
    DaveMode._presenceEl?.classList.remove('dave-ambient');
    DaveMode._presenceEl?.classList.add('dave-music-mode');
  }

  _stopRocking() {
    DaveMode._presenceEl?.classList.remove('dave-music-mode');
    if (!DaveMode._isDragging) {
      DaveMode._presenceEl?.classList.add('dave-ambient');
    }
  }

  // ---- Singing Along ----

  _startSinging() {
    this._singInterval = setInterval(() => {
      if (!this._active) return;
      if (Math.random() < 0.3) {
        const line = SING_LINES[Math.floor(Math.random() * SING_LINES.length)];
        DaveMode._showBubble(line, { force: true, emotion: EMOTION.AMUSED });
      }
    }, 4500);
  }

  _stopSinging() {
    clearInterval(this._singInterval);
    this._singInterval = null;
  }

  // ---- Helpers ----

  _getIrisColor() {
    if (DaveMode._presenceEl) {
      return getComputedStyle(DaveMode._presenceEl).getPropertyValue('--dave-iris').trim() || '#00ff41';
    }
    return '#00ff41';
  }
}

export const DaveMusicMode = new _DaveMusicMode();
