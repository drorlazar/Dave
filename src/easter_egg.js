// Easter Egg - Dangerous Dave on a Retro CRT PC
// Click the "D.A.V.E" title to play a random Dave game!

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

export function initEasterEgg() {
  const logoMain = document.querySelector('.logo-main');
  if (!logoMain) return;
  logoMain.classList.add('has-easter-egg');
  logoMain.addEventListener('click', toggleEasterEgg);
}

function toggleEasterEgg(e) {
  e.stopPropagation();
  if (overlay) {
    hideEasterEgg();
  } else {
    showEasterEgg();
  }
}

function showEasterEgg() {
  const game = GAMES[Math.floor(Math.random() * GAMES.length)];

  const el = document.createElement('div');
  el.className = 'dave-easter-egg-overlay';
  el.innerHTML = `
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

  document.body.appendChild(el);
  overlay = el;
  isMuted = true;

  requestAnimationFrame(() => {
    el.classList.add('active');
  });

  el.querySelector('.crt-off-btn').addEventListener('click', hideEasterEgg);
  el.querySelector('.crt-mute-btn').addEventListener('click', toggleMute);

  el.addEventListener('click', (e) => {
    if (e.target === el) hideEasterEgg();
  });

  document.addEventListener('keydown', onEscKey);

  setTimeout(() => {
    el.querySelector('.crt-screen')?.classList.remove('booting');
    loadGame(game.index);
  }, 700);
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

function hideEasterEgg() {
  if (!overlay) return;

  const screen = overlay.querySelector('.crt-screen');
  const led = overlay.querySelector('.power-led');

  if (screen) {
    screen.classList.add('shutting-down');
  }
  if (led) {
    led.classList.add('off');
  }

  setTimeout(() => {
    overlay.classList.remove('active');
    setTimeout(() => {
      if (overlay) {
        overlay.remove();
        overlay = null;
      }
    }, 400);
  }, 500);

  document.removeEventListener('keydown', onEscKey);
}

function onEscKey(e) {
  if (e.key === 'Escape') {
    hideEasterEgg();
  }
}
