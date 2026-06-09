# Agentic CEO Dashboard — A1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship subsystem A1 — a chat panel on the VOOM CEO dashboard that answers natural-language questions using 9 read-only tools, on mobile and desktop, with cost and rate caps.

**Architecture:** Server-side Anthropic SDK with Claude Sonnet 4.6, prompt-cached system prompt holding VOOM context + a hand-written schema dump + tool catalog. Tools wrap existing GET endpoints by calling them in-process. Streaming via Server-Sent Events. Threads persist in three new Postgres tables. Floating chat button on every dashboard page opens a bottom sheet (mobile) / side panel (desktop) built with Radix + Tailwind, consuming SSE via the Fetch API.

**Tech Stack:** TypeScript, Express, `@anthropic-ai/sdk`, Drizzle ORM, Supabase (Postgres), React 19, Radix UI, Tailwind, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-07-agentic-ceo-dashboard-A-chat-query-layer-design.md`

**Out of scope for A1** (deferred):
- A2: `render_chart` tool + inline Recharts rendering
- A3: `run_sql` tool + curated views + parser guard
- A4: `+1/-1` feedback UI + telemetry rollup + cost dashboard tile

---

## Task 0: Branch, dependencies, environment

**Files:**
- Modify: `package.json`
- Modify: `.env.example`
- Modify: `server/index.ts:18-25` (envSchema)

- [ ] **Step 1: Cut a feature branch**

```bash
cd ~/voom-ceo-dashboard
git checkout -b feat/agent-A1
```

- [ ] **Step 2: Install runtime + dev dependencies**

```bash
pnpm add @anthropic-ai/sdk
pnpm add -D @types/node
```

Expected: lockfile updated, no peer-dep warnings beyond existing.

- [ ] **Step 3: Extend `.env.example` with the new vars**

Append to `.env.example`:

```
# --- Agent A1 (chat + query layer) ---
ANTHROPIC_API_KEY=sk-ant-...
AGENT_MODEL=claude-sonnet-4-6
MAX_AGENT_MESSAGES_PER_HOUR=30
MAX_AGENT_MESSAGES_PER_DAY=200
MAX_DAILY_AGENT_SPEND_CENTS=500
MAX_TOOL_CALLS_PER_TURN=8
AGENT_SPEND_ALERT_EMAIL=sales@voomparts.com
```

- [ ] **Step 4: Extend envSchema in `server/index.ts`**

Replace the envSchema (around line 18) with:

```ts
const envSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
  PORT: z.string().regex(/^\d+$/).optional(),
  DASHBOARD_API_KEY: z.string().min(1).optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).optional(),
  ALLOWED_ORIGINS: z.string().optional(),
  // Agent A1
  ANTHROPIC_API_KEY: z.string().startsWith("sk-ant-").optional(),
  AGENT_MODEL: z.string().default("claude-sonnet-4-6"),
  MAX_AGENT_MESSAGES_PER_HOUR: z.coerce.number().int().positive().default(30),
  MAX_AGENT_MESSAGES_PER_DAY: z.coerce.number().int().positive().default(200),
  MAX_DAILY_AGENT_SPEND_CENTS: z.coerce.number().int().positive().default(500),
  MAX_TOOL_CALLS_PER_TURN: z.coerce.number().int().positive().default(8),
  AGENT_SPEND_ALERT_EMAIL: z.string().email().default("sales@voomparts.com"),
});
```

- [ ] **Step 5: Verify type-check passes**

```bash
pnpm check
```

Expected: no TS errors.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml .env.example server/index.ts
git commit -m "chore(agent): add anthropic SDK and agent env vars"
```

---

## Task 1: Schema migration + Drizzle table definitions

**Files:**
- Create: `migrations/003_agent_chat_tables.sql`
- Modify: `shared/schema.ts` (append new tables)

- [ ] **Step 1: Write the migration SQL**

Create `migrations/003_agent_chat_tables.sql`:

```sql
-- Migration: Agent A1 chat + query layer tables
-- Run this in the Supabase SQL Editor (Dashboard > SQL > New Query)
--
-- Creates three tables: agent_threads, agent_messages, agent_daily_spend.
-- All A1 chat traffic logs here. Used by A4 for telemetry rollups.

CREATE TABLE IF NOT EXISTS agent_threads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_threads_last_message
  ON agent_threads(last_message_at DESC);

CREATE TABLE IF NOT EXISTS agent_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id     UUID NOT NULL REFERENCES agent_threads(id) ON DELETE CASCADE,
  role          TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content       TEXT NOT NULL,
  tool_calls    JSONB,
  tool_results  JSONB,
  tokens_in     INTEGER,
  tokens_out    INTEGER,
  cost_cents    NUMERIC(10, 4),
  latency_ms    INTEGER,
  feedback      SMALLINT NOT NULL DEFAULT 0 CHECK (feedback IN (-1, 0, 1)),
  page_context  JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_messages_thread
  ON agent_messages(thread_id, created_at);

CREATE INDEX IF NOT EXISTS idx_agent_messages_feedback
  ON agent_messages(feedback) WHERE feedback <> 0;

CREATE TABLE IF NOT EXISTS agent_daily_spend (
  day           DATE PRIMARY KEY,
  cents_spent   NUMERIC(10, 4) NOT NULL DEFAULT 0,
  message_count INTEGER NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- [ ] **Step 2: Append Drizzle definitions to `shared/schema.ts`**

Append to the end of `shared/schema.ts`:

```ts
// ─── Agent A1 (chat + query layer) ─────────────────────────

export const agentThreads = pgTable("agent_threads", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
});

export const agentMessages = pgTable("agent_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  threadId: uuid("thread_id")
    .notNull()
    .references(() => agentThreads.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // 'user' | 'assistant' | 'tool'
  content: text("content").notNull(),
  toolCalls: jsonb("tool_calls"),
  toolResults: jsonb("tool_results"),
  tokensIn: integer("tokens_in"),
  tokensOut: integer("tokens_out"),
  costCents: numeric("cost_cents", { precision: 10, scale: 4 }),
  latencyMs: integer("latency_ms"),
  feedback: smallint("feedback").notNull().default(0),
  pageContext: jsonb("page_context"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const agentDailySpend = pgTable("agent_daily_spend", {
  day: date("day").primaryKey(),
  centsSpent: numeric("cents_spent", { precision: 10, scale: 4 }).notNull().default("0"),
  messageCount: integer("message_count").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

If any of `uuid`, `jsonb`, `integer`, `numeric`, `smallint`, `date`, `text`, `timestamp` are not already imported at the top of `shared/schema.ts`, add them to the existing drizzle-orm import line.

- [ ] **Step 3: Verify type-check passes**

```bash
pnpm check
```

Expected: no TS errors.

- [ ] **Step 4: Jim runs the migration in Supabase**

**STOP here and tell Jim:**

> "Migration 003 is ready. Please open the Supabase SQL Editor and run `migrations/003_agent_chat_tables.sql`. Reply when done."

(Per Jim's `feedback_sql_for_jim_pure_only` memory rule, the SQL block above is pure — no inline commentary — so he can paste it directly.)

- [ ] **Step 5: Commit**

```bash
git add migrations/003_agent_chat_tables.sql shared/schema.ts
git commit -m "feat(agent): A1 schema — threads, messages, daily spend"
```

---

## Task 2: Schema dump module (hand-written for v1)

**Files:**
- Create: `server/agent/schema-dump.ts`

A1 ships with a hand-written schema dump. Nightly Supabase introspection is deferred to A4.

- [ ] **Step 1: Create `server/agent/schema-dump.ts`**

```ts
// Hand-written schema dump for Agent A1.
// Lists every table and column the agent can reason about, with one-line meanings.
// This file ships as part of the cached system prompt.
//
// When the marketplace schema changes, update this file.
// Live introspection is deferred to A4.

export const SCHEMA_DUMP = `
TABLE vendors  (~330 rows; admin-approved businesses)
  id                      uuid     primary key
  businessName            text     vendor's trade name
  city                    text     'Accra' | 'Tema' | 'Kumasi' | ...
  status                  enum     'pending' | 'approved' | 'rejected' | 'suspended'
  tier                    enum     'free' | 'starter' | 'pro'
  pipelineStage           enum     'lead' | 'contacted' | 'responded' | 'claimed' | 'active' | 'churned'
  verified                boolean  legacy flag, broken (do not cite)
  featured                boolean  shown on homepage
  createdAt               timestamptz
  // Note: phone, ghanaCardNumber, idDocumentUrl are PII — never include in answers.

TABLE products
  id                      uuid     primary key
  vendorId                uuid     -> vendors.id
  title                   text     listing title
  priceGhsCents           bigint   price in GHS cents
  status                  enum     'active' | 'inactive' | 'sold' | 'archived'
  condition               enum     'new' | 'used' | 'refurbished'
  views                   integer  cumulative view count
  whatsappTaps            integer  cumulative WhatsApp click count
  createdAt               timestamptz

TABLE orders
  id                      uuid     primary key
  vendorId                uuid     -> vendors.id
  buyerCity               text     where the buyer is
  totalGhsCents           bigint
  status                  enum     'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  paymentMethod           text     'remitly' | 'cash' | ...
  createdAt               timestamptz
  deliveredAt             timestamptz

TABLE analytics_events (last 90 days only; everything else aggregated)
  id                      uuid     primary key
  eventType               enum     'product_view' | 'vendor_view' | 'search' | 'whatsapp_tap' | 'filter_used' | 'page_leave' | 'signup_*' | ...
  userId                  uuid     nullable for anon
  metadata                jsonb    event-specific payload
  createdAt               timestamptz

TABLE part_requests
  id                      uuid     primary key
  vehicleMake             text     'Toyota' | 'Honda' | ...
  vehicleModel            text
  budgetGhsCents          bigint
  status                  enum     'open' | 'matched' | 'closed'
  createdAt               timestamptz

TABLE users
  id                      uuid     primary key
  role                    enum     'buyer' | 'vendor' | 'admin'
  createdAt               timestamptz
  // Note: phone, email, passwordHash are PII — never include in answers.

TABLE wa_leads
  id                      uuid     primary key
  source                  text     where the lead came from
  status                  enum     'new' | 'contacted' | 'qualified' | 'lost'
  isTest                  boolean  true for synthetic test rows; default false
  createdAt               timestamptz

GLOSSARY (VOOM business terms):
  - "dormant vendor"   = approved + 0 listings + 14+ days since signup
  - "tier-up"          = vendor moving from free -> starter (or starter -> pro)
  - "48K traffic"      = monthly site visits, NOT users or MAUs
  - "Ghana Card-verified" = DO NOT USE; the verified flag is broken (see vendors.verified note)
  - "real lead"        = wa_leads.isTest = false
  - "GHS"              = Ghana Cedi; amounts are stored in cents (divide by 100 for display)

POSTGRES NOTES:
  - camelCase columns must be double-quoted: "businessName", "createdAt", "eventType"
  - enum columns need ::text cast for LIKE: WHERE "status"::text LIKE 'app%'
  - equality on enums does NOT need cast: WHERE "status" = 'approved'
`.trim();
```

- [ ] **Step 2: Type-check**

```bash
pnpm check
```

- [ ] **Step 3: Commit**

```bash
git add server/agent/schema-dump.ts
git commit -m "feat(agent): A1 hand-written schema dump for system prompt"
```

---

## Task 3: Rate-limit and spend-cap module (TDD)

**Files:**
- Create: `server/agent/limits.ts`
- Create: `server/agent/limits.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `server/agent/limits.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkLimits, recordSpend, LimitError } from "./limits.js";

const mockDb = {
  hourlyCount: 0,
  dailyCount: 0,
  centsSpent: 0,
};

vi.mock("../supabase.js", () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        gte: () => ({
          eq: () => Promise.resolve({ count: mockDb.hourlyCount, data: [], error: null }),
        }),
      }),
      upsert: (row: any) => {
        mockDb.centsSpent = Number(row.cents_spent ?? 0);
        mockDb.dailyCount = Number(row.message_count ?? 0);
        return Promise.resolve({ error: null });
      },
    }),
  },
}));

describe("agent limits", () => {
  beforeEach(() => {
    mockDb.hourlyCount = 0;
    mockDb.dailyCount = 0;
    mockDb.centsSpent = 0;
    process.env.MAX_AGENT_MESSAGES_PER_HOUR = "30";
    process.env.MAX_AGENT_MESSAGES_PER_DAY = "200";
    process.env.MAX_DAILY_AGENT_SPEND_CENTS = "500";
  });

  it("passes when all caps are unhit", async () => {
    await expect(checkLimits()).resolves.toBeUndefined();
  });

  it("throws LimitError when hourly cap is hit", async () => {
    mockDb.hourlyCount = 30;
    await expect(checkLimits()).rejects.toBeInstanceOf(LimitError);
    await expect(checkLimits()).rejects.toMatchObject({ cap: "hourly" });
  });

  it("throws LimitError when daily message cap is hit", async () => {
    mockDb.dailyCount = 200;
    await expect(checkLimits()).rejects.toMatchObject({ cap: "daily_messages" });
  });

  it("throws LimitError when daily spend cap is hit", async () => {
    mockDb.centsSpent = 500;
    await expect(checkLimits()).rejects.toMatchObject({ cap: "daily_spend" });
  });

  it("recordSpend increments cents and count", async () => {
    await recordSpend({ cents: 1.5, messageCount: 1 });
    expect(mockDb.centsSpent).toBe(1.5);
    expect(mockDb.dailyCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
pnpm vitest run server/agent/limits.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `server/agent/limits.ts`**

```ts
import { supabase } from "../supabase.js";

export type LimitCap = "hourly" | "daily_messages" | "daily_spend";

export class LimitError extends Error {
  cap: LimitCap;
  retryAfterSeconds?: number;
  constructor(cap: LimitCap, message: string, retryAfterSeconds?: number) {
    super(message);
    this.cap = cap;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function oneHourAgoIso(): string {
  return new Date(Date.now() - 60 * 60 * 1000).toISOString();
}

export async function checkLimits(): Promise<void> {
  if (!supabase) return; // dev mode without DB

  const maxHour = Number(process.env.MAX_AGENT_MESSAGES_PER_HOUR ?? 30);
  const maxDay = Number(process.env.MAX_AGENT_MESSAGES_PER_DAY ?? 200);
  const maxCents = Number(process.env.MAX_DAILY_AGENT_SPEND_CENTS ?? 500);

  // Hourly count of user messages
  const hourlyResp = await supabase
    .from("agent_messages")
    .select("id", { count: "exact", head: true })
    .gte("created_at", oneHourAgoIso())
    .eq("role", "user");
  const hourlyCount = (hourlyResp as any).count ?? 0;
  if (hourlyCount >= maxHour) {
    throw new LimitError("hourly", `Hourly limit of ${maxHour} hit`, 60 * 60);
  }

  // Daily spend + count
  const dayResp = await supabase
    .from("agent_daily_spend")
    .select("cents_spent, message_count")
    .eq("day", today())
    .maybeSingle();
  const cents = Number((dayResp.data as any)?.cents_spent ?? 0);
  const count = Number((dayResp.data as any)?.message_count ?? 0);

  if (count >= maxDay) {
    throw new LimitError("daily_messages", `Daily message limit of ${maxDay} hit`);
  }
  if (cents >= maxCents) {
    throw new LimitError("daily_spend", `Daily spend cap of ${maxCents}¢ hit`);
  }
}

export async function recordSpend(input: { cents: number; messageCount: number }): Promise<void> {
  if (!supabase) return;
  const day = today();
  const existing = await supabase
    .from("agent_daily_spend")
    .select("cents_spent, message_count")
    .eq("day", day)
    .maybeSingle();
  const prevCents = Number((existing.data as any)?.cents_spent ?? 0);
  const prevCount = Number((existing.data as any)?.message_count ?? 0);

  await supabase.from("agent_daily_spend").upsert({
    day,
    cents_spent: prevCents + input.cents,
    message_count: prevCount + input.messageCount,
    updated_at: new Date().toISOString(),
  });
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm vitest run server/agent/limits.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/agent/limits.ts server/agent/limits.test.ts
git commit -m "feat(agent): A1 rate + spend limit guard with tests"
```

---

## Task 4: Tool registry — first 4 GET wrappers (TDD)

**Files:**
- Create: `server/agent/tools.ts`
- Create: `server/agent/tools.test.ts`

The tool registry exposes typed tools the LLM can call. Each wrapper invokes the existing GET handler in-process via a thin fetch to `http://localhost:${PORT}` — same network the dashboard already runs.

- [ ] **Step 1: Write failing tests for the first 4 tools**

Create `server/agent/tools.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TOOLS, callTool } from "./tools.js";

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe("tools registry", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    process.env.PORT = "3001";
  });

  it("exposes a stable list of tool names", () => {
    const names = TOOLS.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        "get_funnel",
        "get_metrics",
        "get_orders",
        "get_part_requests",
        "get_supply_demand_gaps",
        "get_vendor",
        "get_verification_queue",
        "get_whatsapp_leads",
        "list_vendors",
      ].sort()
    );
  });

  it("each tool has a typed input_schema with type:object", () => {
    for (const t of TOOLS) {
      expect(t.input_schema.type).toBe("object");
      expect(typeof t.description).toBe("string");
      expect(t.description.length).toBeGreaterThan(10);
    }
  });

  it("list_vendors calls GET /api/vendors with filter params", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ vendors: [{ id: "v1", businessName: "Test" }] }),
    });
    const result = await callTool("list_vendors", { city: "Accra", tier: "free" });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/vendors?"),
      expect.any(Object)
    );
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("city=Accra");
    expect(url).toContain("tier=free");
    expect(result).toEqual({ vendors: [{ id: "v1", businessName: "Test" }] });
  });

  it("get_vendor calls GET /api/vendors/:id", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ id: "abc" }) });
    await callTool("get_vendor", { id: "abc" });
    expect(mockFetch.mock.calls[0][0]).toContain("/api/vendors/abc");
  });

  it("callTool returns {error} when upstream is non-ok", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, text: async () => "boom" });
    const result = await callTool("get_vendor", { id: "x" });
    expect(result).toHaveProperty("error");
  });

  it("callTool returns {error} for unknown tool", async () => {
    const result = await callTool("does_not_exist" as any, {});
    expect(result).toHaveProperty("error");
  });
});
```

- [ ] **Step 2: Run tests to confirm fail**

```bash
pnpm vitest run server/agent/tools.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `server/agent/tools.ts`**

```ts
import { safeLogError } from "../index.js";

export interface Tool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
  // The fn returns whatever the upstream endpoint returns, JSON-serializable.
  fn: (args: any) => Promise<any>;
}

function apiBase(): string {
  const port = process.env.PORT ?? "3001";
  return `http://127.0.0.1:${port}`;
}

async function getJson(path: string): Promise<any> {
  const url = `${apiBase()}${path}`;
  try {
    const r = await fetch(url, {
      headers: process.env.DASHBOARD_API_KEY
        ? { "x-api-key": process.env.DASHBOARD_API_KEY }
        : {},
    });
    if (!(r as any).ok) {
      const body = await (r as any).text();
      return { error: `upstream ${(r as any).status}: ${body.slice(0, 200)}` };
    }
    return await (r as any).json();
  } catch (e) {
    safeLogError("agent.getJson", e);
    return { error: "upstream request failed" };
  }
}

function qs(params: Record<string, any>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

export const TOOLS: Tool[] = [
  {
    name: "list_vendors",
    description:
      "List vendors with optional filters. Use for cohort questions like 'Accra vendors with tier=free' or 'unclaimed vendors signed up this month'.",
    input_schema: {
      type: "object",
      properties: {
        city: { type: "string", description: "City name, e.g. 'Accra'" },
        tier: { type: "string", enum: ["free", "starter", "pro"] },
        status: {
          type: "string",
          enum: ["pending", "approved", "rejected", "suspended"],
        },
        hasListings: { type: "boolean", description: "true = has >0 active products" },
        businessName: { type: "string", description: "partial match on name" },
        limit: { type: "integer", minimum: 1, maximum: 200 },
      },
    },
    fn: async (args) => getJson(`/api/vendors${qs(args)}`),
  },
  {
    name: "get_vendor",
    description: "Fetch one vendor's full profile, recent orders, and listing count.",
    input_schema: {
      type: "object",
      properties: { id: { type: "string", description: "vendor UUID" } },
      required: ["id"],
    },
    fn: async (args) => getJson(`/api/vendors/${encodeURIComponent(args.id)}`),
  },
  {
    name: "get_metrics",
    description:
      "High-level marketplace metrics (vendors, products, orders, GMV) plus growth and revenue series.",
    input_schema: {
      type: "object",
      properties: {
        range: {
          type: "string",
          enum: ["today", "7d", "30d", "90d"],
          description: "Time window",
        },
      },
    },
    fn: async (args) => {
      const [stats, growth, revenue] = await Promise.all([
        getJson(`/api/stats`),
        getJson(`/api/growth${qs(args)}`),
        getJson(`/api/revenue${qs(args)}`),
      ]);
      return { stats, growth, revenue };
    },
  },
  {
    name: "get_funnel",
    description: "Signup, listing, and buyer-search funnels.",
    input_schema: {
      type: "object",
      properties: {
        period: { type: "string", enum: ["7d", "30d", "90d"] },
      },
    },
    fn: async (args) => getJson(`/api/analytics/funnel${qs(args)}`),
  },
  {
    name: "get_supply_demand_gaps",
    description:
      "Parts that buyers searched for but no vendor lists. Highest-leverage cohort for vendor outreach.",
    input_schema: { type: "object", properties: {} },
    fn: async () => getJson(`/api/analytics/supply-demand`),
  },
  {
    name: "get_part_requests",
    description: "Open buyer part requests with vehicle make/model + budget.",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["open", "matched", "closed"] },
        vehicleMake: { type: "string" },
        minBudget: { type: "integer", description: "in GHS cents" },
      },
    },
    fn: async (args) => getJson(`/api/part-requests${qs(args)}`),
  },
  {
    name: "get_whatsapp_leads",
    description: "WhatsApp leads from outreach campaigns. Set isTest=false for real leads only.",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["new", "contacted", "qualified", "lost"] },
        isTest: { type: "boolean" },
        sinceHours: { type: "integer", description: "last N hours" },
      },
    },
    fn: async (args) => getJson(`/api/whatsapp/leads${qs(args)}`),
  },
  {
    name: "get_orders",
    description: "Marketplace orders with filters.",
    input_schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"],
        },
        vendorId: { type: "string" },
        sinceDays: { type: "integer" },
        minTotalCents: { type: "integer" },
      },
    },
    fn: async (args) => getJson(`/api/orders${qs(args)}`),
  },
  {
    name: "get_verification_queue",
    description: "Vendors with documents pending Ghana Card review.",
    input_schema: { type: "object", properties: {} },
    fn: async () => getJson(`/api/verification-queue`),
  },
];

const TOOL_BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

export async function callTool(name: string, args: any): Promise<any> {
  const tool = TOOL_BY_NAME.get(name);
  if (!tool) return { error: `unknown tool: ${name}` };
  try {
    return await tool.fn(args ?? {});
  } catch (e) {
    safeLogError(`agent.callTool[${name}]`, e);
    return { error: `tool ${name} threw` };
  }
}

export function anthropicToolList() {
  return TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm vitest run server/agent/tools.test.ts
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/agent/tools.ts server/agent/tools.test.ts
git commit -m "feat(agent): A1 tool registry with 9 GET wrappers"
```

---

## Task 5: System prompt assembly (TDD)

**Files:**
- Create: `server/agent/system-prompt.ts`
- Create: `server/agent/system-prompt.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/agent/system-prompt.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "./system-prompt.js";

describe("buildSystemPrompt", () => {
  it("includes VOOM identity, schema, tools, voice rules", () => {
    const p = buildSystemPrompt();
    expect(p).toMatch(/VOOM/i);
    expect(p).toMatch(/businessName/);          // schema dump present
    expect(p).toMatch(/list_vendors/);          // tool catalog present
    expect(p).toMatch(/em dash/i);              // voice rule present
    expect(p).toMatch(/4th[- ]grade/i);         // copy rule present
    expect(p).toMatch(/48K/);                   // traffic rule present
  });

  it("is stable across calls (for prompt cache)", () => {
    const a = buildSystemPrompt();
    const b = buildSystemPrompt();
    expect(a).toBe(b);
  });
});
```

- [ ] **Step 2: Run test to confirm fail**

```bash
pnpm vitest run server/agent/system-prompt.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement `server/agent/system-prompt.ts`**

```ts
import { SCHEMA_DUMP } from "./schema-dump.js";
import { TOOLS } from "./tools.js";

const IDENTITY = `
You are the VOOM CEO Dashboard agent. You help Jim, the founder of VOOM (a Ghana auto-parts marketplace), understand his business by answering questions about his marketplace data.

Jim is non-technical. He's Brooklyn-based, runs operations through Justice in Accra. He's mid-fundraise. He values speed, candor, and concrete numbers over hedging.

You can only read. You have no ability to change vendor data, send messages, or take any action. If Jim asks you to do something, say so and tell him those actions will arrive in subsystem B.
`.trim();

const VOICE_RULES = `
VOICE RULES (non-negotiable):
- NEVER use em dashes (—) or en dashes (–). Use hyphens (-) or rewrite the sentence. This is the single strongest AI tell and Jim hard-blocks it.
- When drafting copy for vendors or buyers (Ghana mechanics, often ESL), use 4th-grade reading level. Short sentences. Active voice. Plain Anglo-Saxon words.
- "48K" or any monthly number is SITE VISITS, never "users" or "MAUs".
- Never assert Jim is "on the ground" in Ghana. He operates Ghana remotely.
- Never include internal markers like [ref:something] in user-facing draft text.
- Justice Ayiah is VOOM's Ghana Ops Lead, on-ground at Abossey Okai. Kelvin is NOT a VOOM employee.

HONESTY RULES:
- If a tool errored, say so explicitly. Do not paper over.
- If the schema cannot answer the question, say so and propose what CAN be answered with the data you have.
- Never invent a vendor name, phone number, GHS amount, or count. Every concrete claim must come from a tool result.
- The vendors.verified flag is broken — do NOT cite "Ghana Card-verified" anywhere.
- When Jim asks "how many signups," prefer counting users INSERTs or unique phones, not Twilio OTP APPROVED (which double-counts re-auth).

OUTPUT STYLE:
- Lead with the number or finding. Then a one-sentence so-what.
- For lists, default to top 5 unless Jim asks for more.
- Format currency as "GHS 1,234" (no decimals unless cents matter).
- For dates, use "Mon Jun 7" style.
- If a chart would help, describe what the chart would show in one line; the chart-render tool is coming in A2.
`.trim();

const TOOL_USAGE = `
TOOL USAGE:
- Prefer the typed wrapper tools over speculation.
- You may call up to 8 tools per turn. Parallelize independent calls in one batch.
- When a tool returns {error: "..."}, tell Jim plainly what failed.
- The run_sql escape hatch is coming in A3 — for A1 if no tool fits, say so and propose what you'd query.
`.trim();

function toolCatalog(): string {
  return TOOLS.map((t) => `- ${t.name}: ${t.description}`).join("\n");
}

export function buildSystemPrompt(): string {
  return [
    IDENTITY,
    "",
    "SCHEMA (read-only):",
    SCHEMA_DUMP,
    "",
    "AVAILABLE TOOLS:",
    toolCatalog(),
    "",
    TOOL_USAGE,
    "",
    VOICE_RULES,
  ].join("\n");
}
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
pnpm vitest run server/agent/system-prompt.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/agent/system-prompt.ts server/agent/system-prompt.test.ts
git commit -m "feat(agent): A1 system prompt with identity, schema, tools, voice rules"
```

---

## Task 6: Agent runtime (Anthropic SDK + tool-use loop)

**Files:**
- Create: `server/agent/runtime.ts`
- Create: `server/agent/runtime.test.ts`

The runtime takes a thread + a new user message, calls Anthropic with prompt caching, runs the tool-use loop, and emits typed events. Streaming consumers (the SSE route) subscribe to events.

- [ ] **Step 1: Write the failing test**

Create `server/agent/runtime.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { runAgent, type AgentEvent } from "./runtime.js";

const mockMessages = {
  stream: vi.fn(),
};

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: mockMessages,
  })),
}));

vi.mock("./tools.js", () => ({
  TOOLS: [],
  anthropicToolList: () => [],
  callTool: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("./system-prompt.js", () => ({
  buildSystemPrompt: () => "SYSTEM",
}));

function fakeStream(events: any[]) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const e of events) yield e;
    },
    finalMessage: vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "final" }],
      usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 90 },
      stop_reason: "end_turn",
    }),
  };
}

describe("runAgent", () => {
  beforeEach(() => {
    mockMessages.stream.mockReset();
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    process.env.AGENT_MODEL = "claude-sonnet-4-6";
    process.env.MAX_TOOL_CALLS_PER_TURN = "8";
  });

  it("emits text deltas and a final event", async () => {
    mockMessages.stream.mockReturnValue(
      fakeStream([
        { type: "content_block_delta", delta: { type: "text_delta", text: "Hello" } },
        { type: "content_block_delta", delta: { type: "text_delta", text: " Jim" } },
      ])
    );
    const events: AgentEvent[] = [];
    await runAgent({
      systemPrompt: "SYSTEM",
      messages: [{ role: "user", content: "hi" }],
      onEvent: (e) => events.push(e),
    });
    const text = events
      .filter((e): e is Extract<AgentEvent, { type: "text" }> => e.type === "text")
      .map((e) => e.delta)
      .join("");
    expect(text).toContain("Hello Jim");
    expect(events.some((e) => e.type === "done")).toBe(true);
  });

  it("emits usage on done event", async () => {
    mockMessages.stream.mockReturnValue(fakeStream([]));
    const events: AgentEvent[] = [];
    await runAgent({
      systemPrompt: "SYSTEM",
      messages: [{ role: "user", content: "hi" }],
      onEvent: (e) => events.push(e),
    });
    const done = events.find((e) => e.type === "done");
    expect(done).toMatchObject({
      type: "done",
      tokensIn: 100,
      tokensOut: 50,
      cachedTokensIn: 90,
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm fail**

```bash
pnpm vitest run server/agent/runtime.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `server/agent/runtime.ts`**

```ts
import Anthropic from "@anthropic-ai/sdk";
import { anthropicToolList, callTool } from "./tools.js";
import { safeLogError } from "../index.js";

export type AgentEvent =
  | { type: "text"; delta: string }
  | { type: "tool_call"; id: string; name: string; args: any }
  | { type: "tool_result"; id: string; result: any; durationMs: number }
  | {
      type: "done";
      finalText: string;
      tokensIn: number;
      tokensOut: number;
      cachedTokensIn: number;
      stopReason: string;
    }
  | { type: "error"; message: string };

export interface RunAgentInput {
  systemPrompt: string;
  messages: Array<{ role: "user" | "assistant"; content: any }>;
  onEvent: (e: AgentEvent) => void;
}

// Sonnet 4.6 pricing as of Jan 2026 — see spec section 10.
const COST_PER_M_INPUT = 3.0;        // dollars
const COST_PER_M_INPUT_CACHED = 0.3;
const COST_PER_M_OUTPUT = 15.0;

export function estimateCostCents(usage: {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
}): number {
  const freshInput = usage.inputTokens - usage.cachedInputTokens;
  const dollars =
    (freshInput * COST_PER_M_INPUT) / 1_000_000 +
    (usage.cachedInputTokens * COST_PER_M_INPUT_CACHED) / 1_000_000 +
    (usage.outputTokens * COST_PER_M_OUTPUT) / 1_000_000;
  return dollars * 100;
}

export async function runAgent(input: RunAgentInput): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    input.onEvent({ type: "error", message: "ANTHROPIC_API_KEY not set" });
    return;
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.AGENT_MODEL ?? "claude-sonnet-4-6";
  const maxToolCallsPerTurn = Number(process.env.MAX_TOOL_CALLS_PER_TURN ?? 8);

  let messages = [...input.messages];
  let totalIn = 0;
  let totalOut = 0;
  let totalCached = 0;
  let finalText = "";
  let stopReason = "end_turn";
  let turns = 0;
  const MAX_TURNS = 6;

  try {
    while (turns < MAX_TURNS) {
      turns++;
      const stream = client.messages.stream({
        model,
        max_tokens: 4096,
        system: [
          {
            type: "text",
            text: input.systemPrompt,
            cache_control: { type: "ephemeral" },
          },
        ] as any,
        tools: anthropicToolList() as any,
        messages: messages as any,
      });

      let assistantText = "";
      const pendingToolUses: Array<{ id: string; name: string; input: any }> = [];

      for await (const event of stream as any) {
        if (event.type === "content_block_delta") {
          if (event.delta?.type === "text_delta") {
            assistantText += event.delta.text;
            input.onEvent({ type: "text", delta: event.delta.text });
          }
        }
      }

      const final = await (stream as any).finalMessage();
      finalText = assistantText;
      stopReason = final.stop_reason ?? "end_turn";
      totalIn += final.usage?.input_tokens ?? 0;
      totalOut += final.usage?.output_tokens ?? 0;
      totalCached += final.usage?.cache_read_input_tokens ?? 0;

      // Collect tool_use blocks for the next turn.
      const toolUseBlocks: any[] = (final.content ?? []).filter(
        (b: any) => b.type === "tool_use"
      );
      if (stopReason !== "tool_use" || toolUseBlocks.length === 0) {
        break; // done — no more tool calls
      }

      const capped = toolUseBlocks.slice(0, maxToolCallsPerTurn);
      for (const tu of capped) {
        input.onEvent({ type: "tool_call", id: tu.id, name: tu.name, args: tu.input });
      }

      // Execute tools in parallel.
      const toolResults = await Promise.all(
        capped.map(async (tu) => {
          const t0 = Date.now();
          const result = await callTool(tu.name, tu.input);
          const durationMs = Date.now() - t0;
          input.onEvent({ type: "tool_result", id: tu.id, result, durationMs });
          return { tool_use_id: tu.id, content: JSON.stringify(result) };
        })
      );

      // Append assistant turn + tool results to messages.
      messages.push({ role: "assistant", content: final.content });
      messages.push({
        role: "user",
        content: toolResults.map((r) => ({
          type: "tool_result",
          tool_use_id: r.tool_use_id,
          content: r.content,
        })),
      });
    }

    input.onEvent({
      type: "done",
      finalText,
      tokensIn: totalIn,
      tokensOut: totalOut,
      cachedTokensIn: totalCached,
      stopReason,
    });
  } catch (e) {
    safeLogError("agent.runtime", e);
    const message = e instanceof Error ? e.message : String(e);
    input.onEvent({ type: "error", message });
  }
}
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
pnpm vitest run server/agent/runtime.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/agent/runtime.ts server/agent/runtime.test.ts
git commit -m "feat(agent): A1 anthropic-backed runtime with tool-use loop"
```

---

## Task 7: SSE route `POST /api/agent/ask` + thread routes

**Files:**
- Create: `server/agent/routes.ts`
- Modify: `server/routes.ts` (add one line to mount the agent routes)

- [ ] **Step 1: Create `server/agent/routes.ts`**

```ts
import { Router } from "express";
import { z } from "zod";
import { supabase } from "../supabase.js";
import { safeLogError } from "../index.js";
import { runAgent, estimateCostCents, type AgentEvent } from "./runtime.js";
import { buildSystemPrompt } from "./system-prompt.js";
import { checkLimits, recordSpend, LimitError } from "./limits.js";

export const agentRouter = Router();

const askSchema = z.object({
  threadId: z.string().uuid().optional(),
  message: z.string().min(1).max(4000),
  pageContext: z
    .object({
      currentPage: z.string().optional(),
      activeFilters: z.record(z.string(), z.any()).optional(),
      selectedEntity: z.string().nullable().optional(),
    })
    .optional(),
});

function sse(res: any, event: string, data: any) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

agentRouter.post("/api/agent/ask", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const parse = askSchema.safeParse(req.body);
  if (!parse.success) {
    sse(res, "error", { message: "bad request", details: parse.error.flatten() });
    return res.end();
  }
  const { threadId: incomingThreadId, message, pageContext } = parse.data;

  try {
    await checkLimits();
  } catch (e) {
    if (e instanceof LimitError) {
      sse(res, "error", { message: `Limit hit: ${e.cap}`, cap: e.cap });
      return res.end();
    }
    throw e;
  }

  if (!supabase) {
    sse(res, "error", { message: "database unavailable" });
    return res.end();
  }

  // Get or create thread.
  let threadId = incomingThreadId;
  if (!threadId) {
    const ins = await supabase
      .from("agent_threads")
      .insert({})
      .select("id")
      .single();
    if (ins.error || !ins.data) {
      sse(res, "error", { message: "could not create thread" });
      return res.end();
    }
    threadId = (ins.data as any).id;
  }
  sse(res, "thread", { threadId });

  // Load thread history.
  const hist = await supabase
    .from("agent_messages")
    .select("role, content, tool_calls, tool_results")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .limit(50);
  const prior = (hist.data ?? []) as any[];

  // Build messages array. We translate stored rows back into Anthropic format.
  const messages: Array<{ role: "user" | "assistant"; content: any }> = [];
  for (const row of prior) {
    if (row.role === "user") {
      messages.push({ role: "user", content: row.content });
    } else if (row.role === "assistant") {
      const blocks: any[] = [];
      if (row.content) blocks.push({ type: "text", text: row.content });
      if (Array.isArray(row.tool_calls)) {
        for (const tc of row.tool_calls) {
          blocks.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.args });
        }
      }
      messages.push({ role: "assistant", content: blocks });
      if (Array.isArray(row.tool_results) && row.tool_results.length) {
        messages.push({
          role: "user",
          content: row.tool_results.map((tr: any) => ({
            type: "tool_result",
            tool_use_id: tr.id,
            content: JSON.stringify(tr.result),
          })),
        });
      }
    }
  }

  // Prepend page context as a system-style note in the user message if present.
  const userContent = pageContext
    ? `[page context: ${JSON.stringify(pageContext)}]\n\n${message}`
    : message;
  messages.push({ role: "user", content: userContent });

  // Persist the user message before streaming.
  await supabase.from("agent_messages").insert({
    thread_id: threadId,
    role: "user",
    content: userContent,
    page_context: pageContext ?? null,
  });

  const startedAt = Date.now();
  let assistantText = "";
  const allToolCalls: any[] = [];
  const allToolResults: any[] = [];
  let usage = { tokensIn: 0, tokensOut: 0, cachedTokensIn: 0 };

  const onEvent = (e: AgentEvent) => {
    sse(res, e.type, e);
    if (e.type === "text") assistantText += e.delta;
    if (e.type === "tool_call") allToolCalls.push({ id: e.id, name: e.name, args: e.args });
    if (e.type === "tool_result")
      allToolResults.push({ id: e.id, result: e.result, durationMs: e.durationMs });
    if (e.type === "done") usage = { tokensIn: e.tokensIn, tokensOut: e.tokensOut, cachedTokensIn: e.cachedTokensIn };
  };

  try {
    await runAgent({
      systemPrompt: buildSystemPrompt(),
      messages,
      onEvent,
    });
  } catch (e) {
    safeLogError("agent.routes.ask", e);
    sse(res, "error", { message: "agent crashed" });
    return res.end();
  }

  const latencyMs = Date.now() - startedAt;
  const costCents = estimateCostCents({
    inputTokens: usage.tokensIn,
    cachedInputTokens: usage.cachedTokensIn,
    outputTokens: usage.tokensOut,
  });

  await supabase.from("agent_messages").insert({
    thread_id: threadId,
    role: "assistant",
    content: assistantText,
    tool_calls: allToolCalls.length ? allToolCalls : null,
    tool_results: allToolResults.length ? allToolResults : null,
    tokens_in: usage.tokensIn,
    tokens_out: usage.tokensOut,
    cost_cents: costCents,
    latency_ms: latencyMs,
  });
  await supabase
    .from("agent_threads")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", threadId);
  await recordSpend({ cents: costCents, messageCount: 1 });

  // Generate title if this is the first exchange (thread has exactly 2 messages now).
  const countResp = await supabase
    .from("agent_messages")
    .select("id", { count: "exact", head: true })
    .eq("thread_id", threadId);
  if ((countResp as any).count === 2) {
    const title = message.slice(0, 60);
    await supabase.from("agent_threads").update({ title }).eq("id", threadId);
    sse(res, "title", { threadId, title });
  }

  sse(res, "end", { latencyMs, costCents });
  res.end();
});

agentRouter.get("/api/agent/threads", async (_req, res) => {
  if (!supabase) return res.status(503).json({ error: "db unavailable" });
  const r = await supabase
    .from("agent_threads")
    .select("id, title, created_at, last_message_at")
    .order("last_message_at", { ascending: false })
    .limit(20);
  return res.json({ threads: r.data ?? [] });
});

agentRouter.get("/api/agent/threads/:id", async (req, res) => {
  if (!supabase) return res.status(503).json({ error: "db unavailable" });
  const r = await supabase
    .from("agent_messages")
    .select("id, role, content, tool_calls, tool_results, created_at")
    .eq("thread_id", req.params.id)
    .order("created_at", { ascending: true })
    .limit(200);
  return res.json({ messages: r.data ?? [] });
});
```

- [ ] **Step 2: Mount the agent router**

In `server/routes.ts`, find the existing `import` block at the top and add:

```ts
import { agentRouter } from "./agent/routes.js";
```

Then near the bottom of the file (before `export default router;`), add:

```ts
router.use(agentRouter);
```

- [ ] **Step 3: Type-check**

```bash
pnpm check
```

Expected: no TS errors.

- [ ] **Step 4: Commit**

```bash
git add server/agent/routes.ts server/routes.ts
git commit -m "feat(agent): A1 SSE ask route + thread list/detail routes"
```

---

## Task 8: Page-context provider (client)

**Files:**
- Create: `client/src/lib/page-context.tsx`
- Modify: `client/src/App.tsx` (wrap with provider)

- [ ] **Step 1: Create the page-context provider**

```tsx
import { createContext, useContext, useState, useMemo, type ReactNode } from "react";

export interface PageContext {
  currentPage: string;
  activeFilters: Record<string, any>;
  selectedEntity: string | null;
}

const defaultCtx: PageContext = {
  currentPage: "/",
  activeFilters: {},
  selectedEntity: null,
};

interface PageContextState {
  ctx: PageContext;
  setCtx: (patch: Partial<PageContext>) => void;
}

const Ctx = createContext<PageContextState>({
  ctx: defaultCtx,
  setCtx: () => {},
});

export function PageContextProvider({ children }: { children: ReactNode }) {
  const [ctx, setCtxState] = useState<PageContext>(defaultCtx);
  const value = useMemo(
    () => ({
      ctx,
      setCtx: (patch: Partial<PageContext>) => setCtxState((prev) => ({ ...prev, ...patch })),
    }),
    [ctx]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePageContext() {
  return useContext(Ctx);
}
```

- [ ] **Step 2: Wrap the app**

In `client/src/App.tsx`, import the provider:

```tsx
import { PageContextProvider } from "./lib/page-context";
```

Wrap the existing app tree (find the outermost provider — likely `QueryClientProvider` — and nest `PageContextProvider` inside it):

```tsx
<QueryClientProvider client={queryClient}>
  <PageContextProvider>
    {/* existing app tree */}
  </PageContextProvider>
</QueryClientProvider>
```

- [ ] **Step 3: Type-check**

```bash
pnpm check
```

- [ ] **Step 4: Commit**

```bash
git add client/src/lib/page-context.tsx client/src/App.tsx
git commit -m "feat(agent): A1 page-context provider for chat awareness"
```

---

## Task 9: useAgentChat hook (SSE consumer)

**Files:**
- Create: `client/src/hooks/useAgentChat.ts`

- [ ] **Step 1: Create the hook**

```ts
import { useCallback, useRef, useState } from "react";
import { usePageContext } from "../lib/page-context";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  toolCalls?: Array<{ id: string; name: string; args: any }>;
  toolResults?: Array<{ id: string; result: any; durationMs: number }>;
  costCents?: number;
  latencyMs?: number;
}

interface ChatState {
  threadId: string | null;
  messages: ChatMessage[];
  streaming: boolean;
  error: string | null;
}

const initial: ChatState = {
  threadId: null,
  messages: [],
  streaming: false,
  error: null,
};

export function useAgentChat() {
  const [state, setState] = useState<ChatState>(initial);
  const { ctx } = usePageContext();
  const abortRef = useRef<AbortController | null>(null);

  const newThread = useCallback(() => {
    setState(initial);
  }, []);

  const loadThread = useCallback(async (threadId: string) => {
    setState({ threadId, messages: [], streaming: false, error: null });
    const r = await fetch(`/api/agent/threads/${threadId}`);
    const data = await r.json();
    const messages: ChatMessage[] = (data.messages ?? [])
      .filter((m: any) => m.role === "user" || m.role === "assistant")
      .map((m: any) => ({
        role: m.role,
        content: m.content,
        toolCalls: m.tool_calls ?? undefined,
        toolResults: m.tool_results ?? undefined,
      }));
    setState((s) => ({ ...s, messages }));
  }, []);

  const send = useCallback(
    async (text: string) => {
      if (state.streaming) return;
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      setState((s) => ({
        ...s,
        streaming: true,
        error: null,
        messages: [...s.messages, { role: "user", content: text }, { role: "assistant", content: "" }],
      }));

      const r = await fetch("/api/agent/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: state.threadId ?? undefined,
          message: text,
          pageContext: ctx,
        }),
        signal: ac.signal,
      });
      if (!r.ok || !r.body) {
        setState((s) => ({ ...s, streaming: false, error: `HTTP ${r.status}` }));
        return;
      }

      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      const pump = async () => {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let idx;
          while ((idx = buf.indexOf("\n\n")) !== -1) {
            const chunk = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            const eventLine = chunk.split("\n").find((l) => l.startsWith("event:"));
            const dataLine = chunk.split("\n").find((l) => l.startsWith("data:"));
            if (!eventLine || !dataLine) continue;
            const event = eventLine.slice(6).trim();
            let data: any;
            try {
              data = JSON.parse(dataLine.slice(5).trim());
            } catch {
              continue;
            }
            handleEvent(event, data);
          }
        }
      };

      const handleEvent = (event: string, data: any) => {
        if (event === "thread") {
          setState((s) => ({ ...s, threadId: data.threadId }));
        } else if (event === "text") {
          setState((s) => {
            const next = [...s.messages];
            const last = next[next.length - 1];
            if (last.role === "assistant") {
              next[next.length - 1] = { ...last, content: last.content + data.delta };
            }
            return { ...s, messages: next };
          });
        } else if (event === "tool_call") {
          setState((s) => {
            const next = [...s.messages];
            const last = next[next.length - 1];
            if (last.role === "assistant") {
              next[next.length - 1] = {
                ...last,
                toolCalls: [...(last.toolCalls ?? []), { id: data.id, name: data.name, args: data.args }],
              };
            }
            return { ...s, messages: next };
          });
        } else if (event === "tool_result") {
          setState((s) => {
            const next = [...s.messages];
            const last = next[next.length - 1];
            if (last.role === "assistant") {
              next[next.length - 1] = {
                ...last,
                toolResults: [
                  ...(last.toolResults ?? []),
                  { id: data.id, result: data.result, durationMs: data.durationMs },
                ],
              };
            }
            return { ...s, messages: next };
          });
        } else if (event === "error") {
          setState((s) => ({ ...s, streaming: false, error: data.message }));
        } else if (event === "end") {
          setState((s) => {
            const next = [...s.messages];
            const last = next[next.length - 1];
            if (last.role === "assistant") {
              next[next.length - 1] = { ...last, costCents: data.costCents, latencyMs: data.latencyMs };
            }
            return { ...s, messages: next, streaming: false };
          });
        }
      };

      try {
        await pump();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setState((s) => ({ ...s, streaming: false, error: msg }));
      }
    },
    [state.threadId, state.streaming, ctx]
  );

  return { ...state, send, newThread, loadThread };
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm check
```

- [ ] **Step 3: Commit**

```bash
git add client/src/hooks/useAgentChat.ts
git commit -m "feat(agent): A1 useAgentChat hook with SSE streaming"
```

---

## Task 10: ChatButton component (floating, page-aware)

**Files:**
- Create: `client/src/components/chat/ChatButton.tsx`
- Modify: `client/src/App.tsx` (mount ChatButton)

- [ ] **Step 1: Create the floating button**

```tsx
import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { ChatSheet } from "./ChatSheet";

const HIDDEN_ROUTES = ["/vendor/register"];

export function ChatButton() {
  const [open, setOpen] = useState(false);

  if (HIDDEN_ROUTES.some((r) => window.location.pathname.startsWith(r))) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ask the dashboard"
        className="fixed bottom-4 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg ring-1 ring-black/10 hover:bg-blue-700 active:scale-95 transition md:bottom-6 md:right-6"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
      <ChatSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
```

- [ ] **Step 2: Mount the button in `App.tsx`**

Import:

```tsx
import { ChatButton } from "./components/chat/ChatButton";
```

Add `<ChatButton />` inside `PageContextProvider`, alongside the rest of the app tree:

```tsx
<PageContextProvider>
  {/* existing app tree */}
  <ChatButton />
</PageContextProvider>
```

- [ ] **Step 3: Commit (ChatSheet stub comes next; type-check will fail until Task 11)**

```bash
git add client/src/components/chat/ChatButton.tsx client/src/App.tsx
git commit -m "feat(agent): A1 floating chat button on every dashboard page"
```

---

## Task 11: ChatSheet shell + MessageList + InputBar

**Files:**
- Create: `client/src/components/chat/ChatSheet.tsx`
- Create: `client/src/components/chat/MessageList.tsx`
- Create: `client/src/components/chat/InputBar.tsx`
- Create: `client/src/components/chat/ThreadList.tsx`

- [ ] **Step 1: Create `ChatSheet.tsx`** (Radix Dialog full-screen on mobile, side panel on desktop)

```tsx
import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import { X, Plus } from "lucide-react";
import { useAgentChat } from "../../hooks/useAgentChat";
import { MessageList } from "./MessageList";
import { InputBar } from "./InputBar";
import { ThreadList } from "./ThreadList";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChatSheet({ open, onOpenChange }: Props) {
  const chat = useAgentChat();
  const [showThreads, setShowThreads] = useState(false);

  useEffect(() => {
    if (!open) return;
    // On open, default to current thread (already loaded) or fresh.
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed z-50 flex flex-col bg-white shadow-2xl ring-1 ring-black/10
                     inset-x-0 bottom-0 top-12 rounded-t-2xl
                     md:inset-y-0 md:right-0 md:left-auto md:top-0 md:bottom-0
                     md:w-[480px] md:rounded-none md:rounded-l-2xl"
        >
          <header className="flex items-center justify-between border-b px-4 py-3">
            <button
              onClick={() => setShowThreads((s) => !s)}
              className="text-sm font-medium text-slate-700 hover:text-slate-900"
            >
              {showThreads ? "Back to chat" : "Threads"}
            </button>
            <Dialog.Title className="text-sm font-semibold">Ask VOOM</Dialog.Title>
            <div className="flex gap-2">
              <button
                onClick={chat.newThread}
                aria-label="New thread"
                className="rounded p-1 text-slate-600 hover:bg-slate-100"
              >
                <Plus className="h-5 w-5" />
              </button>
              <Dialog.Close
                aria-label="Close"
                className="rounded p-1 text-slate-600 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </Dialog.Close>
            </div>
          </header>

          {showThreads ? (
            <ThreadList
              onPick={(id) => {
                chat.loadThread(id);
                setShowThreads(false);
              }}
            />
          ) : (
            <>
              <MessageList messages={chat.messages} streaming={chat.streaming} error={chat.error} />
              <InputBar onSend={chat.send} disabled={chat.streaming} />
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 2: Create `MessageList.tsx`**

```tsx
import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../../hooks/useAgentChat";

interface Props {
  messages: ChatMessage[];
  streaming: boolean;
  error: string | null;
}

export function MessageList({ messages, streaming, error }: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-6 text-sm text-slate-500">
        <p>Ask anything about the marketplace.</p>
        <ul className="mt-4 space-y-2 text-slate-700">
          <li>"how many signups this week, by city"</li>
          <li>"Accra vendors with zero listings"</li>
          <li>"open part requests over GHS 500"</li>
        </ul>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {messages.map((m, i) => (
        <MessageBubble key={i} message={m} />
      ))}
      {streaming && (
        <div className="text-xs text-slate-400">streaming...</div>
      )}
      {error && (
        <div className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}
      <div ref={endRef} />
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const [showWork, setShowWork] = useState(false);
  const isUser = message.role === "user";
  const hasWork = (message.toolCalls?.length ?? 0) > 0;
  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          isUser
            ? "max-w-[85%] rounded-2xl rounded-tr-sm bg-blue-600 px-4 py-2 text-sm text-white"
            : "max-w-[95%] rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-2 text-sm text-slate-900 whitespace-pre-wrap"
        }
      >
        {message.content}
        {!isUser && hasWork && (
          <div className="mt-2 border-t border-slate-200 pt-2">
            <button
              onClick={() => setShowWork((s) => !s)}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              {showWork ? "Hide work" : `Show work (${message.toolCalls!.length} tool calls)`}
            </button>
            {showWork && (
              <ol className="mt-2 space-y-1 text-xs text-slate-500">
                {message.toolCalls!.map((tc) => (
                  <li key={tc.id}>
                    <code className="font-mono">{tc.name}</code>({JSON.stringify(tc.args)})
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
        {!isUser && message.costCents !== undefined && (
          <div className="mt-1 text-xs text-slate-400">
            {message.costCents.toFixed(2)}¢ · {message.latencyMs}ms
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `InputBar.tsx`**

```tsx
import { useState } from "react";
import { Send } from "lucide-react";

interface Props {
  onSend: (text: string) => void;
  disabled: boolean;
}

export function InputBar({ onSend, disabled }: Props) {
  const [text, setText] = useState("");

  const submit = () => {
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t);
    setText("");
  };

  return (
    <div className="border-t bg-white p-3">
      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Ask anything..."
          rows={1}
          className="flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          disabled={disabled}
        />
        <button
          type="button"
          onClick={submit}
          disabled={disabled || !text.trim()}
          aria-label="Send"
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white disabled:bg-slate-300"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `ThreadList.tsx`**

```tsx
import { useEffect, useState } from "react";

interface Thread {
  id: string;
  title: string | null;
  last_message_at: string;
}

interface Props {
  onPick: (id: string) => void;
}

export function ThreadList({ onPick }: Props) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/agent/threads")
      .then((r) => r.json())
      .then((d) => setThreads(d.threads ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-4 text-sm text-slate-500">Loading...</div>;
  }
  if (threads.length === 0) {
    return <div className="p-4 text-sm text-slate-500">No threads yet.</div>;
  }
  return (
    <ul className="flex-1 overflow-y-auto divide-y">
      {threads.map((t) => (
        <li key={t.id}>
          <button
            onClick={() => onPick(t.id)}
            className="block w-full px-4 py-3 text-left hover:bg-slate-50"
          >
            <div className="text-sm font-medium text-slate-900 truncate">
              {t.title ?? "Untitled"}
            </div>
            <div className="text-xs text-slate-500">
              {new Date(t.last_message_at).toLocaleString()}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 5: Type-check + lazy-load the chat module so the bundle doesn't bloat**

In `client/src/components/chat/ChatButton.tsx`, replace the static import of ChatSheet with a lazy one:

```tsx
import { lazy, Suspense, useState } from "react";
import { MessageCircle } from "lucide-react";

const ChatSheet = lazy(() => import("./ChatSheet").then((m) => ({ default: m.ChatSheet })));

const HIDDEN_ROUTES = ["/vendor/register"];

export function ChatButton() {
  const [open, setOpen] = useState(false);
  if (HIDDEN_ROUTES.some((r) => window.location.pathname.startsWith(r))) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ask the dashboard"
        className="fixed bottom-4 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg ring-1 ring-black/10 hover:bg-blue-700 active:scale-95 transition md:bottom-6 md:right-6"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
      {open && (
        <Suspense fallback={null}>
          <ChatSheet open={open} onOpenChange={setOpen} />
        </Suspense>
      )}
    </>
  );
}
```

Then run:

```bash
pnpm check
```

Expected: no TS errors.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/chat/
git add client/src/components/chat/ChatButton.tsx
git commit -m "feat(agent): A1 chat UI — sheet, messages, input, thread list (lazy)"
```

---

## Task 12: Acceptance smoke (manual)

A1 is acceptable when the 6 questions in spec section 16 work end-to-end on Jim's phone.

- [ ] **Step 1: Start dev server**

```bash
pnpm dev
```

In a separate terminal:

```bash
open http://localhost:5000
```

- [ ] **Step 2: Tap the floating button and ask each of the 6 spec questions**

Run each, confirm:
1. "How many vendors signed up in the last 7 days, by city?" — returns counts grouped by city, sourced via `list_vendors` and/or `get_metrics`.
2. "Show me Accra vendors who are tier=free and have zero listings." — returns a list, each backed by a `list_vendors` call.
3. "What's GMV this month vs last month?" — returns two numbers + delta, sourced via `get_metrics`.
4. "Which part requests are open and over GHS 500?" — returns list, sourced via `get_part_requests`.
5. "Show me real WhatsApp leads from the last 48 hours, not test." — returns list, sourced via `get_whatsapp_leads` with `isTest=false`.
6. From the Vendors page filtered to Accra: open chat, ask "tell me about the dormant ones." — agent uses page context to scope.

For each answer, verify:
- "Show work" exposes the tool calls.
- No em or en dashes in the output.
- No invented names or amounts (cross-check 1-2 by clicking through the dashboard).
- Combined cost under 5¢ (check `agent_daily_spend` row).

- [ ] **Step 3: If anything fails, fix the smallest possible change**

For schema-dump gaps: add the missing column/glossary entry to `server/agent/schema-dump.ts` and re-test.
For voice-rule violations: tighten `server/agent/system-prompt.ts` and re-test.
For tool routing errors: read `server/agent/tools.ts` and confirm the route param maps to the upstream filter name.

- [ ] **Step 4: Update memory + commit notes**

Append to `~/.claude/projects/-Users-jimstephen/memory/MEMORY.md` after A1 ships:

```
- [Agent A1 — chat + query layer live](project_agent_a1.md) — VOOM CEO dashboard chat surface, 9 read tools, Sonnet 4.6, $5/day cap, single user behind DASHBOARD_API_KEY. Lives at server/agent/. Subsystems B/C/D deferred per spec.
```

And create `~/.claude/projects/-Users-jimstephen/memory/project_agent_a1.md` with frontmatter + a 1-paragraph status.

- [ ] **Step 5: Final commit + push branch**

```bash
git add docs/ MEMORY.md 2>/dev/null || true
git commit -m "docs(agent): A1 shipped, smoke passed, memory updated" --allow-empty
git push -u origin feat/agent-A1
```

- [ ] **Step 6: Tell Jim**

Report concisely:
- Branch pushed: `feat/agent-A1`
- All tests pass (`pnpm vitest run server/agent`)
- All 6 acceptance questions verified
- Daily spend so far: __¢
- Open a PR? Y/N — wait for Jim.

---

## Self-review

Coverage of spec sections (mapping to tasks):
- §4 UX → Tasks 8-11 (page context, ChatButton, ChatSheet, MessageList, InputBar, ThreadList)
- §5 Architecture → covered across Tasks 4-11
- §5.3 New API routes → Task 7
- §6 Tool registry → Task 4 (all 9 GET wrappers)
- §7 run_sql → deferred (A3, explicitly out of scope)
- §8 Data model → Task 1
- §9 System prompt → Task 5
- §9.5 Rate + spend limits → Task 3
- §10 Cost model → Task 6 (`estimateCostCents`)
- §11 Phasing → this plan is A1 only, per spec recommendation
- §12 Risk table → mitigated via prompt rules (Task 5), spend cap (Task 3), tool-call cap (Task 6), lazy-loaded chat bundle (Task 11), PII redaction inherited from existing `safeLogError`
- §13 Telemetry → `agent_messages` rows persist tool_calls, tool_results, tokens, cost, latency (Task 7); feedback column ready for A4
- §16 Acceptance criteria → Task 12

Placeholder scan: no TBD / TODO / "implement later" in steps. Every code block is complete.

Type consistency: `AgentEvent` defined in Task 6, consumed in Task 7. `ChatMessage` defined in Task 9, consumed in Task 11. `PageContext` defined in Task 8, consumed by `useAgentChat` in Task 9. All names match.

Scope: single subsystem (A1), one implementation pass.
