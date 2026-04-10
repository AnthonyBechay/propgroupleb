/**
 * Convert various Google Maps URL formats into an embeddable iframe URL.
 *
 * Supports:
 *  - https://www.google.com/maps/place/...
 *  - https://maps.app.goo.gl/...
 *  - https://www.google.com/maps/embed?pb=...  (already an embed — passthrough)
 *  - https://maps.google.com/?q=lat,lng
 *
 * If the URL can't be parsed, we fall back to a generic "q=" embed that
 * Google Maps will resolve on its end.
 */
export function toGoogleMapsEmbedUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null
  const trimmed = url.trim()
  if (!trimmed) return null

  // Already an embed URL — pass through
  if (trimmed.includes('/maps/embed')) {
    return trimmed
  }

  // Try to extract lat,lng from @lat,lng or ?q=lat,lng patterns
  const latLngMatch = trimmed.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
    || trimmed.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (latLngMatch) {
    const [, lat, lng] = latLngMatch
    return `https://maps.google.com/maps?q=${lat},${lng}&hl=en&z=15&output=embed`
  }

  // Fallback — let Google Maps resolve the full URL / short link / place name
  return `https://maps.google.com/maps?q=${encodeURIComponent(trimmed)}&hl=en&z=15&output=embed`
}
