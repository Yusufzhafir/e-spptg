'use client';

import { SubmissionForm } from '@/components/SubmissionForm';
import { useRouter } from 'next/navigation';
import { Submission } from '@/types';

export default function SubmissionFormPage() {
  const router = useRouter();

  const handleCancelForm = () => {
    router.push('/app');
  };

  const handleSubmitForm = (data: Partial<Submission>) => {
    // Note: This form currently doesn't persist to backend
    // The main submission flow uses SubmissionFlow component with drafts
    // This just navigates back after the form shows its success toast
    router.push('/app');
  };

  return (
    <SubmissionForm
      onSubmit={handleSubmitForm}
      onCancel={handleCancelForm}
    />
  );
}
