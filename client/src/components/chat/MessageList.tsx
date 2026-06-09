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
