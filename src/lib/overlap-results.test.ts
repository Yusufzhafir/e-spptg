import { describe, expect, it } from 'vitest';
import {
  describeOverlapSources,
  normalizeOverlapRows,
  summariseOverlaps,
} from './overlap-results';

describe('normalizeOverlapRows', () => {
  it('normalizes database rows and preserves source labels', () => {
    const result = normalizeOverlapRows([
      {
        kawasan_id: '55',
        nama_kawasan: 'Area A',
        jenis_kawasan: 'Kawasan Hutan',
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
        jenisKawasan: 'Kawasan Hutan',
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

describe('describeOverlapSources', () => {
  it('names both sources rather than calling everything a kawasan', () => {
    expect(
      describeOverlapSources([
        { jenisKawasan: 'Kawasan Hutan', sumber: 'ProhibitedArea' },
        { jenisKawasan: 'Sempadan Sungai', sumber: 'ProhibitedArea' },
        { jenisKawasan: 'SPPTG terdaftar', sumber: 'Submission' },
      ])
    ).toBe('2 kawasan Non-SPPTG dan 1 SPPTG eksisting');
  });

  it('mentions only the source that is actually present', () => {
    expect(
      describeOverlapSources([{ jenisKawasan: 'SPPTG terdata', sumber: 'Submission' }])
    ).toBe('1 SPPTG eksisting');
    expect(
      describeOverlapSources([{ jenisKawasan: 'Kawasan Hutan', sumber: 'ProhibitedArea' }])
    ).toBe('1 kawasan Non-SPPTG');
  });

  it('treats a legacy row with no sumber as a submission when its jenis says so', () => {
    // Rows written before `sumber` existed carried the status as the jenis.
    expect(summariseOverlaps([{ jenisKawasan: 'SPPTG terdaftar' }])).toEqual({
      total: 1,
      kawasan: 0,
      spptg: 1,
    });
  });
});
