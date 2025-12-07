'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { Submission, StatusSPPTG } from '../types';
import { StatusBadge } from './StatusBadge';
import dynamic from 'next/dynamic';

// Dynamically import Leaflet to avoid SSR issues
const MapContainer = dynamic(() => import('react-leaflet').then((mod) => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then((mod) => mod.TileLayer), { ssr: false });
const Polygon = dynamic(() => import('react-leaflet').then((mod) => mod.Polygon), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then((mod) => mod.Popup), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then((mod) => mod.Marker), { ssr: false });

// Import Leaflet CSS
import 'leaflet/dist/leaflet.css';
import type { Map } from 'leaflet';

interface MapViewProps {
  submissions: Submission[];
  selectedSubmission?: Submission | null;
  height?: string;
  center?: [number, number];
  zoom?: number;
  onPolygonClick?: (submission: Submission) => void;
}

// Component to capture map instance - must be rendered inside MapContainer
// This component uses useMap hook which is only available inside MapContainer context
const MapInstanceCapture = dynamic(
  () =>
    import('react-leaflet').then((mod) => {
      const { useMap } = mod;
      return function MapInstanceCaptureComponent({
        mapRef,
      }: {
        mapRef: React.MutableRefObject<Map | null>;
      }) {
        const map = useMap();
        useEffect(() => {
          if (map) {
            mapRef.current = map;
          }
          return () => {
            mapRef.current = null;
          };
        }, [map, mapRef]);
        return null;
      };
    }),
  { ssr: false }
);

export function MapView({
  submissions,
  selectedSubmission,
  height = '400px',
  center = [-6.7100, 108.5550],
  zoom = 13,
  onPolygonClick,
}: MapViewProps) {
  const [mounted, setMounted] = useState(false);
  const [hoveredSubmission, setHoveredSubmission] = useState<Submission | null>(null);
  const mapRef = useRef<Map | null>(null);
  const mapIdRef = useRef<string>(`map-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    setMounted(true);
    
    // Cleanup function to destroy map on unmount
    return () => {
      if (mapRef.current) {
        try {
          mapRef.current.remove();
          mapRef.current = null;
        } catch (error) {
          // Map might already be destroyed, ignore error
          console.warn('Error cleaning up map:', error);
        }
      }
    };
  }, []);

  const getPolygonColor = (status: StatusSPPTG) => {
    switch (status) {
      case 'SPPTG terdaftar':
        return '#22c55e';
      case 'SPPTG terdata':
        return '#3b82f6';
      case 'SPPTG ditolak':
        return '#ef4444';
      case 'SPPTG ditinjau ulang':
        return '#eab308';
      default:
        return '#6b7280';
    }
  };

  // Convert coordinates to Leaflet format [lat, lng]
  const convertCoordinates = (submission: Submission): [number, number][] => {
    // Try to get coordinates from geoJSON first
    let coords: number[][] | undefined;
    
    if (submission.geoJSON?.coordinates?.[0]) {
      // geoJSON format: coordinates[0] is array of [lng, lat] pairs
      coords = submission.geoJSON.coordinates[0];
    } else if ((submission as any).coordinates) {
      // Fallback to coordinates property if it exists (from transformed data)
      coords = (submission as any).coordinates;
    }
    
    if (!coords || coords.length === 0) return [];
    
    return coords.map((coord) => {
      // Handle both [lat, lng] and [lng, lat] formats
      if (coord.length === 2) {
        // If first value is > 90 or < -90, it's likely longitude, so swap
        if (Math.abs(coord[0]) > 90) {
          return [coord[1], coord[0]] as [number, number];
        }
        return [coord[0], coord[1]] as [number, number];
      }
      return [0, 0] as [number, number];
    });
  };

  // Memoize center and zoom to prevent unnecessary re-renders
  const memoizedCenter = useMemo(() => center, [center[0], center[1]]);
  const memoizedZoom = useMemo(() => zoom, [zoom]);

  if (!mounted) {
    return (
      <div className="relative rounded-lg overflow-hidden border border-gray-200 flex items-center justify-center" style={{ height }}>
        <div className="text-gray-500">Memuat peta...</div>
      </div>
    );
  }

  return (
    <div 
      id={mapIdRef.current}
      className="relative rounded-lg overflow-hidden border border-gray-200" 
      style={{ height }}
    >
      {/* <MapContainer
        key={mapIdRef.current}
        center={memoizedCenter}
        zoom={memoizedZoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <MapInstanceCapture mapRef={mapRef} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {submissions.map((submission) => {
          const polygonCoords = convertCoordinates(submission);
          if (polygonCoords.length < 3) return null;

          const color = getPolygonColor(submission.status);
          const isSelected = selectedSubmission?.id === submission.id;

          return (
            <Polygon
              key={submission.id}
              positions={polygonCoords}
              pathOptions={{
                color: color,
                fillColor: color,
                fillOpacity: isSelected ? 0.5 : 0.3,
                weight: isSelected ? 3 : 2,
              }}
              eventHandlers={{
                click: () => {
                  if (onPolygonClick) {
                    onPolygonClick(submission);
                  }
                },
                mouseover: () => {
                  setHoveredSubmission(submission);
                },
                mouseout: () => {
                  setHoveredSubmission(null);
                },
              }}
            >
              <Popup>
                <div className="p-2">
                  <p className="font-semibold mb-1">{submission.namaPemilik}</p>
                  <p className="text-sm text-gray-600 mb-1">ID: {submission.id}</p>
                  <p className="text-sm text-gray-600 mb-1">
                    {(submission as any).desa ? `${(submission as any).desa}, ` : ''}{submission.kecamatan}
                  </p>
                  <p className="text-sm text-gray-600 mb-2">Luas: {submission.luas.toLocaleString('id-ID')} m²</p>
                  <StatusBadge status={submission.status} />
                </div>
              </Popup>
            </Polygon>
          );
        })}
      </MapContainer> */}

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-white p-3 rounded-lg shadow-lg border border-gray-200 z-[1000]">
        <p className="text-xs mb-2 font-semibold">Legenda</p>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#22c55e' }} />
            <span>SPPTG terdaftar</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#3b82f6' }} />
            <span>SPPTG terdata</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#ef4444' }} />
            <span>SPPTG ditolak</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#eab308' }} />
            <span>SPPTG ditinjau ulang</span>
          </div>
        </div>
      </div>

      {/* Info popup for hovered submission */}
      {hoveredSubmission && (
        <div className="absolute top-4 left-4 bg-white p-4 rounded-lg shadow-lg border border-gray-200 max-w-xs z-[1000]">
          <p className="mb-2 font-semibold">{hoveredSubmission.namaPemilik}</p>
          <p className="text-sm text-gray-600 mb-1">ID: {hoveredSubmission.id}</p>
          <p className="text-sm text-gray-600 mb-1">
            {(hoveredSubmission as any).desa ? `${(hoveredSubmission as any).desa}, ` : ''}{hoveredSubmission.kecamatan}
          </p>
          <p className="text-sm text-gray-600 mb-2">Luas: {hoveredSubmission.luas.toLocaleString('id-ID')} m²</p>
          <StatusBadge status={hoveredSubmission.status} />
        </div>
      )}
    </div>
  );
}
