/**
 * Writing a boundary out as GeoJSON, KML or KMZ.
 *
 * Two places export geometry — a filed pengajuan (`kml-export.ts`) and a
 * Kawasan Non-SPPTG — and they used to disagree about what "download" meant:
 * the pengajuan offered KML and KMZ, the kawasan offered GeoJSON, and each had
 * its own copy of the anchor-and-object-URL dance. The three formats are the
 * same data in three envelopes, so they belong behind one builder: an office
 * handing a boundary to BPN, to ATR or to its own GIS desk should not have to
 * care which screen it came from.
 *
 * **All of it runs in the browser.** The pages already hold the geometry, so
 * there is nothing for the server to do and nothing to wait for.
 */

import type { GeoJSONMultiPolygon, GeoJSONPolygon } from '@/types';

/** The formats every geometry download offers. */
export const GEO_EXPORT_FORMATS = ['geojson', 'kml', 'kmz'] as const;
export type GeoExportFormat = (typeof GEO_EXPORT_FORMATS)[number];

type Geometry = GeoJSONPolygon | GeoJSONMultiPolygon;

/** One thing being exported: a boundary, plus what to say about it. */
export interface GeoExportFeature {
  name: string;
  /** Free text shown in Google Earth's balloon; also the GeoJSON `description`. */
  description?: string;
  /** Machine-readable attributes — KML `ExtendedData`, GeoJSON `properties`. */
  properties: Record<string, string | number | null | undefined>;
  geometry: Geometry | null | undefined;
}

/** KML is XML — every value interpolated into it has to be escaped. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Filesystems (and Windows in particular) reject these in a filename. */
export function sanitiseFilename(value: string, fallback = 'export'): string {
  return (
    value
      .replace(/[\\/:*?"<>|]/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || fallback
  );
}

/** The polygons of a geometry, each as its list of rings (outer ring first). */
export function geometryPolygons(geometry: Geometry | null | undefined): number[][][][] {
  if (!geometry) return [];
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates as number[][][][];
  }
  return [geometry.coordinates as number[][][]];
}

/** Polygons with a usable outer ring — anything else is not a boundary. */
export function usablePolygons(geometry: Geometry | null | undefined): number[][][][] {
  return geometryPolygons(geometry).filter((rings) => (rings[0]?.length ?? 0) >= 3);
}

/**
 * A KML LinearRing must be explicitly closed. Drawn polygons usually already
 * repeat the first vertex, but KML/KMZ imports and older rows do not always.
 */
function closeRing(ring: number[][]): number[][] {
  if (ring.length < 3) return ring;
  const [firstLng, firstLat] = ring[0];
  const [lastLng, lastLat] = ring[ring.length - 1];
  if (firstLng === lastLng && firstLat === lastLat) return ring;
  return [...ring, ring[0]];
}

/** KML orders each tuple lng,lat,altitude — the same order as GeoJSON. */
function ringToCoordinates(ring: number[][]): string {
  return closeRing(ring)
    .map(([lng, lat]) => `${lng},${lat},0`)
    .join(' ');
}

function extendedData(properties: GeoExportFeature['properties']): string {
  const entries = Object.entries(properties)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(
      ([name, value]) =>
        `        <Data name="${escapeXml(name)}"><value>${escapeXml(
          String(value)
        )}</value></Data>`
    )
    .join('\n');
  return entries ? `      <ExtendedData>\n${entries}\n      </ExtendedData>\n` : '';
}

/** The `<Polygon>` (or `<MultiGeometry>`) for one feature's boundary. */
function geometryXml(geometry: Geometry | null | undefined): string {
  const polygons = usablePolygons(geometry);
  if (polygons.length === 0) return '';

  // Inner rings are holes in the parcel. The app cannot draw them today, but a
  // KML import can carry them, so round-trip whatever is stored.
  const polygonXml = polygons
    .map((rings) => {
      const innerBoundaries = rings
        .slice(1)
        .filter((ring) => ring.length >= 3)
        .map(
          (ring) =>
            `          <innerBoundaryIs><LinearRing><coordinates>${ringToCoordinates(
              ring
            )}</coordinates></LinearRing></innerBoundaryIs>`
        )
        .join('\n');

      return `      <Polygon>
        <tessellate>1</tessellate>
        <altitudeMode>clampToGround</altitudeMode>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${ringToCoordinates(rings[0])}</coordinates>
          </LinearRing>
        </outerBoundaryIs>${innerBoundaries ? `\n${innerBoundaries}` : ''}
      </Polygon>`;
    })
    .join('\n');

  // Several parts go into one MultiGeometry Placemark so the feature stays a
  // single thing in whatever GIS desk opens it — a pengajuan of two bidang is
  // one claim, and a kawasan of forty blocks is one kawasan.
  return polygons.length > 1
    ? `      <MultiGeometry>\n${polygonXml}\n      </MultiGeometry>`
    : polygonXml;
}

export interface KMLDocumentOptions {
  documentName: string;
  documentDescription?: string;
  /** `aabbggrr` — KML's byte order, alpha first, and *not* the CSS one. */
  lineColor?: string;
  fillColor?: string;
}

const DEFAULT_LINE_COLOR = 'ff2563eb';
const DEFAULT_FILL_COLOR = '4d2563eb';

/**
 * A KML document holding one Placemark per feature.
 *
 * @throws when nothing has a usable boundary — an empty file that downloads
 * successfully is the worst of both outcomes.
 */
export function buildKML(
  features: readonly GeoExportFeature[],
  options: KMLDocumentOptions
): string {
  const drawable = features.filter((feature) => usablePolygons(feature.geometry).length > 0);
  if (drawable.length === 0) {
    throw new Error('Tidak ada polygon batas yang dapat diekspor.');
  }

  const placemarks = drawable
    .map(
      (feature) => `    <Placemark>
      <name>${escapeXml(feature.name)}</name>${
        feature.description
          ? `\n      <description>${escapeXml(feature.description)}</description>`
          : ''
      }
      <styleUrl>#batasLahan</styleUrl>
${extendedData(feature.properties)}${geometryXml(feature.geometry)}
    </Placemark>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(options.documentName)}</name>
    <description>${escapeXml(
      options.documentDescription ??
        'Diekspor dari SIAPTAH — Sistem Informasi Administrasi Pertanahan'
    )}</description>
    <Style id="batasLahan">
      <LineStyle>
        <color>${options.lineColor ?? DEFAULT_LINE_COLOR}</color>
        <width>3</width>
      </LineStyle>
      <PolyStyle>
        <color>${options.fillColor ?? DEFAULT_FILL_COLOR}</color>
      </PolyStyle>
    </Style>
${placemarks}
  </Document>
</kml>
`;
}

/**
 * Zip the KML into a KMZ. Google Earth expects the document at the archive
 * root and named `doc.kml`.
 *
 * JSZip is imported lazily: a page that only ever offers GeoJSON must not pay
 * for a zip library it never calls.
 */
export async function buildKMZ(kml: string): Promise<Blob> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  zip.file('doc.kml', kml);
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

/**
 * A GeoJSON FeatureCollection.
 *
 * @throws on the same condition as `buildKML`, so the three formats cannot
 * disagree about whether there was anything to export.
 */
export function buildGeoJSON(features: readonly GeoExportFeature[]): string {
  const drawable = features.filter((feature) => usablePolygons(feature.geometry).length > 0);
  if (drawable.length === 0) {
    throw new Error('Tidak ada polygon batas yang dapat diekspor.');
  }

  return JSON.stringify(
    {
      type: 'FeatureCollection',
      features: drawable.map((feature) => ({
        type: 'Feature',
        properties: {
          name: feature.name,
          ...(feature.description ? { description: feature.description } : {}),
          ...Object.fromEntries(
            Object.entries(feature.properties).filter(
              ([, value]) => value !== null && value !== undefined && value !== ''
            )
          ),
        },
        geometry: feature.geometry,
      })),
    },
    null,
    2
  );
}

const MIME_TYPES: Record<GeoExportFormat, string> = {
  geojson: 'application/geo+json;charset=utf-8',
  kml: 'application/vnd.google-earth.kml+xml;charset=utf-8',
  kmz: 'application/vnd.google-earth.kmz',
};

/** Human labels for the format menu, so the two screens word it identically. */
export const GEO_EXPORT_LABELS: Record<GeoExportFormat, string> = {
  geojson: 'Format GeoJSON',
  kml: 'Format KML',
  kmz: 'Format KMZ (Google Earth)',
};

/** Build the file for one format. Throws when there is no usable boundary. */
export async function buildGeoExport(
  features: readonly GeoExportFeature[],
  format: GeoExportFormat,
  options: KMLDocumentOptions
): Promise<Blob> {
  if (format === 'geojson') {
    return new Blob([buildGeoJSON(features)], { type: MIME_TYPES.geojson });
  }
  const kml = buildKML(features, options);
  if (format === 'kml') {
    return new Blob([kml], { type: MIME_TYPES.kml });
  }
  return buildKMZ(kml);
}

/**
 * Hand a blob to the browser as a download.
 *
 * The object URL is revoked on a timer rather than immediately: revoking
 * straight away cancels the download in Safari.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
