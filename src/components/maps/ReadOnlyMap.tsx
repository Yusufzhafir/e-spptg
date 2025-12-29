'use client';

import { useEffect, useRef, useState } from 'react';
import { APIProvider, Map, useMap } from '@vis.gl/react-google-maps';
import { Submission, StatusSPPTG } from '@/types';
import { geoJSONToLatLng } from '@/lib/map-utils';;
import { MapPin } from 'lucide-react';
import { renderToString } from 'react-dom/server';

interface ReadOnlyMapProps {
  submissions: Submission[];
  selectedSubmission?: Submission | null;
  height?: string;
  center?: {
    lat: number;
    lng: number;
  };
  zoom?: number;
  onPolygonClick?: (submission: Submission) => void;
}

function getPolygonColor(status: StatusSPPTG): string {
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
}

// Internal component that uses the map instance
function ReadOnlyMapInternal({
  submissions,
  selectedSubmission,
  onPolygonClick,
}: Omit<ReadOnlyMapProps, 'height' | 'center' | 'zoom'>) {
  const map = useMap();
  const polygonsRef = useRef<google.maps.Polygon[]>([]);
  const infoWindowsRef = useRef<google.maps.InfoWindow[]>([]);

  useEffect(() => {
    if (!map) return;

    const google = window.google;
    if (!google) return;

    // Clear existing polygons and info windows
    polygonsRef.current.forEach((polygon) => polygon.setMap(null));
    infoWindowsRef.current.forEach((infoWindow) => infoWindow.close());
    polygonsRef.current = [];
    infoWindowsRef.current = [];

    // Create polygons for each submission
    submissions.forEach((submission) => {
      if (!submission.geoJSON) return;

      const latLngs = geoJSONToLatLng(submission.geoJSON);
      if (latLngs.length < 3) return;

      const color = getPolygonColor(submission.status);
      const isSelected = selectedSubmission?.id === submission.id;

      const polygon = new google.maps.Polygon({
        paths: latLngs,
        fillColor: color,
        fillOpacity: isSelected ? 0.5 : 0.3,
        strokeColor: color,
        strokeWeight: isSelected ? 3 : 2,
        strokeOpacity: 1,
      });

      polygon.setMap(map);
      polygonsRef.current.push(polygon);

      // Create info window content
      const infoContent = renderToString(<div className='p-2 min-w-52' >
          <p className='font-semibold mb-1'>{submission.namaPemilik}</p>
          <p className='text-xs text-[#666] mb-1' >ID: {submission.id}</p>
          <p className='text-xs text-[#666] mb-1' >{submission.kecamatan}</p>
          <p className='text-xs text-[#666] mb-2'>Luas: {submission.luas.toLocaleString('id-ID')} m²</p>
        </div>);

      const infoWindow = new google.maps.InfoWindow({
        content: infoContent,
      });

      infoWindowsRef.current.push(infoWindow);

      // Add click listener
      google.maps.event.addListener(polygon, 'click', (e: google.maps.MapMouseEvent) => {
        // Close all other info windows
        infoWindowsRef.current.forEach((iw) => iw.close());

        // Open info window for this polygon
        if (e.latLng) {
          infoWindow.setPosition(e.latLng);
          infoWindow.open(map);
        }

        if (onPolygonClick) {
          onPolygonClick(submission);
        }
      });

      // Add hover effects
      google.maps.event.addListener(polygon, 'mouseover', () => {
        polygon.setOptions({
          fillOpacity: 0.5,
          strokeWeight: 3,
        });
      });

      google.maps.event.addListener(polygon, 'mouseout', () => {
        polygon.setOptions({
          fillOpacity: isSelected ? 0.5 : 0.3,
          strokeWeight: isSelected ? 3 : 2,
        });
      });
    });

    return () => {
      polygonsRef.current.forEach((polygon) => polygon.setMap(null));
      infoWindowsRef.current.forEach((infoWindow) => infoWindow.close());
    };
  }, [submissions, selectedSubmission, map, onPolygonClick]);

  return null;
}

// Main component with API provider
export function ReadOnlyMap({
  submissions,
  selectedSubmission,
  height = '400px',
  center = {
    lat: 0.6164979547396072,
    lng: 117.32086147991855,
  },
  zoom = 13,
  onPolygonClick,
}: ReadOnlyMapProps) {
  const isLoaded = true
  const [loadError, setLoadError] = useState<string | null>(null);

  if (loadError) {
    return (
      <div
        className="relative rounded-lg overflow-hidden border border-gray-200 flex items-center justify-center"
        style={{ height }}
      >
        <div className="text-red-600 text-center">
          <MapPin className="w-16 h-16 mx-auto mb-3 text-gray-400" />
          <p>Gagal memuat peta</p>
          <p className="text-sm mt-2">{loadError}</p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div
        className="relative rounded-lg overflow-hidden border border-gray-200 flex items-center justify-center"
        style={{ height }}
      >
        <div className="text-gray-500">Memuat peta...</div>
      </div>
    );
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return (
      <div
        className="relative rounded-lg overflow-hidden border border-gray-200 flex items-center justify-center"
        style={{ height }}
      >
        <div className="text-red-600 text-center">
          <p>Google Maps API key tidak ditemukan</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-lg overflow-hidden border border-gray-200" style={{ height }}>
      <APIProvider apiKey={apiKey}>
        <Map
          defaultCenter={center}
          defaultZoom={zoom}
          mapId="readonly-map"
          style={{ width: '100%', height: '100%' }}
          gestureHandling="greedy"
        >
          <ReadOnlyMapInternal
            submissions={submissions}
            selectedSubmission={selectedSubmission}
            onPolygonClick={onPolygonClick}
          />
        </Map>
      </APIProvider>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-white p-3 rounded-lg shadow-lg border border-gray-200 z-1000">
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
    </div>
  );
}
