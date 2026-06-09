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
