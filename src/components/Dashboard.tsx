import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Check, Database, X, RefreshCw, FileText } from 'lucide-react';
import { KPICard } from './KPICard';
import { MapView } from './MapView';
import { SubmissionsTable } from './SubmissionsTable';
import { FilterPanel } from './FilterPanel';
import { Submission, KPIData } from '../types';
import type { ServerPagination } from './table-pagination';
import type { SubmissionSortKey } from '@/lib/validation';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';

interface DashboardProps {
  submissions: Submission[];
  kpiData: KPIData;
  /* eslint-disable @typescript-eslint/no-empty-object-type */
  monthlyData: {}[];
  appliedSearch: string;
  onSearchSubmit: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  dateFrom: string;
  onDateFromChange: (value: string) => void;
  dateTo: string;
  onDateToChange: (value: string) => void;
  desaFilter: string;
  onDesaFilterChange: (value: string) => void;
  desaOptions: Array<{ id: number; namaDesa: string }>;
  isRefreshing: boolean;
  onViewDetail: (submission: Submission) => void;
  onEdit: (submission: Submission) => void;
  onToggleValidity: (submission: Submission) => void;
  isTogglingValidity: boolean;
  onExportCsv: () => void;
  /** Row to focus/highlight — a clicked map polygon, or the ?focus= URL param. */
  focusSubmissionId?: number | null;
  /** Changes on every focus request, so repeating the same row still triggers. */
  focusNonce?: number;
  /** Ask the page to focus a row; it re-queries to learn which page holds it. */
  onFocusRow: (submissionId: number) => void;
  /** The row being jumped to right now, or null once it has landed. */
  pendingFocusId?: number | null;
  /** Called by the table once the row is on screen. */
  onFocusSettled?: () => void;
  /**
   * Polygons for the map. Separate from `submissions`, which is now only the
   * page of rows on screen — a map that lost its polygons when you turned a
   * table page would be worse than no map.
   */
  mapSubmissions: Submission[];
  /** Server-side paging state, shared with `TablePager`. */
  pagination: ServerPagination;
  sortKey: SubmissionSortKey;
  sortDir: 'asc' | 'desc';
  onSortChange: (key: SubmissionSortKey) => void;
  /**
   * 0-based position of the focused row in the full result set, resolved by the
   * server — the browser cannot find a row that is not on the current page.
   */
  focusPosition?: number | null;
}

export function Dashboard({
  submissions,
  kpiData,
  monthlyData,
  appliedSearch,
  onSearchSubmit,
  statusFilter,
  onStatusFilterChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  desaFilter,
  onDesaFilterChange,
  desaOptions,
  isRefreshing,
  onViewDetail,
  onEdit,
  onToggleValidity,
  isTogglingValidity,
  onExportCsv,
  focusSubmissionId,
  focusNonce,
  onFocusRow,
  pendingFocusId,
  onFocusSettled,
  mapSubmissions,
  pagination,
  sortKey,
  sortDir,
  onSortChange,
  focusPosition,
}: DashboardProps) {
  // The map draws every polygon in scope, not just the page on screen. Invalid
  // rows are already excluded by `listForMap`; this keeps the guarantee local.
  const validSubmissions = mapSubmissions.filter((s) => s.isValid);

  /**
   * "Fokus di peta" from a table row. Bumped per click because focusing is an
   * action, not a state — clicking the same row again after panning away has to
   * bring the map back.
   */
  const [focusTarget, setFocusTarget] = useState<unknown>(null);
  const [focusSignal, setFocusSignal] = useState(0);
  const mapCardRef = useRef<HTMLDivElement | null>(null);

  const focusOnMap = useCallback(
    (submission: Submission) => {
      // The map's own polygon set is the authority; the table row is a fallback
      // for a berkas the map query has not caught up with.
      const geometry =
        validSubmissions.find((row) => row.id === submission.id)?.geoJSON ??
        submission.geoJSON;
      if (!geometry) {
        toast.error('Pengajuan ini tidak memiliki batas lahan untuk ditampilkan di peta.');
        return;
      }
      setFocusTarget(geometry);
      setFocusSignal((signal) => signal + 1);
      // The table sits below the map, so framing a polygon the reader cannot
      // see would look like nothing happened.
      mapCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    [validSubmissions]
  );
  // Which row to jump to is owned by the page, not by this component: the page
  // is what asks the server where that row sits, and the server is the only one
  // that knows — the table holds a single page now. Keeping the request in
  // local state here meant a clicked polygon never reached the query, so
  // "Lihat di tabel" quietly did nothing.

  // SPPTG count per status for the bar chart
  const statusBarData = [
    { name: 'Terdaftar', count: kpiData['SPPTG terdaftar'], fill: '#22c55e' },
    { name: 'Terdata', count: kpiData['SPPTG terdata'], fill: '#3b82f6' },
    { name: 'Ditolak', count: kpiData['SPPTG ditolak'], fill: '#ef4444' },
    { name: 'Ditinjau', count: kpiData['SPPTG ditinjau ulang'], fill: '#eab308' },
  ];

  // The trend chart must stay readable as months accumulate: past ~8 points the
  // labels collide and the line gets squeezed, so give every point a minimum
  // width (scrolling horizontally instead of compressing) and tilt the labels.
  // The chart area gets an explicit pixel height — a percentage height inside a
  // scroll container loses the space taken by the horizontal scrollbar, which
  // clipped the bottom of the line once enough points appeared.
  const trendPointCount = monthlyData.length;
  const isTrendCrowded = trendPointCount > 8;
  const trendMinWidth = Math.max(trendPointCount * 64, 280);
  // Tilted labels need more vertical room than horizontal ones.
  const trendHeight = isTrendCrowded ? 300 : 240;
  const trendAxisHeight = isTrendCrowded ? 68 : 30;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard
          title="SPPTG terdaftar"
          value={kpiData['SPPTG terdaftar']}
          icon={Check}
          colorClass="text-green-700"
          bgColorClass="bg-green-100"
        />
        <KPICard
          title="SPPTG terdata"
          value={kpiData['SPPTG terdata']}
          icon={Database}
          colorClass="text-blue-700"
          bgColorClass="bg-blue-100"
        />
        <KPICard
          title="SPPTG ditolak"
          value={kpiData['SPPTG ditolak']}
          icon={X}
          colorClass="text-red-700"
          bgColorClass="bg-red-100"
        />
        <KPICard
          title="SPPTG ditinjau ulang"
          value={kpiData['SPPTG ditinjau ulang']}
          icon={RefreshCw}
          colorClass="text-yellow-700"
          bgColorClass="bg-yellow-100"
        />
        <KPICard
          title="Total pengajuan"
          value={kpiData.total}
          icon={FileText}
          colorClass="text-gray-700"
          bgColorClass="bg-gray-100"
        />
      </div>

      {/* Map and Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2" ref={mapCardRef}>
          <CardHeader>
            <CardTitle>Peta Sebaran Lahan</CardTitle>
          </CardHeader>
          <CardContent>
            <MapView
              submissions={validSubmissions}
              height="600px"
              onViewInTable={(s) => onFocusRow(s.id)}
              pendingFocusId={pendingFocusId}
              focusGeoJSON={focusTarget}
              focusSignal={focusSignal}
            />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          {/* Top: submission trend (line) */}
          <Card className="flex flex-1 flex-col">
            <CardHeader>
              <CardTitle>Tren Pengajuan</CardTitle>
            </CardHeader>
            <CardContent className="flex-1">
              {/* Scrolls sideways once the points no longer fit, so the line is
                  never squashed and no label is clipped. */}
              <div className="w-full overflow-x-auto pb-1">
                <div style={{ minWidth: `${trendMinWidth}px`, height: `${trendHeight}px` }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={monthlyData}
                      margin={{ top: 8, right: 16, left: 0, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="bulan"
                        tick={{ fontSize: 12 }}
                        interval={0}
                        angle={isTrendCrowded ? -45 : 0}
                        textAnchor={isTrendCrowded ? 'end' : 'middle'}
                        height={trendAxisHeight}
                      />
                      <YAxis allowDecimals={false} width={36} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="pengajuan"
                        name="Jumlah"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={{ fill: '#3b82f6' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bottom: SPPTG count per status (bar) */}
          <Card className="flex flex-1 flex-col">
            <CardHeader>
              <CardTitle>Jumlah SPPTG per Status</CardTitle>
            </CardHeader>
            <CardContent className="min-h-60 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusBarData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="Jumlah" radius={[4, 4, 0, 0]}>
                    {statusBarData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Filter Panel */}
      <FilterPanel
        key={`search-${appliedSearch}`}
        appliedSearch={appliedSearch}
        onSearchSubmit={onSearchSubmit}
        statusFilter={statusFilter}
        onStatusFilterChange={onStatusFilterChange}
        dateFrom={dateFrom}
        onDateFromChange={onDateFromChange}
        dateTo={dateTo}
        onDateToChange={onDateToChange}
        desaFilter={desaFilter}
        onDesaFilterChange={onDesaFilterChange}
        desaOptions={desaOptions}
        isRefreshing={isRefreshing}
        onExportCsv={onExportCsv}
      />

      {/* Submissions Table */}
      <div>
        <h2 className="text-xl mb-4">Daftar Pengajuan</h2>
        <SubmissionsTable
          submissions={submissions}
          onViewDetail={onViewDetail}
          onEdit={onEdit}
          onToggleValidity={onToggleValidity}
          onFocusOnMap={focusOnMap}
          isTogglingValidity={isTogglingValidity}
          focusSubmissionId={focusSubmissionId}
          focusNonce={focusNonce}
          onFocusSettled={onFocusSettled}
          focusPosition={focusPosition}
          pagination={pagination}
          sortKey={sortKey}
          sortDir={sortDir}
          onSortChange={onSortChange}
        />
      </div>
    </div>
  );
}
