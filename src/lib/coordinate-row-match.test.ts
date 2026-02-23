import { describe, expect, it } from 'vitest';
import {
  createCoordinateRowMatcher,
  hasUniqueCoordinateId,
} from './coordinate-row-match';

describe('coordinate-row-match', () => {
  it('matches by id when target id is uniquely present', () => {
    const rows = [{ id: 'C-1' }, { id: 'C-2' }, { id: 'C-3' }];
    const matcher = createCoordinateRowMatcher(rows, 'C-2', 0);

    expect(rows.map((row, index) => matcher(row, index))).toEqual([false, true, false]);
  });

  it('falls back to index when target id is missing', () => {
    const rows = [{ id: 'C-1' }, { id: 'C-2' }, { id: 'C-3' }];
    const matcher = createCoordinateRowMatcher(rows, undefined, 2);

    expect(rows.map((row, index) => matcher(row, index))).toEqual([false, false, true]);
  });

  it('falls back to index when target id is duplicated', () => {
    const rows = [{ id: 'C-1' }, { id: 'C-1' }, { id: 'C-2' }];
    const matcher = createCoordinateRowMatcher(rows, 'C-1', 1);

    expect(rows.map((row, index) => matcher(row, index))).toEqual([false, true, false]);
  });

  it('treats blank ids as missing and uses index fallback', () => {
    const rows = [{ id: ' ' }, { id: 'C-2' }, { id: 'C-3' }];
    const matcher = createCoordinateRowMatcher(rows, ' ', 0);

    expect(rows.map((row, index) => matcher(row, index))).toEqual([true, false, false]);
  });

  it('reports unique id availability correctly', () => {
    expect(hasUniqueCoordinateId([{ id: 'C-1' }, { id: 'C-2' }], 'C-2')).toBe(true);
    expect(hasUniqueCoordinateId([{ id: 'C-1' }, { id: 'C-1' }], 'C-1')).toBe(false);
    expect(hasUniqueCoordinateId([{ id: 'C-1' }, { id: 'C-2' }], 'C-9')).toBe(false);
    expect(hasUniqueCoordinateId([{ id: 'C-1' }, { id: 'C-2' }], '')).toBe(false);
  });
});
