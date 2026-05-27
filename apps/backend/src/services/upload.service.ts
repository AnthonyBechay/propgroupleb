import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import path from 'path';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME || '';
const PUBLIC_URL = process.env.R2_PUBLIC_URL || '';

/** Ensure a URL/host has an https:// scheme and no trailing slash. */
function ensureAbsoluteHttps(value: string): string {
  let v = value.trim().replace(/\/$/, '');
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
  return v;
}

/**
 * Get the base URL for file access.
 * Uses NEXT_PUBLIC_API_URL env var if set, otherwise falls back to R2 public URL.
 * The /api/files/ proxy endpoint ensures files are always accessible.
 *
 * The result is **always** a fully-qualified https URL — never protocol-less,
 * never trailing-slashed. Stored values were silently broken before because
 * a misconfigured R2_PUBLIC_URL (e.g. just "assets.propgrouplb.com") flowed
 * straight through; browsers then treated those URLs as relative paths.
 */
function getFileBaseUrl(): string {
  // Prefer explicit API URL (e.g., https://api.propgrp.com).
  // Use API_URL (backend env var), NOT NEXT_PUBLIC_API_URL — that prefix is a
  // Next.js build-time convention and will be undefined in a plain Node/Express process.
  const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL;
  if (apiUrl) {
    // Strip trailing /api if present so we don't double-up
    const base = ensureAbsoluteHttps(apiUrl.replace(/\/api\/?$/, ''));
    return `${base}/api/files`;
  }
  // Fall back to R2 public URL (only works if R2.dev public access is enabled)
  if (PUBLIC_URL) {
    return ensureAbsoluteHttps(PUBLIC_URL);
  }
  // Dev fallback only — in production, silently returning a localhost URL
  // produces broken image links for every uploaded file. Fail loudly so the
  // misconfiguration is caught at first upload instead of after launch.
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Upload service misconfigured: set NEXT_PUBLIC_API_URL, API_URL, or R2_PUBLIC_URL in production'
    );
  }
  return 'http://localhost:3001/api/files';
}

/**
 * Sanitize a string for use in file paths (slug-like)
 */
function sanitizeForPath(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);
}

/**
 * Upload a file buffer to Cloudflare R2 with organized path structure
 *
 * Path strategy:
 *   buildings/{slug}/images/{timestamp}-{name}.ext                — building photos
 *   buildings/{slug}/documents/{doc-type}/{timestamp}-{name}.ext  — building documents
 *   properties/{slug}/images/{timestamp}-{name}.ext               — legacy property photos
 *   properties/{slug}/documents/{doc-type}/{timestamp}-{name}.ext — legacy property documents
 *   videos/{slug}/{timestamp}-{name}.ext                          — videos
 *   {folder}/{timestamp}-{name}.ext                               — fallback (documents, general, etc.)
 */
export async function uploadFile(
  buffer: Buffer,
  originalName: string,
  contentType: string,
  folder: string,
  options?: {
    propertySlug?: string;
    documentType?: string;
    customName?: string;
  }
): Promise<{ url: string; key: string }> {
  const ext = path.extname(originalName).toLowerCase();
  const baseName = options?.customName
    ? sanitizeForPath(options.customName)
    : sanitizeForPath(path.basename(originalName, ext));
  const timestamp = Date.now();
  const shortId = randomUUID().substring(0, 8);

  let key: string;

  if (options?.propertySlug) {
    const propSlug = sanitizeForPath(options.propertySlug);

    if (folder === 'documents' && options?.documentType) {
      const docType = sanitizeForPath(options.documentType);
      key = `properties/${propSlug}/documents/${docType}/${timestamp}-${baseName}-${shortId}${ext}`;
    } else if (folder === 'videos') {
      key = `properties/${propSlug}/videos/${timestamp}-${baseName}-${shortId}${ext}`;
    } else {
      // images / other property files
      key = `properties/${propSlug}/images/${timestamp}-${baseName}-${shortId}${ext}`;
    }
  } else {
    // Fallback for non-property uploads
    key = `${folder}/${timestamp}-${baseName}-${shortId}${ext}`;
  }

  // Sanitize filename for Content-Disposition to avoid R2 signature issues with special chars
  const safeFilename = path.basename(originalName).replace(/[^\w.\-]/g, '_');

  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ContentDisposition: `inline; filename="${safeFilename}"`,
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );

  const url = `${getFileBaseUrl()}/${key}`;
  return { url, key };
}

/**
 * Upload a file buffer to Cloudflare R2 (legacy — simple folder/uuid path)
 * Kept for backward compatibility
 */
export async function uploadFileSimple(
  buffer: Buffer,
  originalName: string,
  contentType: string,
  folder: string
): Promise<{ url: string; key: string }> {
  const ext = path.extname(originalName).toLowerCase();
  const key = `${folder}/${randomUUID()}${ext}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );

  const url = `${getFileBaseUrl()}/${key}`;
  return { url, key };
}

/**
 * Delete a file from Cloudflare R2
 */
export async function deleteFile(key: string): Promise<void> {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    })
  );
}

/**
 * Generate a signed URL for reading an object (valid for 1 hour)
 */
export async function getSignedFileUrl(key: string, expiresIn = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });
  return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Get the file stream from R2 for proxying.
 * Accepts an optional Range header (e.g. "bytes=0-1023") so the proxy
 * can forward byte-range requests — required for video seeking and
 * PDF byte-range loading in the browser.
 */
export async function getFileStream(key: string, range?: string) {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ...(range ? { Range: range } : {}),
  });
  return s3Client.send(command);
}

/**
 * Check if a file exists in R2
 */
export async function fileExists(key: string): Promise<boolean> {
  try {
    await s3Client.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract the R2 key from a full public URL or a proxied URL.
 * Returns null for external URLs (e.g. unsplash) that are not stored in R2.
 */
export function extractKeyFromUrl(url: string): string | null {
  // Handle R2 public URL / custom domain (e.g. https://assets.propgrouplb.com/<key>)
  if (PUBLIC_URL && url.startsWith(PUBLIC_URL)) {
    return url.slice(PUBLIC_URL.length).replace(/^\//, '');
  }
  // Also handle custom domain if R2_PUBLIC_URL wasn't set at delete time
  // but the URL was stored with the custom domain
  const customDomainMatch = url.match(/^https:\/\/assets\.propgrouplb\.com\/(.+)$/);
  if (customDomainMatch) return customDomainMatch[1];
  // Handle legacy r2.dev public URL
  const legacyR2Match = url.match(/^https:\/\/pub-[a-f0-9]+\.r2\.dev\/(.+)$/);
  if (legacyR2Match) return legacyR2Match[1];
  // Handle proxy URL format: …/api/files/<key>
  const proxyMatch = url.match(/\/api\/files\/(.+)$/);
  if (proxyMatch) return proxyMatch[1];
  // Handle raw R2 key format (no URL prefix, just path like "buildings/...")
  if (!url.startsWith('http') && !url.startsWith('/')) {
    return url;
  }
  return null;
}
