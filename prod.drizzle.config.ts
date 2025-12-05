import type { Config } from "drizzle-kit";
import dotenv from "dotenv";

dotenv.config({ path: ".env.development.prod" });

if (!process.env.DATABASE_URL_DDL) {
  throw new Error("DATABASE_URL is missing");
}

export default {
  schema: "./src/server/db/schema.ts",
  out: "./drizzle-prod",
  dbCredentials: {
    url: process.env.DATABASE_URL_DDL,
  },
  extensionsFilters: ["postgis"],
  dialect: "postgresql",
  tablesFilter: ['!geography_columns', '!geometry_columns'], // 👈 👈
} satisfies Config;
