import 'server-only';
import type { users } from '@/server/db/schema';
import { createSession } from '@/server/auth/session';
import { sessionCookie } from '@/server/auth/cookies';
import { touchUserLastLogin } from '@/server/db/queries/user';
import { recordAudit } from '@/server/audit/record';

type UserRow = typeof users.$inferSelect;

/**
 * Turn an account into a signed-in session and return the `Set-Cookie` for it.
 *
 * The same three steps the password login performs — session row, cookie,
 * audit — kept in one place so the two SSO entry points (first login and
 * confirmed account link) cannot drift apart or forget the audit trail. Failed
 * SSO attempts are recorded by their callers, since only they know why.
 */
export async function completeSsoSignIn(
  user: UserRow,
  meta: { userAgent: string | null; ipAddress: string | null },
  ringkasan: string
): Promise<string> {
  const { token, expiresAt } = await createSession(user.id, meta);
  await touchUserLastLogin(user.id);

  await recordAudit({
    actor: { id: user.id, nama: user.nama, email: user.email, peran: user.peran },
    aksi: 'auth.login',
    entitasId: user.id,
    ringkasan,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return sessionCookie(token, expiresAt);
}

/** Request metadata for the session row, read the same way tRPC's context does. */
export function requestMeta(request: Request) {
  return {
    userAgent: request.headers.get('user-agent'),
    ipAddress:
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      null,
  };
}
