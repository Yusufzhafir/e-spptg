'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { RequireRole } from '@/components/RequireRole';
import { KawasanForm } from '@/components/KawasanForm';
import { KawasanBulkImport } from '@/components/KawasanBulkImport';
import { useAuthRole } from '@/components/AuthRoleProvider';
import { getKawasanDraft } from '@/lib/kawasan-draft-storage';
import { trpc } from '@/trpc/client';
import type { KawasanBulkHandoff } from '@/lib/kawasan-bulk-import';
import type { KawasanDraftPayload } from '@/lib/validation';

export default function TambahKawasanPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { user: currentUser } = useAuthRole();

  // `?draft=<id>` resumes a draft held in this browser. Kept in the URL rather
  // than in state so "Lanjutkan" from the kawasan list is a plain navigation
  // and a reload does not silently drop back to an empty form.
  const searchParams = useSearchParams();
  const draftId = searchParams.get('draft') ?? undefined;

  // localStorage cannot be read while rendering — this page is prerendered, and
  // there is no `window` then. So the draft is fetched after mount and the form
  // waits for it; `status` is what tells the two apart from "no draft asked for".
  const [draft, setDraft] = useState<KawasanDraftPayload | undefined>(undefined);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'missing'>(
    draftId === undefined ? 'ready' : 'loading'
  );

  useEffect(() => {
    if (draftId === undefined || !currentUser) return;
    const found = getKawasanDraft(currentUser.id, draftId);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is unreadable during render
    setDraft(found?.payload);
    setStatus(found ? 'ready' : 'missing');
  }, [draftId, currentUser]);

  // Set when the uploaded file turned out to describe several kawasan and the
  // officer chose to import them all. The page then *becomes* the bulk
  // importer, carrying the already-parsed groups rather than asking for the
  // file a second time — bulk import belongs where the officer already is.
  const [bulkHandoff, setBulkHandoff] = useState<KawasanBulkHandoff | null>(null);

  const createMutation = trpc.prohibitedAreas.create.useMutation({
    onSuccess: async () => {
      await utils.prohibitedAreas.invalidate();
      toast.success('Kawasan Non-SPPTG berhasil ditambahkan.');
      router.push('/app/pengaturan/kawasan');
    },
    onError: (error) => {
      toast.error(error.message || 'Gagal menambahkan kawasan Non-SPPTG.');
    },
  });

  return (
    <RequireRole
      allowedRoles={['Superadmin', 'Admin']}
      showError={true}
      redirectTo="/app"
    >
      {bulkHandoff ? (
        <KawasanBulkImport
          handoff={bulkHandoff}
          // Back to the form, with its own state intact: the officer may have
          // meant to make one kawasan after all.
          onCancel={() => setBulkHandoff(null)}
        />
      ) : status === 'loading' ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          <span className="ml-3 text-gray-600">Memuat draft kawasan...</span>
        </div>
      ) : status === 'missing' ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-600">
          <p>Draft kawasan tidak ditemukan di browser ini.</p>
          <p className="max-w-md text-center text-sm text-gray-500">
            Draft disimpan hanya di browser tempat Anda membuatnya, jadi draft
            tidak tersedia di perangkat lain atau setelah data situs dibersihkan.
          </p>
          <button
            className="text-blue-600 hover:underline"
            onClick={() => router.push('/app/pengaturan/kawasan/tambah')}
          >
            Mulai kawasan baru
          </button>
        </div>
      ) : (
        <KawasanForm
          // The form and the map inside it seed their state once on mount, so
          // the draft has to be in hand before it renders — hence the gate above
          // and the key here.
          key={draftId ?? 'kawasan-baru'}
          mode="create"
          initialDraftId={draftId}
          initialDraft={draft}
          isSubmitting={createMutation.isPending}
          onBulkImportRequested={setBulkHandoff}
          onSubmit={(data, options, onSaved) =>
            createMutation.mutate(
              { ...data, abaikanTumpangTindih: options.abaikanTumpangTindih },
              { onSuccess: onSaved }
            )
          }
        />
      )}
    </RequireRole>
  );
}
