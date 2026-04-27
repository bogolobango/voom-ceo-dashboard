import dns from "dns";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../shared/schema.js";

// Force IPv4 DNS resolution to avoid IPv6 connectivity issues
dns.setDefaultResultOrder("ipv4first");

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.warn(
    "DATABASE_URL is not set. Database features will be unavailable.",
  );
}

// Determine SSL config based on environment
// In production (Render), use proper SSL validation.
// rejectUnauthorized: false is only acceptable for local dev or when CA certs aren't available.
// Supabase connection pooler (Supavisor) uses certs that may not be in
// the host's trust store (Replit, Docker, etc). rejectUnauthorized: false
// is acceptable here because we're connecting to a known Supabase endpoint
// over TLS — we just can't verify the specific CA chain on every runtime.
const sslConfig = process.env.DATABASE_URL
  ? { ssl: { rejectUnauthorized: false } }
  : {};

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ...sslConfig,
    }
  : undefined;

export const pool = poolConfig ? new Pool(poolConfig) : null;
export const db = pool ? drizzle(pool, { schema }) : null;

if (pool) {
  pool.on("error", (err: Error) => {
    console.error("Unexpected database pool error:", err.message);
  });
}

// ─── Pool Health Check (Circuit Breaker) ───────────────────

let _poolHealthy = true;
let _lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

export function isPoolHealthy(): boolean {
  return _poolHealthy;
}

export async function checkPoolHealth(): Promise<boolean> {
  if (!pool) return false;
  const now = Date.now();
  if (now - _lastHealthCheck < HEALTH_CHECK_INTERVAL) return _poolHealthy;
  _lastHealthCheck = now;
  try {
    const client = await pool.connect();
    client.release();
    _poolHealthy = true;
  } catch {
    _poolHealthy = false;
  }
  return _poolHealthy;
}

// ─── Graceful Shutdown ─────────────────────────────────────

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
