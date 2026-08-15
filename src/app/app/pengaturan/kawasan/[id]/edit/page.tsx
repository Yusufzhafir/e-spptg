'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { RequireRole } from '@/components/RequireRole';
import { KawasanForm } from '@/components/KawasanForm';
import { useAuthRole } from '@/components/AuthRoleProvider';
import { getKawasanDraft } from '@/lib/kawasan-draft-storage';
import { ProhibitedArea } from '@/types';
import { UpdateProhibitedAreaInput } from '@/types/prohibitedAreas';
import { trpc } from '@/trpc/client';
import type { KawasanDraftPayload } from '@/lib/validation';

export default function EditKawasanPage() {
  const { id } = useParams<{ id: string }>();
  const areaId = Number(id);
  const router = useRouter();
  const utils = trpc.useUtils();
  const { user: currentUser } = useAuthRole();

  // `?draft=<id>` resumes an unfinished edit of this same kawasan, held in this
  // browser's localStorage.
  const searchParams = useSearchParams();
  const draftId = searchParams.get('draft') ?? undefined;

  const { data, isLoading, isError } = trpc.prohibitedAreas.byId.useQuery(
    { id: areaId },
    { enabled: Number.isFinite(areaId) }
  );

  // Read after mount: localStorage does not exist while this page prerenders.
  // A draft that has since been deleted simply falls back to the saved kawasan
  // rather than blocking the edit.
  const [draft, setDraft] = useState<KawasanDraftPayload | undefined>(undefined);
  const [isDraftLoaded, setIsDraftLoaded] = useState(draftId === undefined);

  useEffect(() => {
    if (draftId === undefined || !currentUser) return;
    const found = getKawasanDraft(currentUser.id, draftId);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is unreadable during render
    setDraft(found?.payload);
    setIsDraftLoaded(true);
  }, [draftId, currentUser]);

  const updateMutation = trpc.prohibitedAreas.update.useMutation({
    onSuccess: async () => {
      // Invalidate the whole router, not just `list`: `byId` backs this edit
      // screen, so leaving it cached made a re-opened page show the old polygon
      // until a hard refresh.
      await utils.prohibitedAreas.invalidate();
      toast.success('Kawasan Non-SPPTG berhasil diperbarui.');
      router.push('/app/pengaturan/kawasan');
    },
    onError: (error) => {
      toast.error(error.message || 'Gagal memperbarui kawasan Non-SPPTG.');
    },
  });

  const initialArea = useMemo<ProhibitedArea | undefined>(() => {
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return undefined;
    return {
      id: row.id,
      namaKawasan: row.namaKawasan,
      jenisKawasan: row.jenisKawasan,
      sumberData: row.sumberData,
      dasarHukum: row.dasarHukum,
      tanggalEfektif:
        typeof row.tanggalEfektif === 'string'
          ? row.tanggalEfektif
          : new Date(row.tanggalEfektif).toISOString(),
      tanggalUnggah:
        typeof row.tanggalUnggah === 'string'
          ? row.tanggalUnggah
          : new Date(row.tanggalUnggah).toISOString(),
      diunggahOleh: row.diunggahOleh,
      statusValidasi: row.statusValidasi,
      aktifDiValidasi: row.aktifDiValidasi,
      warna: row.warna,
      catatan: row.catatan,
      geomGeoJSON: (row.geom as string | null) ?? null,
    };
  }, [data]);

  // KawasanForm (and the map inside it) seed their state once on mount. React
  // Query can hand us cached data first and the fresh row a moment later, so key
  // the form on the record's revision: when newer data lands, the form remounts
  // and the map redraws the saved polygon instead of the stale one.
  const formKey = useMemo(() => {
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return 'kawasan-empty';
    const base = `kawasan-${row.id}-${new Date(row.updatedAt).getTime()}`;
    // A resumed draft seeds the same form, so it belongs in the key too.
    return draftId === undefined ? base : `${base}-draft-${draftId}`;
  }, [data, draftId]);

  return (
    <RequireRole
      allowedRoles={['Superadmin', 'Admin']}
      showError={true}
      redirectTo="/app"
    >
      {isLoading || !isDraftLoaded ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          <span className="ml-3 text-gray-600">Memuat data kawasan...</span>
        </div>
      ) : isError || !initialArea ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-600">
          <p>Kawasan tidak ditemukan.</p>
          <button
            className="text-blue-600 hover:underline"
            onClick={() => router.push('/app/pengaturan')}
          >
            Kembali ke Pengaturan
          </button>
        </div>
      ) : (
        <KawasanForm
          key={formKey}
          mode="edit"
          initialArea={initialArea}
          initialDraftId={draftId}
          initialDraft={draft}
          isSubmitting={updateMutation.isPending}
          onSubmit={(payload, options, onSaved) => {
            const data: UpdateProhibitedAreaInput = { ...payload };
            updateMutation.mutate(
              {
                id: areaId,
                data,
                abaikanTumpangTindih: options.abaikanTumpangTindih,
              },
              { onSuccess: onSaved }
            );
          }}
        />
      )}
    </RequireRole>
  );
}
