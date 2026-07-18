'use client';

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';
import { APIProvider, Map, useMap } from '@vis.gl/react-google-maps';
import {
  TerraDraw,
  TerraDrawPolygonMode,
  TerraDrawPointMode,
  TerraDrawSelectMode,
} from 'terra-draw';
import { TerraDrawGoogleMapsAdapter } from 'terra-draw-google-maps-adapter';
import type { GeoJSONStoreFeatures } from 'terra-draw';
import { GeographicCoordinate } from '@/types';
import { MapPin, Pencil, MousePointer2, Trash2 } from 'lucide-react';

interface DrawingMapProps {
  coordinates: GeographicCoordinate[];
  onCoordinatesChange: (coords: GeographicCoordinate[]) => void;
  recenterSignal?: number;
  center?: {
    lat: number;
    lng: number;
  };
  zoom?: number;
}

interface DrawingMapInternalProps {
  coordinates: GeographicCoordinate[];
  onCoordinatesChange: (coords: GeographicCoordinate[]) => void;
  recenterSignal?: number;
  /** Element above the map where the drawing toolbar is portaled, so it never covers Google Maps controls */
  toolbarHost: HTMLElement | null;
}

type DrawMode = 'polygon' | 'select';

function isValidCoordinate(coord: GeographicCoordinate): boolean {
  const lat = Number(coord.latitude);
  const lng = Number(coord.longitude);
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/** Convert a GeoJSON polygon ring ([lng, lat], closed) to GeographicCoordinate[] */
function ringToCoordinates(
  ring: [number, number][],
  existingIds: string[]
): GeographicCoordinate[] {
  // Drop the closing coordinate (first === last in a GeoJSON ring)
  const points = ring.slice(0, -1);
  return points.map(([lng, lat], index) => ({
    id: existingIds[index] || `C-${crypto.randomUUID()}-${index}`,
    latitude: lat,
    longitude: lng,
  }));
}

function sameCoordinates(
  a: GeographicCoordinate[],
  b: GeographicCoordinate[]
): boolean {
  if (a.length !== b.length) return false;
  const EPSILON = 1e-9;
  return a.every(
    (coord, i) =>
      Math.abs(Number(coord.latitude) - Number(b[i].latitude)) < EPSILON &&
      Math.abs(Number(coord.longitude) - Number(b[i].longitude)) < EPSILON
  );
}

// Internal component that wires Terra Draw onto the Google Maps instance
function DrawingMapInternal({
  coordinates,
  onCoordinatesChange,
  recenterSignal,
  toolbarHost,
}: DrawingMapInternalProps) {
  const map = useMap();
  const drawRef = useRef<TerraDraw | null>(null);
  const [drawReady, setDrawReady] = useState(false);
  // Mode lives outside React state so effects can switch it while syncing
  // Terra Draw (an external system) without triggering setState-in-effect.
  const modeStoreRef = useRef<{
    mode: DrawMode;
    listeners: Set<() => void>;
  }>({ mode: 'polygon', listeners: new Set() });
  const activeMode = useSyncExternalStore(
    useCallback((onStoreChange: () => void) => {
      const store = modeStoreRef.current;
      store.listeners.add(onStoreChange);
      return () => store.listeners.delete(onStoreChange);
    }, []),
    () => modeStoreRef.current.mode,
    () => 'polygon' as DrawMode
  );
  const isUpdatingFromPropsRef = useRef(false);
  const lastSyncedRef = useRef<GeographicCoordinate[]>([]);
  const lastAppliedRecenterSignalRef = useRef(0);
  const coordinatesRef = useRef(coordinates);
  const onCoordinatesChangeRef = useRef(onCoordinatesChange);

  useEffect(() => {
    coordinatesRef.current = coordinates;
    onCoordinatesChangeRef.current = onCoordinatesChange;
  }, [coordinates, onCoordinatesChange]);

  // Read the current polygon/points from Terra Draw and push them to the parent
  const propagateFromMap = useCallback(() => {
    const draw = drawRef.current;
    if (!draw || isUpdatingFromPropsRef.current) return;

    const features = draw.getSnapshot();
    const polygon = features.find(
      (f) =>
        f.geometry.type === 'Polygon' && f.properties.mode === 'polygon'
    );

    const existingIds = coordinatesRef.current.map((c) => c.id);
    let newCoords: GeographicCoordinate[];

    if (polygon) {
      const ring = (polygon.geometry.coordinates as [number, number][][])[0];
      newCoords = ringToCoordinates(ring, existingIds);
    } else {
      const points = features.filter(
        (f) => f.geometry.type === 'Point' && f.properties.mode === 'point'
      );
      newCoords = points.map((f, index) => {
        const [lng, lat] = f.geometry.coordinates as [number, number];
        return {
          id: existingIds[index] || `C-${crypto.randomUUID()}-${index}`,
          latitude: lat,
          longitude: lng,
        };
      });
    }

    lastSyncedRef.current = newCoords;
    onCoordinatesChangeRef.current(newCoords);
  }, []);

  const switchMode = useCallback((mode: DrawMode) => {
    const draw = drawRef.current;
    if (!draw) return;
    draw.setMode(mode);
    const store = modeStoreRef.current;
    store.mode = mode;
    store.listeners.forEach((listener) => listener());
  }, []);

  const clearAll = useCallback(() => {
    const draw = drawRef.current;
    if (!draw) return;
    isUpdatingFromPropsRef.current = true;
    draw.clear();
    isUpdatingFromPropsRef.current = false;
    lastSyncedRef.current = [];
    onCoordinatesChangeRef.current([]);
    switchMode('polygon');
  }, [switchMode]);

  // Initialize Terra Draw once the map (and its projection) is ready
  useEffect(() => {
    if (!map) return;

    let cancelled = false;
    // Track the instance created by THIS effect run: the adapter's `ready`
    // event is async, so on fast unmount (React StrictMode double-mount)
    // drawRef.current may still be null — cleanup must stop localDraw or the
    // orphaned instance keeps listening to map events and fires stale ids.
    let localDraw: TerraDraw | null = null;
    let projectionListener: google.maps.MapsEventListener | null = null;

    const init = () => {
      if (cancelled || localDraw) return;

      const draw = new TerraDraw({
        adapter: new TerraDrawGoogleMapsAdapter({
          lib: google.maps,
          map,
          coordinatePrecision: 9,
        }),
        modes: [
          new TerraDrawPolygonMode({
            styles: {
              fillColor: '#3b82f6',
              fillOpacity: 0.3,
              outlineColor: '#3b82f6',
              outlineWidth: 2,
              closingPointColor: '#3b82f6',
              closingPointWidth: 6,
              closingPointOutlineColor: '#ffffff',
              closingPointOutlineWidth: 2,
            },
          }),
          new TerraDrawPointMode({
            styles: {
              pointColor: '#3b82f6',
              pointWidth: 8,
              pointOutlineColor: '#ffffff',
              pointOutlineWidth: 2,
            },
          }),
          new TerraDrawSelectMode({
            flags: {
              polygon: {
                feature: {
                  draggable: false,
                  coordinates: {
                    midpoints: true,
                    draggable: true,
                    deletable: true,
                  },
                },
              },
              point: {
                feature: {
                  draggable: true,
                },
              },
            },
            styles: {
              selectedPolygonColor: '#3b82f6',
              selectedPolygonFillOpacity: 0.3,
              selectedPolygonOutlineColor: '#2563eb',
              selectedPolygonOutlineWidth: 2,
              selectionPointColor: '#3b82f6',
              selectionPointWidth: 6,
              selectionPointOutlineColor: '#ffffff',
              selectionPointOutlineWidth: 2,
              midPointColor: '#93c5fd',
              midPointWidth: 4,
              midPointOutlineColor: '#ffffff',
              midPointOutlineWidth: 1,
            },
          }),
        ],
      });

      localDraw = draw;

      draw.on('ready', () => {
        if (cancelled) return;
        drawRef.current = draw;
        setDrawReady(true);
      });

      // Polygon finished, or a drag (vertex/feature) ended
      draw.on('finish', (id, context) => {
        // Ignore events from an instance that is no longer the active one
        if (cancelled || drawRef.current !== draw) return;
        if (isUpdatingFromPropsRef.current) return;

        if (context.mode === 'polygon' && context.action === 'draw') {
          // Keep only the newly drawn polygon
          const stale = draw
            .getSnapshot()
            .filter(
              (f) =>
                f.id !== id &&
                (f.properties.mode === 'polygon' ||
                  f.properties.mode === 'point')
            )
            .map((f) => f.id!);
          if (stale.length > 0) {
            isUpdatingFromPropsRef.current = true;
            draw.removeFeatures(stale);
            isUpdatingFromPropsRef.current = false;
          }
          propagateFromMap();
          switchMode('select');
          try {
            draw.selectFeature(id);
          } catch (error) {
            // Selection is a nicety — never let it crash the page
            console.warn('Gagal memilih poligon setelah digambar:', error);
          }
        } else {
          propagateFromMap();
        }
      });

      // Live edits in select mode (vertex drag, vertex delete, point drag)
      draw.on('change', (_ids, type) => {
        if (cancelled || drawRef.current !== draw) return;
        if (isUpdatingFromPropsRef.current) return;
        if (type === 'update' && draw.getMode() === 'select') {
          propagateFromMap();
        }
      });

      draw.start();
      draw.setMode('polygon');
      const store = modeStoreRef.current;
      store.mode = 'polygon';
      store.listeners.forEach((listener) => listener());
    };

    if (map.getProjection()) {
      init();
    } else {
      projectionListener = map.addListener('projection_changed', () => {
        projectionListener?.remove();
        init();
      });
    }

    return () => {
      cancelled = true;
      projectionListener?.remove();
      if (localDraw) {
        try {
          localDraw.stop();
        } catch {
          // stop() can throw if the adapter never finished registering
        }
        localDraw = null;
      }
      drawRef.current = null;
      // Force the props-sync effect to repopulate a future instance
      lastSyncedRef.current = [];
      setDrawReady(false);
    };
  }, [map, propagateFromMap, switchMode]);

  // Sync Terra Draw features when the coordinates prop changes (table edits, KML import)
  useEffect(() => {
    const draw = drawRef.current;
    if (!drawReady || !draw) return;
    if (sameCoordinates(coordinates, lastSyncedRef.current)) return;

    isUpdatingFromPropsRef.current = true;
    draw.clear();

    const valid = coordinates.filter(isValidCoordinate);

    if (valid.length >= 3) {
      const ring = valid.map(
        (c) => [Number(c.longitude), Number(c.latitude)] as [number, number]
      );
      ring.push(ring[0]);
      const featureId = crypto.randomUUID();
      const result = draw.addFeatures([
        {
          id: featureId,
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [ring] },
          properties: { mode: 'polygon' },
        } as GeoJSONStoreFeatures,
      ]);
      if (result[0]?.valid) {
        switchMode('select');
        draw.selectFeature(featureId);
      } else {
        console.warn(
          'Poligon tidak valid untuk digambar di peta:',
          result[0]?.reason
        );
      }
    } else if (valid.length > 0) {
      draw.addFeatures(
        valid.map(
          (c) =>
            ({
              id: crypto.randomUUID(),
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [Number(c.longitude), Number(c.latitude)],
              },
              properties: { mode: 'point' },
            }) as GeoJSONStoreFeatures
        )
      );
    } else {
      switchMode('polygon');
    }

    lastSyncedRef.current = coordinates;
    isUpdatingFromPropsRef.current = false;
  }, [coordinates, drawReady, switchMode]);

  // Recenter/fit map after coordinate updates from table-based inputs/imports.
  useEffect(() => {
    if (!map || recenterSignal === undefined || recenterSignal <= 0) return;
    if (lastAppliedRecenterSignalRef.current === recenterSignal) return;

    const google = window.google;
    if (!google) return;

    const validCoordinates = coordinates.filter(isValidCoordinate);
    if (validCoordinates.length < 3) return;

    const bounds = new google.maps.LatLngBounds();
    validCoordinates.forEach((coord) => {
      bounds.extend({
        lat: Number(coord.latitude),
        lng: Number(coord.longitude),
      });
    });

    if (bounds.isEmpty()) return;
    lastAppliedRecenterSignalRef.current = recenterSignal;

    map.fitBounds(bounds, 64);

    const idleListener = google.maps.event.addListenerOnce(map, 'idle', () => {
      const currentZoom = map.getZoom();
      if (typeof currentZoom === 'number' && currentZoom > 19) {
        map.setZoom(19);
      }
    });

    return () => {
      google.maps.event.removeListener(idleListener);
    };
  }, [coordinates, map, recenterSignal]);

  if (!toolbarHost) return null;

  return createPortal(
    <div className="inline-flex gap-1 bg-white rounded-lg shadow-sm border border-gray-200 p-1">
      <button
        type="button"
        onClick={() => switchMode('polygon')}
        disabled={!drawReady}
        title="Gambar poligon baru"
        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors disabled:opacity-50 ${
          activeMode === 'polygon'
            ? 'bg-blue-600 text-white'
            : 'text-gray-700 hover:bg-gray-100'
        }`}
      >
        <Pencil className="w-3.5 h-3.5" />
        Gambar
      </button>
      <button
        type="button"
        onClick={() => switchMode('select')}
        disabled={!drawReady}
        title="Pilih dan edit poligon"
        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors disabled:opacity-50 ${
          activeMode === 'select'
            ? 'bg-blue-600 text-white'
            : 'text-gray-700 hover:bg-gray-100'
        }`}
      >
        <MousePointer2 className="w-3.5 h-3.5" />
        Edit
      </button>
      <button
        type="button"
        onClick={clearAll}
        disabled={!drawReady}
        title="Hapus poligon"
        className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
      >
        <Trash2 className="w-3.5 h-3.5" />
        Hapus
      </button>
      <span className="flex items-center px-2 text-xs text-gray-600 border-l border-gray-200 whitespace-nowrap">
        {coordinates.length < 3
          ? `${coordinates.length}/3 titik`
          : `${coordinates.length} titik`}
      </span>
    </div>,
    toolbarHost
  );
}

// Main component with API provider
export function DrawingMap({
  coordinates,
  onCoordinatesChange,
  recenterSignal,
  center = {
    lat: 0.6164979547396072,
    lng: 117.32086147991855,
  },
  zoom = 18,
}: DrawingMapProps) {
  const [toolbarHost, setToolbarHost] = useState<HTMLDivElement | null>(null);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return (
      <div className="bg-gray-100 rounded-lg border border-gray-300 h-96 flex items-center justify-center">
        <div className="text-center text-red-600">
          <MapPin className="w-16 h-16 mx-auto mb-3 text-gray-400" />
          <p>Google Maps API key tidak ditemukan</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Toolbar row above the map, so it never covers Google Maps controls */}
      <div ref={setToolbarHost} className="flex min-h-[34px]" />
      <div className="bg-gray-100 rounded-lg border border-gray-300 h-96 relative">
        <APIProvider apiKey={apiKey}>
          <Map
            defaultCenter={center}
            defaultZoom={zoom}
            mapId="drawing-map"
            style={{ width: '100%', height: '100%' }}
            gestureHandling="greedy"
            disableDoubleClickZoom
          >
            <DrawingMapInternal
              coordinates={coordinates}
              onCoordinatesChange={onCoordinatesChange}
              recenterSignal={recenterSignal}
              toolbarHost={toolbarHost}
            />
          </Map>
        </APIProvider>
      </div>
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-3">
        <p className="text-xs mb-1 font-semibold text-gray-900">Instruksi:</p>
        <p className="text-xs text-gray-600">
          Mode <strong>Gambar</strong>: klik peta untuk menambah titik, klik
          titik awal untuk menutup poligon
        </p>
        <p className="text-xs text-gray-600">
          Mode <strong>Edit</strong>: klik poligon, lalu drag titik untuk
          mengubah bentuk
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Minimal 3 titik koordinat diperlukan untuk membentuk poligon.
        </p>
      </div>
    </div>
  );
}
