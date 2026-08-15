'use client';

import { useEffect, useRef, useState } from 'react';
import { APIProvider, Map, useMap } from '@vis.gl/react-google-maps';
import { Submission, StatusSPPTG } from '@/types';
import { geoJSONToPaths } from '@/lib/map-utils';
import { KAWASAN_NON_SPPTG_COLOR } from '@/lib/kawasan';
import type { ReferencePolygon } from './DrawingMap';
import { MapPin } from 'lucide-react';

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
  /** Extra non-interactive polygons drawn as reference (e.g. overlapping kawasan) */
  referencePolygons?: ReferencePolygon[];
  /** Add a "Kawasan Non-SPPTG" entry to the legend (e.g. overlap detail map) */
  showNonSpptgLegend?: boolean;
  /**
   * Statuses the legend lists, in order.
   *
   * Not derived from `submissions`: a legend that appeared and disappeared as
   * the reader filtered would be a moving target. Named explicitly instead, so
   * a map that can only ever draw two statuses says exactly that — the Cek
   * Tumpang Tindih report counts nothing but `terdaftar` and `terdata`, and
   * listing "ditolak" beside them invited the reading that a rejected berkas
   * inside a kawasan simply had not turned up yet.
   */
  legendStatuses?: StatusSPPTG[];
  /**
   * Geometry to frame the map on — a Polygon or MultiPolygon, in any of the
   * shapes `geoJSONToPaths` accepts.
   *
   * The map is created with `defaultCenter`/`defaultZoom`, which apply once and
   * never again; without this a table row had no way to move it.
   */
  focusGeoJSON?: unknown;
  /**
   * Bumped by the caller on every focus request.
   *
   * Focusing is an *action*, not a state: clicking the same row twice after
   * panning away must move the map back, and comparing the geometry alone
   * cannot tell those two clicks apart.
   */
  focusSignal?: number;
}

/** Every status a submission map can draw, in the order the legend lists them. */
const DEFAULT_LEGEND_STATUSES: StatusSPPTG[] = [
  'SPPTG terdaftar',
  'SPPTG terdata',
  'SPPTG ditolak',
  'SPPTG ditinjau ulang',
];

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
  referencePolygons,
  focusGeoJSON,
  focusSignal,
}: Omit<ReadOnlyMapProps, 'height' | 'center' | 'zoom'>) {
  const map = useMap();
  const polygonsRef = useRef<google.maps.Polygon[]>([]);
  const infoWindowsRef = useRef<google.maps.InfoWindow[]>([]);
  const referencePolygonsRef = useRef<google.maps.Polygon[]>([]);
  const referenceInfoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  // Draw non-interactive reference polygons (e.g. overlapping kawasan / SPPTG)
  useEffect(() => {
    if (!map) return;
    const google = window.google;
    if (!google) return;

    referencePolygonsRef.current.forEach((polygon) => polygon.setMap(null));
    referencePolygonsRef.current = [];

    if (!referencePolygons || referencePolygons.length === 0) return;

    if (!referenceInfoWindowRef.current) {
      referenceInfoWindowRef.current = new google.maps.InfoWindow();
    }
    const infoWindow = referenceInfoWindowRef.current;

    referencePolygons.forEach((ref) => {
      if (ref.path.length < 3) return;
      const polygon = new google.maps.Polygon({
        paths: ref.path,
        fillColor: ref.fillColor,
        fillOpacity: 0.25,
        strokeColor: ref.strokeColor,
        strokeWeight: 2,
        strokeOpacity: 0.9,
        clickable: Boolean(ref.label),
        zIndex: 1,
      });
      polygon.setMap(map);

      if (ref.label) {
        polygon.addListener('click', (e: google.maps.PolyMouseEvent) => {
          if (!e.latLng) return;
          infoWindow.setContent(
            `<div style="padding:2px 4px;font-size:12px;font-weight:600;">${ref.label}</div>`
          );
          infoWindow.setPosition(e.latLng);
          infoWindow.open(map);
        });
      }

      referencePolygonsRef.current.push(polygon);
    });

    return () => {
      referencePolygonsRef.current.forEach((polygon) => polygon.setMap(null));
      referencePolygonsRef.current = [];
      referenceInfoWindowRef.current?.close();
    };
  }, [map, referencePolygons]);

  useEffect(() => {
    if (!map) return;

    const google = window.google;
    if (!google) return;

    // Clear existing polygons and info windows
    polygonsRef.current.forEach((polygon) => polygon.setMap(null));
    infoWindowsRef.current.forEach((infoWindow) => infoWindow.close());
    polygonsRef.current = [];
    infoWindowsRef.current = [];

    // Create polygons for each submission. One pengajuan may cover several
    // bidang (a MultiPolygon), so every part gets its own drawn polygon — all
    // of them carry the same click and hover behaviour.
    submissions.forEach((submission) => {
      if (!submission.geoJSON) return;

      const color = getPolygonColor(submission.status);
      const isSelected = selectedSubmission?.id === submission.id;

      geoJSONToPaths(submission.geoJSON).forEach((path) => {
        if (path.length < 3) return;

        const polygon = new google.maps.Polygon({
          paths: path,
          fillColor: color,
          fillOpacity: isSelected ? 0.5 : 0.3,
          strokeColor: color,
          strokeWeight: isSelected ? 3 : 2,
          strokeOpacity: 1,
        });

        polygon.setMap(map);
        polygonsRef.current.push(polygon);

        // Click just notifies the parent — the popup is rendered as a React
        // overlay by MapView (fixed corner), so it can't cover the map controls.
        google.maps.event.addListener(polygon, 'click', () => {
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
    });

    return () => {
      polygonsRef.current.forEach((polygon) => polygon.setMap(null));
      infoWindowsRef.current.forEach((infoWindow) => infoWindow.close());
    };
  }, [submissions, selectedSubmission, map, onPolygonClick]);

  /**
   * Frame the requested geometry.
   *
   * Keyed on `focusSignal` alone — deliberately. `focusGeoJSON` is not in the
   * dependency list because the parent rebuilds that object on every render,
   * which would re-frame the map continuously and make it impossible to pan
   * away from a selected row.
   */
  useEffect(() => {
    if (!map || focusSignal === undefined || !focusGeoJSON) return;
    const google = window.google;
    if (!google) return;

    const bounds = new google.maps.LatLngBounds();
    let points = 0;
    for (const path of geoJSONToPaths(focusGeoJSON)) {
      for (const point of path) {
        bounds.extend(point);
        points += 1;
      }
    }
    if (points === 0) return;

    map.fitBounds(bounds, 48);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see the note above
  }, [map, focusSignal]);

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
  referencePolygons,
  showNonSpptgLegend = false,
  legendStatuses = DEFAULT_LEGEND_STATUSES,
  focusGeoJSON,
  focusSignal,
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
            referencePolygons={referencePolygons}
            focusGeoJSON={focusGeoJSON}
            focusSignal={focusSignal}
          />
        </Map>
      </APIProvider>

      {/* Legend — placed just above the Google logo (bottom-left) so it never
          covers the map zoom controls at the bottom-right */}
      <div className="absolute bottom-9 left-2 bg-white/95 p-2.5 rounded-lg shadow-lg border border-gray-200 z-10">
        <p className="text-xs mb-2 font-semibold">Legenda</p>
        <div className="space-y-1">
          {legendStatuses.map((status) => (
            <div key={status} className="flex items-center gap-2 text-xs">
              <div
                className="w-4 h-4 rounded"
                style={{ backgroundColor: getPolygonColor(status) }}
              />
              <span>{status}</span>
            </div>
          ))}
          {showNonSpptgLegend && (
            <div className="flex items-center gap-2 text-xs">
              <div
                className="w-4 h-4 rounded border border-red-700"
                style={{ backgroundColor: KAWASAN_NON_SPPTG_COLOR }}
              />
              <span>Kawasan Non-SPPTG</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
