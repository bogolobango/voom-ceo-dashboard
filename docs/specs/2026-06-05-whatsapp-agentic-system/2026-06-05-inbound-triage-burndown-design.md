# WhatsApp Inbound Triage: 80-Thread Burndown (v1)

**Date:** 2026-06-05
**Author:** Claude (with Jim)
**Status:** Design, pending Jim review
**Slice:** First slice of the broader WhatsApp agentic system. Tonight only. No persistent bridge, no auto-send, no rollout messaging.

---

## 1. Why this exists

The FB to WhatsApp ad campaign launched on or around 2026-05-29 has generated approximately 80 inbound conversations sitting unread in Jim's WhatsApp. Memory [[project_acquisition_shift_whatsapp]] confirms this is the live acquisition channel and that reply-handling, not outbound, is the bottleneck.

Jim is one person. Reading 80 threads, classifying each, hand-crafting a personalised reply, and tracking who needs follow-up is not realistically going to happen in a single sitting without leverage. This spec defines the leverage: a focused session where Claude does the cognitive work (classify, draft, log), Jim does the physical work (open thread, paste, send).

This is the **first slice** of a multi-slice agentic system. Subsequent slices (durable WhatsApp bridge, lifecycle messaging, request-routing engine, live demand feed) get their own specs and plans. See §10 for the slice map.

## 2. Goal and non-goals

### Goals
- Process all approximately 80 unread FB-funnel threads in a single 2 to 3 hour session tonight.
- Every reply matches Jim's WhatsApp voice (Artifact 03, the voice library). No em-dashes. No unauthorised emoji. 4th-grade reading level.
- Every thread produces a structured log entry (JSONL) capturing classification, extracted fields, and next action.
- Session ends with a markdown report Jim can act on tomorrow morning: vendors to list manually, follow-ups due, escalations to Justice or Kofi, patterns worth surfacing.

### Non-goals
- No long-running WhatsApp Web bridge tonight. No Playwright, no whatsapp-web.js, no browser automation. Zero ban risk.
- No automated sending. Every reply is copy-pasted by Jim from the terminal into WhatsApp Web.
- No lifecycle messaging (Week 1 verification announce, 90-day trial, day-90 decision, cap-hit) - those are later slices.
- No request-routing engine. No buyer-to-vendor fan-out logic. Buyer requests get directed to `www.voomparts.com/requests` for now; the routing engine is a later slice.
- No schema changes to the VOOM marketplace database tonight.
- No new agent (Ashley, Etienne, etc. style) gets built tonight. This is a session protocol Claude follows in the current chat, not a packaged subagent.

## 3. Architecture

There is no architecture. The components are:

- Jim's MacBook with WhatsApp Web open in a browser window.
- This Claude Code session (terminal).
- A JSONL log file at `~/voom-ceo-dashboard/data/whatsapp-triage/2026-06-05-burndown.jsonl`.
- A markdown report generated at `~/voom-ceo-dashboard/data/whatsapp-triage/2026-06-05-burndown-report.md` at session end.

The "agent" in this slice is Claude in the current chat following the protocol in §4, anchored to the voice library in Artifact 03.

## 4. Per-thread workflow loop

For each unread thread, in order:

1. **Jim** opens the next unread WhatsApp Web thread.
2. **Jim** pastes into Claude:
   ```
   Thread: <sender display name + phone if visible>
   <last 3 to 5 messages, including any reply Jim or Meta already sent>
   ```
3. **Claude** responds in this exact format:
   ```
   CLASS: <bucket from §5>
   STEP: <M2/M3/M4/M5/FOLLOWUP_D2, only if bucket is NEW_VENDOR_*>
   OBJECTION: <branch name if detected, else none>
   EXTRACTED:
     parts_type: <or null>
     shop_name: <or null>
     location: <or null>
     momo: <or null>
     part_for_listing: <or null, only if vendor sent photo+name+price at M4>
     buyer_part_requested: <or null>
     buyer_car: <or null>
     buyer_region: <or null>
   DRAFT:
   <reply in Jim's voice, copy-paste ready, blank line before and after>
   ACTION: <next_action enum from §6>
   LOG: <one-line summary Claude will append to the JSONL>
   ```
4. **Jim** copy-pastes the DRAFT into WhatsApp Web and sends.
5. **Jim** confirms with a single word in chat: `sent` or `skip` (if Jim chose not to send) or `edited` (if Jim modified the draft before sending - then paste the edited version).
6. **Claude** appends a JSONL entry to the log file using the Bash tool.
7. **Loop** until Jim says `done` or `pause`.

### Calibration phase

First 5 to 10 threads run fully synchronous. After 5 threads, Claude proposes "ready to batch?" and Jim decides whether to start pasting threads in groups of 3 to 5 for faster throughput. Synchronous mode is the safe default; batching is an opt-in optimisation.

### Ambiguity protocol

If a thread genuinely sits between two buckets, Claude returns `CLASS: NEW_VENDOR_M2? (also looks like OBJECTION_TRUST)` and Jim picks. Better than silently forcing the wrong bucket.

## 5. Classification taxonomy

| Cluster | Bucket | When to use | Reply source |
|---|---|---|---|
| **New vendor flow** | `NEW_VENDOR_M2` | Vendor replied to Meta auto-greet with what they sell | Voice library §2 Message 2 |
| | `NEW_VENDOR_M3` | Vendor sent shop name + location + MoMo | Voice library §2 Message 3, action `MANUAL_LIST_FIRST_PART` |
| | `NEW_VENDOR_M4` | Vendor sent photo + part name + price | Voice library §2 Message 4 (after manual listing), action `SEND_M4_AFTER_LIST` |
| | `NEW_VENDOR_M5` | Silent after M4, scarcity push | Voice library §2 Message 5 |
| | `NEW_VENDOR_FOLLOWUP_D2` | Silent after M2 for 24+ hours | Voice library §3 silent branch |
| **Buyers** | `BUYER_DISCOVERY` | Vague intent | Voice library §1 generic discovery |
| | `BUYER_BROWSE` | Generic question about VOOM | Voice library §1 buyer asking generally |
| | `BUYER_SPECIFIC_REQUEST` | Looking for a specific part | Voice library §1 request board |
| **Existing vendors** | `RETURNING_VENDOR` | Existing account, lost session | Custom re-auth nudge pointing at `www.voomparts.com/vendor/login` |
| | `VENDOR_QUESTION` | Existing vendor how-to or complaint | Answer if simple, else action `ESCALATE_JUSTICE` |
| **Objections** (override any step) | `OBJECTION_PRICE` | "is it free", "cost", "fees", "monthly" | Voice library §3 "Is it really free?" |
| | `OBJECTION_PAYMENT` | "how do I get paid", "payment", "money", "MoMo" | Voice library §3 "How do I get paid?" |
| | `OBJECTION_TIME` | "later", "busy", "tomorrow", "I'll do it" | Voice library §3 "I'll do it later" |
| | `OBJECTION_TRUST` | "where are you", "are you legit", "trust" | Voice library §3 trust branch |
| **Other** | `SPAM_OR_NOISE` | Telco promo, wrong number, group invite, single emoji | Skip, action `NONE` |

When an objection fires inside a NEW_VENDOR step, Claude returns the objection branch as the primary DRAFT and notes the current STEP, so the conversation resumes from the right place after the objection is handled.

## 6. Data capture

### JSONL log

File: `~/voom-ceo-dashboard/data/whatsapp-triage/2026-06-05-burndown.jsonl`

One line per thread Jim processes. Schema:

```json
{
  "ts": "ISO 8601 timestamp",
  "thread_id": "sender phone or stable identifier",
  "sender_name": "display name as it appears in WhatsApp",
  "bucket": "one of §5 enums",
  "step": "M2|M3|M4|M5|FOLLOWUP_D2|null",
  "objection_branch": "PRICE|PAYMENT|TIME|TRUST|null",
  "extracted": {
    "parts_type": "string or null",
    "shop_name": "string or null",
    "location": "Abossey Okai|Suame|Tema|Kumasi|other-string|null",
    "momo": "string or null",
    "part_for_listing": "string or null",
    "buyer_part_requested": "string or null",
    "buyer_car": "string or null",
    "buyer_region": "string or null"
  },
  "draft_sent": true,
  "draft_edited_by_jim": false,
  "next_action": "MANUAL_LIST_FIRST_PART|SEND_M4_AFTER_LIST|FOLLOWUP_D2|ESCALATE_JUSTICE|ESCALATE_KOFI|NONE",
  "notes": "ambiguity calls, anomalies, anything weird"
}
```

### next_action enum

| Value | Meaning |
|---|---|
| `MANUAL_LIST_FIRST_PART` | Vendor sent photo + name + price. Jim or Justice creates the listing on VOOM tomorrow, then triggers `SEND_M4_AFTER_LIST`. |
| `SEND_M4_AFTER_LIST` | Listing already exists. Send M4 with the shop link. |
| `FOLLOWUP_D2` | Silent vendor, schedule +24h follow-up. End-of-session report includes pre-drafted follow-ups. |
| `ESCALATE_JUSTICE` | Vendor question outside Jim's standard answers. Justice picks up next working day. |
| `ESCALATE_KOFI` | Re-auth pattern repeats. Surface to Kofi standup as a likely Facebook IAB session-loss bug. See memory [[reference_fb_iab_abort_noise]]. |
| `NONE` | Canned reply self-contained, no follow-up needed. |

### End-of-session report

File: `~/voom-ceo-dashboard/data/whatsapp-triage/2026-06-05-burndown-report.md`. Generated when Jim says `done`. Contents:

1. **Headline stats**: total threads processed, session duration, percent classified vs ambiguous.
2. **Bucket distribution**: counts and percent per bucket.
3. **Funnel dropoff**: how many vendors at M2, M3, M4. Gives Jim a real picture of where new vendors die.
4. **Manual listing queue**: every `MANUAL_LIST_FIRST_PART` row, formatted as a checklist with shop name + parts type + location + momo + the photo description. Jim or Justice works this list tomorrow.
5. **Tomorrow's follow-ups**: every `FOLLOWUP_D2` with the exact follow-up message pre-drafted from voice library §3.
6. **Escalations**: vendor questions for Justice, re-auth patterns for Kofi.
7. **Patterns for strategy**: top 5 buyer part requests (feeds future request-routing engine), top regions, recurring objections, anything surprising.
8. **Memory proposals**: items Claude proposes adding to Jim's auto-memory based on what tonight surfaced.

## 7. Voice and hard rules

All DRAFT outputs MUST comply with Artifact 03 (the voice library):

- No em-dashes or en-dashes. Use commas, periods, or line breaks.
- Only emojis from the authorised list: 👋 🚗 ✅ 🎉 📸 🏷️ 💵 📲 🎁 👍 🙏 👌 ✨
- Plain text URLs (`www.voomparts.com/vendor/register`, not Markdown links).
- 4th-grade reading level. Short sentences. Anglo-Saxon. Ghanaian English register.
- Never invent numbers. The "100 featured shops this month" line from M5 is the only canonical scarcity number; do not invent vendor totals or buyer counts.

If any DRAFT violates these rules, Jim flags it with `voice` in chat and Claude redrafts before logging.

## 8. Success criteria

The session is a success if at the end of it:

- All approximately 80 unread threads have been processed (either replied to or marked `SPAM_OR_NOISE`).
- JSONL log contains one valid entry per processed thread.
- End-of-session report exists and includes the 8 sections in §6.
- Jim has a clear tomorrow checklist: a manual-listing queue and a follow-up queue.
- At least 5 strategy-relevant patterns are surfaced (top requested parts, top regions, recurring objections, etc.).

The session is a partial success if Jim runs out of energy before 80 threads and pauses. The session protocol is resumable: same files, same loop, next session continues where the last one stopped.

## 9. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Voice drift in drafts (Claude wanders off Artifact 03) | Synchronous first 5 to 10 threads; Jim flags `voice` and Claude redrafts; voice library is referenced explicitly in every draft generation. |
| Jim sends a draft that contains an em-dash or stray emoji | Pre-send check in the protocol: if Jim sees a banned character, reply `voice` and Claude redrafts. End-of-session report includes a grep over the JSONL for banned characters as a final audit. |
| Thread context Jim pastes is incomplete or ambiguous | Claude returns ambiguity (`CLASS: X? (also Y)`) rather than forcing a wrong classification. Jim picks. |
| Misclassification of returning vendor as new vendor | Returning vendors usually mention "I already signed up" or "I can't log in". Claude flags any thread with that signal as `RETURNING_VENDOR` even if other content looks like NEW_VENDOR. |
| JSONL file corruption mid-session | Each entry is appended atomically as a single line. Even if session crashes, the log up to that point is valid JSONL. |
| Jim runs out of energy at thread 40 | Session is resumable. Same files, same loop, next session picks up. Report is regenerated on `done`. |
| WhatsApp Web session expires mid-session | Jim re-pairs QR code, resumes. No state lost - everything is in the JSONL. |

## 10. What this feeds (next slices)

This burn-down session produces input for the next design sessions:

- **Slice 2 (durable WhatsApp bridge)**: the JSONL + report tell us the real bucket distribution and per-bucket frequency, which determines whether a bridge needs to handle 10 threads/day or 100. Also tells us which buckets are high-confidence enough to draft auto-send-with-approval vs which need human eyes.
- **Slice 3 (lifecycle messaging)**: the manual-listing queue is the input to the Week 1 verification announcement messaging - we now have a real cohort to send to.
- **Slice 4 (request-routing engine)**: the buyer part requests captured in the JSONL are the first dataset for matching logic. Top requested parts and regions inform the v1 routing rules.
- **Slice 5 (live demand feed)**: same dataset. Real buyer queries by hour, by region, by part.
- **Memory proposals**: any pattern worth carrying into future sessions gets added to `~/.claude/projects/-Users-jimstephen/memory/` via the auto-memory system.

## 11. Files and paths

| Purpose | Path |
|---|---|
| This spec | `~/voom-ceo-dashboard/docs/specs/2026-06-05-whatsapp-agentic-system/2026-06-05-inbound-triage-burndown-design.md` |
| Artifact 01 (strategy context) | `~/voom-ceo-dashboard/docs/specs/2026-06-05-whatsapp-agentic-system/artifacts/01-strategy-context-pivot.md` |
| Artifact 02 (diagnosis + mechanics) | `~/voom-ceo-dashboard/docs/specs/2026-06-05-whatsapp-agentic-system/artifacts/02-diagnosis-and-leverage-mechanics.md` |
| Artifact 03 (voice library) | `~/voom-ceo-dashboard/docs/specs/2026-06-05-whatsapp-agentic-system/artifacts/03-jim-wa-voice-library.md` |
| Tonight's JSONL log | `~/voom-ceo-dashboard/data/whatsapp-triage/2026-06-05-burndown.jsonl` |
| Tonight's session report | `~/voom-ceo-dashboard/data/whatsapp-triage/2026-06-05-burndown-report.md` |
| Implementation plan (next step) | `~/voom-ceo-dashboard/docs/plans/2026-06-05-inbound-triage-burndown-v1.md` (will be written next via writing-plans skill) |

## 12. Open items deferred to later slices

- **WhatsApp substrate technology choice** (Playwright vs whatsapp-web.js vs Business API): deferred to Slice 2. Decision depends on volume data from tonight.
- **Tier-based request routing**: deferred to Slice 4.
- **Auto-send with approval queue UX** (Mac app, terminal TUI, web UI): deferred to Slice 2.
- **Vendor-to-vendor matching for buyer requests**: deferred to Slice 4.
- **Scheduled outbound (lifecycle messaging cron)**: deferred to Slice 3.
