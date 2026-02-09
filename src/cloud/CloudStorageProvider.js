// CloudStorageProvider.js - Abstraction layer for cloud storage operations (client-side)

import { detectFileType } from '../utils/fileTypeDetector.js';
import { CredentialStore } from './CredentialStore.js';
import { S3Client } from './S3Client.js';
import { GDriveClient } from './GDriveClient.js';

// ── Singleton client instances (lazy-initialized) ──

let s3Client = null;
let s3ClientKeyId = null; // track which key we initialized with

let gdriveClient = null;

function getS3Client() {
  const creds = CredentialStore.getS3Credentials();
  if (!creds) throw new Error('S3 credentials not configured. Open Settings (gear icon) to add them.');
  // Reinitialize if credentials changed
  if (!s3Client || s3ClientKeyId !== creds.accessKeyId) {
    s3Client = new S3Client(creds);
    s3ClientKeyId = creds.accessKeyId;
  }
  return s3Client;
}

export function getGDriveClient() {
  if (!gdriveClient) {
    gdriveClient = new GDriveClient();
  }
  return gdriveClient;
}

// ── URL Parsing (unchanged) ──

/**
 * Parse an S3 console URL into bucket and prefix
 */
export function parseS3Url(url) {
  // AWS Console URL
  const consoleMatch = url.match(/console\.aws\.amazon\.com\/s3\/buckets\/([^?/]+)(?:\?[^]*prefix=([^&]*))?/);
  if (consoleMatch) {
    return {
      bucket: consoleMatch[1],
      prefix: decodeURIComponent(consoleMatch[2] || ''),
      region: (url.match(/region=([^&]+)/) || [])[1] || undefined
    };
  }

  // s3:// protocol
  const s3Match = url.match(/^s3:\/\/([^/]+)\/?(.*)$/);
  if (s3Match) {
    return { bucket: s3Match[1], prefix: s3Match[2] || '' };
  }

  // Virtual-hosted style
  const virtualMatch = url.match(/^https?:\/\/([^.]+)\.s3[.-]([^.]+)\.amazonaws\.com\/?(.*)$/);
  if (virtualMatch) {
    return { bucket: virtualMatch[1], prefix: virtualMatch[3] || '', region: virtualMatch[2] };
  }

  return null;
}

/**
 * Parse a Google Drive URL into a folder ID or file ID
 */
export function parseGDriveUrl(url) {
  const folderMatch = url.match(/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch) {
    return { type: 'folder', folderId: folderMatch[1] };
  }

  const fileMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) {
    return { type: 'file', fileId: fileMatch[1] };
  }

  return null;
}

/**
 * Check if a string is a cloud storage URL
 */
export function isCloudUrl(text) {
  if (!text || text.length < 10) return false;
  return !!(
    text.match(/console\.aws\.amazon\.com\/s3/i) ||
    text.match(/^s3:\/\//i) ||
    text.match(/\.s3[.-].*\.amazonaws\.com/i) ||
    text.match(/drive\.google\.com/i)
  );
}

/**
 * Detect cloud source from URL
 */
export function detectCloudSource(url) {
  if (url.match(/console\.aws\.amazon\.com\/s3/i) || url.match(/^s3:\/\//i) || url.match(/\.s3[.-].*\.amazonaws\.com/i)) {
    return 's3';
  }
  if (url.match(/drive\.google\.com/i)) {
    return 'gdrive';
  }
  return null;
}

// ── File Listing ──

export async function listFiles(source, params = {}) {
  if (source === 's3') {
    return listS3Files(params);
  } else if (source === 'gdrive') {
    return listGDriveFiles(params);
  }
  throw new Error(`Unknown cloud source: ${source}`);
}

async function listS3Files({ bucket, prefix = '' }) {
  const client = getS3Client();
  bucket = bucket || client.bucket;

  const result = await client.listObjects(prefix, '/', bucket);

  const folders = result.folders.map(p => {
    const name = p.replace(prefix, '').replace(/\/$/, '');
    return { name, path: p, type: 'directory' };
  });

  const files = result.contents
    .filter(obj => obj.key !== prefix && obj.size > 0)
    .map(obj => {
      const name = obj.key.split('/').pop();
      const typeInfo = detectFileType(name);
      if (!typeInfo) return null;
      return {
        name,
        file: null,
        type: typeInfo.type,
        subtype: typeInfo.subtype,
        fullPath: obj.key,
        size: obj.size,
        lastModified: new Date(obj.lastModified).getTime(),
        source: 's3',
        cloudKey: obj.key,
        cloudBucket: bucket
      };
    })
    .filter(Boolean);

  return { folders, files };
}

async function listGDriveFiles({ folderId = 'root' }) {
  const client = getGDriveClient();
  const data = await client.listFiles(folderId);

  const folders = data.items
    .filter(i => i.type === 'directory')
    .map(f => ({ name: f.name, id: f.id, type: 'directory' }));

  const files = data.items
    .filter(i => i.type === 'file')
    .map(f => {
      const typeInfo = detectFileType(f.name);
      if (!typeInfo) return null;
      return {
        name: f.name,
        file: null,
        type: typeInfo.type,
        subtype: typeInfo.subtype,
        fullPath: f.name,
        size: f.size,
        lastModified: new Date(f.modifiedTime).getTime(),
        source: 'gdrive',
        cloudFileId: f.id
      };
    })
    .filter(Boolean);

  return { folders, files };
}

// ── Recursive File Listing ──

export async function listFilesRecursive(source, params = {}) {
  if (source === 's3') {
    return listS3FilesRecursive(params);
  } else if (source === 'gdrive') {
    return listGDriveFilesRecursive(params);
  }
  throw new Error(`Unknown cloud source: ${source}`);
}

async function listS3FilesRecursive({ bucket, prefix = '', maxDepth = 'all' }) {
  const client = getS3Client();
  bucket = bucket || client.bucket;

  const result = await client.listObjectsRecursive(prefix, maxDepth, bucket);

  return result.files.map(obj => {
    const name = obj.key.split('/').pop();
    const typeInfo = detectFileType(name);
    if (!typeInfo) return null;
    return {
      name,
      file: null,
      type: typeInfo.type,
      subtype: typeInfo.subtype,
      fullPath: obj.key,
      size: obj.size,
      lastModified: new Date(obj.lastModified).getTime(),
      source: 's3',
      cloudKey: obj.key,
      cloudBucket: bucket
    };
  }).filter(Boolean);
}

async function listGDriveFilesRecursive({ folderId = 'root', maxDepth = 'all' }) {
  const client = getGDriveClient();
  const result = await client.listFilesRecursive(folderId, maxDepth);

  return result.files.map(f => {
    const typeInfo = detectFileType(f.name);
    if (!typeInfo) return null;
    return {
      name: f.name,
      file: null,
      type: typeInfo.type,
      subtype: typeInfo.subtype,
      fullPath: f.fullPath || f.name,
      size: f.size,
      lastModified: new Date(f.modifiedTime).getTime(),
      source: 'gdrive',
      cloudFileId: f.id
    };
  }).filter(Boolean);
}

// ── File URL Generation ──

export async function getFileUrl(model) {
  if (model.source === 's3') {
    const client = getS3Client();
    return client.generatePresignedUrl(model.cloudKey, 3600, model.cloudBucket);
  } else if (model.source === 'gdrive') {
    const client = getGDriveClient();
    return client.getFileObjectUrl(model.cloudFileId);
  }
  throw new Error(`Unknown cloud source: ${model.source}`);
}
