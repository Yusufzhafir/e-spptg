'use client';

import { ReactNode, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { usePathname, useRouter } from 'next/navigation';

export default function AppLayout({ children }: { children: ReactNode }) {
  const [searchQuery, setSearchQuery] = useState('');

  const pathname = usePathname();
  const router = useRouter();

  // infer "currentPage" from the route (under /app)
  const currentPage =
    pathname === '/app/pengaturan'
      ? 'pengaturan'
      : pathname.startsWith('/app/pengajuan')
        ? 'pengajuan'
        : 'beranda';

  const handlePageChange = (page: string) => {
    if (page === 'pengaturan') router.push('/app/pengaturan');
    else if (page === 'pengajuan') router.push('/app/pengajuan');
    else router.push('/app');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar
        currentPage={currentPage}
        onPageChange={handlePageChange}
      />
      <div className="flex-1 flex flex-col">
        <Header
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
