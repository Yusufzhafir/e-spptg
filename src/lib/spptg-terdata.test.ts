import { describe, expect, it } from 'vitest';
import {
  blockingSubmissionOverlaps,
  checkedTerdataStatuses,
  isSubmissionOverlap,
  TERDATA_OVERLAP_STATUSES,
} from './spptg-terdata';

const kawasan = (jenisKawasan: string) => ({ jenisKawasan, sumber: 'ProhibitedArea' as const });
const pengajuan = (jenisKawasan: string) => ({ jenisKawasan, sumber: 'Submission' as const });

describe('TERDATA_OVERLAP_STATUSES', () => {
  it('lists 13 statuses — every kawasan type except the SPPTG one', () => {
    expect(TERDATA_OVERLAP_STATUSES).toHaveLength(13);
    expect(TERDATA_OVERLAP_STATUSES).not.toContain('Areal SPPT yang sudah terbit');
    expect(TERDATA_OVERLAP_STATUSES[0]).toBe('Kawasan Hutan');
  });
});

describe('isSubmissionOverlap', () => {
  it('reads sumber first', () => {
    expect(isSubmissionOverlap(pengajuan('SPPTG terdaftar'))).toBe(true);
    expect(isSubmissionOverlap(kawasan('Kawasan Hutan'))).toBe(false);
  });

  it('falls back to the jenis for rows written before sumber existed', () => {
    expect(isSubmissionOverlap({ jenisKawasan: 'SPPTG terdata' })).toBe(true);
    expect(isSubmissionOverlap({ jenisKawasan: 'Sempadan Sungai' })).toBe(false);
  });
});

describe('blockingSubmissionOverlaps', () => {
  it('blocks only on a clash with another pengajuan', () => {
    const overlaps = [
      kawasan('Kawasan Hutan'),
      pengajuan('SPPTG terdaftar'),
      kawasan('Sempadan Sungai'),
      pengajuan('SPPTG terdata'),
    ];

    expect(blockingSubmissionOverlaps(overlaps).map((o) => o.jenisKawasan)).toEqual([
      'SPPTG terdaftar',
      'SPPTG terdata',
    ]);
  });

  it('lets a kawasan-only overlap through — that is what the notice discloses', () => {
    expect(blockingSubmissionOverlaps([kawasan('Hak Milik'), kawasan('Fasum/Fasos')])).toEqual([]);
    expect(blockingSubmissionOverlaps(undefined)).toEqual([]);
  });
});

describe('checkedTerdataStatuses', () => {
  it('ticks the kawasan the parcel sits on, in checklist order', () => {
    // Supplied out of order on purpose: the certificate must print the fixed
    // official sequence, not whatever order PostGIS returned.
    const overlaps = [kawasan('Sempadan Sungai'), kawasan('Kawasan Hutan'), kawasan('Hak Pakai')];

    expect(checkedTerdataStatuses(overlaps)).toEqual([
      'Kawasan Hutan',
      'Hak Pakai',
      'Sempadan Sungai',
    ]);
  });

  it('never ticks a row for a clash with another pengajuan', () => {
    expect(checkedTerdataStatuses([pengajuan('SPPTG terdaftar')])).toEqual([]);
  });

  it('collapses duplicates — two hutan polygons are still one tick', () => {
    expect(checkedTerdataStatuses([kawasan('Kawasan Hutan'), kawasan('Kawasan Hutan')])).toEqual([
      'Kawasan Hutan',
    ]);
  });

  it('ignores a jenis that is no longer on the list', () => {
    expect(checkedTerdataStatuses([kawasan('Cagar Alam')])).toEqual([]);
  });

  it('ticks a renamed jenis recorded before the rename', () => {
    // Overlap results are a frozen snapshot: a berkas checked while the enum
    // still said "Hutan Lindung" must not print an empty checklist.
    expect(checkedTerdataStatuses([kawasan('Hutan Lindung')])).toEqual(['Kawasan Hutan']);
    expect(checkedTerdataStatuses([kawasan('Aset TNI/POLRI')])).toEqual(['Tanah TNI/Polri']);
  });

  it('collapses an old and a new spelling of the same jenis into one tick', () => {
    expect(checkedTerdataStatuses([kawasan('Hutan Lindung'), kawasan('Kawasan Hutan')])).toEqual([
      'Kawasan Hutan',
    ]);
  });

  it('ticks nothing when there are no overlaps', () => {
    expect(checkedTerdataStatuses([])).toEqual([]);
    expect(checkedTerdataStatuses(undefined)).toEqual([]);
  });
});
