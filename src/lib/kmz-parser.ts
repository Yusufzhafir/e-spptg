/**
 * Unified geospatial file parser supporting KMZ, KML, and GPX formats
 * Converts to GeoJSON Polygon format for backend submission
 */

export interface ParsedCoordinate {
  id: string;
  latitude: number;
  longitude: number;
}

/**
 * One polygon out of the file. A KML may carry several — a pengajuan can consist
 * of more than one bidang, and a kawasan import is usually a whole batch — so
 * the parser returns all of them and lets the caller decide how many it wants.
 */
export interface ParsedPolygon {
  /** `<name>` of the owning Placemark, when it had one. */
  name?: string;
  coordinates: ParsedCoordinate[];
}

export interface ParseResult {
  success: boolean;
  /**
   * The first polygon's ring, kept so callers that only ever handle a single
   * boundary keep working unchanged. Read `polygons` for the whole file.
   */
  coordinates: ParsedCoordinate[];
  polygons: ParsedPolygon[];
  geoJSON?: {
    type: 'Polygon';
    coordinates: [[[number, number]]];
  };
  error?: string;
}

// Legacy type alias for backward compatibility
export type KMZParseResult = ParseResult;

/** Failure shape shared by every parser entry point. */
export function parseFailure(error: string): ParseResult {
  return { success: false, coordinates: [], polygons: [], error };
}

/**
 * Vertices one polygon may carry, and who the ceiling is for.
 *
 * A **pengajuan** keeps its boundary in `submission_drafts.payload` as JSON, and
 * `landPolygonSchema` refuses more than this per bidang — so an import that
 * exceeded it would only fail later, on save, with the work already done.
 *
 * A **kawasan** has no such ceiling: its geometry goes straight into a PostGIS
 * `geometry(MultiPolygon,4326)` column, and the boundaries that go in there are
 * whole Kawasan Hutan traced from an SK — hundreds or thousands of vertices is
 * what those files legitimately look like. Refusing them was the wizard's rule
 * leaking onto a page it never applied to, so that caller passes
 * {@link UNLIMITED_POLYGON_POINTS}.
 */
export const DEFAULT_MAX_POLYGON_POINTS = 100;
export const UNLIMITED_POLYGON_POINTS = Number.POSITIVE_INFINITY;

/** How strictly an importer checks the polygons it read. */
export interface ParseOptions {
  /** Vertices allowed per polygon. Defaults to {@link DEFAULT_MAX_POLYGON_POINTS}. */
  maxPoints?: number;
}

/**
 * Validate every polygon found and package them into a ParseResult.
 * The first polygon doubles as the flat `coordinates`/`geoJSON` result.
 *
 * Exported for the shapefile reader (`./shapefile-parser`), which lives in its
 * own module so shpjs stays out of the bundle until someone imports a .zip, but
 * must produce results this one's callers cannot tell apart.
 */
export function buildParseResult(
  polygons: ParsedPolygon[],
  emptyError: string,
  options: ParseOptions = {}
): ParseResult {
  if (polygons.length === 0) {
    return parseFailure(emptyError);
  }

  for (const [index, polygon] of polygons.entries()) {
    const validation = validatePolygonCoordinates(polygon.coordinates, options);
    if (!validation.valid) {
      const label = polygon.name?.trim() || `Polygon ${index + 1}`;
      return parseFailure(`${label}: ${validation.error}`);
    }
  }

  return {
    success: true,
    coordinates: polygons[0].coordinates,
    polygons,
    geoJSON: convertCoordinatesToGeoJSONPolygon(polygons[0].coordinates),
  };
}

/**
 * Parse KML file directly (not zipped)
 */
export async function parseKMLFile(
  file: File,
  options: ParseOptions = {}
): Promise<ParseResult> {
  try {
    const content = await file.text();
    const polygons = parseKMLPolygons(content);

    return buildParseResult(
      polygons,
      'Tidak ada koordinat yang ditemukan dalam file KML',
      options
    );
  } catch (error) {
    console.error('Error parsing KML:', error);
    return parseFailure(
      error instanceof Error ? error.message : 'Gagal membaca file KML'
    );
  }
}

/**
 * Parse GPX file and extract coordinates
 */
export async function parseGPXFile(
  file: File,
  options: ParseOptions = {}
): Promise<ParseResult> {
  try {
    const content = await file.text();
    const coordinates = parseGPXCoordinates(content);

    // A GPX track is a single path — one polygon, never a batch.
    const polygons: ParsedPolygon[] =
      coordinates.length > 0 ? [{ coordinates }] : [];

    return buildParseResult(
      polygons,
      'Tidak ada koordinat yang ditemukan dalam file GPX',
      options
    );
  } catch (error) {
    console.error('Error parsing GPX:', error);
    return parseFailure(
      error instanceof Error ? error.message : 'Gagal membaca file GPX'
    );
  }
}

/**
 * Parse GPX XML and extract coordinates from track points, route points, or waypoints
 */
function parseGPXCoordinates(
  gpxContent: string
): Array<{ id: string; latitude: number; longitude: number }> {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(gpxContent, 'text/xml');

    if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
      throw new Error('Invalid GPX format');
    }

    const coordinates: Array<{
      id: string;
      latitude: number;
      longitude: number;
    }> = [];

    // Try to get track points first (most common for routes/paths)
    const trackPoints = xmlDoc.getElementsByTagName('trkpt');
    if (trackPoints.length > 0) {
      for (let i = 0; i < trackPoints.length; i++) {
        const point = trackPoints[i];
        const lat = parseFloat(point.getAttribute('lat') || '');
        const lon = parseFloat(point.getAttribute('lon') || '');

        if (!isNaN(lat) && !isNaN(lon)) {
          coordinates.push({
            id: `trkpt-${i}`,
            latitude: lat,
            longitude: lon,
          });
        }
      }
    }

    // If no track points, try route points
    if (coordinates.length === 0) {
      const routePoints = xmlDoc.getElementsByTagName('rtept');
      if (routePoints.length > 0) {
        for (let i = 0; i < routePoints.length; i++) {
          const point = routePoints[i];
          const lat = parseFloat(point.getAttribute('lat') || '');
          const lon = parseFloat(point.getAttribute('lon') || '');

          if (!isNaN(lat) && !isNaN(lon)) {
            coordinates.push({
              id: `rtept-${i}`,
              latitude: lat,
              longitude: lon,
            });
          }
        }
      }
    }

    // If still no coordinates, try waypoints (less common for polygons)
    if (coordinates.length === 0) {
      const waypoints = xmlDoc.getElementsByTagName('wpt');
      if (waypoints.length > 0) {
        for (let i = 0; i < waypoints.length; i++) {
          const point = waypoints[i];
          const lat = parseFloat(point.getAttribute('lat') || '');
          const lon = parseFloat(point.getAttribute('lon') || '');

          if (!isNaN(lat) && !isNaN(lon)) {
            coordinates.push({
              id: `wpt-${i}`,
              latitude: lat,
              longitude: lon,
            });
          }
        }
      }
    }

    return coordinates;
  } catch (error) {
    console.error('Error parsing GPX coordinates:', error);
    return [];
  }
}

export async function parseKMZFile(
  file: File,
  options: ParseOptions = {}
): Promise<KMZParseResult> {
  try {
    // Use JSZip to unzip the KMZ file
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    const zipData = await zip.loadAsync(file);

    // Find and read the KML file inside the zip
    let kmlContent: string | null = null;
    for (const filename in zipData.files) {
      if (filename.endsWith('.kml')) {
        const kmlFile = zipData.files[filename];
        kmlContent = await kmlFile.async('string');
        break;
      }
    }

    if (!kmlContent) {
      return parseFailure('File KML tidak ditemukan dalam KMZ');
    }

    const polygons = parseKMLPolygons(kmlContent);

    return buildParseResult(
      polygons,
      'Tidak ada koordinat yang ditemukan dalam file KML',
      options
    );
  } catch (error) {
    console.error('Error parsing KMZ:', error);
    return parseFailure(
      error instanceof Error ? error.message : 'Gagal membaca file KMZ'
    );
  }
}

/** Read the `<name>` a Placemark declares directly (not a child feature's). */
function placemarkName(placemark: Element): string | undefined {
  const names = placemark.getElementsByTagName('name');
  for (let i = 0; i < names.length; i++) {
    if (names[i].parentNode === placemark) {
      return names[i].textContent?.trim() || undefined;
    }
  }
  return undefined;
}

/**
 * The outer ring of a `<Polygon>`.
 *
 * `outerBoundaryIs` is preferred over the first `<coordinates>` descendant so an
 * `innerBoundaryIs` (a hole) is never mistaken for the boundary itself; files
 * that omit the wrapper fall back to the first coordinates element.
 */
function polygonOuterRing(polygon: Element): Array<{ lat: number; lng: number }> {
  const outerBoundary = polygon.getElementsByTagName('outerBoundaryIs')[0];
  const coordinateElements = (outerBoundary ?? polygon).getElementsByTagName(
    'coordinates'
  );
  if (coordinateElements.length === 0) {
    throw new Error('Elemen coordinates pada polygon tidak ditemukan');
  }

  const coordsString = coordinateElements[0].textContent?.trim() || '';
  if (!coordsString) {
    throw new Error('Koordinat polygon kosong');
  }

  const path = processCoordinates(coordsString);
  if (path.length === 0) {
    throw new Error('Tidak ada koordinat valid pada polygon');
  }

  return path;
}

/**
 * Every polygon in a KML document, in file order.
 *
 * A Placemark may hold more than one `<Polygon>` (inside a `<MultiGeometry>`),
 * and a document may hold any number of Placemarks — all of them are returned.
 * Names are taken from the Placemark so a batch import can label each row.
 */
export function parseKMLPolygons(kmlContent: string): ParsedPolygon[] {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(kmlContent, 'text/xml');

  if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Format KML tidak valid');
  }

  const placemarks = xmlDoc.getElementsByTagName('Placemark');
  const polygons: ParsedPolygon[] = [];

  for (let i = 0; i < placemarks.length; i++) {
    const placemark = placemarks[i];
    const polygonElements = placemark.getElementsByTagName('Polygon');
    if (polygonElements.length === 0) continue;

    const name = placemarkName(placemark);

    for (let j = 0; j < polygonElements.length; j++) {
      const ring = polygonOuterRing(polygonElements[j]);
      polygons.push({
        // A multi-geometry Placemark shares one name across its parts, so number
        // them — otherwise a batch import shows the same label several times.
        name: polygonElements.length > 1 && name ? `${name} (${j + 1})` : name,
        coordinates: ring.map((coord, index) => ({
          id: `placemark-${i}-polygon-${j}-point-${index}`,
          latitude: coord.lat,
          longitude: coord.lng,
        })),
      });
    }
  }

  return polygons;
}

const processCoordinates = (coordsString: string): Array<{ lat: number; lng: number }> => {
  return coordsString
    .trim()
    .split(/\s+/)
    .filter((coord) => coord.length > 0)
    .map((coord, index) => {
      const [lngRaw, latRaw] = coord.split(',');
      const lng = Number(lngRaw);
      const lat = Number(latRaw);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new Error(`Koordinat tidak valid pada titik ke-${index + 1}`);
      }

      return { lat, lng };
    });
};

/**
 * Validate if coordinates form a valid polygon
 * - At least 3 points
 * - Not self-intersecting (simplified check)
 */
export function validatePolygonCoordinates(
  coordinates: Array<{ latitude: number; longitude: number }>,
  options: ParseOptions = {}
): { valid: boolean; error?: string } {
  const maxPoints = options.maxPoints ?? DEFAULT_MAX_POLYGON_POINTS;

  if (coordinates.length < 3) {
    return {
      valid: false,
      error: 'Minimal 3 titik koordinat diperlukan untuk membentuk polygon',
    };
  }

  if (coordinates.length > maxPoints) {
    return {
      valid: false,
      error: `Maksimal ${maxPoints} titik koordinat`,
    };
  }

  // Check for duplicate consecutive coordinates
  for (let i = 0; i < coordinates.length - 1; i++) {
    if (
      coordinates[i].latitude === coordinates[i + 1].latitude &&
      coordinates[i].longitude === coordinates[i + 1].longitude
    ) {
      return {
        valid: false,
        error: 'Ditemukan koordinat duplikat yang berurutan',
      };
    }
  }

  return { valid: true };
}

/**
 * Convert coordinates array to GeoJSON Polygon format
 * GeoJSON format: { type: 'Polygon', coordinates: [[[lon, lat], [lon, lat], ...]] }
 * Note: GeoJSON uses [longitude, latitude] order (not lat, lon)
 */
export function convertCoordinatesToGeoJSONPolygon(
  coordinates: Array<{ latitude: number; longitude: number }>
): { type: 'Polygon'; coordinates: [[[number, number]]] } {
  // Convert to GeoJSON coordinate format [lon, lat]
  const geoJSONCoords: [number, number][] = coordinates.map((coord) => [
    coord.longitude,
    coord.latitude,
  ]);

  // Ensure polygon is closed (first coordinate == last coordinate)
  const firstCoord = geoJSONCoords[0];
  const lastCoord = geoJSONCoords[geoJSONCoords.length - 1];

  if (
    firstCoord[0] !== lastCoord[0] ||
    firstCoord[1] !== lastCoord[1]
  ) {
    // Close the polygon by adding the first coordinate at the end
    geoJSONCoords.push([firstCoord[0], firstCoord[1]]);
  }

  return {
    type: 'Polygon',
    coordinates: [geoJSONCoords] as [[[number, number]]],
  };
}

/**
 * Unified parser that detects file type and routes to appropriate parser.
 *
 * A `.zip` is read as an ESRI shapefile set — that archive is how ArcGIS and
 * QGIS hand a boundary over, and its parts (.shp/.dbf/.shx/.prj/.cpg) are
 * useless apart. The reader is loaded on demand, so shpjs and its projection
 * tables never reach a bundle nobody imports a shapefile in.
 */
export async function parseGeospatialFile(
  file: File,
  options: ParseOptions = {}
): Promise<ParseResult> {
  const fileName = file.name.toLowerCase();
  const extension = fileName.split('.').pop();

  switch (extension) {
    case 'kmz':
      return parseKMZFile(file, options);
    case 'kml':
      return parseKMLFile(file, options);
    case 'gpx':
      return parseGPXFile(file, options);
    case 'zip': {
      const { parseShapefileZip, zipContainsShapefile } = await import(
        './shapefile-parser'
      );
      // No .shp inside almost always means a KMZ that was renamed or re-zipped;
      // reading it as one beats telling the operator their file is unsupported.
      return (await zipContainsShapefile(file))
        ? parseShapefileZip(file, options)
        : parseKMZFile(file, options);
    }
    default:
      return parseFailure(
        'Format file tidak didukung. Format yang didukung: KML, KMZ, GPX, dan ZIP berisi shapefile (.shp, .dbf, .shx, .prj)'
      );
  }
}
