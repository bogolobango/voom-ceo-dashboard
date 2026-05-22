/**
 * Writes a daily JSON snapshot of VOOM's vendor/ops signals to stdout. The
 * cron wrapper in voom-ghana-marketplace redirects this to
 * data/cto-signals/YYYY-MM-DD-cto-signals.json so the `kofi` agent can read it.
 *
 * Snapshot shape is the contract between this script and the kofi agent.
 * See docs/specs/2026-05-21-kofi-design.md (in voom-ghana-marketplace).
 *
 * Run: pnpm export:cto-signals
 * Requires: DATABASE_URL env var.
 */

import { count, eq, gte, sql } from "drizzle-orm";
import { db } from "../server/db.js";
import { products, vendors } from "../shared/schema.js";

const DORMANT_AGE_DAYS = 14;
const WINDOW_HOURS = 24;

export interface RawSignalRows {
  vendors: Array<{
    id: string;
    status: string;
    verified: boolean;
    createdAt: Date;
    productCount: number;
  }>;
  productsCreated24h: number;
  whatsappFailures24h: number;
  paymentFailures24h: number;
}

export interface CtoSignalsSnapshot {
  snapshot_date: string;
  generated_at: string;
  vendor_total: number;
  signup_rate_24h: number;
  dormant_count: number;
  listing_throughput_24h: number;
  whatsapp_failures_24h: number;
  payment_failures_24h: number;
}

export function shapeSignals(raw: RawSignalRows, now: Date): CtoSignalsSnapshot {
  const cutoff24h = new Date(now.getTime() - WINDOW_HOURS * 60 * 60 * 1000);
  const dormantCutoff = new Date(now.getTime() - DORMANT_AGE_DAYS * 24 * 60 * 60 * 1000);

  const signupRate = raw.vendors.filter((v) => v.createdAt >= cutoff24h).length;
  const dormant = raw.vendors.filter(
    (v) =>
      v.status === "approved" &&
      v.verified === true &&
      v.productCount === 0 &&
      v.createdAt <= dormantCutoff,
  ).length;

  return {
    snapshot_date: now.toISOString().slice(0, 10),
    generated_at: now.toISOString(),
    vendor_total: raw.vendors.length,
    signup_rate_24h: signupRate,
    dormant_count: dormant,
    listing_throughput_24h: raw.productsCreated24h,
    whatsapp_failures_24h: raw.whatsappFailures24h,
    payment_failures_24h: raw.paymentFailures24h,
  };
}

async function fetchRaw(now: Date): Promise<RawSignalRows> {
  if (!db) {
    throw new Error("DATABASE_URL not set or db connection unavailable.");
  }

  const cutoff24h = new Date(now.getTime() - WINDOW_HOURS * 60 * 60 * 1000);

  // Vendors with product counts (single query, left join, group).
  const vendorRows = await db
    .select({
      id: vendors.id,
      status: vendors.status,
      verified: vendors.verified,
      createdAt: vendors.createdAt,
      productCount: sql<number>`COALESCE(COUNT(${products.id}), 0)`.as("product_count"),
    })
    .from(vendors)
    .leftJoin(products, eq(products.vendorId, vendors.id))
    .groupBy(vendors.id);

  const productsCreated24hRows = await db
    .select({ n: count() })
    .from(products)
    .where(gte(products.createdAt, cutoff24h));

  // WhatsApp and payment failure counts: in v1 we proxy these as 0 unless
  // the schema gains explicit columns. Kofi will note "not yet wired" in
  // the report's ops section. v1.1: wire these to whatever telemetry table
  // VOOM adds for outbound WhatsApp deliveries and Remitly confirmations.
  const whatsappFailures = 0;
  const paymentFailures = 0;

  return {
    vendors: vendorRows.map((r) => ({
      id: r.id,
      status: r.status,
      verified: r.verified,
      createdAt: r.createdAt,
      productCount: Number(r.productCount),
    })),
    productsCreated24h: Number(productsCreated24hRows[0]?.n ?? 0),
    whatsappFailures24h: whatsappFailures,
    paymentFailures24h: paymentFailures,
  };
}

async function main() {
  const now = new Date();
  const raw = await fetchRaw(now);
  const snapshot = shapeSignals(raw, now);
  process.stdout.write(JSON.stringify(snapshot, null, 2) + "\n");
}

// Run when invoked directly, not when imported by tests.
const isMain =
  typeof process !== "undefined" &&
  process.argv[1] &&
  process.argv[1].endsWith("export-cto-signals.ts");

if (isMain) {
  main().catch((err) => {
    console.error(`export-cto-signals failed: ${err.message}`);
    process.exit(1);
  });
}
