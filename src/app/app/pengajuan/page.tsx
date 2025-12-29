'use client';

import { SubmissionFlow } from '@/components/SubmissionFlow';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { SubmissionDraft } from '@/types';

export default function PengajuanPage() {
  const router = useRouter();

  const handleCancelSubmissionFlow = () => {
    router.push('/app');
  };

  const handleCompleteSubmission = (draft: SubmissionDraft) => {
    // The SubmissionFlow component already handles the backend mutation
    // This callback just handles post-completion navigation
    router.push('/app');
    toast.success('Pengajuan SKT berhasil diselesaikan');
  };

  return (
    <SubmissionFlow
      onCancel={handleCancelSubmissionFlow}
      onComplete={handleCompleteSubmission}
    />
  );
}
