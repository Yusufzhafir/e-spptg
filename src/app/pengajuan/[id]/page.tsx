'use client';

import { useParams, useRouter } from 'next/navigation';
import { DetailPage } from '@/components/DetailPage';
import { useAppState } from '@/app/layout';

export default function SubmissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { submissions, handleStatusChange } = useAppState();

  const submission = submissions.find((s) => s.id === id);

  const handleBackToDashboard = () => {
    router.push('/');
  };

  if (!submission) {
    return (
      <div className="text-gray-600">
        Pengajuan dengan ID {id} tidak ditemukan.
      </div>
    );
  }

  return (
    <DetailPage
      submission={submission}
      onBack={handleBackToDashboard}
      onStatusChange={handleStatusChange}
    />
  );
}