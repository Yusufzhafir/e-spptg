import 'server-only';
import { createHash } from 'node:crypto';
import { key, withRedis } from './client';

/**
 * Read-through cache in front of Postgres.
 *
 * Two rules this module exists to enforce:
 *
 * 1. **Every cached value has an explicit invalidation.** TTL alone is not
 *    enough for anything authorization depends on: a demoted or deactivated
 *    user must lose access on their next request, not when a timer happens to
 *    expire. TTLs here are a backstop for a missed invalidation, not the
 *    primary mechanism.
 *
 * 2. **Anything scoped per role goes in a key that includes the scope.** The
 *    dashboard aggregates differ per caller (Superadmin sees all desa, Admin
 *    only theirs), so a scope-free key would serve one role's numbers to
 *    another. `scopedKey` hashes the whole filter+scope object into the key.
 */

/** Short by design: the backstop if an invalidation is ever missed. */
export const TTL = {
  /** Read on every authenticated request; invalidated on every user write. */
  user: 60,
  /** Reference data that changes only when a Superadmin edits it. */
  villages: 300,
  prohibitedAreas: 300,
  /** Aggregates recomputed on submission writes; short because they are the
   *  numbers officials read off the dashboard. */
  dashboard: 30,
} as const;

export const cacheKeys = {
  user: (id: number) => key('user', id),
  villagesList: (limit: number, offset: number) => key('villages', 'list', limit, offset),
  villagesAll: () => key('villages'),
  prohibitedAreasList: (limit: number, offset: number) =>
    key('kawasan', 'list', limit, offset),
  /** Unpaged geometry for maps — under the same `kawasan:` prefix, so one
   *  `invalidateProhibitedAreas()` still clears it along with the pages. */
  prohibitedAreasGeometries: () => key('kawasan', 'geom'),
  prohibitedAreasAll: () => key('kawasan'),
  dashboardAll: () => key('dash'),
};

/**
 * A dashboard key that folds the entire filter + scope into a digest, so two
 * callers only share a cache entry when they would get byte-identical results.
 * Sorting the entries first keeps the digest stable regardless of key order.
 */
export function scopedKey(kind: string, scope: Record<string, unknown>): string {
  const stable = Object.entries(scope)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  const digest = createHash('sha1').update(JSON.stringify(stable)).digest('hex').slice(0, 16);
  return key('dash', kind, digest);
}

/**
 * Read through the cache. A Redis outage means `loader()` runs every time —
 * slower, never wrong.
 *
 * `null` and `undefined` from the loader are deliberately not cached: they are
 * usually "not found", and caching a miss makes a freshly created row invisible
 * for the length of the TTL.
 */
export async function cached<T>(
  cacheKey: string,
  ttlSeconds: number,
  loader: () => Promise<T>
): Promise<T> {
  const hit = await withRedis(async (redis) => redis.get(cacheKey), null);

  if (hit !== null) {
    try {
      return JSON.parse(hit, reviveDates) as T;
    } catch {
      // A corrupt entry must not take the request down; drop it and reload.
      await withRedis(async (redis) => redis.del(cacheKey), 0);
    }
  }

  const value = await loader();
  if (value !== null && value !== undefined) {
    await withRedis(
      async (redis) => redis.set(cacheKey, JSON.stringify(value), 'EX', ttlSeconds),
      null
    );
  }
  return value;
}

/**
 * JSON has no date type, so timestamps come back as strings and callers that do
 * `row.createdAt.getTime()` would throw. Revive anything that looks like an
 * ISO-8601 instant.
 */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
function reviveDates(_key: string, value: unknown) {
  return typeof value === 'string' && ISO_DATE.test(value) ? new Date(value) : value;
}

/** Drop specific keys. Safe to call when Redis is down. */
export async function invalidate(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await withRedis(async (redis) => redis.del(...keys), 0);
}

/**
 * Drop every key under a prefix, e.g. all dashboard aggregates after a
 * submission changes.
 *
 * SCAN rather than KEYS: KEYS blocks the whole server while it walks the
 * keyspace, which on a shared instance would stall every other request.
 */
export async function invalidatePrefix(prefix: string): Promise<void> {
  await withRedis(async (redis) => {
    let cursor = '0';
    do {
      const [next, found] = await redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 200);
      cursor = next;
      if (found.length > 0) await redis.del(...found);
    } while (cursor !== '0');
    return null;
  }, null);
}

/** Called after any write to a user row, so the next request re-reads it. */
export async function invalidateUser(id: number): Promise<void> {
  await invalidate(cacheKeys.user(id));
}

/** Villages feed both their own list and the desa/kecamatan scoping used by
 *  the dashboard aggregates, so both families go. */
export async function invalidateVillages(): Promise<void> {
  await invalidatePrefix(cacheKeys.villagesAll());
  await invalidatePrefix(cacheKeys.dashboardAll());
}

export async function invalidateProhibitedAreas(): Promise<void> {
  await invalidatePrefix(cacheKeys.prohibitedAreasAll());
}

/** Any change to a submission moves the KPI and trend numbers. */
export async function invalidateDashboard(): Promise<void> {
  await invalidatePrefix(cacheKeys.dashboardAll());
}
