'use client';

import { SubmissionForm } from '@/components/SubmissionForm';
import { useAppState } from '@/app/app/layout';
import { useRouter } from 'next/navigation';

export default function SubmissionFormPage() {
  const { handleSubmitForm } = useAppState();
  const router = useRouter();

  const handleCancelForm = () => {
    router.push('/app');
  };

  return (
    <SubmissionForm
      onSubmit={handleSubmitForm}
      onCancel={handleCancelForm}
    />
  );
}
