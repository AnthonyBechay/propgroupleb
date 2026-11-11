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
          '/preview/', // staff previews of hidden listings
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
        disallow: ['/admin', '/portal', '/api/', '/auth/', '/share/', '/preview/'],
      },
      // AI search and answer engines, by name. They were already allowed by
      // "*", but several only treat a site as opted-in when their own agent is
      // listed, and "*" also hands them the 2 s crawl delay. /llms.txt is the
      // page written for them.
      {
        userAgent: [
          'GPTBot', 'OAI-SearchBot', 'ChatGPT-User',
          'ClaudeBot', 'Claude-SearchBot', 'Claude-User',
          'PerplexityBot', 'Perplexity-User',
          'Google-Extended', 'Applebot-Extended', 'CCBot',
        ],
        allow: '/',
        disallow: ['/admin', '/portal', '/api/', '/auth/', '/share/', '/preview/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
