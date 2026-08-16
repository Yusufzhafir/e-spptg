import {
  summarizeKawasanConflicts,
  type KawasanGeometryConflict,
} from './kawasan-conflicts';

function conflict(
  overrides: Partial<KawasanGeometryConflict> & Pick<KawasanGeometryConflict, 'jenis' | 'id'>
): KawasanGeometryConflict {
  return {
    nama: 'X',
    keterangan: '',
    status: '',
    aktifDiValidasi: true,
    luasOverlap: 100,
    percentageOverlap: 10,
    ...overrides,
  };
}

describe('summarizeKawasanConflicts', () => {
  it('reports nothing for an empty result', () => {
    const summary = summarizeKawasanConflicts([]);
    expect(summary.total).toBe(0);
    expect(summary.kawasan).toEqual([]);
    expect(summary.pengajuan).toEqual([]);
    expect(summary.ringkasan).toBe('');
  });

  it('keeps the two kinds apart', () => {
    const summary = summarizeKawasanConflicts([
      conflict({ jenis: 'kawasan', id: 1 }),
      conflict({ jenis: 'pengajuan', id: 7 }),
      conflict({ jenis: 'kawasan', id: 2 }),
    ]);

    expect(summary.kawasan.map((row) => row.id)).toEqual([1, 2]);
    expect(summary.pengajuan.map((row) => row.id)).toEqual([7]);
    expect(summary.total).toBe(3);
    expect(summary.ringkasan).toBe('2 kawasan Non-SPPTG dan 1 pengajuan SPPTG');
  });

  it('names only the kind that is actually present', () => {
    expect(
      summarizeKawasanConflicts([conflict({ jenis: 'pengajuan', id: 3 })]).ringkasan
    ).toBe('1 pengajuan SPPTG');
    expect(
      summarizeKawasanConflicts([conflict({ jenis: 'kawasan', id: 3 })]).ringkasan
    ).toBe('1 kawasan Non-SPPTG');
  });
});
