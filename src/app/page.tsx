import type { Metadata } from 'next';
import { LandingPage } from '@/components/LandingPage';
import { RedirectSignedInHome } from '@/components/RedirectSignedInHome';
import { landingStructuredData } from '@/lib/structured-data';
import { SITE_META_DESCRIPTION, SITE_TITLE } from '@/lib/site';

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

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        // The payload is built from constants in this repo, never from user
        // input, so there is nothing here for a visitor to inject into.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(landingStructuredData()) }}
      />
      <RedirectSignedInHome />
      <LandingPage />
    </>
  );
}
