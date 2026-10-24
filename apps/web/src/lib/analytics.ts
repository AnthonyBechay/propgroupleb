import { normalizeApiUrl } from '@/lib/utils/api-url'

/**
 * First-party, cookie-free behavioural tracking.
 *
 * Generates an anonymous per-browser session id (localStorage) and posts
 * lightweight events to the backend. Fully best-effort: any failure is
 * swallowed so analytics can never break the page. No PII is collected here —
 * just the event type, the page path, and optional entity ids.
 */

export type AnalyticsEventType =
  | 'page_view'
  | 'listing_view'
  | 'listing_click'
  | 'inquiry_click'
  | 'phone_click'
  | 'whatsapp_click'
  | 'search'
  | 'favorite'

interface TrackPayload {
  path?: string
  listingId?: string
  buildingId?: string
  unitId?: string
  meta?: Record<string, unknown>
}

const SESSION_KEY = 'pg_sid'

function getSessionId(): string {
  try {
    let id = localStorage.getItem(SESSION_KEY)
    if (!id) {
      id = (crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`)
      localStorage.setItem(SESSION_KEY, id)
    }
    return id
  } catch {
    return ''
  }
}

const LANDED_KEY = 'pg_landed'

/**
 * Where this visit came from, once per visit: the page that linked here and
 * any utm tags. Sent only with the visit's first page view — that is the one
 * that answers "who sent them" (an AI assistant, a search, an ad).
 */
function landingInfo(): Record<string, string> | null {
  try {
    if (sessionStorage.getItem(LANDED_KEY)) return null
    sessionStorage.setItem(LANDED_KEY, '1')
  } catch {
    return null
  }
  const params = new URLSearchParams(window.location.search)
  const referrer = document.referrer && !document.referrer.startsWith(window.location.origin) ? document.referrer : ''
  return {
    referrer: referrer.slice(0, 300),
    utmSource: (params.get('utm_source') ?? '').slice(0, 100),
    utmMedium: (params.get('utm_medium') ?? '').slice(0, 100),
    utmCampaign: (params.get('utm_campaign') ?? '').slice(0, 100),
  }
}

export function track(type: AnalyticsEventType, payload: TrackPayload = {}): void {
  if (typeof window === 'undefined') return
  try {
    const landing = type === 'page_view' ? landingInfo() : null
    if (landing) payload = { ...payload, meta: { ...(payload.meta ?? {}), landing } }
    const apiBase = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
    const body = JSON.stringify({
      type,
      sessionId: getSessionId(),
      path: payload.path ?? window.location.pathname,
      listingId: payload.listingId,
      buildingId: payload.buildingId,
      unitId: payload.unitId,
      meta: payload.meta,
    })
    // keepalive lets the request complete even if the user navigates away.
    void fetch(`${apiBase}/api/analytics/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      credentials: 'include',
      keepalive: true,
    }).catch(() => {})
  } catch {
    // never throw from analytics
  }
}
