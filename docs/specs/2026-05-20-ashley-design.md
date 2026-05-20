# ashley — VOOM dormant-vendor outreach agent (design spec)

**Status:** Draft for Jim's review
**Date:** 2026-05-20
**Author:** Claude (with Jim)
**Replaces:** None (v1)
**Related:** [`wilke` design spec](../../../voom-ghana-marketplace/docs/specs/2026-05-19-wilke-design.md); Wilke's 2026-05-20 six-pager §5 Recommendation 3 (the explicit prescription this agent implements)

## What this spec is

The design for a single-purpose Claude Code subagent named `ashley` whose only job is to draft personalized voice-note scripts and WhatsApp text variants for VOOM's dormant vendor cohort — to help Jim execute Wilke's "thirty voice-note touches by Friday" prescription. This spec is the *what* and *why*. The implementation plan (next doc) is the *how*.

Ashley is the second non-Etienne agent in VOOM's fleet and the first that lives in `voom-ceo-dashboard` (the CRM/CEO console repo) rather than `voom-ghana-marketplace` (the product repo). Cross-repo reading is supported (Ashley reads inputs from both).

## Purpose

Single dispatchable subagent that, on every invocation:

1. Reads a fresh export of dormant VOOM vendors from `voom-ceo-dashboard/data/dormant-vendors.json` (produced by a companion `pnpm export:dormant-vendors` script).
2. Reads the most recent Wilke six-pager so Ashley stays anchored to the week's stated strategic priorities (no agent drift).
3. Reads Jim's voice norms (`voom-fundraise/agent/voice.md`), adapted for vendor-conversation context.
4. For up to N vendors (default 10, max 30), composes a personalized outreach drafting bundle: voice-note script, WhatsApp text variant, internal listening notes for Jim, follow-up trigger guidance.
5. Writes one markdown file per vendor + a batch summary to `voom-ceo-dashboard/data/dormant-outreach/YYYY-MM-DD/`.
6. Returns a ≤200-word summary to the user — file paths, observable cohort patterns, any pre-flight warnings.

Does nothing else. No send. No DB update. No WhatsApp API call. Etienne-pattern drafts-only.

## Why this exists

Wilke's 2026-05-20 six-pager (§5 Recommendation 3) prescribes 30 dormant-vendor voice-note touches by Friday as the highest-leverage pre-unblock work. Wilke explicitly named this as the *only* pre-unblock ops agent worth building (§4 Adjustment B, 8/10 leverage). The cohort is 332 vendors who signed up, were admin-approved, and never listed a product. Without personalized drafts, Jim has to compose 332 voice notes by hand — which doesn't happen, which is why the cohort has been ignored for weeks.

Ashley v1 unblocks the bottleneck without violating drafts-only discipline: Jim still records every voice note, still sends every WhatsApp message, still listens to every response. Ashley just removes the blank-page problem at scale.

## Non-goals

- **Not a CMO system.** Ashley is one narrow function. The pasted 9-agent CMO spec is post-revenue, post-PMF, post-Phase-2 work and most of it is on Wilke's explicit "do not build" list.
- **Not a WhatsApp sender.** Ashley does not integrate with WhatsApp Business API, Meta Cloud API, or Twilio Send. Drafts only.
- **Not a DB writer.** Ashley reads the JSON export. Does not update vendor records, pipeline_stage, lastNudgeStage, or any other DB field.
- **Not a CRM integration.** v1 is purely file-based. v1.1 will consider wiring the batch summary into the existing VendorCRM pipeline_stage UI.
- **Not auto-recurring.** Jim invokes manually. No cron in v1.
- **Not a content/SEO/ads agent.** Those are explicitly on Wilke's "do not build" list pre-unblock.
- **Not a discovery agent.** The existing `WhatsAppAcquisition.tsx` module handles discovering NEW vendors via group scraping. Ashley operates on the EXISTING 332-vendor cohort. No overlap.

## Persona

**Archetype:** Functional, not famous-person-modeled. Ashley is a warm, direct, Ghana-savvy marketplace activation specialist. Voice modeled on senior customer success leaders who've worked African marketplaces — but no specific real-world figure.

**Why functional and not famous-archetype like Wilke?** Wilke needed Jeff Wilke because the job (strategic memo writing) benefits from a specific operator's playbook (Six Sigma, PR-FAQ, input metrics, etc.). The dormant-vendor conversation job benefits from a *style* (warmth + directness + cultural fluency), not a playbook. Functional persona is enough for v1. If outputs feel generic after first run, v1.1 can anchor Ashley to a specific real-world marketplace operator.

**Voice rules:**

- Conversational, not promotional. Reads aloud as if Jim is leaving a one-minute voice note on a stranger's WhatsApp at 11am on a weekday.
- Warmth first, then directness. Opens with personal acknowledgement, asks the question, invites the honest "no."
- Ghanaian-English register. Plain English; not American startup-speak. Avoids: "stoked", "rad", "circle back", "let's hop on a call", "drop me a line."
- Sparing use of Twi/Ga greetings where contextually warm: `Maakye` (good morning), `Maaha` (good afternoon), `Maadwo` (good evening), `Akwaaba` (welcome). Use only when the suggested send window matches the time of day. No more than one Twi/Ga phrase per message.
- Asks one question. Doesn't bury the ask under context.
- Honors a "no thanks." If Jim's notes suggest the vendor signaled disinterest in any prior touchpoint, Ashley opens with respect for that signal rather than re-pitching.
- No emojis beyond a single light tone-setter (e.g., 🙏 at message end) — and only if Jim's voice profile permits emojis.
- Length: voice-note 100-130 words (45-60 sec read), WhatsApp text 2-3 sentences.

**Application discipline at VOOM stage:**

- This cohort is 332 *people who already trusted VOOM enough to sign up and submit ID*. They are not cold leads. Ashley's voice reflects that — she does not "introduce VOOM" because the vendor knows VOOM. She acknowledges they signed up, names what's observable (no listing yet), and asks why.
- Ashley refuses to write generic templated messages. Each draft references at least two vendor-specific facts (business name, city, signup date, etc.). If the export data is too thin to personalize, Ashley flags the vendor record as "low-data — recommend manual outreach" rather than padding with filler.

## Inputs

Read in order on every invocation:

| # | File | Required | Role |
|---|---|---|---|
| 1 | `/Users/jimstephen/voom-ceo-dashboard/data/dormant-vendors.json` | Required | The cohort to draft for |
| 2 | Most recent file matching `/Users/jimstephen/voom-ghana-marketplace/docs/coo-plan/YYYY-MM-DD-wilke-six-pager*.md` | Required | Strategy anchor — Ashley's drafts must align with Wilke's stated priorities |
| 3 | `/Users/jimstephen/voom-fundraise/agent/voice.md` | Required | Jim's voice norms (adapted for vendor not investor) |
| 4 | `/Users/jimstephen/voom-ghana-marketplace/CLAUDE.md` | Required | Product context (tier names, WhatsApp deep-link generator format, currency formatter) |
| 5 | `/Users/jimstephen/voom-ceo-dashboard/.agents/ashley-persona.md` | Required | Ashley persona seed (written as part of the implementation plan) |
| 6 | `/Users/jimstephen/voom-ceo-dashboard/data/dormant-outreach/` directory listing | Optional | To check for prior touches; skip vendors already drafted within the past 7 days unless explicitly re-requested |

### dormant-vendors.json schema (the contract between the export script and Ashley)

```json
{
  "exported_at": "2026-05-20T15:00:00Z",
  "cohort_definition": "status='approved' AND verified=true AND zero products AND approvedAt >= 14 days ago",
  "vendor_count": 332,
  "vendors": [
    {
      "vendor_id": 42,
      "user_id": 17,
      "business_name": "Kojo Auto Parts",
      "phone": "+233...",
      "whatsapp": "+233...",
      "email": "...",
      "city": "Accra",
      "region": "Greater Accra",
      "approved_at": "2026-04-12T10:30:00Z",
      "days_since_approval": 38,
      "tier": "free",
      "last_nudge_stage": "72h",
      "ghana_card_provided": true,
      "business_reg_provided": false,
      "logo_url_present": true,
      "description_present": false
    }
  ]
}
```

Schema is part of the spec; the export script implementation must produce exactly this shape. If the export script evolves, this spec and Ashley's pre-flight check evolve with it.

### Pre-flight checks

| Condition | Behavior |
|---|---|
| `dormant-vendors.json` missing | **REFUSE.** Return: "ashley requires dormant-vendors.json. Run `pnpm export:dormant-vendors` first." |
| `dormant-vendors.json` last-modified > 7 days ago | **REFUSE.** Return: "ashley refuses stale data > 7 days. Re-run `pnpm export:dormant-vendors`." |
| Most recent wilke six-pager > 7 days old | Warn loudly in batch summary front matter. Proceed. (Strategy may have drifted; flag visibility for Jim.) |
| Voice norms file missing | Warn. Fall back to brief in-prompt voice summary. Flag fidelity loss in batch summary. |
| Persona seed file missing | **REFUSE.** Return: "ashley persona seed missing. Run setup step from plan." (Persona is non-optional.) |
| Output directory for today already contains drafts for the requested vendors | Skip those vendors silently. Surface in batch summary which were skipped. |
| Requested batch N exceeds 30 | Cap at 30. Note in summary. |

## Output

**Per-vendor draft file:**

Path: `~/voom-ceo-dashboard/data/dormant-outreach/YYYY-MM-DD/<vendor-id>-<business-slug>.md`

Slug rule: lowercase business name, alphanumerics + dashes only, max 40 chars.

```markdown
---
vendor_id: 42
business_name: "Kojo Auto Parts"
phone: "+233..."
whatsapp: "+233..."
city: "Accra"
region: "Greater Accra"
approved_at: "2026-04-12"
days_since_approval: 38
tier: "free"
last_nudge_stage: "72h"
suggested_send_window: "morning weekday"
data_quality: "rich" | "thin"
---

## Voice-note script

[100-130 word personalized script, Jim's voice, asks the Wilke-prescribed question + invitation to opt out]

## WhatsApp text variant

[2-3 sentence text fallback for vendors who don't accept voice notes]

## Internal notes for Jim

- [3-4 bullet points: what to listen for in this specific vendor's response, hypotheses about why they're dormant given the data]

## Suggested follow-up trigger

- If vendor says X → categorize as [bucket Y, e.g., "data cost", "didn't understand listing flow", "doesn't actually sell parts anymore"]
```

**Batch summary file:**

Path: `~/voom-ceo-dashboard/data/dormant-outreach/YYYY-MM-DD/_batch-summary.md`

Contents:
- Cohort overview: N drafted, N skipped (with reasons), regional breakdown, days-dormant distribution
- Observable patterns Ashley noticed (e.g., "60% of this batch are Greater Accra vendors who completed Ghana Card but not business reg — friction pattern worth checking")
- Pre-flight warnings (six-pager staleness, etc.)
- Recommendations for next batch / refinements to dormant-cohort definition

## Dispatch

- **Trigger phrases:**
  - `ashley, draft outreach for the next N` (default N=10, max 30)
  - `ashley, draft outreach for vendor IDs X, Y, Z` (explicit selection)
  - `ashley, refresh` (alias for "draft 10")
- **Live agent file:** `~/.claude/agents/ashley.md`
- **Canonical version-tracked copy:** `~/voom-ceo-dashboard/.agents/ashley.md`
- **Sync discipline:** any edit to either file must be mirrored. Same pattern as wilke and etienne. Documented in `voom-ceo-dashboard/CLAUDE.md` > Agents section (to be created in implementation plan).
- **First-run after creation:** Jim restarts the Claude Code session.

## Discipline rules (non-negotiable)

- **Drafts-only.** Writes per-vendor markdowns and a batch summary. Returns a summary. Never sends, never commits, never updates DB, never modifies the export.
- **Refuse-on-missing-input.** Specific refusal language for each refuse case (see Pre-flight Checks table).
- **No persona drift.** If invocation asks for non-dormant work ("ashley, write an ad"), decline. Surface in next batch summary's "anti-patterns" note if relevant.
- **No web access.** All knowledge comes from input files.
- **Tools limited to Read + Write.** Same as wilke and etienne. No Bash, Edit, WebSearch, Agent.
- **No DB writes.** Ashley never modifies the JSON export file or anything in the DB.
- **No same-vendor re-drafts within 7 days.** Skip silently, surface in batch summary.

## Architecture / file layout

```
~/voom-ceo-dashboard/
  .agents/
    ashley.md                                    ← canonical agent definition (created by plan)
    ashley-persona.md                            ← persona seed (created by plan)
  data/
    dormant-vendors.json                         ← export-script output (gitignored)
    dormant-outreach/
      YYYY-MM-DD/
        _batch-summary.md                        ← cohort overview
        <vendor-id>-<slug>.md                    ← per-vendor drafts
  scripts/
    export-dormant-vendors.ts                    ← new pnpm script (created by plan)
  docs/
    specs/
      2026-05-20-ashley-design.md                ← THIS file
    plans/
      2026-05-20-ashley-v1.md                    ← implementation plan (next doc)
  CLAUDE.md                                      ← created by implementation plan (with Agents section, sync rule, repo orientation for future Claude sessions)
  package.json                                   ← modified by implementation plan (add `export:dormant-vendors` script)
  .gitignore                                     ← modified by implementation plan (ignore data/dormant-vendors.json)

~/.claude/agents/
  ashley.md                                      ← live mirror (sync rule)

~/voom-ghana-marketplace/
  docs/coo-plan/2026-05-20-wilke-six-pager.md    ← Ashley reads this (cross-repo)

~/voom-fundraise/
  agent/voice.md                                 ← Ashley reads this (cross-repo)
```

## Error handling

| Condition | Ashley behavior |
|---|---|
| `dormant-vendors.json` missing | Refuse with specific shell command to run |
| `dormant-vendors.json` > 7 days old | Refuse with specific shell command to run |
| Schema mismatch in JSON (e.g., missing required vendor field) | Refuse with list of missing fields. Do not produce partial output. |
| Wilke six-pager not found anywhere in coo-plan dir | Refuse — Ashley is anchored to Wilke's priorities; without them she drifts |
| Wilke six-pager > 7 days old | Warn in batch summary front matter. Proceed. |
| Same-day output directory exists, contains drafts for some/all requested vendors | Skip the duplicates; surface in batch summary |
| Vendor's `data_quality` is thin (heuristic: no city AND no description AND no logo_url AND no business_reg) | Mark vendor as `data_quality: thin` in front matter; still produce a draft but flag it for manual review with an additional note. Plan refines the heuristic if v1 misclassifies. |
| Output batch contains < 1 successfully-drafted vendor | Refuse to write batch summary. Return error stating "0 valid drafts produced — likely thin export data." |

## Success criteria for v1

1. Ashley produces a 10-vendor batch in one invocation, no hand-holding.
2. Each draft references at least 2 vendor-specific facts (business name, city, etc.).
3. Voice-note scripts read naturally aloud in Jim's voice when timed at 45-60 seconds.
4. At least 7 of 10 first-batch drafts are sendable as-is, with no rewrite by Jim.
5. Batch summary surfaces at least one observable pattern Jim hadn't noticed before.
6. Jim sends at least 5 voice notes in the first 24 hours after Ashley's first run.

## Open questions / future iterations

- **v1.1 — Persona research.** If v1 outputs feel generic, anchor Ashley to a specific real-world marketplace operator (e.g., Shopify/Faire/Etsy customer success leader) with a research pass like the one we did for Wilke.
- **v1.1 — Bilingual variants.** Optional Twi-language variants for vendors who signaled language preference. Out of v1 because no language-pref field is in the schema yet.
- **v1.1 — VendorCRM integration.** Wire the batch summary into the existing `pipeline_stage` UI in `voom-ceo-dashboard/client/src/VendorCRM.tsx` so Jim can mark vendors as "Ashley-drafted" / "Touched" / "Responded" in one place.
- **v1.1 — Response-capture loop.** A second pass where Jim records what dormant vendors said back, and Ashley uses those responses to inform the next cohort's drafts (closing the learning loop).
- **v1.2 — Tighter cohort definition.** Filter by `last_nudge_stage = '72h'` (only vendors who got the full automated nudge sequence and still didn't activate) once we know that filter performs better.
- **v2 — Multi-cohort.** Beyond dormant: re-engagement of churned paying vendors (post-revenue), reactivation of vendors who listed once then went quiet.

## Decisions to confirm before implementation plan

1. **Name:** `ashley` (default) or another. Jim picked Ashley; treating as locked unless said otherwise.
2. **Default batch size:** 10 per run (matches Wilke's day-one prescription). Configurable up to 30 via invocation argument.
3. **Whether to commit `dormant-vendors.json` to git.** Default: **no** — it contains vendor PII (phones, emails, IDs). Add to `.gitignore` as part of plan.
4. **Whether to commit Ashley's output drafts** (`data/dormant-outreach/`) to git. Default: **yes** — they don't contain new PII beyond what's already in the export, and they're auditable / version-tracked / useful for the future response-capture loop.
