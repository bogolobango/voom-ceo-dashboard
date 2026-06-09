import { readFileSync } from "node:fs";
import { TriageEntrySchema, type TriageEntry } from "./triage-types.js";

const AUTHORISED_EMOJI = new Set(
  ["👋", "🚗", "✅", "🎉", "📸", "🏷️", "💵", "📲", "🎁", "👍", "🙏", "👌", "✨"].map(
    (e) => e.replace(/️$/, ""),
  ),
);

const EMOJI_REGEX = /\p{Extended_Pictographic}(?:️)?/gu;

export interface Violation {
  thread_id: string;
  field: "draft_text" | "draft_text_edited";
  reason: string;
  snippet: string;
}

function scanText(text: string, thread_id: string, field: Violation["field"]): Violation[] {
  const out: Violation[] = [];
  if (text.includes("—")) {
    out.push({ thread_id, field, reason: "em-dash (—) is banned", snippet: text });
  }
  if (text.includes("–")) {
    out.push({ thread_id, field, reason: "en-dash (–) is banned", snippet: text });
  }
  const matches = text.match(EMOJI_REGEX) ?? [];
  for (const emoji of matches) {
    const normalized = emoji.replace(/️$/, "");
    if (!AUTHORISED_EMOJI.has(normalized)) {
      out.push({
        thread_id,
        field,
        reason: `unauthorised emoji: ${normalized}`,
        snippet: text,
      });
    }
  }
  return out;
}

export function auditEntries(entries: TriageEntry[]): Violation[] {
  const violations: Violation[] = [];
  for (const entry of entries) {
    if (entry.draft_text) {
      violations.push(...scanText(entry.draft_text, entry.thread_id, "draft_text"));
    }
    if (entry.draft_text_edited) {
      violations.push(...scanText(entry.draft_text_edited, entry.thread_id, "draft_text_edited"));
    }
  }
  return violations;
}

function loadJsonl(path: string): TriageEntry[] {
  const raw = readFileSync(path, "utf8");
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  return lines.map((line) => TriageEntrySchema.parse(JSON.parse(line)));
}

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error("triage-voice-audit: usage: tsx triage-voice-audit.ts <path-to-jsonl>");
    process.exit(2);
  }
  const entries = loadJsonl(path);
  const violations = auditEntries(entries);
  if (violations.length === 0) {
    console.log(`OK ${entries.length} entries, no voice violations`);
    return;
  }
  for (const v of violations) {
    console.error(`[${v.thread_id}] ${v.field}: ${v.reason}`);
    console.error(`  snippet: ${v.snippet}`);
  }
  console.error(`${violations.length} violation(s) across ${entries.length} entries`);
  process.exit(1);
}

const isCli = import.meta.url === `file://${process.argv[1]}`;
if (isCli) {
  void main();
}
