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

// Defensive error handling for background connection errors
pool.on("error", (err) => {
  console.error("Unexpected error on idle database client:", err);
  console.error("Context:", {
    hasConnectionString: !!connectionString,
    nodeEnv: process.env.NODE_ENV,
    operation: "idle-client-error",
  });
});

export const db = drizzle(pool, { schema });

/**
 * Health-check function to verify the database connection on startup.
 * Call this before the server begins accepting traffic.
 */
export async function checkDatabaseConnection() {
  try {
    const client = await pool.connect();
    try {
      await client.query("SELECT 1");
      console.log("Database connection successful.");
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Database connection failed during health-check:", error);
    console.error("Context:", {
      hasConnectionString: !!connectionString,
      nodeEnv: process.env.NODE_ENV,
      operation: "health-check",
    });
    // Rethrow or exit so the caller (e.g., server startup) fails fast
    throw new Error(
      `Database connection failed: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }
}

export * from "./schema";
