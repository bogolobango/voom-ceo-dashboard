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
