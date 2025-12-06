import 'dotenv/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as Schema from "@/server/db/schema"


export const db = drizzle(process.env.DATABASE_URL,{
    schema : Schema,
})

export type DBTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];