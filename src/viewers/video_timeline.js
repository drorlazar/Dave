/**
 * video_timeline.js - Timeline scrubber with playhead, seek, and trim handles
 * Positioned between video area and toolbar (40px height).
 */

export class VideoTimeline {
  constructor(editor) {
    this.editor = editor;
    this.el = null;
    this._trackEl = null;
    this._progressEl = null;
    this._playheadEl = null;
    this._trimRegionEl = null;
    this._trimInHandle = null;
    this._trimOutHandle = null;
    this._timeStartEl = null;
    this._timeEndEl = null;

    this._dragging = null; // 'playhead' | 'trimIn' | 'trimOut' | null
    this._onDocMouseMove = this._handleDocMouseMove.bind(this);
    this._onDocMouseUp = this._handleDocMouseUp.bind(this);
  }

  show() {
    if (!this.el) this._create();
    this.el.style.display = 'flex';
    this.updateTrimHandles();
    this.updatePlayhead();
  }

  hide() {
    if (this.el) this.el.style.display = 'none';
  }

  _create() {
    this.el = document.createElement('div');
    this.el.className = 've-timeline';
    this.el.innerHTML = `
      <span class="ve-timeline-time ve-timeline-time-start">00:00.0</span>
      <div class="ve-timeline-track">
        <div class="ve-timeline-trim-region"></div>
        <div class="ve-timeline-progress"></div>
        <div class="ve-timeline-playhead"></div>
        <div class="ve-trim-handle ve-trim-handle-in" title="Trim in"></div>
        <div class="ve-trim-handle ve-trim-handle-out" title="Trim out"></div>
      </div>
      <span class="ve-timeline-time ve-timeline-time-end">00:00.0</span>
    `;

    this._trackEl = this.el.querySelector('.ve-timeline-track');
    this._progressEl = this.el.querySelector('.ve-timeline-progress');
    this._playheadEl = this.el.querySelector('.ve-timeline-playhead');
    this._trimRegionEl = this.el.querySelector('.ve-timeline-trim-region');
    this._trimInHandle = this.el.querySelector('.ve-trim-handle-in');
    this._trimOutHandle = this.el.querySelector('.ve-trim-handle-out');
    this._timeStartEl = this.el.querySelector('.ve-timeline-time-start');
    this._timeEndEl = this.el.querySelector('.ve-timeline-time-end');

    this.editor.overlay.appendChild(this.el);
    this._bindEvents();
  }

  _bindEvents() {
    // Click track to seek
    this._trackEl.addEventListener('mousedown', (e) => {
      // Check if clicking on a handle
      if (e.target.classList.contains('ve-trim-handle')) return;
      this._dragging = 'playhead';
      this._seekToMouse(e);
      document.addEventListener('mousemove', this._onDocMouseMove);
      document.addEventListener('mouseup', this._onDocMouseUp);
      e.preventDefault();
    });

    // Trim handles
    this._trimInHandle.addEventListener('mousedown', (e) => {
      this._dragging = 'trimIn';
      document.addEventListener('mousemove', this._onDocMouseMove);
      document.addEventListener('mouseup', this._onDocMouseUp);
      e.preventDefault();
      e.stopPropagation();
    });

    this._trimOutHandle.addEventListener('mousedown', (e) => {
      this._dragging = 'trimOut';
      document.addEventListener('mousemove', this._onDocMouseMove);
      document.addEventListener('mouseup', this._onDocMouseUp);
      e.preventDefault();
      e.stopPropagation();
    });

    // Prevent propagation
    this.el.addEventListener('click', (e) => e.stopPropagation());
    this.el.addEventListener('mousedown', (e) => e.stopPropagation());
  }

  _handleDocMouseMove(e) {
    if (!this._dragging) return;
    const rect = this._trackEl.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const duration = this.editor.videoEl?.duration || 0;
    if (duration <= 0) return;
    const time = pct * duration;

    if (this._dragging === 'playhead') {
      this.editor.videoEl.currentTime = Math.max(this.editor.trimIn, Math.min(this.editor.trimOut, time));
    } else if (this._dragging === 'trimIn') {
      this.editor.trimIn = Math.max(0, Math.min(time, this.editor.trimOut - 0.1));
      this.updateTrimHandles();
    } else if (this._dragging === 'trimOut') {
      this.editor.trimOut = Math.min(duration, Math.max(time, this.editor.trimIn + 0.1));
      this.updateTrimHandles();
    }
  }

  _handleDocMouseUp() {
    this._dragging = null;
    document.removeEventListener('mousemove', this._onDocMouseMove);
    document.removeEventListener('mouseup', this._onDocMouseUp);
  }

  _seekToMouse(e) {
    const rect = this._trackEl.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const duration = this.editor.videoEl?.duration || 0;
    if (duration <= 0) return;
    const time = pct * duration;
    this.editor.videoEl.currentTime = Math.max(this.editor.trimIn, Math.min(this.editor.trimOut, time));
  }

  updatePlayhead() {
    if (!this._playheadEl || !this.editor.videoEl) return;
    const duration = this.editor.videoEl.duration || 0;
    if (duration <= 0) return;
    const pct = (this.editor.videoEl.currentTime / duration) * 100;
    this._playheadEl.style.left = `${pct}%`;
    this._progressEl.style.width = `${pct}%`;

    // Update time labels
    this._timeStartEl.textContent = this.editor._formatTime(this.editor.trimIn);
    this._timeEndEl.textContent = this.editor._formatTime(this.editor.trimOut);
  }

  updateTrimHandles() {
    if (!this._trimInHandle || !this.editor.videoEl) return;
    const duration = this.editor.videoEl.duration || 0;
    if (duration <= 0) return;

    const inPct = (this.editor.trimIn / duration) * 100;
    const outPct = (this.editor.trimOut / duration) * 100;

    this._trimInHandle.style.left = `${inPct}%`;
    this._trimOutHandle.style.left = `${outPct}%`;

    // Trim region highlight
    this._trimRegionEl.style.left = `${inPct}%`;
    this._trimRegionEl.style.width = `${outPct - inPct}%`;
  }
}
