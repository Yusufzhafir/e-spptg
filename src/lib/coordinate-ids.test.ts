import { describe, expect, it } from 'vitest';
import {
  coordinatesNeedIdNormalization,
  normalizeCoordinateIds,
} from './coordinate-ids';

describe('coordinate-ids', () => {
  it('keeps existing unique ids unchanged', () => {
    const input = [
      { id: 'C-1', latitude: -6.9, longitude: 107.6 },
      { id: 'C-2', latitude: -6.91, longitude: 107.61 },
    ];

    const normalized = normalizeCoordinateIds(input);
    expect(normalized).toEqual(input);
    expect(coordinatesNeedIdNormalization(normalized)).toBe(false);
  });

  it('fills missing ids and resolves duplicate ids deterministically', () => {
    const normalized = normalizeCoordinateIds([
      { id: '', latitude: -6.9, longitude: 107.6 },
      { id: 'C-1', latitude: -6.91, longitude: 107.61 },
      { id: 'C-1', latitude: -6.92, longitude: 107.62 },
      { id: undefined, latitude: -6.93, longitude: 107.63 },
    ]);

    expect(normalized.map((coord) => coord.id)).toEqual([
      'C-1',
      'C-1-2',
      'C-1-3',
      'C-4',
    ]);
    expect(coordinatesNeedIdNormalization(normalized)).toBe(false);
  });

  it('detects normalization need for missing or duplicate ids', () => {
    expect(
      coordinatesNeedIdNormalization([
        { id: 'C-1', latitude: -6.9, longitude: 107.6 },
        { id: undefined, latitude: -6.91, longitude: 107.61 },
      ])
    ).toBe(true);

    expect(
      coordinatesNeedIdNormalization([
        { id: 'C-1', latitude: -6.9, longitude: 107.6 },
        { id: 'C-1', latitude: -6.91, longitude: 107.61 },
      ])
    ).toBe(true);
  });
});
