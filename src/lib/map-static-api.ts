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
}

/**
 * Default configuration for SPPTG map images
 */
const DEFAULT_CONFIG: MapImageConfig = {
  width: 600,
  height: 600,
  zoom: 16,
  mapType: 'hybrid',
  fillColor: '3b82f6', // Blue
  strokeColor: '1d4ed8', // Darker blue
  strokeWeight: 2,
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
function calculateZoomLevel(coordinates: GeographicCoordinate[]): number {
  if (coordinates.length < 2) return 16;

  let minLat = coordinates[0].latitude;
  let maxLat = coordinates[0].latitude;
  let minLng = coordinates[0].longitude;
  let maxLng = coordinates[0].longitude;

  coordinates.forEach((coord) => {
    minLat = Math.min(minLat, coord.latitude);
    maxLat = Math.max(maxLat, coord.latitude);
    minLng = Math.min(minLng, coord.longitude);
    maxLng = Math.max(maxLng, coord.longitude);
  });

  const latDiff = maxLat - minLat;
  const lngDiff = maxLng - minLng;
  const maxDiff = Math.max(latDiff, lngDiff);

  // Calculate approximate zoom level
  // This is a rough approximation
  if (maxDiff > 0.1) return 12;
  if (maxDiff > 0.05) return 13;
  if (maxDiff > 0.02) return 14;
  if (maxDiff > 0.01) return 15;
  if (maxDiff > 0.005) return 16;
  return 17;
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
  const zoom = calculateZoomLevel(coordinates);
  const path = encodePath(coordinates);

  // Build the URL
  const params = new URLSearchParams({
    key: apiKey,
    center: `${centroid.lat},${centroid.lng}`,
    zoom: zoom.toString(),
    size: `${mergedConfig.width}x${mergedConfig.height}`,
    maptype: mergedConfig.mapType || 'hybrid',
    path: `fillcolor:0x${mergedConfig.fillColor}33|weight:${mergedConfig.strokeWeight}|color:0x${mergedConfig.strokeColor}FF|${path}|${coordinates[0].latitude},${coordinates[0].longitude}`,
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

  const centroid = options.center || calculateCentroid(coordinates);
  const zoom = options.zoom || calculateZoomLevel(coordinates);
  const width = options.size?.width || 600;
  const height = options.size?.height || 600;
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
