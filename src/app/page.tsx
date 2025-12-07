'use client';

import { Dashboard } from '@/components/Dashboard';
import { useAppState } from './layout';
import { trpc } from '@/trpc/client';
import { useState } from 'react';
import { KPIData, Submission } from '@/types';

export default function DashboardPage() {
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
  const submissions = (submissionsData?.items || []).map((s: any) => ({
    id: s.id.toString(),
    namaPemilik: s.namaPemilik,
    nik: s.nik,
    alamat: s.alamat,
    nomorHP: s.nomorHP,
    email: s.email,
    villageId: s.villageId,
    desa: '', // Will need to join with villages table
    kecamatan: s.kecamatan,
    kabupaten: s.kabupaten,
    luas: s.luas,
    penggunaanLahan: s.penggunaanLahan,
    catatan: s.catatan,
    coordinates: s.geoJSON?.coordinates?.[0]?.map(([lng, lat]: [number, number]) => [lat, lng]) || [],
    status: s.status,
    tanggalPengajuan: new Date(s.tanggalPengajuan).toLocaleDateString('id-ID'),
    verifikator: s.verifikator,
    riwayat: s.riwayat || [],
    feedback: s.feedback,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
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
  const monthlyData = (monthlyStatsData || []).map((stat: any) => ({
    bulan: stat.month,
    pengajuan: stat.count,
  }));

  const handleViewDetail = (submission: Submission) => {
    window.location.href = `/pengajuan/${submission.id}`;
  };

  const handleEditSubmission = (submission: Submission) => {
    window.location.href = `/pengajuan/${submission.id}`;
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