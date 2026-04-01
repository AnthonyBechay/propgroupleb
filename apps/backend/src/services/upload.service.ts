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

/**
 * Get the base URL for file access.
 * Uses NEXT_PUBLIC_API_URL env var if set, otherwise falls back to R2 public URL.
 * The /api/files/ proxy endpoint ensures files are always accessible.
 */
function getFileBaseUrl(): string {
  // Prefer explicit API URL (e.g., https://api.bechays.com)
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL;
  if (apiUrl) {
    return `${apiUrl}/api/files`;
  }
  // Fall back to R2 public URL (only works if R2.dev public access is enabled)
  if (PUBLIC_URL) {
    return PUBLIC_URL;
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
 *   properties/{property-slug}/images/{timestamp}-{name}.ext     — property photos
 *   properties/{property-slug}/documents/{doc-type}/{timestamp}-{name}.ext — property documents
 *   videos/{property-slug}/{timestamp}-{name}.ext                 — property videos
 *   general/{folder}/{uuid}.ext                                   — fallback
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

  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ContentDisposition: `inline; filename="${path.basename(originalName)}"`,
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
 * Get the file stream from R2 for proxying
 */
export async function getFileStream(key: string) {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
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
 * Extract the R2 key from a full public URL or a proxied URL
 */
export function extractKeyFromUrl(url: string): string | null {
  // Handle R2 public URL format
  if (PUBLIC_URL && url.startsWith(PUBLIC_URL)) {
    return url.replace(`${PUBLIC_URL}/`, '');
  }
  // Handle proxy URL format: /api/files/properties/slug/images/file.jpg
  const proxyMatch = url.match(/\/api\/files\/(.+)$/);
  if (proxyMatch) return proxyMatch[1];
  return null;
}
