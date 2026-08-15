/**
 * ESRI Shapefile reader, for the .zip a surveyor exports from ArcGIS or QGIS.
 *
 * A shapefile is never one file: the geometry lives in `.shp`, the attributes in
 * `.dbf`, the index in `.shx`, the coordinate system in `.prj` and the attribute
 * encoding in `.cpg`. They are handed around zipped together, which is exactly
 * what this accepts — the parts are useless apart, so there is nothing to gain
 * from letting them be uploaded one at a time.
 *
 * **The `.prj` matters more than anything else here.** Survey data for Kutai
 * Timur routinely arrives projected in UTM metres (zone 50N/51N), and a boundary
 * read as if those metres were degrees lands somewhere off the coast of Africa.
 * shpjs reprojects to WGS84 through proj4 (already a dependency) when the `.prj`
 * is there; when it is not, the numbers come through as they sit in the file, so
 * the result is checked for being degrees at all and refused with a message
 * naming the missing `.prj`. Nothing here guesses a projection — a guess is
 * precisely what would file a parcel in the wrong place without saying so.
 *
 * Output is deliberately identical to the KML reader's, so the wizard and the
 * kawasan importer cannot tell which format they were handed.
 */

import {
  buildParseResult,
  parseFailure,
  type ParsedCoordinate,
  type ParsedPolygon,
  type ParseOptions,
  type ParseResult,
} from './kmz-parser';

/** Every part of a shapefile set, so a caller can say what is missing. */
export const SHAPEFILE_EXTENSIONS = ['shp', 'dbf', 'shx', 'prj', 'cpg'] as const;

/**
 * Attribute columns a surveyor's shapefile tends to carry the parcel name in.
 * `NAMOBJ` is the one in the national RBI schema; the rest are what turns up in
 * kabupaten data in practice.
 */
const NAME_FIELDS = [
  'nama',
  'name',
  'namobj',
  'nama_objek',
  'label',
  'keterangan',
  'nm_kawasan',
  'namakawasan',
  'nama_kws',
  'persil',
  'no_persil',
  'nomor_persil',
];

type GeoJsonPosition = number[];
type GeoJsonProperties = Record<string, unknown> | null | undefined;

interface GeoJsonFeature {
  geometry?: {
    type?: string;
    coordinates?: unknown;
  } | null;
  properties?: GeoJsonProperties;
}

interface GeoJsonFeatureCollection {
  features?: GeoJsonFeature[];
  fileName?: string;
}

/** The parcel's name from its attribute row, when one of the usual columns holds it. */
function featureName(properties: GeoJsonProperties): string | undefined {
  if (!properties) return undefined;

  for (const [key, value] of Object.entries(properties)) {
    if (!NAME_FIELDS.includes(key.trim().toLowerCase())) continue;
    const text = typeof value === 'string' ? value.trim() : '';
    if (text) return text;
  }

  return undefined;
}

/** Outer rings of one feature; a hole (ring 2+) is never the boundary. */
function outerRings(geometry: GeoJsonFeature['geometry']): GeoJsonPosition[][] {
  if (!geometry || !Array.isArray(geometry.coordinates)) return [];

  if (geometry.type === 'Polygon') {
    const [ring] = geometry.coordinates as GeoJsonPosition[][];
    return Array.isArray(ring) ? [ring] : [];
  }

  if (geometry.type === 'MultiPolygon') {
    return (geometry.coordinates as GeoJsonPosition[][][])
      .map((polygon) => polygon?.[0])
      .filter((ring): ring is GeoJsonPosition[] => Array.isArray(ring));
  }

  // Points and lines are not a parcel boundary — skipped, not an error: a
  // surveyor's zip often carries a patok layer beside the bidang layer.
  return [];
}

function ringToCoordinates(ring: GeoJsonPosition[], idPrefix: string): ParsedCoordinate[] {
  return ring.map((position, index) => {
    const longitude = Number(position?.[0]);
    const latitude = Number(position?.[1]);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new Error(`Koordinat tidak valid pada titik ke-${index + 1}`);
    }

    return { id: `${idPrefix}-point-${index}`, latitude, longitude };
  });
}

/**
 * Every polygon in the parsed layers, in file order — the same contract as
 * `parseKMLPolygons`.
 */
export function shapefileGeoJSONToPolygons(
  collections: GeoJsonFeatureCollection[]
): ParsedPolygon[] {
  const polygons: ParsedPolygon[] = [];

  collections.forEach((collection, collectionIndex) => {
    const features = collection?.features ?? [];

    features.forEach((feature, featureIndex) => {
      const rings = outerRings(feature?.geometry);
      const name = featureName(feature?.properties);

      rings.forEach((ring, ringIndex) => {
        const coordinates = ringToCoordinates(
          ring,
          `shp-${collectionIndex}-${featureIndex}-${ringIndex}`
        );
        if (coordinates.length === 0) return;

        polygons.push({
          // A MultiPolygon row shares one attribute name across its parts, so
          // number them — otherwise a batch import shows the same label twice.
          name: rings.length > 1 && name ? `${name} (${ringIndex + 1})` : name,
          coordinates,
        });
      });
    });
  });

  return polygons;
}

/**
 * Whether the parsed rings are longitude/latitude at all.
 *
 * Without a `.prj` shpjs hands back whatever units the file holds, and UTM
 * metres (easting ~500 000) are not a coordinate this system can store. Catching
 * it here turns a parcel that would have been dropped somewhere in the Atlantic
 * — or silently discarded later by `validCoordinates` — into an error that says
 * what to fix.
 */
function looksLikeDegrees(polygons: ParsedPolygon[]): boolean {
  return polygons.every((polygon) =>
    polygon.coordinates.every(
      (coordinate) =>
        Math.abs(coordinate.latitude) <= 90 && Math.abs(coordinate.longitude) <= 180
    )
  );
}

/** True when the archive actually holds a `.shp`, rather than a KMZ or a stray zip. */
export async function zipContainsShapefile(file: File): Promise<boolean> {
  try {
    const JSZip = (await import('jszip')).default;
    // Read the bytes ourselves rather than handing JSZip the File: its Blob
    // support is a browser affordance, and this has to give the same answer
    // under Node (tests, and anything that ever runs this server-side).
    const zip = await new JSZip().loadAsync(await file.arrayBuffer());
    return Object.keys(zip.files).some(
      (name) => !name.includes('__MACOSX') && name.toLowerCase().endsWith('.shp')
    );
  } catch {
    return false;
  }
}

/**
 * Parse a zipped shapefile into the same result every other importer returns.
 *
 * shpjs is imported lazily: it drags in proj4 and a DBF reader, and the wizard
 * must not pay for that on a page where nobody uploads anything.
 */
export async function parseShapefileZip(
  file: File,
  options: ParseOptions = {}
): Promise<ParseResult> {
  try {
    const buffer = await file.arrayBuffer();
    const { default: shp } = await import('shpjs');
    const parsed = await shp(buffer);
    const collections = (
      Array.isArray(parsed) ? parsed : [parsed]
    ) as GeoJsonFeatureCollection[];

    const polygons = shapefileGeoJSONToPolygons(collections);

    if (!looksLikeDegrees(polygons)) {
      return parseFailure(
        'Koordinat shapefile bukan derajat (WGS 84). Sertakan file .prj agar sistem dapat mengubah koordinat UTM ke WGS 84, lalu unggah ulang.'
      );
    }

    return buildParseResult(
      polygons,
      'Tidak ada polygon yang ditemukan dalam shapefile. Pastikan layer berisi bidang (polygon), bukan titik atau garis.',
      options
    );
  } catch (error) {
    console.error('Error parsing shapefile:', error);
    const message = error instanceof Error ? error.message : '';

    // shpjs's own wording, translated into something an operator can act on.
    if (message.includes('no layers founds')) {
      return parseFailure(
        'File ZIP tidak berisi shapefile (.shp). Pastikan seluruh berkas shapefile (.shp, .dbf, .shx, .prj) ikut dikompres.'
      );
    }

    return parseFailure(
      message ? `Gagal memproses shapefile: ${message}` : 'Gagal memproses shapefile'
    );
  }
}
