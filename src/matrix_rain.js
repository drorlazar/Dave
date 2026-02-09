// Matrix Digital Rain - Dense multi-layer rain with depth structures
// One character per column per frame + semi-transparent fade = natural trails
// Overlapping sine waves create drifting bright/dark regions = "code architecture"
// Per-layer staggered fade creates cascading appear/disappear effect

const CHARS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ{}()[];:<>=+-*/%!@#$^&|~DAVE';
const CHAR_ARRAY = CHARS.split('');

// Eight depth layers: far background -> close foreground
// Speed ~1.0 = one character height per frame = tight connected trails
const LAYERS = [
  { size: 6,  spacing: 4,  speed: 0.4,  opacity: 0.12, color: { r: 0, g: 55, b: 0 },    density: 0.998 },
  { size: 7,  spacing: 5,  speed: 0.5,  opacity: 0.18, color: { r: 0, g: 75, b: 0 },    density: 0.997 },
  { size: 9,  spacing: 6,  speed: 0.6,  opacity: 0.25, color: { r: 0, g: 100, b: 0 },   density: 0.995 },
  { size: 11, spacing: 8,  speed: 0.7,  opacity: 0.35, color: { r: 0, g: 130, b: 0 },   density: 0.992 },
  { size: 14, spacing: 10, speed: 0.85, opacity: 0.45, color: { r: 0, g: 160, b: 0 },   density: 0.988 },
  { size: 17, spacing: 12, speed: 1.0,  opacity: 0.6,  color: { r: 20, g: 200, b: 20 }, density: 0.978 },
  { size: 21, spacing: 15, speed: 1.1,  opacity: 0.78, color: { r: 50, g: 235, b: 50 }, density: 0.965, glow: true },
  { size: 26, spacing: 18, speed: 1.3,  opacity: 0.95, color: { r: 100, g: 255, b: 100 },density: 0.950, glow: true }
];

const N_LAYERS = LAYERS.length;

export class MatrixRain {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.animId = null;
    this.drops = [];
    this.colSpeeds = [];
    this.colFadeOffsets = []; // per-column stagger for fade
    this.fadeAlpha = 1;       // overall fade progress: 0=invisible, 1=fully visible
    this.fadingIn = false;
    this.fadingOut = false;
    this.fadeSpeed = 0.03;
    this.onFadeComplete = null;
    this.lastTime = 0;
    this.elapsed = 0;
    this.frameInterval = 33;
  }

  start(zIndex = 9999) {
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      z-index: ${zIndex}; pointer-events: none;
    `;
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    this._resize();
    this._initDrops();

    window.addEventListener('resize', this._resizeBound = () => {
      this._resize();
      this._initDrops();
    });

    this.fadeAlpha = 1;
    this.fadingIn = false;
    this.fadingOut = false;
    this.lastTime = 0;
    this.elapsed = 0;
    this.animId = requestAnimationFrame((t) => this._loop(t));
  }

  // Fade in from invisible: fadeAlpha ramps 0 -> 1
  fadeIn(duration = 1500) {
    this.fadeAlpha = 0;
    this.fadingIn = true;
    this.fadingOut = false;
    this.fadeSpeed = 1 / (duration / this.frameInterval);
  }

  // Fade out to invisible: fadeAlpha ramps 1 -> 0, then stops + cleans up
  fadeOut(duration = 800, callback) {
    this.fadingOut = true;
    this.fadingIn = false;
    this.fadeSpeed = 1 / (duration / this.frameInterval);
    this.onFadeComplete = callback || null;
  }

  stop() {
    if (this.animId) cancelAnimationFrame(this.animId);
    this.animId = null;
    window.removeEventListener('resize', this._resizeBound);
    if (this.canvas) { this.canvas.remove(); this.canvas = null; }
    this.ctx = null;
    this.drops = [];
    this.colSpeeds = [];
    this.colFadeOffsets = [];
  }

  _resize() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  _initDrops() {
    const w = this.canvas?.width || window.innerWidth;
    const h = this.canvas?.height || window.innerHeight;

    this.drops = LAYERS.map(layer => {
      const gap = layer.spacing || layer.size;
      const cols = Math.floor(w / gap) + 1;
      const maxRow = Math.ceil(h / layer.size);
      const arr = new Array(cols);
      for (let i = 0; i < cols; i++) {
        // Spread drops across entire screen height + some above
        arr[i] = Math.random() * (maxRow + 30) - 15;
      }
      return arr;
    });

    // Per-column speed jitter (tight range)
    this.colSpeeds = LAYERS.map(layer => {
      const gap = layer.spacing || layer.size;
      const cols = Math.floor(w / gap) + 1;
      const arr = new Float32Array(cols);
      for (let i = 0; i < cols; i++) {
        arr[i] = 0.88 + Math.random() * 0.24;
      }
      return arr;
    });

    // Per-column fade offset: small random value (0 to 0.12) for stagger
    this.colFadeOffsets = LAYERS.map(layer => {
      const gap = layer.spacing || layer.size;
      const cols = Math.floor(w / gap) + 1;
      const arr = new Float32Array(cols);
      for (let i = 0; i < cols; i++) {
        arr[i] = Math.random() * 0.12;
      }
      return arr;
    });
  }

  // Per-layer + per-column staggered fade alpha
  // Returns 0-1 alpha for this specific column in this layer
  _columnFade(li, ci) {
    const a = this.fadeAlpha;
    const colOff = this.colFadeOffsets[li]?.[ci] || 0;

    if (this.fadingIn) {
      // Far layers (low index) appear first, near layers delayed
      const layerOff = (li / (N_LAYERS - 1)) * 0.35;
      const totalOff = layerOff + colOff;
      if (a <= totalOff) return 0;
      return Math.min(1, (a - totalOff) / (1 - totalOff));
    }

    if (this.fadingOut) {
      // Near layers (high index) disappear first, far layers linger
      const layerOff = ((N_LAYERS - 1 - li) / (N_LAYERS - 1)) * 0.35;
      const totalOff = layerOff + colOff;
      if (a <= totalOff) return 0;
      return Math.min(1, (a - totalOff) / (1 - totalOff));
    }

    return a;
  }

  // Brightness modulation: drifting structures behind the rain
  _structureMod(x, y, t) {
    const band1 = Math.sin(x * 0.006 + t * 0.0004) * 0.25;
    const band2 = Math.sin(x * 0.014 - t * 0.0006) * 0.15;
    const pipe = Math.sin(x * 0.035 + t * 0.0003) ** 2 * 0.2;
    const hWave = Math.sin(y * 0.004 + t * 0.0005) * 0.1;
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
    const pulse = Math.sin(dist * 0.008 - t * 0.0015) * 0.15;
    return Math.max(0.3, Math.min(1.8, 1 + band1 + band2 + pipe + hWave + pulse));
  }

  _loop(currentTime) {
    if (!this.ctx) return;

    if (currentTime - this.lastTime < this.frameInterval) {
      this.animId = requestAnimationFrame((t) => this._loop(t));
      return;
    }
    this.lastTime = currentTime;
    this.elapsed += this.frameInterval;

    // Update fade
    if (this.fadingIn) {
      this.fadeAlpha += this.fadeSpeed;
      if (this.fadeAlpha >= 1) {
        this.fadeAlpha = 1;
        this.fadingIn = false;
      }
    } else if (this.fadingOut) {
      this.fadeAlpha -= this.fadeSpeed;
      if (this.fadeAlpha <= 0) {
        this.stop();
        if (this.onFadeComplete) this.onFadeComplete();
        return;
      }
    }

    this._draw();
    this.animId = requestAnimationFrame((t) => this._loop(t));
  }

  _draw() {
    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;
    const t = this.elapsed;

    // Semi-transparent black fade: lower = longer trails
    ctx.fillStyle = 'rgba(0, 0, 0, 0.04)';
    ctx.fillRect(0, 0, w, h);

    for (let li = 0; li < N_LAYERS; li++) {
      const layer = LAYERS[li];
      const layerDrops = this.drops[li];
      const speeds = this.colSpeeds[li];
      if (!layerDrops) continue;

      const cols = layerDrops.length;
      const gap = layer.spacing || layer.size;
      ctx.font = `${layer.size}px monospace`;

      const useGlow = layer.glow;
      if (useGlow) {
        ctx.shadowColor = `rgba(${layer.color.r}, ${layer.color.g}, ${layer.color.b}, 0.6)`;
        ctx.shadowBlur = layer.size > 24 ? 14 : 8;
      }

      for (let i = 0; i < cols; i++) {
        const x = i * gap;
        const y = layerDrops[i] * layer.size;

        // Per-column staggered fade
        const colFade = this._columnFade(li, i);
        if (colFade < 0.01) {
          layerDrops[i] += layer.speed * (speeds[i] || 1);
          if (layerDrops[i] * layer.size > h && Math.random() > layer.density) {
            layerDrops[i] = -Math.random() * 25;
          }
          continue;
        }

        const sMod = this._structureMod(x, y, t);
        const alpha = Math.min(1, layer.opacity * sMod * colFade);
        if (alpha < 0.02) {
          layerDrops[i] += layer.speed * (speeds[i] || 1);
          continue;
        }

        const char = CHAR_ARRAY[Math.floor(Math.random() * CHAR_ARRAY.length)];

        // Bright head on near layers
        const isHead = layerDrops[i] > 0 && y < h && y > 0;
        if (isHead && li >= N_LAYERS - 3 && Math.random() < 0.3) {
          const headAlpha = Math.min(1, alpha * 1.5);
          ctx.fillStyle = `rgba(${180 + layer.color.r}, 255, ${180 + layer.color.b}, ${headAlpha})`;
        } else {
          ctx.fillStyle = `rgba(${layer.color.r}, ${layer.color.g}, ${layer.color.b}, ${alpha})`;
        }

        ctx.fillText(char, x, y);

        layerDrops[i] += layer.speed * (speeds[i] || 1);

        if (layerDrops[i] * layer.size > h && Math.random() > layer.density) {
          layerDrops[i] = -Math.random() * 25;
          if (speeds[i] !== undefined) speeds[i] = 0.88 + Math.random() * 0.24;
        }
      }

      if (useGlow) {
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
      }
    }
  }
}
