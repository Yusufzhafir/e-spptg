import { describe, expect, it } from 'vitest';
import {
  draftPolygons,
  geometryToMultiPolygonWKT,
  isUsablePolygon,
  polygonsPatch,
  polygonsToMultiPolygon,
  totalPolygonArea,
} from './land-polygons';
import type { GeographicCoordinate, LandPolygon } from '@/types';

function ring(offset: number): GeographicCoordinate[] {
  return [
    { id: `${offset}-1`, latitude: offset, longitude: 117 + offset },
    { id: `${offset}-2`, latitude: offset + 0.001, longitude: 117 + offset },
    { id: `${offset}-3`, latitude: offset + 0.001, longitude: 117 + offset + 0.001 },
  ];
}

describe('draftPolygons', () => {
  it('lifts a legacy single-boundary draft into one polygon', () => {
    const polygons = draftPolygons({ coordinatesGeografis: ring(0) });

    expect(polygons).toHaveLength(1);
    expect(polygons[0].coordinates).toEqual(ring(0));
  });

  it('prefers the polygon list when the draft carries one', () => {
    const polygons = draftPolygons({
      polygons: [
        { id: 'P-1', coordinates: ring(0) },
        { id: 'P-2', coordinates: ring(1) },
      ],
      // A stale mirror must not add a third bidang.
      coordinatesGeografis: ring(9),
    });

    expect(polygons).toHaveLength(2);
    expect(polygons[1].coordinates[0].latitude).toBe(1);
  });

  it('returns nothing for a draft with no geometry at all', () => {
    expect(draftPolygons({})).toEqual([]);
    expect(draftPolygons(null)).toEqual([]);
  });

  it('gives an id to a polygon that lost one in storage', () => {
    const polygons = draftPolygons({
      polygons: [{ id: '', coordinates: ring(0) } as LandPolygon],
    });

    expect(polygons[0].id).toBe('P-1');
  });
});

describe('polygonsPatch', () => {
  it('mirrors the first polygon into coordinatesGeografis', () => {
    const patch = polygonsPatch([
      { id: 'P-1', coordinates: ring(0) },
      { id: 'P-2', coordinates: ring(1) },
    ]);

    expect(patch.coordinatesGeografis).toEqual(patch.polygons[0].coordinates);
    expect(patch.polygons).toHaveLength(2);
  });

  it('normalises duplicate and missing coordinate ids per polygon', () => {
    const patch = polygonsPatch([
      {
        id: 'P-1',
        coordinates: [
          { id: 'C-1', latitude: 0, longitude: 117 },
          { id: '', latitude: 0.001, longitude: 117 } as GeographicCoordinate,
          { id: 'C-1', latitude: 0.001, longitude: 117.001 },
        ],
      },
    ]);

    expect(patch.polygons[0].coordinates.map((c) => c.id)).toEqual([
      'C-1',
      'C-2',
      'C-1-2',
    ]);
  });

  it('clears the mirror when every polygon is removed', () => {
    expect(polygonsPatch([])).toEqual({ polygons: [], coordinatesGeografis: [] });
  });
});

describe('isUsablePolygon', () => {
  it('rejects fewer than three points and out-of-range coordinates', () => {
    expect(isUsablePolygon({ id: 'P', coordinates: ring(0).slice(0, 2) })).toBe(false);
    expect(
      isUsablePolygon({
        id: 'P',
        coordinates: [
          { id: '1', latitude: 200, longitude: 117 },
          { id: '2', latitude: 0, longitude: 400 },
          { id: '3', latitude: Number.NaN, longitude: 117 },
        ],
      })
    ).toBe(false);
    expect(isUsablePolygon({ id: 'P', coordinates: ring(0) })).toBe(true);
  });
});

describe('polygonsToMultiPolygon', () => {
  it('closes every ring and keeps one part per bidang', () => {
    const geometry = polygonsToMultiPolygon([
      { id: 'P-1', coordinates: ring(0) },
      { id: 'P-2', coordinates: ring(1) },
    ]);

    expect(geometry?.type).toBe('MultiPolygon');
    expect(geometry?.coordinates).toHaveLength(2);
    for (const polygon of geometry!.coordinates) {
      const outer = polygon[0];
      expect(outer[0]).toEqual(outer[outer.length - 1]);
    }
  });

  it('is a MultiPolygon even for a single bidang', () => {
    const geometry = polygonsToMultiPolygon([{ id: 'P-1', coordinates: ring(0) }]);

    expect(geometry?.type).toBe('MultiPolygon');
    expect(geometry?.coordinates).toHaveLength(1);
  });

  it('skips polygons that are not closeable and returns null when none are', () => {
    expect(
      polygonsToMultiPolygon([{ id: 'P-1', coordinates: ring(0).slice(0, 2) }])
    ).toBeNull();

    const geometry = polygonsToMultiPolygon([
      { id: 'P-1', coordinates: ring(0).slice(0, 2) },
      { id: 'P-2', coordinates: ring(1) },
    ]);
    expect(geometry?.coordinates).toHaveLength(1);
  });
});

describe('totalPolygonArea', () => {
  it('sums the area of every bidang', () => {
    const single = totalPolygonArea([{ id: 'P-1', coordinates: ring(0) }]);
    const pair = totalPolygonArea([
      { id: 'P-1', coordinates: ring(0) },
      { id: 'P-2', coordinates: ring(1) },
    ]);

    expect(single).toBeGreaterThan(0);
    // Both rings are the same shape at different offsets.
    expect(pair).toBeCloseTo(single * 2, 0);
  });

  it('ignores bidang that are not yet polygons', () => {
    expect(
      totalPolygonArea([
        { id: 'P-1', coordinates: ring(0) },
        { id: 'P-2', coordinates: [] },
      ])
    ).toBe(totalPolygonArea([{ id: 'P-1', coordinates: ring(0) }]));
  });
});

describe('geometryToMultiPolygonWKT', () => {
  const square = [
    [117, 0],
    [117.001, 0],
    [117.001, 0.001],
    [117, 0],
  ];

  it('wraps a plain Polygon as a single-part MultiPolygon', () => {
    expect(geometryToMultiPolygonWKT({ type: 'Polygon', coordinates: [square] })).toBe(
      'MULTIPOLYGON(((117 0,117.001 0,117.001 0.001,117 0)))'
    );
  });

  it('keeps one part per polygon of a MultiPolygon', () => {
    const wkt = geometryToMultiPolygonWKT({
      type: 'MultiPolygon',
      coordinates: [[square], [square]],
    });

    expect(wkt.startsWith('MULTIPOLYGON(((')).toBe(true);
    expect(wkt.split(')),((')).toHaveLength(2);
  });

  it('refuses a non-finite coordinate rather than building the SQL literal', () => {
    expect(() =>
      geometryToMultiPolygonWKT({
        type: 'Polygon',
        coordinates: [[[117, 0], [Number.NaN, 0], [117.001, 0.001], [117, 0]]],
      })
    ).toThrow(/angka yang valid/);
  });

  it('refuses a geometry with no closeable ring', () => {
    expect(() =>
      geometryToMultiPolygonWKT({ type: 'Polygon', coordinates: [[[117, 0], [117.001, 0]]] })
    ).toThrow(/polygon yang valid/);
  });
});
