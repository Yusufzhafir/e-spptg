import 'server-only';
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';
import { db } from '@/server/db/db';
import { touchUserLastLogin } from '@/server/db/queries/user';
import { readSessionToken } from '@/server/auth/cookies';
import { validateSessionToken, type SessionUser } from '@/server/auth/session';

// Only rewrite "terakhir masuk" at most this often per user (avoid a write per request)
const LAST_LOGIN_THROTTLE_MS = 10 * 60 * 1000;

/**
 * Resolves the caller from our own session cookie. There is no auto-provisioning
 * step any more: an account exists because someone registered or an admin
 * created it, so an unknown cookie is simply not authenticated.
 */
export async function createTRPCContext(opts?: FetchCreateContextFnOptions) {
  let appUser: SessionUser | null = null;
  let sessionToken: string | null = null;

  if (opts?.req) {
    sessionToken = readSessionToken(opts.req);
  }

  if (sessionToken) {
    const { session, user } = await validateSessionToken(sessionToken);
    if (session && user) {
      appUser = user;

      // Update last-login (throttled) so the "Terakhir Masuk" column is populated
      const last = user.terakhirMasuk ? new Date(user.terakhirMasuk).getTime() : 0;
      if (Date.now() - last > LAST_LOGIN_THROTTLE_MS) {
        try {
          await touchUserLastLogin(user.id);
          appUser = { ...user, terakhirMasuk: new Date() };
        } catch (error) {
          console.error('Error updating last login:', error);
        }
      }
    } else {
      // Cookie present but dead (expired, revoked, or the account was deleted).
      // Treat it as anonymous; the sign-in/logout procedures clear it.
      sessionToken = null;
    }
  }

  return {
    db,
    userId: appUser?.id ?? null,
    appUser,
    sessionToken,
    // The auth procedures write `Set-Cookie` here. Optional so unit tests can
    // build a context without a real HTTP response to attach headers to.
    resHeaders: opts?.resHeaders,
    /** Best-effort request metadata for session bookkeeping and rate limiting. */
    requestMeta: {
      userAgent: opts?.req?.headers.get('user-agent') ?? null,
      ipAddress:
        opts?.req?.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        opts?.req?.headers.get('x-real-ip') ||
        null,
    },
  };
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;
