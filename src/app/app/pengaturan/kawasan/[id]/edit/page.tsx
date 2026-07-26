'use client';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { RequireRole } from '@/components/RequireRole';
import { KawasanForm } from '@/components/KawasanForm';
import { ProhibitedArea } from '@/types';
import { UpdateProhibitedAreaInput } from '@/types/prohibitedAreas';
import { trpc } from '@/trpc/client';

export default function EditKawasanPage() {
  const { id } = useParams<{ id: string }>();
  const areaId = Number(id);
  const router = useRouter();
  const utils = trpc.useUtils();

  const { data, isLoading, isError } = trpc.prohibitedAreas.byId.useQuery(
    { id: areaId },
    { enabled: Number.isFinite(areaId) }
  );

  const updateMutation = trpc.prohibitedAreas.update.useMutation({
    onSuccess: async () => {
      await utils.prohibitedAreas.list.invalidate();
      toast.success('Kawasan Non-SPPTG berhasil diperbarui.');
      router.push('/app/pengaturan');
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

  return (
    <RequireRole
      allowedRoles={['Superadmin', 'Admin', 'Verifikator']}
      showError={true}
      redirectTo="/app"
    >
      {isLoading ? (
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
          mode="edit"
          initialArea={initialArea}
          isSubmitting={updateMutation.isPending}
          onSubmit={(payload) => {
            const data: UpdateProhibitedAreaInput = { ...payload };
            updateMutation.mutate({ id: areaId, data });
          }}
        />
      )}
    </RequireRole>
  );
}
