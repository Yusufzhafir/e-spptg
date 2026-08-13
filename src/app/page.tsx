import type { Metadata } from 'next';
import { LandingPage } from '@/components/LandingPage';
import { RedirectSignedInHome } from '@/components/RedirectSignedInHome';
import { landingStructuredData } from '@/lib/structured-data';
import { SITE_META_DESCRIPTION, SITE_TITLE } from '@/lib/site';
import { getLandingStats } from '@/server/landing-stats';

/**
 * The landing page is a **server component on purpose**.
 *
 * It used to be a client component that rendered a spinner until `auth.me`
 * resolved, which meant the prerendered HTML contained no heading and no copy at
 * all — search engines and link previews saw an empty page. Signing-in visitors
 * are redirected by `src/proxy.ts` before this HTML is ever sent, so the page
 * does not need to guard the render itself; `<RedirectSignedInHome />` is only a
 * client-side safety net and renders nothing.
 */
export const metadata: Metadata = {
  // `absolute` so the root page is not titled "… | SIAPTAH" twice over.
  title: { absolute: SITE_TITLE },
  description: SITE_META_DESCRIPTION,
  alternates: { canonical: '/' },
  keywords: [
    'SPPTG',
    'Surat Pernyataan Penguasaan Tanah Garapan',
    'SIAPTAH',
    'administrasi pertanahan',
    'Kutai Timur',
    'pendaftaran tanah',
    'pemerintah kabupaten Kutai Timur',
  ],
};

/**
 * The page stays **prerendered**, just with a 15-minute lifetime instead of
 * forever, so the public statistics section ships inside the HTML rather than
 * arriving later over the network.
 *
 * A per-request read would be wrong twice over: it would put a database query in
 * front of every anonymous visitor (including crawlers), and it would drop the
 * page out of the static shell that makes the first paint fast. The numbers are
 * a recap, not a live counter — fifteen minutes of lag costs nothing.
 */
export const revalidate = 900;

export default async function HomePage() {
  // Never throws: `getLandingStats` returns null when the database is
  // unreachable, so a build with no DATABASE_URL still produces this page.
  const stats = await getLandingStats();

  return (
    <>
      <script
        type="application/ld+json"
        // The payload is built from constants in this repo, never from user
        // input, so there is nothing here for a visitor to inject into.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(landingStructuredData()) }}
      />
      <RedirectSignedInHome />
      <LandingPage stats={stats} />
    </>
  );
}
