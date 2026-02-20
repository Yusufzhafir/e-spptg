'use client';

import { Dashboard } from '@/components/Dashboard';
import { buildDashboardSearchParams, type DashboardFilterPatch, parseDashboardFilters } from '@/lib/dashboard-filters';
import { trpc } from '@/trpc/client';
import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
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
  ownerUserId: number | null;
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

type VillageListItem = {
  id: number;
  namaDesa: string;
};

export default function DashboardPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo(() => parseDashboardFilters(searchParams), [searchParams]);

  const updateFilterParams = useCallback(
    (patch: DashboardFilterPatch) => {
      const nextParams = buildDashboardSearchParams(searchParams, patch);
      const queryString = nextParams.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const handleSearchSubmit = useCallback((value: string) => {
    const nextSearch = value.trim();
    if (nextSearch === filters.search) return;
    updateFilterParams({ search: nextSearch });
  }, [filters.search, updateFilterParams]);

  const handleStatusFilterChange = useCallback(
    (value: string) => {
      updateFilterParams({ status: value });
    },
    [updateFilterParams]
  );

  const handleDateFromChange = useCallback(
    (value: string) => {
      updateFilterParams({ dateFrom: value });
    },
    [updateFilterParams]
  );

  const handleDateToChange = useCallback(
    (value: string) => {
      updateFilterParams({ dateTo: value });
    },
    [updateFilterParams]
  );

  const handleDesaFilterChange = useCallback(
    (value: string) => {
      updateFilterParams({ desaId: value });
    },
    [updateFilterParams]
  );

  const submissionsListInput = useMemo(
    () => ({
      status: filters.status === 'all' ? undefined : filters.status,
      search: filters.search || undefined,
      desaId: filters.desaId ? Number(filters.desaId) : undefined,
      kecamatan: !filters.desaId && filters.kecamatan ? filters.kecamatan : undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      limit: 100,
      offset: 0,
    }),
    [filters.dateFrom, filters.dateTo, filters.desaId, filters.kecamatan, filters.search, filters.status]
  );

  // Fetch submissions from backend
  const {
    data: submissionsData,
    isLoading: isLoadingSubmissions,
    isFetching: isFetchingSubmissions,
    error: submissionsError,
  } = trpc.submissions.list.useQuery(submissionsListInput, {
    placeholderData: (previous) => previous,
  });

  // Fetch KPI data
  const { data: kpiData, isLoading: isLoadingKPI, error: kpiError } = trpc.submissions.kpi.useQuery();

  // Fetch monthly stats
  const { data: monthlyStatsData, isLoading: isLoadingMonthly, error: monthlyError } = trpc.submissions.monthlyStats.useQuery();

  // Fetch villages for Desa filter options
  const { data: villagesData, isLoading: isLoadingVillages, error: villagesError } = trpc.villages.list.useQuery({
    limit: 1000,
    offset: 0,
  });

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
    ownerUserId: s.ownerUserId,
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

  const villageItems = (villagesData || []) as VillageListItem[];
  const desaOptions = villageItems
    .map((village) => ({ id: village.id, namaDesa: village.namaDesa }))
    .sort((a, b) => a.namaDesa.localeCompare(b.namaDesa));

  const handleViewDetail = (submission: Submission) => {
    router.push(`/app/pengajuan/${submission.id}`);
  };

  const handleEditSubmission = (submission: Submission) => {
    router.push(`/app/pengajuan/${submission.id}`);
  };

  const isInitialLoading =
    (!submissionsData && isLoadingSubmissions) ||
    (!kpiData && isLoadingKPI) ||
    (!monthlyStatsData && isLoadingMonthly) ||
    (!villagesData && isLoadingVillages);

  if (isInitialLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Memuat data...</span>
      </div>
    );
  }

  if (submissionsError || kpiError || monthlyError || villagesError) {
    const message = submissionsError?.message || kpiError?.message || monthlyError?.message || villagesError?.message;
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
        {message || 'Gagal memuat dashboard.'}
      </div>
    );
  }

  return (
    <Dashboard
      submissions={submissions}
      kpiData={transformedKpiData}
      monthlyData={monthlyData}
      appliedSearch={filters.search}
      onSearchSubmit={handleSearchSubmit}
      statusFilter={filters.status}
      onStatusFilterChange={handleStatusFilterChange}
      dateFrom={filters.dateFrom}
      onDateFromChange={handleDateFromChange}
      dateTo={filters.dateTo}
      onDateToChange={handleDateToChange}
      desaFilter={filters.desaId}
      onDesaFilterChange={handleDesaFilterChange}
      desaOptions={desaOptions}
      isRefreshing={isFetchingSubmissions}
      onViewDetail={handleViewDetail}
      onEdit={handleEditSubmission}
    />
  );
}
