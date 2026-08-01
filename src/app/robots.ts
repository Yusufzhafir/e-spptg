import type { MetadataRoute } from 'next';
import { PRIVATE_PATH_PREFIXES, url } from '@/lib/site';

/**
 * Serves /robots.txt.
 *
 * The landing page is the only public surface; everything else is either behind
 * a login or a single-use auth step. Disallowing them keeps thin, duplicated
 * pages out of the index — and, for `/app`, keeps applicant data (nama, NIK,
 * alamat) from ever being reachable by a crawler that somehow held a session.
 *
 * A `Disallow` is a request, not a control: the real protection is
 * `protectedProcedure` in `src/trpc/init.ts`. The `X-Robots-Tag` header on
 * `/app/*` in next.config.ts is the enforcing half of this pair.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: PRIVATE_PATH_PREFIXES.map((prefix) => `${prefix}/`),
    },
    sitemap: url('/sitemap.xml'),
    host: url('/').replace(/\/$/, ''),
  };
}
