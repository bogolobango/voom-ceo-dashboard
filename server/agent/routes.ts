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

  const hist = await supabase
    .from("agent_messages")
    .select("role, content, tool_calls, tool_results")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .limit(50);
  const prior = (hist.data ?? []) as any[];

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

  const userContent = pageContext
    ? `[page context: ${JSON.stringify(pageContext)}]\n\n${message}`
    : message;
  messages.push({ role: "user", content: userContent });

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
