import { findCenter } from './utils';

/** Indonesia, the fallback when there is nothing usable to centre on. */
const FALLBACK = { lat: -0.7893, lng: 113.9213 };

describe('findCenter', () => {
  it('centres on the bounding box of the points', () => {
    expect(
      findCenter([
        { lat: 0, lng: 117 },
        { lat: 2, lng: 119 },
      ])
    ).toEqual({ lat: 1, lng: 118 });
  });

  it('falls back when given nothing', () => {
    expect(findCenter([])).toEqual(FALLBACK);
  });

  /**
   * The regression this file exists for.
   *
   * `Math.min(...values)` puts one argument on the stack per element, so it
   * threw `Maximum call stack size exceeded` once a kawasan boundary got large
   * — and Cek Tumpang Tindih flattens *every* kawasan into one array before
   * calling this. 200 000 points is a single realistic provincial layer.
   */
  it('handles a boundary far larger than the argument limit', () => {
    const points = Array.from({ length: 200_000 }, (_, index) => ({
      lat: -1 + (index / 200_000) * 2,
      lng: 116 + (index / 200_000) * 2,
    }));

    expect(() => findCenter(points)).not.toThrow();
    const center = findCenter(points);
    expect(center.lat).toBeCloseTo(0, 4);
    expect(center.lng).toBeCloseTo(117, 4);
  });

  it('skips coordinates that are not numbers instead of returning NaN', () => {
    // One bad vertex in an imported boundary used to blank the whole map.
    const center = findCenter([
      { lat: 0, lng: 117 },
      { lat: Number.NaN, lng: Number.NaN },
      { lat: 2, lng: 119 },
    ]);
    expect(center).toEqual({ lat: 1, lng: 118 });
  });

  it('falls back when every coordinate is unusable', () => {
    expect(
      findCenter([
        { lat: Number.NaN, lng: Number.NaN },
        { lat: Number.POSITIVE_INFINITY, lng: Number.NEGATIVE_INFINITY },
      ])
    ).toEqual(FALLBACK);
  });

  it('still crosses the antimeridian correctly', () => {
    // Points either side of 180°: the midpoint is 180, not 0.
    const center = findCenter([
      { lat: 0, lng: 179 },
      { lat: 0, lng: -179 },
    ]);
    expect(center.lng).toBeCloseTo(180, 6);
  });

  it('leaves an ordinary wide span alone', () => {
    const center = findCenter([
      { lat: 0, lng: 100 },
      { lat: 0, lng: 140 },
    ]);
    expect(center.lng).toBeCloseTo(120, 6);
  });
});
