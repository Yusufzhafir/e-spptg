/**
 * A pengajuan is not always one bidang. A claim can cover several separated
 * parcels, and a surveyor's KML routinely carries all of them at once, so the
 * wizard keeps a *list* of polygons rather than a single ring.
 *
 * `coordinatesGeografis` is still written alongside `polygons`, always mirroring
 * the first one: every draft filed before this existed has only that field, and
 * the certificate, the static map and the older tests all read it. Treat
 * `polygons` as the source of truth and `coordinatesGeografis` as a derived
 * mirror — {@link polygonsPatch} is what keeps the two from drifting apart.
 */

import { normalizeCoordinateIds } from './coordinate-ids';
import { calculatePolygonArea } from './map-utils';
import type {
  GeoJSONMultiPolygon,
  GeographicCoordinate,
  LandPolygon,
} from '@/types';

/** Minimum vertices a ring needs before it is a polygon at all. */
export const MIN_POLYGON_POINTS = 3;

export function createPolygonId(): string {
  return `P-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Ready to be drawn, measured and sent to PostGIS. */
export function isUsablePolygon(polygon: LandPolygon | undefined | null): boolean {
  return validCoordinates(polygon?.coordinates ?? []).length >= MIN_POLYGON_POINTS;
}

export function validCoordinates(
  coordinates: GeographicCoordinate[]
): GeographicCoordinate[] {
  return (coordinates ?? []).filter((coord) => {
    const latitude = Number(coord?.latitude);
    const longitude = Number(coord?.longitude);
    return (
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180
    );
  });
}

type PolygonSource = {
  polygons?: LandPolygon[] | null;
  coordinatesGeografis?: GeographicCoordinate[] | null;
};

/**
 * The polygons of a draft or a stored payload, whichever field it carries.
 *
 * A pre-multi-polygon draft only has `coordinatesGeografis`; it becomes the
 * single polygon of the list, so nothing downstream has to know which era the
 * berkas comes from.
 */
export function draftPolygons(source: PolygonSource | null | undefined): LandPolygon[] {
  const polygons = source?.polygons;
  if (Array.isArray(polygons) && polygons.length > 0) {
    return polygons.map((polygon, index) => ({
      ...polygon,
      id: polygon.id || `P-${index + 1}`,
      coordinates: polygon.coordinates ?? [],
    }));
  }

  const legacy = source?.coordinatesGeografis ?? [];
  if (legacy.length === 0) return [];

  return [{ id: 'P-1', coordinates: legacy }];
}

/**
 * The draft fields to write for a new list of polygons.
 *
 * Always patch both keys through this — writing `polygons` while leaving a stale
 * `coordinatesGeografis` behind is what would make the certificate print a
 * boundary the map no longer shows.
 */
export function polygonsPatch(polygons: LandPolygon[]): {
  polygons: LandPolygon[];
  coordinatesGeografis: GeographicCoordinate[];
} {
  const normalized = polygons.map((polygon) => ({
    ...polygon,
    coordinates: normalizeCoordinateIds(polygon.coordinates ?? []),
  }));

  return {
    polygons: normalized,
    coordinatesGeografis: normalized[0]?.coordinates ?? [],
  };
}

/** Every vertex across every polygon — for map fitting and point counts. */
export function allPolygonCoordinates(
  polygons: LandPolygon[]
): GeographicCoordinate[] {
  return polygons.flatMap((polygon) => validCoordinates(polygon.coordinates));
}

/** Sum of the polygons' areas in m² (Shoelace, same estimate as one polygon). */
export function totalPolygonArea(polygons: LandPolygon[]): number {
  return polygons.reduce((total, polygon) => {
    const coordinates = validCoordinates(polygon.coordinates);
    if (coordinates.length < MIN_POLYGON_POINTS) return total;
    return total + calculatePolygonArea(coordinates);
  }, 0);
}

/** A closed GeoJSON ring ([lng, lat], first vertex repeated at the end). */
export function coordinatesToRing(
  coordinates: GeographicCoordinate[]
): [number, number][] {
  const ring = validCoordinates(coordinates).map(
    (coord) => [Number(coord.longitude), Number(coord.latitude)] as [number, number]
  );
  if (ring.length < MIN_POLYGON_POINTS) return [];

  const [firstLng, firstLat] = ring[0];
  const [lastLng, lastLat] = ring[ring.length - 1];
  if (firstLng !== lastLng || firstLat !== lastLat) {
    ring.push([firstLng, firstLat]);
  }
  return ring;
}

/**
 * The whole pengajuan as one MultiPolygon — what gets stored in
 * `submissions.geom` and handed to the overlap check.
 *
 * MultiPolygon even for a single bidang: `submissions.geom` is typed
 * `geometry(MultiPolygon, 4326)`, and every PostGIS predicate the app uses
 * (ST_Intersects/ST_Intersection/ST_Area) behaves identically either way.
 */
export function polygonsToMultiPolygon(
  polygons: LandPolygon[]
): GeoJSONMultiPolygon | null {
  const rings = polygons
    .map((polygon) => coordinatesToRing(polygon.coordinates))
    .filter((ring) => ring.length >= MIN_POLYGON_POINTS + 1);

  if (rings.length === 0) return null;

  return {
    type: 'MultiPolygon',
    coordinates: rings.map((ring) => [ring]),
  };
}

/**
 * `MULTIPOLYGON(((lng lat, …)), ((…)))` for `ST_MPolyFromText`.
 *
 * Accepts either GeoJSON form: a plain Polygon becomes a single-part
 * MultiPolygon, because both `submissions.geom` and `prohibited_areas.geom` are
 * typed MultiPolygon and a Polygon literal would be rejected by the typmod.
 *
 * @throws when a ring holds a non-finite number — that must never reach the SQL
 *   string, which is built by interpolation.
 */
export function geometryToMultiPolygonWKT(geometry: {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: number[][][] | number[][][][];
}): string {
  const polygons: number[][][][] =
    geometry.type === 'MultiPolygon'
      ? (geometry.coordinates as number[][][][])
      : [geometry.coordinates as number[][][]];

  const parts = polygons.map((rings) => {
    const ringText = rings
      .filter((ring) => Array.isArray(ring) && ring.length >= 4)
      .map(
        (ring) =>
          `(${ring
            .map((point) => {
              const lng = Number(point[0]);
              const lat = Number(point[1]);
              if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
                throw new Error('Koordinat harus berupa angka yang valid');
              }
              return `${lng} ${lat}`;
            })
            .join(',')})`
      )
      .join(',');

    return ringText ? `(${ringText})` : '';
  });

  const usable = parts.filter(Boolean);
  if (usable.length === 0) {
    throw new Error('Geometri tidak memiliki polygon yang valid');
  }

  return `MULTIPOLYGON(${usable.join(',')})`;
}

/** Human label for a polygon in tables, tabs and toasts. */
export function polygonLabel(polygon: LandPolygon, index: number): string {
  return polygon.nama?.trim() || `Bidang ${index + 1}`;
}
