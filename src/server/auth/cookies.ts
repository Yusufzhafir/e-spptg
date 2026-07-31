import 'server-only';
import { SESSION_COOKIE_NAME } from '@/lib/auth-cookie';

/**
 * `Set-Cookie` strings are built by hand rather than through `next/headers`
 * because the tRPC fetch adapter hands procedures a plain `Headers` object for
 * the response — `cookies().set()` is not available inside it.
 */

/** Reading the cookie back out of a request's `Cookie` header. */
export function readSessionToken(req: Request): string | null {
  const header = req.headers.get('cookie');
  if (!header) return null;

  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== SESSION_COOKIE_NAME) continue;
    return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}

/**
 * `Secure` is skipped outside production so the cookie still works on
 * http://localhost during development; everything else is identical.
 *
 * SameSite=Lax rather than Strict: the app links back to itself from the
 * password-reset email, and Strict would drop the session cookie on that
 * cross-site navigation and make the user look signed out.
 */
function cookieAttributes(maxAgeSeconds: number): string {
  const attrs = [
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (process.env.NODE_ENV === 'production') attrs.push('Secure');
  return attrs.join('; ');
}

export function sessionCookie(token: string, expiresAt: Date): string {
  const maxAge = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; ${cookieAttributes(maxAge)}`;
}

export function clearedSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; ${cookieAttributes(0)}`;
}
