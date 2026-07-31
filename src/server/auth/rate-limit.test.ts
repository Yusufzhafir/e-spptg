import { beforeEach, describe, expect, it } from 'vitest';
import { __clearRateLimits, consumeRateLimit, resetRateLimit } from './rate-limit';

beforeEach(() => __clearRateLimits());

describe('consumeRateLimit', () => {
  it('allows up to the limit, then refuses with a wait time', () => {
    for (let i = 0; i < 3; i++) {
      expect(consumeRateLimit('login:budi', 3, 60_000).allowed).toBe(true);
    }

    const blocked = consumeRateLimit('login:budi', 3, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('counts each key separately', () => {
    consumeRateLimit('login:budi', 1, 60_000);
    expect(consumeRateLimit('login:budi', 1, 60_000).allowed).toBe(false);
    // A different email/IP pair is unaffected — one attacker must not be able to
    // lock everyone else out.
    expect(consumeRateLimit('login:siti', 1, 60_000).allowed).toBe(true);
  });

  it('starts a fresh window once the old one has passed', () => {
    // A zero-length window is already over by the time the next call arrives.
    expect(consumeRateLimit('login:budi', 1, 0).allowed).toBe(true);
    expect(consumeRateLimit('login:budi', 1, 0).allowed).toBe(true);
  });
});

describe('resetRateLimit', () => {
  it('clears a key, so a successful login forgives earlier typos', () => {
    consumeRateLimit('login:budi', 1, 60_000);
    expect(consumeRateLimit('login:budi', 1, 60_000).allowed).toBe(false);

    resetRateLimit('login:budi');
    expect(consumeRateLimit('login:budi', 1, 60_000).allowed).toBe(true);
  });
});
