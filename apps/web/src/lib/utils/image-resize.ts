/**
 * Client-side image downscaling before upload.
 *
 * Why: phone cameras produce 4–12 MB JPEGs at 4000+ pixels per side. Most
 * of those bytes are wasted — property cards render at ≤1024 px and even
 * the property hero doesn't need more than ~2400 px on desktop. Sending
 * the original eats bandwidth, server CPU (multer + sharp resizing), R2
 * storage, and Cloudflare egress. Worse, on a 1 vCPU container under
 * load (or under previous attack), each upload took 2–10 seconds because
 * sharp had to process the full file.
 *
 * Doing the resize in the browser before the network hop:
 * - cuts upload bandwidth by ~70-80% on phone uploads
 * - cuts server-side sharp time per upload by ~70%
 * - makes the upload feel ~3× faster from the user's perspective
 *
 * Falls back to the original file if:
 * - it isn't an image type we can handle
 * - it's already small enough
 * - the browser doesn't support `createImageBitmap` / `OffscreenCanvas`
 *   (extremely rare in 2026 — every Chromium/Firefox/Safari since 2020)
 *
 * Output is always JPEG quality 0.85 — visually indistinguishable from
 * the source for property photography while being ~3× smaller than the
 * camera's typical JPEG default.
 */

const RESIZABLE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic', // iOS often presents these
  'image/heif',
])

const DEFAULT_MAX_EDGE = 2400 // px — bigger than every common viewport
const DEFAULT_QUALITY = 0.85 // JPEG quality 1=best 0=worst

export async function downscaleForUpload(
  file: File,
  maxEdge: number = DEFAULT_MAX_EDGE,
  quality: number = DEFAULT_QUALITY,
): Promise<File> {
  // Bail-out paths: we only resize images we can decode + reasonable sizes
  if (!RESIZABLE_TYPES.has(file.type)) return file
  if (typeof createImageBitmap !== 'function') return file
  if (typeof OffscreenCanvas !== 'function') return file

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    // Some HEIC files fail decode in browsers without HEIC support —
    // let the server handle them.
    return file
  }

  try {
    const longest = Math.max(bitmap.width, bitmap.height)
    if (longest <= maxEdge) {
      // Already small. Don't re-encode (lossy round-trip would only hurt).
      return file
    }

    const scale = maxEdge / longest
    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)

    const canvas = new OffscreenCanvas(w, h)
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    // High-quality downscale — defaults vary by browser, this is the
    // chunkiest setting universally.
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0, w, h)

    const blob = await canvas.convertToBlob({
      type: 'image/jpeg',
      quality,
    })

    // Preserve original name but force .jpg extension since we re-encoded
    const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], newName, {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    })
  } finally {
    bitmap.close()
  }
}
