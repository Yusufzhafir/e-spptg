'use client';

import { RequireRole } from '@/components/RequireRole';
import { KawasanOverlapReport } from '@/components/KawasanOverlapReport';

/**
 * The map here reads `submissions.listMapPolygons`, which is a
 * `verifikatorProcedure` — so the page is gated to the same three roles rather
 * than letting a Kecamatan viewer land on a report whose map would 403.
 */
export default function KawasanTumpangTindihPage() {
  return (
    <RequireRole
      allowedRoles={['Superadmin', 'Admin', 'Verifikator']}
      showError={true}
      redirectTo="/app"
    >
      <KawasanOverlapReport />
    </RequireRole>
  );
}
