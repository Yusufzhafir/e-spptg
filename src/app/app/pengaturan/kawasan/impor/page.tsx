'use client';

import { RequireRole } from '@/components/RequireRole';
import { KawasanBulkImport } from '@/components/KawasanBulkImport';

/**
 * Bulk import writes kawasan rows, so it is gated exactly like Tambah Kawasan:
 * `prohibitedAreas.createBulk` is an `adminProcedure` and a Verifikator would
 * only get as far as pressing Impor before a 403.
 */
export default function ImporKawasanPage() {
  return (
    <RequireRole
      allowedRoles={['Superadmin', 'Admin']}
      showError={true}
      redirectTo="/app"
    >
      <KawasanBulkImport />
    </RequireRole>
  );
}
