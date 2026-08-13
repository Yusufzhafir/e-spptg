import { catatKunjungan, hapusKunjunganLama } from '@/server/db/queries/page-visits';
import { resolveClientIp } from '@/server/public-api/clients';
import { consumeRateLimit } from '@/server/auth/rate-limit';
import {
  adalahBot,
  browserDari,
  klasifikasiRujukan,
  perangkatDari,
  sistemOperasiDari,
} from '@/lib/user-agent';
import { PRIVATE_PATH_PREFIXES } from '@/lib/site';
import { lokasiDariIp } from '@/server/geoip';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Counts one view of a public page.
 *
 * A beacon rather than a server render, because `/` is prerendered (ISR): there
 * is no per-visit server execution left to count it. `VisitTracker` fires this
 * once per page load with `navigator.sendBeacon`, which means the response body
 * is never read — the status code is all that matters, and it always answers
 * `204` so a counter outage can never surface as an error in a visitor's
 * console.
 *
 * Three things it refuses to record:
 * - **bots**, by user agent, so the number means "people" (see `adalahBot`);
 * - **private paths**, so a mistyped call can never log that someone was on
 *   `/app/pengajuan/123` — this endpoint exists for the public site only;
 * - **floods**, via a per-IP rate limit; without it one script could invent any
 *   visit figure it liked.
 */

/** Generous for a person (a reload is a hit), useless for a flooder. */
const BATAS_PER_IP = 60;
const JENDELA_MS = 60_000;

/** Chance a request also prunes expired rows — see `VISIT_RETENTION_DAYS`. */
const PELUANG_PEMANGKASAN = 0.01;

const KOSONG = new Response(null, { status: 204 });

function pathPublik(path: string): boolean {
  return (
    path.startsWith('/') &&
    !PRIVATE_PATH_PREFIXES.some(
      (prefix) => path === prefix || path.startsWith(`${prefix}/`)
    )
  );
}

export async function POST(req: Request) {
  const userAgent = req.headers.get('user-agent');
  if (adalahBot(userAgent)) return KOSONG;

  const ip = resolveClientIp(req);
  if (ip) {
    const { allowed } = await consumeRateLimit(`kunjungan:${ip}`, BATAS_PER_IP, JENDELA_MS);
    if (!allowed) return KOSONG;
  }

  // The beacon posts `{ path }`. A payload that does not carry a usable one is
  // not counted at all rather than being filed under `/`: the tracker always
  // sends a path, so anything else is a malformed or hand-made request, and
  // defaulting it to the landing page would let junk inflate the figure.
  let path: string | null = null;
  try {
    const body = (await req.json()) as { path?: unknown };
    if (typeof body.path === 'string' && body.path.length <= 255) path = body.path;
  } catch {
    return KOSONG;
  }
  if (!path || !pathPublik(path)) return KOSONG;

  const rujukan = klasifikasiRujukan(req.headers.get('referer'), req.headers.get('host'));

  // Geolocation comes from the proxy in front of the app when there is one
  // (Cloudflare sends `CF-IPCountry`; nginx/Traefik can be configured to send
  // the `X-Geo-*` pair), and otherwise from a local MMDB file — see
  // `src/server/geoip.ts`. Still no outbound call either way.
  //
  // The proxy wins on purpose: it sits closer to the visitor and sees the
  // connection itself, while our copy of the database is a monthly snapshot.
  //
  // These headers must be stripped at the proxy (`proxy_set_header CF-IPCountry
  // ""` and friends in /etc/nginx/conf.d/e-spptg.conf). Without that a visitor
  // can send them by hand and file themselves under any city they like.
  const negaraHeader =
    req.headers.get('cf-ipcountry') ?? req.headers.get('x-geo-country') ?? null;
  const kotaHeader = req.headers.get('cf-ipcity') ?? req.headers.get('x-geo-city') ?? null;

  const lokasi =
    negaraHeader && kotaHeader
      ? { negara: negaraHeader, kota: kotaHeader }
      : await lokasiDariIp(ip);

  const negara = negaraHeader ?? lokasi.negara;
  const kota = kotaHeader ?? lokasi.kota;

  try {
    await catatKunjungan({
      path,
      ip,
      rujukanJenis: rujukan.jenis,
      rujukanHost: rujukan.host,
      browser: browserDari(userAgent),
      os: sistemOperasiDari(userAgent),
      perangkat: perangkatDari(userAgent),
      negara: negara?.slice(0, 80) ?? null,
      kota: kota?.slice(0, 120) ?? null,
    });

    if (Math.random() < PELUANG_PEMANGKASAN) await hapusKunjunganLama();
  } catch (error) {
    // Logged, never returned: the visitor asked for a page, not for a counter.
    console.error('[kunjungan] gagal mencatat:', error);
  }

  return KOSONG;
}
