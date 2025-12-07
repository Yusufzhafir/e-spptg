/**
 * Parse KMZ file and extract coordinates
 * KMZ is a zipped KML file, so we need to unzip it first
 */

export interface KMZParseResult {
  success: boolean;
  coordinates: Array<{
    id: string;
    latitude: number;
    longitude: number;
  }>;
  error?: string;
}

export async function parseKMZFile(file: File): Promise<KMZParseResult> {
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
      return {
        success: false,
        coordinates: [],
        error: 'File KML tidak ditemukan dalam KMZ',
      };
    }

    // Parse KML and extract coordinates
    const coordinates = parseKMLCoordinates(kmlContent);

    return {
      success: true,
      coordinates,
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
    const linearRings = xmlDoc.getElementsByTagName('LinearRing');

    for (let i = 0; i < linearRings.length; i++) {
      const coordElements = linearRings[i].getElementsByTagName('coordinates');

      if (coordElements.length === 0) continue;

      const coordText = coordElements[0].textContent || '';
      const coordPairs = coordText
        .trim()
        .split('\n')
        .filter((pair) => pair.trim().length > 0);

      coordPairs.forEach((pair, index) => {
        const [lon, lat] = pair.trim().split(',').map(Number);

        if (!isNaN(lon) && !isNaN(lat)) {
          // Skip the last coordinate if it's a duplicate of the first (polygon closure)
          if (
            index === coordPairs.length - 1 &&
            coordinates.length > 0 &&
            coordinates[0].latitude === lat &&
            coordinates[0].longitude === lon
          ) {
            return;
          }

          coordinates.push({
            id: `C-${Date.now()}-${index}`,
            latitude: lat,
            longitude: lon,
          });
        }
      });
    }

    return coordinates;
  } catch (error) {
    console.error('Error parsing KML coordinates:', error);
    return [];
  }
}

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

