import { GeographicCoordinate } from '@/types';

/**
 * Convert GeographicCoordinate array to Google Maps LatLng array
 */
export function coordinatesToLatLng(
  coordinates: GeographicCoordinate[]
): google.maps.LatLng[] {
  return coordinates.map(
    (coord) => new google.maps.LatLng(coord.latitude, coord.longitude)
  );
}

/**
 * Convert Google Maps LatLng array to GeographicCoordinate array
 */
export function latLngToCoordinates(
  latLngs: google.maps.LatLng[],
  existingIds?: string[]
): GeographicCoordinate[] {
  return latLngs.map((latLng, index) => ({
    id: existingIds?.[index] || `C-${crypto.randomUUID()}-${index}`,
    latitude: latLng.lat(),
    longitude: latLng.lng(),
  }));
}

/**
 * Convert Google Maps Polygon path to GeographicCoordinate array
 */
export function polygonPathToCoordinates(
  path: google.maps.MVCArray<google.maps.LatLng>,
  existingIds?: string[]
): GeographicCoordinate[] {
  const latLngs: google.maps.LatLng[] = [];
  for (let i = 0; i < path.getLength(); i++) {
    latLngs.push(path.getAt(i));
  }
  return latLngToCoordinates(latLngs, existingIds);
}

/**
 * Convert GeographicCoordinate array to Google Maps Polygon path
 */
export function coordinatesToPolygonPath(
  coordinates: GeographicCoordinate[]
): google.maps.LatLng[] {
  return coordinatesToLatLng(coordinates);
}

/**
 * Convert geoJSON to Google Maps LatLng array
 */
export function geoJSONToLatLng(geoJSON: any): google.maps.LatLng[] {
  if (!geoJSON || !geoJSON.coordinates || !geoJSON.coordinates[0]) {
    return [];
  }

  // geoJSON format: coordinates[0] is array of [lng, lat] pairs
  const coords = geoJSON.coordinates[0];
  return coords.map((coord: number[]) => {
    // geoJSON uses [lng, lat], Google Maps uses [lat, lng]
    return new google.maps.LatLng(coord[1], coord[0]);
  });
}

/**
 * Convert Google Maps LatLng array to geoJSON format
 */
export function latLngToGeoJSON(latLngs: google.maps.LatLng[]): any {
  if (latLngs.length < 3) {
    return null;
  }

  // Close the polygon by adding the first point at the end
  const coordinates = latLngs.map((latLng) => [latLng.lng(), latLng.lat()]);
  coordinates.push(coordinates[0]); // Close the polygon

  return {
    type: 'Polygon',
    coordinates: [coordinates],
  };
}

/**
 * Calculate polygon area using Shoelace formula
 */
export function calculatePolygonArea(
  coordinates: GeographicCoordinate[]
): number {
  if (coordinates.length < 3) return 0;

  let area = 0;
  for (let i = 0; i < coordinates.length; i++) {
    const j = (i + 1) % coordinates.length;
    area += coordinates[i].longitude * coordinates[j].latitude;
    area -= coordinates[j].longitude * coordinates[i].latitude;
  }
  area = Math.abs(area / 2);

  // Convert to approximate m² (very rough estimate)
  const areaM2 = area * 111000 * 111000;
  return Math.round(areaM2);
}
