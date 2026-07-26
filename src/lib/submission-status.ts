import type { StatusSPPTG } from '@/types';

/** Statuses a draft may carry into a submission via Step 3. */
export const DECIDABLE_STATUSES = [
  'SPPTG terdata',
  'SPPTG terdaftar',
  'SPPTG ditolak',
  'SPPTG ditinjau ulang',
] as const;

export type DraftStatusPayload = {
  status?: string;
  /** Step 4 (Terbitkan SPPTG) results */
  nomorSPPTG?: string;
  tanggalTerbit?: string;
  dokumenSPPTG?: { documentId?: number } | null;
};

/**
 * The status a submission should be created with.
 *
 * A completed Step 4 (certificate number + issue date + uploaded SPPTG
 * document) keeps the submission under 'SPPTG terdaftar': issuing the
 * certificate is the outcome of being approved, not a separate bucket in the
 * dashboard. Issuance itself stays observable via the certificate number and
 * the uploaded SPPG document.
 *
 * Otherwise the Step 3 decision applies, falling back to 'SPPTG terdata' when
 * the draft carries nothing valid.
 */
export function deriveSubmissionStatus(payload: DraftStatusPayload): StatusSPPTG {
  const isIssued = Boolean(
    payload.nomorSPPTG?.trim() && payload.tanggalTerbit && payload.dokumenSPPTG
  );
  if (isIssued) return 'SPPTG terdaftar';

  const decided = DECIDABLE_STATUSES.find((s) => s === payload.status);
  return decided ?? 'SPPTG terdata';
}
