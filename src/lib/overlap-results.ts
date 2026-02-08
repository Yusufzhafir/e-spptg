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
