import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, readFileSync, existsSync, rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendEntry } from "./triage-log-append.js";
import type { TriageEntry } from "./triage-types.js";

const ENTRY: TriageEntry = {
  ts: "2026-06-06T01:14:00-04:00",
  thread_id: "+233244000001",
  sender_name: "Kwame",
  bucket: "NEW_VENDOR_M2",
  step: "M2",
  objection_branch: null,
  extracted: {
    parts_type: "brake pads",
    shop_name: null,
    location: null,
    momo: null,
    part_for_listing: null,
    buyer_part_requested: null,
    buyer_car: null,
    buyer_region: null,
  },
  draft_text: "Perfect, brake pads move fast on VOOM. 👌",
  draft_text_edited: null,
  draft_sent: true,
  draft_edited_by_jim: false,
  next_action: "NONE",
  notes: "",
};

describe("appendEntry", () => {
  let dir: string;
  let path: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "triage-test-"));
    path = join(dir, "burndown.jsonl");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("creates the file and writes one line on first append", () => {
    appendEntry(ENTRY, path);
    expect(existsSync(path)).toBe(true);
    const lines = readFileSync(path, "utf8").trim().split("\n");
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]).bucket).toBe("NEW_VENDOR_M2");
  });

  it("appends without overwriting existing entries", () => {
    appendEntry(ENTRY, path);
    appendEntry({ ...ENTRY, thread_id: "+233244000002" }, path);
    const lines = readFileSync(path, "utf8").trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[1]).thread_id).toBe("+233244000002");
  });

  it("each line is valid JSON with a trailing newline", () => {
    appendEntry(ENTRY, path);
    const raw = readFileSync(path, "utf8");
    expect(raw.endsWith("\n")).toBe(true);
    expect(() => JSON.parse(raw.trim())).not.toThrow();
  });

  it("rejects an entry that fails schema validation", () => {
    const bad = { ...ENTRY, bucket: "NOPE" as unknown } as TriageEntry;
    expect(() => appendEntry(bad, path)).toThrow();
    expect(existsSync(path)).toBe(false);
  });
});
