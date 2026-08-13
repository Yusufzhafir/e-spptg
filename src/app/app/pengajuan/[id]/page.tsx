'use client';

import { usePathname, useParams, useRouter, useSearchParams } from 'next/navigation';
import { DetailPage } from '@/components/DetailPage';
import { trpc } from '@/trpc/client';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import {
  FeedbackData,
  StatusHistory,
  Submission,
  SubmissionGeometry,
  SubmissionPayloadSnapshot,
} from '@/types';


function DetailLoading() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      <span className="ml-3 text-gray-600">Memuat pengajuan...</span>
    </div>
  );
}

/** `useSearchParams` needs a Suspense boundary above it. */
export default function SubmissionDetailPage() {
  return (
    <Suspense fallback={<DetailLoading />}>
      <SubmissionDetail />
    </Suspense>
  );
}

function SubmissionDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const {
    data: submission,
    isLoading,
    isError,
  } = trpc.submissions.byId.useQuery({ id: Number(id) });
  const mappedData = useMemo<Submission | null>(() => {
    if (!submission) {
      return null;
    }

    const parsedGeoJSON = submission.geoJSON;
    // MultiPolygon as well as Polygon: a pengajuan may cover several bidang, and
    // older rows predate that — narrowing to Polygon alone would silently drop
    // the boundary of every multi-bidang berkas.
    const candidate =
      parsedGeoJSON && typeof parsedGeoJSON === 'object'
        ? (parsedGeoJSON as { type?: string; coordinates?: unknown })
        : null;
    const geoJSON: SubmissionGeometry | null =
      candidate &&
      (candidate.type === 'Polygon' || candidate.type === 'MultiPolygon') &&
      Array.isArray(candidate.coordinates)
        ? (candidate as unknown as SubmissionGeometry)
        : null;

    // The draft snapshot arrives as untyped jsonb; keep it only when it is an object.
    const payload =
      submission.payload && typeof submission.payload === 'object'
        ? (submission.payload as SubmissionPayloadSnapshot)
        : null;

    return {
     ...submission,
     geoJSON,
     payload,
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

  // "SPPTG berhasil diterbitkan" belongs here, not on the wizard the user is
  // leaving: it should land with them, once the pengajuan is on screen. The flag
  // is then stripped so a refresh or a shared link cannot replay it.
  const announcedIssuedSPPTG = useRef(false);
  const hasIssuedSPPTG = searchParams.get('terbit') === '1';

  useEffect(() => {
    if (!hasIssuedSPPTG || announcedIssuedSPPTG.current) return;
    announcedIssuedSPPTG.current = true;
    toast.success('SPPTG berhasil diterbitkan.');
    router.replace(pathname, { scroll: false });
  }, [hasIssuedSPPTG, pathname, router]);

  // Show a loader while fetching so we never flash "not found" before data arrives
  if (isLoading) {
    return <DetailLoading />;
  }

  if (isError || !mappedData) {
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
    />
  );
}
