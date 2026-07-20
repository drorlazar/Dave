#!/usr/bin/env node
/**
 * dave-helper.cjs — Tiny standalone file server for Dave remote control.
 * Zero dependencies. Run this locally so Dave (on GitHub Pages or localhost)
 * can load files from your disk and receive commands from Claude Code.
 *
 * Usage:
 *   node dave-helper.cjs                      # starts on port 7778
 *   node dave-helper.cjs --port 9000          # custom port
 *   node dave-helper.cjs --open /path/to/file # start + open Dave with file
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const PORT = getArg('--port', 7778);
const OPEN_FILE = getArg('--open', null);
const DAVE_URL = getArg('--dave', 'https://drorlazar.github.io/Dave/');

// ---------------------------------------------------------------------------
// SSE clients + command queue
// ---------------------------------------------------------------------------
const sseClients = new Set();
let commandQueue = [];
let commandId = 0;

function broadcast(command) {
  const payload = { id: ++commandId, ...command, timestamp: Date.now() };
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  if (sseClients.size === 0) {
    commandQueue.push(data);
    return payload;
  }
  for (const client of sseClients) client.write(data);
  return payload;
}

// ---------------------------------------------------------------------------
// State request/response
// ---------------------------------------------------------------------------
const pendingState = new Map();

// ---------------------------------------------------------------------------
// MIME types
// ---------------------------------------------------------------------------
const MIME = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp', '.ico': 'image/x-icon', '.tiff': 'image/tiff',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json',
  '.fbx': 'application/octet-stream', '.obj': 'text/plain',
  '.pdf': 'application/pdf', '.json': 'application/json',
  '.txt': 'text/plain', '.md': 'text/plain', '.csv': 'text/csv',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------
const server = http.createServer((req, res) => {
  // CORS — allow any origin (GitHub Pages, localhost, etc.)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // --- SSE channel ---
  if (pathname === '/api/control/events' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    res.write('\n');
    sseClients.add(res);
    // Flush queued commands
    for (const data of commandQueue) res.write(data);
    commandQueue = [];
    req.on('close', () => sseClients.delete(res));
    return;
  }

  // --- File serving ---
  if (pathname === '/api/file' && req.method === 'GET') {
    const filePath = url.searchParams.get('path');
    if (!filePath) return json(res, 400, { error: 'path parameter required' });
    const resolved = path.resolve(filePath);
    if (resolved.includes('\0')) return json(res, 400, { error: 'Invalid path' });
    const blocked = ['/etc/', '/var/log/', '/proc/', '/sys/'];
    if (blocked.some(b => resolved.startsWith(b))) return json(res, 403, { error: 'Access denied' });
    if (!fs.existsSync(resolved)) return json(res, 404, { error: 'File not found' });
    const stat = fs.statSync(resolved);
    if (!stat.isFile()) return json(res, 400, { error: 'Not a file' });
    if (stat.size > 500 * 1024 * 1024) return json(res, 413, { error: 'File too large' });
    const ext = path.extname(resolved).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(resolved).pipe(res);
    return;
  }

  // --- Command endpoints (POST with JSON body) ---
  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      let data = {};
      try { data = JSON.parse(body || '{}'); } catch { return json(res, 400, { error: 'Invalid JSON' }); }

      if (pathname === '/api/control/show') {
        if (!Array.isArray(data.files) || data.files.length === 0) {
          return json(res, 400, { error: 'files array is required' });
        }
        for (const f of data.files) {
          const abs = path.resolve(f);
          if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
            return json(res, 404, { error: `File not found: ${f}` });
          }
        }
        const resolved = data.files.map(f => path.resolve(f));
        const payload = broadcast({ type: 'show', files: resolved, fullscreen: data.fullscreen ?? -1, clear: data.clear ?? true });
        return json(res, 200, { ok: true, commandId: payload.id, fileCount: resolved.length });
      }

      if (pathname === '/api/control/annotate') {
        const payload = broadcast({ type: 'annotate', fileIndex: data.fileIndex, tool: data.tool, color: data.color });
        return json(res, 200, { ok: true, commandId: payload.id });
      }

      if (pathname === '/api/control/navigate') {
        if (!data.action) return json(res, 400, { error: 'action is required' });
        const payload = broadcast({ type: 'navigate', action: data.action });
        return json(res, 200, { ok: true, commandId: payload.id });
      }

      if (pathname === '/api/control/state-report') {
        const pending = pendingState.get(data.requestId);
        if (pending) {
          clearTimeout(pending.timeout);
          pendingState.delete(data.requestId);
          json(pending.res, 200, data.state);
        }
        return json(res, 200, {});
      }

      json(res, 404, { error: 'Not found' });
    });
    return;
  }

  // --- State request ---
  if (pathname === '/api/control/state' && req.method === 'GET') {
    const reqId = ++commandId;
    broadcast({ type: 'report_state', requestId: reqId });
    const timeout = setTimeout(() => {
      pendingState.delete(reqId);
      json(res, 504, { error: 'Browser did not respond in time' });
    }, 5000);
    pendingState.set(reqId, { res, timeout });
    return;
  }

  json(res, 404, { error: 'Not found' });
});

function json(res, status, obj) {
  if (res.writableEnded) return;
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

function getArg(flag, fallback) {
  const idx = args.indexOf(flag);
  if (idx === -1) return fallback;
  const val = args[idx + 1];
  return val !== undefined ? (typeof fallback === 'number' ? parseInt(val) : val) : fallback;
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
server.listen(PORT, () => {
  console.log(`Dave helper running at http://localhost:${PORT}`);
  console.log(`Dave UI: ${DAVE_URL}`);
  console.log('');
  console.log('Commands:');
  console.log(`  curl -X POST http://localhost:${PORT}/api/control/show -H 'Content-Type: application/json' -d '{"files":["/path/to/file.png"]}'`);
  console.log(`  curl http://localhost:${PORT}/api/control/state`);

  // Auto-open if --open flag provided
  if (OPEN_FILE) {
    const fileParam = encodeURIComponent(OPEN_FILE);
    const url = `${DAVE_URL}?server=localhost:${PORT}&file=${fileParam}`;
    console.log(`\nOpening: ${url}`);
    const { exec } = require('child_process');
    const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    exec(`${cmd} "${url}"`);
  }
});
