import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.warn(
    "DATABASE_URL is not set. Did you forget to provision a database?",
  );
}

const connectionString = process.env.DATABASE_URL || "";

export const pool = new Pool({
  ...(connectionString ? { connectionString } : {}),
});
export const db = drizzle(pool, { schema });

export * from "./schema";
