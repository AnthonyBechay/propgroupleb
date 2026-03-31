import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
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

  const url = `${PUBLIC_URL}/${key}`;
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

  const url = `${PUBLIC_URL}/${key}`;
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
 * Extract the R2 key from a full public URL
 */
export function extractKeyFromUrl(url: string): string | null {
  if (!PUBLIC_URL || !url.startsWith(PUBLIC_URL)) return null;
  return url.replace(`${PUBLIC_URL}/`, '');
}
