import { describe, it, expect } from "vitest";
import { renderReport } from "./triage-report-gen.js";
import type { TriageEntry } from "./triage-types.js";

function mk(partial: Partial<TriageEntry>): TriageEntry {
  return {
    ts: "2026-06-06T01:14:00-04:00",
    thread_id: "+233244000000",
    sender_name: "Test",
    bucket: "SPAM_OR_NOISE",
    step: null,
    objection_branch: null,
    extracted: {
      parts_type: null, shop_name: null, location: null, momo: null,
      part_for_listing: null, buyer_part_requested: null, buyer_car: null, buyer_region: null,
    },
    draft_text: "",
    draft_text_edited: null,
    draft_sent: false,
    draft_edited_by_jim: false,
    next_action: "NONE",
    notes: "",
    ...partial,
  };
}

const NOW = new Date("2026-06-06T03:00:00-04:00");

describe("renderReport", () => {
  it("renders headline stats including total + duration", () => {
    const entries = [
      mk({ ts: "2026-06-06T01:00:00-04:00", thread_id: "+1" }),
      mk({ ts: "2026-06-06T02:30:00-04:00", thread_id: "+2" }),
    ];
    const md = renderReport(entries, NOW);
    expect(md).toMatch(/Total threads processed: \*\*2\*\*/);
    expect(md).toMatch(/Session duration: \*\*1h 30m\*\*/);
  });

  it("counts bucket distribution", () => {
    const entries = [
      mk({ bucket: "NEW_VENDOR_M2", thread_id: "+1" }),
      mk({ bucket: "NEW_VENDOR_M2", thread_id: "+2" }),
      mk({ bucket: "BUYER_BROWSE", thread_id: "+3" }),
    ];
    const md = renderReport(entries, NOW);
    expect(md).toMatch(/NEW_VENDOR_M2.*\|.*2/);
    expect(md).toMatch(/BUYER_BROWSE.*\|.*1/);
  });

  it("computes funnel dropoff at M2, M3, M4", () => {
    const entries = [
      mk({ bucket: "NEW_VENDOR_M2", step: "M2", thread_id: "+1" }),
      mk({ bucket: "NEW_VENDOR_M2", step: "M2", thread_id: "+2" }),
      mk({ bucket: "NEW_VENDOR_M3", step: "M3", thread_id: "+3" }),
      mk({ bucket: "NEW_VENDOR_M4", step: "M4", thread_id: "+4" }),
    ];
    const md = renderReport(entries, NOW);
    expect(md).toMatch(/M2: 2/);
    expect(md).toMatch(/M3: 1/);
    expect(md).toMatch(/M4: 1/);
  });

  it("lists the manual-listing queue with extracted shop details", () => {
    const entries = [
      mk({
        bucket: "NEW_VENDOR_M4",
        next_action: "MANUAL_LIST_FIRST_PART",
        sender_name: "Kwame",
        thread_id: "+233244000001",
        extracted: {
          parts_type: "brake pads", shop_name: "Kwame Auto",
          location: "Abossey Okai", momo: "0244000001",
          part_for_listing: "Toyota Corolla brake pad GH¢200",
          buyer_part_requested: null, buyer_car: null, buyer_region: null,
        },
      }),
    ];
    const md = renderReport(entries, NOW);
    expect(md).toMatch(/Manual listing queue/);
    expect(md).toMatch(/Kwame Auto/);
    expect(md).toMatch(/Abossey Okai/);
    expect(md).toMatch(/Toyota Corolla brake pad GH¢200/);
  });

  it("lists FOLLOWUP_D2 vendors with pre-drafted message", () => {
    const entries = [
      mk({
        bucket: "NEW_VENDOR_FOLLOWUP_D2",
        next_action: "FOLLOWUP_D2",
        sender_name: "Akua",
        thread_id: "+233244000002",
      }),
    ];
    const md = renderReport(entries, NOW);
    expect(md).toMatch(/Tomorrow.*follow-ups/i);
    expect(md).toMatch(/Akua/);
    expect(md).toMatch(/Still happy to set up your shop free/);
  });

  it("groups escalations by Justice vs Kofi", () => {
    const entries = [
      mk({ next_action: "ESCALATE_JUSTICE", sender_name: "Ama", thread_id: "+1" }),
      mk({ next_action: "ESCALATE_KOFI", sender_name: "Kojo", thread_id: "+2" }),
    ];
    const md = renderReport(entries, NOW);
    expect(md).toMatch(/Escalate to Justice/);
    expect(md).toMatch(/Ama/);
    expect(md).toMatch(/Escalate to Kofi/);
    expect(md).toMatch(/Kojo/);
  });

  it("surfaces top buyer part requests", () => {
    const entries = [
      mk({
        bucket: "BUYER_SPECIFIC_REQUEST",
        thread_id: "+1",
        extracted: {
          parts_type: null, shop_name: null, location: null, momo: null,
          part_for_listing: null,
          buyer_part_requested: "Honda Civic headlight",
          buyer_car: "Honda Civic 2010",
          buyer_region: "Accra",
        },
      }),
      mk({
        bucket: "BUYER_SPECIFIC_REQUEST",
        thread_id: "+2",
        extracted: {
          parts_type: null, shop_name: null, location: null, momo: null,
          part_for_listing: null,
          buyer_part_requested: "Honda Civic headlight",
          buyer_car: "Honda Civic 2012",
          buyer_region: "Accra",
        },
      }),
    ];
    const md = renderReport(entries, NOW);
    expect(md).toMatch(/Top buyer requests/);
    expect(md).toMatch(/Honda Civic headlight.*2/);
  });

  it("returns an empty-state report when no entries", () => {
    const md = renderReport([], NOW);
    expect(md).toMatch(/Total threads processed: \*\*0\*\*/);
    expect(md).not.toMatch(/Manual listing queue/);
  });
});
