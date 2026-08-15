import {
  checkKawasanImportSize,
  countKawasanPoints,
  findUnusableKawasanBlocks,
  MAX_KAWASAN_BLOCKS,
  MAX_KAWASAN_TOTAL_POINTS,
  unusableKawasanBlocksMessage,
} from './kawasan-limits';
import type { LandPolygon } from '@/types';

/** A block of `points` valid vertices. */
function block(id: string, points: number, nama?: string): LandPolygon {
  return {
    id,
    nama,
    coordinates: Array.from({ length: points }, (_, index) => ({
      id: `${id}-c${index}`,
      latitude: 0.1 + index * 0.0001,
      longitude: 117.1 + index * 0.0001,
    })),
  };
}

describe('countKawasanPoints', () => {
  it('adds up every block', () => {
    expect(countKawasanPoints([block('a', 5), block('b', 7)])).toBe(12);
    expect(countKawasanPoints([])).toBe(0);
  });
});

describe('checkKawasanImportSize', () => {
  it('accepts a detailed single kawasan', () => {
    // Far beyond the wizard's 100-vertex cap, which is the point: a kawasan
    // traced from an SK legitimately looks like this.
    expect(checkKawasanImportSize([block('a', 12_000), block('b', 8_000)]).ok).toBe(true);
  });

  it('refuses a file with more blocks than one kawasan may hold', () => {
    const many = Array.from({ length: MAX_KAWASAN_BLOCKS + 1 }, (_, i) => block(`p${i}`, 4));
    const result = checkKawasanImportSize(many);

    expect(result.ok).toBe(false);
    expect(result.message).toContain(String(MAX_KAWASAN_BLOCKS));
    // The fix is in QGIS, so the message has to say so.
    expect(result.message).toMatch(/QGIS|ArcGIS/);
  });

  it('refuses a file with more vertices than one kawasan may hold', () => {
    const huge = [block('a', MAX_KAWASAN_TOTAL_POINTS + 1)];
    const result = checkKawasanImportSize(huge);

    expect(result.ok).toBe(false);
    expect(result.message).toContain('titik');
  });

  it('accepts a set sitting exactly on both ceilings', () => {
    const atBlockLimit = Array.from({ length: MAX_KAWASAN_BLOCKS }, (_, i) => block(`p${i}`, 4));
    expect(checkKawasanImportSize(atBlockLimit).ok).toBe(true);
    expect(checkKawasanImportSize([block('a', MAX_KAWASAN_TOTAL_POINTS)]).ok).toBe(true);
  });
});

describe('findUnusableKawasanBlocks', () => {
  it('finds nothing when every block is drawn', () => {
    expect(findUnusableKawasanBlocks([block('a', 3), block('b', 10)])).toEqual([]);
  });

  it('names every block that would be dropped on save, not just the first', () => {
    const blocks = [
      block('a', 8, 'Blok Utara'),
      block('b', 0, 'Blok Kosong'),
      block('c', 12),
      block('d', 2, 'Blok Setengah'),
    ];

    const unusable = findUnusableKawasanBlocks(blocks);

    expect(unusable.map((row) => row.index)).toEqual([1, 3]);
    expect(unusable.map((row) => row.label)).toEqual(['Blok Kosong', 'Blok Setengah']);
    expect(unusable.map((row) => row.pointCount)).toEqual([0, 2]);
  });

  it('counts only coordinates that are actually usable', () => {
    const broken: LandPolygon = {
      id: 'x',
      nama: 'Blok Rusak',
      coordinates: [
        { id: '1', latitude: 0.1, longitude: 117.1 },
        { id: '2', latitude: Number.NaN, longitude: 117.2 },
        { id: '3', latitude: 999, longitude: 117.3 },
      ],
    };
    const [found] = findUnusableKawasanBlocks([broken]);
    expect(found.pointCount).toBe(1);
  });
});

describe('unusableKawasanBlocksMessage', () => {
  it('lists each incomplete block with its point count', () => {
    const message = unusableKawasanBlocksMessage(
      findUnusableKawasanBlocks([block('a', 1, 'Blok A'), block('b', 0, 'Blok B')])
    );
    expect(message).toContain('Blok A (1 titik)');
    expect(message).toContain('Blok B (0 titik)');
  });

  it('says nothing when there is nothing wrong', () => {
    expect(unusableKawasanBlocksMessage([])).toBe('');
  });
});
