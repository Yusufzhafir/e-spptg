'use client';

import { Suspense, useEffect, useRef } from 'react';
import { SubmissionFlow } from '@/components/SubmissionFlow';
import { useAppState } from '../../../layout';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { trpc } from '@/trpc/client';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ArrowLeft } from 'lucide-react';

function DraftLoading() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <span className="ml-3 text-gray-600">Memuat draft...</span>
    </div>
  );
}

/**
 * `useSearchParams` needs a Suspense boundary above it, so the editor itself
 * lives in an inner component.
 */
export default function DraftEditorPage() {
  return (
    <Suspense fallback={<DraftLoading />}>
      <DraftEditor />
    </Suspense>
  );
}

function DraftEditor() {
  const { handleCompleteSubmission } = useAppState();
  const router = useRouter();
  const params = useParams<{ draftId: string }>();
  const searchParams = useSearchParams();

  const draftId = Number(params.draftId);

  // Validate draftId is a number
  const isValidId = !isNaN(draftId) && draftId > 0;

  // Query the draft to verify it exists and user has access
  const { data: draft, isLoading, error } = trpc.drafts.getById.useQuery(
    { draftId },
    { enabled: isValidId }
  );

  // "Draft baru berhasil dibuat" is raised here rather than on the list page, so
  // the confirmation appears once the editor is actually on screen. The flag is
  // then stripped from the URL: a refresh or a shared link must not replay it.
  const announcedNewDraft = useRef(false);
  const isNewDraft = searchParams.get('baru') === '1';

  useEffect(() => {
    if (!isNewDraft || announcedNewDraft.current || !draft) return;
    announcedNewDraft.current = true;
    toast.success('Draft baru berhasil dibuat');
    router.replace(`/app/pengajuan/draft/${draftId}`);
  }, [isNewDraft, draft, draftId, router]);

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
    return <DraftLoading />;
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

