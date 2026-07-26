import { Suspense } from 'react';
import type { Metadata } from 'next';
import DashboardPageClient from './DashboardPageClient';

export const metadata: Metadata = { title: 'Beranda' };

function AppDashboardFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <span className="ml-3 text-gray-600">Memuat data...</span>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<AppDashboardFallback />}>
      <DashboardPageClient />
    </Suspense>
  );
}
