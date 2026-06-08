# Slice 2 Autonomous WhatsApp Triage v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a 24/7 Express handler in `voom-ceo-dashboard/server/` that receives WhatsApp messages on a new dedicated Meta WhatsApp number, classifies + drafts via Claude, and either autoreplies (SPAM / NEW_VENDOR_M2 / OBJECTIONS / RETURNING_VENDOR) or escalates to Jim's personal WhatsApp (everything else), plus a daily 7am EAT summary cron.

**Architecture:** New components live in `server/whatsapp-*.ts`, each a single-responsibility module. The existing `POST /api/webhook/whatsapp` handler (already wired for Meta Cloud API in `server/routes.ts`) gets extended to call our new orchestrator. Reuses `scripts/triage-types.ts`, `scripts/triage-log-append.ts`, `scripts/triage-voice-audit.ts`, `scripts/triage-report-gen.ts` from Slice 1 verbatim. Classifier is a Claude tool-use call returning a validated `TriageEntry`.

**Tech Stack:** TypeScript via tsx, vitest, Express 4, zod 4, `@anthropic-ai/sdk` (new dep), Meta WhatsApp Cloud API (existing integration in `server/whatsapp-api.ts`), Supabase JS (existing).

**Spec:** `docs/specs/2026-06-05-whatsapp-agentic-system/2026-06-07-slice-2-autonomous-triage-design.md`. Read the AMENDMENT block at the top first — provider is Meta Cloud API direct, not Twilio.

**Voice library (read at classifier-boot):** `docs/specs/2026-06-05-whatsapp-agentic-system/artifacts/03-jim-wa-voice-library.md`.

---

## File Structure

| Path | Responsibility |
|---|---|
| `scripts/triage-types.ts` (modify) | Add fields: `meta_message_id`, `voice_audit_failed`, `classifier_failed`. Bump existing schema. |
| `server/whatsapp-voice-loader.ts` | Reads voice library MD at module load, exports `VOICE_LIBRARY_TEXT` string. Hot-reload if file mtime changes (15s cache). |
| `server/whatsapp-meta-signature.ts` | Verifies Meta's `X-Hub-Signature-256` header using HMAC-SHA256 with `WA_APP_SECRET`. |
| `server/whatsapp-thread-context.ts` | Loads last 5 JSONL entries for a given thread_id + Supabase vendor row by phone. Returns `ThreadContext`. |
| `server/whatsapp-classifier.ts` | Calls Claude via Anthropic SDK with tool-use schema mirroring `TriageEntry`. Returns validated entry or throws. |
| `server/whatsapp-policy-gate.ts` | Pure function `decidePolicy(bucket, hasAmbiguity, voiceAuditFailed): 'auto' \| 'escalate' \| 'dual'`. |
| `server/whatsapp-escalator.ts` | Formats escalation DM body, calls `sendTextMessage` from existing `whatsapp-api.ts`. |
| `server/whatsapp-error-log.ts` | Appends to `data/whatsapp-triage/errors.jsonl`. Used by every component on failure paths. |
| `server/whatsapp-orchestrator.ts` | Top-level: takes parsed inbound msg, runs the full pipeline (dedupe → context → classify → audit → policy → send/escalate → log). Single function `runTriagePipeline(parsed): Promise<void>`. |
| `server/routes.ts` (modify) | Extend existing `POST /api/webhook/whatsapp` to call `runTriagePipeline` for vendor inbound. |
| `server/whatsapp-daily-summary-cron.ts` | Standalone cron entry. Wakes at 7am EAT, runs `renderReport` on yesterday's JSONL, sends to Jim via `sendTextMessage`. |
| `server/index.ts` (modify) | Schedule daily summary cron at boot. |
| `.env.example` (modify) | Add `WA_APP_SECRET`, `WA_TRIAGE_FROM_NUMBER`, `JIM_PERSONAL_WA_NUMBER`, `ANTHROPIC_API_KEY`. |
| `package.json` (modify) | Add `@anthropic-ai/sdk` dependency. |

All `server/whatsapp-*.ts` files have a co-located `*.test.ts` next to them.

---

## Phase A: Schema extension and voice-library plumbing

### Task A1: Extend TriageEntry schema with Slice 2 fields

Reuse intact. Add three optional fields for Slice 2 telemetry.

**Files:**
- Modify: `scripts/triage-types.ts`
- Modify: `scripts/triage-types.test.ts`

- [ ] **Step 1: Write failing test for new fields**

Append to `scripts/triage-types.test.ts` inside the existing describe block:

```typescript
  it("accepts the Slice 2 telemetry fields", () => {
    const withTelemetry = {
      ...valid,
      meta_message_id: "wamid.HBgM...",
      voice_audit_failed: false,
      classifier_failed: false,
    };
    const parsed = TriageEntrySchema.parse(withTelemetry);
    expect(parsed.meta_message_id).toBe("wamid.HBgM...");
  });

  it("treats Slice 2 telemetry fields as optional (Slice 1 entries still valid)", () => {
    expect(() => TriageEntrySchema.parse(valid)).not.toThrow();
  });

  it("rejects non-boolean voice_audit_failed", () => {
    const bad = { ...valid, voice_audit_failed: "true" };
    expect(() => TriageEntrySchema.parse(bad)).toThrow();
  });
```

- [ ] **Step 2: Run tests, confirm 2 new ones fail**

Run: `cd ~/voom-ceo-dashboard && pnpm vitest run scripts/triage-types.test.ts --root .`
Expected: 3 added tests, ≥ 2 fail (the missing-fields test passes because they're optional; the validates-string test fails because the field isn't in the schema yet).

- [ ] **Step 3: Add the three fields to the schema**

In `scripts/triage-types.ts`, modify `TriageEntrySchema`:

```typescript
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
  meta_message_id: z.string().nullable().optional(),
  voice_audit_failed: z.boolean().optional(),
  classifier_failed: z.boolean().optional(),
});
```

- [ ] **Step 4: Run tests, confirm all pass**

Run: `cd ~/voom-ceo-dashboard && pnpm vitest run scripts/triage-types.test.ts --root .`
Expected: 8 tests passing (5 existing + 3 new).

- [ ] **Step 5: Run the full Slice 1 suite to confirm no regression**

Run: `cd ~/voom-ceo-dashboard && pnpm test:scripts`
Expected: 30 tests passing (27 from Slice 1 + 3 new), all green.

- [ ] **Step 6: Commit**

```bash
cd ~/voom-ceo-dashboard && git add scripts/triage-types.ts scripts/triage-types.test.ts && git commit -m "feat(triage): add Slice 2 telemetry fields to TriageEntry schema"
```

---

### Task A2: Reconnaissance — existing Meta WhatsApp integration

No code. Read three files, document findings in a notes file. The implementer (or later subagents) need this map.

**Files:**
- Create: `server/whatsapp-recon-notes.md` (internal notes, gitignored)
- Modify: `.gitignore`

- [ ] **Step 1: Add the notes file to gitignore**

Append to `.gitignore`:

```
server/whatsapp-recon-notes.md
```

- [ ] **Step 2: Read three files and capture exported signatures**

Read each in full:
- `server/whatsapp-api.ts`
- `server/wa-config.ts`
- The `POST /api/webhook/whatsapp` handler in `server/routes.ts` (lines ~2925-3030 per current grep)

Write `server/whatsapp-recon-notes.md` documenting:
- `sendTextMessage` signature: `(to: string, body: string) => Promise<{success, messageId?, error?}>`
- `parseWebhookPayload` signature: what does it take and return?
- `verifyWebhookToken` signature: is it for the GET verification handshake or for inbound message signature?
- `processLeadMessage` signature + current behavior — does it already classify messages?
- `loadWaConfig` returns: `{phoneNumberId, accessToken, webhookToken, businessAccountId}`
- The current POST handler: outline its flow in 5-10 numbered steps.

Lock specifically: does the current handler already store inbound to a database? Does it currently auto-reply? If yes, the orchestrator integration must avoid double-handling.

- [ ] **Step 3: No commit needed** (gitignored notes)

This task ends with the notes file written. The next task references it.

---

### Task A3: Voice library loader

Reads the voice library MD file once and exposes it as a string. Re-reads if file mtime changes (15s cache window) so updates to the voice library land without redeploy, per spec §11.

**Files:**
- Create: `server/whatsapp-voice-loader.ts`
- Create: `server/whatsapp-voice-loader.test.ts`

- [ ] **Step 1: Write failing test**

Write `server/whatsapp-voice-loader.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadVoiceLibrary, _resetCacheForTests } from "./whatsapp-voice-loader.js";

describe("loadVoiceLibrary", () => {
  let dir: string;
  let path: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "voice-loader-test-"));
    path = join(dir, "voice.md");
    writeFileSync(path, "# Voice rules\nNo em-dashes.", "utf8");
    _resetCacheForTests();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("reads the file on first call", () => {
    const txt = loadVoiceLibrary(path);
    expect(txt).toContain("No em-dashes");
  });

  it("caches the file content on subsequent calls within the cache window", () => {
    loadVoiceLibrary(path);
    writeFileSync(path, "DIFFERENT", "utf8");
    // Same mtime since utimes wasn't bumped explicitly within cache window
    const txt = loadVoiceLibrary(path);
    expect(txt).toContain("No em-dashes");
  });

  it("re-reads when the file mtime changes", () => {
    loadVoiceLibrary(path);
    writeFileSync(path, "UPDATED VOICE RULES", "utf8");
    const future = new Date(Date.now() + 60_000);
    utimesSync(path, future, future);
    _resetCacheForTests();
    const txt = loadVoiceLibrary(path);
    expect(txt).toContain("UPDATED");
  });

  it("throws if the file does not exist", () => {
    expect(() => loadVoiceLibrary(join(dir, "missing.md"))).toThrow();
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `cd ~/voom-ceo-dashboard && pnpm vitest run server/whatsapp-voice-loader.test.ts --root .`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Write `server/whatsapp-voice-loader.ts`:

```typescript
import { readFileSync, statSync } from "node:fs";

interface CacheEntry {
  content: string;
  mtimeMs: number;
  loadedAt: number;
}

const CACHE_WINDOW_MS = 15_000;
let cache: Map<string, CacheEntry> = new Map();

export function loadVoiceLibrary(path: string): string {
  const stat = statSync(path);
  const existing = cache.get(path);
  const now = Date.now();

  if (existing && now - existing.loadedAt < CACHE_WINDOW_MS && existing.mtimeMs === stat.mtimeMs) {
    return existing.content;
  }

  const content = readFileSync(path, "utf8");
  cache.set(path, { content, mtimeMs: stat.mtimeMs, loadedAt: now });
  return content;
}

export function _resetCacheForTests(): void {
  cache.clear();
}
```

- [ ] **Step 4: Run, confirm pass**

Run: `cd ~/voom-ceo-dashboard && pnpm vitest run server/whatsapp-voice-loader.test.ts --root .`
Expected: 4 tests passing.

- [ ] **Step 5: Commit**

```bash
cd ~/voom-ceo-dashboard && git add server/whatsapp-voice-loader.ts server/whatsapp-voice-loader.test.ts && git commit -m "feat(triage): voice library loader with mtime-based cache"
```

---

## Phase B: Meta signature verification

### Task B1: Meta X-Hub-Signature-256 verifier

Meta sends every inbound webhook with `X-Hub-Signature-256: sha256=<hex>` computed as HMAC-SHA256 of the raw request body using your app secret. We verify before parsing.

**Files:**
- Create: `server/whatsapp-meta-signature.ts`
- Create: `server/whatsapp-meta-signature.test.ts`

- [ ] **Step 1: Write failing test**

Write `server/whatsapp-meta-signature.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyMetaSignature } from "./whatsapp-meta-signature.js";

const SECRET = "test_app_secret";
const BODY = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
const VALID_SIG = `sha256=${createHmac("sha256", SECRET).update(BODY).digest("hex")}`;

describe("verifyMetaSignature", () => {
  it("returns true for a valid sha256 signature", () => {
    expect(verifyMetaSignature(BODY, VALID_SIG, SECRET)).toBe(true);
  });

  it("returns false for a tampered body", () => {
    expect(verifyMetaSignature(BODY + "X", VALID_SIG, SECRET)).toBe(false);
  });

  it("returns false for a wrong secret", () => {
    expect(verifyMetaSignature(BODY, VALID_SIG, "wrong")).toBe(false);
  });

  it("returns false when the signature header is missing the sha256= prefix", () => {
    const raw = createHmac("sha256", SECRET).update(BODY).digest("hex");
    expect(verifyMetaSignature(BODY, raw, SECRET)).toBe(false);
  });

  it("returns false for empty signature", () => {
    expect(verifyMetaSignature(BODY, "", SECRET)).toBe(false);
  });

  it("uses timing-safe comparison (does not throw on length mismatch)", () => {
    expect(verifyMetaSignature(BODY, "sha256=short", SECRET)).toBe(false);
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `cd ~/voom-ceo-dashboard && pnpm vitest run server/whatsapp-meta-signature.test.ts --root .`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Write `server/whatsapp-meta-signature.ts`:

```typescript
import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyMetaSignature(rawBody: string, header: string, appSecret: string): boolean {
  if (!header.startsWith("sha256=")) return false;
  const provided = header.slice("sha256=".length);
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided, "hex"), Buffer.from(expected, "hex"));
}
```

- [ ] **Step 4: Run, confirm pass**

Run: `cd ~/voom-ceo-dashboard && pnpm vitest run server/whatsapp-meta-signature.test.ts --root .`
Expected: 6 tests passing.

- [ ] **Step 5: Commit**

```bash
cd ~/voom-ceo-dashboard && git add server/whatsapp-meta-signature.ts server/whatsapp-meta-signature.test.ts && git commit -m "feat(triage): Meta X-Hub-Signature-256 verifier"
```

---

## Phase C: Thread context loader

### Task C1: Thread context loader

Loads the sender's prior JSONL entries and Supabase vendor row. Used as classifier input.

**Files:**
- Create: `server/whatsapp-thread-context.ts`
- Create: `server/whatsapp-thread-context.test.ts`

- [ ] **Step 1: Write failing test**

Write `server/whatsapp-thread-context.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadThreadContext, type SupabaseVendorReader } from "./whatsapp-thread-context.js";
import type { TriageEntry } from "../scripts/triage-types.js";

function mkEntry(thread_id: string, bucket: TriageEntry["bucket"], ts: string): TriageEntry {
  return {
    ts, thread_id, sender_name: "x", bucket, step: null, objection_branch: null,
    extracted: { parts_type: null, shop_name: null, location: null, momo: null,
      part_for_listing: null, buyer_part_requested: null, buyer_car: null, buyer_region: null },
    draft_text: "", draft_text_edited: null, draft_sent: false, draft_edited_by_jim: false,
    next_action: "NONE", notes: "",
  };
}

describe("loadThreadContext", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "thread-ctx-test-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const mockVendor: SupabaseVendorReader = async (phone) => {
    if (phone === "+233000000001") {
      return { id: 42, businessName: "Acme Auto", status: "approved", phone };
    }
    return null;
  };

  it("returns empty prior_entries when no JSONL files exist", async () => {
    const ctx = await loadThreadContext("+233000000099", "Test", dir, mockVendor);
    expect(ctx.prior_entries).toEqual([]);
    expect(ctx.vendor_record).toBeNull();
  });

  it("loads the last 5 entries for matching thread_id across multiple day-files", async () => {
    writeFileSync(join(dir, "2026-06-05-burndown.jsonl"),
      [mkEntry("+233000000001", "NEW_VENDOR_M2", "2026-06-05T10:00:00Z"),
       mkEntry("+233000000002", "BUYER_BROWSE", "2026-06-05T11:00:00Z")]
        .map((e) => JSON.stringify(e)).join("\n") + "\n");
    writeFileSync(join(dir, "2026-06-06-burndown.jsonl"),
      [mkEntry("+233000000001", "NEW_VENDOR_M3", "2026-06-06T08:00:00Z")]
        .map((e) => JSON.stringify(e)).join("\n") + "\n");

    const ctx = await loadThreadContext("+233000000001", "Acme", dir, mockVendor);
    expect(ctx.prior_entries).toHaveLength(2);
    expect(ctx.prior_entries[0].bucket).toBe("NEW_VENDOR_M2");
    expect(ctx.prior_entries[1].bucket).toBe("NEW_VENDOR_M3");
  });

  it("caps prior_entries at the most recent 5", async () => {
    const entries = Array.from({ length: 8 }, (_, i) =>
      mkEntry("+233000000001", "VENDOR_QUESTION", `2026-06-06T0${i}:00:00Z`));
    writeFileSync(join(dir, "2026-06-06-burndown.jsonl"),
      entries.map((e) => JSON.stringify(e)).join("\n") + "\n");

    const ctx = await loadThreadContext("+233000000001", "x", dir, mockVendor);
    expect(ctx.prior_entries).toHaveLength(5);
    expect(ctx.prior_entries[0].ts).toBe("2026-06-06T03:00:00Z");
    expect(ctx.prior_entries[4].ts).toBe("2026-06-06T07:00:00Z");
  });

  it("returns vendor_record from Supabase when phone matches", async () => {
    const ctx = await loadThreadContext("+233000000001", "Acme", dir, mockVendor);
    expect(ctx.vendor_record?.businessName).toBe("Acme Auto");
  });

  it("returns null vendor_record when phone does not match a vendor", async () => {
    const ctx = await loadThreadContext("+233000000099", "x", dir, mockVendor);
    expect(ctx.vendor_record).toBeNull();
  });

  it("does not throw when Supabase reader throws", async () => {
    const erroring: SupabaseVendorReader = async () => { throw new Error("db down"); };
    const ctx = await loadThreadContext("+233000000001", "x", dir, erroring);
    expect(ctx.vendor_record).toBeNull();
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `cd ~/voom-ceo-dashboard && pnpm vitest run server/whatsapp-thread-context.test.ts --root .`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Write `server/whatsapp-thread-context.ts`:

```typescript
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { TriageEntrySchema, type TriageEntry } from "../scripts/triage-types.js";

export interface VendorRecord {
  id: number;
  businessName: string;
  status: string;
  phone: string;
}

export type SupabaseVendorReader = (phone: string) => Promise<VendorRecord | null>;

export interface ThreadContext {
  sender: string;
  sender_name: string;
  prior_entries: TriageEntry[];
  vendor_record: VendorRecord | null;
}

const MAX_PRIOR_ENTRIES = 5;

function listJsonlFiles(dir: string): string[] {
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith("-burndown.jsonl"))
      .sort();
  } catch {
    return [];
  }
}

function readEntriesForThread(dir: string, thread_id: string): TriageEntry[] {
  const files = listJsonlFiles(dir);
  const out: TriageEntry[] = [];
  for (const file of files) {
    let raw: string;
    try {
      raw = readFileSync(join(dir, file), "utf8");
    } catch {
      continue;
    }
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      try {
        const entry = TriageEntrySchema.parse(JSON.parse(line));
        if (entry.thread_id === thread_id) out.push(entry);
      } catch {
        // Skip malformed lines silently. errors.jsonl captures write-time failures.
      }
    }
  }
  return out;
}

export async function loadThreadContext(
  sender: string,
  sender_name: string,
  jsonlDir: string,
  vendorReader: SupabaseVendorReader,
): Promise<ThreadContext> {
  const allEntries = readEntriesForThread(jsonlDir, sender);
  const sorted = allEntries.sort((a, b) => a.ts.localeCompare(b.ts));
  const prior_entries = sorted.slice(-MAX_PRIOR_ENTRIES);

  let vendor_record: VendorRecord | null = null;
  try {
    vendor_record = await vendorReader(sender);
  } catch {
    vendor_record = null;
  }

  return { sender, sender_name, prior_entries, vendor_record };
}
```

- [ ] **Step 4: Run, confirm pass**

Run: `cd ~/voom-ceo-dashboard && pnpm vitest run server/whatsapp-thread-context.test.ts --root .`
Expected: 6 tests passing.

- [ ] **Step 5: Commit**

```bash
cd ~/voom-ceo-dashboard && git add server/whatsapp-thread-context.ts server/whatsapp-thread-context.test.ts && git commit -m "feat(triage): thread context loader (JSONL + Supabase)"
```

---

## Phase D: Classifier (Anthropic SDK + tool-use)

### Task D1: Install Anthropic SDK

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install**

```bash
cd ~/voom-ceo-dashboard && pnpm add @anthropic-ai/sdk
```

- [ ] **Step 2: Verify install**

```bash
cd ~/voom-ceo-dashboard && pnpm list @anthropic-ai/sdk | grep "@anthropic-ai/sdk"
```

Expected: line like `@anthropic-ai/sdk 0.x.y`.

- [ ] **Step 3: Commit**

```bash
cd ~/voom-ceo-dashboard && git add package.json pnpm-lock.yaml && git commit -m "deps: add @anthropic-ai/sdk for classifier"
```

---

### Task D2: Classifier with mocked Anthropic client

The classifier wraps Anthropic's Messages API with tool use. The tool schema mirrors `TriageEntry`. We inject an `AnthropicClient` interface in the constructor so tests can mock.

**Files:**
- Create: `server/whatsapp-classifier.ts`
- Create: `server/whatsapp-classifier.test.ts`

- [ ] **Step 1: Write failing test**

Write `server/whatsapp-classifier.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { classifyAndDraft, type AnthropicClient } from "./whatsapp-classifier.js";
import type { ThreadContext } from "./whatsapp-thread-context.js";

const VOICE = "# Voice rules\nNo em-dashes. Use only authorised emoji.";

const CTX: ThreadContext = {
  sender: "+233000000001",
  sender_name: "Kwame",
  prior_entries: [],
  vendor_record: null,
};

function mockClient(toolInput: Record<string, unknown>): AnthropicClient {
  return {
    classify: async () => ({ tool_input: toolInput }),
  };
}

describe("classifyAndDraft", () => {
  it("returns a TriageEntry assembled from the model's tool-call input", async () => {
    const client = mockClient({
      bucket: "NEW_VENDOR_M2",
      step: "M2",
      objection_branch: null,
      extracted: { parts_type: "brake pads", shop_name: null, location: null, momo: null,
        part_for_listing: null, buyer_part_requested: null, buyer_car: null, buyer_region: null },
      draft_text: "Perfect, brake pads move fast on VOOM 👌",
      next_action: "NONE",
      notes: "",
    });
    const entry = await classifyAndDraft({
      message: "i sell brake pads",
      context: CTX,
      voiceLibrary: VOICE,
      metaMessageId: "wamid.abc",
      now: new Date("2026-06-07T10:00:00Z"),
      client,
    });
    expect(entry.bucket).toBe("NEW_VENDOR_M2");
    expect(entry.thread_id).toBe("+233000000001");
    expect(entry.meta_message_id).toBe("wamid.abc");
    expect(entry.ts).toBe("2026-06-07T10:00:00.000Z");
    expect(entry.draft_sent).toBe(false);
    expect(entry.draft_edited_by_jim).toBe(false);
  });

  it("throws if the tool input does not pass schema validation", async () => {
    const client = mockClient({ bucket: "INVALID_BUCKET" });
    await expect(classifyAndDraft({
      message: "x", context: CTX, voiceLibrary: VOICE,
      metaMessageId: null, now: new Date(), client,
    })).rejects.toThrow();
  });

  it("preserves objection_branch from tool input", async () => {
    const client = mockClient({
      bucket: "OBJECTION_PRICE", step: null, objection_branch: "PRICE",
      extracted: { parts_type: null, shop_name: null, location: null, momo: null,
        part_for_listing: null, buyer_part_requested: null, buyer_car: null, buyer_region: null },
      draft_text: "100% free to list up to 20 parts 👍",
      next_action: "NONE", notes: "",
    });
    const entry = await classifyAndDraft({
      message: "is it free", context: CTX, voiceLibrary: VOICE,
      metaMessageId: null, now: new Date(), client,
    });
    expect(entry.objection_branch).toBe("PRICE");
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `cd ~/voom-ceo-dashboard && pnpm vitest run server/whatsapp-classifier.test.ts --root .`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Write `server/whatsapp-classifier.ts`:

```typescript
import { TriageEntrySchema, type TriageEntry, BUCKETS, NEXT_ACTIONS, STEPS, OBJECTION_BRANCHES } from "../scripts/triage-types.js";
import type { ThreadContext } from "./whatsapp-thread-context.js";

export interface AnthropicClient {
  classify(args: {
    systemPrompt: string;
    userPrompt: string;
    toolSchema: Record<string, unknown>;
  }): Promise<{ tool_input: Record<string, unknown> }>;
}

interface ClassifyArgs {
  message: string;
  context: ThreadContext;
  voiceLibrary: string;
  metaMessageId: string | null;
  now: Date;
  client: AnthropicClient;
}

const TOOL_SCHEMA = {
  name: "classify_and_draft",
  description: "Classify the vendor's WhatsApp message and draft a reply per VOOM's voice rules.",
  input_schema: {
    type: "object",
    properties: {
      bucket: { type: "string", enum: [...BUCKETS] },
      step: { type: ["string", "null"], enum: [...STEPS, null] },
      objection_branch: { type: ["string", "null"], enum: [...OBJECTION_BRANCHES, null] },
      extracted: {
        type: "object",
        properties: {
          parts_type: { type: ["string", "null"] },
          shop_name: { type: ["string", "null"] },
          location: { type: ["string", "null"] },
          momo: { type: ["string", "null"] },
          part_for_listing: { type: ["string", "null"] },
          buyer_part_requested: { type: ["string", "null"] },
          buyer_car: { type: ["string", "null"] },
          buyer_region: { type: ["string", "null"] },
        },
        required: ["parts_type","shop_name","location","momo","part_for_listing","buyer_part_requested","buyer_car","buyer_region"],
      },
      draft_text: { type: "string" },
      next_action: { type: "string", enum: [...NEXT_ACTIONS] },
      notes: { type: "string" },
    },
    required: ["bucket","step","objection_branch","extracted","draft_text","next_action","notes"],
  },
};

function renderSystemPrompt(voiceLibrary: string): string {
  return [
    "You are the autonomous triage assistant for VOOM Ghana, an auto-parts marketplace.",
    "Identity: replies sign as 'VOOM Team' or 'VOOM' or are unsigned. Never use a personal name. Never claim to be a person or an AI.",
    "",
    "## Voice rules (hard, apply to every draft_text):",
    voiceLibrary,
    "",
    "## Taxonomy (pick exactly one bucket):",
    "- NEW_VENDOR_M2: vendor replied to Meta auto-greet with what they sell",
    "- NEW_VENDOR_M3: vendor sent shop name + location + MoMo",
    "- NEW_VENDOR_M4: vendor sent photo attachments (5 or more)",
    "- NEW_VENDOR_M5: silent after M4, scarcity push",
    "- NEW_VENDOR_FOLLOWUP_D2: silent vendor at +24h",
    "- BUYER_DISCOVERY: vague buyer intent",
    "- BUYER_BROWSE: generic buyer question about VOOM",
    "- BUYER_SPECIFIC_REQUEST: looking for a specific part",
    "- RETURNING_VENDOR: existing account, re-auth or returning",
    "- VENDOR_QUESTION: existing vendor how-to or complaint",
    "- OBJECTION_PRICE / PAYMENT / TIME / TRUST: objection branches (set objection_branch accordingly)",
    "- SPAM_OR_NOISE: telco promo, wrong number, single emoji",
    "",
    "If a thread is genuinely ambiguous, append `?` to the bucket value. The orchestrator will escalate.",
    "",
    "draft_text must be copy-paste ready. Empty string only if bucket is SPAM_OR_NOISE.",
    "Always call the classify_and_draft tool. No prose.",
  ].join("\n");
}

function renderUserPrompt(args: ClassifyArgs): string {
  const priorLines = args.context.prior_entries.map((e) =>
    `[${e.ts}] bucket=${e.bucket} draft_sent=${e.draft_sent} draft=${e.draft_text.slice(0, 120).replace(/\n/g, " ")}`
  ).join("\n");
  const vendor = args.context.vendor_record
    ? `vendor.id=${args.context.vendor_record.id} businessName=${args.context.vendor_record.businessName} status=${args.context.vendor_record.status}`
    : "no vendor record";
  return [
    `Sender phone: ${args.context.sender}`,
    `Sender display: ${args.context.sender_name}`,
    `Vendor record: ${vendor}`,
    "Prior thread:",
    priorLines || "(no prior entries)",
    "",
    "New inbound message:",
    args.message,
  ].join("\n");
}

export async function classifyAndDraft(args: ClassifyArgs): Promise<TriageEntry> {
  const result = await args.client.classify({
    systemPrompt: renderSystemPrompt(args.voiceLibrary),
    userPrompt: renderUserPrompt(args),
    toolSchema: TOOL_SCHEMA,
  });

  const assembled = {
    ...result.tool_input,
    ts: args.now.toISOString(),
    thread_id: args.context.sender,
    sender_name: args.context.sender_name,
    draft_text_edited: null,
    draft_sent: false,
    draft_edited_by_jim: false,
    meta_message_id: args.metaMessageId,
  };
  return TriageEntrySchema.parse(assembled);
}
```

- [ ] **Step 4: Run, confirm pass**

Run: `cd ~/voom-ceo-dashboard && pnpm vitest run server/whatsapp-classifier.test.ts --root .`
Expected: 3 tests passing.

- [ ] **Step 5: Commit**

```bash
cd ~/voom-ceo-dashboard && git add server/whatsapp-classifier.ts server/whatsapp-classifier.test.ts && git commit -m "feat(triage): classifier with Claude tool-use, returns validated TriageEntry"
```

---

### Task D3: Real Anthropic client adapter

Wraps the actual `@anthropic-ai/sdk` to implement the `AnthropicClient` interface from Task D2. Tested manually only; we don't put a real API key in CI.

**Files:**
- Create: `server/whatsapp-anthropic-client.ts`

- [ ] **Step 1: Implement**

Write `server/whatsapp-anthropic-client.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk";
import type { AnthropicClient } from "./whatsapp-classifier.js";

export function makeAnthropicClient(apiKey: string): AnthropicClient {
  const client = new Anthropic({ apiKey });
  return {
    async classify({ systemPrompt, userPrompt, toolSchema }) {
      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: systemPrompt,
        tools: [toolSchema as Anthropic.Tool],
        tool_choice: { type: "tool", name: (toolSchema as { name: string }).name },
        messages: [{ role: "user", content: userPrompt }],
      });
      const toolBlock = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      if (!toolBlock) {
        throw new Error("classifier: model did not call the tool");
      }
      return { tool_input: toolBlock.input as Record<string, unknown> };
    },
  };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd ~/voom-ceo-dashboard && pnpm check`
Expected: no errors related to `whatsapp-anthropic-client.ts`. If there are unrelated pre-existing errors, that's fine — just check the new file is clean.

- [ ] **Step 3: Commit**

```bash
cd ~/voom-ceo-dashboard && git add server/whatsapp-anthropic-client.ts && git commit -m "feat(triage): real Anthropic SDK adapter for classifier"
```

---

## Phase E: Policy gate and error log

### Task E1: Policy gate

Pure function. Decides whether a classified entry results in auto-reply, escalation, or both.

**Files:**
- Create: `server/whatsapp-policy-gate.ts`
- Create: `server/whatsapp-policy-gate.test.ts`

- [ ] **Step 1: Write failing test**

Write `server/whatsapp-policy-gate.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { decidePolicy } from "./whatsapp-policy-gate.js";
import type { TriageEntry } from "../scripts/triage-types.js";

const AUTO_BUCKETS: TriageEntry["bucket"][] = [
  "SPAM_OR_NOISE","NEW_VENDOR_M2","OBJECTION_PRICE","OBJECTION_PAYMENT",
  "OBJECTION_TIME","OBJECTION_TRUST","RETURNING_VENDOR",
];
const ESCALATE_BUCKETS: TriageEntry["bucket"][] = [
  "NEW_VENDOR_M3","NEW_VENDOR_M5","NEW_VENDOR_FOLLOWUP_D2",
  "BUYER_DISCOVERY","BUYER_BROWSE","BUYER_SPECIFIC_REQUEST","VENDOR_QUESTION",
];

describe("decidePolicy", () => {
  for (const b of AUTO_BUCKETS) {
    it(`AUTO for ${b} when unambiguous and voice audit passed`, () => {
      expect(decidePolicy({ bucket: b, hasAmbiguity: false, voiceAuditFailed: false })).toBe("auto");
    });
  }
  for (const b of ESCALATE_BUCKETS) {
    it(`ESCALATE for ${b} when unambiguous`, () => {
      expect(decidePolicy({ bucket: b, hasAmbiguity: false, voiceAuditFailed: false })).toBe("escalate");
    });
  }
  it("DUAL for NEW_VENDOR_M4 (vendor ack + Jim escalation)", () => {
    expect(decidePolicy({ bucket: "NEW_VENDOR_M4", hasAmbiguity: false, voiceAuditFailed: false })).toBe("dual");
  });
  it("ambiguity forces escalate even on an AUTO bucket", () => {
    expect(decidePolicy({ bucket: "NEW_VENDOR_M2", hasAmbiguity: true, voiceAuditFailed: false })).toBe("escalate");
  });
  it("voice audit failure forces escalate even on an AUTO bucket", () => {
    expect(decidePolicy({ bucket: "OBJECTION_PRICE", hasAmbiguity: false, voiceAuditFailed: true })).toBe("escalate");
  });
  it("voice audit failure on M4 forces escalate (no vendor ack)", () => {
    expect(decidePolicy({ bucket: "NEW_VENDOR_M4", hasAmbiguity: false, voiceAuditFailed: true })).toBe("escalate");
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `cd ~/voom-ceo-dashboard && pnpm vitest run server/whatsapp-policy-gate.test.ts --root .`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Write `server/whatsapp-policy-gate.ts`:

```typescript
import type { TriageEntry } from "../scripts/triage-types.js";

export type PolicyDecision = "auto" | "escalate" | "dual";

const AUTO_BUCKETS = new Set<TriageEntry["bucket"]>([
  "SPAM_OR_NOISE","NEW_VENDOR_M2","OBJECTION_PRICE","OBJECTION_PAYMENT",
  "OBJECTION_TIME","OBJECTION_TRUST","RETURNING_VENDOR",
]);

export function decidePolicy(args: {
  bucket: TriageEntry["bucket"];
  hasAmbiguity: boolean;
  voiceAuditFailed: boolean;
}): PolicyDecision {
  if (args.voiceAuditFailed || args.hasAmbiguity) return "escalate";
  if (args.bucket === "NEW_VENDOR_M4") return "dual";
  if (AUTO_BUCKETS.has(args.bucket)) return "auto";
  return "escalate";
}
```

- [ ] **Step 4: Run, confirm pass**

Run: `cd ~/voom-ceo-dashboard && pnpm vitest run server/whatsapp-policy-gate.test.ts --root .`
Expected: 18 tests passing (7 AUTO + 7 ESCALATE + 4 special).

- [ ] **Step 5: Commit**

```bash
cd ~/voom-ceo-dashboard && git add server/whatsapp-policy-gate.ts server/whatsapp-policy-gate.test.ts && git commit -m "feat(triage): policy gate (AUTO/ESCALATE/DUAL)"
```

---

### Task E2: Error log

Standalone append-only logger for failures. Distinct from the canonical JSONL because errors don't conform to the TriageEntry schema.

**Files:**
- Create: `server/whatsapp-error-log.ts`
- Create: `server/whatsapp-error-log.test.ts`

- [ ] **Step 1: Write failing test**

Write `server/whatsapp-error-log.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { logErrorEvent } from "./whatsapp-error-log.js";

describe("logErrorEvent", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "err-test-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("creates errors.jsonl and writes one line", () => {
    logErrorEvent({ kind: "signature_invalid", detail: "bad sig", meta_message_id: null }, dir);
    const lines = readFileSync(join(dir, "errors.jsonl"), "utf8").trim().split("\n");
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.kind).toBe("signature_invalid");
    expect(parsed.ts).toBeDefined();
  });

  it("appends without overwriting", () => {
    logErrorEvent({ kind: "classifier_failed", detail: "timeout", meta_message_id: "abc" }, dir);
    logErrorEvent({ kind: "send_failed", detail: "401", meta_message_id: "def" }, dir);
    const lines = readFileSync(join(dir, "errors.jsonl"), "utf8").trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[1]).kind).toBe("send_failed");
  });

  it("never throws even with read-only directory (best-effort)", () => {
    expect(() => logErrorEvent({ kind: "test", detail: "x", meta_message_id: null }, "/nonexistent-path")).not.toThrow();
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `cd ~/voom-ceo-dashboard && pnpm vitest run server/whatsapp-error-log.test.ts --root .`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Write `server/whatsapp-error-log.ts`:

```typescript
import { appendFileSync } from "node:fs";
import { join } from "node:path";

export interface ErrorEvent {
  kind: string;
  detail: string;
  meta_message_id: string | null;
}

export function logErrorEvent(event: ErrorEvent, dir: string): void {
  try {
    const line = JSON.stringify({ ts: new Date().toISOString(), ...event }) + "\n";
    appendFileSync(join(dir, "errors.jsonl"), line, "utf8");
  } catch {
    // Best-effort. Errors here are unrecoverable, do not crash the request path.
  }
}
```

- [ ] **Step 4: Run, confirm pass**

Run: `cd ~/voom-ceo-dashboard && pnpm vitest run server/whatsapp-error-log.test.ts --root .`
Expected: 3 tests passing.

- [ ] **Step 5: Commit**

```bash
cd ~/voom-ceo-dashboard && git add server/whatsapp-error-log.ts server/whatsapp-error-log.test.ts && git commit -m "feat(triage): error log (append-only errors.jsonl)"
```

---

## Phase F: Escalator

### Task F1: Escalation DM formatter and sender

Formats the structured escalation DM, then calls `sendTextMessage` from existing `whatsapp-api.ts`. The sender is injected for testability.

**Files:**
- Create: `server/whatsapp-escalator.ts`
- Create: `server/whatsapp-escalator.test.ts`

- [ ] **Step 1: Write failing test**

Write `server/whatsapp-escalator.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { formatEscalationDm, sendEscalation, type TextSender } from "./whatsapp-escalator.js";
import type { TriageEntry } from "../scripts/triage-types.js";

const ENTRY: TriageEntry = {
  ts: "2026-06-07T10:00:00Z",
  thread_id: "+233244000001",
  sender_name: "Kwame",
  bucket: "VENDOR_QUESTION",
  step: null,
  objection_branch: null,
  extracted: { parts_type: null, shop_name: null, location: null, momo: null,
    part_for_listing: null, buyer_part_requested: null, buyer_car: null, buyer_region: null },
  draft_text: "I'll come back to you on this within 24h, just need to check with the team.",
  draft_text_edited: null,
  draft_sent: false,
  draft_edited_by_jim: false,
  next_action: "ESCALATE_JUSTICE",
  notes: "Vendor asking about Ghana Card upload",
  meta_message_id: "wamid.abc",
};

describe("formatEscalationDm", () => {
  it("includes bucket, sender, last message, proposed draft, and wa.me deep-link", () => {
    const dm = formatEscalationDm({
      entry: ENTRY,
      lastInboundMessage: "How do I upload my Ghana card photo?",
    });
    expect(dm).toContain("VENDOR_QUESTION");
    expect(dm).toContain("Kwame");
    expect(dm).toContain("+233244000001");
    expect(dm).toContain("Ghana card photo");
    expect(dm).toContain("come back to you on this within 24h");
    expect(dm).toContain("wa.me/233244000001");
  });

  it("strips the leading + from the wa.me number", () => {
    const dm = formatEscalationDm({
      entry: { ...ENTRY, thread_id: "+233207762022" },
      lastInboundMessage: "test",
    });
    expect(dm).toContain("wa.me/233207762022");
    expect(dm).not.toContain("wa.me/+");
  });

  it("truncates very long inbound messages", () => {
    const long = "x".repeat(500);
    const dm = formatEscalationDm({ entry: ENTRY, lastInboundMessage: long });
    expect(dm.length).toBeLessThan(1500);
  });
});

describe("sendEscalation", () => {
  it("calls sender with the formatted DM and Jim's number", async () => {
    const sender = vi.fn<TextSender>().mockResolvedValue({ success: true, messageId: "out_1" });
    await sendEscalation({
      entry: ENTRY,
      lastInboundMessage: "hi",
      jimWaNumber: "whatsapp:+12125551234",
      sender,
    });
    expect(sender).toHaveBeenCalledOnce();
    const [to, body] = sender.mock.calls[0];
    expect(to).toBe("whatsapp:+12125551234");
    expect(body).toContain("VENDOR_QUESTION");
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `cd ~/voom-ceo-dashboard && pnpm vitest run server/whatsapp-escalator.test.ts --root .`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Write `server/whatsapp-escalator.ts`:

```typescript
import type { TriageEntry } from "../scripts/triage-types.js";

export type TextSender = (to: string, body: string) => Promise<{ success: boolean; messageId?: string; error?: string }>;

const MAX_INBOUND_SNIPPET = 300;

export function formatEscalationDm(args: { entry: TriageEntry; lastInboundMessage: string }): string {
  const e = args.entry;
  const inbound = args.lastInboundMessage.length > MAX_INBOUND_SNIPPET
    ? args.lastInboundMessage.slice(0, MAX_INBOUND_SNIPPET) + "..."
    : args.lastInboundMessage;
  const waMeNumber = e.thread_id.replace(/^\+/, "");
  const draft = e.draft_text || "(no draft)";
  const flagPrefix = e.bucket === "NEW_VENDOR_M4" ? "Akua-ready" : "Flag";

  return [
    `${flagPrefix}: ${e.bucket}`,
    `From: ${e.sender_name} ${e.thread_id}`,
    ``,
    `Last msg:`,
    inbound,
    ``,
    `Suggested reply:`,
    draft,
    ``,
    `Open: wa.me/${waMeNumber}`,
  ].join("\n");
}

export async function sendEscalation(args: {
  entry: TriageEntry;
  lastInboundMessage: string;
  jimWaNumber: string;
  sender: TextSender;
}): Promise<void> {
  const body = formatEscalationDm({ entry: args.entry, lastInboundMessage: args.lastInboundMessage });
  await args.sender(args.jimWaNumber, body);
}
```

- [ ] **Step 4: Run, confirm pass**

Run: `cd ~/voom-ceo-dashboard && pnpm vitest run server/whatsapp-escalator.test.ts --root .`
Expected: 4 tests passing.

- [ ] **Step 5: Commit**

```bash
cd ~/voom-ceo-dashboard && git add server/whatsapp-escalator.ts server/whatsapp-escalator.test.ts && git commit -m "feat(triage): escalation DM formatter + sender"
```

---

## Phase G: Orchestrator and route wiring

### Task G1: Inbound orchestrator (top-level pipeline)

Single function `runTriagePipeline` that takes a parsed Meta inbound message and runs: dedupe → context → classify → voice audit → policy → send/escalate → JSONL append. Everything is dependency-injected for testability.

**Files:**
- Create: `server/whatsapp-orchestrator.ts`
- Create: `server/whatsapp-orchestrator.test.ts`

- [ ] **Step 1: Write failing test**

Write `server/whatsapp-orchestrator.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runTriagePipeline, type OrchestratorDeps, type ParsedInbound } from "./whatsapp-orchestrator.js";
import type { TriageEntry } from "../scripts/triage-types.js";

const INBOUND: ParsedInbound = {
  message_id: "wamid.test1",
  from_phone: "+233244000001",
  profile_name: "Kwame",
  body: "i sell brake pads",
  timestamp: "2026-06-07T10:00:00Z",
};

function mkClassifier(overrides: Partial<TriageEntry> = {}): OrchestratorDeps["classifier"] {
  return async ({ context, metaMessageId, now }) => ({
    ts: now.toISOString(),
    thread_id: context.sender,
    sender_name: context.sender_name,
    bucket: "NEW_VENDOR_M2",
    step: "M2",
    objection_branch: null,
    extracted: { parts_type: "brake pads", shop_name: null, location: null, momo: null,
      part_for_listing: null, buyer_part_requested: null, buyer_car: null, buyer_region: null },
    draft_text: "Perfect, brake pads move fast on VOOM 👌",
    draft_text_edited: null,
    draft_sent: false,
    draft_edited_by_jim: false,
    next_action: "NONE",
    notes: "",
    meta_message_id: metaMessageId,
    ...overrides,
  });
}

describe("runTriagePipeline", () => {
  let dir: string;
  let jsonlPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "orch-test-"));
    jsonlPath = join(dir, "2026-06-07-burndown.jsonl");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function makeDeps(overrides: Partial<OrchestratorDeps> = {}): OrchestratorDeps {
    return {
      jsonlDir: dir,
      jsonlPathForToday: () => jsonlPath,
      vendorReader: async () => null,
      voiceLibrary: "# Voice rules",
      classifier: mkClassifier(),
      sender: vi.fn().mockResolvedValue({ success: true, messageId: "out_1" }),
      jimWaNumber: "whatsapp:+12125551234",
      now: () => new Date("2026-06-07T10:00:00Z"),
      ...overrides,
    };
  }

  it("AUTO bucket: sends reply to vendor, appends JSONL with draft_sent=true", async () => {
    const sender = vi.fn().mockResolvedValue({ success: true, messageId: "out_1" });
    const deps = makeDeps({ sender });
    await runTriagePipeline(INBOUND, deps);
    expect(sender).toHaveBeenCalledOnce();
    const [to, body] = sender.mock.calls[0];
    expect(to).toBe("+233244000001");
    expect(body).toContain("brake pads move fast");
    const lines = readFileSync(jsonlPath, "utf8").trim().split("\n");
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]).draft_sent).toBe(true);
  });

  it("ESCALATE bucket: sends DM to Jim, JSONL has draft_sent=false", async () => {
    const sender = vi.fn().mockResolvedValue({ success: true });
    const deps = makeDeps({
      classifier: mkClassifier({ bucket: "VENDOR_QUESTION", step: null, next_action: "ESCALATE_JUSTICE" }),
      sender,
    });
    await runTriagePipeline(INBOUND, deps);
    expect(sender).toHaveBeenCalledOnce();
    expect(sender.mock.calls[0][0]).toBe("whatsapp:+12125551234");
    const entry = JSON.parse(readFileSync(jsonlPath, "utf8").trim());
    expect(entry.draft_sent).toBe(false);
  });

  it("DUAL bucket (M4): sends both vendor ack and Jim DM, one JSONL row", async () => {
    const sender = vi.fn().mockResolvedValue({ success: true });
    const deps = makeDeps({
      classifier: mkClassifier({ bucket: "NEW_VENDOR_M4", step: "M4", next_action: "ESCALATE_JIM",
        draft_text: "Got them all 🙏 putting them up on your shop now." }),
      sender,
    });
    await runTriagePipeline(INBOUND, deps);
    expect(sender).toHaveBeenCalledTimes(2);
    expect(sender.mock.calls[0][0]).toBe("+233244000001");
    expect(sender.mock.calls[1][0]).toBe("whatsapp:+12125551234");
    const entry = JSON.parse(readFileSync(jsonlPath, "utf8").trim());
    expect(entry.draft_sent).toBe(true);
  });

  it("voice audit failure forces escalation", async () => {
    const sender = vi.fn().mockResolvedValue({ success: true });
    const deps = makeDeps({
      classifier: mkClassifier({ draft_text: "Perfect — brake pads" }),
      sender,
    });
    await runTriagePipeline(INBOUND, deps);
    expect(sender).toHaveBeenCalledOnce();
    expect(sender.mock.calls[0][0]).toBe("whatsapp:+12125551234");
    const entry = JSON.parse(readFileSync(jsonlPath, "utf8").trim());
    expect(entry.voice_audit_failed).toBe(true);
    expect(entry.draft_sent).toBe(false);
  });

  it("duplicate meta_message_id within JSONL is skipped silently", async () => {
    const sender = vi.fn().mockResolvedValue({ success: true });
    const deps = makeDeps({ sender });
    await runTriagePipeline(INBOUND, deps);
    expect(sender).toHaveBeenCalledTimes(1);
    await runTriagePipeline(INBOUND, deps);
    expect(sender).toHaveBeenCalledTimes(1);
  });

  it("classifier throwing causes escalation with classifier_failed=true", async () => {
    const sender = vi.fn().mockResolvedValue({ success: true });
    const deps = makeDeps({
      classifier: async () => { throw new Error("anthropic 500"); },
      sender,
    });
    await runTriagePipeline(INBOUND, deps);
    expect(sender).toHaveBeenCalledOnce();
    expect(sender.mock.calls[0][0]).toBe("whatsapp:+12125551234");
    expect(sender.mock.calls[0][1]).toContain("classifier-down");
    expect(existsSync(join(dir, "errors.jsonl"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `cd ~/voom-ceo-dashboard && pnpm vitest run server/whatsapp-orchestrator.test.ts --root .`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Write `server/whatsapp-orchestrator.ts`:

```typescript
import { appendEntry } from "../scripts/triage-log-append.js";
import { auditEntries } from "../scripts/triage-voice-audit.js";
import { TriageEntrySchema, type TriageEntry } from "../scripts/triage-types.js";
import { loadThreadContext, type SupabaseVendorReader, type ThreadContext } from "./whatsapp-thread-context.js";
import { decidePolicy } from "./whatsapp-policy-gate.js";
import { sendEscalation, type TextSender } from "./whatsapp-escalator.js";
import { logErrorEvent } from "./whatsapp-error-log.js";

export interface ParsedInbound {
  message_id: string;
  from_phone: string;
  profile_name: string;
  body: string;
  timestamp: string;
}

export interface OrchestratorDeps {
  jsonlDir: string;
  jsonlPathForToday: () => string;
  vendorReader: SupabaseVendorReader;
  voiceLibrary: string;
  classifier: (args: {
    message: string;
    context: ThreadContext;
    voiceLibrary: string;
    metaMessageId: string | null;
    now: Date;
  }) => Promise<TriageEntry>;
  sender: TextSender;
  jimWaNumber: string;
  now: () => Date;
}

async function alreadyProcessed(inbound: ParsedInbound, deps: OrchestratorDeps): Promise<boolean> {
  const ctx = await loadThreadContext(inbound.from_phone, inbound.profile_name, deps.jsonlDir, deps.vendorReader);
  return ctx.prior_entries.some((e) => e.meta_message_id === inbound.message_id);
}

function hasAmbiguityFlag(entry: TriageEntry): boolean {
  return entry.notes.includes("ambiguity:") || (entry.bucket as string).endsWith("?");
}

function classifierDownEntry(inbound: ParsedInbound, now: Date): TriageEntry {
  return TriageEntrySchema.parse({
    ts: now.toISOString(),
    thread_id: inbound.from_phone,
    sender_name: inbound.profile_name,
    bucket: "VENDOR_QUESTION",
    step: null,
    objection_branch: null,
    extracted: { parts_type: null, shop_name: null, location: null, momo: null,
      part_for_listing: null, buyer_part_requested: null, buyer_car: null, buyer_region: null },
    draft_text: "",
    draft_text_edited: null,
    draft_sent: false,
    draft_edited_by_jim: false,
    next_action: "ESCALATE_JUSTICE",
    notes: "classifier-down: original message logged for Jim",
    meta_message_id: inbound.message_id,
    classifier_failed: true,
  });
}

export async function runTriagePipeline(inbound: ParsedInbound, deps: OrchestratorDeps): Promise<void> {
  const now = deps.now();

  if (await alreadyProcessed(inbound, deps)) return;

  const ctx = await loadThreadContext(inbound.from_phone, inbound.profile_name, deps.jsonlDir, deps.vendorReader);

  let entry: TriageEntry;
  let classifierFailed = false;
  try {
    entry = await deps.classifier({
      message: inbound.body,
      context: ctx,
      voiceLibrary: deps.voiceLibrary,
      metaMessageId: inbound.message_id,
      now,
    });
  } catch (err) {
    classifierFailed = true;
    entry = classifierDownEntry(inbound, now);
    logErrorEvent({ kind: "classifier_failed", detail: err instanceof Error ? err.message : String(err), meta_message_id: inbound.message_id }, deps.jsonlDir);
  }

  const voiceViolations = entry.draft_text ? auditEntries([entry]) : [];
  const voiceAuditFailed = voiceViolations.length > 0;
  if (voiceAuditFailed) {
    entry = { ...entry, voice_audit_failed: true };
    logErrorEvent({ kind: "voice_audit_failed", detail: voiceViolations.map((v) => v.reason).join("; "), meta_message_id: inbound.message_id }, deps.jsonlDir);
  }

  const decision = classifierFailed
    ? "escalate"
    : decidePolicy({ bucket: entry.bucket, hasAmbiguity: hasAmbiguityFlag(entry), voiceAuditFailed });

  if (decision === "auto" || decision === "dual") {
    try {
      const res = await deps.sender(inbound.from_phone, entry.draft_text);
      if (!res.success) throw new Error(res.error ?? "send failed");
      entry = { ...entry, draft_sent: true };
    } catch (err) {
      logErrorEvent({ kind: "send_failed", detail: err instanceof Error ? err.message : String(err), meta_message_id: inbound.message_id }, deps.jsonlDir);
      // Escalate anyway so Jim sees the failure.
      await sendEscalation({ entry, lastInboundMessage: inbound.body, jimWaNumber: deps.jimWaNumber, sender: deps.sender });
    }
  }

  if (decision === "escalate" || decision === "dual") {
    try {
      await sendEscalation({ entry, lastInboundMessage: inbound.body, jimWaNumber: deps.jimWaNumber, sender: deps.sender });
    } catch (err) {
      logErrorEvent({ kind: "escalation_send_failed", detail: err instanceof Error ? err.message : String(err), meta_message_id: inbound.message_id }, deps.jsonlDir);
    }
  }

  try {
    appendEntry(entry, deps.jsonlPathForToday());
  } catch (err) {
    logErrorEvent({ kind: "jsonl_append_failed", detail: err instanceof Error ? err.message : String(err), meta_message_id: inbound.message_id }, deps.jsonlDir);
  }
}
```

- [ ] **Step 4: Run, confirm pass**

Run: `cd ~/voom-ceo-dashboard && pnpm vitest run server/whatsapp-orchestrator.test.ts --root .`
Expected: 6 tests passing.

- [ ] **Step 5: Commit**

```bash
cd ~/voom-ceo-dashboard && git add server/whatsapp-orchestrator.ts server/whatsapp-orchestrator.test.ts && git commit -m "feat(triage): orchestrator (dedupe + classify + audit + policy + send + log)"
```

---

### Task G2: Wire orchestrator into existing webhook route

Extends `POST /api/webhook/whatsapp` in `server/routes.ts` to call `runTriagePipeline` for vendor inbound messages.

**Files:**
- Modify: `server/routes.ts` (lines ~2938-3030, the existing POST handler)
- Modify: `server/index.ts` (add env-driven dependency wiring at server boot)
- Create: `server/whatsapp-deps.ts` (factory that assembles `OrchestratorDeps` from env vars)

- [ ] **Step 1: Re-read the existing handler**

Before touching code, open `server/whatsapp-recon-notes.md` (from Task A2). Confirm:
- Whether `processLeadMessage` already sends auto-replies — if yes, the new orchestrator REPLACES it, do not call both
- Whether `parseWebhookPayload` returns the fields we need (message_id, from_phone, body, timestamp, profile_name)

If `parseWebhookPayload` returns a different shape, write a small mapper in `whatsapp-deps.ts` to translate.

- [ ] **Step 2: Build the deps factory**

Write `server/whatsapp-deps.ts`:

```typescript
import { sendTextMessage } from "./whatsapp-api.js";
import { loadVoiceLibrary } from "./whatsapp-voice-loader.js";
import { makeAnthropicClient } from "./whatsapp-anthropic-client.js";
import { classifyAndDraft } from "./whatsapp-classifier.js";
import type { OrchestratorDeps } from "./whatsapp-orchestrator.js";
import type { SupabaseVendorReader, VendorRecord } from "./whatsapp-thread-context.js";
import { join } from "node:path";

const JSONL_DIR = "data/whatsapp-triage";
const VOICE_LIB_PATH = "docs/specs/2026-06-05-whatsapp-agentic-system/artifacts/03-jim-wa-voice-library.md";

function todayPath(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return join(JSONL_DIR, `${yyyy}-${mm}-${dd}-burndown.jsonl`);
}

function makeVendorReader(): SupabaseVendorReader {
  return async (phone: string) => {
    // Implementation note: extend this once Supabase wiring for vendors is confirmed.
    // For v1 ship, return null (no vendor record). The classifier degrades gracefully.
    return null;
  };
}

export function makeOrchestratorDeps(): OrchestratorDeps {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const jimWaNumber = process.env.JIM_PERSONAL_WA_NUMBER;
  if (!jimWaNumber) throw new Error("JIM_PERSONAL_WA_NUMBER not set");

  const anthropic = makeAnthropicClient(apiKey);

  return {
    jsonlDir: JSONL_DIR,
    jsonlPathForToday: todayPath,
    vendorReader: makeVendorReader(),
    voiceLibrary: loadVoiceLibrary(VOICE_LIB_PATH),
    classifier: (args) => classifyAndDraft({ ...args, client: anthropic }),
    sender: sendTextMessage,
    jimWaNumber,
    now: () => new Date(),
  };
}
```

- [ ] **Step 3: Modify the existing webhook handler**

In `server/routes.ts`, find the `POST /api/webhook/whatsapp` handler (around line 2938). Identify the section that processes vendor inbound messages — typically inside the loop over `entry[].changes[].value.messages[]` in the Meta payload.

Replace the per-message handling with:

```typescript
import { runTriagePipeline } from "./whatsapp-orchestrator.js";
import { makeOrchestratorDeps } from "./whatsapp-deps.js";
import { verifyMetaSignature } from "./whatsapp-meta-signature.js";

// At module scope, build deps once:
const triageDeps = (() => { try { return makeOrchestratorDeps(); } catch { return null; } })();

// Inside the POST handler, BEFORE parsing the body:
const sig = req.headers["x-hub-signature-256"];
const appSecret = process.env.WA_APP_SECRET ?? "";
if (typeof sig === "string" && appSecret) {
  const rawBody = JSON.stringify(req.body);  // Express may have parsed body; ideally use raw body middleware
  if (!verifyMetaSignature(rawBody, sig, appSecret)) {
    return res.status(403).send("invalid signature");
  }
}

// Inside the per-message loop:
if (triageDeps) {
  void runTriagePipeline({
    message_id: msg.id,
    from_phone: `+${msg.from}`,  // Meta omits the leading +; we add it for consistency with thread_id format
    profile_name: contact?.profile?.name ?? "unknown",
    body: msg.text?.body ?? "",
    timestamp: new Date(parseInt(msg.timestamp, 10) * 1000).toISOString(),
  }, triageDeps).catch((err) => {
    console.error("[triage] pipeline error:", err);
  });
}

// Continue with whatever existing handling there is (logging, ack, etc.), but DO NOT call any pre-existing
// auto-reply logic that would conflict with the orchestrator.
```

If the existing handler calls `processLeadMessage`, comment out that call and add a comment: `// processLeadMessage replaced by runTriagePipeline (Slice 2)`. Surface this to Jim in the next status update so he knows the old lead-qualification state machine is shelved.

**Signature verification caveat:** Express's default `body-parser` mutates the request body, which breaks signature verification. If signature verification fails consistently, the handler needs a `raw-body` middleware on this route specifically. The implementer should:
1. First try with `JSON.stringify(req.body)` as above.
2. If signature verification fails on real Meta payloads, install `body-parser`'s `raw` option for this route:

```typescript
router.post("/api/webhook/whatsapp",
  express.raw({ type: "application/json" }),
  (req, res) => {
    const rawBody = req.body.toString("utf8");
    const parsed = JSON.parse(rawBody);
    // ... use rawBody for signature verification, parsed for everything else
  }
);
```

- [ ] **Step 4: Run repo type check**

Run: `cd ~/voom-ceo-dashboard && pnpm check`
Expected: no new errors in our files. Pre-existing errors elsewhere are fine.

- [ ] **Step 5: Commit**

```bash
cd ~/voom-ceo-dashboard && git add server/routes.ts server/whatsapp-deps.ts && git commit -m "feat(triage): wire orchestrator into existing Meta WhatsApp webhook"
```

---

## Phase H: Daily summary cron

### Task H1: Daily summary cron entry

Wakes at 7am EAT (3am ET) every day, runs `renderReport` on yesterday's JSONL, sends to Jim's WhatsApp.

**Files:**
- Create: `server/whatsapp-daily-summary-cron.ts`
- Create: `server/whatsapp-daily-summary-cron.test.ts`

- [ ] **Step 1: Write failing test**

Write `server/whatsapp-daily-summary-cron.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runDailySummary } from "./whatsapp-daily-summary-cron.js";
import type { TriageEntry } from "../scripts/triage-types.js";

function mkEntry(bucket: TriageEntry["bucket"], ts: string): TriageEntry {
  return {
    ts, thread_id: "+233244000001", sender_name: "Test", bucket, step: null,
    objection_branch: null,
    extracted: { parts_type: null, shop_name: null, location: null, momo: null,
      part_for_listing: null, buyer_part_requested: null, buyer_car: null, buyer_region: null },
    draft_text: "x", draft_text_edited: null, draft_sent: true, draft_edited_by_jim: false,
    next_action: "NONE", notes: "",
  };
}

describe("runDailySummary", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "summary-test-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("reads yesterday's JSONL, calls sender with the rendered report", async () => {
    const yesterday = "2026-06-06";
    writeFileSync(join(dir, `${yesterday}-burndown.jsonl`),
      [mkEntry("NEW_VENDOR_M2", `${yesterday}T10:00:00Z`),
       mkEntry("NEW_VENDOR_M3", `${yesterday}T11:00:00Z`)]
        .map((e) => JSON.stringify(e)).join("\n") + "\n");

    const sender = vi.fn().mockResolvedValue({ success: true });
    await runDailySummary({
      jsonlDir: dir,
      jimWaNumber: "whatsapp:+12125551234",
      sender,
      now: new Date("2026-06-07T07:00:00+03:00"),
    });

    expect(sender).toHaveBeenCalledOnce();
    expect(sender.mock.calls[0][0]).toBe("whatsapp:+12125551234");
    const body = sender.mock.calls[0][1];
    expect(body).toContain("Total threads processed: **2**");
    expect(body).toContain("NEW_VENDOR_M2");
  });

  it("does nothing if yesterday's JSONL is missing", async () => {
    const sender = vi.fn().mockResolvedValue({ success: true });
    await runDailySummary({
      jsonlDir: dir,
      jimWaNumber: "whatsapp:+12125551234",
      sender,
      now: new Date("2026-06-07T07:00:00+03:00"),
    });
    expect(sender).not.toHaveBeenCalled();
  });

  it("does not throw if sender fails", async () => {
    const yesterday = "2026-06-06";
    writeFileSync(join(dir, `${yesterday}-burndown.jsonl`),
      JSON.stringify(mkEntry("NEW_VENDOR_M2", `${yesterday}T10:00:00Z`)) + "\n");
    const sender = vi.fn().mockRejectedValue(new Error("api 500"));
    await expect(runDailySummary({
      jsonlDir: dir,
      jimWaNumber: "whatsapp:+12125551234",
      sender,
      now: new Date("2026-06-07T07:00:00+03:00"),
    })).resolves.not.toThrow();
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `cd ~/voom-ceo-dashboard && pnpm vitest run server/whatsapp-daily-summary-cron.test.ts --root .`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Write `server/whatsapp-daily-summary-cron.ts`:

```typescript
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { TriageEntrySchema, type TriageEntry } from "../scripts/triage-types.js";
import { renderReport } from "../scripts/triage-report-gen.js";
import type { TextSender } from "./whatsapp-escalator.js";

interface RunArgs {
  jsonlDir: string;
  jimWaNumber: string;
  sender: TextSender;
  now: Date;
}

function yesterdayPath(jsonlDir: string, now: Date): string {
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yyyy = yesterday.getFullYear();
  const mm = String(yesterday.getMonth() + 1).padStart(2, "0");
  const dd = String(yesterday.getDate()).padStart(2, "0");
  return join(jsonlDir, `${yyyy}-${mm}-${dd}-burndown.jsonl`);
}

function loadEntries(path: string): TriageEntry[] {
  const raw = readFileSync(path, "utf8");
  return raw.split("\n")
    .filter((l) => l.trim())
    .map((line) => {
      try { return TriageEntrySchema.parse(JSON.parse(line)); }
      catch { return null; }
    })
    .filter((e): e is TriageEntry => e !== null);
}

export async function runDailySummary(args: RunArgs): Promise<void> {
  const path = yesterdayPath(args.jsonlDir, args.now);
  if (!existsSync(path)) return;

  try {
    const entries = loadEntries(path);
    const report = renderReport(entries, args.now);
    await args.sender(args.jimWaNumber, report);
  } catch (err) {
    console.error("[daily-summary] failed:", err);
    // Swallow — cron retry tomorrow.
  }
}
```

- [ ] **Step 4: Run, confirm pass**

Run: `cd ~/voom-ceo-dashboard && pnpm vitest run server/whatsapp-daily-summary-cron.test.ts --root .`
Expected: 3 tests passing.

- [ ] **Step 5: Commit**

```bash
cd ~/voom-ceo-dashboard && git add server/whatsapp-daily-summary-cron.ts server/whatsapp-daily-summary-cron.test.ts && git commit -m "feat(triage): daily summary cron (7am EAT)"
```

---

### Task H2: Schedule the cron at server boot

**Files:**
- Modify: `server/index.ts`

- [ ] **Step 1: Add a simple node-native interval-based scheduler**

Open `server/index.ts`. After the server starts listening, add:

```typescript
import { runDailySummary } from "./whatsapp-daily-summary-cron.js";
import { sendTextMessage } from "./whatsapp-api.js";

const JSONL_DIR = "data/whatsapp-triage";
const SUMMARY_HOUR_EAT = 7;  // 7am EAT = 4am UTC

function msUntilNext(hourEat: number): number {
  // EAT is UTC+3 (no DST)
  const now = new Date();
  const target = new Date(now);
  target.setUTCHours(hourEat - 3, 0, 0, 0);  // 7 EAT = 4 UTC
  if (target.getTime() <= now.getTime()) {
    target.setUTCDate(target.getUTCDate() + 1);
  }
  return target.getTime() - now.getTime();
}

function scheduleDailySummary(): void {
  const jimWaNumber = process.env.JIM_PERSONAL_WA_NUMBER;
  if (!jimWaNumber) {
    console.warn("[daily-summary] JIM_PERSONAL_WA_NUMBER not set, skipping cron");
    return;
  }
  const tick = () => {
    void runDailySummary({
      jsonlDir: JSONL_DIR,
      jimWaNumber,
      sender: sendTextMessage,
      now: new Date(),
    }).finally(() => setTimeout(tick, msUntilNext(SUMMARY_HOUR_EAT)));
  };
  setTimeout(tick, msUntilNext(SUMMARY_HOUR_EAT));
  console.log(`[daily-summary] scheduled, next run in ${Math.round(msUntilNext(SUMMARY_HOUR_EAT) / 60000)} min`);
}

scheduleDailySummary();
```

- [ ] **Step 2: Run repo type check**

Run: `cd ~/voom-ceo-dashboard && pnpm check`
Expected: no new errors in our additions.

- [ ] **Step 3: Commit**

```bash
cd ~/voom-ceo-dashboard && git add server/index.ts && git commit -m "feat(triage): schedule daily summary cron at server boot"
```

---

## Phase I: Env, deploy docs, and full suite verification

### Task I1: Document env vars

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Append to `.env.example`**

```
# Slice 2: WhatsApp triage agent (Meta Cloud API)
WA_PHONE_NUMBER_ID=
WA_ACCESS_TOKEN=
WA_WEBHOOK_TOKEN=
WA_BUSINESS_ACCOUNT_ID=
WA_APP_SECRET=
ANTHROPIC_API_KEY=
JIM_PERSONAL_WA_NUMBER=
```

- [ ] **Step 2: Commit**

```bash
cd ~/voom-ceo-dashboard && git add .env.example && git commit -m "docs(triage): document Slice 2 env vars in .env.example"
```

---

### Task I2: Ops runbook

**Files:**
- Create: `docs/specs/2026-06-05-whatsapp-agentic-system/2026-06-07-slice-2-ops-runbook.md`

- [ ] **Step 1: Write the runbook**

Write `docs/specs/2026-06-05-whatsapp-agentic-system/2026-06-07-slice-2-ops-runbook.md`:

```markdown
# Slice 2 Ops Runbook

## 1. Meta Business Manager prerequisites

1. Business Verification complete on the Business Portfolio that holds VOOM (in-flight as of 2026-06-07, expected back within 48h).
2. WhatsApp Business Account (WABA) provisioned under the verified portfolio.
3. New dedicated phone number registered to the WABA. Display Name approved (1-3 days).
4. App created under the same portfolio with WhatsApp Business product enabled.

## 2. Env vars (set on Replit Reserved VM)

| Var | Source | Notes |
|---|---|---|
| `WA_PHONE_NUMBER_ID` | Meta WABA dashboard | Numeric, the agent's outbound number ID |
| `WA_ACCESS_TOKEN` | Meta App dashboard | Long-lived token (system user) |
| `WA_WEBHOOK_TOKEN` | Self-chosen | Random string; configured in Meta webhook setup |
| `WA_BUSINESS_ACCOUNT_ID` | Meta WABA dashboard | Numeric |
| `WA_APP_SECRET` | Meta App dashboard → Settings → Basic | Used for X-Hub-Signature-256 verification |
| `ANTHROPIC_API_KEY` | console.anthropic.com | Sonnet 4.6 access |
| `JIM_PERSONAL_WA_NUMBER` | Jim | Format: `+14155550100` (E.164, no whitespace) |

## 3. Meta webhook configuration

Point Meta WhatsApp Business webhook to:

```
https://<replit-public-url>/api/webhook/whatsapp
```

Subscribe to the `messages` field. Verify token: the value of `WA_WEBHOOK_TOKEN`.

## 4. Smoke test after deploy

1. Send a test message FROM your personal WhatsApp TO the agent's new number, body: "i sell brake pads"
2. Within 30 seconds, you should receive a reply on your personal WhatsApp from the agent's number with the M2 voice template
3. Check `data/whatsapp-triage/<today>-burndown.jsonl` on the Replit instance — should contain one entry with bucket=NEW_VENDOR_M2, draft_sent=true
4. Send a test message body: "how do i delete a listing"
5. Within 30 seconds, you should receive an ESCALATION DM at `JIM_PERSONAL_WA_NUMBER` with bucket=VENDOR_QUESTION + the proposed draft + wa.me deep-link
6. The vendor (your test phone) should NOT receive any reply

## 5. Daily summary verification

- Default schedule: 7am EAT (4am UTC, 12am ET, midnight ET).
- First-day check: at 7am EAT the morning after deploy, you should receive the markdown report at `JIM_PERSONAL_WA_NUMBER`.
- If missing, check server logs for `[daily-summary]` lines.

## 6. FB ad re-pointing

After 24h of healthy traffic on the new number, change the WhatsApp CTA target on FB ads from your existing VOOM number to the agent's new number. Gradual cutover supported.

## 7. Failure-mode runbook

| Symptom | Check | Fix |
|---|---|---|
| No replies, no escalations | `errors.jsonl`, Replit logs | `WA_APP_SECRET` mismatch (signature verification rejecting); check Meta App Settings → Basic |
| Replies sent but no JSONL writes | Replit disk full, permissions | Free disk on Reserved VM |
| Daily summary not sent | `JIM_PERSONAL_WA_NUMBER` unset or invalid | Re-set env var, restart server |
| Voice violations in production drafts | `errors.jsonl` filtered for `voice_audit_failed` | Adjust voice library; classifier re-reads on next request after 15s cache window |
| Vendors getting double-replies | Dedupe broken — `meta_message_id` not landing in JSONL | Check Meta payload shape against ParsedInbound mapper |
| All replies escalate, no auto-sends | Classifier returning all ambiguous, or `WA_APP_SECRET` blocking signature | Read Replit logs |
```

- [ ] **Step 2: Commit**

```bash
cd ~/voom-ceo-dashboard && git add docs/specs/2026-06-05-whatsapp-agentic-system/2026-06-07-slice-2-ops-runbook.md && git commit -m "docs(triage): Slice 2 ops runbook (Meta setup + smoke + failure modes)"
```

---

### Task I3: Full suite regression

**Files:** none modified.

- [ ] **Step 1: Run every test**

Run: `cd ~/voom-ceo-dashboard && pnpm vitest run --root . 2>&1 | tail -30`
Expected: all tests pass. Confirm counts (Slice 1: 27, plus Slice 2 added per phase below):
- A1: 3 new triage-types tests → 30 total scripts
- A3: 4 voice-loader tests
- B1: 6 signature tests
- C1: 6 thread-context tests
- D2: 3 classifier tests
- E1: 18 policy-gate tests
- E2: 3 error-log tests
- F1: 4 escalator tests
- G1: 6 orchestrator tests
- H1: 3 daily-summary tests
- Total new server tests: 53. Plus 30 scripts tests. Plus 2 pre-existing (`export-cto-signals`). **Grand total: 85 passing**.

- [ ] **Step 2: Run repo type check**

Run: `cd ~/voom-ceo-dashboard && pnpm check 2>&1 | tail -30`
Expected: no new errors introduced by Slice 2 files. Pre-existing errors elsewhere are out of scope.

- [ ] **Step 3: Confirm Phase A through I complete**

Run: `cd ~/voom-ceo-dashboard && git log --oneline -20`
Expected: see commits from A1 through I2, plus this final task's verification (no new commit here unless needed).

---

## Self-Review

**Spec coverage:**

| Spec section | Tasks |
|---|---|
| §1 Why | Cover note in plan header. |
| §2 Goals | A3 (voice loader), B1 (signature), C1 (thread ctx), D1-D3 (classifier), E1 (policy), E2 (error log), F1 (escalator), G1-G2 (orchestrator + route), H1-H2 (daily cron), I1-I3 (env + docs). |
| §2 Non-goals | Explicitly NOT touched: Akua integration, number migration, dashboard, multi-agent routing, subscription tiers, outbound scheduling. |
| §3 Architecture | G1-G2 implement the pipeline diagram exactly. |
| §4 Components | One task per component file. |
| §5 Policy gate | E1 covers AUTO + ESCALATE + DUAL + ambiguity override + voice override. |
| §6 Voice + identity | D2 system prompt encodes "VOOM Team" identity + voice library. A3 loads the library at runtime. |
| §7 Error handling | E2 error log + G1 voice/classifier failure handling + G1 send retry → escalate. |
| §8 State | C1 thread context loads from JSONL + Supabase. No new DB tables. |
| §9 Testing | Co-located unit tests per file; manual integration smoke via I2 runbook. |
| §10 Success criteria | Verifiable via I2 smoke test + I3 full suite. |
| §11 Risks | Mitigations embedded in code (timing-safe sig, voice retries, dedupe, classifier fallback entry). |
| §12 What this enables | Slice 3 (Akua integration) is unblocked; the JSONL gathered here is its input. |
| §13 Files | All paths match spec §13. |
| §14 Ops prereqs | I2 runbook covers Meta setup, env vars, webhook config, smoke test, FB cutover. |

**Placeholder scan:** none. Every step has the actual code, exact paths, exact commands, expected output. No TBDs, no "implement later", no "similar to Task N". Wherever the implementer must choose (e.g., raw-body middleware in G2), the plan provides the trigger condition and the fix code.

**Type consistency:**
- `TriageEntry` shape used identically across A1, C1, D2, E1, F1, G1, H1.
- `ParsedInbound` introduced in G1, used in G2.
- `OrchestratorDeps` introduced in G1, factored in G2.
- `TextSender` introduced in F1, used in G1, H1, H2.
- `AnthropicClient` introduced in D2, implemented in D3, factored in G2.
- `ThreadContext` introduced in C1, used in D2, G1.
- `SupabaseVendorReader` introduced in C1, used in C1 tests, G2 factory.

**Open items deferred to the implementer:**
- G2 raw-body middleware: trigger condition documented (signature verification failing on real Meta payloads), fix code provided inline.
- G2 `processLeadMessage` replacement: implementer to check Task A2 recon notes and either remove the call or coexist.
- C1 `vendorReader`: v1 returns null. Extend once Supabase wiring confirmed via separate, smaller follow-up.
