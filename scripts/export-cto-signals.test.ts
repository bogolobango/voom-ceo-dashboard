/**
 * Tests for the CTO signals export script. The export script's job is to
 * shape Supabase rows into a snapshot the `kofi` agent can read.
 *
 * We test the shaping function in isolation. Hitting Supabase from CI is
 * out of scope for v1 — the live integration is smoke-tested in Task 5.
 */
import { describe, it, expect } from "vitest";
import { shapeSignals, type RawSignalRows } from "./export-cto-signals.js";

describe("shapeSignals", () => {
  it("computes signup_rate_24h, dormant_count, listing_throughput_24h, and failure rates from raw rows", () => {
    const now = new Date("2026-05-21T12:00:00Z");
    const raw: RawSignalRows = {
      vendors: [
        // Two signed up in last 24h.
        { id: "v1", status: "approved", verified: true, createdAt: new Date("2026-05-21T10:00:00Z"), productCount: 1 },
        { id: "v2", status: "pending", verified: false, createdAt: new Date("2026-05-20T20:00:00Z"), productCount: 0 },
        // One older, dormant (approved + verified + zero products + >14 days old).
        { id: "v3", status: "approved", verified: true, createdAt: new Date("2026-04-01T10:00:00Z"), productCount: 0 },
        // One older, not dormant (has products).
        { id: "v4", status: "approved", verified: true, createdAt: new Date("2026-04-15T10:00:00Z"), productCount: 5 },
      ],
      productsCreated24h: 3,
      whatsappFailures24h: 7,
      paymentFailures24h: 2,
    };

    const out = shapeSignals(raw, now);

    expect(out.snapshot_date).toBe("2026-05-21");
    expect(out.signup_rate_24h).toBe(2);
    expect(out.dormant_count).toBe(1);
    expect(out.listing_throughput_24h).toBe(3);
    expect(out.whatsapp_failures_24h).toBe(7);
    expect(out.payment_failures_24h).toBe(2);
    expect(out.vendor_total).toBe(4);
  });

  it("returns zero counts when raw data is empty", () => {
    const out = shapeSignals(
      {
        vendors: [],
        productsCreated24h: 0,
        whatsappFailures24h: 0,
        paymentFailures24h: 0,
      },
      new Date("2026-05-21T12:00:00Z"),
    );

    expect(out.signup_rate_24h).toBe(0);
    expect(out.dormant_count).toBe(0);
    expect(out.listing_throughput_24h).toBe(0);
    expect(out.vendor_total).toBe(0);
  });
});
