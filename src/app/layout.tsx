'use client';

import './globals.css'; // if you have one
import { ReactNode, useState, useMemo } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { Toaster } from '@/components/ui/sonner';
import {
  mockSubmissions,
  calculateKPIData,
  monthlyData,
  mockUsers,
  mockVillages,
  mockProhibitedAreas,
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
  submissions: Submission[];
  setSubmissions: React.Dispatch<React.SetStateAction<Submission[]>>;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  villages: Village[];
  setVillages: React.Dispatch<React.SetStateAction<Village[]>>;
  prohibitedAreas: ProhibitedArea[];
  setProhibitedAreas: React.Dispatch<
    React.SetStateAction<ProhibitedArea[]>
  >;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  kpiData: ReturnType<typeof calculateKPIData>;
  monthlyData: typeof monthlyData;
  handleNewSubmission: () => void;
  handleSubmitForm: (data: Partial<Submission>) => void;
  handleStatusChange: (id: string, status: StatusSPPTG, alasan: string) => void;
  handleCompleteSubmission: (draft: SubmissionDraft) => void;
};

import { createContext, useContext } from 'react';
import { TRPCProvider } from '@/trpc/client';

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
    useState<Submission[]>(mockSubmissions);
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [villages, setVillages] = useState<Village[]>(mockVillages);
  const [prohibitedAreas, setProhibitedAreas] =
    useState<ProhibitedArea[]>(mockProhibitedAreas);

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
          s.desa.toLowerCase().includes(query) ||
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
      id: `2025-01-${String(submissions.length + 1).padStart(4, '0')}`,
      namaPemilik: data.namaPemilik || '',
      nik: data.nik || '',
      alamat: data.alamat || '',
      nomorHP: data.nomorHP || '',
      email: data.email || '',
      desa: data.desa || '',
      kecamatan: data.kecamatan || '',
      kabupaten: data.kabupaten || 'Cirebon',
      luas: data.luas || 0,
      penggunaanLahan: data.penggunaanLahan || '',
      catatan: data.catatan,
      coordinates: data.coordinates || [],
      status: 'SPPTG terdata',
      tanggalPengajuan: new Date().toLocaleDateString('id-ID'),
      riwayat: [
        {
          tanggal: new Date().toLocaleString('id-ID'),
          status: 'SPPTG terdata',
          petugas: 'Sistem',
        },
      ],
    };

    setSubmissions((prev) => [newSubmission, ...prev]);
    router.push('/');
  };

  const handleStatusChange = (
    id: string,
    status: StatusSPPTG,
    alasan: string
  ) => {
    setSubmissions((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
            ...s,
            status,
            verifikator: 'Bambang Supriyanto',
            riwayat: [
              ...s.riwayat,
              {
                tanggal: new Date().toLocaleString('id-ID'),
                status,
                petugas: 'Bambang Supriyanto',
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
      id:
        draft.id ||
        `2025-01-${String(submissions.length + 1).padStart(4, '0')}`,
      namaPemilik: draft.namaPemohon,
      nik: draft.nik,
      alamat: '',
      nomorHP: draft.juruUkur?.nomorHP || '',
      email: '',
      desa: '',
      kecamatan: '',
      kabupaten: 'Cirebon',
      luas: draft.luasLahan || 0,
      penggunaanLahan: '',
      coordinates: draft.coordinatesGeografis.map((c) => [
        c.latitude,
        c.longitude,
      ]),
      status: draft.status || 'SPPTG terdata',
      tanggalPengajuan: new Date().toLocaleDateString('id-ID'),
      verifikator: draft.verifikator,
      riwayat: [
        {
          tanggal: new Date().toLocaleString('id-ID'),
          status: draft.status || 'SPPTG terdata',
          petugas: draft.verifikator || 'Sistem',
          alasan: draft.alasanStatus,
        },
      ],
    };

    setSubmissions((prev) => [newSubmission, ...prev]);
    router.push('/');
    toast.success('Pengajuan SKT berhasil diselesaikan');
  };

  const contextValue: AppStateContextValue = {
    submissions: filteredSubmissions, // note: filtered here
    setSubmissions,
    users,
    setUsers,
    villages,
    setVillages,
    prohibitedAreas,
    setProhibitedAreas,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    kpiData,
    monthlyData,
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