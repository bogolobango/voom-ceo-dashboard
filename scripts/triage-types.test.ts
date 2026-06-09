import { describe, it, expect } from "vitest";
import { TriageEntrySchema, type TriageEntry } from "./triage-types.js";

describe("TriageEntrySchema", () => {
  const valid: TriageEntry = {
    ts: "2026-06-06T01:14:00-04:00",
    thread_id: "+233244000001",
    sender_name: "Kwame",
    bucket: "NEW_VENDOR_M3",
    step: "M3",
    objection_branch: null,
    extracted: {
      parts_type: "brake pads",
      shop_name: "Kwame Auto",
      location: "Abossey Okai",
      momo: "0244000001",
      part_for_listing: null,
      buyer_part_requested: null,
      buyer_car: null,
      buyer_region: null,
    },
    draft_text: "Got it, setting up Kwame Auto now. ✅",
    draft_text_edited: null,
    draft_sent: true,
    draft_edited_by_jim: false,
    next_action: "MANUAL_LIST_FIRST_PART",
    notes: "",
  };

  it("parses a well-formed entry", () => {
    const parsed = TriageEntrySchema.parse(valid);
    expect(parsed.bucket).toBe("NEW_VENDOR_M3");
  });

  it("rejects an unknown bucket", () => {
    const bad = { ...valid, bucket: "MADE_UP_BUCKET" };
    expect(() => TriageEntrySchema.parse(bad)).toThrow();
  });

  it("rejects an unknown next_action", () => {
    const bad = { ...valid, next_action: "DO_THE_THING" };
    expect(() => TriageEntrySchema.parse(bad)).toThrow();
  });

  it("allows null step for non-vendor buckets", () => {
    const buyer = {
      ...valid,
      bucket: "BUYER_SPECIFIC_REQUEST" as const,
      step: null,
      extracted: {
        ...valid.extracted,
        shop_name: null,
        location: null,
        momo: null,
        buyer_part_requested: "Honda Civic 2010 headlight",
        buyer_region: "Accra",
      },
    };
    expect(() => TriageEntrySchema.parse(buyer)).not.toThrow();
  });

  it("requires draft_text even when draft was skipped", () => {
    const skipped = { ...valid, draft_text: "", draft_sent: false };
    const parsed = TriageEntrySchema.parse(skipped);
    expect(parsed.draft_sent).toBe(false);
  });
});
