'use client';

import { Dashboard } from '@/components/Dashboard';
import { useAppState } from './layout';
import { trpc } from '@/trpc/client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KPIData, Submission } from '@/types';

type SubmissionListItem = {
  id: number;
  namaPemilik: string;
  nik: string;
  alamat: string;
  nomorHP: string;
  email: string;
  villageId: number;
  kecamatan: string;
  kabupaten: string;
  luas: number;
  penggunaanLahan: string;
  catatan: string | null;
  geoJSON?: Submission['geoJSON'];
  status: Submission['status'];
  tanggalPengajuan: string | Date;
  verifikator: number | null;
  riwayat?: Submission['riwayat'];
  feedback: Submission['feedback'];
  createdAt: string | Date;
  updatedAt: string | Date;
};

type MonthlyStatItem = {
  month: string;
  count: number;
};

export default function DashboardPage() {
  const router = useRouter();
  const { handleNewSubmission } = useAppState();
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch submissions from backend
  const { data: submissionsData, isLoading: isLoadingSubmissions } = trpc.submissions.list.useQuery({
    status: statusFilter === 'all' ? undefined : statusFilter,
    search: searchQuery || undefined,
    limit: 100,
    offset: 0,
  });

  // Fetch KPI data
  const { data: kpiData, isLoading: isLoadingKPI } = trpc.submissions.kpi.useQuery();

  // Fetch monthly stats
  const { data: monthlyStatsData, isLoading: isLoadingMonthly } = trpc.submissions.monthlyStats.useQuery();

  // Transform submissions data
  const submissionItems = (submissionsData?.items || []) as SubmissionListItem[];
  const submissions = submissionItems.map((s) => ({
    id: s.id, // Keep as number, not string
    namaPemilik: s.namaPemilik,
    nik: s.nik,
    alamat: s.alamat,
    nomorHP: s.nomorHP,
    email: s.email,
    villageId: s.villageId,
    kecamatan: s.kecamatan,
    kabupaten: s.kabupaten,
    luas: s.luas,
    penggunaanLahan: s.penggunaanLahan,
    catatan: s.catatan,
    geoJSON: s.geoJSON, // Use geoJSON instead of coordinates
    status: s.status,
    tanggalPengajuan: new Date(s.tanggalPengajuan), // Keep as Date, not string
    verifikator: s.verifikator,
    riwayat: s.riwayat || [],
    feedback: s.feedback,
    createdAt: new Date(s.createdAt),
    updatedAt: new Date(s.updatedAt),
  }));

  // Use KPI data directly (no transformation needed)
  const transformedKpiData: KPIData = {
    'SPPTG terdata': kpiData?.['SPPTG terdata'] || 0,
    'SPPTG terdaftar': kpiData?.['SPPTG terdaftar'] || 0,
    'SPPTG ditolak': kpiData?.['SPPTG ditolak'] || 0,
    'SPPTG ditinjau ulang': kpiData?.['SPPTG ditinjau ulang'] || 0,
    total: kpiData?.total || 0,
  };

  // Transform monthly data
  const monthlyItems = (monthlyStatsData || []) as MonthlyStatItem[];
  const monthlyData = monthlyItems.map((stat) => ({
    bulan: stat.month,
    pengajuan: stat.count,
  }));

  const handleViewDetail = (submission: Submission) => {
    router.push(`/app/pengajuan/${submission.id}`);
  };

  const handleEditSubmission = (submission: Submission) => {
    router.push(`/app/pengajuan/${submission.id}`);
  };

  if (isLoadingSubmissions || isLoadingKPI || isLoadingMonthly) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Memuat data...</span>
      </div>
    );
  }

  return (
    <Dashboard
      submissions={submissions}
      kpiData={transformedKpiData}
      monthlyData={monthlyData}
      statusFilter={statusFilter}
      onStatusFilterChange={setStatusFilter}
      onNewSubmission={handleNewSubmission}
      onViewDetail={handleViewDetail}
      onEdit={handleEditSubmission}
    />
  );
}
