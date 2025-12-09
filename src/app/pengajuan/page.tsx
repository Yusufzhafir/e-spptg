'use client';

import { SubmissionFlow } from '@/components/SubmissionFlow';
import { useAppState } from '../layout';
import { useRouter } from 'next/navigation';
import { Protect } from '@clerk/nextjs';

export default function PengajuanPage() {
  const { handleCompleteSubmission } = useAppState();
  const router = useRouter();

  const handleCancelSubmissionFlow = () => {
    router.push('/');
  };

  return (
    <SubmissionFlow
      onCancel={handleCancelSubmissionFlow}
      onComplete={handleCompleteSubmission}
    />
  );
}