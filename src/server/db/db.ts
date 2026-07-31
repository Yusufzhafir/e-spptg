import 'dotenv/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as Schema from "@/server/db/schema"


// The `!` is deliberate, not laziness. `drizzle()` builds a pool without
// opening a connection, and `next build` imports this module while collecting
// page data with no env file loaded — so validating (or throwing) here would
// fail the build. A genuinely missing DATABASE_URL surfaces on the first query.
export const db = drizzle(process.env.DATABASE_URL!,{
    schema : Schema,
})

export type DBTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];