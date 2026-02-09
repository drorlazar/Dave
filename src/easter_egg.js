// Easter Egg - Dangerous Dave on a Retro CRT PC
// Click the "D.A.V.E" title to play a random Dave game!
// Each click picks a random Matrix rain variant for the entrance.

import { MatrixRain } from './matrix_rain.js';
import { RezmasonRain } from './matrix_rain_rezmason.js';

// ---- Matrix rain modes (random per click) ----
const MATRIX_MODES = [
  {
    name: "Dror's Matrix",
    type: 'custom',
  },
  {
    name: 'Classic Matrix Code',
    type: 'rezmason',
    params: 'version=classic',
  },
  {
    name: 'Matrix Awakening',
    type: 'rezmason',
    params: 'version=classic&skipIntro=false',
    skipFadeIn: true, // let the built-in blank-to-full intro play naturally
  },
  {
    name: 'Matrix 3D',
    type: 'rezmason',
    params: 'version=3d',
  },
  {
    name: 'Mirror Matrix',
    type: 'rezmason',
    // Rain falls upward + flipped glyphs + circle ripples = water reflection effect
    params: 'version=classic&fallSpeed=-0.3&glyphFlip=true&rippleTypeName=circle&rippleSpeed=0.2&rippleThickness=0.25',
  },
  {
    name: 'Matrix Resurrections',
    type: 'rezmason',
    params: 'version=resurrections',
  },
  {
    name: 'Trinity',
    type: 'rezmason',
    params: 'version=trinity',
  },
  {
    name: 'Operator',
    type: 'rezmason',
    // Operator mode has built-in box ripple effects
    params: 'version=operator',
  },
  {
    name: 'Megacity',
    type: 'rezmason',
    params: 'version=megacity',
  },
];

const GAMES = [
  {
    index: 0,
    title: 'Dangerous Dave (1990)',
    controls: '<b>Arrows</b> Move &nbsp; <b>Ctrl</b> Jump &nbsp; <b>Alt</b> Fire'
  },
  {
    index: 1,
    title: 'Dave in the Haunted Mansion (1991)',
    controls: '<b>Arrows</b> Move/Aim &nbsp; <b>Ctrl</b> Jump &nbsp; <b>Alt</b> Fire Shotgun'
  },
  {
    index: 2,
    title: "Dave's Risky Rescue (1993)",
    controls: '<b>Arrows</b> Move &nbsp; <b>Ctrl</b> Jump &nbsp; <b>Alt</b> Shoot &nbsp; <b>Up</b> Open Door'
  },
  {
    index: 3,
    title: 'Dave Goes Nutz! (1993)',
    controls: '<b>Arrows</b> Move &nbsp; <b>Ctrl</b> Jump &nbsp; <b>Alt</b> Shoot &nbsp; <b>Up</b> Open Door'
  }
];

const FALLBACK_URLS = [
  'https://www.retrogames.cz/play_480-DOS.php',
  'https://archive.org/embed/msdos_DDAVEVGA_shareware'
];

let overlay = null;
let isMuted = false;
let animating = false;
let rain = null;

export function initEasterEgg() {
  const logoMain = document.querySelector('.logo-main');
  if (!logoMain) return;
  logoMain.classList.add('has-easter-egg');
  logoMain.addEventListener('click', toggleEasterEgg);
}

function toggleEasterEgg(e) {
  e.stopPropagation();
  if (animating) return;
  if (overlay) {
    hideEasterEgg();
  } else {
    showEasterEgg();
  }
}

function createRain(mode) {
  if (mode.type === 'custom') {
    return new MatrixRain();
  }
  return new RezmasonRain(mode.params);
}

// ---- ENTRANCE: Rain fades in -> builds -> Glitch + PC materializes ----
function showEasterEgg() {
  animating = true;
  const game = GAMES[Math.floor(Math.random() * GAMES.length)];
  const mode = MATRIX_MODES[Math.floor(Math.random() * MATRIX_MODES.length)];

  // Hide help tooltip so it doesn't sit on top of the effect
  const helpTooltip = document.querySelector('.dave-help-tooltip');
  if (helpTooltip) helpTooltip.classList.remove('visible');

  // Phase 1: Rain starts (type depends on random mode)
  rain = createRain(mode);
  rain.start(9999);
  if (!mode.skipFadeIn) {
    rain.fadeIn(1000);
  }

  // Phase 2: Glitch erupts
  setTimeout(() => {
    const tearOverlay = document.createElement('div');
    tearOverlay.className = 'glitch-tear-overlay';
    document.body.appendChild(tearOverlay);

    const staticOverlay = document.createElement('div');
    staticOverlay.className = 'glitch-static-overlay';
    document.body.appendChild(staticOverlay);

    document.body.classList.add('glitching');

    // Phase 3: PC materializes through the glitch + rain
    setTimeout(() => {
      const el = document.createElement('div');
      el.className = 'dave-easter-egg-overlay entering';
      el.innerHTML = buildPCHtml(game);

      document.body.appendChild(el);
      overlay = el;
      isMuted = true;

      el.querySelector('.crt-off-btn').addEventListener('click', hideEasterEgg);
      el.querySelector('.crt-mute-btn').addEventListener('click', toggleMute);
      el.addEventListener('click', (e) => {
        if (e.target === el) hideEasterEgg();
      });
      document.addEventListener('keydown', onEscKey);

      // Phase 4: Glitch settles, rain fades out, PC solidifies
      setTimeout(() => {
        document.body.classList.remove('glitching');
        tearOverlay.remove();
        staticOverlay.remove();

        if (rain) {
          rain.fadeOut(1200, () => { rain = null; });
        }

        if (overlay) {
          overlay.classList.remove('entering');
          overlay.classList.add('active');
          const screen = overlay.querySelector('.crt-screen');
          if (screen) screen.classList.remove('booting');
          loadGame(game.index);
        }
        animating = false;
      }, 400);
    }, 300);
  }, 1200);
}

// ---- EXIT: Dror's Matrix (with glow) + Glitch -> PC dissolves -> rain fades via CSS ----
// Always uses custom MatrixRain for exit (instant, no network delay)
function hideEasterEgg() {
  if (!overlay || animating) return;
  animating = true;
  document.removeEventListener('keydown', onEscKey);

  // Phase 1: Rain + glitch erupt immediately (with glow effect)
  rain = new MatrixRain();
  rain.start(10001);
  if (rain.canvas) {
    rain.canvas.style.filter = 'brightness(1.4) drop-shadow(0 0 12px rgba(0, 255, 50, 0.6))';
  }

  const tearOverlay = document.createElement('div');
  tearOverlay.className = 'glitch-tear-overlay';
  document.body.appendChild(tearOverlay);
  document.body.classList.add('glitching-out');

  // Phase 2: CRT shuts down, PC dissolves into rain
  setTimeout(() => {
    if (!overlay) {
      cssFadeRain(800);
      return;
    }

    const screen = overlay.querySelector('.crt-screen');
    const led = overlay.querySelector('.power-led');
    if (screen) screen.classList.add('shutting-down');
    if (led) led.classList.add('off');

    overlay.classList.remove('active');
    overlay.classList.add('exiting');

    // Phase 3: Remove overlay + glitch, rain lingers then fades via CSS opacity
    setTimeout(() => {
      document.body.classList.remove('glitching-out');
      tearOverlay.remove();
      if (overlay) {
        overlay.remove();
        overlay = null;
      }
      // CSS opacity fade on the canvas itself - smooth and can't be cut off
      cssFadeRain(900);
    }, 600);
  }, 350);
}

// Fade rain canvas via CSS opacity (works reliably, unlike internal canvas alpha)
function cssFadeRain(duration) {
  if (!rain) { animating = false; return; }
  const el = rain.canvas || rain.container;
  if (el) {
    el.style.transition = `opacity ${duration}ms ease-out`;
    el.style.opacity = '0';
  }
  setTimeout(() => {
    if (rain) { rain.stop(); rain = null; }
    animating = false;
  }, duration);
}

function buildPCHtml(game) {
  return `
    <div class="retro-pc">
      <div class="crt-monitor">
        <div class="crt-screen-bezel">
          <div class="crt-screen booting">
            <div class="crt-screen-loading">
              <div>C:\\DAVE> ${game.title}</div>
              <div>C:\\DAVE> LOADING...</div>
              <div class="blink">_</div>
            </div>
            <div class="crt-screen-glare"></div>
            <div class="crt-controls-bar">${game.controls}</div>
          </div>
        </div>
        <div class="crt-panel">
          <div class="crt-panel-left">
            <div class="power-led"></div>
            <span class="crt-brand">D A V E</span>
          </div>
          <div class="crt-panel-right">
            <button class="crt-mute-btn" title="Mute/Unmute">
              <i class="fa fa-volume-mute"></i>
            </button>
            <button class="crt-off-btn" title="Turn Off">&#9632; OFF</button>
          </div>
        </div>
      </div>
      <div class="crt-stand-neck"></div>
      <div class="crt-stand-base"></div>
    </div>
  `;
}

function loadGame(gameIndex) {
  if (!overlay) return;
  const screen = overlay.querySelector('.crt-screen');
  if (!screen) return;

  const iframe = document.createElement('iframe');
  iframe.src = `dave_game.html?game=${gameIndex}`;
  iframe.allow = 'autoplay; fullscreen';
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups');

  iframe.addEventListener('load', () => {
    const loading = screen.querySelector('.crt-screen-loading');
    if (loading) loading.style.display = 'none';
    if (isMuted && iframe.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'dave-mute', muted: true }, '*');
    }
  });

  const fallbackTimer = setTimeout(() => {
    showFallback(screen);
  }, 15000);

  iframe.addEventListener('load', () => clearTimeout(fallbackTimer));
  iframe.addEventListener('error', () => {
    clearTimeout(fallbackTimer);
    showFallback(screen);
  });

  screen.insertBefore(iframe, screen.querySelector('.crt-screen-glare'));
}

function toggleMute() {
  isMuted = !isMuted;
  const btn = overlay?.querySelector('.crt-mute-btn i');
  if (btn) {
    btn.className = isMuted ? 'fa fa-volume-mute' : 'fa fa-volume-up';
  }
  const iframe = overlay?.querySelector('.crt-screen iframe');
  if (iframe?.contentWindow) {
    iframe.contentWindow.postMessage({ type: 'dave-mute', muted: isMuted }, '*');
  }
}

function showFallback(screen) {
  if (screen.querySelector('.crt-screen-fallback')) return;
  const loading = screen.querySelector('.crt-screen-loading');
  if (loading && loading.style.display === 'none') return;

  if (loading) loading.style.display = 'none';

  const fallback = document.createElement('div');
  fallback.className = 'crt-screen-fallback';
  fallback.innerHTML = `
    <div>GAME LOAD ERROR</div>
    <div>The game could not be embedded.</div>
    <a href="${FALLBACK_URLS[0]}" target="_blank" rel="noopener">&#9654; Play Dangerous Dave in new tab</a>
    <a href="${FALLBACK_URLS[1]}" target="_blank" rel="noopener">&#9654; Alt: Archive.org version</a>
  `;
  screen.insertBefore(fallback, screen.querySelector('.crt-screen-glare'));
}

function onEscKey(e) {
  if (e.key === 'Escape') {
    hideEasterEgg();
  }
}
