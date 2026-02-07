/**
 * Unified geospatial file parser supporting KMZ, KML, and GPX formats
 * Converts to GeoJSON Polygon format for backend submission
 */

export interface ParseResult {
  success: boolean;
  coordinates: Array<{
    id: string;
    latitude: number;
    longitude: number;
  }>;
  geoJSON?: {
    type: 'Polygon';
    coordinates: [[[number, number]]];
  };
  error?: string;
}

// Legacy type alias for backward compatibility
export type KMZParseResult = ParseResult;

/**
 * Parse KML file directly (not zipped)
 */
export async function parseKMLFile(file: File): Promise<ParseResult> {
  try {
    const content = await file.text();
    const coordinates = parseKMLCoordinates(content);

    if (coordinates.length === 0) {
      return {
        success: false,
        coordinates: [],
        error: 'Tidak ada koordinat yang ditemukan dalam file KML',
      };
    }

    console.log(coordinates);

    const validation = validatePolygonCoordinates(coordinates);
    if (!validation.valid) {
      return {
        success: false,
        coordinates: [],
        error: validation.error,
      };
    }

    const geoJSON = convertCoordinatesToGeoJSONPolygon(coordinates);

    return {
      success: true,
      coordinates,
      geoJSON,
    };
  } catch (error) {
    console.error('Error parsing KML:', error);
    return {
      success: false,
      coordinates: [],
      error: error instanceof Error ? error.message : 'Gagal membaca file KML',
    };
  }
}

/**
 * Parse GPX file and extract coordinates
 */
export async function parseGPXFile(file: File): Promise<ParseResult> {
  try {
    const content = await file.text();
    const coordinates = parseGPXCoordinates(content);

    if (coordinates.length === 0) {
      return {
        success: false,
        coordinates: [],
        error: 'Tidak ada koordinat yang ditemukan dalam file GPX',
      };
    }

    const validation = validatePolygonCoordinates(coordinates);
    if (!validation.valid) {
      return {
        success: false,
        coordinates: [],
        error: validation.error,
      };
    }

    const geoJSON = convertCoordinatesToGeoJSONPolygon(coordinates);

    return {
      success: true,
      coordinates,
      geoJSON,
    };
  } catch (error) {
    console.error('Error parsing GPX:', error);
    return {
      success: false,
      coordinates: [],
      error: error instanceof Error ? error.message : 'Gagal membaca file GPX',
    };
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

export async function parseKMZFile(file: File): Promise<KMZParseResult> {
  try {
    // Use JSZip to unzip the KMZ file
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    const zipData = await zip.loadAsync(file);

    // Find and read the KML file inside the zip
    let kmlContent: string | null = null;
    console.log(kmlContent);
    for (const filename in zipData.files) {
      if (filename.endsWith('.kml')) {
        const kmlFile = zipData.files[filename];
        kmlContent = await kmlFile.async('string');
        break;
      }
    }

    if (!kmlContent) {
      return {
        success: false,
        coordinates: [],
        error: 'File KML tidak ditemukan dalam KMZ',
      };
    }

    // Parse KML and extract coordinates
    const coordinates = parseKMLCoordinates(kmlContent);

    if (coordinates.length === 0) {
      return {
        success: false,
        coordinates: [],
        error: 'Tidak ada koordinat yang ditemukan dalam file KML',
      };
    }


    const validation = validatePolygonCoordinates(coordinates);
    if (!validation.valid) {
      return {
        success: false,
        coordinates: [],
        error: validation.error,
      };
    }

    const geoJSON = convertCoordinatesToGeoJSONPolygon(coordinates);
    return {
      success: true,
      coordinates,
      geoJSON,
    };
  } catch (error) {
    console.error('Error parsing KMZ:', error);
    return {
      success: false,
      coordinates: [],
      error: error instanceof Error ? error.message : 'Gagal membaca file KMZ',
    };
  }
}

/**
 * Parse KML string and extract coordinates from LinearRing elements
 */
function parseKMLCoordinates(
  kmlContent: string
): Array<{ id: string; latitude: number; longitude: number }> {
  try {
    console.log(kmlContent);
    // Parse XML
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(kmlContent, 'text/xml');

    if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
      throw new Error('Invalid KML format');
    }

    const coordinates: Array<{
      id: string;
      latitude: number;
      longitude: number;
    }> = [];

    // Find all LinearRing elements (polygon boundaries)
    const placemarks = xmlDoc.getElementsByTagName("Placemark");

    for (let i = 0; i < placemarks.length; i++) {
      const polygonElements = placemarks[i].getElementsByTagName("Polygon");
      if (polygonElements.length > 1){
        throw new Error("Placemark tidak boleh memiliki lebih dari 1 polygon");
      }
        const coordsString = polygonElements[0].getElementsByTagName("coordinates")[0].textContent ||
          "";
        const path = processCoordinates(coordsString);
        console.log(path);
        coordinates.push(...path.map(e=>({
          id: `placemark-${i}-polygon-${0}`,
          latitude: e.lat,
          longitude: e.lng,
        })));
    }

    console.log(coordinates);
    return coordinates;
  } catch (error) {
    console.error('Error parsing KML coordinates:', error);
    return [];
  }
}

const processCoordinates = (coordsString: string) => {
  return coordsString
    .trim()
    .split(" ")
    .map((coord) => {
      const [lng, lat] = coord.split(",").map(Number);
      return { lat, lng };
    });
};

/**
 * Validate if coordinates form a valid polygon
 * - At least 3 points
 * - Not self-intersecting (simplified check)
 */
export function validatePolygonCoordinates(
  coordinates: Array<{ latitude: number; longitude: number }>
): { valid: boolean; error?: string } {
  if (coordinates.length < 3) {
    return {
      valid: false,
      error: 'Minimal 3 titik koordinat diperlukan untuk membentuk polygon',
    };
  }

  if (coordinates.length > 100) {
    return {
      valid: false,
      error: 'Maksimal 100 titik koordinat',
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
 * Unified parser that detects file type and routes to appropriate parser
 */
export async function parseGeospatialFile(file: File): Promise<ParseResult> {
  const fileName = file.name.toLowerCase();
  const extension = fileName.split('.').pop();

  switch (extension) {
    case 'kmz':
      return parseKMZFile(file);
    case 'kml':
      return parseKMLFile(file);
    case 'gpx':
      return parseGPXFile(file);
    default:
      return {
        success: false,
        coordinates: [],
        error: `Format file tidak didukung. Format yang didukung: KMZ, KML, GPX`,
      };
  }
}
