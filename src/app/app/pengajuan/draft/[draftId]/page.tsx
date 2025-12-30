'use client';

import { SubmissionFlow } from '@/components/SubmissionFlow';
import { useAppState } from '../../../layout';
import { useRouter, useParams } from 'next/navigation';
import { trpc } from '@/trpc/client';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ArrowLeft } from 'lucide-react';

export default function DraftEditorPage() {
  const { handleCompleteSubmission } = useAppState();
  const router = useRouter();
  const params = useParams<{ draftId: string }>();
  
  const draftId = Number(params.draftId);
  
  // Validate draftId is a number
  const isValidId = !isNaN(draftId) && draftId > 0;
  
  // Query the draft to verify it exists and user has access
  const { data: draft, isLoading, error } = trpc.drafts.getById.useQuery(
    { draftId },
    { enabled: isValidId }
  );

  const handleCancelSubmissionFlow = () => {
    router.push('/app/pengajuan');
  };

  // Invalid draft ID format
  if (!isValidId) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">ID Draft Tidak Valid</h1>
        <p className="text-gray-600 mb-6">
          Format ID draft tidak valid. Silakan kembali ke daftar draft.
        </p>
        <Button onClick={() => router.push('/app/pengajuan')} variant="outline">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Kembali ke Daftar Draft
        </Button>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Memuat draft...</span>
      </div>
    );
  }

  // Error state (draft not found or unauthorized)
  if (error || !draft) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Draft Tidak Ditemukan</h1>
        <p className="text-gray-600 mb-6">
          {error?.message || 'Draft yang Anda cari tidak ditemukan atau Anda tidak memiliki akses.'}
        </p>
        <Button onClick={() => router.push('/app/pengajuan')} variant="outline">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Kembali ke Daftar Draft
        </Button>
      </div>
    );
  }

  // Success - render SubmissionFlow
  return (
    <SubmissionFlow
      draftId={draftId}
      onCancel={handleCancelSubmissionFlow}
      onComplete={handleCompleteSubmission}
    />
  );
}

