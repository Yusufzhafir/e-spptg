'use client';

import { useParams, useRouter } from 'next/navigation';
import { DetailPage } from '@/components/DetailPage';
import { useAppState } from '@/app/app/layout';
import { trpc } from '@/trpc/client';
import { useMemo } from 'react';
import { FeedbackData, GeoJSONPolygon, StatusHistory, Submission } from '@/types';


export default function SubmissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { handleStatusChange } = useAppState();

  const {data: submission} = trpc.submissions.byId.useQuery({ id: Number(id) });
  const mappedData = useMemo<Submission | null>(() => {
    if (!submission) {
      return null;
    }

    const parsedGeoJSON = submission.geoJSON;
    const geoJSON: GeoJSONPolygon | null | undefined =
      parsedGeoJSON &&
      typeof parsedGeoJSON === 'object' &&
      'type' in parsedGeoJSON &&
      (parsedGeoJSON as { type?: string }).type === 'Polygon' &&
      'coordinates' in parsedGeoJSON
        ? (parsedGeoJSON as GeoJSONPolygon)
        : null;

    return {
     ...submission,
     geoJSON,
     tanggalPengajuan: new Date(submission?.tanggalPengajuan),
     riwayat: submission?.riwayat as StatusHistory[],
     feedback: submission?.feedback as FeedbackData | null,
     createdAt: new Date(submission?.createdAt),
     updatedAt: new Date(submission?.updatedAt),
    };
  }, [submission]);
  const handleBackToDashboard = () => {
    router.push('/app');
  };

  if (!mappedData) {
    return (
      <div className="text-gray-600">
        Pengajuan dengan ID {id} tidak ditemukan.
      </div>
    );
  }

  return (
    <DetailPage
      submission={mappedData}
      onBack={handleBackToDashboard}
      onStatusChange={handleStatusChange}
    />
  );
}
