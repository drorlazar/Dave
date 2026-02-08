const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const ENV_PATH = path.join(PROJECT_ROOT, '.env');
const CONFIG_DIR = path.join(PROJECT_ROOT, 'config');
const GDRIVE_CREDS_PATH = path.join(CONFIG_DIR, 'gdrive-credentials.json');

// Get current configuration status (never returns secrets, only whether they're configured)
router.get('/status', (req, res) => {
  const s3Configured = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
  const gdriveCredsExist = fs.existsSync(GDRIVE_CREDS_PATH);

  res.json({
    s3: {
      configured: s3Configured,
      region: process.env.AWS_REGION || '',
      bucket: process.env.AWS_DEFAULT_BUCKET || '',
      // Show masked key for confirmation (first 4 + last 4 chars)
      accessKeyHint: s3Configured ? maskString(process.env.AWS_ACCESS_KEY_ID) : ''
    },
    gdrive: {
      credentialsConfigured: gdriveCredsExist
    }
  });
});

// Save S3 configuration
router.post('/s3', (req, res) => {
  const { accessKeyId, secretAccessKey, region, bucket } = req.body;

  if (!accessKeyId || !secretAccessKey) {
    return res.status(400).json({ error: 'Access Key ID and Secret Access Key are required' });
  }

  try {
    // Read existing .env or start fresh
    let envContent = '';
    if (fs.existsSync(ENV_PATH)) {
      envContent = fs.readFileSync(ENV_PATH, 'utf8');
    }

    // Update or add each variable
    envContent = setEnvVar(envContent, 'AWS_ACCESS_KEY_ID', accessKeyId);
    envContent = setEnvVar(envContent, 'AWS_SECRET_ACCESS_KEY', secretAccessKey);
    envContent = setEnvVar(envContent, 'AWS_REGION', region || 'eu-central-1');
    envContent = setEnvVar(envContent, 'AWS_DEFAULT_BUCKET', bucket || 'apollo-tasks');

    fs.writeFileSync(ENV_PATH, envContent);

    // Update process.env immediately so the running server picks it up
    process.env.AWS_ACCESS_KEY_ID = accessKeyId;
    process.env.AWS_SECRET_ACCESS_KEY = secretAccessKey;
    process.env.AWS_REGION = region || 'eu-central-1';
    process.env.AWS_DEFAULT_BUCKET = bucket || 'apollo-tasks';

    // Reinitialize the S3 client with new credentials
    try {
      const s3Routes = require('./s3.cjs');
      // The S3 client will use the new env vars on next request
    } catch (e) {
      // Non-critical
    }

    res.json({ success: true, message: 'S3 configuration saved. The server is using the new credentials.' });
  } catch (error) {
    console.error('Error saving S3 config:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Save Google Drive credentials JSON
router.post('/gdrive', (req, res) => {
  const { credentials } = req.body;

  if (!credentials) {
    return res.status(400).json({ error: 'Credentials JSON is required' });
  }

  try {
    // Validate the credentials JSON structure
    let parsed;
    if (typeof credentials === 'string') {
      parsed = JSON.parse(credentials);
    } else {
      parsed = credentials;
    }

    const creds = parsed.installed || parsed.web;
    if (!creds || !creds.client_id || !creds.client_secret) {
      return res.status(400).json({ error: 'Invalid credentials format. Expected Google OAuth credentials JSON with client_id and client_secret.' });
    }

    // Ensure config directory exists
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }

    fs.writeFileSync(GDRIVE_CREDS_PATH, JSON.stringify(parsed, null, 2));

    res.json({ success: true, message: 'Google Drive credentials saved. You can now login via the Source menu.' });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return res.status(400).json({ error: 'Invalid JSON format. Please paste the complete credentials JSON from Google Cloud Console.' });
    }
    console.error('Error saving GDrive config:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Helper: set or replace a variable in .env content
function setEnvVar(content, key, value) {
  const regex = new RegExp(`^${key}=.*$`, 'm');
  const line = `${key}=${value}`;
  if (regex.test(content)) {
    return content.replace(regex, line);
  }
  return content.trim() + '\n' + line + '\n';
}

// Helper: mask a string showing first 4 and last 4 chars
function maskString(str) {
  if (!str || str.length <= 8) return '****';
  return str.substring(0, 4) + '****' + str.substring(str.length - 4);
}

module.exports = router;
