'use client';

import { useState } from 'react';
import { Submission } from '../types';
import { ReadOnlyMap } from './maps/ReadOnlyMap';
import { StatusBadge } from './StatusBadge';

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
}: MapViewProps) {
  const [hoveredSubmission, setHoveredSubmission] = useState<Submission | null>(null);

  return (
    <div className="relative">
      <ReadOnlyMap
        submissions={submissions}
        selectedSubmission={selectedSubmission}
        height={height}
        center={center}
        zoom={zoom}
        onPolygonClick={(submission) => {
          setHoveredSubmission(submission);
          if (onPolygonClick) {
            onPolygonClick(submission);
          }
        }}
      />

      {/* Info popup for hovered submission */}
      {hoveredSubmission && (
        <div className="absolute top-4 left-4 bg-white p-4 rounded-lg shadow-lg border border-gray-200 max-w-xs z-1000">
          <p className="mb-2 font-semibold">{hoveredSubmission.namaPemilik}</p>
          <p className="text-sm text-gray-600 mb-1">ID: {hoveredSubmission.id}</p>
          <p className="text-sm text-gray-600 mb-1">
            {hoveredSubmission.kecamatan}
          </p>
          <p className="text-sm text-gray-600 mb-2">Luas: {hoveredSubmission.luas.toLocaleString('id-ID')} m²</p>
          <StatusBadge status={hoveredSubmission.status} />
        </div>
      )}
    </div>
  );
}
