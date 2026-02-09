// Rezmason Matrix Rain - Embeds https://github.com/Rezmason/matrix via iframe
// Same API as MatrixRain (start, fadeIn, fadeOut, stop) for drop-in usage

const BASE_URL = 'https://rezmason.github.io/matrix';

export class RezmasonRain {
  constructor(params) {
    this.params = params;
    this.container = null;
    this.iframe = null;
    this._fadeOutTimer = null;
  }

  start(zIndex = 9999) {
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      z-index: ${zIndex}; pointer-events: none;
    `;

    this.iframe = document.createElement('iframe');
    this.iframe.src = `${BASE_URL}?${this.params}&suppressWarnings=true`;
    this.iframe.style.cssText = `
      width: 100%; height: 100%; border: none;
      pointer-events: none; background: #000;
    `;
    this.iframe.setAttribute('tabindex', '-1');
    this.iframe.setAttribute('aria-hidden', 'true');

    this.container.appendChild(this.iframe);
    document.body.appendChild(this.container);
  }

  // Fade in from invisible (CSS opacity transition)
  fadeIn(duration = 1500) {
    if (!this.container) return;
    this.container.style.opacity = '0';
    this.container.style.transition = `opacity ${duration}ms ease`;
    // Double rAF ensures browser paints opacity:0 before transitioning
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (this.container) this.container.style.opacity = '1';
      });
    });
  }

  // Fade out then clean up
  fadeOut(duration = 800, callback) {
    if (!this.container) { if (callback) callback(); return; }
    this.container.style.transition = `opacity ${duration}ms ease`;
    this.container.style.opacity = '0';
    this._fadeOutTimer = setTimeout(() => {
      this.stop();
      if (callback) callback();
    }, duration);
  }

  stop() {
    if (this._fadeOutTimer) { clearTimeout(this._fadeOutTimer); this._fadeOutTimer = null; }
    if (this.container) { this.container.remove(); this.container = null; }
    this.iframe = null;
  }
}
