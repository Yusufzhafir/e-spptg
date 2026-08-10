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
 *
 * This is the *long* form. It is the right length for the JSON-LD graph and for
 * link-preview cards, which do not clip the way a search result does — see
 * `SITE_META_DESCRIPTION` for the tag Google actually truncates.
 */
export const SITE_DESCRIPTION =
  'Layanan digital Pemerintah Kabupaten Kutai Timur untuk pendaftaran, verifikasi, dan penerbitan SPPTG (Surat Pernyataan Penguasaan Tanah Garapan) — pengajuan berkas, pemetaan batas lahan, dan pengecekan kawasan terlarang dalam satu alur.'

/**
 * `<meta name="description">` only. Google clips around 160 characters, and the
 * long form above lost everything after "pengajuan berkas," — which is exactly
 * where its differentiators were. Keep this under 160.
 */
export const SITE_META_DESCRIPTION =
  'Layanan resmi Pemerintah Kabupaten Kutai Timur untuk mengajukan, memverifikasi, dan menerbitkan SPPTG — Surat Pernyataan Penguasaan Tanah Garapan.'

/**
 * Title for `/`. Google clips around 60 characters, and the previous 72-character
 * version dropped "Kabupaten Kutai Timur" — the geographic qualifier that decides
 * local intent — so the place name now sits at the front instead of the tail.
 */
export const SITE_TITLE = 'SPPTG Kutai Timur — SIAPTAH Administrasi Pertanahan'

/**
 * Contact details for the JSON-LD `GovernmentOrganization`.
 *
 * Left empty on purpose: a public service must not publish an invented address
 * or phone number, so every field below is omitted from the graph until someone
 * fills in the real value. Filling these in is what turns the organisation node
 * into a local-search signal.
 */
export const SITE_CONTACT = {
  /** e.g. 'Jl. ... No. ...' */
  streetAddress: '',
  addressLocality: 'Sangatta',
  addressRegion: 'Kalimantan Timur',
  postalCode: '',
  /** E.164, e.g. '+62549XXXXXXX' */
  telephone: '',
  email: '',
  /** Parent/related official sites, e.g. ['https://kutaitimurkab.go.id'] */
  sameAs: ['https://kutaitimurkab.go.id'],
} as const;

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
  // SSO handshake: the redirect URI Diskominfo registered, and the account-link
  // confirmation it can land on. Both are transactional and carry query state.
  '/callbacksso',
  '/sso',
] as const;
