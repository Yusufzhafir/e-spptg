import { describe, expect, it } from 'vitest';
import { clearedSessionCookie, readSessionToken, sessionCookie } from './cookies';
import { SESSION_COOKIE_NAME } from '@/lib/auth-cookie';

function requestWithCookie(header: string | null): Request {
  return new Request('https://example.test/', {
    headers: header === null ? {} : { cookie: header },
  });
}

describe('readSessionToken', () => {
  it('finds the token among other cookies', () => {
    const req = requestWithCookie(
      `theme=dark; ${SESSION_COOKIE_NAME}=abc123; locale=id`
    );
    expect(readSessionToken(req)).toBe('abc123');
  });

  it('returns null when there is no cookie header or no session cookie', () => {
    expect(readSessionToken(requestWithCookie(null))).toBeNull();
    expect(readSessionToken(requestWithCookie('theme=dark'))).toBeNull();
  });

  it('does not match a cookie whose name merely ends with ours', () => {
    // `other_espptg_session` must not be mistaken for `espptg_session`.
    const req = requestWithCookie(`other_${SESSION_COOKIE_NAME}=nope`);
    expect(readSessionToken(req)).toBeNull();
  });

  it('round-trips a token that needed percent-encoding', () => {
    const token = 'a+b/c=d';
    const setCookie = sessionCookie(token, new Date(Date.now() + 60_000));
    const value = setCookie.slice(setCookie.indexOf('=') + 1, setCookie.indexOf(';'));

    expect(readSessionToken(requestWithCookie(`${SESSION_COOKIE_NAME}=${value}`))).toBe(
      token
    );
  });
});

describe('sessionCookie', () => {
  it('is HttpOnly, path-wide and SameSite=Lax', () => {
    const cookie = sessionCookie('tok', new Date(Date.now() + 60_000));
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('SameSite=Lax');
  });

  it('derives Max-Age from the expiry, never negative', () => {
    const future = sessionCookie('tok', new Date(Date.now() + 3_600_000));
    const maxAge = Number(/Max-Age=(\d+)/.exec(future)?.[1]);
    expect(maxAge).toBeGreaterThan(3500);
    expect(maxAge).toBeLessThanOrEqual(3600);

    // An already-expired session must not produce a negative Max-Age, which
    // browsers treat as a session cookie rather than a deletion.
    const past = sessionCookie('tok', new Date(Date.now() - 60_000));
    expect(past).toContain('Max-Age=0');
  });
});

describe('clearedSessionCookie', () => {
  it('expires the cookie immediately with an empty value', () => {
    const cookie = clearedSessionCookie();
    expect(cookie.startsWith(`${SESSION_COOKIE_NAME}=;`)).toBe(true);
    expect(cookie).toContain('Max-Age=0');
    expect(cookie).toContain('HttpOnly');
  });
});
