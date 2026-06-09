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
