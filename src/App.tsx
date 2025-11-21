import { useState, useMemo } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { SubmissionForm } from './components/SubmissionForm';
import { DetailPage } from './components/DetailPage';
import { Settings } from './components/Settings';
import { SubmissionFlow } from './components/SubmissionFlow';
import {
  mockSubmissions,
  calculateKPIData,
  monthlyData,
  mockUsers,
  mockVillages,
  mockProhibitedAreas,
} from './data/mockData';
import { Submission, StatusSKT, User, Village, ProhibitedArea, SubmissionDraft } from './types';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner@2.0.3';

type ViewType = 'dashboard' | 'form' | 'detail' | 'settings' | 'submission-flow';

export default function App() {
  const [submissions, setSubmissions] = useState<Submission[]>(mockSubmissions);
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [villages, setVillages] = useState<Village[]>(mockVillages);
  const [prohibitedAreas, setProhibitedAreas] = useState<ProhibitedArea[]>(mockProhibitedAreas);
  const [currentPage, setCurrentPage] = useState('beranda');
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Filter submissions based on search and status
  const filteredSubmissions = useMemo(() => {
    let filtered = submissions;

    // Search filter
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

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((s) => s.status === statusFilter);
    }

    return filtered;
  }, [submissions, searchQuery, statusFilter]);

  const kpiData = useMemo(() => calculateKPIData(submissions), [submissions]);

  const handleNewSubmission = () => {
    setCurrentView('form');
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
      status: 'SKT terdata',
      tanggalPengajuan: new Date().toLocaleDateString('id-ID'),
      riwayat: [
        {
          tanggal: new Date().toLocaleString('id-ID'),
          status: 'SKT terdata',
          petugas: 'Sistem',
        },
      ],
    };

    setSubmissions([newSubmission, ...submissions]);
    setCurrentView('dashboard');
  };

  const handleViewDetail = (submission: Submission) => {
    setSelectedSubmission(submission);
    setCurrentView('detail');
  };

  const handleEditSubmission = (submission: Submission) => {
    // In a real app, this would open the form in edit mode
    setSelectedSubmission(submission);
    setCurrentView('detail');
  };

  const handleStatusChange = (id: string, status: StatusSKT, alasan: string) => {
    setSubmissions((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          return {
            ...s,
            status,
            verifikator: 'Bambang Supriyanto', // Mock verifikator
            riwayat: [
              ...s.riwayat,
              {
                tanggal: new Date().toLocaleString('id-ID'),
                status,
                petugas: 'Bambang Supriyanto',
                alasan: alasan || undefined,
              },
            ],
          };
        }
        return s;
      })
    );

    // Update selected submission
    const updated = submissions.find((s) => s.id === id);
    if (updated) {
      setSelectedSubmission({
        ...updated,
        status,
        verifikator: 'Bambang Supriyanto',
        riwayat: [
          ...updated.riwayat,
          {
            tanggal: new Date().toLocaleString('id-ID'),
            status,
            petugas: 'Bambang Supriyanto',
            alasan: alasan || undefined,
          },
        ],
      });
    }
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
    setSelectedSubmission(null);
  };

  const handleCancelForm = () => {
    setCurrentView('dashboard');
  };

  const handlePageChange = (page: string) => {
    setCurrentPage(page);
    if (page === 'pengaturan') {
      setCurrentView('settings');
    } else if (page === 'pengajuan') {
      setCurrentView('submission-flow');
    } else {
      setCurrentView('dashboard');
    }
  };

  const handleCompleteSubmission = (draft: SubmissionDraft) => {
    // Convert draft to submission
    const newSubmission: Submission = {
      id: draft.id || `2025-01-${String(submissions.length + 1).padStart(4, '0')}`,
      namaPemilik: draft.namaPemohon,
      nik: draft.nik,
      alamat: '', // Not collected in new flow
      nomorHP: draft.juruUkur?.nomorHP || '',
      email: '',
      desa: '',
      kecamatan: '',
      kabupaten: 'Cirebon',
      luas: draft.luasLahan || 0,
      penggunaanLahan: '',
      coordinates: draft.coordinatesGeografis.map((c) => [c.latitude, c.longitude]),
      status: draft.status || 'SKT terdata',
      tanggalPengajuan: new Date().toLocaleDateString('id-ID'),
      verifikator: draft.verifikator,
      riwayat: [
        {
          tanggal: new Date().toLocaleString('id-ID'),
          status: draft.status || 'SKT terdata',
          petugas: draft.verifikator || 'Sistem',
          alasan: draft.alasanStatus,
        },
      ],
    };

    setSubmissions([newSubmission, ...submissions]);
    setCurrentView('dashboard');
    setCurrentPage('beranda');
    toast.success('Pengajuan SKT berhasil diselesaikan');
  };

  const handleCancelSubmissionFlow = () => {
    setCurrentView('dashboard');
    setCurrentPage('beranda');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Toaster position="top-right" />
      
      <Sidebar currentPage={currentPage} onPageChange={handlePageChange} />

      <div className="flex-1 flex flex-col">
        <Header searchQuery={searchQuery} onSearchChange={setSearchQuery} />

        <main className="flex-1 p-6">
          {currentView === 'dashboard' && (
            <Dashboard
              submissions={filteredSubmissions}
              kpiData={kpiData}
              monthlyData={monthlyData}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              onNewSubmission={handleNewSubmission}
              onViewDetail={handleViewDetail}
              onEdit={handleEditSubmission}
            />
          )}

          {currentView === 'form' && (
            <SubmissionForm onSubmit={handleSubmitForm} onCancel={handleCancelForm} />
          )}

          {currentView === 'detail' && selectedSubmission && (
            <DetailPage
              submission={selectedSubmission}
              onBack={handleBackToDashboard}
              onStatusChange={handleStatusChange}
            />
          )}

          {currentView === 'settings' && (
            <Settings
              users={users}
              villages={villages}
              prohibitedAreas={prohibitedAreas}
              onUpdateUsers={setUsers}
              onUpdateVillages={setVillages}
              onUpdateProhibitedAreas={setProhibitedAreas}
            />
          )}

          {currentView === 'submission-flow' && (
            <SubmissionFlow
              onCancel={handleCancelSubmissionFlow}
              onComplete={handleCompleteSubmission}
            />
          )}
        </main>
      </div>
    </div>
  );
}
