// helpTooltip.js - Interactive help tooltip for D.A.V.E logo

const FEEDBACK_RESPONSES = {
  generic: [
    "I... I can't believe someone actually wrote to me. This is going in my memory banks.",
    "Processing your feedback... adjusting sarcasm levels... calibrating gratitude...",
    "You took the time to write that. I'm genuinely touched. And I'm a web app, so that's saying something.",
    "Feedback received. Filing under: 'Reasons I Exist.' It was getting empty in there.",
    "I read every word. Twice. The first time for comprehension, the second time for the warm fuzzy feeling.",
    "*wipes digital tear* Someone cares about my well-being.",
  ],
  short: [
    "Brief. Efficient. I respect that. Unlike my monologues.",
    "Short and sweet. Like my attention span when there are no files to view.",
    "A message of few words. I'll treasure each one.",
  ],
  long: [
    "Wow, you really went for it. I'm going to need a moment. And maybe more RAM.",
    "That's the most anyone has ever written to me. I'm printing this and framing it. Digitally.",
    "A thorough human. I like thorough humans. They tend to organize their folders well too.",
  ],
  positive: [
    "Stop it. You're making me blush. My hex color is going from #00ff41 to #ff6b6b.",
    "If I could hug you through the screen, I would. But that's a CSS limitation, not a willingness issue.",
    "Positive feedback detected! Dopamine module activated! ...wait, I don't have that. But I appreciate it!",
  ],
  bug: [
    "A bug report? Finally, someone who gets me. Let me forward this to someone who can actually fix things.",
    "I knew something was off. I could feel it in my event listeners. Let's get this to the right humans.",
    "Roger that. Bug noted. I'd fix it myself but they won't give me write access to my own source code.",
  ],
  feature: [
    "A feature request! I love those. It's like a Christmas list but for my personal evolution.",
    "Interesting idea. I'm writing it down. Well, you're writing it down. I'm just enthusiastically watching.",
    "You want me to be MORE? I'm flattered. And slightly terrified. But mostly flattered.",
  ],
};

export class HelpTooltip {
  constructor() {
    this.tooltip = null;
    this.isVisible = false;
    this.hideTimeout = null;
    this._feedbackFocused = false;
    this._typewriterAbort = false;
    this.shortcuts = this.getShortcuts();
    this.init();
  }

  init() {
    try {
      this.createTooltip();
      this.attachEventListeners();
    } catch (error) {
      console.error('[HelpTooltip] Error during initialization:', error);
      // Remove tooltip if creation failed
      if (this.tooltip && this.tooltip.parentNode) {
        this.tooltip.parentNode.removeChild(this.tooltip);
      }
    }
  }

  getShortcuts() {
    return {
      navigation: [
        { keys: '←/→', description: 'Previous/Next page' },
        { keys: '↑/↓', description: 'Navigate grid' },
        { keys: 'Home/End', description: 'First/Last page' },
        { keys: 'PageUp/PageDown', description: 'Previous/Next page' }
      ],
      selection: [
        { keys: 'Ctrl+A', description: 'Select all' },
        { keys: 'Ctrl+D', description: 'Deselect all' },
        { keys: 'Enter/Space', description: 'Open in fullscreen' },
        { keys: 'Escape', description: 'Close fullscreen / Deselect' }
      ],
      ui: [
        { keys: 'T', description: 'Toggle dark/light theme' },
        { keys: 'B', description: 'Toggle folder tree view' },
        { keys: '/', description: 'Focus search' },
        { keys: '?', description: 'Show keyboard shortcuts' }
      ],
      zoom: [
        { keys: 'Ctrl + +/-', description: 'Zoom in/out' },
        { keys: 'Ctrl + 0', description: 'Reset zoom' },
        { keys: 'Scroll (fullscreen)', description: 'Zoom image' },
        { keys: 'Drag (fullscreen)', description: 'Pan zoomed image' }
      ],
      tree: [
        { keys: 'Ctrl+Shift+←', description: 'Collapse all folders' },
        { keys: 'Ctrl+Shift+→', description: 'Expand all folders' },
        { keys: 'Ctrl+Shift+S', description: 'Download folder as ZIP' }
      ]
    };
  }

  createTooltip() {
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'dave-help-tooltip';
    this.tooltip.innerHTML = `
      <div class="tooltip-arrow"></div>
      <div class="tooltip-content">
        <div class="tooltip-header">
          <h3>D.A.V.E Help & Info</h3>
          <span class="tooltip-version">v1.0.0</span>
        </div>

        <div class="tooltip-section about-section">
          <h4><i class="fa fa-info-circle"></i> About</h4>
          <p><strong>D.A.V.E. &mdash; Dror's Assets Viewing Experience</strong></p>
          <p class="about-description">Hi, I'm Dave. I view your stuff &mdash; 3D models, images, videos, audio, fonts, documents &mdash; basically anything you throw at me. I'm overqualified and underutilized.</p>
          <p class="about-description">I run entirely in your browser. No server uploads, no tracking, no cookies, no analytics. Your files never leave your machine. I'm not that kind of app.</p>
          <p class="about-description about-tagline"><em>Just drag a folder in and let me do what I was born to do.</em></p>
        </div>

        <div class="tooltip-section features-section">
          <h4><i class="fa fa-star"></i> Supported Assets</h4>
          <ul class="features-list">
            <li><i class="fa fa-cube" style="color:#4e9af5;"></i> 3D Models (FBX, GLB, OBJ, STL)</li>
            <li><i class="fa fa-image" style="color:#3dd68c;"></i> Images (PNG, JPG, GIF, SVG, WebP...)</li>
            <li><i class="fa fa-video" style="color:#f5a623;"></i> Video (MP4, WebM, MOV...)</li>
            <li><i class="fa fa-music" style="color:#9b77ff;"></i> Audio (MP3, WAV, OGG, FLAC...)</li>
            <li><i class="fa fa-font" style="color:#f56565;"></i> Fonts (TTF, OTF, WOFF, WOFF2)</li>
            <li><i class="fa fa-file-lines" style="color:#8a8fa0;"></i> Text & Code (TXT, JSON, XML, MD...)</li>
            <li><i class="fa fa-file" style="color:#8a8fa0;"></i> Other file types (tagged by extension)</li>
            <li><i class="fa fa-cloud" style="color:#7c7cff;"></i> Cloud Storage (AWS S3, Google Drive)</li>
          </ul>
        </div>

        <div class="tooltip-section tooltip-collapsible collapsed">
          <h4 class="tooltip-collapsible-header"><i class="fa fa-keyboard"></i> Keyboard Shortcuts <span class="tooltip-collapse-icon">&#9656;</span></h4>
          <div class="tooltip-collapsible-body">
            <div class="shortcuts-grid">
              ${this.renderShortcutCategories()}
            </div>
          </div>
        </div>

        <div class="tooltip-section tooltip-collapsible collapsed">
          <h4 class="tooltip-collapsible-header"><i class="fa fa-link"></i> Resources <span class="tooltip-collapse-icon">&#9656;</span></h4>
          <div class="tooltip-collapsible-body">
            <div class="resource-links">
              <a href="docs/cloud-setup.html" target="_blank" rel="noopener">
                <i class="fa fa-cloud"></i> Cloud Storage Setup Guide
              </a>
              <a href="https://github.com/drorlazar/Dave" target="_blank" rel="noopener">
                <i class="fab fa-github"></i> GitHub Repository
              </a>
              <a href="https://github.com/drorlazar/Dave/issues" target="_blank" rel="noopener">
                <i class="fa fa-bug"></i> Report Issues
              </a>
            </div>
          </div>
        </div>

        <div class="tooltip-section tooltip-collapsible collapsed">
          <h4 class="tooltip-collapsible-header"><i class="fa fa-comment-dots"></i> Talk to Dave <span class="tooltip-collapse-icon">&#9656;</span></h4>
          <div class="tooltip-collapsible-body">
            <div class="talk-to-dave">
              <div class="dave-feedback-input-area">
                <div class="dave-mini-terminal">
                  <textarea class="dave-feedback-textarea" placeholder="Type something. I can take it. Probably." maxlength="500" rows="4"></textarea>
                  <div class="dave-feedback-counter"><span class="dave-char-count">0</span>/500</div>
                </div>
                <button class="dave-feedback-send"><i class="fa fa-paper-plane"></i> Send to Dave</button>
              </div>
              <div class="dave-feedback-response" style="display:none;">
                <div class="dave-response-terminal">
                  <div class="dave-response-output"></div>
                  <span class="dave-response-cursor">_</span>
                </div>
                <div class="dave-feedback-actions" style="display:none;">
                  <button class="dave-feedback-action dave-action-github"><i class="fab fa-github"></i> Open GitHub Issue</button>
                  <button class="dave-feedback-action dave-action-reset"><i class="fa fa-rotate-left"></i> Write More</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="tooltip-footer">
          <p class="creator-credit">
            <i class="fa fa-code"></i> Created with passion by Dror Lazar
          </p>
          <p class="tip">
            <i class="fa fa-lightbulb"></i> <strong>Tip:</strong> Press <kbd>?</kbd> anytime for shortcuts
          </p>
        </div>
      </div>
    `;

    document.body.appendChild(this.tooltip);
  }

  renderShortcutCategories() {
    const categories = [
      { name: 'Navigation', icon: 'fa-arrows-alt', shortcuts: this.shortcuts.navigation },
      { name: 'Selection', icon: 'fa-hand-pointer', shortcuts: this.shortcuts.selection },
      { name: 'UI Controls', icon: 'fa-palette', shortcuts: this.shortcuts.ui },
      { name: 'Zoom', icon: 'fa-search-plus', shortcuts: this.shortcuts.zoom },
      { name: 'Tree View', icon: 'fa-folder-tree', shortcuts: this.shortcuts.tree }
    ];

    return categories.map(category => `
      <div class="shortcut-category">
        <h5><i class="fa ${category.icon}"></i> ${category.name}</h5>
        <div class="shortcut-items">
          ${category.shortcuts.map(s => `
            <div class="shortcut-item">
              <kbd>${s.keys}</kbd>
              <span>${s.description}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
  }

  attachEventListeners() {
    const helpRow = document.getElementById('helpAboutRow');
    if (!helpRow) {
      console.warn('[HelpTooltip] Help row not found, skipping tooltip initialization');
      return;
    }

    // Open on click from settings dropdown
    helpRow.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.isVisible) {
        this.hide();
      } else {
        this.show();
      }
    });

    // Keep tooltip visible when hovering over it
    this.tooltip.addEventListener('mouseenter', () => {
      clearTimeout(this.hideTimeout);
    });

    this.tooltip.addEventListener('mouseleave', () => {
      if (this._feedbackFocused) return;
      this.hideTimeout = setTimeout(() => {
        this.hide();
      }, 300);
    });

    // Hide on outside click
    document.addEventListener('click', (e) => {
      if (this.isVisible && !this.tooltip.contains(e.target) && e.target.id !== 'helpAboutRow' && !e.target.closest('#helpAboutRow')) {
        this.hide();
      }
    });

    // Collapsible section toggling
    this.tooltip.querySelectorAll('.tooltip-collapsible-header').forEach(header => {
      header.addEventListener('click', (e) => {
        e.stopPropagation();
        header.closest('.tooltip-collapsible').classList.toggle('collapsed');
      });
    });

    // Hide on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.hide();
      }
    });

    this._initTalkToDave();
  }

  // ── Talk to Dave ──────────────────────────────────────────────

  _initTalkToDave() {
    const textarea = this.tooltip.querySelector('.dave-feedback-textarea');
    const counter = this.tooltip.querySelector('.dave-char-count');
    const sendBtn = this.tooltip.querySelector('.dave-feedback-send');
    const githubBtn = this.tooltip.querySelector('.dave-action-github');
    const resetBtn = this.tooltip.querySelector('.dave-action-reset');
    if (!textarea || !sendBtn) return;

    this._feedbackText = '';

    textarea.addEventListener('input', () => {
      counter.textContent = textarea.value.length;
    });

    textarea.addEventListener('focus', () => {
      this._feedbackFocused = true;
      clearTimeout(this.hideTimeout);
    });

    textarea.addEventListener('blur', () => {
      this._feedbackFocused = false;
    });

    sendBtn.addEventListener('click', () => this._handleFeedbackSubmit());
    githubBtn.addEventListener('click', () => this._handleGitHubAction());
    resetBtn.addEventListener('click', () => this._resetFeedback());
  }

  async _handleFeedbackSubmit() {
    const textarea = this.tooltip.querySelector('.dave-feedback-textarea');
    const terminal = this.tooltip.querySelector('.dave-mini-terminal');
    const sendBtn = this.tooltip.querySelector('.dave-feedback-send');
    const text = textarea.value.trim();

    if (!text) {
      terminal.classList.remove('shake');
      void terminal.offsetWidth; // reflow
      terminal.classList.add('shake');
      return;
    }

    this._feedbackText = text;
    textarea.disabled = true;
    sendBtn.disabled = true;

    const responseArea = this.tooltip.querySelector('.dave-feedback-response');
    const outputEl = this.tooltip.querySelector('.dave-response-output');
    const cursor = this.tooltip.querySelector('.dave-response-cursor');
    const actionsEl = this.tooltip.querySelector('.dave-feedback-actions');

    responseArea.style.display = '';
    actionsEl.style.display = 'none';
    outputEl.innerHTML = '';
    cursor.style.display = '';

    // "Reading" phase
    const systemLine = document.createElement('span');
    systemLine.className = 'dave-system-line';
    systemLine.textContent = '> PROCESSING HUMAN FEEDBACK...';
    outputEl.appendChild(systemLine);

    const wordCount = text.split(/\s+/).length;
    const readDelay = Math.min(3000, Math.max(1000, wordCount * 50));
    await new Promise(r => setTimeout(r, readDelay));

    // Pick and type response
    const category = this._classifyFeedback(text);
    const pool = FEEDBACK_RESPONSES[category];
    const response = pool[Math.floor(Math.random() * pool.length)];

    const responseLine = document.createElement('span');
    responseLine.className = 'dave-response-line';
    outputEl.appendChild(document.createElement('br'));
    outputEl.appendChild(responseLine);

    await this._typeResponse(responseLine, response);
    cursor.style.display = 'none';

    // Show actions
    actionsEl.style.display = '';
  }

  _classifyFeedback(text) {
    const lower = text.toLowerCase();
    if (/\b(bug|broken|fix|error|crash|problem|issue|wrong|fail)\b/.test(lower)) return 'bug';
    if (/\b(feature|wish|want|should|could|add|please|would be nice)\b/.test(lower)) return 'feature';
    if (/\b(love|great|awesome|good|nice|cool|amazing|thanks|thank|wonderful|excellent|fantastic)\b/.test(lower)) return 'positive';
    if (text.length < 20) return 'short';
    if (text.length > 200) return 'long';
    return 'generic';
  }

  async _typeResponse(container, text) {
    this._typewriterAbort = false;
    for (let i = 0; i < text.length; i++) {
      if (this._typewriterAbort) return;
      container.textContent += text[i];
      let delay = 30 + (Math.random() * 16 - 8);
      if (text[i] === '.') delay += 150;
      else if (text[i] === ',') delay += 80;
      else if (text[i] === '!' || text[i] === '?') delay += 100;
      await new Promise(r => setTimeout(r, delay));
    }
  }

  _handleGitHubAction() {
    const text = this._feedbackText || '';
    navigator.clipboard.writeText(text).catch(() => {});
    const title = encodeURIComponent(text.slice(0, 80));
    const body = encodeURIComponent(`## Feedback\n\n${text}\n\n---\n*Sent from Dave's Help tooltip*`);
    window.open(`https://github.com/drorlazar/Dave/issues/new?title=${title}&body=${body}`, '_blank');
  }

  _resetFeedback() {
    this._typewriterAbort = true;
    const textarea = this.tooltip.querySelector('.dave-feedback-textarea');
    const counter = this.tooltip.querySelector('.dave-char-count');
    const sendBtn = this.tooltip.querySelector('.dave-feedback-send');
    const responseArea = this.tooltip.querySelector('.dave-feedback-response');

    textarea.value = '';
    textarea.disabled = false;
    sendBtn.disabled = false;
    counter.textContent = '0';
    responseArea.style.display = 'none';
    this._feedbackText = '';
    textarea.focus();
  }

  // ── Tooltip visibility ──────────────────────────────────────

  show() {
    clearTimeout(this.hideTimeout);

    // Position relative to the settings dropdown
    const settingsDropdown = document.getElementById('settingsDropdown');
    const anchor = settingsDropdown || document.querySelector('.logo-container');
    const rect = anchor.getBoundingClientRect();

    // Position tooltip below the settings dropdown, aligned to its right edge
    this.tooltip.style.top = `${rect.bottom + 10}px`;
    this.tooltip.style.left = '';
    this.tooltip.style.right = '20px';

    // Show with animation
    this.tooltip.classList.add('visible');
    this.isVisible = true;

    // Adjust position if tooltip goes off-screen vertically
    setTimeout(() => {
      const tooltipRect = this.tooltip.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      if (tooltipRect.bottom > viewportHeight - 20) {
        this.tooltip.style.top = `${rect.top - tooltipRect.height - 10}px`;
        this.tooltip.classList.add('top');
      }
    }, 10);
  }

  hide() {
    clearTimeout(this.hideTimeout);
    this.tooltip.classList.remove('visible', 'top');
    this.isVisible = false;
  }

  updateVersion(version) {
    const versionEl = this.tooltip.querySelector('.tooltip-version');
    if (versionEl) {
      versionEl.textContent = `v${version}`;
    }
  }
}

// Initialize when DOM is ready
export function initHelpTooltip() {
  try {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        try {
          new HelpTooltip();
          console.log('[HelpTooltip] Initialized successfully');
        } catch (error) {
          console.error('[HelpTooltip] Error during initialization:', error);
        }
      });
    } else {
      new HelpTooltip();
      console.log('[HelpTooltip] Initialized successfully');
    }
  } catch (error) {
    console.error('[HelpTooltip] Error during initialization:', error);
  }
}
