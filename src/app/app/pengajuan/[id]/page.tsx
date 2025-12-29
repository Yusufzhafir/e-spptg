'use client';

import { useParams, useRouter } from 'next/navigation';
import { DetailPage } from '@/components/DetailPage';
import { trpc } from '@/trpc/client';
import { useMemo } from 'react';
import { FeedbackData, StatusHistory, StatusSPPTG } from '@/types';
import { toast } from 'sonner';


export default function SubmissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const utils = trpc.useUtils();

  const { data: submission, isLoading } = trpc.submissions.byId.useQuery({ id: Number(id) });

  // Mutation for updating submission status
  const updateStatusMutation = trpc.submissions.updateStatus.useMutation({
    onSuccess: () => {
      toast.success('Status berhasil diperbarui');
      // Refetch the submission data to show updated status
      utils.submissions.byId.invalidate({ id: Number(id) });
    },
    onError: (error) => {
      toast.error(error.message || 'Gagal memperbarui status');
    },
  });

  const mappedData = useMemo(() => {
    if (!submission) {
      return null;
    }
    return {
     ...submission,
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

  const handleStatusChange = (submissionId: number, status: StatusSPPTG, alasan: string) => {
    updateStatusMutation.mutate({
      submissionId,
      newStatus: status,
      alasan: alasan || undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Memuat data...</span>
      </div>
    );
  }

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
