# WhatsApp Inbound Triage Burn-down v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship three small TypeScript helpers (log append, voice audit, report generator) so Jim and Claude can burn down the approximately 80 unread FB-funnel WhatsApp threads in a single session tonight, producing a structured JSONL log and an actionable morning-after report.

**Architecture:** Three pure-function scripts under `scripts/`, each with a thin CLI entry point and a co-located vitest suite. No database, no network, no WhatsApp API. The "agent" is Claude in the live chat following the per-thread protocol from the spec; these scripts give the protocol durable I/O. After Phase A ships, Phase B is a runbook Jim and Claude execute together; Phase C is post-session ops Jim runs the next morning.

**Tech Stack:** TypeScript via tsx, vitest, zod for schema validation, pnpm. Patterns match existing `scripts/export-cto-signals.{ts,test.ts}` in this repo.

**Spec:** `docs/specs/2026-06-05-whatsapp-agentic-system/2026-06-05-inbound-triage-burndown-design.md`. Read it once before starting.

**One refinement vs spec:** the JSONL schema in spec §6 omits the draft text itself; we add a `draft_text` field so Phase A4 (voice audit) can actually inspect drafts. Same for `draft_text_edited` when Jim edits a draft before sending.

---

## File Structure

| Path | Responsibility |
|---|---|
| `scripts/triage-types.ts` | Single source of truth for the `TriageEntry` zod schema + inferred TS type. Imported by every other script. |
| `scripts/triage-log-append.ts` | CLI: reads a JSON object on stdin, validates against schema, appends one line to today's JSONL. Exits non-zero on validation failure so Claude knows to retry. |
| `scripts/triage-log-append.test.ts` | Tests schema validation and append behaviour. |
| `scripts/triage-voice-audit.ts` | CLI: reads a JSONL file, scans every `draft_text` / `draft_text_edited` for banned characters (em-dash, en-dash) and unauthorised emoji. Prints violations to stdout, exits non-zero if any. |
| `scripts/triage-voice-audit.test.ts` | Tests detection of em-dashes, en-dashes, and unauthorised emoji. |
| `scripts/triage-report-gen.ts` | CLI: reads a JSONL file, emits a markdown end-of-session report to stdout. Pure function `renderReport(entries, now): string` is the testable core. |
| `scripts/triage-report-gen.test.ts` | Tests the pure rendering function with a fixture entry set. |
| `data/whatsapp-triage/.gitignore` | Ignores all JSONL + report files (contains real vendor phone numbers). |
| `package.json` | New scripts: `triage:log`, `triage:audit`, `triage:report`. |

---

## Phase A: Pre-flight scripts (TDD)

Build the three helpers before the session starts. Each task is independent and committable.

### Task A1: Create data directory and gitignore

**Files:**
- Create: `data/whatsapp-triage/.gitignore`

- [ ] **Step 1: Create the directory and gitignore**

```bash
mkdir -p ~/voom-ceo-dashboard/data/whatsapp-triage
```

Write `~/voom-ceo-dashboard/data/whatsapp-triage/.gitignore`:

```
# Real vendor phone numbers + message content. Never commit.
*.jsonl
*.md
!.gitignore
```

- [ ] **Step 2: Verify the directory exists and gitignore is respected**

Run:
```bash
cd ~/voom-ceo-dashboard && ls -la data/whatsapp-triage/ && touch data/whatsapp-triage/dummy.jsonl && git status --short data/whatsapp-triage/
```

Expected: `.gitignore` is listed as untracked; `dummy.jsonl` does not appear in `git status`. Then:

```bash
rm ~/voom-ceo-dashboard/data/whatsapp-triage/dummy.jsonl
```

- [ ] **Step 3: Commit**

```bash
cd ~/voom-ceo-dashboard && git add data/whatsapp-triage/.gitignore && git commit -m "feat(triage): add data dir + gitignore for WhatsApp triage logs"
```

---

### Task A2: Define the shared TriageEntry schema

**Files:**
- Create: `scripts/triage-types.ts`
- Create: `scripts/triage-types.test.ts`

- [ ] **Step 1: Write the failing test**

Write `scripts/triage-types.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/voom-ceo-dashboard && pnpm vitest run scripts/triage-types.test.ts`
Expected: FAIL with "Cannot find module './triage-types.js'".

- [ ] **Step 3: Write the schema**

Write `scripts/triage-types.ts`:

```typescript
import { z } from "zod";

export const BUCKETS = [
  "NEW_VENDOR_M2",
  "NEW_VENDOR_M3",
  "NEW_VENDOR_M4",
  "NEW_VENDOR_M5",
  "NEW_VENDOR_FOLLOWUP_D2",
  "BUYER_DISCOVERY",
  "BUYER_BROWSE",
  "BUYER_SPECIFIC_REQUEST",
  "RETURNING_VENDOR",
  "VENDOR_QUESTION",
  "OBJECTION_PRICE",
  "OBJECTION_PAYMENT",
  "OBJECTION_TIME",
  "OBJECTION_TRUST",
  "SPAM_OR_NOISE",
] as const;

export const NEXT_ACTIONS = [
  "MANUAL_LIST_FIRST_PART",
  "SEND_M4_AFTER_LIST",
  "FOLLOWUP_D2",
  "ESCALATE_JUSTICE",
  "ESCALATE_KOFI",
  "NONE",
] as const;

export const STEPS = ["M2", "M3", "M4", "M5", "FOLLOWUP_D2"] as const;
export const OBJECTION_BRANCHES = ["PRICE", "PAYMENT", "TIME", "TRUST"] as const;

export const ExtractedSchema = z.object({
  parts_type: z.string().nullable(),
  shop_name: z.string().nullable(),
  location: z.string().nullable(),
  momo: z.string().nullable(),
  part_for_listing: z.string().nullable(),
  buyer_part_requested: z.string().nullable(),
  buyer_car: z.string().nullable(),
  buyer_region: z.string().nullable(),
});

export const TriageEntrySchema = z.object({
  ts: z.string(),
  thread_id: z.string(),
  sender_name: z.string(),
  bucket: z.enum(BUCKETS),
  step: z.enum(STEPS).nullable(),
  objection_branch: z.enum(OBJECTION_BRANCHES).nullable(),
  extracted: ExtractedSchema,
  draft_text: z.string(),
  draft_text_edited: z.string().nullable(),
  draft_sent: z.boolean(),
  draft_edited_by_jim: z.boolean(),
  next_action: z.enum(NEXT_ACTIONS),
  notes: z.string(),
});

export type TriageEntry = z.infer<typeof TriageEntrySchema>;
export type Bucket = (typeof BUCKETS)[number];
export type NextAction = (typeof NEXT_ACTIONS)[number];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/voom-ceo-dashboard && pnpm vitest run scripts/triage-types.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
cd ~/voom-ceo-dashboard && git add scripts/triage-types.ts scripts/triage-types.test.ts && git commit -m "feat(triage): define TriageEntry zod schema + exported enums"
```

---

### Task A3: Build the log-append CLI

**Files:**
- Create: `scripts/triage-log-append.ts`
- Create: `scripts/triage-log-append.test.ts`
- Modify: `package.json` (add `triage:log` script)

- [ ] **Step 1: Write the failing test**

Write `scripts/triage-log-append.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/voom-ceo-dashboard && pnpm vitest run scripts/triage-log-append.test.ts`
Expected: FAIL with "Cannot find module './triage-log-append.js'".

- [ ] **Step 3: Write the script**

Write `scripts/triage-log-append.ts`:

```typescript
import { appendFileSync } from "node:fs";
import { TriageEntrySchema, type TriageEntry } from "./triage-types.js";

export function appendEntry(entry: TriageEntry, path: string): void {
  const validated = TriageEntrySchema.parse(entry);
  const line = JSON.stringify(validated) + "\n";
  appendFileSync(path, line, "utf8");
}

function todayPath(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `data/whatsapp-triage/${yyyy}-${mm}-${dd}-burndown.jsonl`;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  const raw = await readStdin();
  if (!raw.trim()) {
    console.error("triage-log-append: no JSON on stdin");
    process.exit(2);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error("triage-log-append: invalid JSON on stdin");
    process.exit(2);
  }

  const path = process.argv[2] ?? todayPath();
  try {
    appendEntry(parsed as TriageEntry, path);
  } catch (err) {
    console.error("triage-log-append: schema validation failed");
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(3);
  }

  console.log(`OK ${path}`);
}

const isCli = import.meta.url === `file://${process.argv[1]}`;
if (isCli) {
  void main();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/voom-ceo-dashboard && pnpm vitest run scripts/triage-log-append.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Add the package.json script**

Edit `package.json`, add inside `"scripts": { ... }`:

```json
"triage:log": "tsx scripts/triage-log-append.ts",
```

- [ ] **Step 6: Smoke-test the CLI end to end**

Run:
```bash
cd ~/voom-ceo-dashboard && echo '{"ts":"2026-06-06T01:14:00-04:00","thread_id":"+233244000099","sender_name":"Smoke","bucket":"SPAM_OR_NOISE","step":null,"objection_branch":null,"extracted":{"parts_type":null,"shop_name":null,"location":null,"momo":null,"part_for_listing":null,"buyer_part_requested":null,"buyer_car":null,"buyer_region":null},"draft_text":"","draft_text_edited":null,"draft_sent":false,"draft_edited_by_jim":false,"next_action":"NONE","notes":"smoke test"}' | pnpm triage:log /tmp/smoke.jsonl
```

Expected stdout: `OK /tmp/smoke.jsonl`. Then:

```bash
cat /tmp/smoke.jsonl && rm /tmp/smoke.jsonl
```

Expected: one valid JSON line ending in `\n`.

- [ ] **Step 7: Commit**

```bash
cd ~/voom-ceo-dashboard && git add scripts/triage-log-append.ts scripts/triage-log-append.test.ts package.json && git commit -m "feat(triage): add JSONL append CLI with schema validation"
```

---

### Task A4: Build the voice audit CLI

**Files:**
- Create: `scripts/triage-voice-audit.ts`
- Create: `scripts/triage-voice-audit.test.ts`
- Modify: `package.json` (add `triage:audit` script)

The voice library (Artifact 03) bans em-dash, en-dash, and any emoji outside an authorised set. This script reads a JSONL file and prints any violation.

**Authorised emoji whitelist (must match voice library exactly):** 👋 🚗 ✅ 🎉 📸 🏷️ 💵 📲 🎁 👍 🙏 👌 ✨

- [ ] **Step 1: Write the failing test**

Write `scripts/triage-voice-audit.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/voom-ceo-dashboard && pnpm vitest run scripts/triage-voice-audit.test.ts`
Expected: FAIL with "Cannot find module './triage-voice-audit.js'".

- [ ] **Step 3: Write the script**

Write `scripts/triage-voice-audit.ts`:

```typescript
import { readFileSync } from "node:fs";
import { TriageEntrySchema, type TriageEntry } from "./triage-types.js";

const AUTHORISED_EMOJI = new Set([
  "👋", "🚗", "✅", "🎉", "📸", "🏷️", "💵", "📲", "🎁", "👍", "🙏", "👌", "✨",
]);

const EMOJI_REGEX = /\p{Extended_Pictographic}(?:️)?/gu;

export interface Violation {
  thread_id: string;
  field: "draft_text" | "draft_text_edited";
  reason: string;
  snippet: string;
}

function scanText(text: string, thread_id: string, field: Violation["field"]): Violation[] {
  const out: Violation[] = [];
  if (text.includes("—")) {
    out.push({ thread_id, field, reason: "em-dash (—) is banned", snippet: text });
  }
  if (text.includes("–")) {
    out.push({ thread_id, field, reason: "en-dash (–) is banned", snippet: text });
  }
  const matches = text.match(EMOJI_REGEX) ?? [];
  for (const emoji of matches) {
    if (!AUTHORISED_EMOJI.has(emoji)) {
      out.push({
        thread_id,
        field,
        reason: `unauthorised emoji: ${emoji}`,
        snippet: text,
      });
    }
  }
  return out;
}

export function auditEntries(entries: TriageEntry[]): Violation[] {
  const violations: Violation[] = [];
  for (const entry of entries) {
    if (entry.draft_text && entry.draft_sent !== false) {
      violations.push(...scanText(entry.draft_text, entry.thread_id, "draft_text"));
    } else if (entry.draft_text) {
      violations.push(...scanText(entry.draft_text, entry.thread_id, "draft_text"));
    }
    if (entry.draft_text_edited) {
      violations.push(...scanText(entry.draft_text_edited, entry.thread_id, "draft_text_edited"));
    }
  }
  return violations;
}

function loadJsonl(path: string): TriageEntry[] {
  const raw = readFileSync(path, "utf8");
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  return lines.map((line) => TriageEntrySchema.parse(JSON.parse(line)));
}

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error("triage-voice-audit: usage: tsx triage-voice-audit.ts <path-to-jsonl>");
    process.exit(2);
  }
  const entries = loadJsonl(path);
  const violations = auditEntries(entries);
  if (violations.length === 0) {
    console.log(`OK ${entries.length} entries, no voice violations`);
    return;
  }
  for (const v of violations) {
    console.error(`[${v.thread_id}] ${v.field}: ${v.reason}`);
    console.error(`  snippet: ${v.snippet}`);
  }
  console.error(`${violations.length} violation(s) across ${entries.length} entries`);
  process.exit(1);
}

const isCli = import.meta.url === `file://${process.argv[1]}`;
if (isCli) {
  void main();
}
```

Note: the empty-skipped-draft test passes because `entry.draft_text` is an empty string (falsy), so the first `if` is skipped. The second branch handles the case where draft_text is non-empty but `draft_sent` happens to be false (e.g. Jim chose `skip` after Claude drafted). Either way, dashes/emoji get audited if the text is non-empty.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/voom-ceo-dashboard && pnpm vitest run scripts/triage-voice-audit.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Add the package.json script**

Edit `package.json`, add:

```json
"triage:audit": "tsx scripts/triage-voice-audit.ts",
```

- [ ] **Step 6: Commit**

```bash
cd ~/voom-ceo-dashboard && git add scripts/triage-voice-audit.ts scripts/triage-voice-audit.test.ts package.json && git commit -m "feat(triage): add voice audit CLI (em-dash + emoji whitelist)"
```

---

### Task A5: Build the report generator CLI

**Files:**
- Create: `scripts/triage-report-gen.ts`
- Create: `scripts/triage-report-gen.test.ts`
- Modify: `package.json` (add `triage:report` script)

The report is the morning-after artifact. Spec §6 defines 8 sections. The pure function `renderReport` does the work; the CLI is thin.

- [ ] **Step 1: Write the failing test**

Write `scripts/triage-report-gen.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/voom-ceo-dashboard && pnpm vitest run scripts/triage-report-gen.test.ts`
Expected: FAIL with "Cannot find module './triage-report-gen.js'".

- [ ] **Step 3: Write the script**

Write `scripts/triage-report-gen.ts`:

```typescript
import { readFileSync } from "node:fs";
import { TriageEntrySchema, type TriageEntry, BUCKETS } from "./triage-types.js";

const FOLLOWUP_TEMPLATE = (name: string) =>
  `Hi ${name} 👋 Still happy to set up your shop free whenever you're ready, takes me 2 minutes. Just send me one part photo + price and I'll put it live so you can see how it works. 🚗`;

function fmtDuration(ms: number): string {
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function bucketTable(entries: TriageEntry[]): string {
  const counts = new Map<string, number>();
  for (const b of BUCKETS) counts.set(b, 0);
  for (const e of entries) counts.set(e.bucket, (counts.get(e.bucket) ?? 0) + 1);
  const total = entries.length || 1;
  const rows = [...counts.entries()]
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([bucket, n]) => `| ${bucket} | ${n} | ${Math.round((n / total) * 100)}% |`)
    .join("\n");
  return `| Bucket | Count | Share |\n|---|---|---|\n${rows}`;
}

function funnelSection(entries: TriageEntry[]): string {
  const m2 = entries.filter((e) => e.step === "M2").length;
  const m3 = entries.filter((e) => e.step === "M3").length;
  const m4 = entries.filter((e) => e.step === "M4").length;
  return `- M2: ${m2}\n- M3: ${m3}\n- M4: ${m4}`;
}

function manualListingQueue(entries: TriageEntry[]): string {
  const items = entries.filter((e) => e.next_action === "MANUAL_LIST_FIRST_PART");
  if (items.length === 0) return "";
  const rows = items
    .map(
      (e) =>
        `- [ ] **${e.extracted.shop_name ?? e.sender_name}** (${e.extracted.location ?? "location TBD"})\n` +
        `  - parts: ${e.extracted.parts_type ?? "TBD"}\n` +
        `  - MoMo: ${e.extracted.momo ?? "TBD"}\n` +
        `  - first part: ${e.extracted.part_for_listing ?? "TBD"}\n` +
        `  - thread: ${e.thread_id}`,
    )
    .join("\n");
  return `\n## Manual listing queue\n\n${rows}\n`;
}

function followupSection(entries: TriageEntry[]): string {
  const items = entries.filter((e) => e.next_action === "FOLLOWUP_D2");
  if (items.length === 0) return "";
  const rows = items
    .map(
      (e) =>
        `- [ ] **${e.sender_name}** (${e.thread_id})\n\n  > ${FOLLOWUP_TEMPLATE(e.sender_name)}\n`,
    )
    .join("\n");
  return `\n## Tomorrow's follow-ups\n\n${rows}\n`;
}

function escalations(entries: TriageEntry[]): string {
  const justice = entries.filter((e) => e.next_action === "ESCALATE_JUSTICE");
  const kofi = entries.filter((e) => e.next_action === "ESCALATE_KOFI");
  let out = "";
  if (justice.length > 0) {
    out += `\n## Escalate to Justice\n\n`;
    out += justice.map((e) => `- ${e.sender_name} (${e.thread_id}): ${e.notes || "vendor question"}`).join("\n") + "\n";
  }
  if (kofi.length > 0) {
    out += `\n## Escalate to Kofi\n\n`;
    out += kofi.map((e) => `- ${e.sender_name} (${e.thread_id}): ${e.notes || "re-auth pattern"}`).join("\n") + "\n";
  }
  return out;
}

function topBuyerRequests(entries: TriageEntry[]): string {
  const requests = entries
    .filter((e) => e.bucket === "BUYER_SPECIFIC_REQUEST" && e.extracted.buyer_part_requested)
    .map((e) => e.extracted.buyer_part_requested!);
  if (requests.length === 0) return "";
  const counts = new Map<string, number>();
  for (const r of requests) counts.set(r, (counts.get(r) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const rows = top.map(([part, n]) => `- ${part}: ${n}`).join("\n");
  return `\n## Top buyer requests\n\n${rows}\n`;
}

export function renderReport(entries: TriageEntry[], now: Date): string {
  const sorted = [...entries].sort((a, b) => a.ts.localeCompare(b.ts));
  const first = sorted[0];
  const durationMs = first ? now.getTime() - new Date(first.ts).getTime() : 0;
  const duration = first ? fmtDuration(durationMs) : "0m";

  let md = `# WhatsApp Triage Burndown Report\n\n`;
  md += `Generated: ${now.toISOString()}\n\n`;
  md += `## Headline\n\n`;
  md += `- Total threads processed: **${entries.length}**\n`;
  md += `- Session duration: **${duration}**\n`;
  md += `- Drafts sent: ${entries.filter((e) => e.draft_sent).length}\n`;
  md += `- Drafts edited by Jim: ${entries.filter((e) => e.draft_edited_by_jim).length}\n`;

  if (entries.length === 0) return md;

  md += `\n## Bucket distribution\n\n${bucketTable(entries)}\n`;
  md += `\n## Funnel dropoff (NEW_VENDOR steps)\n\n${funnelSection(entries)}\n`;
  md += manualListingQueue(entries);
  md += followupSection(entries);
  md += escalations(entries);
  md += topBuyerRequests(entries);

  return md;
}

function loadJsonl(path: string): TriageEntry[] {
  const raw = readFileSync(path, "utf8");
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  return lines.map((line) => TriageEntrySchema.parse(JSON.parse(line)));
}

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error("triage-report-gen: usage: tsx triage-report-gen.ts <path-to-jsonl>");
    process.exit(2);
  }
  const entries = loadJsonl(path);
  const md = renderReport(entries, new Date());
  process.stdout.write(md);
}

const isCli = import.meta.url === `file://${process.argv[1]}`;
if (isCli) {
  void main();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/voom-ceo-dashboard && pnpm vitest run scripts/triage-report-gen.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Add the package.json script**

Edit `package.json`, add:

```json
"triage:report": "tsx scripts/triage-report-gen.ts",
```

- [ ] **Step 6: Smoke-test end to end**

Run:
```bash
cd ~/voom-ceo-dashboard && pnpm triage:report data/whatsapp-triage/2026-06-06-burndown.jsonl 2>/dev/null || echo "(expected: file not found, will exist after the session)"
```

Expected: either a stub report (if you appended via Task A3 smoke test to today's path) or the "expected: file not found" line.

- [ ] **Step 7: Commit**

```bash
cd ~/voom-ceo-dashboard && git add scripts/triage-report-gen.ts scripts/triage-report-gen.test.ts package.json && git commit -m "feat(triage): add markdown report generator (bucket dist + funnel + queues)"
```

---

### Task A6: Run the full Phase A test suite

**Files:** none modified

- [ ] **Step 1: Run all triage tests together**

Run: `cd ~/voom-ceo-dashboard && pnpm vitest run scripts/triage`
Expected: 4 test files, all passing. Count: 24 tests across schema (5), append (4), audit (7), report (8).

- [ ] **Step 2: Run the existing repo test suite as a regression check**

Run: `cd ~/voom-ceo-dashboard && pnpm test:scripts`
Expected: every pre-existing script test continues to pass. No new failures.

- [ ] **Step 3: Tag Phase A complete**

```bash
cd ~/voom-ceo-dashboard && git log --oneline -6
```

Expected: see the six commits from A1 through A5 plus this tagging point. If anything's missing, address it before moving to Phase B.

---

## Phase B: Session runbook (Jim + Claude execute together)

Not agent-executable. This is what Jim and Claude do in chat once Phase A is committed.

### B1. Session start

Jim:
1. Opens WhatsApp Web in one window.
2. Opens this Claude Code session in another window.
3. Says in chat: `triage session start`.

Claude on `triage session start`:
1. Verifies Phase A scripts are present: runs `cd ~/voom-ceo-dashboard && ls scripts/triage-*.ts`. Expects 6 files (3 scripts + 3 tests + types module).
2. Confirms today's JSONL path: `data/whatsapp-triage/2026-06-06-burndown.jsonl`.
3. Tells Jim: "Ready. Paste the first thread."

### B2. Per-thread loop

For each thread Jim pastes, Claude:
1. Classifies per spec §5 taxonomy. Surfaces ambiguity rather than forcing.
2. Drafts a reply anchored to Artifact 03 (voice library). Hard checks: no em-dash, no en-dash, only authorised emoji, no invented numbers.
3. Returns the structured response from spec §4 step 3 (CLASS / STEP / OBJECTION / EXTRACTED / DRAFT / ACTION / LOG).
4. Waits for Jim's `sent` / `skip` / `edited <pasted-edit>` confirmation.
5. Runs the append CLI via Bash:
   ```bash
   cd ~/voom-ceo-dashboard && echo '<json>' | pnpm triage:log
   ```
   If the append CLI exits non-zero (schema validation), Claude does NOT move on, instead corrects the entry and retries.
6. Tells Jim: "logged, next thread".

### B3. Calibration → batching switch

After thread 5, Claude says: "Calibration done. Ready to batch 3 to 5 threads at a time?" Jim opts in or stays synchronous. Batching means Jim pastes multiple threads in one message and Claude returns multiple structured blocks plus multiple Bash append calls.

### B4. End-of-session

Jim says `done`. Claude:
1. Runs voice audit: `cd ~/voom-ceo-dashboard && pnpm triage:audit data/whatsapp-triage/2026-06-06-burndown.jsonl`. Surfaces any violations to Jim. If violations exist, Jim decides whether to re-send the affected reply with a clean draft.
2. Generates the report: `cd ~/voom-ceo-dashboard && pnpm triage:report data/whatsapp-triage/2026-06-06-burndown.jsonl > data/whatsapp-triage/2026-06-06-burndown-report.md`.
3. Reads the report back and walks Jim through it section by section.
4. Proposes memory writes for anything worth remembering (top buyer parts, recurring objections, re-auth patterns surfaced to Kofi, etc.).

---

## Phase C: Post-session ops (Jim, next morning)

1. Open the morning-after report at `~/voom-ceo-dashboard/data/whatsapp-triage/2026-06-06-burndown-report.md`.
2. Work the manual listing queue: for each vendor, create their VOOM shop + first listing manually, then trigger Claude with `send M4 to <thread_id> with shop link <url>` so Claude drafts the Message 4 reply for Jim to paste.
3. Work the follow-up queue: for each `FOLLOWUP_D2` vendor, paste the pre-drafted message into WhatsApp Web.
4. Send escalations to Justice (vendor questions) and Kofi (re-auth pattern surfacing) via their preferred channels.
5. Decide which strategy patterns from the report feed the next slice (durable bridge, lifecycle messaging, request routing).

---

## Self-Review

Done inline.

**Spec coverage:**
- Spec §1 (why) → covered by intro.
- Spec §2 (goals/non-goals) → Phase A delivers data infra; Phase B is the session; non-goals (bridge, auto-send, lifecycle) explicitly absent. ✓
- Spec §3 (architecture) → Phase A scripts ARE the architecture. ✓
- Spec §4 (workflow loop) → Phase B per-thread loop matches step-by-step. ✓
- Spec §5 (taxonomy) → encoded in `BUCKETS` enum (Task A2) and used by audit + report. ✓
- Spec §6 (data capture) → Tasks A2-A5 implement the JSONL schema, audit, and report. One refinement: added `draft_text` and `draft_text_edited` fields not in spec §6. Flagged at top of plan. ✓
- Spec §7 (voice + hard rules) → Task A4 voice audit enforces. ✓
- Spec §8 (success criteria) → Phase B4 walks the report through; criteria met by report contents. ✓
- Spec §9 (risks) → mitigations baked in (synchronous calibration, ambiguity protocol, audit-before-report, JSONL atomicity via appendFileSync). ✓
- Spec §10-12 (next slices, paths, deferred) → Phase A produces the data tomorrow's slices consume. ✓

**Placeholder scan:** no TBD / TODO / "implement later" in the plan. Every test has real assertions; every script step has the full source. ✓

**Type consistency:** `appendEntry(entry, path)`, `auditEntries(entries)`, `renderReport(entries, now)` consistent across tasks. `TriageEntry` and `Violation` names stable. ✓
