import 'server-only';
import Redis from 'ioredis';

/**
 * Redis connection for sessions, rate limiting and read caching.
 *
 * Everything here is written so that **Redis being down degrades the app rather
 * than breaking it**. This is a government service where people process land
 * claims; a cache outage must not become an outage of the whole system. Callers
 * get `null` from `getRedis()` when Redis is unreachable and are expected to
 * fall back — sessions to the `sessions` table, rate limiting to the in-process
 * map, caches to reading straight through.
 *
 * `REDIS_URL` unset is a supported configuration, not an error: local
 * development without a Redis container takes exactly the fallback paths above.
 */

/** Prefix on every key, so a Redis that ever gets shared cannot collide. */
export const KEY_PREFIX = 'espptg:';

let client: Redis | null = null;
let disabled = false;
let warnedUnavailable = false;

function warnOnce(message: string) {
  if (warnedUnavailable) return;
  warnedUnavailable = true;
  console.warn(`[redis] ${message}`);
}

/**
 * The connection, or null when Redis is not configured or not reachable.
 *
 * `lazyConnect` plus `enableOfflineQueue: false` is the combination that makes
 * failure fast: without the second flag ioredis silently queues commands while
 * disconnected and every caller hangs until the queue times out, turning a
 * cache outage into a request pile-up.
 */
export function getRedis(): Redis | null {
  if (disabled) return null;
  if (client) return client;

  const url = process.env.REDIS_URL;
  if (!url) {
    disabled = true;
    warnOnce('REDIS_URL tidak diatur — sesi memakai Postgres, rate limit memakai memori proses.');
    return null;
  }

  client = new Redis(url, {
    lazyConnect: false,
    enableOfflineQueue: false,
    // Give up on a command rather than letting a request hang on a dead cache.
    commandTimeout: 1_000,
    connectTimeout: 3_000,
    // Capped backoff: keep trying forever (Redis may just be restarting) but
    // never faster than every 5 seconds once it has been down a while.
    retryStrategy: (times) => Math.min(times * 200, 5_000),
    maxRetriesPerRequest: 1,
  });

  // Without a listener, ioredis emits an unhandled 'error' event and crashes
  // the Node process — which is the opposite of degrading gracefully.
  client.on('error', (error: Error) => {
    warnOnce(`tidak dapat terhubung (${error.message}) — sementara memakai jalur cadangan.`);
  });
  client.on('ready', () => {
    warnedUnavailable = false;
    console.info('[redis] terhubung.');
  });

  return client;
}

/** True when Redis is connected right now. Cheap: reads ioredis' own state. */
export function isRedisReady(): boolean {
  const redis = getRedis();
  return redis?.status === 'ready';
}

/**
 * Run a Redis operation, returning `fallback` if Redis is unavailable or the
 * command fails. Every call site in the app goes through this, so there is one
 * place where "Redis broke" is turned into "carry on without it".
 */
export async function withRedis<T>(
  operation: (redis: Redis) => Promise<T>,
  fallback: T
): Promise<T> {
  const redis = getRedis();
  if (!redis || redis.status !== 'ready') return fallback;

  try {
    return await operation(redis);
  } catch (error) {
    warnOnce(
      `perintah gagal (${error instanceof Error ? error.message : String(error)}) — memakai jalur cadangan.`
    );
    return fallback;
  }
}

export function key(...parts: (string | number)[]): string {
  return KEY_PREFIX + parts.join(':');
}

/** Closes the connection. For tests and graceful shutdown, not request paths. */
export async function closeRedis(): Promise<void> {
  if (!client) return;
  const current = client;
  client = null;
  disabled = false;
  warnedUnavailable = false;
  await current.quit().catch(() => current.disconnect());
}

/** Test seam: forget the cached client so the next call re-reads REDIS_URL. */
export function __resetRedisForTests(): void {
  client = null;
  disabled = false;
  warnedUnavailable = false;
}
