import { NOMOR_SPPTG_PREFIX_TERDAFTAR, NOMOR_SPPTG_PREFIX_TERDATA } from '@/lib/nomor-spptg';

/**
 * What a berkas is called on screen, given the category it is stored under.
 *
 * The stored value for a certificate is `SPPG` — a typo of the domain term that
 * predates this code and is baked into the `document_category` enum, every row
 * already written, and the oversight-role check in `authz.ts`. Renaming it would
 * be an enum migration for a string nobody outside the database reads, so the
 * spelling is corrected here, at the one place it reaches a human.
 */
const CATEGORY_LABELS: Record<string, string> = {
  SPPG: 'SPPTG',
};

type CertificateContext = {
  /** The issued nomor, from the submission's payload snapshot. */
  nomorSPPTG?: unknown;
  /** The submission's current status, used only for pre-prefix records. */
  status?: unknown;
};

/**
 * Which certificate an `SPPG` document is, or null when nothing says.
 *
 * The nomor prefix is authoritative: it was fixed at issuance and travels with
 * the document. Status is only a fallback for records issued before the prefixes
 * existed — safe there because terdata could not reach Step 4 back then, so
 * every legacy certificate is a terdaftar one.
 */
function certificateVariant(context: CertificateContext | undefined): string | null {
  const nomor = typeof context?.nomorSPPTG === 'string' ? context.nomorSPPTG.toUpperCase() : '';

  if (nomor.startsWith(NOMOR_SPPTG_PREFIX_TERDATA)) return 'Terdata';
  if (nomor.startsWith(NOMOR_SPPTG_PREFIX_TERDAFTAR)) return 'Terdaftar';

  if (context?.status === 'SPPTG terdata') return 'Terdata';
  if (context?.status === 'SPPTG terdaftar') return 'Terdaftar';

  return null;
}

/**
 * Display label for a document category. Pass the submission context to have a
 * certificate name which of the two it is; without it the label stays the plain
 * category, never a guess.
 */
export function documentCategoryLabel(
  category: string,
  context?: CertificateContext
): string {
  const base = CATEGORY_LABELS[category] ?? category;
  if (category !== 'SPPG') return base;

  const variant = certificateVariant(context);
  return variant ? `${base} ${variant}` : base;
}
