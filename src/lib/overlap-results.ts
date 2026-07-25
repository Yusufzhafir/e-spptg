import { z } from 'zod';

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
