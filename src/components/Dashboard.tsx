import { useEffect, useState } from 'react';
import { Check, Database, X, RefreshCw, FileText } from 'lucide-react';
import { KPICard } from './KPICard';
import { MapView } from './MapView';
import { SubmissionsTable, type EditMode } from './SubmissionsTable';
import { FilterPanel } from './FilterPanel';
import { Submission, KPIData } from '../types';
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
  onEdit: (submission: Submission, mode: EditMode) => void;
  onToggleValidity: (submission: Submission) => void;
  isTogglingValidity: boolean;
  onExportCsv: () => void;
  /** Row to focus/highlight, driven by the ?focus= URL param (e.g. notifications) */
  urlFocusId?: number | null;
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
  urlFocusId,
}: DashboardProps) {
  // Only submissions marked valid are drawn on the map (data & polygon).
  const validSubmissions = submissions.filter((s) => s.isValid);
  // Row to focus/scroll to in the table (from a map polygon click or the
  // ?focus= URL param set by notifications).
  const [focusSubmissionId, setFocusSubmissionId] = useState<number | null>(urlFocusId ?? null);
  useEffect(() => {
    if (urlFocusId != null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync focus from URL/notification
      setFocusSubmissionId(urlFocusId);
    }
  }, [urlFocusId]);

  // SPPTG count per status for the bar chart
  const statusBarData = [
    { name: 'Terdaftar', count: kpiData['SPPTG terdaftar'], fill: '#22c55e' },
    { name: 'Terdata', count: kpiData['SPPTG terdata'], fill: '#3b82f6' },
    { name: 'Ditolak', count: kpiData['SPPTG ditolak'], fill: '#ef4444' },
    { name: 'Ditinjau', count: kpiData['SPPTG ditinjau ulang'], fill: '#eab308' },
  ];

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
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Peta Sebaran Lahan</CardTitle>
          </CardHeader>
          <CardContent>
            <MapView
              submissions={validSubmissions}
              height="600px"
              onViewInTable={(s) => setFocusSubmissionId(s.id)}
            />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          {/* Top: submission trend (line) */}
          <Card className="flex flex-1 flex-col">
            <CardHeader>
              <CardTitle>Tren Pengajuan</CardTitle>
            </CardHeader>
            <CardContent className="min-h-60 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="bulan" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="pengajuan"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6' }}
                  />
                </LineChart>
              </ResponsiveContainer>
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
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
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
          isTogglingValidity={isTogglingValidity}
          focusSubmissionId={focusSubmissionId}
        />
      </div>
    </div>
  );
}
