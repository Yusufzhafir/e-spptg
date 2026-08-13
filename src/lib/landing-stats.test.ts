import {
  formatAngka,
  formatHektar,
  rekapDesa,
  summarizeLandingStats,
  totalRekap,
} from './landing-stats';
import type { LandingStatsDesa } from './landing-stats';

function desa(
  nama: string,
  kecamatan: string,
  total: number,
  luasM2: number,
  tahun: number | null = 2026
): LandingStatsDesa {
  return { desa: nama, kecamatan, tahun, total, luasM2 };
}

describe('summarizeLandingStats', () => {
  it('sums the totals from the per-desa rows', () => {
    const stats = summarizeLandingStats([
      desa('Teluk Lingga', 'Sangatta Utara', 12, 120_000),
      desa('Singa Geweh', 'Sangatta Selatan', 8, 80_000),
      desa('Sangkima', 'Sangatta Selatan', 5, 50_000),
    ]);

    expect(stats.total).toBe(25);
    expect(stats.luasM2).toBe(250_000);
    expect(stats.jumlahDesa).toBe(3);
    expect(stats.jumlahKecamatan).toBe(2);
  });

  it('rolls desa up into their kecamatan, biggest first', () => {
    const stats = summarizeLandingStats([
      desa('Teluk Lingga', 'Sangatta Utara', 4, 40_000),
      desa('Singa Geweh', 'Sangatta Selatan', 8, 80_000),
      desa('Sangkima', 'Sangatta Selatan', 5, 50_000),
    ]);

    expect(stats.perKecamatan).toEqual([
      { kecamatan: 'Sangatta Selatan', total: 13, luasM2: 130_000 },
      { kecamatan: 'Sangatta Utara', total: 4, luasM2: 40_000 },
    ]);
  });

  it('breaks a tie on kecamatan name so the order is stable between renders', () => {
    const stats = summarizeLandingStats([
      desa('B', 'Muara Bengkal', 3, 0),
      desa('A', 'Bengalon', 3, 0),
    ]);

    expect(stats.perKecamatan.map((row) => row.kecamatan)).toEqual([
      'Bengalon',
      'Muara Bengkal',
    ]);
  });

  it('reports zeroes rather than throwing when nothing is registered yet', () => {
    const stats = summarizeLandingStats([]);

    expect(stats).toMatchObject({
      total: 0,
      luasM2: 0,
      jumlahDesa: 0,
      jumlahKecamatan: 0,
      perKecamatan: [],
      perDesa: [],
    });
  });

  it('stamps the read time so a cached page can say how old its numbers are', () => {
    const stats = summarizeLandingStats([], [], new Date('2026-08-13T02:00:00.000Z'));
    expect(stats.diperbaruiPada).toBe('2026-08-13T02:00:00.000Z');
  });

  it('carries the map outlines through untouched', () => {
    const bidang = {
      ring: [
        [117.5, 0.5],
        [117.6, 0.5],
        [117.6, 0.6],
        [117.5, 0.5],
      ],
      desa: 'Teluk Lingga',
      kecamatan: 'Sangatta Utara',
      luasM2: 12_000,
      penggunaanLahan: 'Kebun',
      tahun: 2026,
    };
    expect(summarizeLandingStats([], [bidang]).polygons).toEqual([bidang]);
  });

  it('counts a desa once even when it appears in several years', () => {
    const stats = summarizeLandingStats([
      desa('Teluk Lingga', 'Sangatta Utara', 4, 40_000, 2025),
      desa('Teluk Lingga', 'Sangatta Utara', 6, 60_000, 2026),
    ]);

    expect(stats.jumlahDesa).toBe(1);
    expect(stats.total).toBe(10);
    expect(stats.tahunTersedia).toEqual([2026, 2025]);
  });
});

describe('rekapDesa', () => {
  const rows = [
    desa('Teluk Lingga', 'Sangatta Utara', 4, 40_000, 2025),
    desa('Teluk Lingga', 'Sangatta Utara', 6, 60_000, 2026),
    desa('Singa Geweh', 'Sangatta Selatan', 9, 90_000, 2026),
  ];

  it('folds every year together by default', () => {
    expect(rekapDesa(rows)).toEqual([
      { desa: 'Teluk Lingga', kecamatan: 'Sangatta Utara', total: 10, luasM2: 100_000 },
      { desa: 'Singa Geweh', kecamatan: 'Sangatta Selatan', total: 9, luasM2: 90_000 },
    ]);
  });

  it('keeps only the chosen year', () => {
    expect(rekapDesa(rows, 2025)).toEqual([
      { desa: 'Teluk Lingga', kecamatan: 'Sangatta Utara', total: 4, luasM2: 40_000 },
    ]);
  });

  it('returns nothing for a year with no berkas', () => {
    expect(rekapDesa(rows, 2019)).toEqual([]);
  });

  it('keeps two same-named desa in different kecamatan apart', () => {
    const bentrok = [
      desa('Makmur', 'Bengalon', 3, 30_000, 2026),
      desa('Makmur', 'Kaliorang', 2, 20_000, 2026),
    ];
    expect(rekapDesa(bentrok)).toHaveLength(2);
  });

  it('totals the columns the way the table footer prints them', () => {
    expect(totalRekap(rekapDesa(rows))).toEqual({ total: 19, luasM2: 190_000 });
  });
});

describe('formatters', () => {
  it('groups thousands the Indonesian way', () => {
    // Non-breaking vs regular separators differ between ICU builds, so compare
    // on the digits and the separator positions rather than the exact string.
    expect(formatAngka(1234567).replace(/ /g, ' ')).toBe('1.234.567');
  });

  it('converts m2 to hektar with two decimals', () => {
    expect(formatHektar(12_345)).toBe('1,23');
    expect(formatHektar(0)).toBe('0,00');
  });
});
