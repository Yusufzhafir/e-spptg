import {
  consistentAttribute,
  layerNameToLabel,
  matchProhibitedAreaType,
  suggestKawasanAttributes,
  toDateInputValue,
} from './shapefile-attributes';

/**
 * The real attribute table of `SK_397_TAHUN_2025_KH_KALTIM.dbf`: the SK number
 * and its date are the same on every feature, while `NM_KWS` names a different
 * kawasan on each — which is exactly the case the "file must agree with itself"
 * rule exists for.
 */
const skKaltim = [
  {
    KODE_PROV: 64,
    SK_PNJK: 'SK 397 Tahun 2025',
    TGL_PNJK: '2025-07-16T17:00:00.000Z',
    NM_KWS: '',
    F_2025: 100700,
  },
  {
    KODE_PROV: 64,
    SK_PNJK: 'SK 397 Tahun 2025',
    TGL_PNJK: '2025-07-16T17:00:00.000Z',
    NM_KWS: 'CA Muara Kaman - Sedulang',
    F_2025: 500300,
  },
  {
    KODE_PROV: 64,
    SK_PNJK: 'SK 397 Tahun 2025',
    TGL_PNJK: '2025-07-16T17:00:00.000Z',
    NM_KWS: 'CA Bukit Sapat Hawung',
    F_2025: 100210,
  },
];

describe('consistentAttribute', () => {
  it('takes a value every feature agrees on', () => {
    expect(consistentAttribute(skKaltim, ['sk_pnjk'])).toBe('SK 397 Tahun 2025');
  });

  it('refuses a value that differs between features', () => {
    // Three rows, two different kawasan names — the file describes more than one
    // kawasan, so it cannot name the single one being created.
    expect(consistentAttribute(skKaltim, ['nm_kws'])).toBeUndefined();
  });

  it('treats an empty cell as unfilled, not as a competing answer', () => {
    const rows = [{ SUMBER: '' }, { SUMBER: 'KLHK' }, { SUMBER: 'KLHK' }];
    expect(consistentAttribute(rows, ['sumber'])).toBe('KLHK');
  });

  it('returns nothing when the column is absent or every row is blank', () => {
    expect(consistentAttribute(skKaltim, ['tidak_ada'])).toBeUndefined();
    expect(consistentAttribute([{ SUMBER: '' }, null], ['sumber'])).toBeUndefined();
    expect(consistentAttribute([], ['sumber'])).toBeUndefined();
  });

  it('matches the column name case- and space-insensitively', () => {
    expect(consistentAttribute([{ '  No_SK ': 'SK 12' }], ['no_sk'])).toBe('SK 12');
  });
});

describe('toDateInputValue', () => {
  it('reads the shapes a .dbf date arrives in', () => {
    expect(toDateInputValue('2025-07-16T17:00:00.000Z')).toBe('2025-07-16');
    expect(toDateInputValue('2025-07-16')).toBe('2025-07-16');
    expect(toDateInputValue('16/07/2025')).toBe('2025-07-16');
    expect(toDateInputValue('16-7-2025')).toBe('2025-07-16');
    expect(toDateInputValue('20250716')).toBe('2025-07-16');
  });

  it('gives up rather than inventing a date', () => {
    expect(toDateInputValue('')).toBeUndefined();
    expect(toDateInputValue('belum ditetapkan')).toBeUndefined();
  });
});

describe('matchProhibitedAreaType', () => {
  it('matches a jenis the enum has, including a retired name', () => {
    expect(matchProhibitedAreaType('Kawasan Hutan')).toBe('Kawasan Hutan');
    expect(matchProhibitedAreaType('kawasan hutan')).toBe('Kawasan Hutan');
    expect(matchProhibitedAreaType('Hutan Lindung')).toBe('Kawasan Hutan');
    expect(matchProhibitedAreaType('Areal Kawasan Hutan Produksi')).toBe('Kawasan Hutan');
  });

  it('leaves an unrecognised code alone instead of guessing', () => {
    // `F_2025 = 100700` is a fungsi code; the wrong jenis changes what the
    // kawasan blocks, so nothing is better than a guess.
    expect(matchProhibitedAreaType('100700')).toBeUndefined();
    expect(matchProhibitedAreaType('')).toBeUndefined();
  });
});

describe('layerNameToLabel', () => {
  it('turns a layer file name into something readable', () => {
    expect(layerNameToLabel('SK_397_TAHUN_2025_KH_KALTIM')).toBe(
      'SK 397 TAHUN 2025 KH KALTIM'
    );
    expect(layerNameToLabel('batas_kawasan.shp')).toBe('batas kawasan');
    expect(layerNameToLabel('')).toBeUndefined();
    expect(layerNameToLabel(undefined)).toBeUndefined();
  });
});

describe('suggestKawasanAttributes', () => {
  it('fills what the SK file agrees on and leaves the rest', () => {
    const suggestion = suggestKawasanAttributes(skKaltim, 'SK_397_TAHUN_2025_KH_KALTIM');

    expect(suggestion.dasarHukum).toBe('SK 397 Tahun 2025');
    expect(suggestion.tanggalEfektif).toBe('2025-07-16');
    // NM_KWS differs per feature, so the layer name stands in rather than one
    // feature's kawasan name being passed off as the whole file's.
    expect(suggestion.namaKawasan).toBe('SK 397 TAHUN 2025 KH KALTIM');
    expect(suggestion.jenisKawasan).toBeUndefined();
    expect(suggestion.sumberData).toBeUndefined();
  });

  it('uses the attribute name when the file names one kawasan', () => {
    const oneKawasan = [
      { NM_KWS: 'Hutan Lindung Sangatta', SUMBER: 'KLHK', JENIS: 'Kawasan Hutan' },
      { NM_KWS: 'Hutan Lindung Sangatta', SUMBER: 'KLHK', JENIS: 'Kawasan Hutan' },
    ];
    const suggestion = suggestKawasanAttributes(oneKawasan, 'blok_hl_sangatta');

    expect(suggestion.namaKawasan).toBe('Hutan Lindung Sangatta');
    expect(suggestion.sumberData).toBe('KLHK');
    expect(suggestion.jenisKawasan).toBe('Kawasan Hutan');
  });

  it('suggests nothing at all from a file with no usable attributes', () => {
    expect(suggestKawasanAttributes([{ FID: 1 }, { FID: 2 }])).toEqual({});
  });
});
