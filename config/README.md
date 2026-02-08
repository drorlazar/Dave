# Config Directory

This directory was used by the server-side cloud storage proxy (optional).

## Current Approach

Cloud storage credentials are now stored in the **browser's local storage** and managed via the in-app Settings UI (gear icon). No server is required.

See [docs/CLOUD_STORAGE.md](../docs/CLOUD_STORAGE.md) for setup instructions.

## Legacy Server Files (optional)

If you run DAVE with `node scripts/server.cjs`, this directory may contain:
- `gdrive-credentials.json` - Google OAuth client credentials
- `gdrive-tokens.json` - Auto-generated after Google Drive login

These files are gitignored and will not be committed.
