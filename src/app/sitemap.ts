import type { MetadataRoute } from 'next';
import { url } from '@/lib/site';

/**
 * Serves /sitemap.xml.
 *
 * One entry, and that is correct: the landing page is the only route that is
 * both public and worth indexing. Listing the auth pages here would contradict
 * robots.txt and the `noindex` they each carry.
 *
 * When public informational pages are added (panduan, FAQ, tentang), they go
 * here — that is the moment this file starts earning its keep.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: url('/'),
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1,
    },
  ];
}
