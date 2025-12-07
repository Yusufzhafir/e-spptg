'use client';

import './globals.css'; // if you have one
import { ReactNode, useState, useMemo } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { Toaster } from '@/components/ui/sonner';
import {
  monthlyData,
  // mockUsers,
  // mockVillages,
  // mockProhibitedAreas,
  calculateKPIData
} from '@/data/mockData';
import {
  Submission,
  User,
  Village,
  ProhibitedArea,
  StatusSPPTG,
  SubmissionDraft,
} from '@/types';
import {
  ClerkProvider,
} from '@clerk/nextjs'
import { toast } from 'sonner';
import { usePathname, useRouter } from 'next/navigation';

export type AppStateContextValue = {
  setSearchQuery: (q: string) => void;
  setStatusFilter: (s: string) => void;
  handleNewSubmission: () => void;
  handleSubmitForm: (data: Partial<Submission>) => void;
  handleStatusChange: (id: number, status: StatusSPPTG, alasan: string) => void;
  handleCompleteSubmission: (draft: SubmissionDraft) => void;
};

import { createContext, useContext } from 'react';
import { TRPCProvider } from '@/trpc/client';
import { da } from 'zod/v4/locales';

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error('useAppState must be used within AppStateProvider');
  }
  return ctx;
}

export default function RootLayout({ children }: { children: ReactNode }) {
  const [submissions, setSubmissions] =
    useState<Submission[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [villages, setVillages] = useState<Village[]>([]);
  const [prohibitedAreas, setProhibitedAreas] =
    useState<ProhibitedArea[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const pathname = usePathname();
  const router = useRouter();

  // infer "currentPage" from the route
  const currentPage =
    pathname === '/pengaturan'
      ? 'pengaturan'
      : pathname.startsWith('/pengajuan')
        ? 'pengajuan'
        : 'beranda';

  const filteredSubmissions = useMemo(() => {
    let filtered = submissions;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.namaPemilik.toLowerCase().includes(query) ||
          s.nik.includes(query) ||
          s.kecamatan.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((s) => s.status === statusFilter);
    }

    return filtered;
  }, [submissions, searchQuery, statusFilter]);

  const kpiData = useMemo(
    () => calculateKPIData(submissions),
    [submissions]
  );

  // === Handlers that navigate between pages ===

  const handleNewSubmission = () => {
    router.push('/pengajuan/form');
  };

  const handleSubmitForm = (data: Partial<Submission>) => {
    const newSubmission: Submission = {
      id: 0, // Will be replaced by database
      namaPemilik: data.namaPemilik || '',
      nik: data.nik || '',
      alamat: data.alamat || '',
      nomorHP: data.nomorHP || '',
      email: data.email || '',
      villageId: data.villageId || 0,
      kecamatan: data.kecamatan || '',
      kabupaten: data.kabupaten || 'Cirebon',
      luas: data.luas || 0,
      penggunaanLahan: data.penggunaanLahan || '',
      catatan: data.catatan || null,
      status: 'SPPTG terdata',
      tanggalPengajuan: new Date(),
      verifikator: null, // Should come from authenticated user
      riwayat: [
        {
          tanggal: new Date().toISOString(),
          status: 'SPPTG terdata',
          petugas: 'Sistem',
        },
      ],
      feedback: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setSubmissions((prev) => [newSubmission, ...prev]);
    router.push('/');
  };

  const handleStatusChange = (
    id: number, // Changed from string to number
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
      kabupaten: 'Cirebon',
      luas: draft.luasLahan || 0,
      penggunaanLahan: '',
      catatan: null,
      status: draft.status || 'SPPTG terdata',
      tanggalPengajuan: new Date(), // Changed from string to Date
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
    router.push('/');
    toast.success('Pengajuan SKT berhasil diselesaikan');
  };

  const contextValue: AppStateContextValue = {
    setSearchQuery,
    setStatusFilter,
    handleNewSubmission,
    handleSubmitForm,
    handleStatusChange,
    handleCompleteSubmission,
  };

  const handlePageChange = (page: string) => {
    if (page === 'pengaturan') router.push('/pengaturan');
    else if (page === 'pengajuan') router.push('/pengajuan');
    else router.push('/');
  };

  return (
    <ClerkProvider>
      <TRPCProvider>
        <html lang="en">
          <body>
            <AppStateContext.Provider value={contextValue}>
              <Toaster position="top-right" />
              <div className="min-h-screen bg-gray-50 flex">
                <Sidebar
                  currentPage={currentPage}
                  onPageChange={handlePageChange}
                />
                <div className="flex-1 flex flex-col">
                  <Header
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                  />
                  <main className="flex-1 p-6">{children}</main>
                </div>
              </div>
            </AppStateContext.Provider>
          </body>
        </html>
      </TRPCProvider>
    </ClerkProvider>
  );
}