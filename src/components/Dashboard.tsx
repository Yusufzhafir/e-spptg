import { Check, Database, X, RefreshCw, FileText } from 'lucide-react';
import { KPICard } from './KPICard';
import { MapView } from './MapView';
import { SubmissionsTable } from './SubmissionsTable';
import { FilterPanel } from './FilterPanel';
import { Submission, KPIData } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DashboardProps {
  submissions: Submission[];
  kpiData: KPIData;
  /* eslint-disable @typescript-eslint/no-empty-object-type */
  monthlyData: {}[];
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  onNewSubmission: () => void;
  onViewDetail: (submission: Submission) => void;
  onEdit: (submission: Submission) => void;
}

export function Dashboard({
  submissions,
  kpiData,
  monthlyData,
  statusFilter,
  onStatusFilterChange,
  onNewSubmission,
  onViewDetail,
  onEdit,
}: DashboardProps) {
  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard
          title="SPPTG terdaftar"
          value={kpiData.terdaftar}
          icon={Check}
          colorClass="text-green-700"
          bgColorClass="bg-green-100"
        />
        <KPICard
          title="SPPTG terdata"
          value={kpiData.terdata}
          icon={Database}
          colorClass="text-blue-700"
          bgColorClass="bg-blue-100"
        />
        <KPICard
          title="SPPTG ditolak"
          value={kpiData.ditolak}
          icon={X}
          colorClass="text-red-700"
          bgColorClass="bg-red-100"
        />
        <KPICard
          title="SPPTG ditinjau ulang"
          value={kpiData.ditinjauUlang}
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
            <MapView submissions={submissions} height="400px" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tren Pengajuan</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="bulan" tick={{ fontSize: 12 }} />
                <YAxis />
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
      </div>

      {/* Filter Panel */}
      <FilterPanel
        statusFilter={statusFilter}
        onStatusFilterChange={onStatusFilterChange}
        onNewSubmission={onNewSubmission}
      />

      {/* Submissions Table */}
      <div>
        <h2 className="text-xl mb-4">Daftar Pengajuan</h2>
        <SubmissionsTable
          submissions={submissions}
          onViewDetail={onViewDetail}
          onEdit={onEdit}
        />
      </div>
    </div>
  );
}
