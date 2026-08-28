/**
 * video_export.js - Canvas + MediaRecorder export pipeline
 * Renders trimmed, cropped, filtered video to WebM via real-time canvas capture.
 * Supports concat segments (before/after).
 */

export class VideoExport {
  constructor(editor) {
    this.editor = editor;
    this.panel = null;
    this._format = 'webm';
    this._resolution = 'original'; // 'original' | '720p' | '480p'
    this._quality = 0.8; // 0-1
    this._exporting = false;
    this._cancelled = false;
    this._recorder = null;
    this._tempUrls = [];
    this._audioCtx = null;
    this._audioDest = null;
    this._audioSources = new WeakMap();
  }

  open() {
    if (!this.panel) this._create();
    this._updateSummary();
    this.panel.style.display = '';
  }

  close() {
    if (this.panel) this.panel.style.display = 'none';
    if (this._exporting) this.cancel();
  }

  cancel() {
    this._cancelled = true;
    if (this._recorder && this._recorder.state !== 'inactive') {
      this._recorder.stop();
    }
  }

  _create() {
    this.panel = document.createElement('div');
    this.panel.className = 've-export-panel';
    this.panel.innerHTML = `
      <div class="ve-export-header">
        <span>Export Video</span>
        <button class="ve-btn ve-export-close"><i class="fa fa-xmark"></i></button>
      </div>
      <div class="ve-export-body">
        <div class="ve-export-row">
          <label>Resolution</label>
          <div class="ve-export-resolutions">
            <button class="ve-export-res ve-active" data-res="original">Original</button>
            <button class="ve-export-res" data-res="720p">720p</button>
            <button class="ve-export-res" data-res="480p">480p</button>
          </div>
        </div>
        <div class="ve-export-row ve-quality-row">
          <label>Quality</label>
          <input type="range" class="ve-quality-slider" min="10" max="100" value="80" step="1">
          <span class="ve-quality-value">80%</span>
        </div>
        <div class="ve-export-summary">No edits</div>
        <div class="ve-export-estimate"></div>
        <div class="ve-export-error"></div>
        <div class="ve-export-progress">
          <div class="ve-export-progress-bar" style="width:0%"></div>
        </div>
        <div class="ve-export-progress-text"></div>
        <div class="ve-export-actions">
          <button class="ve-btn ve-export-download"><i class="fa fa-download"></i> Export</button>
          <button class="ve-btn ve-export-cancel" style="display:none"><i class="fa fa-xmark"></i> Cancel</button>
        </div>
      </div>
    `;

    this.editor.overlay.appendChild(this.panel);
    this._bindEvents();
  }

  _bindEvents() {
    // Resolution buttons
    this.panel.querySelectorAll('.ve-export-res').forEach(btn => {
      btn.addEventListener('click', () => {
        this.panel.querySelectorAll('.ve-export-res').forEach(b => b.classList.remove('ve-active'));
        btn.classList.add('ve-active');
        this._resolution = btn.dataset.res;
      });
    });

    // Quality slider
    const slider = this.panel.querySelector('.ve-quality-slider');
    const qValue = this.panel.querySelector('.ve-quality-value');
    slider.addEventListener('input', () => {
      this._quality = parseInt(slider.value) / 100;
      qValue.textContent = `${slider.value}%`;
    });

    // Close
    this.panel.querySelector('.ve-export-close').addEventListener('click', () => {
      this.editor._closeExport();
    });

    // Export button
    this.panel.querySelector('.ve-export-download').addEventListener('click', () => {
      if (!this._exporting) this._startExport();
    });

    // Cancel button
    this.panel.querySelector('.ve-export-cancel').addEventListener('click', () => {
      this.cancel();
    });

    // Prevent propagation
    this.panel.addEventListener('click', (e) => e.stopPropagation());
    this.panel.addEventListener('mousedown', (e) => e.stopPropagation());
  }

  _updateSummary() {
    if (!this.panel) return;
    this.panel.querySelector('.ve-export-summary').textContent = this.editor.getEditsSummary();
    this._showError('');
    this._updateEstimate();
  }

  async _updateEstimate() {
    const el = this.panel?.querySelector('.ve-export-estimate');
    if (!el) return;
    el.textContent = 'Output: WebM \u2014 estimating\u2026';
    const total = await this._getTotalDuration();
    el.textContent = `Output: WebM \u2014 about ${this._formatDuration(total)} to export. `
      + 'Export runs in real time \u2014 keep this tab focused.';
  }

  _formatDuration(seconds) {
    const s = Math.max(0, Math.round(seconds || 0));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  _showError(message) {
    const el = this.panel?.querySelector('.ve-export-error');
    if (!el) return;
    el.textContent = message || '';
    el.style.display = message ? 'block' : 'none';
  }

  /** Build the segment list, resolving concat clip durations up front. */
  async _getSegments() {
    const segments = [];
    if (this.editor.concatBefore) segments.push({ model: this.editor.concatBefore, type: 'before' });
    segments.push({ type: 'main', duration: Math.max(0, this.editor.trimOut - this.editor.trimIn) });
    if (this.editor.concatAfter) segments.push({ model: this.editor.concatAfter, type: 'after' });

    for (const seg of segments) {
      if (seg.type === 'main') continue;
      seg.url = await this._resolveModelUrl(seg.model);
      seg.duration = seg.url ? await this._probeDuration(seg.url) : 0;
    }
    return segments;
  }

  async _getTotalDuration() {
    const segments = await this._getSegments();
    this._releaseTempUrls();
    return segments.reduce((sum, s) => sum + (s.duration || 0), 0);
  }

  _probeDuration(url) {
    return new Promise((resolve) => {
      const probe = document.createElement('video');
      probe.preload = 'metadata';
      const finish = (d) => {
        probe.removeAttribute('src');
        resolve(isFinite(d) && d > 0 ? d : 0);
      };
      probe.addEventListener('loadedmetadata', () => finish(probe.duration), { once: true });
      probe.addEventListener('error', () => finish(0), { once: true });
      probe.src = url;
    });
  }

  _releaseTempUrls() {
    for (const url of this._tempUrls) URL.revokeObjectURL(url);
    this._tempUrls = [];
  }

  _getTargetDimensions() {
    const v = this.editor.videoEl;
    let w = v?.videoWidth || 1920;
    let h = v?.videoHeight || 1080;

    // Apply crop
    if (this.editor.cropRect) {
      const c = this.editor.cropRect;
      w = Math.round(w * c.w);
      h = Math.round(h * c.h);
    }

    // Apply resolution limit
    if (this._resolution === '720p' && h > 720) {
      const scale = 720 / h;
      w = Math.round(w * scale);
      h = 720;
    } else if (this._resolution === '480p' && h > 480) {
      const scale = 480 / h;
      w = Math.round(w * scale);
      h = 480;
    }

    // Ensure even dimensions (required by some codecs)
    w = w % 2 === 0 ? w : w + 1;
    h = h % 2 === 0 ? h : h + 1;

    return { w, h };
  }

  async _startExport() {
    this._exporting = true;
    this._cancelled = false;
    this._showError('');

    const exportBtn = this.panel.querySelector('.ve-export-download');
    const cancelBtn = this.panel.querySelector('.ve-export-cancel');
    const progressBar = this.panel.querySelector('.ve-export-progress');
    const progressFill = this.panel.querySelector('.ve-export-progress-bar');
    const progressText = this.panel.querySelector('.ve-export-progress-text');

    exportBtn.style.display = 'none';
    cancelBtn.style.display = 'flex';
    progressBar.style.display = 'block';
    progressText.style.display = 'block';

    const { w, h } = this._getTargetDimensions();
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    const fps = 30;

    try {
      // Precompute every segment duration so progress is monotonic 0-100%
      const segments = await this._getSegments();
      const totalDuration = segments.reduce((sum, s) => sum + (s.duration || 0), 0) || 1;

      const stream = canvas.captureStream(fps);
      const withAudio = this._attachAudio(stream);
      const mime = this._pickMimeType(withAudio);
      const bitRate = Math.round(w * h * fps * this._quality * 0.1);

      this._recorder = new MediaRecorder(stream, {
        mimeType: mime,
        videoBitsPerSecond: bitRate
      });

      const chunks = [];
      this._recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      const recordingDone = new Promise((resolve) => {
        this._recorder.onstop = () => resolve();
      });

      this._recorder.start(100); // collect data every 100ms

      // Build filter string
      const f = this.editor.filters;
      const filterStr = [
        `brightness(${f.brightness}%)`,
        `contrast(${f.contrast}%)`,
        `saturate(${f.saturate}%)`,
        `hue-rotate(${f.hueRotate}deg)`,
        `blur(${f.blur}px)`,
        `sepia(${f.sepia}%)`
      ].join(' ');

      // Process each segment via real-time playback
      let elapsed = 0;
      for (const segment of segments) {
        if (this._cancelled) break;
        if (!segment.duration) continue;

        await this._renderSegment(
          segment, ctx, w, h, filterStr, elapsed, totalDuration,
          progressFill, progressText, withAudio
        );
        elapsed += segment.duration;
      }

      // Stop recording
      if (this._recorder.state !== 'inactive') {
        this._recorder.stop();
      }
      await recordingDone;

      if (!this._cancelled && chunks.length > 0) {
        const blob = new Blob(chunks, { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const baseName = this.editor.model.name.replace(/\.[^.]+$/, '');
        a.download = `${baseName}_export.webm`;
        a.href = url;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.editor._showNotification('Video exported successfully');

        // Dispatch event
        document.dispatchEvent(new CustomEvent('dave:videoEditor:export', {
          detail: {
            filename: this.editor.model.name,
            format: this._format,
            duration: elapsed
          }
        }));
      } else if (this._cancelled) {
        this.editor._showNotification('Export cancelled');
      } else {
        this._showError('Export produced no data.');
      }
    } catch (err) {
      console.error('Video export failed:', err);
      this._showError(`Export failed: ${err.message}`);
      this.editor._showNotification('Export failed');
    }

    this._releaseTempUrls();

    // Reset UI
    this._exporting = false;
    exportBtn.style.display = 'flex';
    cancelBtn.style.display = 'none';
    progressBar.style.display = 'none';
    progressText.style.display = 'none';
    progressFill.style.width = '0%';
  }

  _pickMimeType(withAudio) {
    const candidates = withAudio
      ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
      : ['video/webm;codecs=vp9', 'video/webm'];
    return candidates.find(m => MediaRecorder.isTypeSupported(m)) || 'video/webm';
  }

  /**
   * Route element audio through an AudioContext into the canvas stream so the
   * exported file carries sound. Returns false when capture isn't available.
   */
  _attachAudio(stream) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) throw new Error('no AudioContext');
      if (!this._audioCtx) {
        this._audioCtx = new AudioCtx();
        this._audioDest = this._audioCtx.createMediaStreamDestination();
      }
      this._audioCtx.resume?.();
      for (const track of this._audioDest.stream.getAudioTracks()) {
        stream.addTrack(track);
      }
      return stream.getAudioTracks().length > 0;
    } catch (err) {
      console.warn('Video export: audio capture unavailable', err);
      this._showError('Audio capture unavailable - exporting video only (no audio).');
      return false;
    }
  }

  /** Connect a video element to the export audio graph (and to the speakers). */
  _routeAudio(video) {
    if (!this._audioCtx || !this._audioDest) return false;
    try {
      let source = this._audioSources.get(video);
      if (!source) {
        source = this._audioCtx.createMediaElementSource(video);
        source.connect(this._audioDest);
        source.connect(this._audioCtx.destination);
        this._audioSources.set(video, source);
      }
      return true;
    } catch (err) {
      console.warn('Video export: could not route audio for segment', err);
      return false;
    }
  }

  /**
   * Render a single segment via real-time playback.
   * The video plays at normal speed while we draw each frame to the canvas.
   * MediaRecorder captures the canvas in real time -> correct output speed.
   */
  async _renderSegment(segment, ctx, w, h, filterStr, elapsedSoFar, totalDuration, progressFill, progressText, withAudio) {
    let video;
    let startTime, endTime;
    let isTemp = false;
    let crop = null;

    if (segment.type === 'main') {
      video = this.editor.videoEl;
      startTime = this.editor.trimIn;
      endTime = this.editor.trimOut;
      crop = this.editor.cropRect;
    } else {
      video = document.createElement('video');
      video.preload = 'auto';
      video.src = segment.url;

      await new Promise((resolve) => {
        if (video.readyState >= 1) { resolve(); return; }
        video.addEventListener('loadedmetadata', resolve, { once: true });
        video.addEventListener('error', () => resolve(), { once: true });
      });

      startTime = 0;
      endTime = segment.duration;
      isTemp = true;
    }

    const segDuration = Math.max(0.001, endTime - startTime);
    const vidW = video.videoWidth || w;
    const vidH = video.videoHeight || h;

    // Seek to start
    video.currentTime = startTime;
    await this._waitForSeek(video);

    // With audio capture active the element feeds the graph, so it must not be muted.
    const wasMuted = video.muted;
    const routed = withAudio && this._routeAudio(video);
    video.muted = routed ? false : true;

    const playing = new Promise((resolve) => {
      video.addEventListener('playing', resolve, { once: true });
      setTimeout(resolve, 1000);
    });
    await video.play().catch(() => {});
    await playing;

    return new Promise((resolve) => {
      let resolved = false;
      const done = () => {
        if (resolved) return;
        resolved = true;
        video.removeEventListener('timeupdate', timeCheck);
        video.pause();
        video.muted = wasMuted;
        if (isTemp) video.removeAttribute('src');
        resolve();
      };

      const onFrame = () => {
        if (this._cancelled) { done(); return; }
        if (video.ended || video.paused) { done(); return; }

        this._drawFrame(ctx, video, w, h, crop, vidW, vidH, filterStr);

        const segProgress = Math.min(1, (video.currentTime - startTime) / segDuration);
        const overallPct = Math.min(100, Math.round(((elapsedSoFar + segProgress * segDuration) / totalDuration) * 100));
        progressFill.style.width = `${overallPct}%`;
        progressText.textContent = `${overallPct}% - Exporting...`;

        if (video.currentTime >= endTime - 0.03) { done(); return; }

        requestAnimationFrame(onFrame);
      };

      const timeCheck = () => {
        if (video.currentTime >= endTime - 0.03) done();
      };
      video.addEventListener('timeupdate', timeCheck);
      video.addEventListener('ended', () => done(), { once: true });

      requestAnimationFrame(onFrame);
    });
  }

  /** Draw a single video frame to the canvas with optional crop and filters */
  _drawFrame(ctx, video, w, h, crop, vidW, vidH, filterStr) {
    ctx.filter = filterStr;
    if (crop) {
      const sx = crop.x * vidW;
      const sy = crop.y * vidH;
      const sw = crop.w * vidW;
      const sh = crop.h * vidH;
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);
    } else {
      ctx.drawImage(video, 0, 0, w, h);
    }
    ctx.filter = 'none';
  }

  /** Resolve a playable URL from a Dave model object */
  async _resolveModelUrl(model) {
    if (!model) return null;
    // Remote URL (CDN, etc.)
    if (model.remoteUrl) return model.remoteUrl;
    // Local File object (from drag & drop / file input)
    if (model.file) {
      const url = URL.createObjectURL(model.file);
      this._tempUrls.push(url);
      return url;
    }
    // Cloud storage
    if (model.source === 's3' || model.source === 'gdrive') {
      try {
        const { CloudStorage } = await import('../core/cloud_storage.js');
        return await CloudStorage.getFileUrl(model);
      } catch {
        return null;
      }
    }
    // Blob URL already available
    if (model.blobUrl) return model.blobUrl;
    // Fallback: try the name as a relative path
    return model.name;
  }

  _waitForSeek(video) {
    return new Promise((resolve) => {
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked);
        resolve();
      };
      video.addEventListener('seeked', onSeeked);
      // Fallback timeout in case seeked event doesn't fire
      setTimeout(resolve, 300);
    });
  }
}
