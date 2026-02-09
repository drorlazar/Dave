// CredentialStore.js - localStorage-based credential management for cloud storage

const S3_KEY = 'dave_s3_credentials';

function maskString(str) {
  if (!str || str.length <= 8) return '****';
  return str.substring(0, 4) + '****' + str.substring(str.length - 4);
}

export const CredentialStore = {
  // ── S3 credentials ──

  getS3Credentials() {
    const raw = localStorage.getItem(S3_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  },

  saveS3Credentials({ accessKeyId, secretAccessKey, region, bucket }) {
    if (!accessKeyId || !secretAccessKey) {
      throw new Error('Access Key ID and Secret Access Key are required');
    }
    localStorage.setItem(S3_KEY, JSON.stringify({
      accessKeyId: accessKeyId.trim(),
      secretAccessKey: secretAccessKey.trim(),
      region: (region || 'eu-central-1').trim(),
      bucket: (bucket || '').trim()
    }));
  },

  clearS3Credentials() {
    localStorage.removeItem(S3_KEY);
  },

  // ── Status ──

  getStatus() {
    const s3 = this.getS3Credentials();
    return {
      s3: {
        configured: !!s3,
        region: s3?.region || '',
        bucket: s3?.bucket || '',
        accessKeyHint: s3 ? maskString(s3.accessKeyId) : ''
      },
      gdrive: {
        // Google Drive via Apps Script needs no stored credentials
        credentialsConfigured: true
      }
    };
  }
};
