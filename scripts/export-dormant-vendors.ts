/**
 * Exports the dormant-vendor cohort to data/dormant-vendors.json for the
 * `ashley` outreach subagent. Cohort: approved + verified + zero products +
 * approvedAt >= 14 days ago. Schema is the contract defined in
 * docs/specs/2026-05-20-ashley-design.md.
 *
 * Run: pnpm export:dormant-vendors
 * Requires: DATABASE_URL env var.
 */

import { and, eq, lte, sql } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { db } from "../server/db.js";
import { products, vendors } from "../shared/schema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COHORT_DEFINITION =
  "status='approved' AND verified=true AND zero products AND createdAt >= 14 days ago";

async function main() {
  if (!db) {
    console.error(
      "DATABASE_URL not set or db connection unavailable. Aborting.",
    );
    process.exit(1);
  }

  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  // Subquery: vendor IDs that have at least one product. We exclude these.
  const vendorsWithProducts = db
    .select({ vendorId: products.vendorId })
    .from(products);

  const rows = await db
    .select({
      id: vendors.id,
      userId: vendors.userId,
      businessName: vendors.businessName,
      description: vendors.description,
      phone: vendors.phone,
      whatsapp: vendors.whatsapp,
      email: vendors.email,
      city: vendors.city,
      region: vendors.region,
      logoUrl: vendors.logoUrl,
      tier: vendors.tier,
      ghanaCardNumber: vendors.ghanaCardNumber,
      businessRegUrl: vendors.businessRegUrl,
      createdAt: vendors.createdAt,
    })
    .from(vendors)
    .where(
      and(
        eq(vendors.status, "approved"),
        eq(vendors.verified, true),
        lte(vendors.createdAt, cutoff),
        sql`${vendors.id} NOT IN (${vendorsWithProducts})`,
      ),
    );

  const now = Date.now();

  const output = {
    exported_at: new Date().toISOString(),
    cohort_definition: COHORT_DEFINITION,
    vendor_count: rows.length,
    vendors: rows.map((v) => ({
      vendor_id: v.id,
      user_id: v.userId,
      business_name: v.businessName,
      phone: v.phone,
      whatsapp: v.whatsapp,
      email: v.email,
      city: v.city,
      region: v.region,
      approved_at: v.createdAt ? v.createdAt.toISOString() : null,
      days_since_approval: v.createdAt
        ? Math.floor((now - v.createdAt.getTime()) / (24 * 60 * 60 * 1000))
        : null,
      tier: v.tier,
      last_nudge_stage: null,
      ghana_card_provided: Boolean(v.ghanaCardNumber),
      business_reg_provided: Boolean(v.businessRegUrl),
      logo_url_present: Boolean(v.logoUrl),
      description_present: Boolean(v.description && v.description.trim()),
    })),
  };

  const outPath = path.resolve(__dirname, "..", "data", "dormant-vendors.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log(
    `Exported ${rows.length} dormant vendors to ${outPath} (cohort: ${COHORT_DEFINITION})`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Export failed:", err);
    process.exit(1);
  });
