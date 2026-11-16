import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

/** robots.txt: let search engines read the public pages, keep them out of the app itself. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/app', '/api/'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
