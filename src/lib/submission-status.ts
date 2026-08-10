import { hasNomorSPPTGBody } from '@/lib/nomor-spptg';
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
 * **The Step 3 decision wins.** Both `terdaftar` and `terdata` can complete
 * Step 4, and the two issue visibly different certificates — a terdata berkas
 * that came back as `terdaftar` merely because a document was attached would
 * contradict the paper it just produced. Issuance stays observable through the
 * certificate number and the uploaded SPPG document, not through the status.
 *
 * A completed Step 4 only decides the outcome when no valid decision was
 * recorded at all; otherwise the fallback is 'SPPTG terdata'.
 */
export function deriveSubmissionStatus(payload: DraftStatusPayload): StatusSPPTG {
  const decided = DECIDABLE_STATUSES.find((s) => s === payload.status);
  if (decided) return decided;

  // `hasNomorSPPTGBody`, not a plain emptiness check: Step 4 seeds the mandatory
  // prefix into the field, so the bare prefix must not read as "issued".
  const isIssued = Boolean(
    hasNomorSPPTGBody(payload.nomorSPPTG) && payload.tanggalTerbit && payload.dokumenSPPTG
  );

  return isIssued ? 'SPPTG terdaftar' : 'SPPTG terdata';
}
