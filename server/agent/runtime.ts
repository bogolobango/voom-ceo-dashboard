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

// Sonnet 4.6 pricing as of Jan 2026 - see spec section 10.
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
        break;
      }

      const capped = toolUseBlocks.slice(0, maxToolCallsPerTurn);
      for (const tu of capped) {
        input.onEvent({ type: "tool_call", id: tu.id, name: tu.name, args: tu.input });
      }

      const toolResults = await Promise.all(
        capped.map(async (tu) => {
          const t0 = Date.now();
          const result = await callTool(tu.name, tu.input);
          const durationMs = Date.now() - t0;
          input.onEvent({ type: "tool_result", id: tu.id, result, durationMs });
          return { tool_use_id: tu.id, content: JSON.stringify(result) };
        })
      );

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
