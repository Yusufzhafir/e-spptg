import 'dotenv/config'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as Schema from "@/server/db/schema"
import { positiveIntFromEnv } from '@/lib/env-number'

/**
 * How many PostgreSQL connections this app container may hold open.
 *
 * `node-postgres` defaults to **10**, which is the ceiling on how many requests
 * can touch the database at the same time — everything else queues. Ten is
 * plenty for daily use (a handful of desa staff), but not for a room full of
 * people working at once: a Step 3 overlap check or an SPPTG PDF holds its
 * connection for seconds, so ten slow requests stall the eleventh, and the
 * eleventh is somebody's spinner.
 *
 * 20 is the new default: comfortably above a 50-person session while leaving
 * most of PostgreSQL's own `max_connections` (100 by default) for psql, backups
 * and the migrator. Raise `DATABASE_POOL_MAX` for a bigger event, but never past
 * the server's `max_connections` minus that headroom — an exhausted server
 * refuses connections outright instead of queueing.
 */
const poolMax = positiveIntFromEnv(process.env.DATABASE_POOL_MAX, 20);

// The `!` is deliberate, not laziness. The pool is built without opening a
// connection, and `next build` imports this module while collecting page data
// with no env file loaded — so validating (or throwing) here would fail the
// build. A genuinely missing DATABASE_URL surfaces on the first query.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  max: poolMax,
  // Without this, a request that arrives while every connection is busy waits
  // *forever* — the client sees an endless spinner and no error is ever logged,
  // which is the hardest possible version of this failure to diagnose. Ten
  // seconds is far longer than a healthy checkout and still fails loudly.
  connectionTimeoutMillis: 10_000,
})

export const db = drizzle(pool, {
    schema : Schema,
})

export type DBTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
