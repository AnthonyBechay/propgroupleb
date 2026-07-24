/**
 * One-off maintenance: re-compress every image already stored in R2 with the
 * current (tighter) settings in upload.service. Safe to re-run — it overwrites
 * each object in place (same key → same URL, no DB changes) and only writes when
 * the recompressed result is actually smaller.
 *
 *   # dry run — report savings, change nothing
 *   pnpm --filter propgroup-backend run recompress:images -- --dry-run
 *
 *   # apply
 *   pnpm --filter propgroup-backend run recompress:images
 *
 * Needs the same R2_* env vars as the backend (loaded from apps/backend/.env).
 */
import 'dotenv/config';
import { ListObjectsV2Command, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, BUCKET_NAME, processImageBuffer } from '../services/upload.service.js';

const DRY_RUN = process.argv.includes('--dry-run');

const EXT_TO_TYPE: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.avif': 'image/avif',
};

function contentTypeFor(key: string): string | null {
  const dot = key.lastIndexOf('.');
  if (dot < 0) return null;
  return EXT_TO_TYPE[key.slice(dot).toLowerCase()] ?? null;
}

async function streamToBuffer(body: unknown): Promise<Buffer> {
  const chunks: Buffer[] = [];
  // Node.js Readable stream from the AWS SDK.
  for await (const chunk of body as AsyncIterable<Uint8Array>) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function main() {
  if (!BUCKET_NAME) throw new Error('R2_BUCKET_NAME is not set');
  console.log(`Recompressing images in bucket "${BUCKET_NAME}"${DRY_RUN ? ' (dry run)' : ''}…\n`);

  let token: string | undefined;
  let scanned = 0, processed = 0, skipped = 0, failed = 0;
  let bytesBefore = 0, bytesAfter = 0;

  do {
    const list = await s3Client.send(new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      ContinuationToken: token,
      MaxKeys: 1000,
    }));
    token = list.IsTruncated ? list.NextContinuationToken : undefined;

    for (const obj of list.Contents ?? []) {
      const key = obj.Key;
      if (!key) continue;
      const type = contentTypeFor(key);
      if (!type) { skipped++; continue; } // not a raster image (pdf, video, doc…)
      scanned++;

      try {
        const got = await s3Client.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
        const original = await streamToBuffer(got.Body);
        const optimized = await processImageBuffer(original, type);

        if (optimized.length >= original.length) {
          // Already optimal — leave it alone.
          bytesBefore += original.length; bytesAfter += original.length;
          continue;
        }

        bytesBefore += original.length;
        bytesAfter += optimized.length;
        const saved = (100 * (1 - optimized.length / original.length)).toFixed(0);
        console.log(`${DRY_RUN ? '[dry] ' : ''}${key}  ${(original.length / 1024).toFixed(0)}KB → ${(optimized.length / 1024).toFixed(0)}KB  (-${saved}%)`);

        if (!DRY_RUN) {
          await s3Client.send(new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            Body: optimized,
            ContentType: type,
            CacheControl: 'public, max-age=31536000, immutable',
          }));
        }
        processed++;
      } catch (err) {
        failed++;
        console.error(`  ✗ failed on ${key}:`, err instanceof Error ? err.message : err);
      }
    }
  } while (token);

  const savedMB = ((bytesBefore - bytesAfter) / 1024 / 1024).toFixed(1);
  const pct = bytesBefore > 0 ? (100 * (1 - bytesAfter / bytesBefore)).toFixed(1) : '0';
  console.log(`\nDone. Scanned ${scanned} images, ${DRY_RUN ? 'would rewrite' : 'rewrote'} ${processed}, skipped ${skipped} non-images, ${failed} failed.`);
  console.log(`Total: ${(bytesBefore / 1024 / 1024).toFixed(1)}MB → ${(bytesAfter / 1024 / 1024).toFixed(1)}MB  (saved ${savedMB}MB, -${pct}%).`);
  if (DRY_RUN) console.log('Dry run — nothing was written. Re-run without --dry-run to apply.');
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
