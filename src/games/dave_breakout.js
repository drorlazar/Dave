// dave_breakout.js — Dave-themed Breakout Game
// Ball = Dave's eye. Matrix-styled bricks. Dave reacts to hits and losses.
// Smooth keyboard controls via keydown/keyup tracking.

import { DaveMode, EMOTION } from '../core/dave_mode.js';

const BRICK_ROWS = 5;
const BRICK_COLS = 8;
const BRICK_H = 20;
const BRICK_PAD = 4;
const PADDLE_SPEED = 6; // pixels per frame for smooth movement

const HIT_QUIPS = [
  "Ow!", "Hey!", "That tickles!", "Watch it!",
  "Ooof!", "Rude.", "My pixels!", "Again?!",
  "I felt that.", "Zing!", "Boop!", "Yikes!",
];

const WIN_COMMENTS = [
  "You... you actually did it. I'm free!",
  "VICTORY! Every brick... demolished. I'm in awe.",
  "That was beautiful. I'm not crying, you're crying.",
  "Winner winner, pixel dinner!",
];

const LOSE_COMMENTS = [
  "Well that was... an attempt.",
  "Game over. My eye hurts from all that bouncing.",
  "I've been thrown around enough. Thanks for nothing.",
  "The bricks win this round. They always do.",
];

export class DaveBreakout {
  constructor() {
    this._canvas = null;
    this._ctx = null;
    this._state = 'title'; // 'title' | 'playing' | 'paused' | 'dead'
    this._keyHandler = null;
    this._keyUpHandler = null;
    this._mouseHandler = null;
    this._hudEl = null;

    this._ball = { x: 0, y: 0, vx: 0, vy: 0, r: 7 };
    this._paddle = { x: 0, y: 0, w: 70, h: 10 };
    this._bricks = [];
    this._lives = 3;
    this._score = 0;
    this._totalBricks = 0;
    this._hitCount = 0;
    this._lastQuipHit = 0;
    this._raf = null;
    this._trailPoints = [];
    this._titlePulse = 0;
    this._titleRAF = null;

    // Smooth keyboard state
    this._keysDown = new Set();

    // Difficulty: 1 (easy), 2 (medium), 3 (hard)
    this._difficulty = 1;
    this._speeds = [2.8, 4.5, 6.5];
  }

  start(canvas, hudEl) {
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d');
    this._hudEl = hudEl;

    canvas.width = 480;
    canvas.height = 400;

    this._state = 'title';
    this._score = 0;
    this._keysDown.clear();

    // Controls
    this._keyHandler = (e) => this._handleKeyDown(e);
    this._keyUpHandler = (e) => this._handleKeyUp(e);
    this._mouseHandler = (e) => this._handleMouse(e);
    document.addEventListener('keydown', this._keyHandler);
    document.addEventListener('keyup', this._keyUpHandler);
    canvas.addEventListener('mousemove', this._mouseHandler);

    this._drawTitleScreen();
    this._updateHUD();
  }

  destroy() {
    this._state = 'dead';
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this._titleRAF) cancelAnimationFrame(this._titleRAF);
    if (this._keyHandler) document.removeEventListener('keydown', this._keyHandler);
    if (this._keyUpHandler) document.removeEventListener('keyup', this._keyUpHandler);
    if (this._mouseHandler) this._canvas?.removeEventListener('mousemove', this._mouseHandler);
    this._keyHandler = null;
    this._keyUpHandler = null;
    this._mouseHandler = null;
    this._keysDown.clear();

    // Restore Dave's presence
    if (DaveMode._presenceEl) {
      DaveMode._presenceEl.style.opacity = '';
    }
  }

  _initGame() {
    this._initBricks();
    this._resetBall();
    this._paddle.x = this._canvas.width / 2 - this._paddle.w / 2;
    this._paddle.y = this._canvas.height - 30;
    this._lives = 3;
    this._score = 0;
    this._hitCount = 0;
    this._lastQuipHit = 0;
    this._trailPoints = [];
    this._keysDown.clear();
    this._updateHUD();
  }

  _startPlaying() {
    if (this._titleRAF) { cancelAnimationFrame(this._titleRAF); this._titleRAF = null; }
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
    this._initGame();
    this._state = 'playing';

    // Hide Dave's eye presence during game (ball IS the eye)
    if (DaveMode._presenceEl) {
      DaveMode._presenceEl.style.opacity = '0.3';
    }

    DaveMode._setEmotion(EMOTION.CURIOUS);
    DaveMode._showBubble("I AM the ball. This is fine. Totally fine.", { force: true, emotion: EMOTION.CURIOUS });

    this._raf = requestAnimationFrame(() => this._loop());
  }

  _handleKeyDown(e) {
    // Title / Dead: difficulty select + start/restart
    if (this._state === 'title' || this._state === 'dead') {
      const prevDiff = this._difficulty;
      if (e.key === '1') this._difficulty = 1;
      else if (e.key === '2') this._difficulty = 2;
      else if (e.key === '3') this._difficulty = 3;
      else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        this._difficulty = Math.max(1, this._difficulty - 1);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        this._difficulty = Math.min(3, this._difficulty + 1);
      }
      if (this._difficulty !== prevDiff) {
        if (this._state === 'title') this._drawTitleScreen();
        return;
      }
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        this._startPlaying();
        return;
      }
      return;
    }

    // Pause
    if (e.key === ' ' || e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      if (this._state === 'playing') {
        this._state = 'paused';
      } else if (this._state === 'paused') {
        this._state = 'playing';
      }
      return;
    }

    // Track held keys for smooth movement
    if (['ArrowLeft', 'ArrowRight', 'a', 'A', 'd', 'D'].includes(e.key)) {
      e.preventDefault();
      this._keysDown.add(e.key);
    }
  }

  _handleKeyUp(e) {
    this._keysDown.delete(e.key);
  }

  _handleMouse(e) {
    if (this._state !== 'playing') return;
    const rect = this._canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    this._paddle.x = Math.max(0, Math.min(this._canvas.width - this._paddle.w, mx - this._paddle.w / 2));
  }

  _initBricks() {
    this._bricks = [];
    const brickW = (this._canvas?.width || 480) / BRICK_COLS - BRICK_PAD;
    const startY = 40;
    const greens = ['#003300', '#004400', '#006600', '#008800', '#00aa00'];

    for (let r = 0; r < BRICK_ROWS; r++) {
      for (let c = 0; c < BRICK_COLS; c++) {
        this._bricks.push({
          x: c * (brickW + BRICK_PAD) + BRICK_PAD / 2,
          y: startY + r * (BRICK_H + BRICK_PAD),
          w: brickW,
          h: BRICK_H,
          alive: true,
          color: greens[r],
          char: String.fromCharCode(33 + Math.floor(Math.random() * 90)),
        });
      }
    }
    this._totalBricks = this._bricks.length;
  }

  _resetBall() {
    const w = this._canvas?.width || 480;
    const h = this._canvas?.height || 400;
    this._ball.x = w / 2;
    this._ball.y = h - 60;
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.8;
    const speed = this._speeds[this._difficulty - 1];
    this._ball.vx = Math.cos(angle) * speed;
    this._ball.vy = Math.sin(angle) * speed;
    this._trailPoints = [];
  }

  // ---- Title Screen ----

  _drawTitleScreen() {
    if (this._titleRAF) { cancelAnimationFrame(this._titleRAF); this._titleRAF = null; }
    const animate = () => {
      if (this._state !== 'title' && this._state !== 'dead') return;
      this._titlePulse = (this._titlePulse + 0.02) % (Math.PI * 2);
      const ctx = this._ctx;
      const w = this._canvas.width;
      const h = this._canvas.height;

      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, w, h);

      // Draw decorative bricks
      const brickW = 50;
      const brickH = 16;
      const greens = ['#003300', '#004400', '#006600', '#008800', '#00aa00'];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 8; c++) {
          const bx = 15 + c * (brickW + 4);
          const by = 30 + r * (brickH + 4);
          ctx.fillStyle = greens[r];
          ctx.fillRect(bx, by, brickW, brickH);
          ctx.strokeStyle = 'rgba(0, 255, 65, 0.3)';
          ctx.lineWidth = 1;
          ctx.strokeRect(bx, by, brickW, brickH);
        }
      }

      // Ball (Dave's eye) decorative
      const ballY = h / 2 + 20 + Math.sin(this._titlePulse * 2) * 15;
      ctx.save();
      ctx.shadowColor = '#00ff41';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(w / 2, ballY, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#00ff41';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(w / 2, ballY, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#0a0a0a';
      ctx.fill();
      ctx.restore();

      // Paddle decorative
      ctx.save();
      ctx.shadowColor = '#00ff41';
      ctx.shadowBlur = 6;
      ctx.fillStyle = '#004400';
      ctx.fillRect(w / 2 - 35, h - 60, 70, 10);
      ctx.strokeStyle = '#00ff41';
      ctx.lineWidth = 1;
      ctx.strokeRect(w / 2 - 35, h - 60, 70, 10);
      ctx.restore();

      // Title
      ctx.save();
      ctx.shadowColor = '#00ff41';
      ctx.shadowBlur = 20;
      ctx.fillStyle = '#00ff41';
      ctx.font = 'bold 32px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('DAVE BREAKOUT', w / 2, h / 2 - 35);
      ctx.restore();

      // Instructions
      ctx.fillStyle = 'rgba(0, 255, 65, 0.7)';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Mouse or Arrow Keys / A-D to move paddle', w / 2, h / 2 + 5);
      ctx.fillText('SPACE to pause  |  ESC to quit', w / 2, h / 2 + 22);

      // Difficulty selector
      const labels = ['1 EASY', '2 MEDIUM', '3 HARD'];
      const totalW = 260;
      const startX = w / 2 - totalW / 2;
      ctx.font = 'bold 13px monospace';
      for (let i = 0; i < 3; i++) {
        const bx = startX + i * 90;
        const by = h / 2 + 42;
        const selected = this._difficulty === i + 1;
        ctx.fillStyle = selected ? '#00ff41' : '#1a1a1a';
        ctx.fillRect(bx, by, 80, 22);
        ctx.strokeStyle = selected ? '#00ff41' : 'rgba(0, 255, 65, 0.3)';
        ctx.lineWidth = selected ? 2 : 1;
        ctx.strokeRect(bx, by, 80, 22);
        ctx.fillStyle = selected ? '#0a0a0a' : 'rgba(0, 255, 65, 0.5)';
        ctx.fillText(labels[i], bx + 40, by + 13);
      }

      // Pulsing start prompt
      const alpha = 0.5 + 0.5 * Math.sin(this._titlePulse * 3);
      ctx.fillStyle = `rgba(0, 255, 65, ${alpha})`;
      ctx.font = 'bold 16px monospace';
      ctx.fillText('Press SPACE or ENTER to start', w / 2, h / 2 + 85);

      this._titleRAF = requestAnimationFrame(animate);
    };
    animate();
  }

  // ---- Game Loop ----

  _loop() {
    if (this._state === 'dead') return;

    if (this._state === 'playing') {
      this._processKeyboard();
      this._update();
    }

    this._draw();
    this._raf = requestAnimationFrame(() => this._loop());
  }

  _processKeyboard() {
    // Smooth paddle movement from held keys
    const left = this._keysDown.has('ArrowLeft') || this._keysDown.has('a') || this._keysDown.has('A');
    const right = this._keysDown.has('ArrowRight') || this._keysDown.has('d') || this._keysDown.has('D');
    if (left) {
      this._paddle.x = Math.max(0, this._paddle.x - PADDLE_SPEED);
    }
    if (right) {
      this._paddle.x = Math.min(this._canvas.width - this._paddle.w, this._paddle.x + PADDLE_SPEED);
    }
  }

  _update() {
    const b = this._ball;
    const p = this._paddle;
    const w = this._canvas.width;
    const h = this._canvas.height;

    // Trail
    this._trailPoints.push({ x: b.x, y: b.y, t: performance.now() });
    if (this._trailPoints.length > 12) this._trailPoints.shift();

    b.x += b.vx;
    b.y += b.vy;

    // Wall bounce
    if (b.x - b.r <= 0) { b.x = b.r; b.vx = Math.abs(b.vx); }
    if (b.x + b.r >= w) { b.x = w - b.r; b.vx = -Math.abs(b.vx); }
    if (b.y - b.r <= 0) { b.y = b.r; b.vy = Math.abs(b.vy); }

    // Bottom — lose life
    if (b.y + b.r >= h) {
      this._lives--;
      this._updateHUD();

      if (this._lives <= 0) {
        this._gameOver(false);
        return;
      }

      DaveMode._setEmotion(EMOTION.SAD);
      DaveMode._showBubble("Ow... that's a life gone.", { force: true, emotion: EMOTION.SAD });
      this._resetBall();
      return;
    }

    // Paddle bounce — normalize to keep speed consistent
    if (b.y + b.r >= p.y && b.y - b.r <= p.y + p.h &&
        b.x >= p.x && b.x <= p.x + p.w) {
      const hitPos = (b.x - p.x) / p.w;
      b.vx = (hitPos - 0.5) * 6;
      b.vy = -Math.abs(b.vy);
      // Normalize velocity to selected difficulty speed
      const mag = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      const targetSpeed = this._speeds[this._difficulty - 1];
      b.vx = (b.vx / mag) * targetSpeed;
      b.vy = (b.vy / mag) * targetSpeed;
      b.y = p.y - b.r;
    }

    // Brick collision
    for (const brick of this._bricks) {
      if (!brick.alive) continue;
      if (b.x + b.r > brick.x && b.x - b.r < brick.x + brick.w &&
          b.y + b.r > brick.y && b.y - b.r < brick.y + brick.h) {
        brick.alive = false;
        b.vy = -b.vy;
        this._score += 10;
        this._hitCount++;
        this._updateHUD();

        if (this._hitCount - this._lastQuipHit >= 4) {
          this._lastQuipHit = this._hitCount;
          const quip = HIT_QUIPS[Math.floor(Math.random() * HIT_QUIPS.length)];
          DaveMode._showBubble(quip, { force: true, emotion: EMOTION.ANNOYED });
        }

        if (this._bricks.every(br => !br.alive)) {
          this._gameOver(true);
          return;
        }
        break;
      }
    }
  }

  _draw() {
    const ctx = this._ctx;
    const w = this._canvas.width;
    const h = this._canvas.height;

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, w, h);

    // Bricks
    ctx.font = `${BRICK_H - 6}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const brick of this._bricks) {
      if (!brick.alive) continue;
      ctx.fillStyle = brick.color;
      ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
      ctx.fillStyle = 'rgba(0, 255, 65, 0.15)';
      ctx.fillText(brick.char, brick.x + brick.w / 2, brick.y + brick.h / 2);
      ctx.strokeStyle = 'rgba(0, 255, 65, 0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(brick.x, brick.y, brick.w, brick.h);
    }

    // Motion trail
    const now = performance.now();
    for (let i = 0; i < this._trailPoints.length - 1; i++) {
      const tp = this._trailPoints[i];
      const age = now - tp.t;
      if (age > 200) continue;
      const alpha = (1 - age / 200) * 0.3;
      ctx.beginPath();
      ctx.arc(tp.x, tp.y, this._ball.r * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 255, 65, ${alpha})`;
      ctx.fill();
    }

    // Ball (Dave's eye)
    const b = this._ball;
    ctx.save();
    ctx.shadowColor = '#00ff41';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = '#00ff41';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = '#0a0a0a';
    ctx.fill();
    ctx.restore();

    // Paddle
    const p = this._paddle;
    ctx.save();
    ctx.shadowColor = '#00ff41';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#004400';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.strokeStyle = '#00ff41';
    ctx.lineWidth = 1;
    ctx.strokeRect(p.x, p.y, p.w, p.h);
    ctx.restore();

    // Lives
    for (let i = 0; i < this._lives; i++) {
      const lx = 15 + i * 22;
      const ly = h - 12;
      ctx.save();
      ctx.shadowColor = '#00ff41';
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(lx, ly, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#00ff41';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(lx, ly, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#0a0a0a';
      ctx.fill();
      ctx.restore();
    }

    // Pause overlay
    if (this._state === 'paused') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#00ff41';
      ctx.font = 'bold 24px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PAUSED', w / 2, h / 2);
      ctx.font = '14px monospace';
      ctx.fillText('Press SPACE to resume', w / 2, h / 2 + 30);
    }
  }

  _gameOver(won) {
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }

    // Restore Dave presence
    if (DaveMode._presenceEl) {
      DaveMode._presenceEl.style.opacity = '';
    }

    if (won) {
      DaveMode._setEmotion(EMOTION.PROUD);
      DaveMode._triggerFireworks();
      const msg = WIN_COMMENTS[Math.floor(Math.random() * WIN_COMMENTS.length)];
      DaveMode._showBubble(msg, { force: true, emotion: EMOTION.PROUD });
    } else {
      DaveMode._setEmotion(EMOTION.SAD);
      const msg = LOSE_COMMENTS[Math.floor(Math.random() * LOSE_COMMENTS.length)];
      DaveMode._showBubble(msg, { force: true, emotion: EMOTION.SAD });
    }

    // Brief result flash
    const ctx = this._ctx;
    const w = this._canvas.width;
    const h = this._canvas.height;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (won) {
      ctx.fillStyle = '#00ff41';
      ctx.font = 'bold 32px monospace';
      ctx.fillText('YOU WIN!', w / 2, h / 2 - 15);
    } else {
      ctx.fillStyle = '#ff0040';
      ctx.font = 'bold 32px monospace';
      ctx.fillText('GAME OVER', w / 2, h / 2 - 15);
    }
    ctx.fillStyle = '#00ff41';
    ctx.font = '18px monospace';
    ctx.fillText(`Score: ${this._score}`, w / 2, h / 2 + 20);

    // Go straight to title screen so player can adjust difficulty and replay
    this._state = 'title';
    this._drawTitleScreen();
  }

  _updateHUD() {
    if (this._hudEl) {
      this._hudEl.textContent = `SCORE: ${String(this._score).padStart(4, '0')}  |  LIVES: ${this._lives}`;
    }
  }
}
