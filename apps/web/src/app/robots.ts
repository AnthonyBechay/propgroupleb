import type { MetadataRoute } from 'next'

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_ENV === 'production' ? 'https://bechays.com' : 'http://localhost:3000')

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
