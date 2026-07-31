import { beforeEach, describe, expect, it } from 'vitest';
import { __clearRateLimits, consumeRateLimit, resetRateLimit } from './rate-limit';

/**
 * These run without `REDIS_URL`, so they exercise the in-process fallback —
 * which is exactly the path that has to keep working when Redis is down. The
 * Redis-backed path is covered by the live tests, against a real server.
 */
beforeEach(async () => {
  await __clearRateLimits();
});

describe('consumeRateLimit (jalur cadangan tanpa Redis)', () => {
  it('allows up to the limit, then refuses with a wait time', async () => {
    for (let i = 0; i < 3; i++) {
      expect((await consumeRateLimit('login:budi', 3, 60_000)).allowed).toBe(true);
    }

    const blocked = await consumeRateLimit('login:budi', 3, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('counts each key separately', async () => {
    await consumeRateLimit('login:budi', 1, 60_000);
    expect((await consumeRateLimit('login:budi', 1, 60_000)).allowed).toBe(false);
    // A different email/IP pair is unaffected — one attacker must not be able to
    // lock everyone else out.
    expect((await consumeRateLimit('login:siti', 1, 60_000)).allowed).toBe(true);
  });

  it('starts a fresh window once the old one has passed', async () => {
    // A zero-length window is already over by the time the next call arrives.
    expect((await consumeRateLimit('login:budi', 1, 0)).allowed).toBe(true);
    expect((await consumeRateLimit('login:budi', 1, 0)).allowed).toBe(true);
  });
});

describe('resetRateLimit', () => {
  it('clears a key, so a successful login forgives earlier typos', async () => {
    await consumeRateLimit('login:budi', 1, 60_000);
    expect((await consumeRateLimit('login:budi', 1, 60_000)).allowed).toBe(false);

    await resetRateLimit('login:budi');
    expect((await consumeRateLimit('login:budi', 1, 60_000)).allowed).toBe(true);
  });
});
