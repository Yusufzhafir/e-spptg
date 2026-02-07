'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { APIProvider, Map, useMap ,useMapsLibrary} from '@vis.gl/react-google-maps';
import { GeographicCoordinate } from '@/types';
import {
  coordinatesToLatLng,
  polygonPathToCoordinates,
} from '@/lib/map-utils';
import { MapPin } from 'lucide-react';

interface DrawingMapProps {
  coordinates: GeographicCoordinate[];
  onCoordinatesChange: (coords: GeographicCoordinate[]) => void;
  center?: {
    lat: number;
    lng: number;  
  };
  zoom?: number;
}

type PolygonWithListeners = google.maps.Polygon & {
  __listeners?: google.maps.MapsEventListener[];
};

// Internal component that uses the map instance
function DrawingMapInternal({
  coordinates,
  onCoordinatesChange,
  center = {
    lat: 0.6164979547396072,
    lng: 117.32086147991855,
  },
  zoom = 13,
}: DrawingMapProps) {
  const map = useMap();
  const polygonRef = useRef<google.maps.Polygon | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const isUpdatingFromMapRef = useRef(false);
  const isUpdatingFromPropsRef = useRef(false);
  const drawingManagerRef = useRef<google.maps.drawing.DrawingManager | null>(
    null
  );
  const drawing = useMapsLibrary('drawing');

  // Centralized cleanup function for polygon and its listeners
  const cleanupPolygon = useCallback(() => {
    if (polygonRef.current) {
      const listeners = (polygonRef.current as PolygonWithListeners).__listeners;
      if (listeners) {
        listeners.forEach((listener: google.maps.MapsEventListener) => {
          google.maps.event.removeListener(listener);
        });
      }
      polygonRef.current.setMap(null);
      polygonRef.current = null;
    }
  }, []);

  // Initialize drawing manager and polygon
  useEffect(() => {
    if (!map || !drawing) return;

    const google = window.google;
    if (!google) return;

    // Create drawing manager
    const drawingManager = new drawing.DrawingManager({
      drawingMode: google.maps.drawing.OverlayType.POLYGON,
      drawingControl: true,
      drawingControlOptions: {
        position: google.maps.ControlPosition.TOP_CENTER,
        drawingModes: [google.maps.drawing.OverlayType.POLYGON],
      },
      polygonOptions: {
        fillColor: '#3b82f6',
        fillOpacity: 0.3,
        strokeColor: '#3b82f6',
        strokeWeight: 2,
        clickable: true,
        editable: true,
        draggable: false,
      },
    });

    drawingManager.setMap(map);
    drawingManagerRef.current = drawingManager;

    // Handle polygon completion from drawing manager
    google.maps.event.addListener(
      drawingManager,
      'overlaycomplete',
      (event: google.maps.drawing.OverlayCompleteEvent) => {
        if (event.type === google.maps.drawing.OverlayType.POLYGON) {
          // Before creating new polygon, remove existing one
          cleanupPolygon();

          const polygon = event.overlay as google.maps.Polygon;
          polygonRef.current = polygon;

          // Disable drawing mode and control
          drawingManager.setDrawingMode(null);
          drawingManager.setOptions({ drawingControl: false });

          // Get coordinates from polygon
          const path = polygon.getPath();
          isUpdatingFromMapRef.current = true;
          const newCoords = polygonPathToCoordinates(
            path,
            coordinates.map((c) => c.id)
          );
          onCoordinatesChange(newCoords);
          isUpdatingFromMapRef.current = false;

          // Listen for path changes (editing)
          const setAtListener = google.maps.event.addListener(path, 'set_at', () => {
            if (!isUpdatingFromPropsRef.current) {
              isUpdatingFromMapRef.current = true;
              const updatedCoords = polygonPathToCoordinates(
                path,
                coordinates.map((c) => c.id)
              );
              onCoordinatesChange(updatedCoords);
              isUpdatingFromMapRef.current = false;
            }
          });

          const insertAtListener = google.maps.event.addListener(path, 'insert_at', () => {
            if (!isUpdatingFromPropsRef.current) {
              isUpdatingFromMapRef.current = true;
              const updatedCoords = polygonPathToCoordinates(
                path,
                coordinates.map((c) => c.id)
              );
              onCoordinatesChange(updatedCoords);
              isUpdatingFromMapRef.current = false;
            }
          });

          const removeAtListener = google.maps.event.addListener(path, 'remove_at', () => {
            if (!isUpdatingFromPropsRef.current) {
              isUpdatingFromMapRef.current = true;
              const updatedCoords = polygonPathToCoordinates(
                path,
                coordinates.map((c) => c.id)
              );
              onCoordinatesChange(updatedCoords);
              isUpdatingFromMapRef.current = false;
            }
          });

          // Store listeners for cleanup
          (polygon as PolygonWithListeners).__listeners = [setAtListener, insertAtListener, removeAtListener];
        }
      }
    );

    // Handle map clicks to add points manually
    const clickListener = google.maps.event.addListener(
      map,
      'click',
      (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;

        // If no polygon exists, create one
        if (!polygonRef.current) {
          const newPolygon = new google.maps.Polygon({
            paths: [e.latLng],
            fillColor: '#3b82f6',
            fillOpacity: 0.3,
            strokeColor: '#3b82f6',
            strokeWeight: 2,
            editable: true,
            draggable: false,
          });
          newPolygon.setMap(map);
          polygonRef.current = newPolygon;

          // Listen for path changes
          const path = newPolygon.getPath();
          const setAtListener = google.maps.event.addListener(path, 'set_at', () => {
            if (!isUpdatingFromPropsRef.current) {
              isUpdatingFromMapRef.current = true;
              const updatedCoords = polygonPathToCoordinates(
                path,
                coordinates.map((c) => c.id)
              );
              onCoordinatesChange(updatedCoords);
              isUpdatingFromMapRef.current = false;
            }
          });

          const insertAtListener = google.maps.event.addListener(path, 'insert_at', () => {
            if (!isUpdatingFromPropsRef.current) {
              isUpdatingFromMapRef.current = true;
              const updatedCoords = polygonPathToCoordinates(
                path,
                coordinates.map((c) => c.id)
              );
              onCoordinatesChange(updatedCoords);
              isUpdatingFromMapRef.current = false;
            }
          });

          const removeAtListener = google.maps.event.addListener(path, 'remove_at', () => {
            if (!isUpdatingFromPropsRef.current) {
              isUpdatingFromMapRef.current = true;
              const updatedCoords = polygonPathToCoordinates(
                path,
                coordinates.map((c) => c.id)
              );
              onCoordinatesChange(updatedCoords);
              isUpdatingFromMapRef.current = false;
            }
          });

          // Store listeners for cleanup
          (newPolygon as PolygonWithListeners).__listeners = [setAtListener, insertAtListener, removeAtListener];
        } else {
          // Add point to existing polygon
          const path = polygonRef.current.getPath();
          path.push(e.latLng);

          if (!isUpdatingFromPropsRef.current) {
            isUpdatingFromMapRef.current = true;
            const updatedCoords = polygonPathToCoordinates(
              path,
              coordinates.map((c) => c.id)
            );
            onCoordinatesChange(updatedCoords);
            isUpdatingFromMapRef.current = false;
          }
        }
      }
    );

    return () => {
      google.maps.event.removeListener(clickListener);
      cleanupPolygon();
      if (drawingManager) {
        drawingManager.setMap(null);
      }
    };
  }, [map, drawing, onCoordinatesChange, coordinates, cleanupPolygon]);

  // Sync polygon when coordinates prop changes (from table edits)
  useEffect(() => {
    if (!map || isUpdatingFromMapRef.current) return;

    const google = window.google;
    if (!google) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    if (coordinates.length === 0) {
      // Remove polygon if no coordinates
      cleanupPolygon();
      // Re-enable drawing control when polygon is cleared
      if (drawingManagerRef.current) {
        drawingManagerRef.current.setOptions({ drawingControl: true });
      }
      return;
    }

    if (coordinates.length < 3) {
      // Show markers for points but no polygon yet
      cleanupPolygon();

      coordinates.forEach((coord) => {
        const marker = new google.maps.Marker({
          position: new google.maps.LatLng(coord.latitude, coord.longitude),
          map: map,
          draggable: true,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#3b82f6',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
        });

        google.maps.event.addListener(marker, 'dragend', () => {
          if (!isUpdatingFromPropsRef.current) {
            isUpdatingFromMapRef.current = true;
            const updatedCoords = coordinates.map((c) =>
              c.id === coord.id
                ? {
                    ...c,
                    latitude: marker.getPosition()!.lat(),
                    longitude: marker.getPosition()!.lng(),
                  }
                : c
            );
            onCoordinatesChange(updatedCoords);
            isUpdatingFromMapRef.current = false;
          }
        });

        markersRef.current.push(marker);
      });
      return;
    }

    // Create or update polygon
    const path = coordinatesToLatLng(coordinates);

    if (!polygonRef.current) {
      // Create new polygon
      isUpdatingFromPropsRef.current = true;
      const polygon = new google.maps.Polygon({
        paths: path,
        fillColor: '#3b82f6',
        fillOpacity: 0.3,
        strokeColor: '#3b82f6',
        strokeWeight: 2,
        editable: true,
        draggable: false,
      });
      polygon.setMap(map);
      polygonRef.current = polygon;

      // Listen for path changes
      const polygonPath = polygon.getPath();
      const setAtListener = google.maps.event.addListener(polygonPath, 'set_at', () => {
        if (!isUpdatingFromPropsRef.current) {
          isUpdatingFromMapRef.current = true;
          const updatedCoords = polygonPathToCoordinates(
            polygonPath,
            coordinates.map((c) => c.id)
          );
          onCoordinatesChange(updatedCoords);
          isUpdatingFromMapRef.current = false;
        }
      });

      const insertAtListener = google.maps.event.addListener(polygonPath, 'insert_at', () => {
        if (!isUpdatingFromPropsRef.current) {
          isUpdatingFromMapRef.current = true;
          const updatedCoords = polygonPathToCoordinates(
            polygonPath,
            coordinates.map((c) => c.id)
          );
          onCoordinatesChange(updatedCoords);
          isUpdatingFromMapRef.current = false;
        }
      });

      const removeAtListener = google.maps.event.addListener(polygonPath, 'remove_at', () => {
        if (!isUpdatingFromPropsRef.current) {
          isUpdatingFromMapRef.current = true;
          const updatedCoords = polygonPathToCoordinates(
            polygonPath,
            coordinates.map((c) => c.id)
          );
          onCoordinatesChange(updatedCoords);
          isUpdatingFromMapRef.current = false;
        }
      });

      // Store listeners for cleanup
      (polygon as PolygonWithListeners).__listeners = [setAtListener, insertAtListener, removeAtListener];

      isUpdatingFromPropsRef.current = false;
    } else {
      // Update existing polygon path - temporarily disable listeners
      isUpdatingFromPropsRef.current = true;
      const polygonPath = polygonRef.current.getPath();
      
      // Update path points
      const currentLength = polygonPath.getLength();
      const newLength = path.length;
      
      // Update existing points
      for (let i = 0; i < Math.min(currentLength, newLength); i++) {
        polygonPath.setAt(i, path[i]);
      }
      
      // Add new points if needed
      for (let i = currentLength; i < newLength; i++) {
        polygonPath.push(path[i]);
      }
      
      // Remove extra points if coordinates decreased
      while (polygonPath.getLength() > newLength) {
        polygonPath.removeAt(polygonPath.getLength() - 1);
      }
      
      isUpdatingFromPropsRef.current = false;
    }

    // Cleanup on unmount
    return () => {
      cleanupPolygon();
    };
  }, [coordinates, map, onCoordinatesChange, cleanupPolygon]);

  return null;
}

// Main component with API provider
export function DrawingMap({
  coordinates,
  onCoordinatesChange,
  center = {
    lat: 0.6164979547396072,
    lng: 117.32086147991855,
  },
  zoom = 18,
}: DrawingMapProps) {
  const [loadError, setLoadError] = useState<string | null>(null);
  if (loadError) {
    return (
      <div className="bg-gray-100 rounded-lg border border-gray-300 h-96 flex items-center justify-center">
        <div className="text-center text-red-600">
          <MapPin className="w-16 h-16 mx-auto mb-3 text-gray-400" />
          <p>Gagal memuat peta</p>
          <p className="text-sm mt-2">{loadError}</p>
        </div>
      </div>
    );
  }


  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return (
      <div className="bg-gray-100 rounded-lg border border-gray-300 h-96 flex items-center justify-center">
        <div className="text-center text-red-600">
          <p>Google Maps API key tidak ditemukan</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-100 rounded-lg border border-gray-300 h-96 relative">
      <APIProvider apiKey={apiKey}>
        <Map
          defaultCenter={center}
          defaultZoom={zoom}
          mapId="drawing-map"
          style={{ width: '100%', height: '100%' }}
          gestureHandling="greedy"
        >
          <DrawingMapInternal
            coordinates={coordinates}
            onCoordinatesChange={onCoordinatesChange}
            center={center}
            zoom={zoom}
          />
        </Map>
      </APIProvider>
      <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-lg p-3 border border-gray-200 z-1000">
        <p className="text-xs mb-2 font-semibold">Instruksi:</p>
        <p className="text-xs text-gray-600">Klik pada peta untuk menambahkan titik koordinat</p>
        <p className="text-xs text-gray-600">Gunakan toolbar di atas untuk menggambar poligon</p>
        <p className="text-xs text-gray-600">Drag marker atau vertex untuk mengedit</p>
        <p className="text-xs text-gray-500 mt-2">
          {coordinates.length < 3
            ? `Minimal 3 titik diperlukan (${coordinates.length}/3)`
            : `${coordinates.length} titik terdeteksi`}
        </p>
      </div>
    </div>
  );
}
