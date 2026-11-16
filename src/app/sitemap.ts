import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

/** sitemap.xml: the public pages search engines should list. */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ['', '/signup', '/login', '/contact', '/privacy', '/terms', '/refund'];
  return pages.map(path => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: path === '' ? 'weekly' : 'monthly',
    priority: path === '' ? 1 : 0.5,
  }));
}
