/**
 * Public identity of the site, shared by metadata, robots.txt, the sitemap and
 * the JSON-LD graph. Pure (no server imports) so client components can read it.
 *
 * `NEXT_PUBLIC_APP_URL` is the same variable the mailer builds email links from,
 * so the canonical host can never drift from the one people are sent to. It is
 * inlined at build time; when a build does not set it — the Docker image does
 * not have to — the production domain is the right default, never localhost.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL || 'https://siaptah.kutaitimurkab.go.id'
).replace(/\/+$/, '');

export const SITE_NAME = 'SIAPTAH';

export const SITE_TAGLINE = 'Sistem Informasi Administrasi Pertanahan';

/**
 * Spelled out on purpose: "SPPTG" alone is an acronym nobody searches for, and
 * the service is county-specific, so the place name belongs in the description
 * that search engines and link previews show.
 */
export const SITE_DESCRIPTION =
  'Layanan digital Pemerintah Kabupaten Kutai Timur untuk pendaftaran, verifikasi, dan penerbitan SPPTG (Surat Pernyataan Penguasaan Tanah Garapan) — pengajuan berkas, pemetaan batas lahan, dan pengecekan kawasan terlarang dalam satu alur.';

/** Absolute URL for a site-relative path, e.g. `url('/panduan')`. */
export function url(path = '/'): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Every route that is not the landing page sits behind a login or is a
 * transactional auth step. None of them belong in a search index, and listing
 * them in one place keeps robots.txt and the per-page `noindex` in agreement.
 */
export const PRIVATE_PATH_PREFIXES = [
  '/app',
  '/api',
  '/sign-in',
  '/sign-up',
  '/lupa-sandi',
  '/atur-ulang-sandi',
  '/verifikasi-email',
] as const;
