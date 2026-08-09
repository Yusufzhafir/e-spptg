'use client';

import { useEffect, useRef, useState } from 'react';
import { Submission } from '../types';
import { ReadOnlyMap } from './maps/ReadOnlyMap';
import { StatusBadge } from './StatusBadge';
import { Button } from './ui/button';
import { X, ArrowRight, Loader2 } from 'lucide-react';

interface MapViewProps {
  submissions: Submission[];
  selectedSubmission?: Submission | null;
  height?: string;
  center?: {
    lat: number;
    lng: number;
  };
  zoom?: number;
  onPolygonClick?: (submission: Submission) => void;
  onViewInTable?: (submission: Submission) => void;
  /**
   * The row currently being jumped to, or null once it has landed. Finding a
   * row means a round trip and usually a page change, so the button waits on it
   * instead of the popup vanishing while nothing visible has happened yet.
   */
  pendingFocusId?: number | null;
}

export function MapView({
  submissions,
  selectedSubmission,
  height = '400px',
  center = {
    lat: 0.6164979547396072,
    lng: 117.32086147991855,
  },
  zoom = 13,
  onPolygonClick,
  onViewInTable,
  pendingFocusId,
}: MapViewProps) {
  const [activeSubmission, setActiveSubmission] = useState<Submission | null>(null);
  /** The id this popup asked for, so it only closes on its own request. */
  const requestedId = useRef<number | null>(null);

  const isFocusing =
    pendingFocusId != null && activeSubmission?.id === pendingFocusId;

  // Close once the jump has landed — the row is highlighted and scrolled to by
  // then, so the popup has nothing left to say.
  useEffect(() => {
    if (requestedId.current == null || pendingFocusId != null) return;
    requestedId.current = null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- close on an external signal
    setActiveSubmission(null);
  }, [pendingFocusId]);

  return (
    <div className="relative">
      <ReadOnlyMap
        submissions={submissions}
        selectedSubmission={selectedSubmission}
        height={height}
        center={center}
        zoom={zoom}
        onPolygonClick={(submission) => {
          setActiveSubmission(submission);
          onPolygonClick?.(submission);
        }}
      />

      {/* Corner popup — kept below the Map/Satellite control at the top-left */}
      {activeSubmission && (
        <div className="absolute top-16 left-2 z-10 w-64 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold leading-tight text-gray-900">
              {activeSubmission.namaPemilik}
            </p>
            <button
              type="button"
              onClick={() => setActiveSubmission(null)}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Tutup"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-1.5">
            <StatusBadge status={activeSubmission.status} />
          </div>

          <div className="mt-2 space-y-1 border-t border-gray-100 pt-2 text-xs text-gray-600">
            <div className="flex justify-between gap-3">
              <span className="text-gray-400">ID</span>
              <span className="font-medium text-gray-700">{activeSubmission.id}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-gray-400">NIK</span>
              <span className="font-medium text-gray-700">{activeSubmission.nik || '-'}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-gray-400">Kecamatan</span>
              <span className="font-medium text-gray-700 text-right">
                {activeSubmission.kecamatan || '-'}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-gray-400">Luas</span>
              <span className="font-medium text-gray-700">
                {activeSubmission.luas.toLocaleString('id-ID')} m²
              </span>
            </div>
          </div>

          {onViewInTable && activeSubmission.id > 0 && (
            <Button
              size="sm"
              className="mt-3 w-full bg-blue-600 hover:bg-blue-700"
              disabled={isFocusing}
              onClick={() => {
                requestedId.current = activeSubmission.id;
                onViewInTable(activeSubmission);
              }}
            >
              {isFocusing ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  Mencari baris…
                </>
              ) : (
                <>
                  Lihat Detail Pengajuan
                  <ArrowRight className="ml-1 h-4 w-4" />
                </>
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
