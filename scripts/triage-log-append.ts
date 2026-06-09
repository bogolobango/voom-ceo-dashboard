import { appendFileSync } from "node:fs";
import { TriageEntrySchema, type TriageEntry } from "./triage-types.js";

export function appendEntry(entry: TriageEntry, path: string): void {
  const validated = TriageEntrySchema.parse(entry);
  const line = JSON.stringify(validated) + "\n";
  appendFileSync(path, line, "utf8");
}

function todayPath(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `data/whatsapp-triage/${yyyy}-${mm}-${dd}-burndown.jsonl`;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  const raw = await readStdin();
  if (!raw.trim()) {
    console.error("triage-log-append: no JSON on stdin");
    process.exit(2);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error("triage-log-append: invalid JSON on stdin");
    process.exit(2);
  }

  const path = process.argv[2] ?? todayPath();
  try {
    appendEntry(parsed as TriageEntry, path);
  } catch (err) {
    console.error("triage-log-append: schema validation failed");
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(3);
  }

  console.log(`OK ${path}`);
}

const isCli = import.meta.url === `file://${process.argv[1]}`;
if (isCli) {
  void main();
}
