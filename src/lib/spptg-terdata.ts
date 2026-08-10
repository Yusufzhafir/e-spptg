import {
  normalizeProhibitedAreaType,
  PROHIBITED_AREA_TYPES,
  type ProhibitedAreaType,
} from '@/lib/prohibited-area-types';

/**
 * A SPPTG *terdata* is issued over land the overlap check already flagged, so
 * the certificate has to say so on its face: a yellow notice listing which
 * kawasan the parcel sits on, ticked from the overlap results.
 *
 * "Areal SPPT yang sudah terbit" is deliberately absent — an overlap with an
 * already-filed SPPTG is not something to disclose and carry on with, it stops
 * issuance outright (see `blockingSubmissionOverlaps`).
 */
export const TERDATA_OVERLAP_STATUSES = PROHIBITED_AREA_TYPES.filter(
  (type): type is Exclude<ProhibitedAreaType, 'Areal SPPT yang sudah terbit'> =>
    type !== 'Areal SPPT yang sudah terbit'
);

/** The shape every overlap result shares, whichever step produced it. */
export type OverlapLike = {
  jenisKawasan: string;
  namaKawasan?: string;
  sumber?: 'ProhibitedArea' | 'Submission' | null;
};

/**
 * Whether an overlap is with another filed pengajuan rather than a kawasan.
 *
 * `sumber` is the reliable signal; the `jenisKawasan` check backs up rows
 * written before it existed, where the status doubled as the type.
 */
export function isSubmissionOverlap(overlap: OverlapLike): boolean {
  return overlap.sumber === 'Submission' || overlap.jenisKawasan.startsWith('SPPTG ');
}

/**
 * Overlaps that stop a terdata certificate being issued at all.
 *
 * Sitting on a kawasan is what the yellow notice is *for* — it is disclosed and
 * the certificate still issues. Sitting on another SPPTG is a conflict between
 * two claims to the same ground, and no notice makes that publishable.
 */
export function blockingSubmissionOverlaps<T extends OverlapLike>(
  overlaps: T[] | undefined
): T[] {
  // Generic so callers keep their own row type: the wizard renders luasOverlap
  // from the result, and narrowing to OverlapLike would make it re-derive the
  // full rows by matching them back against this list.
  return (overlaps ?? []).filter(isSubmissionOverlap);
}

/**
 * The checklist rows to tick, matched by jenis kawasan.
 *
 * Normalised first: overlap results are a snapshot frozen when the check ran, so
 * a berkas checked before a jenis was renamed still carries the old spelling and
 * would otherwise tick nothing at all.
 *
 * An overlap whose jenis is genuinely off the list (a type retired from the
 * enum) ticks nothing — it is still printed in the pengajuan's own overlap
 * table, so it does not vanish from the record.
 */
export function checkedTerdataStatuses(overlaps: OverlapLike[] | undefined): string[] {
  const overlapping = new Set(
    (overlaps ?? [])
      .filter((overlap) => !isSubmissionOverlap(overlap))
      .map((overlap) => normalizeProhibitedAreaType(overlap.jenisKawasan))
  );

  return TERDATA_OVERLAP_STATUSES.filter((status) => overlapping.has(status));
}
