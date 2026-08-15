import { describe, expect, it } from 'vitest';
import { shapefileGeoJSONToPolygons } from './shapefile-parser';

/**
 * The zip plumbing (shpjs, proj4, the .dbf reader) is exercised end to end by
 * uploading a real file; what is worth pinning here is the step this module owns
 * — turning whatever geometry a survey layer holds into the bidang list the rest
 * of the app speaks, and doing it the same way the KML reader does.
 */

const ring = (offset: number) => [
  [117.1 + offset, 0.5],
  [117.2 + offset, 0.5],
  [117.2 + offset, 0.6],
  [117.1 + offset, 0.5],
];

describe('shapefileGeoJSONToPolygons', () => {
  it('reads one polygon per feature, naming it from the attribute row', () => {
    const polygons = shapefileGeoJSONToPolygons([
      {
        features: [
          {
            geometry: { type: 'Polygon', coordinates: [ring(0)] },
            properties: { NAMOBJ: 'Bidang Utara', LUAS: 1200 },
          },
        ],
      },
    ]);

    expect(polygons).toHaveLength(1);
    expect(polygons[0].name).toBe('Bidang Utara');
    expect(polygons[0].coordinates).toHaveLength(4);
    expect(polygons[0].coordinates[0]).toMatchObject({ latitude: 0.5, longitude: 117.1 });
  });

  it('takes only the outer ring — a hole is not a boundary', () => {
    const hole = [
      [117.12, 0.52],
      [117.13, 0.52],
      [117.13, 0.53],
      [117.12, 0.52],
    ];
    const polygons = shapefileGeoJSONToPolygons([
      {
        features: [
          { geometry: { type: 'Polygon', coordinates: [ring(0), hole] }, properties: {} },
        ],
      },
    ]);

    expect(polygons).toHaveLength(1);
    expect(polygons[0].coordinates).toHaveLength(4);
    expect(
      polygons[0].coordinates.some((coordinate) => coordinate.longitude === 117.12)
    ).toBe(false);
  });

  it('splits a MultiPolygon row into one bidang per part, numbering the name', () => {
    const polygons = shapefileGeoJSONToPolygons([
      {
        features: [
          {
            geometry: {
              type: 'MultiPolygon',
              coordinates: [[ring(0)], [ring(1)]],
            },
            properties: { nama: 'Kawasan Hutan' },
          },
        ],
      },
    ]);

    expect(polygons.map((polygon) => polygon.name)).toEqual([
      'Kawasan Hutan (1)',
      'Kawasan Hutan (2)',
    ]);
  });

  it('skips the patok and jalan layers a survey zip carries beside the bidang', () => {
    const polygons = shapefileGeoJSONToPolygons([
      {
        features: [
          { geometry: { type: 'Point', coordinates: [117.1, 0.5] }, properties: {} },
          { geometry: { type: 'LineString', coordinates: ring(0) }, properties: {} },
          { geometry: { type: 'Polygon', coordinates: [ring(0)] }, properties: {} },
        ],
      },
    ]);

    expect(polygons).toHaveLength(1);
  });

  it('reads every layer of a multi-layer zip, in file order', () => {
    const polygons = shapefileGeoJSONToPolygons([
      {
        fileName: 'bidang_a',
        features: [
          {
            geometry: { type: 'Polygon', coordinates: [ring(0)] },
            properties: { nama: 'A' },
          },
        ],
      },
      {
        fileName: 'bidang_b',
        features: [
          {
            geometry: { type: 'Polygon', coordinates: [ring(2)] },
            properties: { nama: 'B' },
          },
        ],
      },
    ]);

    expect(polygons.map((polygon) => polygon.name)).toEqual(['A', 'B']);
  });

  it('leaves the label to the caller when no attribute holds a name', () => {
    const polygons = shapefileGeoJSONToPolygons([
      {
        features: [
          {
            geometry: { type: 'Polygon', coordinates: [ring(0)] },
            properties: { OBJECTID: 7, SHAPE_Area: 0.0001 },
          },
        ],
      },
    ]);

    expect(polygons[0].name).toBeUndefined();
  });

  it('gives every vertex a distinct id, across layers and parts', () => {
    const polygons = shapefileGeoJSONToPolygons([
      {
        features: [
          {
            geometry: { type: 'MultiPolygon', coordinates: [[ring(0)], [ring(1)]] },
            properties: {},
          },
        ],
      },
      {
        features: [
          { geometry: { type: 'Polygon', coordinates: [ring(2)] }, properties: {} },
        ],
      },
    ]);

    const ids = polygons.flatMap((polygon) =>
      polygon.coordinates.map((coordinate) => coordinate.id)
    );

    expect(new Set(ids).size).toBe(ids.length);
  });
});
