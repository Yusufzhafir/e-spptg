'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { RequireRole } from '@/components/RequireRole';
import { KawasanForm } from '@/components/KawasanForm';
import { trpc } from '@/trpc/client';

export default function TambahKawasanPage() {
  const router = useRouter();
  const utils = trpc.useUtils();

  const createMutation = trpc.prohibitedAreas.create.useMutation({
    onSuccess: async () => {
      await utils.prohibitedAreas.list.invalidate();
      toast.success('Kawasan Non-SPPTG berhasil ditambahkan.');
      router.push('/app/pengaturan');
    },
    onError: (error) => {
      toast.error(error.message || 'Gagal menambahkan kawasan Non-SPPTG.');
    },
  });

  return (
    <RequireRole
      allowedRoles={['Superadmin', 'Admin', 'Verifikator']}
      showError={true}
      redirectTo="/app"
    >
      <KawasanForm
        mode="create"
        isSubmitting={createMutation.isPending}
        onSubmit={(data) => createMutation.mutate(data)}
      />
    </RequireRole>
  );
}
