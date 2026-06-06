import { describe, it, expect } from "vitest";
import { auditEntries, type Violation } from "./triage-voice-audit.js";
import type { TriageEntry } from "./triage-types.js";

const BASE: TriageEntry = {
  ts: "2026-06-06T01:14:00-04:00",
  thread_id: "+233244000001",
  sender_name: "Kwame",
  bucket: "NEW_VENDOR_M2",
  step: "M2",
  objection_branch: null,
  extracted: {
    parts_type: "brake pads",
    shop_name: null, location: null, momo: null, part_for_listing: null,
    buyer_part_requested: null, buyer_car: null, buyer_region: null,
  },
  draft_text: "Perfect, brake pads move fast 👌",
  draft_text_edited: null,
  draft_sent: true,
  draft_edited_by_jim: false,
  next_action: "NONE",
  notes: "",
};

describe("auditEntries", () => {
  it("returns no violations for a clean draft", () => {
    expect(auditEntries([BASE])).toEqual([]);
  });

  it("flags em-dashes in draft_text", () => {
    const bad = { ...BASE, draft_text: "Perfect — brake pads move fast 👌" };
    const v: Violation[] = auditEntries([bad]);
    expect(v).toHaveLength(1);
    expect(v[0].reason).toMatch(/em-dash/);
    expect(v[0].thread_id).toBe(BASE.thread_id);
  });

  it("flags en-dashes in draft_text", () => {
    const bad = { ...BASE, draft_text: "Perfect – brake pads 👌" };
    expect(auditEntries([bad])[0].reason).toMatch(/en-dash/);
  });

  it("flags unauthorised emoji", () => {
    const bad = { ...BASE, draft_text: "Perfect 🔥 brake pads" };
    const v = auditEntries([bad]);
    expect(v).toHaveLength(1);
    expect(v[0].reason).toMatch(/unauthorised emoji.*🔥/);
  });

  it("allows every authorised emoji", () => {
    const allowed = "👋 🚗 ✅ 🎉 📸 🏷️ 💵 📲 🎁 👍 🙏 👌 ✨";
    expect(auditEntries([{ ...BASE, draft_text: allowed }])).toEqual([]);
  });

  it("also audits draft_text_edited when set", () => {
    const bad = { ...BASE, draft_text_edited: "Perfect — edited" };
    expect(auditEntries([bad])[0].reason).toMatch(/em-dash/);
  });

  it("ignores draft_text when entry was skipped (draft_sent=false and empty draft_text)", () => {
    const skipped = { ...BASE, draft_text: "", draft_sent: false };
    expect(auditEntries([skipped])).toEqual([]);
  });
});
