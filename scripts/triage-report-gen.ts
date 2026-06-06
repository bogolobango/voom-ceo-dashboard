import { readFileSync } from "node:fs";
import { TriageEntrySchema, type TriageEntry, BUCKETS } from "./triage-types.js";

const FOLLOWUP_TEMPLATE = (name: string) =>
  `Hi ${name} 👋 Still happy to set up your shop free whenever you're ready, takes me 2 minutes. Just send me one part photo + price and I'll put it live so you can see how it works. 🚗`;

function fmtDuration(ms: number): string {
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function bucketTable(entries: TriageEntry[]): string {
  const counts = new Map<string, number>();
  for (const b of BUCKETS) counts.set(b, 0);
  for (const e of entries) counts.set(e.bucket, (counts.get(e.bucket) ?? 0) + 1);
  const total = entries.length || 1;
  const rows = [...counts.entries()]
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([bucket, n]) => `| ${bucket} | ${n} | ${Math.round((n / total) * 100)}% |`)
    .join("\n");
  return `| Bucket | Count | Share |\n|---|---|---|\n${rows}`;
}

function funnelSection(entries: TriageEntry[]): string {
  const m2 = entries.filter((e) => e.step === "M2").length;
  const m3 = entries.filter((e) => e.step === "M3").length;
  const m4 = entries.filter((e) => e.step === "M4").length;
  return `- M2: ${m2}\n- M3: ${m3}\n- M4: ${m4}`;
}

function manualListingQueue(entries: TriageEntry[]): string {
  const items = entries.filter((e) => e.next_action === "MANUAL_LIST_FIRST_PART");
  if (items.length === 0) return "";
  const rows = items
    .map(
      (e) =>
        `- [ ] **${e.extracted.shop_name ?? e.sender_name}** (${e.extracted.location ?? "location TBD"})\n` +
        `  - parts: ${e.extracted.parts_type ?? "TBD"}\n` +
        `  - MoMo: ${e.extracted.momo ?? "TBD"}\n` +
        `  - first part: ${e.extracted.part_for_listing ?? "TBD"}\n` +
        `  - thread: ${e.thread_id}`,
    )
    .join("\n");
  return `\n## Manual listing queue\n\n${rows}\n`;
}

function followupSection(entries: TriageEntry[]): string {
  const items = entries.filter((e) => e.next_action === "FOLLOWUP_D2");
  if (items.length === 0) return "";
  const rows = items
    .map(
      (e) =>
        `- [ ] **${e.sender_name}** (${e.thread_id})\n\n  > ${FOLLOWUP_TEMPLATE(e.sender_name)}\n`,
    )
    .join("\n");
  return `\n## Tomorrow's follow-ups\n\n${rows}\n`;
}

function escalations(entries: TriageEntry[]): string {
  const justice = entries.filter((e) => e.next_action === "ESCALATE_JUSTICE");
  const kofi = entries.filter((e) => e.next_action === "ESCALATE_KOFI");
  let out = "";
  if (justice.length > 0) {
    out += `\n## Escalate to Justice\n\n`;
    out += justice.map((e) => `- ${e.sender_name} (${e.thread_id}): ${e.notes || "vendor question"}`).join("\n") + "\n";
  }
  if (kofi.length > 0) {
    out += `\n## Escalate to Kofi\n\n`;
    out += kofi.map((e) => `- ${e.sender_name} (${e.thread_id}): ${e.notes || "re-auth pattern"}`).join("\n") + "\n";
  }
  return out;
}

function topBuyerRequests(entries: TriageEntry[]): string {
  const requests = entries
    .filter((e) => e.bucket === "BUYER_SPECIFIC_REQUEST" && e.extracted.buyer_part_requested)
    .map((e) => e.extracted.buyer_part_requested!);
  if (requests.length === 0) return "";
  const counts = new Map<string, number>();
  for (const r of requests) counts.set(r, (counts.get(r) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const rows = top.map(([part, n]) => `- ${part}: ${n}`).join("\n");
  return `\n## Top buyer requests\n\n${rows}\n`;
}

export function renderReport(entries: TriageEntry[], now: Date): string {
  const sorted = [...entries].sort((a, b) => a.ts.localeCompare(b.ts));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const durationMs =
    first && last && first !== last
      ? new Date(last.ts).getTime() - new Date(first.ts).getTime()
      : first
        ? now.getTime() - new Date(first.ts).getTime()
        : 0;
  const duration = first ? fmtDuration(durationMs) : "0m";

  let md = `# WhatsApp Triage Burndown Report\n\n`;
  md += `Generated: ${now.toISOString()}\n\n`;
  md += `## Headline\n\n`;
  md += `- Total threads processed: **${entries.length}**\n`;
  md += `- Session duration: **${duration}**\n`;
  md += `- Drafts sent: ${entries.filter((e) => e.draft_sent).length}\n`;
  md += `- Drafts edited by Jim: ${entries.filter((e) => e.draft_edited_by_jim).length}\n`;

  if (entries.length === 0) return md;

  md += `\n## Bucket distribution\n\n${bucketTable(entries)}\n`;
  md += `\n## Funnel dropoff (NEW_VENDOR steps)\n\n${funnelSection(entries)}\n`;
  md += manualListingQueue(entries);
  md += followupSection(entries);
  md += escalations(entries);
  md += topBuyerRequests(entries);

  return md;
}

function loadJsonl(path: string): TriageEntry[] {
  const raw = readFileSync(path, "utf8");
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  return lines.map((line) => TriageEntrySchema.parse(JSON.parse(line)));
}

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error("triage-report-gen: usage: tsx triage-report-gen.ts <path-to-jsonl>");
    process.exit(2);
  }
  const entries = loadJsonl(path);
  const md = renderReport(entries, new Date());
  process.stdout.write(md);
}

const isCli = import.meta.url === `file://${process.argv[1]}`;
if (isCli) {
  void main();
}
