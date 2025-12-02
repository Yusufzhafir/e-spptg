import { useEffect, useRef, useState } from 'react';
import { Submission, StatusSPPTG } from '../types';
import { StatusBadge } from './StatusBadge';

interface MapViewProps {
  submissions: Submission[];
  selectedSubmission?: Submission | null;
  height?: string;
  center?: [number, number];
  zoom?: number;
  onPolygonClick?: (submission: Submission) => void;
}

export function MapView({
  submissions,
  selectedSubmission,
  height = '400px',
  center = [-6.7100, 108.5550],
  zoom = 13,
  onPolygonClick,
}: MapViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredSubmission, setHoveredSubmission] = useState<Submission | null>(null);

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

  // Convert lat/lng to canvas coordinates
  const latLngToPixel = (lat: number, lng: number, canvas: HTMLCanvasElement) => {
    const minLat = -6.72;
    const maxLat = -6.70;
    const minLng = 108.54;
    const maxLng = 108.57;

    const x = ((lng - minLng) / (maxLng - minLng)) * canvas.width;
    const y = ((maxLat - lat) / (maxLat - minLat)) * canvas.height;

    return { x, y };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // Clear canvas
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += 50) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, canvas.height);
      ctx.stroke();
    }
    for (let i = 0; i < canvas.height; i += 50) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(canvas.width, i);
      ctx.stroke();
    }

    // Draw polygons
    submissions.forEach((submission) => {
      if (!submission.coordinates || submission.coordinates.length === 0) return;

      const color = getPolygonColor(submission.status);
      const isSelected = selectedSubmission?.id === submission.id;
      const isHovered = hoveredSubmission?.id === submission.id;

      ctx.beginPath();
      submission.coordinates.forEach((coord, index) => {
        const [lat, lng] = coord;
        const { x, y } = latLngToPixel(lat, lng, canvas);
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.closePath();

      // Fill
      ctx.globalAlpha = isSelected || isHovered ? 0.5 : 0.3;
      ctx.fillStyle = color;
      ctx.fill();

      // Stroke
      ctx.globalAlpha = 1;
      ctx.strokeStyle = color;
      ctx.lineWidth = isSelected || isHovered ? 3 : 2;
      ctx.stroke();

      // Draw label
      if (submission.coordinates.length > 0) {
        const [lat, lng] = submission.coordinates[0];
        const { x, y } = latLngToPixel(lat, lng, canvas);
        
        ctx.fillStyle = '#000';
        ctx.font = '12px Inter, sans-serif';
        ctx.fillText(submission.namaPemilik, x + 5, y - 5);
      }
    });
  }, [submissions, selectedSubmission, hoveredSubmission]);

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onPolygonClick) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Simple point-in-polygon check (simplified)
    for (const submission of submissions) {
      if (!submission.coordinates || submission.coordinates.length === 0) continue;

      const points = submission.coordinates.map((coord) => {
        const [lat, lng] = coord;
        return latLngToPixel(lat, lng, canvas);
      });

      // Check if point is near any polygon (simplified)
      const minX = Math.min(...points.map((p) => p.x));
      const maxX = Math.max(...points.map((p) => p.x));
      const minY = Math.min(...points.map((p) => p.y));
      const maxY = Math.max(...points.map((p) => p.y));

      if (x >= minX - 20 && x <= maxX + 20 && y >= minY - 20 && y <= maxY + 20) {
        onPolygonClick(submission);
        return;
      }
    }
  };

  return (
    <div className="relative rounded-lg overflow-hidden border border-gray-200" style={{ height }}>
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-pointer"
        onClick={handleCanvasClick}
      />

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-white p-3 rounded-lg shadow-lg border border-gray-200">
        <p className="text-xs mb-2">Legenda</p>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#22c55e' }} />
            <span>SKT terdaftar</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#3b82f6' }} />
            <span>SKT terdata</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#ef4444' }} />
            <span>SKT ditolak</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#eab308' }} />
            <span>SKT ditinjau ulang</span>
          </div>
        </div>
      </div>

      {/* Info popup for hovered submission */}
      {hoveredSubmission && (
        <div className="absolute top-4 left-4 bg-white p-4 rounded-lg shadow-lg border border-gray-200 max-w-xs">
          <p className="mb-2">
            <strong>{hoveredSubmission.namaPemilik}</strong>
          </p>
          <p className="text-sm text-gray-600 mb-1">ID: {hoveredSubmission.id}</p>
          <p className="text-sm text-gray-600 mb-1">
            {hoveredSubmission.desa}, {hoveredSubmission.kecamatan}
          </p>
          <p className="text-sm text-gray-600 mb-2">Luas: {hoveredSubmission.luas} m²</p>
          <StatusBadge status={hoveredSubmission.status} />
        </div>
      )}
    </div>
  );
}
