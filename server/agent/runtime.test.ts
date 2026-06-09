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
