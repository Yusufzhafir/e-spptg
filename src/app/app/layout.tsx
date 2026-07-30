'use client';

import { ReactNode, useState, createContext, useContext } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { BottomNav } from '@/components/BottomNav';
import { Header } from '@/components/Header';
import { Submission, StatusSPPTG, SubmissionDraft } from '@/types';
import { toast } from 'sonner';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthRole } from '@/components/AuthRoleProvider';
import { AccountDeactivatedNotice } from '@/components/AccountDeactivatedNotice';

export type AppStateContextValue = {
  handleStatusChange: (id: number, status: StatusSPPTG, alasan: string) => void;
  handleCompleteSubmission: (draft: SubmissionDraft) => void;
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error('useAppState must be used within AppStateProvider');
  }
  return ctx;
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const [, setSubmissions] = useState<Submission[]>([]);

  const pathname = usePathname();
  const router = useRouter();
  const { isDeactivated } = useAuthRole();

  // infer "currentPage" from the route (under /app)
  const currentPage =
    pathname.startsWith('/app/pengaturan')
      ? 'pengaturan'
      : pathname.startsWith('/app/pengajuan')
        ? 'pengajuan'
        : 'beranda';

  const pageTitle =
    currentPage === 'pengaturan'
      ? 'Pengaturan'
      : currentPage === 'pengajuan'
        ? 'Pengajuan'
        : 'Dashboard';

  // === Handlers that navigate between pages ===

  const handleStatusChange = (
    id: number,
    status: StatusSPPTG,
    alasan: string
  ) => {
    setSubmissions((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
            ...s,
            status,
            verifikator: null, // Should be number from authenticated user, not string
            riwayat: [
              ...s.riwayat,
              {
                tanggal: new Date().toISOString(),
                status,
                petugas: 'Bambang Supriyanto', // This is just for display
                alasan: alasan || undefined,
              },
            ],
          }
          : s
      )
    );
  };

  const handleCompleteSubmission = (draft: SubmissionDraft) => {
    const newSubmission: Submission = {
      id: 0, // Will be replaced by database
      namaPemilik: draft.namaPemohon,
      nik: draft.nik,
      alamat: '',
      nomorHP: draft.juruUkur?.nomorHP || '',
      email: '',
      villageId: 0, // Need to get this from draft
      kecamatan: '',
      kabupaten: '',
      luas: draft.luasLahan || 0,
      penggunaanLahan: '',
      catatan: null,
      status: draft.status || 'SPPTG terdata',
      isValid: true,
      tanggalPengajuan: new Date(),
      ownerUserId: null,
      verifikator: draft.verifikator || null,
      riwayat: [
        {
          tanggal: new Date().toISOString(),
          status: draft.status || 'SPPTG terdata',
          petugas: 'Sistem', // Should come from authenticated user
          alasan: draft.alasanStatus,
        },
      ],
      feedback: draft.feedback || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setSubmissions((prev) => [newSubmission, ...prev]);
    router.push('/app');
    toast.success('Pengajuan SKT berhasil diselesaikan');
  };

  const contextValue: AppStateContextValue = {
    handleStatusChange,
    handleCompleteSubmission,
  };

  const handlePageChange = (page: string) => {
    if (page === 'pengaturan') router.push('/app/pengaturan');
    else if (page === 'pengajuan') router.push('/app/pengajuan');
    else router.push('/app');
  };

  // Replace the shell entirely: with the account switched off every query in it
  // would fail, so the nav, header and page would render only errors.
  if (isDeactivated) {
    return <AccountDeactivatedNotice />;
  }

  return (
    <AppStateContext.Provider value={contextValue}>
      <div className="min-h-screen bg-gray-50 flex">
        <Sidebar currentPage={currentPage} onPageChange={handlePageChange} />
        <div className="flex flex-1 flex-col min-w-0">
          <Header title={pageTitle} />
          {/* pb-20 keeps content clear of the fixed bottom nav below lg */}
          <main className="flex-1 p-4 pb-20 sm:p-6 lg:pb-6">{children}</main>
        </div>
        <BottomNav currentPage={currentPage} />
      </div>
    </AppStateContext.Provider>
  );
}
