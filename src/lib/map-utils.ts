import { GeographicCoordinate, GeoJSONPolygon } from '@/types';

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
export function geoJSONToLatLng(
  geoJSON: GeoJSONPolygon | null | undefined
): google.maps.LatLng[] {
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
export function latLngToGeoJSON(
  latLngs: google.maps.LatLng[]
): GeoJSONPolygon | null {
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

export function coordinatesToGeoJSON(
  coordinates: GeographicCoordinate[]
): GeoJSONPolygon | null {
  if (coordinates.length < 3) return null;
  const polygon = coordinates.map((coord) => [coord.longitude, coord.latitude]);
  const [firstLng, firstLat] = polygon[0];
  const [lastLng, lastLat] = polygon[polygon.length - 1];
  if (firstLng !== lastLng || firstLat !== lastLat) {
    polygon.push([firstLng, firstLat]);
  }

  return {
    type: 'Polygon',
    coordinates: [polygon],
  };
}

/**
 * Extract outer-ring paths ({lat,lng}[]) from any GeoJSON geometry
 * (Polygon or MultiPolygon), accepting either a parsed object or a string
 * (e.g. the output of PostGIS ST_AsGeoJSON). One path per polygon.
 */
export function geoJSONToPaths(
  geometry: unknown
): { lat: number; lng: number }[][] {
  let geo = geometry;
  if (typeof geo === 'string') {
    try {
      geo = JSON.parse(geo);
    } catch {
      return [];
    }
  }

  const g = geo as { type?: string; coordinates?: unknown };
  if (!g || !g.coordinates) return [];

  const ringToPath = (ring: unknown): { lat: number; lng: number }[] => {
    if (!Array.isArray(ring)) return [];
    return ring
      .filter(
        (pt): pt is number[] =>
          Array.isArray(pt) &&
          pt.length >= 2 &&
          Number.isFinite(pt[0]) &&
          Number.isFinite(pt[1])
      )
      .map((pt) => ({ lat: pt[1], lng: pt[0] }));
  };

  if (g.type === 'Polygon') {
    const outer = (g.coordinates as unknown[])[0];
    const path = ringToPath(outer);
    return path.length >= 3 ? [path] : [];
  }

  if (g.type === 'MultiPolygon') {
    return (g.coordinates as unknown[])
      .map((polygon) => ringToPath((polygon as unknown[])[0]))
      .filter((path) => path.length >= 3);
  }

  return [];
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
