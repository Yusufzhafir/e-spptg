import * as submissionQueries from '@/server/db/queries/submissions';
import { handleStatistikRequest } from '@/server/public-api/http';
import type { StatusSPPTG } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Every status is listed even when its count is zero, so the dashboard can bind
 * to a fixed set of keys instead of defending against missing ones.
 */
const STATUS_KOSONG: Record<StatusSPPTG, number> = {
  'SPPTG terdata': 0,
  'SPPTG terdaftar': 0,
  'SPPTG ditolak': 0,
  'SPPTG ditinjau ulang': 0,
  'Terbit SPPTG': 0,
};

export async function GET(req: Request) {
  return handleStatistikRequest(req, async (filters) => {
    const rows = await submissionQueries.getKPIDataScoped(filters);

    const perStatus = { ...STATUS_KOSONG };
    let total = 0;

    for (const row of rows) {
      // `count(*)` comes back as a string from node-postgres (bigint).
      const jumlah = Number(row.count);
      if (Number.isNaN(jumlah)) continue;
      if (row.status in perStatus) {
        perStatus[row.status as StatusSPPTG] = jumlah;
        total += jumlah;
      }
    }

    return { total, perStatus };
  });
}
