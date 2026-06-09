import { safeLogError } from "../index.js";

export interface Tool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
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
