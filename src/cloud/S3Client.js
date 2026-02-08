// S3Client.js - Browser-based S3 client with AWS SigV4 signing via Web Crypto API

// ── Crypto helpers ──

const encoder = new TextEncoder();

function arrayBufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSHA256(key, message) {
  // key: ArrayBuffer, message: string → ArrayBuffer
  const cryptoKey = await crypto.subtle.importKey(
    'raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
}

async function sha256(message) {
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(message));
  return arrayBufferToHex(hash);
}

async function getSigningKey(secretKey, dateStamp, region, service) {
  const kDate = await hmacSHA256(encoder.encode('AWS4' + secretKey), dateStamp);
  const kRegion = await hmacSHA256(kDate, region);
  const kService = await hmacSHA256(kRegion, service);
  return hmacSHA256(kService, 'aws4_request');
}

// URI-encode per AWS rules (encode everything except unreserved chars)
function uriEncode(str, encodeSlash = true) {
  let encoded = '';
  for (const ch of str) {
    if ((ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z') ||
        (ch >= '0' && ch <= '9') || ch === '_' || ch === '-' || ch === '~' || ch === '.') {
      encoded += ch;
    } else if (ch === '/' && !encodeSlash) {
      encoded += ch;
    } else {
      const bytes = encoder.encode(ch);
      for (const byte of bytes) {
        encoded += '%' + byte.toString(16).toUpperCase().padStart(2, '0');
      }
    }
  }
  return encoded;
}

function getAmzDate() {
  const now = new Date();
  const date = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const dateStamp = date.substring(0, 8);
  return { amzDate: date, dateStamp };
}

// ── S3 XML response parser ──

function parseListResponse(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');

  // Check for error
  const errorCode = doc.querySelector('Error > Code');
  if (errorCode) {
    const errorMsg = doc.querySelector('Error > Message')?.textContent || 'Unknown S3 error';
    throw new Error(`S3 error (${errorCode.textContent}): ${errorMsg}`);
  }

  const folders = Array.from(doc.querySelectorAll('CommonPrefixes > Prefix'))
    .map(el => el.textContent);

  const contents = Array.from(doc.querySelectorAll('Contents')).map(el => ({
    key: el.querySelector('Key')?.textContent || '',
    size: parseInt(el.querySelector('Size')?.textContent || '0', 10),
    lastModified: el.querySelector('LastModified')?.textContent || ''
  }));

  const isTruncated = doc.querySelector('IsTruncated')?.textContent === 'true';
  const nextToken = doc.querySelector('NextContinuationToken')?.textContent || null;

  return { folders, contents, isTruncated, nextToken };
}

// ── S3Client class ──

export class S3Client {
  constructor({ accessKeyId, secretAccessKey, region, bucket }) {
    this.accessKeyId = accessKeyId;
    this.secretAccessKey = secretAccessKey;
    this.region = region || 'eu-central-1';
    this.bucket = bucket || '';
    this.service = 's3';
  }

  _getHost(bucket) {
    return `${bucket}.s3.${this.region}.amazonaws.com`;
  }

  _getEndpoint(bucket) {
    return `https://${this._getHost(bucket)}`;
  }

  // Sign a request with SigV4 (header-based auth)
  async _signHeaders(method, host, path, queryString, payloadHash) {
    const { amzDate, dateStamp } = getAmzDate();
    const credential = `${this.accessKeyId}/${dateStamp}/${this.region}/${this.service}/aws4_request`;

    // Canonical headers (must be sorted)
    const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

    // Canonical request
    const canonicalRequest = [
      method,
      path || '/',
      queryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join('\n');

    const canonicalRequestHash = await sha256(canonicalRequest);

    // String to sign
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      `${dateStamp}/${this.region}/${this.service}/aws4_request`,
      canonicalRequestHash
    ].join('\n');

    // Signature
    const signingKey = await getSigningKey(this.secretAccessKey, dateStamp, this.region, this.service);
    const signatureBuffer = await hmacSHA256(signingKey, stringToSign);
    const signature = arrayBufferToHex(signatureBuffer);

    return {
      'Authorization': `AWS4-HMAC-SHA256 Credential=${credential}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash
    };
  }

  // Make a signed GET request to S3
  async _request(bucket, queryParams = {}) {
    const host = this._getHost(bucket);
    const payloadHash = await sha256(''); // empty payload for GET

    // Build sorted query string
    const sortedParams = Object.entries(queryParams)
      .filter(([, v]) => v !== undefined && v !== null)
      .sort(([a], [b]) => a.localeCompare(b));
    const queryString = sortedParams
      .map(([k, v]) => `${uriEncode(k)}=${uriEncode(String(v))}`)
      .join('&');

    const authHeaders = await this._signHeaders('GET', host, '/', queryString, payloadHash);

    const url = `${this._getEndpoint(bucket)}/${queryString ? '?' + queryString : ''}`;

    let response;
    try {
      response = await fetch(url, { headers: authHeaders });
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error(
          'Cannot reach S3 bucket. This is likely a CORS issue. ' +
          'Configure CORS on your S3 bucket to allow requests from this origin. ' +
          'See Settings for instructions.'
        );
      }
      throw error;
    }

    const text = await response.text();
    if (!response.ok) {
      // Try to parse XML error
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'application/xml');
        const code = doc.querySelector('Code')?.textContent || '';
        const message = doc.querySelector('Message')?.textContent || response.statusText;
        if (code === 'InvalidAccessKeyId') throw new Error('Invalid AWS Access Key ID. Check your credentials in Settings.');
        if (code === 'SignatureDoesNotMatch') throw new Error('Invalid AWS Secret Key. Check your credentials in Settings.');
        if (code === 'AccessDenied') throw new Error('Access denied. Your IAM user may lack s3:ListBucket or s3:GetObject permissions.');
        throw new Error(`S3 error (${code}): ${message}`);
      } catch (e) {
        if (e.message.startsWith('S3 error') || e.message.startsWith('Invalid') || e.message.startsWith('Access denied')) throw e;
        throw new Error(`S3 request failed: ${response.status} ${response.statusText}`);
      }
    }

    return text;
  }

  // List objects at a prefix with delimiter (folder browsing)
  async listObjects(prefix = '', delimiter = '/', bucket = null) {
    bucket = bucket || this.bucket;
    if (!bucket) throw new Error('No S3 bucket specified. Configure one in Settings.');

    const allFolders = [];
    const allContents = [];
    let continuationToken = null;

    do {
      const params = {
        'list-type': '2',
        'prefix': prefix,
        'max-keys': '1000'
      };
      if (delimiter) params['delimiter'] = delimiter;
      if (continuationToken) params['continuation-token'] = continuationToken;

      const xmlText = await this._request(bucket, params);
      const result = parseListResponse(xmlText);

      allFolders.push(...result.folders);
      allContents.push(...result.contents);
      continuationToken = result.isTruncated ? result.nextToken : null;
    } while (continuationToken);

    return { folders: allFolders, contents: allContents };
  }

  // List all objects recursively (no delimiter), with optional depth limit
  async listObjectsRecursive(prefix = '', maxDepth = 'all', bucket = null) {
    bucket = bucket || this.bucket;
    if (!bucket) throw new Error('No S3 bucket specified. Configure one in Settings.');

    const depthLimit = maxDepth === 'all' ? Infinity : parseInt(maxDepth, 10) || Infinity;
    const allContents = [];
    let continuationToken = null;

    do {
      const params = {
        'list-type': '2',
        'prefix': prefix,
        'max-keys': '1000'
      };
      if (continuationToken) params['continuation-token'] = continuationToken;

      const xmlText = await this._request(bucket, params);
      const result = parseListResponse(xmlText);

      // Filter by depth
      for (const obj of result.contents) {
        if (obj.key === prefix || obj.size === 0) continue; // skip "folder" markers
        const relativePath = obj.key.substring(prefix.length);
        const depth = relativePath.split('/').filter(Boolean).length;
        if (depth <= depthLimit) {
          allContents.push(obj);
        }
      }

      continuationToken = result.isTruncated ? result.nextToken : null;
    } while (continuationToken);

    return { files: allContents };
  }

  // Generate a pre-signed URL (query-string auth) for GetObject
  async generatePresignedUrl(key, expiresIn = 3600, bucket = null) {
    bucket = bucket || this.bucket;
    const host = this._getHost(bucket);
    const { amzDate, dateStamp } = getAmzDate();
    const credential = `${this.accessKeyId}/${dateStamp}/${this.region}/${this.service}/aws4_request`;
    const signedHeaders = 'host';

    // URI-encode the key for the path (don't encode slashes)
    const encodedKey = uriEncode(key, false);
    const canonicalPath = '/' + encodedKey;

    // Query parameters for pre-signed URL (sorted)
    const queryParams = {
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': credential,
      'X-Amz-Date': amzDate,
      'X-Amz-Expires': String(expiresIn),
      'X-Amz-SignedHeaders': signedHeaders
    };

    const sortedParams = Object.entries(queryParams).sort(([a], [b]) => a.localeCompare(b));
    const queryString = sortedParams
      .map(([k, v]) => `${uriEncode(k)}=${uriEncode(v)}`)
      .join('&');

    // Canonical request for pre-signed URL
    const canonicalHeaders = `host:${host}\n`;
    const canonicalRequest = [
      'GET',
      canonicalPath,
      queryString,
      canonicalHeaders,
      signedHeaders,
      'UNSIGNED-PAYLOAD'
    ].join('\n');

    const canonicalRequestHash = await sha256(canonicalRequest);

    // String to sign
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      `${dateStamp}/${this.region}/${this.service}/aws4_request`,
      canonicalRequestHash
    ].join('\n');

    // Signature
    const signingKey = await getSigningKey(this.secretAccessKey, dateStamp, this.region, this.service);
    const signatureBuffer = await hmacSHA256(signingKey, stringToSign);
    const signature = arrayBufferToHex(signatureBuffer);

    return `https://${host}${canonicalPath}?${queryString}&X-Amz-Signature=${signature}`;
  }
}
