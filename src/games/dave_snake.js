// dave_snake.js — Matrix-themed Snake Game for Dave
// Green on black, Matrix chars as snake segments, Dave comments on gameplay.

import { DaveMode, EMOTION } from '../core/dave_mode.js';

const MATRIX_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&*!?';

const COMMENTS_FOOD = [
  "Not bad.",
  "Getting there...",
  "Nom nom nom.",
  "Tasty pixel.",
  "My circuits approve.",
  "Keep going...",
  "That's the stuff.",
  "Feed the serpent.",
  "Delicious data.",
  "Bytes consumed.",
];

const COMMENTS_GAMEOVER = {
  low: [
    "...That's it? I've seen screensavers do better.",
    "My grandmother's BIOS could outplay you.",
    "Did you... try?",
    "We don't talk about this score.",
  ],
  medium: [
    "Respectable. Not legendary, but respectable.",
    "Okay I'll admit, you're not terrible.",
    "Decent run. I've seen worse. I've BEEN worse.",
    "Almost impressive. Almost.",
  ],
  high: [
    "NOW we're talking! THAT was beautiful!",
    "I... I'm actually impressed. Don't let it go to your head.",
    "You absolute LEGEND. I'm filing this under 'memories'.",
    "Okay you broke me. That was genuinely good.",
  ],
};

export class DaveSnake {
  constructor() {
    this._canvas = null;
    this._ctx = null;
    this._state = 'title'; // 'title' | 'playing' | 'paused' | 'dead'
    this._gridSize = 20;
    this._cols = 0;
    this._rows = 0;
    this._snake = [];
    this._snakeChars = [];
    this._dir = { x: 1, y: 0 };
    this._nextDir = { x: 1, y: 0 };
    this._food = null;
    this._score = 0;
    this._speed = 150;
    this._tick = null;
    this._foodCount = 0;
    this._lastCommentFood = 0;
    this._keyHandler = null;
    this._hudEl = null;
    this._titlePulse = 0;
    this._titleRAF = null;
  }

  start(canvas, hudEl) {
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d');
    this._hudEl = hudEl;

    canvas.width = 400;
    canvas.height = 400;
    this._cols = Math.floor(canvas.width / this._gridSize);
    this._rows = Math.floor(canvas.height / this._gridSize);

    this._state = 'title';
    this._score = 0;

    // Controls
    this._keyHandler = (e) => this._handleKey(e);
    document.addEventListener('keydown', this._keyHandler);

    // Show title screen
    this._drawTitleScreen();
    this._updateHUD();
  }

  destroy() {
    this._state = 'dead';
    clearInterval(this._tick);
    if (this._titleRAF) cancelAnimationFrame(this._titleRAF);
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler);
      this._keyHandler = null;
    }
  }

  _initGame() {
    const cx = Math.floor(this._cols / 2);
    const cy = Math.floor(this._rows / 2);
    this._snake = [
      { x: cx, y: cy },
      { x: cx - 1, y: cy },
      { x: cx - 2, y: cy },
    ];
    this._snakeChars = this._snake.map(() => this._randomChar());
    this._dir = { x: 1, y: 0 };
    this._nextDir = { x: 1, y: 0 };
    this._score = 0;
    this._speed = 150;
    this._foodCount = 0;
    this._lastCommentFood = 0;

    this._spawnFood();
    this._updateHUD();
  }

  _startPlaying() {
    if (this._titleRAF) { cancelAnimationFrame(this._titleRAF); this._titleRAF = null; }
    clearInterval(this._tick);
    this._initGame();
    this._state = 'playing';
    this._draw();

    DaveMode._setEmotion(EMOTION.CURIOUS);
    DaveMode._showBubble("Let's see what you've got...", { force: true, emotion: EMOTION.CURIOUS });

    this._tick = setInterval(() => this._update(), this._speed);
  }

  _handleKey(e) {
    // Title / Dead screens: any action key starts/restarts
    if (this._state === 'title' || this._state === 'dead') {
      if (e.key === ' ' || e.key === 'Enter' ||
          ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','W','A','S','D'].includes(e.key)) {
        e.preventDefault();
        this._startPlaying();
        return;
      }
      return;
    }

    // Pause toggle
    if (e.key === ' ' || e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      if (this._state === 'playing') {
        this._state = 'paused';
        clearInterval(this._tick);
        this._drawPauseOverlay();
      } else if (this._state === 'paused') {
        this._state = 'playing';
        this._tick = setInterval(() => this._update(), this._speed);
      }
      return;
    }

    if (this._state !== 'playing') return;

    const keyMap = {
      'ArrowUp': { x: 0, y: -1 }, 'w': { x: 0, y: -1 }, 'W': { x: 0, y: -1 },
      'ArrowDown': { x: 0, y: 1 }, 's': { x: 0, y: 1 }, 'S': { x: 0, y: 1 },
      'ArrowLeft': { x: -1, y: 0 }, 'a': { x: -1, y: 0 }, 'A': { x: -1, y: 0 },
      'ArrowRight': { x: 1, y: 0 }, 'd': { x: 1, y: 0 }, 'D': { x: 1, y: 0 },
    };

    const newDir = keyMap[e.key];
    if (newDir) {
      e.preventDefault();
      if (newDir.x !== -this._dir.x || newDir.y !== -this._dir.y) {
        this._nextDir = newDir;
      }
    }
  }

  // ---- Title Screen ----

  _drawTitleScreen() {
    const animate = () => {
      if (this._state !== 'title') return;
      this._titlePulse = (this._titlePulse + 0.02) % (Math.PI * 2);
      const ctx = this._ctx;
      const w = this._canvas.width;
      const h = this._canvas.height;

      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, w, h);

      // Decorative grid
      ctx.strokeStyle = 'rgba(0, 255, 65, 0.04)';
      ctx.lineWidth = 0.5;
      for (let x = 0; x <= w; x += this._gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y <= h; y += this._gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

      // Border
      ctx.strokeStyle = '#00ff41';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, w - 2, h - 2);

      // Decorative snake
      const fakeSnake = [
        { x: 6, y: 10 }, { x: 7, y: 10 }, { x: 8, y: 10 }, { x: 9, y: 10 },
        { x: 9, y: 11 }, { x: 9, y: 12 }, { x: 10, y: 12 }, { x: 11, y: 12 },
      ];
      ctx.font = `bold ${this._gridSize - 2}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < fakeSnake.length; i++) {
        const s = fakeSnake[i];
        const alpha = 0.3 + 0.4 * (i / fakeSnake.length);
        ctx.fillStyle = `rgba(0, 255, 65, ${alpha})`;
        ctx.fillText(this._randomChar(), s.x * this._gridSize + this._gridSize / 2, s.y * this._gridSize + this._gridSize / 2);
      }

      // Title
      ctx.save();
      ctx.shadowColor = '#00ff41';
      ctx.shadowBlur = 20;
      ctx.fillStyle = '#00ff41';
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('DAVE SNAKE', w / 2, h / 2 - 50);
      ctx.restore();

      // Instructions
      ctx.fillStyle = 'rgba(0, 255, 65, 0.7)';
      ctx.font = '13px monospace';
      ctx.fillText('Arrow Keys / WASD to move', w / 2, h / 2 + 5);
      ctx.fillText('SPACE to pause', w / 2, h / 2 + 25);
      ctx.fillText('ESC to quit', w / 2, h / 2 + 45);

      // Pulsing start prompt
      const alpha = 0.5 + 0.5 * Math.sin(this._titlePulse * 3);
      ctx.fillStyle = `rgba(0, 255, 65, ${alpha})`;
      ctx.font = 'bold 16px monospace';
      ctx.fillText('Press any key to start', w / 2, h / 2 + 85);

      this._titleRAF = requestAnimationFrame(animate);
    };
    animate();
  }

  // ---- Game Loop ----

  _update() {
    if (this._state !== 'playing') return;

    this._dir = this._nextDir;
    const head = this._snake[0];
    const newHead = { x: head.x + this._dir.x, y: head.y + this._dir.y };

    // Wall collision
    if (newHead.x < 0 || newHead.x >= this._cols || newHead.y < 0 || newHead.y >= this._rows) {
      this._gameOver();
      return;
    }

    // Self collision
    for (const seg of this._snake) {
      if (seg.x === newHead.x && seg.y === newHead.y) {
        this._gameOver();
        return;
      }
    }

    this._snake.unshift(newHead);
    this._snakeChars.unshift(this._randomChar());

    // Food collision
    if (newHead.x === this._food.x && newHead.y === this._food.y) {
      this._score += 10;
      this._foodCount++;
      this._updateHUD();
      this._spawnFood();

      if (this._foodCount % 5 === 0 && this._speed > 60) {
        this._speed -= 15;
        clearInterval(this._tick);
        this._tick = setInterval(() => this._update(), this._speed);
      }

      if (this._foodCount - this._lastCommentFood >= 3) {
        this._lastCommentFood = this._foodCount;
        const msg = COMMENTS_FOOD[Math.floor(Math.random() * COMMENTS_FOOD.length)];
        DaveMode._showBubble(msg, { force: true, emotion: EMOTION.AMUSED });
      }

      this._eyeFollowSnake(newHead);
    } else {
      this._snake.pop();
      this._snakeChars.pop();
    }

    for (let i = 0; i < this._snakeChars.length; i++) {
      if (Math.random() < 0.1) this._snakeChars[i] = this._randomChar();
    }

    this._eyeFollowSnake(newHead);
    this._draw();
  }

  _draw() {
    const ctx = this._ctx;
    const g = this._gridSize;
    const w = this._canvas.width;
    const h = this._canvas.height;

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(0, 255, 65, 0.04)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= w; x += g) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y <= h; y += g) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    ctx.strokeStyle = '#00ff41';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, w - 2, h - 2);

    // Food
    if (this._food) {
      const fx = this._food.x * g + g / 2;
      const fy = this._food.y * g + g / 2;
      const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 200);
      ctx.save();
      ctx.shadowColor = '#00ff41';
      ctx.shadowBlur = 12 * pulse;
      ctx.beginPath();
      ctx.arc(fx, fy, g / 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 255, 65, ${0.7 + 0.3 * pulse})`;
      ctx.fill();
      ctx.restore();
    }

    // Snake
    ctx.font = `bold ${g - 2}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = this._snake.length - 1; i >= 0; i--) {
      const seg = this._snake[i];
      const sx = seg.x * g;
      const sy = seg.y * g;
      const isHead = i === 0;
      const alpha = isHead ? 1 : 0.5 + 0.5 * (1 - i / this._snake.length);

      ctx.fillStyle = isHead
        ? 'rgba(0, 255, 65, 0.3)'
        : `rgba(0, 255, 65, ${0.1 * alpha})`;
      ctx.fillRect(sx + 1, sy + 1, g - 2, g - 2);

      ctx.fillStyle = isHead
        ? '#00ff41'
        : `rgba(0, 255, 65, ${alpha * 0.9})`;
      ctx.fillText(this._snakeChars[i], sx + g / 2, sy + g / 2);
    }
  }

  _drawPauseOverlay() {
    const ctx = this._ctx;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, this._canvas.width, this._canvas.height);
    ctx.fillStyle = '#00ff41';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PAUSED', this._canvas.width / 2, this._canvas.height / 2);
    ctx.font = '14px monospace';
    ctx.fillText('Press SPACE to resume', this._canvas.width / 2, this._canvas.height / 2 + 30);
  }

  _gameOver() {
    this._state = 'dead';
    clearInterval(this._tick);

    const ctx = this._ctx;
    const w = this._canvas.width;
    const h = this._canvas.height;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ff0040';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GAME OVER', w / 2, h / 2 - 30);
    ctx.fillStyle = '#00ff41';
    ctx.font = '18px monospace';
    ctx.fillText(`Score: ${this._score}`, w / 2, h / 2 + 5);
    ctx.font = '13px monospace';
    ctx.fillStyle = 'rgba(0, 255, 65, 0.7)';
    ctx.fillText('Press any key to restart', w / 2, h / 2 + 40);
    ctx.font = '11px monospace';
    ctx.fillStyle = 'rgba(0, 255, 65, 0.4)';
    ctx.fillText('ESC to quit', w / 2, h / 2 + 60);

    // Dave reaction
    let pool, emotion;
    if (this._score < 50) {
      pool = COMMENTS_GAMEOVER.low;
      emotion = EMOTION.SASSY;
    } else if (this._score < 150) {
      pool = COMMENTS_GAMEOVER.medium;
      emotion = EMOTION.AMUSED;
    } else {
      pool = COMMENTS_GAMEOVER.high;
      emotion = EMOTION.PROUD;
      DaveMode._triggerFireworks();
    }
    DaveMode._setEmotion(emotion);
    DaveMode._showBubble(pool[Math.floor(Math.random() * pool.length)], { force: true, emotion });
  }

  _spawnFood() {
    let pos;
    do {
      pos = {
        x: Math.floor(Math.random() * this._cols),
        y: Math.floor(Math.random() * this._rows),
      };
    } while (this._snake.some(s => s.x === pos.x && s.y === pos.y));
    this._food = pos;
  }

  _updateHUD() {
    if (this._hudEl) {
      this._hudEl.textContent = `SCORE: ${String(this._score).padStart(4, '0')}`;
    }
  }

  _eyeFollowSnake(head) {
    if (!DaveMode._irisEl) return;
    const nx = (head.x / this._cols) * 2 - 1;
    const ny = (head.y / this._rows) * 2 - 1;
    DaveMode._irisEl.style.transform = `translate(${nx * 3}px, ${ny * 3}px)`;
  }

  _randomChar() {
    return MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
  }
}
