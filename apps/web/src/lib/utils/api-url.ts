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
 * Rewrites R2 public URLs to use the backend proxy.
 * Old files stored with pub-*.r2.dev URLs will be proxied through /api/files/*.
 * New files already use the proxy URL.
 */
export function normalizeFileUrl(url: string): string {
  if (!url) return url;

  // Match R2 public URL pattern: https://pub-*.r2.dev/path/to/file
  const r2Match = url.match(/^https:\/\/pub-[a-f0-9]+\.r2\.dev\/(.+)$/);
  if (r2Match) {
    const key = r2Match[1];
    const apiBase = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL);
    return `${apiBase}/api/files/${key}`;
  }

  return url;
}

