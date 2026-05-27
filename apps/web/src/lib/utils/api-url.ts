/**
 * Normalizes API URL to ensure it doesn't have double /api/ prefix
 * @param url - The API URL from environment variable
 * @returns Normalized URL without trailing /api
 */
export function normalizeApiUrl(url?: string): string {
  if (!url) {
    return typeof window !== 'undefined' && window.location.hostname !== 'localhost'
      ? '' // Use relative URLs in production if API_URL not set
      : 'http://localhost:3001';
  }
  
  let normalized = url.trim();
  
  // Remove trailing /api/ or /api
  if (normalized.endsWith('/api/')) {
    normalized = normalized.slice(0, -5);
  } else if (normalized.endsWith('/api')) {
    normalized = normalized.slice(0, -4);
  }
  
  // Remove trailing slash
  if (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  
  return normalized;
}

/**
 * File URL normalisation, with two modes depending on whether
 * `NEXT_PUBLIC_R2_PUBLIC_URL` is set.
 *
 * **Mode A — direct R2 (preferred):**
 * If `NEXT_PUBLIC_R2_PUBLIC_URL` points at the public R2 bucket
 * (e.g. `https://pub-fc6e8f....r2.dev`), backend-proxy URLs of the form
 * `…/api/files/<key>` are rewritten to `${R2_PUBLIC_URL}/<key>`. The
 * browser then fetches images directly from Cloudflare R2 — no hop
 * through our backend container at all. With Cloudflare's CDN in front
 * of R2, this turns image traffic into edge-cache hits and offloads
 * ~80% of `/api/files/*` load that the origin used to handle.
 *
 * **Mode B — proxy through backend (legacy fallback):**
 * If the env var is unset, behaviour is unchanged: legacy
 * `https://pub-*.r2.dev/<key>` URLs are rewritten to use the backend
 * proxy form. This keeps the function backwards-compatible for any
 * deployment that hasn't wired the env var yet.
 *
 * Either way, "already-correct" URLs pass through untouched.
 */
/** Ensure a URL/host has an https:// scheme and no trailing slash. */
function ensureHttps(value: string): string {
  let v = value.trim().replace(/\/+$/, '');
  if (v.startsWith('//')) v = `https:${v}`;
  else if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
  return v;
}

export function normalizeFileUrl(url: string): string {
  if (!url) return url;

  // r2Public MUST be a fully-qualified https URL. The env var is frequently set without
  // a scheme (e.g. "assets.propgrouplb.com"), and concatenating that with a key produces
  // a protocol-less src that the browser resolves as a relative path → 404s like
  // `/admin/buildings/assets.propgrouplb.com/...`. Always force https.
  const r2PublicRaw = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  const r2Public = r2PublicRaw ? ensureHttps(r2PublicRaw) : undefined;

  // ── Step 1: prepend https:// to protocol-less input URLs ───────────────────
  // Old DB rows stored URLs without a scheme (e.g. "assets.propgrouplb.com/buildings/123.jpg"
  // or "pub-abc.r2.dev/foo.jpg"). Without a scheme the browser treats them as a relative
  // path. Detect "looks-like-a-hostname/path" and upgrade. Skip already-absolute / rooted.
  let working = url;
  const isAbsolute = /^https?:\/\//i.test(working);
  const isProtocolRelative = working.startsWith('//');
  const isRooted = working.startsWith('/');
  if (!isAbsolute && !isRooted) {
    if (isProtocolRelative) {
      working = `https:${working}`;
    } else if (/^[a-z0-9-]+(\.[a-z0-9-]+)+\//i.test(working)) {
      working = `https://${working}`;
    }
  }

  // ── Step 2: standard rewriting against R2 / proxy patterns ────────────────
  const directR2Match = working.match(/^https:\/\/pub-[a-f0-9]+\.r2\.dev\/(.+)$/);
  const proxyMatch = working.match(/^(?:https?:\/\/[^/]+)?\/api\/files\/(.+)$/);

  if (r2Public) {
    // Mode A: rewrite proxy / legacy-R2 URLs to the custom CDN domain.
    if (proxyMatch) return `${r2Public}/${proxyMatch[1]}`;
    if (directR2Match) return `${r2Public}/${directR2Match[1]}`;
    // Already on the CDN or some other absolute URL — return as-is (now https).
    return working;
  }

  // Mode B: route everything through backend proxy.
  if (directR2Match) {
    const key = directR2Match[1];
    const apiBase = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL);
    return `${apiBase}/api/files/${key}`;
  }
  if (proxyMatch) {
    const key = proxyMatch[1];
    const apiBase = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL);
    return `${apiBase}/api/files/${key}`;
  }
  return working;
}

