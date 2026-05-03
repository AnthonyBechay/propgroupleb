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
export function normalizeFileUrl(url: string): string {
  if (!url) return url;

  const r2Public = process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.replace(/\/$/, '');

  // Match the legacy R2 public URL form: https://pub-<hex>.r2.dev/<key>
  const directR2Match = url.match(/^https:\/\/pub-[a-f0-9]+\.r2\.dev\/(.+)$/);

  // Match our backend proxy form: <whatever>/api/files/<key>
  const proxyMatch = url.match(/^(?:https?:\/\/[^/]+)?\/api\/files\/(.+)$/);

  if (r2Public) {
    // Mode A: prefer direct R2.
    if (proxyMatch) return `${r2Public}/${proxyMatch[1]}`;
    if (directR2Match) return `${r2Public}/${directR2Match[1]}`;
    return url;
  }

  // Mode B: route everything through backend proxy.
  if (directR2Match) {
    const key = directR2Match[1];
    const apiBase = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL);
    return `${apiBase}/api/files/${key}`;
  }
  // Also rewrite stale proxy URLs with a different host (e.g. api.bechays.com
  // → api.propgrp.com). These come from DB rows written before the domain
  // migration. The proxyMatch regex captures any host, so we just swap in the
  // current API base and keep the key path intact.
  if (proxyMatch) {
    const key = proxyMatch[1];
    const apiBase = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL);
    return `${apiBase}/api/files/${key}`;
  }
  return url;
}

