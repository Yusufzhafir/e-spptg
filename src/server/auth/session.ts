import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, lt } from 'drizzle-orm';
import { db, DBTransaction } from '@/server/db/db';
import { sessions, users } from '@/server/db/schema';
import { key, withRedis } from '@/server/redis/client';
import { TTL, cacheKeys, cached } from '@/server/redis/cache';

// Re-exported so server code has a single import for everything session-related;
// the constant itself lives in a pure module the Edge middleware can also read.
export { SESSION_COOKIE_NAME } from '@/lib/auth-cookie';

/** 30 days, matching what people expect from "tetap masuk" on an internal tool. */
export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Once a session is more than halfway through its life, a request extends it.
 * In Redis the extension is a single EXPIRE, so it happens on every request;
 * the Postgres mirror is only rewritten past the halfway mark, which keeps the
 * write volume exactly where it was before Redis existed.
 */
const SESSION_RENEWAL_THRESHOLD_MS = SESSION_DURATION_MS / 2;

/** SHA-256 of the raw token; only this ever reaches Redis or the database. */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function generateToken(): string {
  // 32 bytes of CSPRNG output — base64url so it is cookie-safe without escaping.
  return randomBytes(32).toString('base64url');
}

/** `espptg:sess:<digest>` holds the session; TTL is the expiry. */
const sessionKey = (digest: string) => key('sess', digest);
/** `espptg:usess:<userId>` is the set of a user's live digests, so
 *  "perangkat aktif" and "keluarkan dari semua perangkat" stay possible. */
const userSessionsKey = (userId: number) => key('usess', userId);

export type SessionUser = typeof users.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;

export type SessionValidationResult =
  | { session: SessionRow; user: SessionUser }
  | { session: null; user: null };

/** What Redis stores. Mirrors the columns of `sessions`. */
type StoredSession = {
  id: string;
  userId: number;
  expiresAt: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
};

function toRow(stored: StoredSession): SessionRow {
  return {
    id: stored.id,
    userId: stored.userId,
    expiresAt: new Date(stored.expiresAt),
    userAgent: stored.userAgent,
    ipAddress: stored.ipAddress,
    createdAt: new Date(stored.createdAt),
  };
}

function ttlSeconds(expiresAt: Date): number {
  return Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / 1000));
}

/**
 * Issue a session and return the raw token — the only moment it exists outside
 * the browser. Callers must put it in the cookie and then forget it.
 *
 * Written to **both** Redis and Postgres. Redis serves every subsequent
 * request; Postgres is the durable copy that keeps everyone signed in if Redis
 * is wiped or replaced. One extra INSERT per login is a price worth paying to
 * remove a SELECT+UPDATE from every request.
 */
export async function createSession(
  userId: number,
  meta?: { userAgent?: string | null; ipAddress?: string | null },
  tx?: DBTransaction
): Promise<{ token: string; expiresAt: Date }> {
  const queryDb = tx || db;
  const token = generateToken();
  const digest = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  // Long user agents are truncated rather than rejected: this is a display
  // field, and a weird UA string must never be able to fail a login.
  const userAgent = meta?.userAgent?.slice(0, 512) ?? null;
  const ipAddress = meta?.ipAddress?.slice(0, 64) ?? null;
  const createdAt = new Date();

  await queryDb.insert(sessions).values({
    id: digest,
    userId,
    expiresAt,
    userAgent,
    ipAddress,
  });

  const stored: StoredSession = {
    id: digest,
    userId,
    expiresAt: expiresAt.toISOString(),
    userAgent,
    ipAddress,
    createdAt: createdAt.toISOString(),
  };

  await withRedis(async (redis) => {
    await redis
      .multi()
      .set(sessionKey(digest), JSON.stringify(stored), 'EX', ttlSeconds(expiresAt))
      .sadd(userSessionsKey(userId), digest)
      .expire(userSessionsKey(userId), ttlSeconds(expiresAt))
      .exec();
    return null;
  }, null);

  return { token, expiresAt };
}

/**
 * Resolve a raw token to its session and user.
 *
 * The session comes from Redis when it can, Postgres otherwise (a session
 * created while Redis was down, or a Redis that lost its data) — and a Postgres
 * hit is written back into Redis so the next request is fast again.
 *
 * The **user is always read through `cacheKeys.user`, never stored in the
 * session blob**. Authorization is re-derived from the `users` row on every
 * request, so a role change or deactivation takes effect immediately; baking
 * the role into the session would leave a 30-day window of stale permissions.
 * The user cache is invalidated explicitly on every write to a user.
 */
export async function validateSessionToken(
  token: string
): Promise<SessionValidationResult> {
  if (!token) return { session: null, user: null };

  const digest = hashToken(token);
  let row: SessionRow | null = null;

  const fromRedis = await withRedis(async (redis) => redis.get(sessionKey(digest)), null);
  if (fromRedis) {
    try {
      row = toRow(JSON.parse(fromRedis) as StoredSession);
    } catch {
      await withRedis(async (redis) => redis.del(sessionKey(digest)), 0);
    }
  }

  if (!row) {
    const found = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, digest))
      .limit(1);
    row = found[0] ?? null;

    // Re-populate Redis so this only costs a database read once.
    if (row && row.expiresAt.getTime() > Date.now()) {
      const stored: StoredSession = {
        id: row.id,
        userId: row.userId,
        expiresAt: row.expiresAt.toISOString(),
        userAgent: row.userAgent,
        ipAddress: row.ipAddress,
        createdAt: row.createdAt.toISOString(),
      };
      const seconds = ttlSeconds(row.expiresAt);
      await withRedis(async (redis) => {
        await redis
          .multi()
          .set(sessionKey(digest), JSON.stringify(stored), 'EX', seconds)
          .sadd(userSessionsKey(row!.userId), digest)
          .expire(userSessionsKey(row!.userId), seconds)
          .exec();
        return null;
      }, null);
    }
  }

  if (!row) return { session: null, user: null };

  if (row.expiresAt.getTime() <= Date.now()) {
    await deleteSession(digest, row.userId);
    return { session: null, user: null };
  }

  const user = await cached(cacheKeys.user(row.userId), TTL.user, async () => {
    const found = await db.select().from(users).where(eq(users.id, row!.userId)).limit(1);
    return found[0] ?? null;
  });

  // The account was deleted out from under a live session.
  if (!user) {
    await deleteSession(digest, row.userId);
    return { session: null, user: null };
  }

  let session = row;
  const remaining = row.expiresAt.getTime() - Date.now();
  if (remaining < SESSION_DURATION_MS - SESSION_RENEWAL_THRESHOLD_MS) {
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
    await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, digest));
    session = { ...session, expiresAt };

    const stored: StoredSession = {
      id: session.id,
      userId: session.userId,
      expiresAt: expiresAt.toISOString(),
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      createdAt: session.createdAt.toISOString(),
    };
    const seconds = ttlSeconds(expiresAt);
    await withRedis(async (redis) => {
      await redis
        .multi()
        .set(sessionKey(digest), JSON.stringify(stored), 'EX', seconds)
        .expire(userSessionsKey(session.userId), seconds)
        .exec();
      return null;
    }, null);
  }

  return { session, user };
}

/** Remove one session from both stores. */
async function deleteSession(digest: string, userId?: number): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, digest));
  await withRedis(async (redis) => {
    const pipeline = redis.multi().del(sessionKey(digest));
    if (userId !== undefined) pipeline.srem(userSessionsKey(userId), digest);
    await pipeline.exec();
    return null;
  }, null);
}

/** Log out one device. */
export async function invalidateSession(token: string): Promise<void> {
  if (!token) return;
  const digest = hashToken(token);

  // The user id is needed to keep the per-user set tidy; read it from whichever
  // store answers first.
  const stored = await withRedis(async (redis) => redis.get(sessionKey(digest)), null);
  let userId: number | undefined;
  if (stored) {
    try {
      userId = (JSON.parse(stored) as StoredSession).userId;
    } catch {
      /* fall through to the database */
    }
  }
  if (userId === undefined) {
    const found = await db
      .select({ userId: sessions.userId })
      .from(sessions)
      .where(eq(sessions.id, digest))
      .limit(1);
    userId = found[0]?.userId;
  }

  await deleteSession(digest, userId);
}

/**
 * Drop every session a user has. Used by deactivation, password change, reset
 * and self role change — each of which is meaningless if the old cookies keep
 * working.
 */
export async function invalidateAllUserSessions(
  userId: number,
  tx?: DBTransaction
): Promise<void> {
  const queryDb = tx || db;
  await queryDb.delete(sessions).where(eq(sessions.userId, userId));

  await withRedis(async (redis) => {
    const digests = await redis.smembers(userSessionsKey(userId));
    const pipeline = redis.multi();
    for (const digest of digests) pipeline.del(sessionKey(digest));
    pipeline.del(userSessionsKey(userId));
    await pipeline.exec();
    return null;
  }, null);
}

/**
 * The user's live sessions, newest first, for the "perangkat aktif" list.
 *
 * Read from Postgres rather than Redis: this is a once-per-page-view screen, and
 * the database is the copy guaranteed to hold every session including ones
 * created while Redis was unavailable.
 */
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

/** Housekeeping for expired rows; safe to call opportunistically. Redis expires
 *  its own copies through TTL, so only Postgres needs sweeping. */
export async function deleteExpiredSessions(): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

/** The digest a raw token maps to, so callers can compare without re-hashing. */
export function sessionIdFromToken(token: string): string {
  return hashToken(token);
}
