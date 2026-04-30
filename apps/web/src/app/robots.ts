import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/admin/',
          '/portal',
          '/portal/',
          '/api/',
          '/auth/',
          '/share/', // scoped share links should not be indexed
        ],
        // Polite throttle for crawlers that honour it (Bing, Yandex,
        // OAI-SearchBot, ClaudeBot — Googlebot ignores). With the
        // Cloudflare proxy off, every bot pageview triggers ~10-15
        // /_next/image fetches against origin; 2 s between hits keeps
        // the per-bot CPU tax reasonable without hurting indexing.
        crawlDelay: 2,
      },
      // Be a little more permissive for known crawlers so sitelinks/search surface
      {
        userAgent: ['Googlebot', 'Bingbot'],
        allow: '/',
        disallow: ['/admin', '/portal', '/api/', '/auth/', '/share/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
