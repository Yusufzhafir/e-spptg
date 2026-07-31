import 'server-only';
import { consumeRateLimit } from '@/server/auth/rate-limit';
import {
  findAuthenticatedClient,
  isIpAllowed,
  parseAllowedIps,
  parseApiClients,
  resolveClientIp,
} from './clients';

export const CLIENT_ID_HEADER = 'x-client-id';
export const API_KEY_HEADER = 'x-api-key';

/**
 * Generous by dashboard standards — the executive dashboard refreshes on demand
 * ("realtime"), and three endpoints per refresh is normal. This exists to stop
 * a runaway loop or a brute-force attempt from hammering the database, not to
 * meter legitimate use.
 */
const RATE_LIMIT_MAX = 120;
const RATE_LIMIT_WINDOW_MS = 60_000;

export type ApiAuthSuccess = { ok: true; clientId: string };
export type ApiAuthFailure = {
  ok: false;
  status: number;
  kode: string;
  pesan: string;
  retryAfterSeconds?: number;
};
export type ApiAuthResult = ApiAuthSuccess | ApiAuthFailure;

/** Warn once per process instead of once per request. */
let warnedAboutOpenAllowlist = false;

function warnIfAllowlistEmpty(allowedIps: string[]) {
  if (allowedIps.length > 0 || warnedAboutOpenAllowlist) return;
  warnedAboutOpenAllowlist = true;
  console.warn(
    '[statistik-api] STATISTIK_API_ALLOWED_IPS kosong — API statistik menerima ' +
      'permintaan dari IP mana pun. Isi variabel ini dengan IP publik server ' +
      'dashboard begitu tersedia.'
  );
}

/**
 * Authenticate a server-to-server call to the statistics API.
 *
 * Order matters: the IP allowlist is checked *before* the credentials, so an
 * off-network attacker cannot use this endpoint as a Client ID oracle at all.
 * Rate limiting comes last and is keyed per client, so one misbehaving consumer
 * cannot lock the others out.
 */
export async function authenticateApiRequest(req: Request): Promise<ApiAuthResult> {
  const clients = parseApiClients(process.env.STATISTIK_API_CLIENTS);

  // No credentials configured means the integration was never set up. Failing
  // closed with a distinct code makes that obvious in the logs instead of
  // looking like the caller sent a bad key.
  if (clients.length === 0) {
    return {
      ok: false,
      status: 503,
      kode: 'API_BELUM_DIKONFIGURASI',
      pesan: 'API statistik belum diaktifkan di server ini.',
    };
  }

  const allowedIps = parseAllowedIps(process.env.STATISTIK_API_ALLOWED_IPS);
  warnIfAllowlistEmpty(allowedIps);

  const ip = resolveClientIp(req);
  if (!isIpAllowed(ip, allowedIps)) {
    return {
      ok: false,
      status: 403,
      kode: 'IP_TIDAK_DIIZINKAN',
      pesan: 'Alamat IP pemanggil tidak terdaftar.',
    };
  }

  const client = findAuthenticatedClient(
    clients,
    req.headers.get(CLIENT_ID_HEADER),
    req.headers.get(API_KEY_HEADER)
  );

  if (!client) {
    return {
      ok: false,
      status: 401,
      kode: 'KREDENSIAL_TIDAK_VALID',
      pesan: `Client ID atau API key tidak valid. Kirim header ${CLIENT_ID_HEADER} dan ${API_KEY_HEADER}.`,
    };
  }

  const limit = await consumeRateLimit(
    `statistik-api:${client.clientId}`,
    RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW_MS
  );

  if (!limit.allowed) {
    return {
      ok: false,
      status: 429,
      kode: 'TERLALU_BANYAK_PERMINTAAN',
      pesan: 'Terlalu banyak permintaan. Coba lagi sebentar.',
      retryAfterSeconds: limit.retryAfterSeconds,
    };
  }

  return { ok: true, clientId: client.clientId };
}
