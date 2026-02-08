const { S3Client, ListObjectsV2Command, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const express = require('express');
const router = express.Router();

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'eu-central-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const DEFAULT_BUCKET = process.env.AWS_DEFAULT_BUCKET || 'apollo-tasks';

// List objects and folders at a given prefix
router.get('/list', async (req, res) => {
  const { bucket = DEFAULT_BUCKET, prefix = '', delimiter = '/' } = req.query;
  try {
    let allFolders = [];
    let allFiles = [];
    let continuationToken = undefined;

    do {
      const command = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        Delimiter: delimiter,
        MaxKeys: 1000,
        ContinuationToken: continuationToken
      });
      const response = await s3Client.send(command);

      const folders = (response.CommonPrefixes || []).map(p => ({
        name: p.Prefix.replace(prefix, '').replace(/\/$/, ''),
        path: p.Prefix,
        type: 'directory'
      }));

      const files = (response.Contents || [])
        .filter(obj => obj.Key !== prefix && obj.Size > 0)
        .map(obj => ({
          name: obj.Key.split('/').pop(),
          key: obj.Key,
          size: obj.Size,
          lastModified: obj.LastModified,
          type: 'file'
        }));

      allFolders = allFolders.concat(folders);
      allFiles = allFiles.concat(files);
      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (continuationToken);

    res.json({ folders: allFolders, files: allFiles });
  } catch (error) {
    console.error('S3 list error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Generate a pre-signed URL for downloading an object
router.get('/signed-url', async (req, res) => {
  const { bucket = DEFAULT_BUCKET, key } = req.query;
  if (!key) return res.status(400).json({ error: 'key parameter is required' });

  try {
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    res.json({ url });
  } catch (error) {
    console.error('S3 signed-url error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Proxy file content through server (fallback for CORS issues)
router.get('/proxy', async (req, res) => {
  const { bucket = DEFAULT_BUCKET, key } = req.query;
  if (!key) return res.status(400).json({ error: 'key parameter is required' });

  try {
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const response = await s3Client.send(command);

    res.set({
      'Content-Type': response.ContentType || 'application/octet-stream',
      'Content-Length': response.ContentLength,
      'Content-Disposition': `inline; filename="${key.split('/').pop()}"`,
      'Cache-Control': 'public, max-age=3600'
    });

    response.Body.pipe(res);
  } catch (error) {
    console.error('S3 proxy error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get object metadata
router.get('/metadata', async (req, res) => {
  const { bucket = DEFAULT_BUCKET, key } = req.query;
  if (!key) return res.status(400).json({ error: 'key parameter is required' });

  try {
    const command = new HeadObjectCommand({ Bucket: bucket, Key: key });
    const response = await s3Client.send(command);
    res.json({
      contentType: response.ContentType,
      contentLength: response.ContentLength,
      lastModified: response.LastModified,
      etag: response.ETag
    });
  } catch (error) {
    console.error('S3 metadata error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// List all objects recursively (no folder delimiter)
router.get('/list-recursive', async (req, res) => {
  const { bucket = DEFAULT_BUCKET, prefix = '', maxDepth } = req.query;
  try {
    let allFiles = [];
    let continuationToken = undefined;

    // For S3 recursive listing, simply omit the Delimiter parameter
    // This returns ALL objects under the prefix regardless of "folder" depth
    do {
      const command = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        MaxKeys: 1000,
        ContinuationToken: continuationToken
      });
      const response = await s3Client.send(command);

      const files = (response.Contents || [])
        .filter(obj => obj.Key !== prefix && obj.Size > 0)
        .filter(obj => {
          // Apply maxDepth filter if specified
          if (maxDepth && maxDepth !== 'all') {
            const depth = parseInt(maxDepth);
            const relativePath = obj.Key.replace(prefix, '');
            const slashCount = (relativePath.match(/\//g) || []).length;
            return slashCount <= depth;
          }
          return true;
        })
        .map(obj => ({
          name: obj.Key.split('/').pop(),
          key: obj.Key,
          size: obj.Size,
          lastModified: obj.LastModified,
          type: 'file'
        }));

      allFiles = allFiles.concat(files);
      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (continuationToken);

    res.json({ files: allFiles });
  } catch (error) {
    console.error('S3 list-recursive error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
