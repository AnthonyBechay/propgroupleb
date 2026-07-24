/**
 * Custom next/image loader that offloads image resizing + format conversion to
 * Cloudflare's edge (the `/cdn-cgi/image/` Image Transformations endpoint)
 * instead of transcoding on the Next.js server.
 *
 * Why: on a self-hosted box the built-in Next optimizer resizes every image on
 * first request using the server's CPU, then caches per-instance. That first
 * hit is the slow part. Cloudflare does the same resize at the nearest edge POP,
 * caches it globally, and never touches your server — so images arrive fast and
 * your box stays free.
 *
 * Activated only when NEXT_PUBLIC_IMAGE_CDN=cloudflare (wired in next.config).
 * Requires "Image Transformations" enabled on the Cloudflare zone that fronts
 * your asset domain (NEXT_PUBLIC_R2_PUBLIC_URL). When the env flag is unset the
 * default Next optimizer is used and this file is never loaded.
 */
interface LoaderArgs {
  src: string
  width: number
  quality?: number
}

export default function cloudflareImageLoader({ src, width, quality }: LoaderArgs): string {
  // Data/blob URIs can't be edge-transformed — serve untouched.
  if (src.startsWith('data:') || src.startsWith('blob:')) return src

  const q = quality || 74
  // fit=scale-down never upscales; format=auto picks AVIF/WebP per the browser.
  const options = `width=${width},quality=${q},format=auto,fit=scale-down`

  const cdnRaw = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL || '').replace(/\/+$/, '')
  const cdnOrigin = cdnRaw ? (/^https?:\/\//i.test(cdnRaw) ? cdnRaw : `https://${cdnRaw}`) : ''

  // Same-origin rooted asset (e.g. /logo.png) → transform against the site origin.
  if (src.startsWith('/')) return `/cdn-cgi/image/${options}${src}`

  if (cdnOrigin) {
    // Cloudflare resizes most reliably when the source is a same-zone PATH
    // (not a full external URL, which needs an allow-list). Our images live on
    // the CDN zone, so strip the origin and pass just the path.
    if (src.startsWith(cdnOrigin)) {
      const path = src.slice(cdnOrigin.length) // includes leading "/"
      return `${cdnOrigin}/cdn-cgi/image/${options}${path}`
    }
    // Different host → fall back to the full-URL form.
    return `${cdnOrigin}/cdn-cgi/image/${options}/${src}`
  }

  // Loader on but no CDN configured — best effort against the current origin.
  return `/cdn-cgi/image/${options}/${src}`
}
