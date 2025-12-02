'use client';

import { Dashboard } from '@/components/Dashboard';
import { useAppState } from './layout';

export default function DashboardPage() {
  const {
    submissions,
    kpiData,
    monthlyData,
    statusFilter,
    setStatusFilter,
    handleNewSubmission,
  } = useAppState();

  const handleViewDetail = (submission: {id:string}) => {
    // Navigate to detail page using id
    window.location.href = `/pengajuan/${submission.id!}`;
  };

  const handleEditSubmission = (submission: {id:string}) => {
    // For now, reuse detail page
    window.location.href = `/pengajuan/${submission.id}`;
  };

  return (
    <Dashboard
      submissions={submissions}
      kpiData={kpiData}
      monthlyData={monthlyData}
      statusFilter={statusFilter}
      onStatusFilterChange={setStatusFilter}
      onNewSubmission={handleNewSubmission}
      onViewDetail={handleViewDetail}
      onEdit={handleEditSubmission}
    />
  );
}