const express = require('express');
const path = require('path');
const fs = require('fs');

// Load environment variables from .env at project root
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const PORT = process.env.PORT || 7777;
const app = express();

// JSON body parsing for API routes
app.use(express.json());

// CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Handle favicon
app.get('/favicon.ico', (req, res) => res.sendStatus(204));

// API routes (mounted before static files)
app.use('/api/s3', require('./routes/s3.cjs'));
app.use('/api/gdrive', require('./routes/gdrive.cjs'));
app.use('/api/config', require('./routes/config.cjs'));

// URL rewriting middleware (preserve existing behavior)
// When index.html references "styles/styles.css", it becomes "/styles/styles.css"
// We need to map these to "/src/styles/styles.css"
app.use((req, res, next) => {
  if (!req.path.startsWith('/src/') && !req.path.startsWith('/assets/')) {
    const srcResources = ['/styles/', '/core/', '/handlers/', '/utils/', '/shared/', '/viewers/', '/workers/', '/cloud/'];
    for (const resource of srcResources) {
      if (req.path.startsWith(resource)) {
        req.url = '/src' + req.url;
        break;
      }
    }
  }
  next();
});

// Static file serving from project root
app.use(express.static(path.join(__dirname, '..'), {
  setHeaders: (res, filePath) => {
    // Set proper MIME types for font files not covered by express.static defaults
    const ext = path.extname(filePath).toLowerCase();
    const extraMimes = {
      '.otf': 'font/otf',
      '.eot': 'application/vnd.ms-fontobject'
    };
    if (extraMimes[ext]) {
      res.setHeader('Content-Type', extraMimes[ext]);
    }
  }
}));

app.listen(PORT, () => {
  console.log(`DAVE server running at http://localhost:${PORT}/`);
  console.log(`Open http://localhost:${PORT}/ in your browser`);
});
