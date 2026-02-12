// CredentialStore.js - localStorage-based credential management for cloud storage

const S3_KEY = 'dave_s3_credentials';       // legacy single-credential key
const S3_PROFILES_KEY = 'dave_s3_profiles'; // new multi-profile key
const S3_DEFAULT_KEY = 'dave_s3_default_profile';
const GDRIVE_KEY = 'dave_gdrive_config';

function maskString(str) {
  if (!str || str.length <= 8) return '****';
  return str.substring(0, 4) + '****' + str.substring(str.length - 4);
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export const CredentialStore = {
  // ── S3 Profiles ──

  /** Migrate legacy single-credential to profiles array (one-time) */
  _migrateS3() {
    const existing = localStorage.getItem(S3_PROFILES_KEY);
    if (existing) return; // already migrated

    const legacy = localStorage.getItem(S3_KEY);
    if (!legacy) return; // nothing to migrate

    try {
      const creds = JSON.parse(legacy);
      const profile = {
        id: generateId(),
        label: creds.bucket || 'Default',
        accessKeyId: creds.accessKeyId,
        secretAccessKey: creds.secretAccessKey,
        region: creds.region || 'eu-central-1',
        bucket: creds.bucket || ''
      };
      localStorage.setItem(S3_PROFILES_KEY, JSON.stringify([profile]));
      localStorage.setItem(S3_DEFAULT_KEY, profile.id);
      localStorage.removeItem(S3_KEY);
    } catch { /* ignore corrupt data */ }
  },

  getS3Profiles() {
    this._migrateS3();
    const raw = localStorage.getItem(S3_PROFILES_KEY);
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
  },

  getS3Profile(id) {
    return this.getS3Profiles().find(p => p.id === id) || null;
  },

  saveS3Profile(profile) {
    this._migrateS3();
    const profiles = this.getS3Profiles();

    if (!profile.accessKeyId || !profile.secretAccessKey) {
      throw new Error('Access Key ID and Secret Access Key are required');
    }

    const entry = {
      id: profile.id || generateId(),
      label: (profile.label || profile.bucket || 'Untitled').trim(),
      accessKeyId: profile.accessKeyId.trim(),
      secretAccessKey: profile.secretAccessKey.trim(),
      region: (profile.region || 'eu-central-1').trim(),
      bucket: (profile.bucket || '').trim()
    };

    const idx = profiles.findIndex(p => p.id === entry.id);
    if (idx >= 0) {
      profiles[idx] = entry;
    } else {
      profiles.push(entry);
    }

    localStorage.setItem(S3_PROFILES_KEY, JSON.stringify(profiles));

    // Auto-set default if this is the first profile
    if (profiles.length === 1) {
      localStorage.setItem(S3_DEFAULT_KEY, entry.id);
    }

    return entry;
  },

  deleteS3Profile(id) {
    const profiles = this.getS3Profiles().filter(p => p.id !== id);
    localStorage.setItem(S3_PROFILES_KEY, JSON.stringify(profiles));

    // Clear default if it was the deleted profile
    if (this.getDefaultS3ProfileId() === id) {
      localStorage.setItem(S3_DEFAULT_KEY, profiles.length > 0 ? profiles[0].id : '');
    }
  },

  getDefaultS3ProfileId() {
    this._migrateS3();
    return localStorage.getItem(S3_DEFAULT_KEY) || '';
  },

  setDefaultS3ProfileId(id) {
    localStorage.setItem(S3_DEFAULT_KEY, id);
  },

  /** Legacy shim: returns the default profile's credentials (or first profile) */
  getS3Credentials() {
    const profiles = this.getS3Profiles();
    if (profiles.length === 0) return null;
    const defaultId = this.getDefaultS3ProfileId();
    return profiles.find(p => p.id === defaultId) || profiles[0];
  },

  /** Legacy shim: saves as a new profile or updates the default */
  saveS3Credentials({ accessKeyId, secretAccessKey, region, bucket }) {
    const profiles = this.getS3Profiles();
    const defaultId = this.getDefaultS3ProfileId();
    const existing = profiles.find(p => p.id === defaultId);

    if (existing) {
      existing.accessKeyId = accessKeyId;
      existing.secretAccessKey = secretAccessKey;
      existing.region = region;
      existing.bucket = bucket;
      this.saveS3Profile(existing);
    } else {
      this.saveS3Profile({ accessKeyId, secretAccessKey, region, bucket, label: bucket || 'Default' });
    }
  },

  clearS3Credentials() {
    localStorage.removeItem(S3_PROFILES_KEY);
    localStorage.removeItem(S3_DEFAULT_KEY);
    localStorage.removeItem(S3_KEY); // also clean legacy
  },

  // ── Google Drive config ──

  getGDriveConfig() {
    const raw = localStorage.getItem(GDRIVE_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  },

  saveGDriveConfig({ clientId }) {
    if (!clientId) {
      throw new Error('Client ID is required');
    }
    localStorage.setItem(GDRIVE_KEY, JSON.stringify({
      clientId: clientId.trim()
    }));
  },

  clearGDriveConfig() {
    localStorage.removeItem(GDRIVE_KEY);
  },

  // ── Status ──

  getStatus() {
    const profiles = this.getS3Profiles();
    const defaultProfile = this.getS3Credentials();
    const gdrive = this.getGDriveConfig();
    return {
      s3: {
        configured: profiles.length > 0,
        profileCount: profiles.length,
        region: defaultProfile?.region || '',
        bucket: defaultProfile?.bucket || '',
        accessKeyHint: defaultProfile ? maskString(defaultProfile.accessKeyId) : ''
      },
      gdrive: {
        credentialsConfigured: !!gdrive
      }
    };
  }
};
