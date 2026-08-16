import {
  countKawasanPoints,
  findUnusableKawasanBlocks,
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
