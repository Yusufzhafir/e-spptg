import type { SPPTGPDFData } from './types';

/**
 * Where each sheet sits in the certificate, and how many there are.
 *
 * The footer cannot count pages for itself (see `DocumentFooter`), so the layout
 * has to be fixed rather than emergent. That is also why the terdata disclosure
 * notice gets its **own** page instead of trailing the signatures: inline, it
 * fitted under one saksi but pushed onto a fifth sheet under four, and the
 * footer went on insisting "Halaman 3 dari 4" on page four of five.
 */
type VariantLike = Pick<SPPTGPDFData, 'variant'>;

export const PAGE_STATEMENTS_START = 1;
export const PAGE_STATEMENTS_CONT = 2;
export const PAGE_SIGNATURES = 3;
/** Terdata only; the map moves down one to make room. */
export const PAGE_TERDATA_NOTICE = 4;

export function isTerdataCertificate(data: VariantLike): boolean {
  return data.variant === 'terdata';
}

export function totalCertificatePages(data: VariantLike): number {
  return isTerdataCertificate(data) ? 5 : 4;
}

export function mapPageNumber(data: VariantLike): number {
  return isTerdataCertificate(data) ? 5 : 4;
}
