import { describe, expect, it } from 'vitest';
import { normalizeOverlapRows } from './overlap-results';

describe('normalizeOverlapRows', () => {
  it('normalizes database rows and preserves source labels', () => {
    const result = normalizeOverlapRows([
      {
        kawasan_id: '55',
        nama_kawasan: 'Area A',
        jenis_kawasan: 'Hutan Lindung',
        luas_overlap: 15.5,
        percentage_overlap: 10,
        sumber: 'ProhibitedArea',
      },
      {
        kawasan_id: 99,
        nama_kawasan: 'Submission Lama',
        jenis_kawasan: 'SPPTG Eksisting',
        luas_overlap: null,
        percentage_overlap: null,
        sumber: 'Submission',
      },
    ]);

    expect(result).toEqual([
      {
        kawasanId: 55,
        namaKawasan: 'Area A',
        jenisKawasan: 'Hutan Lindung',
        luasOverlap: 15.5,
        percentageOverlap: 10,
        sumber: 'ProhibitedArea',
      },
      {
        kawasanId: 99,
        namaKawasan: 'Submission Lama',
        jenisKawasan: 'SPPTG Eksisting',
        luasOverlap: 0,
        percentageOverlap: undefined,
        sumber: 'Submission',
      },
    ]);
  });
});
