const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// ---------------------------------------------------------------------------
// SSE (Server-Sent Events) channel
// ---------------------------------------------------------------------------
const sseClients = new Set();
let commandQueue = [];
let commandId = 0;

router.get('/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  res.write('\n');

  const client = { id: Date.now(), res };
  sseClients.add(client);

  // Flush queued commands
  for (const cmd of commandQueue) {
    res.write(`data: ${JSON.stringify(cmd)}\n\n`);
  }
  commandQueue = [];

  req.on('close', () => sseClients.delete(client));
});

function broadcast(command) {
  const payload = { id: ++commandId, ...command, timestamp: Date.now() };
  if (sseClients.size === 0) {
    commandQueue.push(payload);
    return payload;
  }
  for (const client of sseClients) {
    client.res.write(`data: ${JSON.stringify(payload)}\n\n`);
  }
  return payload;
}

// ---------------------------------------------------------------------------
// POST /show — load files into Dave
// ---------------------------------------------------------------------------
router.post('/show', (req, res) => {
  const { files, fullscreen = -1, clear = true } = req.body;
  if (!Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: 'files array is required' });
  }

  // Validate each path exists
  const resolved = [];
  for (const f of files) {
    const abs = path.resolve(f);
    if (!fs.existsSync(abs)) {
      return res.status(404).json({ error: `File not found: ${f}` });
    }
    if (!fs.statSync(abs).isFile()) {
      return res.status(400).json({ error: `Not a file: ${f}` });
    }
    resolved.push(abs);
  }

  const payload = broadcast({ type: 'show', files: resolved, fullscreen, clear });
  res.json({ ok: true, commandId: payload.id, fileCount: resolved.length });
});

// ---------------------------------------------------------------------------
// POST /annotate — open annotation mode
// ---------------------------------------------------------------------------
router.post('/annotate', (req, res) => {
  const { fileIndex, tool, color } = req.body;
  const payload = broadcast({ type: 'annotate', fileIndex, tool, color });
  res.json({ ok: true, commandId: payload.id });
});

// ---------------------------------------------------------------------------
// POST /navigate — navigation and view control
// ---------------------------------------------------------------------------
router.post('/navigate', (req, res) => {
  const { action } = req.body;
  if (!action) {
    return res.status(400).json({ error: 'action is required' });
  }
  const payload = broadcast({ type: 'navigate', action });
  res.json({ ok: true, commandId: payload.id });
});

// ---------------------------------------------------------------------------
// GET /state — request current Dave state from the browser
// ---------------------------------------------------------------------------
const pendingStateResolvers = new Map();

router.get('/state', (req, res) => {
  const reqId = ++commandId;
  broadcast({ type: 'report_state', requestId: reqId });

  const timeout = setTimeout(() => {
    pendingStateResolvers.delete(reqId);
    res.status(504).json({ error: 'Browser did not respond in time' });
  }, 5000);

  pendingStateResolvers.set(reqId, { res, timeout });
});

router.post('/state-report', (req, res) => {
  const { requestId, state } = req.body;
  const pending = pendingStateResolvers.get(requestId);
  if (pending) {
    clearTimeout(pending.timeout);
    pendingStateResolvers.delete(requestId);
    pending.res.json(state);
  }
  res.sendStatus(200);
});

// ---------------------------------------------------------------------------
// GET /api/file?path= — serve a file from disk by absolute path
// ---------------------------------------------------------------------------
// Note: mounted separately in server.cjs as /api/file (not under /api/control)
// so we export it as a standalone middleware.
function fileHandler(req, res) {
  const filePath = req.query.path;
  if (!filePath) return res.status(400).json({ error: 'path parameter required' });

  const resolved = path.resolve(filePath);
  if (resolved.includes('\0')) return res.status(400).json({ error: 'Invalid path' });

  const blocked = ['/etc/', '/var/log/', '/proc/', '/sys/'];
  if (blocked.some(b => resolved.startsWith(b))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (!fs.existsSync(resolved)) return res.status(404).json({ error: 'File not found' });

  const stat = fs.statSync(resolved);
  if (!stat.isFile()) return res.status(400).json({ error: 'Not a file' });
  if (stat.size > 500 * 1024 * 1024) return res.status(413).json({ error: 'File too large (500MB max)' });

  res.sendFile(resolved);
}

module.exports = router;
module.exports.fileHandler = fileHandler;
