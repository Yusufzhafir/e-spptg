'use client';

import { Settings } from '@/components/Settings';
import { RequireRole } from '@/components/RequireRole';
import { trpc } from '@/trpc/client';
import { User, Village, ProhibitedArea } from '@/types';
import { useMemo } from 'react';
import { toast } from 'sonner';
import { CreateProhibitedAreaInput, UpdateProhibitedAreaInput } from '@/types/prohibitedAreas';

export default function PengaturanPage() {
  const { data: usersData, refetch: refetchUsers } = trpc.users.list.useQuery({
    limit: 1000,
    offset: 0,
  });

  const { data: villagesData, refetch: refetchVillages } = trpc.villages.list.useQuery({
    limit: 1000,
    offset: 0,
  });

  const { data: prohibitedAreasData, refetch: refetchProhibitedAreas } = trpc.prohibitedAreas.list.useQuery({
    limit: 1000,
    offset: 0,
  });

  const { data: currentUser } = trpc.auth.me.useQuery();

  const updateUserMutation = trpc.users.update.useMutation({
    onSuccess: () => {
      refetchUsers();
      toast.success('Pengguna berhasil diperbarui.');
    },
    onError: (error) => {
      toast.error(error.message || 'Gagal memperbarui pengguna.');
    },
  });

  const toggleUserStatusMutation = trpc.users.toggleStatus.useMutation({
    onSuccess: () => {
      refetchUsers();
      toast.success('Status pengguna berhasil diperbarui.');
    },
    onError: (error) => {
      toast.error(error.message || 'Gagal memperbarui status pengguna.');
    },
  });

  const createVillageMutation = trpc.villages.create.useMutation({
    onSuccess: () => {
      refetchVillages();
      toast.success('Desa berhasil ditambahkan.');
    },
    onError: (error) => {
      toast.error(error.message || 'Gagal menambahkan desa.');
    },
  });

  const updateVillageMutation = trpc.villages.update.useMutation({
    onSuccess: () => {
      refetchVillages();
      toast.success('Desa berhasil diperbarui.');
    },
    onError: (error) => {
      toast.error(error.message || 'Gagal memperbarui desa.');
    },
  });

  const deleteVillageMutation = trpc.villages.delete.useMutation({
    onSuccess: () => {
      refetchVillages();
      toast.success('Desa berhasil dihapus.');
    },
    onError: (error) => {
      toast.error(error.message || 'Gagal menghapus desa.');
    },
  });

  const createProhibitedAreaMutation = trpc.prohibitedAreas.create.useMutation({
    onSuccess: () => {
      refetchProhibitedAreas();
      toast.success('Kawasan Non-SPPTG berhasil ditambahkan.');
    },
    onError: (error) => {
      toast.error(error.message || 'Gagal menambahkan kawasan Non-SPPTG.');
    },
  });

  const updateProhibitedAreaMutation = trpc.prohibitedAreas.update.useMutation({
    onSuccess: () => {
      refetchProhibitedAreas();
      toast.success('Kawasan Non-SPPTG berhasil diperbarui.');
    },
    onError: (error) => {
      toast.error(error.message || 'Gagal memperbarui kawasan Non-SPPTG.');
    },
  });

  const deleteProhibitedAreaMutation = trpc.prohibitedAreas.delete.useMutation({
    onSuccess: () => {
      refetchProhibitedAreas();
      toast.success('Kawasan Non-SPPTG berhasil dihapus.');
    },
    onError: (error) => {
      toast.error(error.message || 'Gagal menghapus kawasan Non-SPPTG.');
    },
  });

  const users: User[] = useMemo(() => {
    if (!usersData) return [];
    return usersData.map((u) => ({
      id: u.id,
      clerkUserId: u.clerkUserId,
      nama: u.nama,
      nipNik: u.nipNik,
      email: u.email,
      peran: u.peran,
      assignedVillageId: u.assignedVillageId ?? null,
      status: u.status,
      nomorHP: u.nomorHP || null,
      terakhirMasuk: u.terakhirMasuk ? new Date(u.terakhirMasuk) : null,
    }));
  }, [usersData]);

  const villages: Village[] = useMemo(() => {
    if (!villagesData) return [];
    return villagesData.map((v) => ({
      id: v.id,
      kodeDesa: v.kodeDesa,
      namaDesa: v.namaDesa,
      namaKepalaDesa: v.namaKepalaDesa ?? null,
      juruUkurNama: v.juruUkurNama ?? null,
      juruUkurJabatan: v.juruUkurJabatan ?? null,
      juruUkurInstansi: v.juruUkurInstansi ?? null,
      juruUkurNomorHP: v.juruUkurNomorHP ?? null,
      kecamatan: v.kecamatan,
      kabupaten: v.kabupaten,
      provinsi: v.provinsi,
      jumlahPengajuan: v.jumlahPengajuan || 0,
    }));
  }, [villagesData]);

  const prohibitedAreas: ProhibitedArea[] = useMemo(() => {
    if (!prohibitedAreasData) return [];
    return prohibitedAreasData.map((a) => ({
      id: a.id,
      namaKawasan: a.namaKawasan,
      jenisKawasan: a.jenisKawasan,
      sumberData: a.sumberData,
      dasarHukum: a.dasarHukum,
      tanggalEfektif:
        typeof a.tanggalEfektif === 'string' ? a.tanggalEfektif : new Date(a.tanggalEfektif).toISOString(),
      tanggalUnggah:
        typeof a.tanggalUnggah === 'string' ? a.tanggalUnggah : new Date(a.tanggalUnggah).toISOString(),
      diunggahOleh: a.diunggahOleh,
      statusValidasi: a.statusValidasi,
      aktifDiValidasi: a.aktifDiValidasi,
      warna: a.warna,
      catatan: a.catatan,
      geomGeoJSON: a.geom as string | null,
    }));
  }, [prohibitedAreasData]);

  const handleUpdateUser = (
    id: number,
    data: Partial<Pick<User, 'nama' | 'nipNik' | 'email' | 'peran' | 'assignedVillageId' | 'nomorHP' | 'status'>>
  ) => {
    updateUserMutation.mutate({
      id,
      data: {
        nama: data.nama,
        nipNik: data.nipNik,
        email: data.email,
        peran: data.peran,
        assignedVillageId: data.assignedVillageId,
        status: data.status,
        nomorHP: data.nomorHP || undefined,
      },
    });
  };

  const handleToggleUserStatus = (id: number) => {
    toggleUserStatusMutation.mutate({ id });
  };

  const handleCreateVillage = (data: {
    kodeDesa: string;
    namaDesa: string;
    namaKepalaDesa: string;
    juruUkurNama: string;
    juruUkurJabatan: string;
    juruUkurInstansi?: string;
    juruUkurNomorHP: string;
    kecamatan: string;
    kabupaten: string;
    provinsi: string;
  }) => {
    createVillageMutation.mutate(data);
  };

  const handleUpdateVillage = (
    id: number,
    data: Partial<{
      kodeDesa: string;
      namaDesa: string;
      namaKepalaDesa: string;
      juruUkurNama: string;
      juruUkurJabatan: string;
      juruUkurInstansi?: string;
      juruUkurNomorHP: string;
      kecamatan: string;
      kabupaten: string;
      provinsi: string;
    }>
  ) => {
    updateVillageMutation.mutate({ id, data });
  };

  const handleDeleteVillage = (id: number) => {
    deleteVillageMutation.mutate({ id });
  };

  const handleCreateProhibitedArea = (data: CreateProhibitedAreaInput) => {
    createProhibitedAreaMutation.mutate(data);
  };

  const handleUpdateProhibitedArea = (
    id: number,
    data: UpdateProhibitedAreaInput
  ) => {
    updateProhibitedAreaMutation.mutate({ id, data });
  };

  const handleUpdateProhibitedAreas = (newAreas: ProhibitedArea[]) => {
    const previousById = new Map(prohibitedAreas.map((area) => [area.id, area]));
    const nextIds = new Set(newAreas.map((area) => area.id));

    for (const area of newAreas) {
      const prev = previousById.get(area.id);
      if (!prev) continue;

      if (prev.aktifDiValidasi !== area.aktifDiValidasi) {
        handleUpdateProhibitedArea(area.id, { aktifDiValidasi: area.aktifDiValidasi });
      }
    }

    const removed = prohibitedAreas.filter((area) => !nextIds.has(area.id));
    removed.forEach((area) => {
      deleteProhibitedAreaMutation.mutate({ id: area.id });
    });
  };

  const isLoading = !usersData || !villagesData || !prohibitedAreasData;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Memuat data...</div>
      </div>
    );
  }

  return (
    <RequireRole
      allowedRoles={['Superadmin', 'Admin', 'Verifikator']}
      showError={true}
      redirectTo="/app"
    >
      <Settings
        users={users}
        villages={villages}
        prohibitedAreas={prohibitedAreas}
        onUpdateUser={handleUpdateUser}
        onToggleUserStatus={handleToggleUserStatus}
        onUpdateProhibitedAreas={handleUpdateProhibitedAreas}
        onCreateVillage={handleCreateVillage}
        onUpdateVillage={handleUpdateVillage}
        onDeleteVillage={handleDeleteVillage}
        onCreateProhibitedArea={handleCreateProhibitedArea}
        onUpdateProhibitedArea={handleUpdateProhibitedArea}
        isCreatingVillage={createVillageMutation.isPending}
        isUpdatingVillage={updateVillageMutation.isPending}
        isDeletingVillage={deleteVillageMutation.isPending}
        isCreatingProhibitedArea={createProhibitedAreaMutation.isPending}
        isUpdatingProhibitedArea={updateProhibitedAreaMutation.isPending}
        currentUserId={currentUser?.id}
      />
    </RequireRole>
  );
}
