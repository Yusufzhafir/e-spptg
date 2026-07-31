import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Credentials for the read-only statistics API consumed by external dashboards
 * (currently only the Dashboard Eksekutif Kutai Timur).
 *
 * Clients live in an environment variable rather than a database table on
 * purpose. There is one consumer, no admin UI to manage keys, and the operator
 * already edits `.env` to deploy — so a table would add a migration and a
 * key-generation script without changing the actual workflow ("edit config,
 * restart"). If a second or third consumer ever appears, or keys need to be
 * revoked without a restart, move this to a `api_clients` table storing only
 * the digest, exactly like `sessions.id`.
 *
 * Format, comma or newline separated:
 *
 *   STATISTIK_API_CLIENTS="dashboard-eksekutif:LONG_RANDOM_SECRET,bappeda:OTHER_SECRET"
 *
 * The part before the first colon is the Client ID (safe to share, appears in
 * logs); everything after it is the secret and must be treated as a password.
 */
export type ApiClient = {
  clientId: string;
  secret: string;
};

/**
 * Only the *first* colon separates the two halves, so a secret containing a
 * colon still parses. Entries without a colon, without an id, or without a
 * secret are dropped rather than throwing: one typo in `.env` must not take the
 * whole app down at boot.
 */
export function parseApiClients(raw: string | undefined | null): ApiClient[] {
  if (!raw) return [];

  const clients: ApiClient[] = [];
  const seen = new Set<string>();

  for (const entry of raw.split(/[,\n]/)) {
    const trimmed = entry.trim();
    if (!trimmed) continue;

    const separator = trimmed.indexOf(':');
    if (separator <= 0) continue;

    const clientId = trimmed.slice(0, separator).trim();
    const secret = trimmed.slice(separator + 1).trim();
    if (!clientId || !secret) continue;

    // A duplicated id would make "which client is this?" ambiguous in the logs;
    // the first definition wins so behaviour is at least deterministic.
    if (seen.has(clientId)) continue;
    seen.add(clientId);

    clients.push({ clientId, secret });
  }

  return clients;
}

/**
 * Constant-time secret comparison. Both sides are hashed first so that
 * `timingSafeEqual` always gets equal-length buffers — it throws otherwise, and
 * catching that would leak the secret's length through the error path.
 */
export function secretsMatch(provided: string, expected: string): boolean {
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * Look up a client and verify its secret. Returns null for both "no such id"
 * and "wrong secret" so a caller cannot tell valid Client IDs from invalid ones.
 */
export function findAuthenticatedClient(
  clients: ApiClient[],
  clientId: string | null,
  secret: string | null
): ApiClient | null {
  if (!clientId || !secret) return null;

  const client = clients.find((c) => c.clientId === clientId);
  if (!client) return null;

  return secretsMatch(secret, client.secret) ? client : null;
}

/** `STATISTIK_API_ALLOWED_IPS="103.10.20.30, 103.10.20.31"` */
export function parseAllowedIps(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split(/[,\n]/)
    .map((ip) => ip.trim())
    .filter(Boolean);
}

/**
 * An empty allowlist allows everything — the dashboard's public IP was not
 * known when this was built, so the API has to be usable before it is locked
 * down. `guard.ts` logs a warning in that state; filling the variable in is the
 * second layer that keeps a leaked secret from being usable off-network.
 */
export function isIpAllowed(ip: string | null, allowed: string[]): boolean {
  if (allowed.length === 0) return true;
  if (!ip) return false;
  return allowed.includes(normalizeIp(ip));
}

/**
 * IPv4-mapped IPv6 (`::ffff:103.10.20.30`) is what a proxied request often
 * carries; the operator will have written the plain IPv4 form in `.env`.
 */
export function normalizeIp(ip: string): string {
  const trimmed = ip.trim();
  return trimmed.startsWith('::ffff:') ? trimmed.slice('::ffff:'.length) : trimmed;
}

/**
 * Same header order as `createTRPCContext`, so both paths agree on who the
 * caller is. `x-forwarded-for` is a comma-separated chain and the client is the
 * first entry.
 */
export function resolveClientIp(req: Request): string | null {
  const forwarded = req.headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  if (first) return normalizeIp(first);

  const real = req.headers.get('x-real-ip')?.trim();
  return real ? normalizeIp(real) : null;
}
