import * as submissionQueries from '@/server/db/queries/submissions';
import { handleStatistikRequest } from '@/server/public-api/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return handleStatistikRequest(req, async (filters) => {
    const rows = await submissionQueries.getMonthlyStats(filters);
    // Months with no submissions are absent rather than zero-filled: the range
    // is open-ended unless the caller passes `dari`/`sampai`, so there is no
    // well-defined span to fill.
    return rows.map((row) => ({ bulan: row.month, jumlah: row.count }));
  });
}
