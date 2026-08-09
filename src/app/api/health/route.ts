import { sql } from 'drizzle-orm';
import { db } from '@/server/db/db';
import { isRedisReady } from '@/server/redis/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Liveness probe for the container healthcheck.
 *
 * It exists because the previous probe fetched `/`, and `/` is a server
 * component that renders the landing copy without touching Postgres — so the
 * container reported `healthy` for 24 hours while every authenticated page was
 * failing (the host rebooted, Postgres came up before `docker0` existed and
 * never bound the gateway address). A probe that cannot observe the database
 * cannot detect that class of outage, which is the only class worth probing for
 * here.
 *
 * Deliberately unauthenticated: the healthcheck runs before any session exists.
 * It is safe to leave open because the body carries no counts, no identifiers
 * and no configuration — only which dependency is reachable. `/api/*` already
 * carries `X-Robots-Tag: noindex` from next.config.ts.
 */

/** Below the 5s healthcheck timeout in docker-compose, so we answer first. */
const DB_TIMEOUT_MS = 4000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms)
    ),
  ]);
}

export async function GET() {
  let dbOk = false;

  try {
    // `select 1` is enough: it proves the pool can open a connection and the
    // server answers. Touching a real table would also fail on an unrelated
    // migration problem, which is not what this probe is for.
    await withTimeout(db.execute(sql`select 1`), DB_TIMEOUT_MS);
    dbOk = true;
  } catch {
    dbOk = false;
  }

  // Redis never fails the probe. `withRedis()` turns a Redis outage into a
  // slower app, not a broken one, and an unset REDIS_URL is a supported
  // configuration — restarting the container would not fix either, so flagging
  // it as unhealthy would only cause a restart loop. Reported for visibility.
  const redisOk = isRedisReady();

  const body = {
    status: dbOk ? 'ok' : 'down',
    db: dbOk ? 'ok' : 'down',
    redis: redisOk ? 'ok' : 'off',
    waktu: new Date().toISOString(),
  };

  return Response.json(body, {
    status: dbOk ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
