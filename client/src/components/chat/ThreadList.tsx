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
