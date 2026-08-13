'use client';

import { useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { trpc } from '@/trpc/client';
import { toast } from 'sonner';

export default function EditSubmissionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const startedRef = useRef(false);

  const utils = trpc.useUtils();

  const createFromSubmission = trpc.drafts.createFromSubmission.useMutation({
    onSuccess: async (data) => {
      // Opening the editor flags the pengajuan tidak valid server-side. The
      // list, the map and the detail page are all cached for 30s, so without
      // this the old "valid" badge survives until something happens to refetch
      // — which read as the flag not having been applied at all.
      await utils.submissions.invalidate();
      router.replace(`/app/pengajuan/draft/${data.id}`);
    },
    onError: (error) => {
      toast.error(error.message || 'Gagal membuka editor pengajuan');
      router.replace(`/app/pengajuan/${id}`);
    },
  });

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    createFromSubmission.mutate({ submissionId: Number(id) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      <span className="ml-3 text-gray-600">Menyiapkan editor pengajuan...</span>
    </div>
  );
}
