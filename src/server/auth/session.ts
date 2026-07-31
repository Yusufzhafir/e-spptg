import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, lt } from 'drizzle-orm';
import { db, DBTransaction } from '@/server/db/db';
import { sessions, users } from '@/server/db/schema';

// Re-exported so server code has a single import for everything session-related;
// the constant itself lives in a pure module the Edge middleware can also read.
export { SESSION_COOKIE_NAME } from '@/lib/auth-cookie';

/** 30 days, matching what people expect from "tetap masuk" on an internal tool. */
export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Once a session is more than halfway through its life, a request extends it.
 * Sliding renewal keeps daily users signed in indefinitely while an abandoned
 * session still ages out, and the halfway threshold means at most one extra
 * write per session per two weeks instead of one per request.
 */
const SESSION_RENEWAL_THRESHOLD_MS = SESSION_DURATION_MS / 2;

/** SHA-256 of the raw token; only this ever reaches the database. */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function generateToken(): string {
  // 32 bytes of CSPRNG output — base64url so it is cookie-safe without escaping.
  return randomBytes(32).toString('base64url');
}

export type SessionUser = typeof users.$inferSelect;

export type SessionValidationResult =
  | { session: typeof sessions.$inferSelect; user: SessionUser }
  | { session: null; user: null };

/**
 * Issue a session and return the raw token — the only moment it exists outside
 * the browser. Callers must put it in the cookie and then forget it.
 */
export async function createSession(
  userId: number,
  meta?: { userAgent?: string | null; ipAddress?: string | null },
  tx?: DBTransaction
): Promise<{ token: string; expiresAt: Date }> {
  const queryDb = tx || db;
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await queryDb.insert(sessions).values({
    id: hashToken(token),
    userId,
    expiresAt,
    // Long user agents are truncated rather than rejected: this is a display
    // field, and a weird UA string must never be able to fail a login.
    userAgent: meta?.userAgent?.slice(0, 512) ?? null,
    ipAddress: meta?.ipAddress?.slice(0, 64) ?? null,
  });

  return { token, expiresAt };
}

/**
 * Resolve a raw token to its session and user, renewing it when it is past
 * halfway. Expired sessions are deleted on sight so the table self-cleans for
 * anyone who comes back after a long absence.
 */
export async function validateSessionToken(
  token: string
): Promise<SessionValidationResult> {
  if (!token) return { session: null, user: null };

  const sessionId = hashToken(token);

  const row = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, sessionId))
    .limit(1);

  const found = row[0];
  if (!found) return { session: null, user: null };

  if (found.session.expiresAt.getTime() <= Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return { session: null, user: null };
  }

  let session = found.session;
  if (
    found.session.expiresAt.getTime() - Date.now() <
    SESSION_DURATION_MS - SESSION_RENEWAL_THRESHOLD_MS
  ) {
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
    await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, sessionId));
    session = { ...session, expiresAt };
  }

  return { session, user: found.user };
}

/** Log out one device. */
export async function invalidateSession(token: string): Promise<void> {
  if (!token) return;
  await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}

/**
 * Drop every session a user has. Used by deactivation, password change and
 * password reset — each of which is meaningless if the old cookies keep working.
 */
export async function invalidateAllUserSessions(
  userId: number,
  tx?: DBTransaction
): Promise<void> {
  const queryDb = tx || db;
  await queryDb.delete(sessions).where(eq(sessions.userId, userId));
}

/** The user's other live sessions, newest first, for the "perangkat" list. */
export async function listUserSessions(userId: number) {
  return db
    .select({
      id: sessions.id,
      userAgent: sessions.userAgent,
      ipAddress: sessions.ipAddress,
      createdAt: sessions.createdAt,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, new Date())))
    .orderBy(sessions.createdAt);
}

/** Housekeeping for expired rows; safe to call opportunistically. */
export async function deleteExpiredSessions(): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

/** The digest a raw token maps to, so callers can compare without re-hashing. */
export function sessionIdFromToken(token: string): string {
  return hashToken(token);
}
