import 'server-only';
import { key, withRedis } from '@/server/redis/client';

/**
 * Throttle for the unauthenticated auth endpoints, so a stolen email address
 * cannot be run through a password list at full speed and "lupa sandi" cannot
 * be used to flood someone's inbox.
 *
 * Counters live in Redis, which fixes the two limits of the in-process map this
 * replaced: the count is now shared across app instances, and it survives a
 * deploy instead of handing an attacker a fresh budget on every restart.
 *
 * The in-process map is still here as the fallback for when Redis is down —
 * a degraded speed bump beats no speed bump at all — and for local development
 * without a Redis container.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Bound the map so a flood of distinct keys cannot grow it without limit.
const MAX_TRACKED_KEYS = 10_000;

function sweep(now: number) {
  for (const [k, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(k);
  }
}

export type RateLimitResult = {
  allowed: boolean;
  /** Seconds until the window resets; 0 when the call was allowed. */
  retryAfterSeconds: number;
};

const rateKey = (bucket: string) => key('rl', bucket);

/**
 * Count one attempt against `key`. Returns whether it is allowed and, if not,
 * how long the caller should wait.
 *
 * INCR then EXPIRE-on-first-hit is the standard fixed-window counter. The two
 * commands go in one pipeline so a crash between them cannot leave a key
 * without a TTL — which would ban that email+IP pair permanently.
 */
export async function consumeRateLimit(
  bucket: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));

  const viaRedis = await withRedis(async (redis) => {
    const k = rateKey(bucket);
    const results = await redis.multi().incr(k).ttl(k).exec();
    if (!results) return null;

    const count = Number(results[0]?.[1] ?? 0);
    let ttl = Number(results[1]?.[1] ?? -1);

    // First hit in this window (or a key that somehow lost its TTL).
    if (ttl < 0) {
      await redis.expire(k, windowSeconds);
      ttl = windowSeconds;
    }

    if (count > limit) {
      return { allowed: false, retryAfterSeconds: Math.max(1, ttl) };
    }
    return { allowed: true, retryAfterSeconds: 0 };
  }, null);

  if (viaRedis) return viaRedis;

  return consumeInMemory(bucket, limit, windowMs);
}

/** The pre-Redis implementation, kept as the fallback path. */
function consumeInMemory(
  bucket: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();

  if (buckets.size > MAX_TRACKED_KEYS) sweep(now);

  const existing = buckets.get(bucket);
  if (!existing || existing.resetAt <= now) {
    buckets.set(bucket, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Wipe a key's history — called after a successful login so one bad typing
 *  streak does not keep counting against someone who then got it right. */
export async function resetRateLimit(bucket: string): Promise<void> {
  buckets.delete(bucket);
  await withRedis(async (redis) => redis.del(rateKey(bucket)), 0);
}

/** Test seam; not used by application code. Clears both stores. */
export async function __clearRateLimits(): Promise<void> {
  buckets.clear();
  await withRedis(async (redis) => {
    let cursor = '0';
    do {
      const [next, found] = await redis.scan(cursor, 'MATCH', `${key('rl')}*`, 'COUNT', 200);
      cursor = next;
      if (found.length > 0) await redis.del(...found);
    } while (cursor !== '0');
    return null;
  }, null);
}
