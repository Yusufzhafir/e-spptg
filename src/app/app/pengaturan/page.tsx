'use client';

import { Settings } from '@/components/Settings';
import { RequireRole } from '@/components/RequireRole';
import { trpc } from '@/trpc/client';
import { User, Village, ProhibitedArea } from '@/types';
import { useMemo, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { CreateProhibitedAreaInput, UpdateProhibitedAreaInput } from '@/types/prohibitedAreas';

export default function PengaturanPage() {
  // Track previous state to detect changes
  const prevUsersRef = useRef<User[]>([]);
  const prevVillagesRef = useRef<Village[]>([]);
  const prevProhibitedAreasRef = useRef<ProhibitedArea[]>([]);

  // Fetch users
  const { data: usersData, refetch: refetchUsers } = trpc.users.list.useQuery({
    limit: 1000,
    offset: 0,
  });

  // Fetch villages
  const { data: villagesData, refetch: refetchVillages } = trpc.villages.list.useQuery({
    limit: 1000,
    offset: 0,
  });

  // Fetch prohibited areas
  const { data: prohibitedAreasData, refetch: refetchProhibitedAreas } = trpc.prohibitedAreas.list.useQuery({
    limit: 1000,
    offset: 0,
  });

  // Mutations
  const createUserMutation = trpc.users.create.useMutation({
    onSuccess: () => {
      refetchUsers();
    },
  });

  const updateUserMutation = trpc.users.update.useMutation({
    onSuccess: () => {
      refetchUsers();
    },
  });

  const toggleUserStatusMutation = trpc.users.toggleStatus.useMutation({
    onSuccess: () => {
      refetchUsers();
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

  // Fetch current user
  const { data: currentUser } = trpc.auth.me.useQuery();

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


  // Transform data to match component types
  const users: User[] = useMemo(() => {
    if (!usersData) return [];
    return usersData.map((u) => ({
      id: u.id,
      clerkUserId: u.clerkUserId,
      nama: u.nama,
      nipNik: u.nipNik,
      email: u.email,
      peran: u.peran,
      status: u.status,
      nomorHP: u.nomorHP || null,
      terakhirMasuk: u.terakhirMasuk ? new Date(u.terakhirMasuk) : null,
    }));
  }, [usersData]);

  useEffect(() => {
    prevUsersRef.current = users;
  }, [users]);

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

  useEffect(() => {
    prevVillagesRef.current = villages;
  }, [villages]);

  const prohibitedAreas: ProhibitedArea[] = useMemo(() => {
    if (!prohibitedAreasData) return [];
    return prohibitedAreasData.map((a) => ({
      id: a.id,
      namaKawasan: a.namaKawasan,
      jenisKawasan: a.jenisKawasan,
      sumberData: a.sumberData,
      dasarHukum: a.dasarHukum,
      tanggalEfektif: typeof a.tanggalEfektif === 'string' ? a.tanggalEfektif : new Date(a.tanggalEfektif).toISOString(),
      tanggalUnggah: typeof a.tanggalUnggah === 'string' ? a.tanggalUnggah : new Date(a.tanggalUnggah).toISOString(),
      diunggahOleh: a.diunggahOleh,
      statusValidasi: a.statusValidasi,
      aktifDiValidasi: a.aktifDiValidasi,
      warna: a.warna,
      catatan: a.catatan,
      geomGeoJSON: a.geom as string | null,
    }));
  }, [prohibitedAreasData]);

  useEffect(() => {
    prevProhibitedAreasRef.current = prohibitedAreas;
  }, [prohibitedAreas]);

  // Handler functions that sync with TRPC by detecting changes
  const handleUpdateUsers = (newUsers: User[]) => {
    const prevUsers = prevUsersRef.current;
    
    // Detect new users (users with IDs not in previous list)
    const newUserIds = new Set(prevUsers.map(u => u.id));
    const addedUsers = newUsers.filter(u => !newUserIds.has(u.id));
    
    // Detect deleted users
    const currentUserIds = new Set(newUsers.map(u => u.id));
    const deletedUsers = prevUsers.filter(u => !currentUserIds.has(u.id));
    
    // Detect updated users (users that exist in both but have changed)
    const updatedUsers = newUsers.filter(newUser => {
      const oldUser = prevUsers.find(u => u.id === newUser.id);
      if (!oldUser) return false;
      return JSON.stringify(oldUser) !== JSON.stringify(newUser);
    });

    // Handle additions
    addedUsers.forEach(user => {
      // Note: Creating users requires clerkUserId which we don't have here
      // This will need to be handled differently - users should be created through Clerk first
      console.warn('User creation through this handler is not supported. Users must be created through Clerk.');
    });

    // Handle updates
    updatedUsers.forEach(user => {
      // Check if it's a status toggle
      const oldUser = prevUsers.find(u => u.id === user.id);
      if (oldUser && oldUser.status !== user.status) {
        toggleUserStatusMutation.mutate({ id: user.id });
      } else {
        // Regular update
        updateUserMutation.mutate({
          id: user.id,
          data: {
            nama: user.nama,
            nipNik: user.nipNik,
            email: user.email,
            peran: user.peran,
            status: user.status,
            nomorHP: user.nomorHP || undefined,
          },
        });
      }
    });

    // Handle deletions (users are typically deactivated, not deleted)
    deletedUsers.forEach(user => {
      // Users are not deleted, they're deactivated
      if (user.status === 'Aktif') {
        toggleUserStatusMutation.mutate({ id: user.id });
      }
    });

    prevUsersRef.current = newUsers;
  };

  const handleUpdateVillages = (newVillages: Village[]) => {
    const prevVillages = prevVillagesRef.current;
    
    // Detect new villages
    const prevVillageIds = new Set(prevVillages.map(v => v.id));
    const addedVillages = newVillages.filter(v => !prevVillageIds.has(v.id));
    
    // Detect deleted villages
    const currentVillageIds = new Set(newVillages.map(v => v.id));
    const deletedVillages = prevVillages.filter(v => !currentVillageIds.has(v.id));
    
    // Detect updated villages
    const updatedVillages = newVillages.filter(newVillage => {
      const oldVillage = prevVillages.find(v => v.id === newVillage.id);
      if (!oldVillage) return false;
      return JSON.stringify(oldVillage) !== JSON.stringify(newVillage);
    });

    // Handle additions
    addedVillages.forEach(village => {
      createVillageMutation.mutate({
        kodeDesa: village.kodeDesa,
        namaDesa: village.namaDesa,
        namaKepalaDesa: village.namaKepalaDesa || '',
        juruUkurNama: village.juruUkurNama || '',
        juruUkurJabatan: village.juruUkurJabatan || '',
        juruUkurInstansi: village.juruUkurInstansi || undefined,
        juruUkurNomorHP: village.juruUkurNomorHP || '',
        kecamatan: village.kecamatan,
        kabupaten: village.kabupaten,
        provinsi: village.provinsi,
      });
    });

    // Handle updates
    updatedVillages.forEach(village => {
      updateVillageMutation.mutate({
        id: village.id,
        data: {
          kodeDesa: village.kodeDesa,
          namaDesa: village.namaDesa,
          namaKepalaDesa: village.namaKepalaDesa || '',
          juruUkurNama: village.juruUkurNama || '',
          juruUkurJabatan: village.juruUkurJabatan || '',
          juruUkurInstansi: village.juruUkurInstansi || undefined,
          juruUkurNomorHP: village.juruUkurNomorHP || '',
          kecamatan: village.kecamatan,
          kabupaten: village.kabupaten,
          provinsi: village.provinsi,
        },
      });
    });

    // Handle deletions
    deletedVillages.forEach(village => {
      deleteVillageMutation.mutate({ id: village.id });
    });

    prevVillagesRef.current = newVillages;
  };

  const handleUpdateProhibitedAreas = (newAreas: ProhibitedArea[]) => {
    const prevAreas = prevProhibitedAreasRef.current;
    
    // Detect new areas
    const prevAreaIds = new Set(prevAreas.map(a => a.id));
    const addedAreas = newAreas.filter(a => !prevAreaIds.has(a.id));
    
    // Detect deleted areas
    const currentAreaIds = new Set(newAreas.map(a => a.id));
    const deletedAreas = prevAreas.filter(a => !currentAreaIds.has(a.id));
    
    // Detect updated areas
    const updatedAreas = newAreas.filter(newArea => {
      const oldArea = prevAreas.find(a => a.id === newArea.id);
      if (!oldArea) return false;
      return JSON.stringify(oldArea) !== JSON.stringify(newArea);
    });

    // Handle additions
    addedAreas.forEach(area => {
      // Note: Creating prohibited areas requires geomGeoJSON which might not be in the transformed data
      // This will need proper handling
      console.warn('Prohibited area creation requires geometry data');
    });

    // Handle updates
    updatedAreas.forEach(area => {
      const updateData: UpdateProhibitedAreaInput = {
        namaKawasan: area.namaKawasan,
        jenisKawasan: area.jenisKawasan,
        sumberData: area.sumberData,
        dasarHukum: area.dasarHukum || undefined, // Convert null to undefined
        tanggalEfektif: new Date(area.tanggalEfektif), // Convert string to Date
        statusValidasi: area.statusValidasi,
        aktifDiValidasi: area.aktifDiValidasi,
        warna: area.warna,
        catatan: area.catatan ?? null, // Keep as string | null
      };
      updateProhibitedAreaMutation.mutate({
        id: area.id,
        data: updateData,
      });
    });

    // Deletions are no longer supported - areas can only be activated/deactivated

    prevProhibitedAreasRef.current = newAreas;
  };

  // Loading state
  const isLoading = !usersData || !villagesData || !prohibitedAreasData;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Memuat data...</div>
      </div>
    );
  }

  // Village mutation handlers
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

  const handleUpdateVillage = (id: number, data: Partial<{
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
  }>) => {
    updateVillageMutation.mutate({ id, data });
  };

  const handleDeleteVillage = (id: number) => {
    deleteVillageMutation.mutate({ id });
  };

  // Prohibited area mutation handlers
  const handleCreateProhibitedArea = (data: CreateProhibitedAreaInput) => {
    createProhibitedAreaMutation.mutate(data);
  };

  const handleUpdateProhibitedArea = (
    id: number,
    data: UpdateProhibitedAreaInput
  ) => {
    updateProhibitedAreaMutation.mutate({ id, data });
  };

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
        onUpdateUsers={handleUpdateUsers}
        onUpdateVillages={handleUpdateVillages}
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
