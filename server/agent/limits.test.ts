import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkLimits, recordSpend, LimitError } from "./limits.js";

const mockDb = {
  hourlyCount: 0,
  dailyCount: 0,
  centsSpent: 0,
};

vi.mock("../supabase.js", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "agent_messages") {
        // checkLimits: from().select().gte().eq() — terminal awaited promise with `count`.
        return {
          select: () => ({
            gte: () => ({
              eq: () =>
                Promise.resolve({
                  count: mockDb.hourlyCount,
                  data: [],
                  error: null,
                }),
            }),
          }),
        };
      }
      if (table === "agent_daily_spend") {
        // checkLimits + recordSpend: from().select().eq().maybeSingle()
        // recordSpend: from().upsert(row)
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: {
                    cents_spent: mockDb.centsSpent,
                    message_count: mockDb.dailyCount,
                  },
                  error: null,
                }),
            }),
          }),
          upsert: (row: any) => {
            mockDb.centsSpent = Number(row.cents_spent ?? 0);
            mockDb.dailyCount = Number(row.message_count ?? 0);
            return Promise.resolve({ error: null });
          },
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
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
