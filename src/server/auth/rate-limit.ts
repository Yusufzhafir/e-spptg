import 'server-only';

/**
 * A small in-process throttle for the unauthenticated auth endpoints, so a
 * stolen email address cannot be run through a password list at full speed and
 * "lupa sandi" cannot be used to flood someone's inbox.
 *
 * State lives in memory, which means the limit is per app instance and resets on
 * deploy. That is deliberate: this is a brute-force speed bump, not a quota, and
 * a Redis dependency would be a heavier price than the extra attempts an
 * attacker gains from a second instance. If the app is ever scaled out widely,
 * replace the map here rather than the call sites.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Bound the map so a flood of distinct keys cannot grow it without limit.
const MAX_TRACKED_KEYS = 10_000;

function sweep(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  allowed: boolean;
  /** Seconds until the window resets; 0 when the call was allowed. */
  retryAfterSeconds: number;
};

/**
 * Count one attempt against `key`. Returns whether it is allowed and, if not,
 * how long the caller should wait.
 */
export function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();

  if (buckets.size > MAX_TRACKED_KEYS) sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
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
export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

/** Test seam; not used by application code. */
export function __clearRateLimits(): void {
  buckets.clear();
}
