/**
 * Convert various Google Maps URL formats into an embeddable iframe URL.
 *
 * The "free" Google Maps embed (no API key) only works reliably with coordinates
 * or a very simple place query. Passing a full Google Maps URL as `q=` results
 * in a world map with "Some custom on-map content could not be displayed".
 *
 * Strategy:
 *   1. Already-embed URLs → pass through.
 *   2. Extract lat/lng from common Google Maps URL patterns:
 *        - /@lat,lng,zoom
 *        - !3dlat!4dlng
 *        - ?q=lat,lng  or  ?ll=lat,lng
 *        - data=...!3d...!4d...
 *   3. Short links (maps.app.goo.gl, goo.gl/maps) → resolve via redirect fetch.
 *   4. Fallback → treat the entire string as a place query.
 */

const LATLNG_PATTERNS: RegExp[] = [
  /@(-?\d+\.\d+),(-?\d+\.\d+)/,
  /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
  /[?&](?:q|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/,
  /\/(-?\d+\.\d+),(-?\d+\.\d+)/, // /lat,lng in path
]

function buildEmbedFromLatLng(lat: string, lng: string): string {
  return `https://maps.google.com/maps?q=${lat},${lng}&hl=en&z=15&output=embed`
}

function extractLatLng(url: string): { lat: string; lng: string } | null {
  for (const re of LATLNG_PATTERNS) {
    const m = url.match(re)
    if (m) return { lat: m[1], lng: m[2] }
  }
  return null
}

/**
 * Synchronous version — safe in client components.
 * Won't resolve short links, but handles direct URL patterns.
 */
export function toGoogleMapsEmbedUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null
  const trimmed = url.trim()
  if (!trimmed) return null

  if (trimmed.includes('/maps/embed')) return trimmed

  const coords = extractLatLng(trimmed)
  if (coords) return buildEmbedFromLatLng(coords.lat, coords.lng)

  // Last resort: only works for very simple strings, not full URLs
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://maps.google.com/maps?q=${encodeURIComponent(trimmed)}&hl=en&z=15&output=embed`
  }

  return null
}

/**
 * Async version — resolves short links (maps.app.goo.gl) by following redirects
 * on the server, then extracts coordinates from the resolved URL.
 * Safe to call in server components.
 */
export async function resolveGoogleMapsEmbedUrl(
  url: string | null | undefined
): Promise<string | null> {
  if (!url || typeof url !== 'string') return null
  const trimmed = url.trim()
  if (!trimmed) return null

  // Already an embed URL
  if (trimmed.includes('/maps/embed')) return trimmed

  // Try direct extraction first
  const direct = extractLatLng(trimmed)
  if (direct) return buildEmbedFromLatLng(direct.lat, direct.lng)

  // Short link → follow redirects to get the full URL, then extract
  const isShortLink = /(?:maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(trimmed)
  if (isShortLink) {
    try {
      const res = await fetch(trimmed, {
        method: 'GET',
        redirect: 'follow',
        // Pretend to be a browser so Google returns the full place page
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        },
      })
      const finalUrl = res.url
      const fromFinal = extractLatLng(finalUrl)
      if (fromFinal) return buildEmbedFromLatLng(fromFinal.lat, fromFinal.lng)

      // Some short links don't end on a coord-bearing URL, but the HTML body
      // contains an APP_INITIALIZATION_STATE with !3d!4d coords. Try body.
      const text = await res.text()
      const fromBody = extractLatLng(text)
      if (fromBody) return buildEmbedFromLatLng(fromBody.lat, fromBody.lng)
    } catch {
      // ignore — fall through to null
    }
  }

  return null
}
