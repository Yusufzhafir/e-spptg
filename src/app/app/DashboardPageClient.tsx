'use client';

import { Dashboard } from '@/components/Dashboard';
import { buildDashboardSearchParams, type DashboardFilterPatch, parseDashboardFilters } from '@/lib/dashboard-filters';
import { trpc } from '@/trpc/client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { DEFAULT_PAGE_SIZE } from '@/components/table-pagination';
import type { SubmissionSortKey } from '@/lib/validation';
import { KPIData, Submission } from '@/types';
import { toast } from 'sonner';

type SubmissionListItem = {
  id: number;
  namaPemilik: string;
  nik: string;
  alamat: string;
  nomorHP: string;
  email: string;
  villageId: number;
  desaNama?: string | null;
  desaKecamatan?: string | null;
  kecamatan: string;
  kabupaten: string;
  luas: number;
  penggunaanLahan: string;
  catatan: string | null;
  geoJSON?: Submission['geoJSON'];
  status: Submission['status'];
  isValid: boolean;
  tanggalPengajuan: string | Date;
  ownerUserId: number | null;
  verifikator: number | null;
  verifikatorName?: string | null;
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
  const utils = trpc.useUtils();

  const filters = useMemo(() => parseDashboardFilters(searchParams), [searchParams]);
  const focusParam = searchParams.get('focus');
  const urlFocusId = focusParam ? Number(focusParam) : null;

  // "SPPTG berhasil diterbitkan" belongs here, not on the wizard the user is
  // leaving: it should land with them, once the dashboard is on screen. The
  // flag is then stripped so a refresh or a shared link cannot replay it.
  const announcedIssuedSPPTG = useRef(false);
  const hasIssuedSPPTG = searchParams.get('terbit') === '1';

  useEffect(() => {
    if (!hasIssuedSPPTG || announcedIssuedSPPTG.current) return;
    announcedIssuedSPPTG.current = true;
    toast.success('SPPTG berhasil diterbitkan.');
    router.replace(pathname, { scroll: false });
  }, [hasIssuedSPPTG, pathname, router]);

  const updateFilterParams = useCallback(
    (patch: DashboardFilterPatch) => {
      const nextParams = buildDashboardSearchParams(searchParams, patch);
      const queryString = nextParams.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
      // Back to page 1: with paging done in Postgres, keeping the old offset
      // against a narrower result set asks for rows that no longer exist and
      // leaves an empty table with no obvious way back.
      setPage(0);
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

  // Server-side paging, sorting and searching: the table only ever holds the
  // rows on screen, so all three have to be decided in Postgres — sorting ten
  // rows out of four thousand would order the wrong ten.
  const [page, setPage] = useState(0);
  const [pageSize, setPageSizeState] = useState<number>(DEFAULT_PAGE_SIZE);
  const [sortKey, setSortKey] = useState<SubmissionSortKey>('updatedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  /**
   * The row someone asked to see — a clicked map polygon, or `?focus=` from a
   * notification. It lives here rather than in the table because finding it is
   * a server question now: the table holds one page and cannot see the rest.
   */
  const [focusRequest, setFocusRequest] = useState<{ id: number; nonce: number } | null>(
    urlFocusId ? { id: urlFocusId, nonce: 0 } : null
  );
  useEffect(() => {
    if (urlFocusId == null) return;
     
    setFocusRequest({ id: urlFocusId, nonce: 0 });
  }, [urlFocusId]);

  /**
   * Every click gets a fresh nonce. Storing the id alone means clicking the
   * same polygon a second time — after paging away, or after landing on
   * `?focus=123` and then clicking 123 on the map — writes the value the state
   * already held: no re-render, no effect, and the button looks dead.
   */
  const requestFocusRow = useCallback((id: number) => {
    setFocusRequest({ id, nonce: Date.now() });
    setPendingFocusId(id);
  }, []);

  /**
   * Set while a jump is in flight so the map popup can spin instead of closing
   * on a click that has visibly done nothing yet. Cleared by the table the
   * moment the row is on screen.
   */
  const [pendingFocusId, setPendingFocusId] = useState<number | null>(null);
  const handleFocusSettled = useCallback(() => setPendingFocusId(null), []);

  const focusRequestId = focusRequest?.id ?? null;

  const submissionsListInput = useMemo(
    () => ({
      status: filters.status === 'all' ? undefined : filters.status,
      search: filters.search || undefined,
      desaId: filters.desaId ? Number(filters.desaId) : undefined,
      kecamatan: !filters.desaId && filters.kecamatan ? filters.kecamatan : undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      sortKey,
      sortDir,
      // Asked for only while a row is being jumped to; the server answers with
      // its position so we know which page to open.
      focusId: focusRequestId ?? undefined,
      limit: pageSize,
      offset: page * pageSize,
    }),
    [
      filters.dateFrom,
      filters.dateTo,
      filters.desaId,
      filters.kecamatan,
      filters.search,
      filters.status,
      sortKey,
      sortDir,
      focusRequestId,
      page,
      pageSize,
    ]
  );

  // Fetch submissions from backend
  const {
    data: submissionsData,
    isLoading: isLoadingSubmissions,
    isFetching: isFetchingSubmissions,
    error: submissionsError,
    refetch: refetchSubmissions,
  } = trpc.submissions.list.useQuery(submissionsListInput, {
    placeholderData: (previous) => previous,
  });

  // A row that the active filter excludes has no position, so the table will
  // never report it as settled. Stop waiting and say why, rather than leaving
  // the popup spinning forever.
  useEffect(() => {
    if (pendingFocusId == null || isFetchingSubmissions) return;
    if (submissionsData?.focusPosition != null) return;
     
    setPendingFocusId(null);
    toast.info('Pengajuan itu tidak termasuk dalam filter yang sedang aktif.');
  }, [pendingFocusId, isFetchingSubmissions, submissionsData?.focusPosition]);

  /** Any change to what is being listed sends the reader back to page 1. */
  const goToFirstPage = useCallback(() => setPage(0), []);

  const handleSortChange = useCallback(
    (key: SubmissionSortKey) => {
      setSortDir((current) => (key === sortKey && current === 'asc' ? 'desc' : 'asc'));
      setSortKey(key);
      goToFirstPage();
    },
    [sortKey, goToFirstPage]
  );

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setPage(0);
  }, []);

  const updateValidityMutation = trpc.submissions.updateValidity.useMutation({
    onSuccess: (_data, variables) => {
      toast.success(
        variables.isValid
          ? 'Pengajuan ditandai valid dan ditampilkan di peta'
          : 'Pengajuan ditandai invalid dan disembunyikan dari peta'
      );
      void refetchSubmissions();
      // The charts count only valid submissions, so they must recompute when a
      // submission's validity flips.
      void utils.submissions.kpi.invalidate();
      void utils.submissions.monthlyStats.invalidate();
    },
    onError: (error) => {
      toast.error(`Gagal memperbarui status validasi: ${error.message}`);
    },
  });

  const handleToggleValidity = useCallback(
    (submission: Submission) => {
      updateValidityMutation.mutate({
        submissionId: submission.id,
        isValid: !submission.isValid,
      });
    },
    [updateValidityMutation]
  );

  // KPI cards + charts use the same filters as the table, minus paging, so the
  // "Tren Pengajuan" and "Jumlah SPPTG per Status" charts follow the filter bar.
  const chartFilterInput = useMemo(
    () => ({
      status: filters.status === 'all' ? undefined : filters.status,
      search: filters.search || undefined,
      desaId: filters.desaId ? Number(filters.desaId) : undefined,
      kecamatan: !filters.desaId && filters.kecamatan ? filters.kecamatan : undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
    }),
    [filters.dateFrom, filters.dateTo, filters.desaId, filters.kecamatan, filters.search, filters.status]
  );

  // The map has its own feed: it draws every polygon in scope, while the table
  // holds one page. Same filters as the charts, so map, table and charts always
  // describe the same set.
  const { data: mapSubmissionsData } = trpc.submissions.listForMap.useQuery(
    chartFilterInput,
    { placeholderData: (previous) => previous }
  );

  // Fetch KPI data
  const { data: kpiData, isLoading: isLoadingKPI, error: kpiError } = trpc.submissions.kpi.useQuery(
    chartFilterInput,
    { placeholderData: (previous) => previous }
  );

  // Fetch monthly stats
  const { data: monthlyStatsData, isLoading: isLoadingMonthly, error: monthlyError } = trpc.submissions.monthlyStats.useQuery(
    chartFilterInput,
    { placeholderData: (previous) => previous }
  );

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
    desaNama: s.desaNama ?? null,
    desaKecamatan: s.desaKecamatan ?? null,
    kecamatan: s.kecamatan,
    kabupaten: s.kabupaten,
    luas: s.luas,
    penggunaanLahan: s.penggunaanLahan,
    catatan: s.catatan,
    geoJSON: s.geoJSON, // Use geoJSON instead of coordinates
    status: s.status,
    isValid: s.isValid ?? true,
    tanggalPengajuan: new Date(s.tanggalPengajuan), // Keep as Date, not string
    ownerUserId: s.ownerUserId,
    verifikator: s.verifikator,
    verifikatorName: s.verifikatorName ?? null,
    riwayat: s.riwayat || [],
    feedback: s.feedback,
    createdAt: new Date(s.createdAt),
    updatedAt: new Date(s.updatedAt),
  }));

  /**
   * Map polygons, padded out to the `Submission` shape the map component
   * expects. The blanks are fields the map never reads — identity details stay
   * on the server rather than being shipped for every polygon.
   */
  const mapSubmissions = useMemo(
    () =>
      (mapSubmissionsData ?? []).map((s) => ({
        id: s.id,
        namaPemilik: s.namaPemilik,
        nik: '',
        alamat: '',
        nomorHP: '',
        email: '',
        villageId: s.villageId,
        desaNama: s.desaNama ?? null,
        desaKecamatan: s.desaKecamatan ?? null,
        kecamatan: s.desaKecamatan ?? '',
        kabupaten: '',
        luas: s.luas,
        penggunaanLahan: '',
        catatan: null,
        geoJSON: s.geoJSON,
        status: s.status,
        isValid: s.isValid ?? true,
        tanggalPengajuan: new Date(),
        ownerUserId: null,
        verifikator: null,
        verifikatorName: null,
        riwayat: [],
        feedback: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })) as unknown as Submission[],
    [mapSubmissionsData]
  );

  // Use KPI data directly (no transformation needed)
  const transformedKpiData: KPIData = {
    'SPPTG terdata': kpiData?.['SPPTG terdata'] || 0,
    'SPPTG terdaftar': kpiData?.['SPPTG terdaftar'] || 0,
    'SPPTG ditolak': kpiData?.['SPPTG ditolak'] || 0,
    'SPPTG ditinjau ulang': kpiData?.['SPPTG ditinjau ulang'] || 0,
    'Terbit SPPTG': kpiData?.['Terbit SPPTG'] || 0,
    total: kpiData?.total || 0,
  };

  // Transform monthly data
  const monthlyItems = (monthlyStatsData || []) as MonthlyStatItem[];
  const monthlyData = monthlyItems.map((stat) => ({
    bulan: stat.month,
    // Coerce defensively: a string here silently breaks the chart's Y scale.
    pengajuan: Number(stat.count) || 0,
  }));

  const villageItems = (villagesData || []) as VillageListItem[];
  const desaOptions = villageItems
    .map((village) => ({ id: village.id, namaDesa: village.namaDesa }))
    .sort((a, b) => a.namaDesa.localeCompare(b.namaDesa));

  const handleExportCsv = useCallback(async () => {
    if ((submissionsData?.total ?? 0) === 0) {
      toast.info('Tidak ada data untuk diekspor.');
      return;
    }

    /**
     * The export covers the whole filtered result, not the page on screen.
     * Since the table went server-paged, `submissions` is only the rows in
     * view — exporting that would silently hand someone ten rows and call it
     * the report. Pulled in batches so one huge query never has to succeed.
     */
    const BATCH = 200;
    const exported: SubmissionListItem[] = [];
    const toastId = toast.loading('Menyiapkan ekspor…');
    try {
      for (let offset = 0; ; offset += BATCH) {
        const batch = await utils.submissions.list.fetch({
          ...submissionsListInput,
          focusId: undefined,
          limit: BATCH,
          offset,
        });
        exported.push(...((batch.items ?? []) as SubmissionListItem[]));
        if (exported.length >= (batch.total ?? 0) || (batch.items ?? []).length === 0) {
          break;
        }
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Gagal menyiapkan data ekspor.',
        { id: toastId }
      );
      return;
    }
    toast.dismiss(toastId);
    const headers = [
      'ID',
      'Nama Pemilik',
      'NIK',
      'Desa',
      'Kecamatan',
      'Kabupaten',
      'Luas (m2)',
      'Penggunaan Lahan',
      'Status',
      'Validasi',
      'Verifikator',
      'Tanggal Pengajuan',
    ];
    const escape = (value: unknown) => {
      const s = value == null ? '' : String(value);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = exported.map((s) =>
      [
        s.id,
        s.namaPemilik,
        s.nik,
        s.desaNama || `Desa #${s.villageId}`,
        s.kecamatan,
        s.kabupaten,
        s.luas,
        s.penggunaanLahan,
        s.status,
        s.isValid ? 'Valid' : 'Invalid',
        s.verifikatorName || '-',
        new Date(s.tanggalPengajuan).toLocaleDateString('id-ID'),
      ]
        .map(escape)
        .join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    // Prepend BOM so Excel reads UTF-8 correctly
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pengajuan-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`${exported.length} pengajuan diekspor ke CSV.`);
  }, [submissionsData?.total, submissionsListInput, utils]);

  const handleViewDetail = (submission: Submission) => {
    router.push(`/app/pengajuan/${submission.id}`);
  };

  const handleEditSubmission = (
    submission: Submission,
    mode: 'existing' | 'duplicate'
  ) => {
    const suffix = mode === 'duplicate' ? '?mode=duplicate' : '';
    router.push(`/app/pengajuan/${submission.id}/edit${suffix}`);
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
      onToggleValidity={handleToggleValidity}
      isTogglingValidity={updateValidityMutation.isPending}
      onExportCsv={handleExportCsv}
      focusSubmissionId={focusRequestId}
      focusNonce={focusRequest?.nonce ?? 0}
      onFocusRow={requestFocusRow}
      pendingFocusId={pendingFocusId}
      onFocusSettled={handleFocusSettled}
      mapSubmissions={mapSubmissions}
      pagination={{
        // Clamped so a shrinking result set can never strand the reader on a
        // page that no longer exists.
        page: Math.min(page, Math.max(0, Math.ceil((submissionsData?.total ?? 0) / pageSize) - 1)),
        setPage,
        pageSize,
        setPageSize,
        total: submissionsData?.total ?? 0,
        lastPage: Math.max(
          0,
          Math.ceil((submissionsData?.total ?? 0) / pageSize) - 1
        ),
      }}
      sortKey={sortKey}
      sortDir={sortDir}
      onSortChange={handleSortChange}
      focusPosition={submissionsData?.focusPosition ?? null}
    />
  );
}
