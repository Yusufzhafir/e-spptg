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

/**
 * Bidang a single pengajuan may cover.
 *
 * Two, by office rule rather than by anything technical: a claim over more
 * separated parcels than that is filed as more than one pengajuan, so each
 * certificate stays about land the applicant can be shown to hold as one claim.
 * Enforced in the Step 2 editor and again by `landPolygonSchema`'s list bounds,
 * so neither a hand-added bidang nor an imported file can exceed it.
 */
export const MAX_POLYGONS_PER_SUBMISSION = 2;

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
  /**
   * The pengajuan-level measurements of an older draft, written before a bidang
   * could carry its own — see {@link draftPolygons} for when they are adopted.
   */
  nomorPersil?: string | null;
  luasManual?: number | null;
  panjangLahan?: number | null;
  lebarLahan?: number | null;
};

/** A positive, finite measurement, or undefined for "not recorded". */
function measurement(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

/**
 * A persil number, or undefined when the box is blank.
 *
 * Deliberately not trimmed: this runs on every keystroke through
 * `polygonsPatch`, and trimming there would eat the space in "12 A" the moment
 * it is typed. The editor trims on blur instead.
 */
function persilNumber(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

/**
 * The polygons of a draft or a stored payload, whichever field it carries.
 *
 * A pre-multi-polygon draft only has `coordinatesGeografis`; it becomes the
 * single polygon of the list, so nothing downstream has to know which era the
 * berkas comes from.
 *
 * The same applies to nomor persil, luas manual and the tape measurements: they
 * used to be pengajuan-level fields and are now recorded per bidang, so a draft
 * that only has the old ones has them adopted by its bidang — but **only when
 * there is exactly one**. On a berkas that already covered several bidang the
 * old value described all of them at once; pinning it to the first would state
 * that bidang's persil number and area as something it never was, so those
 * drafts keep the value at pengajuan level (where the summaries still read it)
 * until someone fills the bidang in.
 */
export function draftPolygons(source: PolygonSource | null | undefined): LandPolygon[] {
  const polygons = source?.polygons;
  if (Array.isArray(polygons) && polygons.length > 0) {
    const list = polygons.map((polygon, index) => ({
      ...polygon,
      id: polygon.id || `P-${index + 1}`,
      coordinates: polygon.coordinates ?? [],
    }));
    return list.length === 1 ? [adoptLegacyFields(list[0], source)] : list;
  }

  const legacy = source?.coordinatesGeografis ?? [];
  if (legacy.length === 0) return [];

  return [adoptLegacyFields({ id: 'P-1', coordinates: legacy }, source)];
}

/** Fills a lone bidang's blanks from the draft-level fields it superseded. */
function adoptLegacyFields(
  polygon: LandPolygon,
  source: PolygonSource | null | undefined
): LandPolygon {
  return {
    ...polygon,
    nomorPersil: persilNumber(polygon.nomorPersil) ?? persilNumber(source?.nomorPersil),
    luasManual: measurement(polygon.luasManual) ?? measurement(source?.luasManual),
    panjang: measurement(polygon.panjang) ?? measurement(source?.panjangLahan),
    lebar: measurement(polygon.lebar) ?? measurement(source?.lebarLahan),
  };
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
    // A cleared input must store nothing, not `''` or 0: "not measured" and
    // "measured as zero" print differently on the certificate.
    nomorPersil: persilNumber(polygon.nomorPersil),
    luasManual: measurement(polygon.luasManual),
    panjang: measurement(polygon.panjang),
    lebar: measurement(polygon.lebar),
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
  return polygons.reduce((total, polygon) => total + polygonArea(polygon), 0);
}

/** Area of one bidang in m² (Shoelace), 0 when it is not a polygon yet. */
export function polygonArea(polygon: LandPolygon): number {
  const coordinates = validCoordinates(polygon.coordinates);
  if (coordinates.length < MIN_POLYGON_POINTS) return 0;
  return calculatePolygonArea(coordinates);
}

/**
 * What one bidang measured, ready to be printed or tabulated: its own persil
 * number and tape measurements beside the two areas — the one the map computes
 * and the one the surveyor recorded.
 */
export interface BidangRincian {
  id: string;
  /** 0-based position in the list. */
  index: number;
  /** "Bidang 2" or the KML placemark name. */
  label: string;
  nomorPersil?: string;
  /** m² measured at the patok, when it was. */
  luasManual?: number;
  panjang?: number;
  lebar?: number;
  /** m² from the drawn boundary. */
  luasHitung: number;
  /**
   * The area this bidang counts as: what was measured, falling back to what the
   * boundary computes. Never both, so the totals cannot double-count.
   */
  luasPengukuran: number;
}

export function bidangRincianList(polygons: LandPolygon[]): BidangRincian[] {
  return polygons.map((polygon, index) => {
    const luasHitung = polygonArea(polygon);
    const luasManual = measurement(polygon.luasManual);
    return {
      id: polygon.id,
      index,
      label: polygonLabel(polygon, index),
      nomorPersil: persilNumber(polygon.nomorPersil),
      luasManual,
      panjang: measurement(polygon.panjang),
      lebar: measurement(polygon.lebar),
      luasHitung,
      luasPengukuran: luasManual ?? luasHitung,
    };
  });
}

/**
 * Total manually measured area, or undefined when no bidang was measured by
 * hand at all — the difference matters: 0 m² would read as a measurement.
 */
export function totalLuasManual(polygons: LandPolygon[]): number | undefined {
  const measured = polygons
    .map((polygon) => measurement(polygon.luasManual))
    .filter((value): value is number => value !== undefined);
  return measured.length > 0 ? measured.reduce((total, value) => total + value, 0) : undefined;
}

/** The area the certificate states: measured where it was, computed elsewhere. */
export function totalLuasPengukuran(polygons: LandPolygon[]): number {
  return bidangRincianList(polygons).reduce(
    (total, bidang) => total + bidang.luasPengukuran,
    0
  );
}

/**
 * The pengajuan-level mirrors of the per-bidang fields, for the payload snapshot
 * and the `submissions.luas_manual` column.
 *
 * Luas manual is a **total** — it is summed across bidang, because that column
 * and the "(Manual: …)" line beside it describe the whole claim. The other three
 * cannot be summed, so they mirror the first bidang exactly as
 * `coordinatesGeografis` mirrors its ring.
 */
export function derivedBidangFields(polygons: LandPolygon[]): {
  nomorPersil?: string;
  luasManual?: number;
  panjangLahan?: number;
  lebarLahan?: number;
} {
  const first = polygons[0];
  return {
    nomorPersil: persilNumber(first?.nomorPersil),
    luasManual: totalLuasManual(polygons),
    panjangLahan: measurement(first?.panjang),
    lebarLahan: measurement(first?.lebar),
  };
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
