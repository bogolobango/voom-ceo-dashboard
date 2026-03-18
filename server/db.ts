import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../shared/schema.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.warn(
    "DATABASE_URL is not set. Database features will be unavailable.",
  );
}

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: { rejectUnauthorized: false },
    }
  : undefined;

export const pool = poolConfig ? new Pool(poolConfig) : null;
export const db = pool ? drizzle(pool, { schema }) : null;

if (pool) {
  pool.on("error", (err: Error) => {
    console.error("Unexpected database pool error:", err);
  });
}

export async function closeDatabase() {
  if (!pool) return;
  try {
    await pool.end();
    console.log("All database connections closed");
  } catch (error) {
    console.error("Error closing database connections:", error);
  }
}

process.on("SIGINT", async () => {
  await closeDatabase();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  await closeDatabase();
  process.exit(0);
});
