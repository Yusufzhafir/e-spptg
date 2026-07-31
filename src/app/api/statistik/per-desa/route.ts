import * as submissionQueries from '@/server/db/queries/submissions';
import { handleStatistikRequest } from '@/server/public-api/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return handleStatistikRequest(req, async (filters) => {
    const rows = await submissionQueries.getStatsByVillage(filters);

    return rows.map((row) => ({
      desaId: row.desaId,
      desa: row.desa,
      kecamatan: row.kecamatan,
      total: row.total,
      perStatus: {
        'SPPTG terdata': row.terdata,
        'SPPTG terdaftar': row.terdaftar,
        'SPPTG ditolak': row.ditolak,
        'SPPTG ditinjau ulang': row.ditinjauUlang,
        'Terbit SPPTG': row.terbit,
      },
    }));
  });
}
