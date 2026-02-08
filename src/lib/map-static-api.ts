/**
 * Google Maps Static API Utility
 * 
 * This utility generates URLs for the Google Maps Static API
 * to create map images for the SPPTG PDF attachment.
 * 
 * Documentation: https://developers.google.com/maps/documentation/static-maps
 */

import { GeographicCoordinate } from '@/types';

/**
 * Configuration for map image generation
 */
interface MapImageConfig {
  /** Map width in pixels */
  width?: number;
  /** Map height in pixels */
  height?: number;
  /** Zoom level (1-20) */
  zoom?: number;
  /** Map type (roadmap, satellite, hybrid, terrain) */
  mapType?: 'roadmap' | 'satellite' | 'hybrid' | 'terrain';
  /** Polygon fill color (hex without #) */
  fillColor?: string;
  /** Polygon stroke color (hex without #) */
  strokeColor?: string;
  /** Polygon stroke weight */
  strokeWeight?: number;
  /** Image scale multiplier for better quality */
  scale?: 1 | 2;
  /** Zoom out levels to include surrounding places */
  contextZoomOut?: number;
}

/**
 * Default configuration for SPPTG map images
 */
const DEFAULT_CONFIG: MapImageConfig = {
  width: 640,
  height: 420,
  zoom: 16,
  mapType: 'roadmap',
  fillColor: '3b82f6', // Blue
  strokeColor: '1d4ed8', // Darker blue
  strokeWeight: 3,
  scale: 2,
  contextZoomOut: 1,
};

type Bounds = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

/**
 * Calculate the centroid of a polygon from coordinates
 */
function calculateCentroid(coordinates: GeographicCoordinate[]): { lat: number; lng: number } {
  if (coordinates.length === 0) {
    return { lat: 0, lng: 0 };
  }

  let latSum = 0;
  let lngSum = 0;

  coordinates.forEach((coord) => {
    latSum += coord.latitude;
    lngSum += coord.longitude;
  });

  return {
    lat: latSum / coordinates.length,
    lng: lngSum / coordinates.length,
  };
}

/**
 * Calculate zoom level based on coordinate spread
 * This helps ensure the polygon fits within the image
 */
function calculateBounds(coordinates: GeographicCoordinate[]): Bounds {
  return coordinates.reduce<Bounds>(
    (acc, coord) => ({
      minLat: Math.min(acc.minLat, coord.latitude),
      maxLat: Math.max(acc.maxLat, coord.latitude),
      minLng: Math.min(acc.minLng, coord.longitude),
      maxLng: Math.max(acc.maxLng, coord.longitude),
    }),
    {
      minLat: coordinates[0].latitude,
      maxLat: coordinates[0].latitude,
      minLng: coordinates[0].longitude,
      maxLng: coordinates[0].longitude,
    }
  );
}

/**
 * Calculate zoom level so polygon fits in the image and still shows nearby landmarks.
 * This intentionally zooms out one extra level by default.
 */
function calculateZoomLevel(
  coordinates: GeographicCoordinate[],
  width: number,
  height: number,
  contextZoomOut = 1
): number {
  if (coordinates.length < 2) return Math.max(12, 16 - contextZoomOut);

  const bounds = calculateBounds(coordinates);
  const latDiff = Math.max(bounds.maxLat - bounds.minLat, 0.00001);
  const lngDiff = Math.max(bounds.maxLng - bounds.minLng, 0.00001);

  // Keep 80% of viewport for polygon to leave surroundings visible
  const usableWidth = width * 0.8;
  const usableHeight = height * 0.8;

  const zoomForLng = Math.log2((usableWidth * 360) / (lngDiff * 256));
  const zoomForLat = Math.log2((usableHeight * 170) / (latDiff * 256));
  const rawZoom = Math.floor(Math.min(zoomForLng, zoomForLat));
  const contextualZoom = rawZoom - contextZoomOut;

  return Math.max(8, Math.min(20, contextualZoom));
}

/**
 * Encode coordinates for Google Maps Static API path parameter
 */
function encodePath(coordinates: GeographicCoordinate[]): string {
  return coordinates
    .map((coord) => `${coord.latitude},${coord.longitude}`)
    .join('|');
}

/**
 * Polyline encoding to keep Google Static Maps URL short/stable for bigger polygons.
 * Reference: https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
function encodeSigned(value: number): string {
  let encoded = '';
  let shifted = value < 0 ? ~(value << 1) : value << 1;

  while (shifted >= 0x20) {
    encoded += String.fromCharCode((0x20 | (shifted & 0x1f)) + 63);
    shifted >>= 5;
  }
  encoded += String.fromCharCode(shifted + 63);

  return encoded;
}

function encodePolyline(coordinates: GeographicCoordinate[]): string {
  let encoded = '';
  let prevLat = 0;
  let prevLng = 0;

  for (const coord of coordinates) {
    const lat = Math.round(coord.latitude * 1e5);
    const lng = Math.round(coord.longitude * 1e5);
    encoded += encodeSigned(lat - prevLat);
    encoded += encodeSigned(lng - prevLng);
    prevLat = lat;
    prevLng = lng;
  }

  return encoded;
}

/**
 * Generate Google Maps Static API URL for a land polygon
 * 
 * @param coordinates - Array of geographic coordinates forming the polygon
 * @param config - Optional configuration for the map image
 * @returns URL string for the Google Maps Static API
 */
export function generateStaticMapUrl(
  coordinates: GeographicCoordinate[],
  config: MapImageConfig = {}
): string | null {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) {
    console.warn('Google Maps API key not found');
    return null;
  }

  if (coordinates.length < 3) {
    console.warn('At least 3 coordinates required to form a polygon');
    return null;
  }

  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const centroid = calculateCentroid(coordinates);
  const zoom = calculateZoomLevel(
    coordinates,
    mergedConfig.width || DEFAULT_CONFIG.width!,
    mergedConfig.height || DEFAULT_CONFIG.height!,
    mergedConfig.contextZoomOut ?? DEFAULT_CONFIG.contextZoomOut
  );
  const closedCoordinates = [...coordinates, coordinates[0]];
  const encodedPath = encodePolyline(closedCoordinates);

  // Build the URL
  const params = new URLSearchParams({
    key: apiKey,
    center: `${centroid.lat},${centroid.lng}`,
    zoom: zoom.toString(),
    size: `${mergedConfig.width}x${mergedConfig.height}`,
    scale: String(mergedConfig.scale || 1),
    maptype: mergedConfig.mapType || 'roadmap',
    path: `fillcolor:0x${mergedConfig.fillColor}55|weight:${mergedConfig.strokeWeight}|color:0x${mergedConfig.strokeColor}FF|enc:${encodedPath}`,
  });

  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

/**
 * Generate a map image URL with custom styling
 * 
 * This function allows more control over the map appearance
 */
export function generateStyledMapUrl(
  coordinates: GeographicCoordinate[],
  options: {
    center?: { lat: number; lng: number };
    zoom?: number;
    size?: { width: number; height: number };
    markers?: Array<{ lat: number; lng: number; label?: string }>;
  }
): string | null {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) {
    console.warn('Google Maps API key not found');
    return null;
  }

  if (coordinates.length < 3) {
    console.warn('At least 3 coordinates required');
    return null;
  }

  const width = options.size?.width || 600;
  const height = options.size?.height || 600;
  const centroid = options.center || calculateCentroid(coordinates);
  const zoom = options.zoom || calculateZoomLevel(coordinates, width, height);
  const path = encodePath(coordinates);

  const params = new URLSearchParams({
    key: apiKey,
    center: `${centroid.lat},${centroid.lng}`,
    zoom: zoom.toString(),
    size: `${width}x${height}`,
    maptype: 'hybrid',
    path: `fillcolor:0x3b82f633|weight:2|color:0x1d4ed8FF|${path}|${coordinates[0].latitude},${coordinates[0].longitude}`,
  });

  // Add markers if provided
  if (options.markers && options.markers.length > 0) {
    options.markers.forEach((marker) => {
      const markerParam = marker.label
        ? `markers=color:red|label:${marker.label}|${marker.lat},${marker.lng}`
        : `markers=color:red|${marker.lat},${marker.lng}`;
      params.append('markers', markerParam);
    });
  }

  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

/**
 * Fetch map image as base64 data URL
 * 
 * This can be used to embed the map directly in the PDF
 */
export async function fetchMapImageAsBase64(
  coordinates: GeographicCoordinate[]
): Promise<string | null> {
  const url = generateStaticMapUrl(coordinates);
  
  if (!url) return null;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch map: ${response.statusText}`);
    }

    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error fetching map image:', error);
    return null;
  }
}
