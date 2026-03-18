import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "../shared/schema.js";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  console.warn(
    "DATABASE_URL is not set. Database features will be unavailable (using mock data).",
  );
}

const poolConfig = process.env.DATABASE_URL ? {
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
} : undefined;

export const pool = poolConfig ? new Pool(poolConfig) : null;
export const db = poolConfig ? drizzle({ client: pool!, schema }) : null;

if (pool) {
  pool.on('error', (err: Error) => {
    console.error('Unexpected database pool error:', err);
  });
}

export async function closeDatabase() {
  if (!pool) return;
  try {
    await pool.end();
    console.log('All database connections closed');
  } catch (error) {
    console.error('Error closing database connections:', error);
  }
}

process.on('SIGINT', async () => {
  await closeDatabase();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await closeDatabase();
  process.exit(0);
});
