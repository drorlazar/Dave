// TextHandler.js - Handler for text file formats (txt, md, json, xml, csv, yaml, log, ini, toml)

import { BaseAssetHandler } from './BaseAssetHandler.js';

export class TextHandler extends BaseAssetHandler {
  constructor() {
    super();
    this.supportedTypes = [
      'txt', 'text', 'md', 'markdown', 'json', 'xml', 'csv',
      'yaml', 'yml', 'log', 'ini', 'cfg', 'conf', 'toml'
    ];
  }

  canHandle(fileType) {
    return this.supportedTypes.includes(fileType);
  }

  requiresBlobUrl() {
    return false; // We read file content directly via FileReader
  }

  /**
   * Read file content as text - supports both local File objects and cloud files
   */
  async readFileAsText(fileOrModel) {
    // If it's a File object, use FileReader
    if (fileOrModel instanceof File) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(fileOrModel);
      });
    }
    // If it's a model object without a File (cloud), fetch via URL
    if (fileOrModel && !fileOrModel.file && (fileOrModel.source === 's3' || fileOrModel.source === 'gdrive')) {
      const url = await this.getFileUrl(fileOrModel);
      const response = await fetch(url);
      return await response.text();
    }
    // Default: treat as File
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(fileOrModel);
    });
  }

  /**
   * Get a display label for the file subtype
   */
  getFormatLabel(subtype) {
    const labels = {
      txt: 'TXT', text: 'TXT', md: 'MD', markdown: 'MD',
      json: 'JSON', xml: 'XML', csv: 'CSV',
      yaml: 'YAML', yml: 'YAML', log: 'LOG',
      ini: 'INI', cfg: 'CFG', conf: 'CONF', toml: 'TOML'
    };
    return labels[subtype] || subtype.toUpperCase();
  }

  /**
   * Try to pretty-print JSON content
   */
  tryFormatJson(text) {
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text;
    }
  }

  /**
   * Render basic markdown to HTML (headers, bold, italic, code, links, lists)
   */
  renderMarkdown(text) {
    let html = this.escapeHtml(text);

    // Code blocks (``` ... ```)
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="md-code-block"><code>$2</code></pre>');

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>');

    // Headers (# to ######)
    html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
    html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
    html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

    // Bold and italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Links [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="md-link" target="_blank" rel="noopener">$1</a>');

    // Horizontal rules
    html = html.replace(/^---+$/gm, '<hr class="md-hr">');

    // Unordered lists
    html = html.replace(/^[\s]*[-*+]\s+(.+)$/gm, '<li>$1</li>');

    // Ordered lists
    html = html.replace(/^[\s]*\d+\.\s+(.+)$/gm, '<li>$1</li>');

    // Blockquotes
    html = html.replace(/^&gt;\s+(.+)$/gm, '<blockquote class="md-blockquote">$1</blockquote>');

    // Line breaks (preserve paragraph structure)
    html = html.replace(/\n\n/g, '</p><p>');
    html = '<p>' + html + '</p>';

    // Clean up empty paragraphs around block elements
    html = html.replace(/<p>\s*(<h[1-6]>)/g, '$1');
    html = html.replace(/(<\/h[1-6]>)\s*<\/p>/g, '$1');
    html = html.replace(/<p>\s*(<pre)/g, '$1');
    html = html.replace(/(<\/pre>)\s*<\/p>/g, '$1');
    html = html.replace(/<p>\s*(<hr)/g, '$1');
    html = html.replace(/<p>\s*(<blockquote)/g, '$1');
    html = html.replace(/(<\/blockquote>)\s*<\/p>/g, '$1');
    html = html.replace(/<p>\s*(<li>)/g, '$1');
    html = html.replace(/(<\/li>)\s*<\/p>/g, '$1');
    html = html.replace(/<p>\s*<\/p>/g, '');

    return html;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Add line numbers to text content
   */
  addLineNumbers(text) {
    const lines = text.split('\n');
    const gutterWidth = String(lines.length).length;
    return lines.map((line, i) => {
      const num = String(i + 1).padStart(gutterWidth, ' ');
      return `<span class="text-line-number">${num}</span>${this.escapeHtml(line)}`;
    }).join('\n');
  }

  async loadThumbnail(model, container, options = {}) {
    try {
      const text = await this.readFileAsText(model.file || model);
      const label = this.getFormatLabel(model.subtype);
      const isJson = model.subtype === 'json';
      const isMd = model.subtype === 'md' || model.subtype === 'markdown';

      let displayText = text;
      if (isJson) {
        displayText = this.tryFormatJson(text);
      }

      // Truncate to first ~15 lines for preview
      const lines = displayText.split('\n').slice(0, 15);
      const previewText = lines.join('\n');

      const preview = document.createElement('div');
      preview.className = 'text-preview';

      const badge = document.createElement('span');
      badge.className = 'text-format-badge';
      badge.textContent = label;
      preview.appendChild(badge);

      const content = document.createElement('pre');
      content.className = 'text-preview-content';
      if (isMd) {
        content.classList.add('text-preview-md');
      }
      content.textContent = previewText;
      preview.appendChild(content);

      container.innerHTML = '';
      container.appendChild(preview);
    } catch (error) {
      console.error(`Error loading text thumbnail for ${model.name}:`, error);
      container.innerHTML = '';
      container.appendChild(this.createErrorPlaceholder('Error loading text file'));
    }
  }

  async loadFullscreen(model, container, options = {}) {
    try {
      const text = await this.readFileAsText(model.file || model);
      const label = this.getFormatLabel(model.subtype);
      const isJson = model.subtype === 'json';
      const isMd = model.subtype === 'md' || model.subtype === 'markdown';

      container.style.display = 'flex';
      container.innerHTML = '';

      const wrapper = document.createElement('div');
      wrapper.className = 'text-fullscreen-wrapper';

      // --- Toolbar ---
      const toolbar = document.createElement('div');
      toolbar.className = 'text-toolbar';

      // Format badge
      const badgeEl = document.createElement('span');
      badgeEl.className = 'text-toolbar-badge';
      badgeEl.textContent = label;
      toolbar.appendChild(badgeEl);

      // Line count
      const lineCount = text.split('\n').length;
      const lineCountEl = document.createElement('span');
      lineCountEl.className = 'text-toolbar-info';
      lineCountEl.textContent = `${lineCount} lines`;
      toolbar.appendChild(lineCountEl);

      // Spacer
      const spacer = document.createElement('div');
      spacer.className = 'text-toolbar-spacer';
      toolbar.appendChild(spacer);

      // Zoom controls
      const savedFontSize = localStorage.getItem('textViewerFontSize') || '14';
      let currentFontSize = parseInt(savedFontSize, 10);

      const zoomOutBtn = document.createElement('button');
      zoomOutBtn.className = 'text-toolbar-btn';
      zoomOutBtn.innerHTML = '<i class="fa fa-minus"></i>';
      zoomOutBtn.title = 'Decrease font size (-)';
      toolbar.appendChild(zoomOutBtn);

      const fontSizeDisplay = document.createElement('span');
      fontSizeDisplay.className = 'text-toolbar-info text-font-size-display';
      fontSizeDisplay.textContent = `${currentFontSize}px`;
      toolbar.appendChild(fontSizeDisplay);

      const zoomInBtn = document.createElement('button');
      zoomInBtn.className = 'text-toolbar-btn';
      zoomInBtn.innerHTML = '<i class="fa fa-plus"></i>';
      zoomInBtn.title = 'Increase font size (+)';
      toolbar.appendChild(zoomInBtn);

      const zoomResetBtn = document.createElement('button');
      zoomResetBtn.className = 'text-toolbar-btn';
      zoomResetBtn.innerHTML = '<i class="fa fa-undo"></i>';
      zoomResetBtn.title = 'Reset font size';
      toolbar.appendChild(zoomResetBtn);

      // Separator
      toolbar.appendChild(this.createToolbarSeparator());

      // Word wrap toggle
      let wordWrapEnabled = localStorage.getItem('textViewerWordWrap') !== 'false';
      const wrapBtn = document.createElement('button');
      wrapBtn.className = 'text-toolbar-btn' + (wordWrapEnabled ? ' active' : '');
      wrapBtn.innerHTML = '<i class="fa fa-align-left"></i>';
      wrapBtn.title = 'Toggle word wrap (W)';
      toolbar.appendChild(wrapBtn);

      // Line numbers toggle
      let lineNumbersEnabled = localStorage.getItem('textViewerLineNumbers') !== 'false';
      const lineNumBtn = document.createElement('button');
      lineNumBtn.className = 'text-toolbar-btn' + (lineNumbersEnabled ? ' active' : '');
      lineNumBtn.innerHTML = '<i class="fa fa-list-ol"></i>';
      lineNumBtn.title = 'Toggle line numbers';
      toolbar.appendChild(lineNumBtn);

      // MD/JSON render toggle
      let renderMode = isMd; // Markdown starts rendered, JSON starts raw
      let renderToggleBtn = null;
      if (isMd || isJson) {
        toolbar.appendChild(this.createToolbarSeparator());
        renderToggleBtn = document.createElement('button');
        renderToggleBtn.className = 'text-toolbar-btn' + (renderMode ? ' active' : '');
        renderToggleBtn.innerHTML = isMd
          ? '<i class="fa fa-eye"></i>'
          : '<i class="fa fa-indent"></i>';
        renderToggleBtn.title = isMd ? 'Toggle rendered Markdown' : 'Toggle formatted JSON';
        toolbar.appendChild(renderToggleBtn);
      }

      // Separator
      toolbar.appendChild(this.createToolbarSeparator());

      // Copy button
      const copyBtn = document.createElement('button');
      copyBtn.className = 'text-toolbar-btn';
      copyBtn.innerHTML = '<i class="fa fa-copy"></i>';
      copyBtn.title = 'Copy to clipboard';
      toolbar.appendChild(copyBtn);

      wrapper.appendChild(toolbar);

      // --- Content area ---
      const contentArea = document.createElement('div');
      contentArea.className = 'text-fullscreen-content';

      const pre = document.createElement('pre');
      pre.className = 'text-fullscreen-pre';
      pre.style.fontSize = `${currentFontSize}px`;
      if (wordWrapEnabled) pre.classList.add('text-wrap');
      if (lineNumbersEnabled) pre.classList.add('text-line-numbers');

      const renderContent = () => {
        if (renderMode) {
          if (isMd) {
            pre.innerHTML = '';
            pre.classList.add('text-rendered-md');
            pre.classList.remove('text-line-numbers');
            pre.innerHTML = this.renderMarkdown(text);
          } else if (isJson) {
            pre.classList.remove('text-rendered-md');
            if (lineNumbersEnabled) pre.classList.add('text-line-numbers');
            const formatted = this.tryFormatJson(text);
            if (lineNumbersEnabled) {
              pre.innerHTML = this.addLineNumbers(formatted);
            } else {
              pre.textContent = formatted;
            }
          }
        } else {
          pre.classList.remove('text-rendered-md');
          if (lineNumbersEnabled) pre.classList.add('text-line-numbers');
          if (lineNumbersEnabled) {
            pre.innerHTML = this.addLineNumbers(text);
          } else {
            pre.textContent = text;
          }
        }
      };

      renderContent();
      contentArea.appendChild(pre);
      wrapper.appendChild(contentArea);
      container.appendChild(wrapper);

      // --- Event handlers ---
      const updateFontSize = (size) => {
        currentFontSize = Math.max(8, Math.min(48, size));
        pre.style.fontSize = `${currentFontSize}px`;
        fontSizeDisplay.textContent = `${currentFontSize}px`;
        localStorage.setItem('textViewerFontSize', String(currentFontSize));
      };

      zoomInBtn.addEventListener('click', () => updateFontSize(currentFontSize + 2));
      zoomOutBtn.addEventListener('click', () => updateFontSize(currentFontSize - 2));
      zoomResetBtn.addEventListener('click', () => updateFontSize(14));

      wrapBtn.addEventListener('click', () => {
        wordWrapEnabled = !wordWrapEnabled;
        pre.classList.toggle('text-wrap', wordWrapEnabled);
        wrapBtn.classList.toggle('active', wordWrapEnabled);
        localStorage.setItem('textViewerWordWrap', String(wordWrapEnabled));
      });

      lineNumBtn.addEventListener('click', () => {
        lineNumbersEnabled = !lineNumbersEnabled;
        lineNumBtn.classList.toggle('active', lineNumbersEnabled);
        localStorage.setItem('textViewerLineNumbers', String(lineNumbersEnabled));
        renderContent();
      });

      if (renderToggleBtn) {
        renderToggleBtn.addEventListener('click', () => {
          renderMode = !renderMode;
          renderToggleBtn.classList.toggle('active', renderMode);
          renderContent();
        });
      }

      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(text);
          copyBtn.innerHTML = '<i class="fa fa-check"></i>';
          setTimeout(() => {
            copyBtn.innerHTML = '<i class="fa fa-copy"></i>';
          }, 1500);
        } catch {
          // Fallback
          const textarea = document.createElement('textarea');
          textarea.value = text;
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
          copyBtn.innerHTML = '<i class="fa fa-check"></i>';
          setTimeout(() => {
            copyBtn.innerHTML = '<i class="fa fa-copy"></i>';
          }, 1500);
        }
      });

      // Keyboard shortcuts within fullscreen
      const keyHandler = (e) => {
        if (e.key === '+' || e.key === '=') updateFontSize(currentFontSize + 2);
        else if (e.key === '-') updateFontSize(currentFontSize - 2);
        else if (e.key === 'w' || e.key === 'W') wrapBtn.click();
      };
      document.addEventListener('keydown', keyHandler);

      return {
        type: 'text',
        element: wrapper,
        cleanup: () => {
          document.removeEventListener('keydown', keyHandler);
        }
      };
    } catch (error) {
      console.error(`Error loading text fullscreen for ${model.name}:`, error);
      const errorMessage = document.createElement('div');
      errorMessage.className = 'error-message';
      errorMessage.textContent = `Error loading text file: ${error.message}`;
      container.innerHTML = '';
      container.appendChild(errorMessage);

      return {
        element: errorMessage,
        cleanup: () => {}
      };
    }
  }

  createToolbarSeparator() {
    const sep = document.createElement('span');
    sep.className = 'text-toolbar-separator';
    return sep;
  }
}
