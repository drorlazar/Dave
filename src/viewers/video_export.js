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
          <label>Format</label>
          <div class="ve-export-formats">
            <button class="ve-export-fmt ve-active" data-format="webm">WebM</button>
          </div>
        </div>
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
    // Format buttons
    this.panel.querySelectorAll('.ve-export-fmt').forEach(btn => {
      btn.addEventListener('click', () => {
        this.panel.querySelectorAll('.ve-export-fmt').forEach(b => b.classList.remove('ve-active'));
        btn.classList.add('ve-active');
        this._format = btn.dataset.format;
      });
    });

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

    const exportBtn = this.panel.querySelector('.ve-export-download');
    const cancelBtn = this.panel.querySelector('.ve-export-cancel');
    const progressBar = this.panel.querySelector('.ve-export-progress');
    const progressFill = this.panel.querySelector('.ve-export-progress-bar');
    const progressText = this.panel.querySelector('.ve-export-progress-text');

    exportBtn.style.display = 'none';
    cancelBtn.style.display = 'flex';
    progressBar.style.display = '';
    progressText.style.display = '';

    const { w, h } = this._getTargetDimensions();
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    const fps = 30;

    // Build concat segments
    const segments = [];
    if (this.editor.concatBefore) {
      segments.push({ model: this.editor.concatBefore, type: 'before' });
    }
    segments.push({ type: 'main' });
    if (this.editor.concatAfter) {
      segments.push({ model: this.editor.concatAfter, type: 'after' });
    }

    // Pre-resolve concat durations for progress calculation
    const mainDuration = this.editor.trimOut - this.editor.trimIn;
    let totalDuration = mainDuration;

    try {
      // Set up MediaRecorder on the canvas stream
      const stream = canvas.captureStream(fps);

      const mimeType = 'video/webm;codecs=vp9';
      const fallbackMime = 'video/webm';
      const mime = MediaRecorder.isTypeSupported(mimeType) ? mimeType : fallbackMime;
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

        const segDuration = await this._renderSegment(
          segment, ctx, w, h, filterStr, elapsed, totalDuration,
          progressFill, progressText
        );
        elapsed += segDuration;
        // Update total for progress if we discover concat durations
        if (segment.type !== 'main' && segDuration > 0) {
          totalDuration += segDuration;
        }
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
      }
    } catch (err) {
      console.error('Video export failed:', err);
      this.editor._showNotification('Export failed: ' + err.message);
    }

    // Reset UI
    this._exporting = false;
    exportBtn.style.display = 'flex';
    cancelBtn.style.display = 'none';
    progressBar.style.display = 'none';
    progressText.style.display = 'none';
    progressFill.style.width = '0%';
  }

  /**
   * Render a single segment via real-time playback.
   * The video plays at normal speed while we draw each frame to the canvas.
   * MediaRecorder captures the canvas in real time → correct output speed.
   * Returns the segment duration.
   */
  async _renderSegment(segment, ctx, w, h, filterStr, elapsedSoFar, totalDuration, progressFill, progressText) {
    let video;
    let startTime, endTime;
    let isTemp = false;
    let applyFilters = true;
    let crop = null;

    if (segment.type === 'main') {
      video = this.editor.videoEl;
      startTime = this.editor.trimIn;
      endTime = this.editor.trimOut;
      crop = this.editor.cropRect;
    } else {
      // Create temporary video element for concat clip
      video = document.createElement('video');
      video.preload = 'auto';
      video.muted = true;

      const url = await this._resolveModelUrl(segment.model);
      if (!url) {
        console.warn('Could not resolve URL for concat model:', segment.model.name);
        return 0;
      }
      video.src = url;

      await new Promise((resolve) => {
        video.addEventListener('loadedmetadata', resolve, { once: true });
        video.addEventListener('error', () => resolve(), { once: true });
      });

      if (!video.duration || !isFinite(video.duration)) {
        console.warn('Could not load concat video:', segment.model.name);
        return 0;
      }

      startTime = 0;
      endTime = video.duration;
      isTemp = true;
      // Concat clips: apply filters but no crop (crop is specific to main video)
      crop = null;
    }

    const segDuration = endTime - startTime;
    const vidW = video.videoWidth || w;
    const vidH = video.videoHeight || h;

    // Seek to start
    video.currentTime = startTime;
    await this._waitForSeek(video);

    // Mute the main video during export to prevent audio playback through speakers
    const wasMuted = video.muted;
    video.muted = true;

    // Play at normal speed
    await video.play().catch(() => {});

    return new Promise((resolve) => {
      let resolved = false;
      const done = () => {
        if (resolved) return;
        resolved = true;
        video.pause();
        video.muted = wasMuted;
        if (isTemp) {
          video.src = '';
        }
        resolve(segDuration);
      };

      const onFrame = () => {
        if (this._cancelled) { done(); return; }
        if (video.ended || video.paused) { done(); return; }
        if (video.currentTime >= endTime - 0.03) {
          // Draw final frame and finish
          this._drawFrame(ctx, video, w, h, crop, vidW, vidH, applyFilters ? filterStr : 'none');
          done();
          return;
        }

        // Draw current frame to canvas
        this._drawFrame(ctx, video, w, h, crop, vidW, vidH, applyFilters ? filterStr : 'none');

        // Update progress
        const segProgress = Math.min(1, (video.currentTime - startTime) / segDuration);
        const overallPct = Math.round(((elapsedSoFar + segProgress * segDuration) / totalDuration) * 100);
        progressFill.style.width = `${Math.min(overallPct, 100)}%`;
        progressText.textContent = `${Math.min(overallPct, 100)}% - Exporting...`;

        requestAnimationFrame(onFrame);
      };

      // Stop when reaching endTime
      const timeCheck = () => {
        if (video.currentTime >= endTime - 0.03) {
          video.removeEventListener('timeupdate', timeCheck);
          done();
        }
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
    if (model.file) return URL.createObjectURL(model.file);
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
