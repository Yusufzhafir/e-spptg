import 'server-only';
import { z } from 'zod';
import type { SubmissionDashboardFilters } from '@/server/db/queries/submissions';
import { authenticateApiRequest } from './guard';

/**
 * Query parameters accepted by every statistics endpoint. Deliberately a subset
 * of the app's own `dashboardFilterSchema`: the `search` filter is omitted
 * because it matches on nama pemilik and NIK, and this API must never be a way
 * to probe for a specific citizen.
 */
const statistikFilterSchema = z.object({
  dari: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD')
    .optional(),
  sampai: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD')
    .optional(),
  kecamatan: z.string().min(1).optional(),
  desaId: z.coerce.number().int().positive().optional(),
});

export type StatistikFilter = z.infer<typeof statistikFilterSchema>;

/** JSON envelope shared by every endpoint. */
function jsonResponse(body: unknown, status: number, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // Server-to-server only: no `Access-Control-Allow-Origin` is set
      // anywhere, so a browser on another origin cannot read these responses.
      // Statistics are recomputed per request because the dashboard asks for
      // realtime numbers.
      'cache-control': 'no-store',
      ...headers,
    },
  });
}

export function apiSuccess(data: unknown, filter: StatistikFilter) {
  return jsonResponse(
    {
      sukses: true,
      waktu: new Date().toISOString(),
      filter: {
        dari: filter.dari ?? null,
        sampai: filter.sampai ?? null,
        kecamatan: filter.kecamatan ?? null,
        desaId: filter.desaId ?? null,
      },
      data,
    },
    200
  );
}

/** Same envelope, for the index endpoint which takes no filters. */
export function apiPlain(data: unknown) {
  return jsonResponse({ sukses: true, waktu: new Date().toISOString(), data }, 200);
}

export function apiError(
  status: number,
  kode: string,
  pesan: string,
  headers?: HeadersInit
) {
  return jsonResponse({ sukses: false, kode, pesan }, status, headers);
}

/**
 * Turns the public query string into the filter shape the existing submission
 * queries already understand.
 *
 * `onlyValid` is hard-coded to true so these numbers match what officials see
 * in the app: entries flagged invalid are hidden from the dashboard's own KPI
 * cards and map, and an external dashboard reporting a different total than the
 * source system would be worse than useless.
 *
 * `kecamatan` maps to `scopeKecamatan` rather than to the query layer's own
 * `kecamatan` filter. Both now resolve desa -> kecamatan through `villages`, so
 * they agree on *which* rows match; they differ in how they combine with
 * `desaId`. The `kecamatan` filter is mutually exclusive with it (`else if`,
 * mirroring the dashboard, which never sends both), while `scopeKecamatan` is a
 * separate condition — so this API can narrow by kecamatan *and* desa at once,
 * which is what `docs/API-STATISTIK.md` promises callers.
 */
export function toQueryFilters(filter: StatistikFilter): SubmissionDashboardFilters {
  return {
    dateFrom: filter.dari,
    dateTo: filter.sampai,
    scopeKecamatan: filter.kecamatan,
    desaId: filter.desaId,
    onlyValid: true,
  };
}

/**
 * Auth + validation + error handling for a statistics route, so each handler is
 * only the query it runs.
 */
export async function handleStatistikRequest(
  req: Request,
  handler: (filters: SubmissionDashboardFilters) => Promise<unknown>
): Promise<Response> {
  const auth = authenticateApiRequest(req);
  if (!auth.ok) {
    return apiError(
      auth.status,
      auth.kode,
      auth.pesan,
      auth.retryAfterSeconds
        ? { 'retry-after': String(auth.retryAfterSeconds) }
        : undefined
    );
  }

  const { searchParams } = new URL(req.url);
  const parsed = statistikFilterSchema.safeParse({
    dari: searchParams.get('dari') ?? undefined,
    sampai: searchParams.get('sampai') ?? undefined,
    kecamatan: searchParams.get('kecamatan') ?? undefined,
    desaId: searchParams.get('desaId') ?? undefined,
  });

  if (!parsed.success) {
    return apiError(
      400,
      'PARAMETER_TIDAK_VALID',
      parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    );
  }

  try {
    const data = await handler(toQueryFilters(parsed.data));
    return apiSuccess(data, parsed.data);
  } catch (error) {
    // The client is another system, not a person: log the detail server-side and
    // return something generic, so a database error never reaches an outside
    // caller as a stack trace.
    console.error(`[statistik-api] ${auth.clientId} gagal:`, error);
    return apiError(500, 'KESALAHAN_SERVER', 'Terjadi kesalahan saat mengambil data.');
  }
}
