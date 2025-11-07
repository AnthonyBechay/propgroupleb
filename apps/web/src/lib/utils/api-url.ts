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
 * Gets the full API URL for an endpoint
 * @param endpoint - The API endpoint (should start with /api/)
 * @returns Full URL
 */
export function getApiUrl(endpoint: string): string {
  const baseUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL);
  // Ensure endpoint starts with /
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${baseUrl}${normalizedEndpoint}`;
}

