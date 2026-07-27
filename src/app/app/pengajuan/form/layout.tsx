import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { RequireRole } from '@/components/RequireRole';

export const metadata: Metadata = { title: 'Pengajuan Baru' };

export default function Layout({ children }: { children: ReactNode }) {
  // 'Kecamatan' is read-only oversight on the dashboard and takes no part in
  // the pengajuan workflow.
  return (
    <RequireRole
      allowedRoles={['Superadmin', 'Admin', 'Verifikator', 'Viewer']}
      showError={true}
      redirectTo="/app"
    >
      {children}
    </RequireRole>
  );
}
