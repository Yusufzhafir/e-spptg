import { z } from 'zod';
import { isSubmissionOverlap, type OverlapLike } from './spptg-terdata';

const overlapRowSchema = z.object({
  kawasan_id: z.number().or(z.string()).transform((v) => Number(v)),
  nama_kawasan: z.string(),
  jenis_kawasan: z.string(),
  luas_overlap: z.number().nullable().transform((v) => (v === null ? 0 : Number(v))),
  percentage_overlap: z
    .number()
    .nullable()
    .optional()
    .transform((v) => (v === null ? undefined : Number(v))),
  sumber: z.enum(['ProhibitedArea', 'Submission']),
});

const overlapRowsSchema = z.array(overlapRowSchema);

export type NormalizedOverlapResult = {
  kawasanId: number;
  namaKawasan: string;
  jenisKawasan: string;
  luasOverlap: number;
  percentageOverlap?: number;
  sumber: 'ProhibitedArea' | 'Submission';
};

/**
 * Tailwind badge classes for the "Jenis" of an overlap result, colour-matched
 * to the map legend: SPPTG terdaftar = green, SPPTG terdata = blue,
 * Kawasan Non-SPPTG = red.
 */
export function overlapJenisBadgeClassName(overlap: {
  sumber?: 'ProhibitedArea' | 'Submission' | null;
  jenisKawasan: string;
}): string {
  const isSubmission =
    overlap.sumber === 'Submission' || overlap.jenisKawasan.startsWith('SPPTG ');
  if (isSubmission) {
    if (overlap.jenisKawasan === 'SPPTG terdaftar') {
      return 'bg-green-100 text-green-800 border-green-200';
    }
    if (overlap.jenisKawasan === 'SPPTG terdata') {
      return 'bg-blue-100 text-blue-800 border-blue-200';
    }
    return 'bg-gray-100 text-gray-700 border-gray-200';
  }
  // Kawasan Non-SPPTG (prohibited area)
  return 'bg-red-100 text-red-800 border-red-200';
}

/** How many overlaps came from a kawasan and how many from another pengajuan. */
export interface OverlapSummary {
  total: number;
  /** Overlaps with a Kawasan Non-SPPTG (prohibited area). */
  kawasan: number;
  /** Overlaps with an already-filed SPPTG. */
  spptg: number;
}

export function summariseOverlaps(
  overlaps: OverlapLike[] | undefined | null
): OverlapSummary {
  const list = overlaps ?? [];
  const spptg = list.filter(isSubmissionOverlap).length;
  return { total: list.length, kawasan: list.length - spptg, spptg };
}

/**
 * What the overlaps are *with*, in words.
 *
 * The wizard used to label every overlap "kawasan Non-SPPTG", so a berkas
 * clashing with a neighbour's already-issued SPPTG was reported as sitting on a
 * protected zone — two different problems with two different remedies. Anything
 * that announces a count has to go through here.
 */
export function describeOverlapSources(
  overlaps: OverlapLike[] | undefined | null
): string {
  const { kawasan, spptg } = summariseOverlaps(overlaps);
  const parts: string[] = [];
  if (kawasan > 0) parts.push(`${kawasan} kawasan Non-SPPTG`);
  if (spptg > 0) parts.push(`${spptg} SPPTG eksisting`);
  return parts.join(' dan ') || 'kawasan Non-SPPTG maupun SPPTG eksisting';
}

/** Label for the `sumber` column of an overlap row. */
export function overlapSourceLabel(overlap: OverlapLike): string {
  return isSubmissionOverlap(overlap) ? 'SPPTG Eksisting' : 'Kawasan Non-SPPTG';
}

export function normalizeOverlapRows(rows: unknown[]): NormalizedOverlapResult[] {
  const parsedRows = overlapRowsSchema.parse(rows);
  return parsedRows.map((row) => ({
    kawasanId: row.kawasan_id,
    namaKawasan: row.nama_kawasan,
    jenisKawasan: row.jenis_kawasan,
    luasOverlap: row.luas_overlap,
    percentageOverlap: row.percentage_overlap,
    sumber: row.sumber,
  }));
}
