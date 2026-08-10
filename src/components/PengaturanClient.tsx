'use client';

import { Settings } from '@/components/Settings';
import { RequireRole } from '@/components/RequireRole';
import { trpc } from '@/trpc/client';
import { User, Village } from '@/types';
import { Suspense, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { CreateProhibitedAreaInput, UpdateProhibitedAreaInput } from '@/types/prohibitedAreas';

export type PengaturanSection = 'pengguna' | 'desa' | 'kawasan' | 'log';

/**
 * Every mutation Pengaturan can perform, plus the one list that genuinely has
 * to be complete: the desa reference data behind the pickers and the kecamatan
 * filter. The tables themselves fetch their own page — see the tab components.
 *
 * One component behind four routes, rather than four copies of the same
 * handlers — `section` only decides which table is rendered.
 */
export default function PengaturanClient({ section }: { section: PengaturanSection }) {
  const utils = trpc.useUtils();

  /**
   * The desa reference list is only wanted where a picker or a filter has to
   * offer every option: Pengguna (desa/kecamatan penugasan) and Desa (the
   * kecamatan filter). Kawasan and Audit Log have no use for it.
   */
  const needsVillages = section === 'pengguna' || section === 'desa';

  const { data: villagesData } = trpc.villages.list.useQuery(
    { limit: 1000, offset: 0 },
    { enabled: needsVillages }
  );

  const { data: currentUser } = trpc.auth.me.useQuery();

  /**
   * After any write, drop every cached read of that entity — the paged table,
   * the count pill in the nav, and the cached full list the pickers use, which
   * are three different query keys on the same data.
   */
  const invalidateUsers = useCallback(() => {
    void utils.users.list.invalidate();
    void utils.users.detail.invalidate();
  }, [utils]);

  const invalidateVillages = useCallback(() => {
    void utils.villages.list.invalidate();
    void utils.villages.listPaged.invalidate();
    void utils.villages.byId.invalidate();
  }, [utils]);

  const invalidateAreas = useCallback(() => {
    void utils.prohibitedAreas.list.invalidate();
    void utils.prohibitedAreas.listPaged.invalidate();
    void utils.prohibitedAreas.byId.invalidate();
  }, [utils]);

  const createUserMutation = trpc.users.create.useMutation({
    onSuccess: (user) => {
      invalidateUsers();
      // The server only resolves once the invite is actually handed to SMTP, so
      // this message can state it as fact rather than as an intention.
      toast.success(
        `Pengguna berhasil ditambahkan. Email undangan untuk membuat kata sandi dikirim ke ${user.email}.`
      );
    },
    onError: (error) => {
      toast.error(error.message || 'Gagal menambahkan pengguna.');
    },
  });

  const updateUserMutation = trpc.users.update.useMutation({
    onSuccess: (result) => {
      // Changing your own peran revokes every session server-side, so there is
      // nothing left to refetch — every query on this page would come back
      // UNAUTHORIZED. Send them to the login page instead.
      //
      // A full page load, for the same reason `signOut` uses one: a client-side
      // `router.replace` keeps the `/app` shell mounted, which then notices the
      // dead session and fires its own redirect on top of this one — two
      // navigations racing, and the shell stuck on its spinner. The toast stays
      // readable while the browser fetches the new document.
      if (result.signedOut) {
        toast.success('Peran Anda diubah. Silakan masuk kembali.');
        window.location.replace('/sign-in');
        return;
      }
      invalidateUsers();
      toast.success('Pengguna berhasil diperbarui.');
    },
    onError: (error) => {
      toast.error(error.message || 'Gagal memperbarui pengguna.');
    },
  });

  const toggleUserStatusMutation = trpc.users.toggleStatus.useMutation({
    onSuccess: (user) => {
      invalidateUsers();
      toast.success(
        user.status === 'Aktif'
          ? 'Pengguna berhasil diaktifkan.'
          : 'Pengguna berhasil dinonaktifkan dan dikeluarkan dari semua perangkat.'
      );
    },
    onError: (error) => {
      toast.error(error.message || 'Gagal memperbarui status pengguna.');
    },
  });

  const sendPasswordResetMutation = trpc.users.sendPasswordResetLink.useMutation({
    onSuccess: ({ email }) => {
      toast.success(`Tautan atur ulang kata sandi dikirim ke ${email}.`);
    },
    onError: (error) => {
      toast.error(error.message || 'Gagal mengirim tautan atur ulang kata sandi.');
    },
  });

  const createVillageMutation = trpc.villages.create.useMutation({
    onSuccess: () => {
      invalidateVillages();
      toast.success('Desa berhasil ditambahkan.');
    },
    onError: (error) => {
      toast.error(error.message || 'Gagal menambahkan desa.');
    },
  });

  const updateVillageMutation = trpc.villages.update.useMutation({
    onSuccess: () => {
      invalidateVillages();
      toast.success('Desa berhasil diperbarui.');
    },
    onError: (error) => {
      toast.error(error.message || 'Gagal memperbarui desa.');
    },
  });

  const deleteVillageMutation = trpc.villages.delete.useMutation({
    onSuccess: () => {
      invalidateVillages();
      toast.success('Desa berhasil dihapus.');
    },
    onError: (error) => {
      toast.error(error.message || 'Gagal menghapus desa.');
    },
  });

  const createProhibitedAreaMutation = trpc.prohibitedAreas.create.useMutation({
    onSuccess: () => {
      invalidateAreas();
      toast.success('Kawasan Non-SPPTG berhasil ditambahkan.');
    },
    onError: (error) => {
      toast.error(error.message || 'Gagal menambahkan kawasan Non-SPPTG.');
    },
  });

  // Only used by the "Aktif di Validasi" toggle in the tab (add/edit live on
  // their own pages and toast there). The switch already shows the new state, so
  // a success toast on every flip is just noise — errors are still surfaced.
  const updateProhibitedAreaMutation = trpc.prohibitedAreas.update.useMutation({
    // `byId` goes with the lists: opening the edit page after a toggle here
    // would otherwise render stale data.
    onSuccess: invalidateAreas,
    onError: (error) => {
      toast.error(error.message || 'Gagal memperbarui kawasan Non-SPPTG.');
    },
  });

  const deleteProhibitedAreaMutation = trpc.prohibitedAreas.delete.useMutation({
    onSuccess: () => {
      invalidateAreas();
      toast.success('Kawasan Non-SPPTG berhasil dihapus.');
    },
    onError: (error) => {
      toast.error(error.message || 'Gagal menghapus kawasan Non-SPPTG.');
    },
  });

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
      updatedAt: v.updatedAt ?? null,
    }));
  }, [villagesData]);

  const handleCreateUser = (
    data: Pick<User, 'nama' | 'nipNik' | 'email' | 'peran' | 'assignedVillageId' | 'assignedKecamatan' | 'nomorHP' | 'status'>
  ) => {
    // No password travels with this: the server always creates the account
    // without one and mails an invite link to set it.
    //
    // `mutateAsync` rather than `mutate` so the dialog can wait for the invite
    // to be sent; UsersTab catches the rejection, and `onError` still reports it.
    return createUserMutation.mutateAsync({
      nama: data.nama,
      nipNik: data.nipNik,
      email: data.email,
      peran: data.peran,
      assignedVillageId: data.assignedVillageId ?? undefined,
      assignedKecamatan: data.assignedKecamatan ?? undefined,
      status: data.status,
      nomorHP: data.nomorHP || undefined,
    });
  };

  const handleUpdateUser = (
    id: number,
    data: Partial<Pick<User, 'nama' | 'nipNik' | 'email' | 'peran' | 'assignedVillageId' | 'assignedKecamatan' | 'nomorHP' | 'status'>>
  ) => {
    updateUserMutation.mutate({
      id,
      data: {
        nama: data.nama,
        nipNik: data.nipNik,
        email: data.email,
        peran: data.peran,
        assignedVillageId: data.assignedVillageId,
        assignedKecamatan: data.assignedKecamatan,
        status: data.status,
        nomorHP: data.nomorHP || undefined,
      },
    });
  };

  const handleToggleUserStatus = (id: number) => {
    toggleUserStatusMutation.mutate({ id });
  };

  const handleSendPasswordReset = (id: number) => {
    sendPasswordResetMutation.mutate({ id });
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

  /**
   * One kawasan at a time. This used to take the tab's whole array and diff it
   * against the copy held here — which only worked while both sides held every
   * kawasan there is. Now that the table fetches a page, anything off it would
   * have looked deleted.
   */
  const handleToggleAreaActive = (id: number, aktifDiValidasi: boolean) => {
    updateProhibitedAreaMutation.mutate({ id, data: { aktifDiValidasi } });
  };

  const handleDeleteArea = (id: number) => {
    deleteProhibitedAreaMutation.mutate({ id });
  };

  // Only the desa reference data is waited for. The tables past this point load
  // their own page and show their own progress.
  if (needsVillages && !villagesData) {
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
      {/* The tables keep their search and filters in the query string, so the
          components below read `useSearchParams` — which has to sit under a
          Suspense boundary for the route to prerender at all. */}
      <Suspense fallback={<div className="py-12 text-center text-gray-600">Memuat data...</div>}>
      <Settings
        section={section}
        villages={villages}
        onCreateUser={handleCreateUser}
        onSendPasswordReset={handleSendPasswordReset}
        onUpdateUser={handleUpdateUser}
        onToggleUserStatus={handleToggleUserStatus}
        onToggleAreaActive={handleToggleAreaActive}
        onDeleteArea={handleDeleteArea}
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
      </Suspense>
    </RequireRole>
  );
}
