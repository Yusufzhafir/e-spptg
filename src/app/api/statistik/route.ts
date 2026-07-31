import { authenticateApiRequest } from '@/server/public-api/guard';
import { apiError, apiPlain } from '@/server/public-api/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Index of the statistics API. Its real job is to let an integrator confirm
 * their Client ID, API key and source IP work before wiring up any charts —
 * a 200 here means the credentials are good and nothing else is in the way.
 */
export async function GET(req: Request) {
  const auth = authenticateApiRequest(req);
  if (!auth.ok) {
    return apiError(
      auth.status,
      auth.kode,
      auth.pesan,
      auth.retryAfterSeconds ? { 'retry-after': String(auth.retryAfterSeconds) } : undefined
    );
  }

  return apiPlain({
    layanan: 'API Statistik SIAPTAH',
    clientId: auth.clientId,
    keterangan:
      'Data agregat pengajuan SPPTG. Hanya baca, tidak memuat data pribadi pemohon.',
    endpoint: [
      {
        path: '/api/statistik/ringkasan',
        keterangan: 'Jumlah pengajuan per status dan totalnya.',
      },
      {
        path: '/api/statistik/tren-bulanan',
        keterangan: 'Jumlah pengajuan per bulan, urut naik.',
      },
      {
        path: '/api/statistik/per-desa',
        keterangan: 'Rekap per desa beserta rincian per status.',
      },
    ],
    parameter: {
      dari: 'opsional, YYYY-MM-DD — batas bawah tanggal pengajuan',
      sampai: 'opsional, YYYY-MM-DD — batas atas tanggal pengajuan',
      kecamatan: 'opsional, nama kecamatan',
      desaId: 'opsional, id desa (angka)',
    },
  });
}
