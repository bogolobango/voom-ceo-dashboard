# Slice 2: Autonomous WhatsApp Triage Agent (v1)

**Date:** 2026-06-07
**Author:** Claude (with Jim)
**Status:** Design, pending Jim review
**Predecessor:** [Slice 1 — Inbound Triage Burndown](./2026-06-05-inbound-triage-burndown-design.md) shipped 2026-06-06 with the JSONL log, voice audit, and report generator. Slice 2 swaps the terminal-driven session for a 24/7 autonomous service while reusing every Slice 1 artifact.

---

## 1. Why this exists

Slice 1 (last night's session) proved the per-thread protocol works but left Jim doing the physical copy-paste. The strategic goal stated in the parent spec [§1] is a system where basic lead answering happens without Jim's hands. Slice 2 closes that loop for the easy buckets, escalating only what genuinely needs human judgment.

This slice ships an Express webhook in `voom-ceo-dashboard/server/` that receives WhatsApp messages from a new dedicated Twilio Business API number, classifies and drafts replies using the Slice 1 taxonomy and voice library, sends the reply autonomously on safe buckets, and escalates the rest to Jim's personal WhatsApp.

Memory [[project_acquisition_shift_whatsapp]] flagged reply-handling as the bottleneck. Slice 1 reduced the cognitive cost. Slice 2 reduces the physical cost to near zero for the long tail of straightforward inbound.

## 2. Goals and non-goals

### Goals
- Autonomously reply to SPAM, NEW_VENDOR_M2, OBJECTIONS, and RETURNING_VENDOR re-auth threads on a new dedicated Twilio WhatsApp number.
- Escalate every other bucket to Jim's personal WhatsApp via a structured DM, with the proposed draft included so Jim can copy-edit and send from his own number.
- Send Jim a daily morning summary at 7am EAT (3am ET) via WhatsApp, generated from the same `triage-report-gen` script Slice 1 ships.
- Hosted on the Replit Reserved VM already running voom-ceo-dashboard. Twilio webhook URL stable across deploys.
- Reuses every Slice 1 artifact: schema, log-append, voice audit, report generator.
- Voice fidelity matches Slice 1 hard rules: no em-dash or en-dash, emoji whitelist enforced before send, 4th-grade reading level, anonymous "VOOM Team" identity.

### Non-goals
- No Akua integration. When the agent detects a NEW_VENDOR_M4 thread (5+ photo attachments), it escalates to Jim with a "ready for Akua" flag. Auto-download + auto-invoke is Slice 3.
- No migration of the existing VOOM WhatsApp number. The agent runs on a fresh dedicated number; Jim's existing number keeps serving complex threads on his personal flow.
- No web dashboard for escalations. Jim reads escalations in WhatsApp where he already lives.
- No multi-agent routing. The triage agent does not hand off to Etienne / Ashley / Wilke / Kofi. Cross-agent orchestration is later.
- No subscription tier mechanics. The strategic 5-mechanic rollout (verification gating, 90-day trial, ranking, expiration) is its own multi-slice initiative.
- No outbound nudging (Day 2 follow-ups, scheduled M5 scarcity pushes). v1 is inbound-reactive only. Outbound scheduling is Slice 4.

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ TWILIO WHATSAPP BUSINESS API (new dedicated number)          │
│ - Webhook → voom-ceo-dashboard/api/whatsapp-inbound          │
│ - Messages API ← outbound replies + escalations              │
└─────────────────┬────────────────────────┬───────────────────┘
                  │ inbound (vendor msg)   ↑ outbound (reply/escalation)
                  ▼                        │
┌─────────────────────────────────────────────────────────────┐
│ voom-ceo-dashboard on Replit Reserved VM                     │
│                                                              │
│   POST /api/whatsapp-inbound (Express route)                 │
│   1. Verify X-Twilio-Signature                               │
│   2. Dedupe by MessageSid (check last hour of JSONL)         │
│   3. Load thread context (prior JSONL + Supabase vendor row) │
│   4. Classify + draft via Claude API tool-use call           │
│   5. Voice audit draft (re-uses Slice 1 auditEntries)        │
│   6. Policy gate: AUTO / ESCALATE / DUAL (M4 only)           │
│   7a. AUTO → Twilio send → JSONL append (draft_sent=true)    │
│   7b. ESCALATE → Twilio DM Jim's personal WA + JSONL append  │
│   7c. DUAL → both 7a + 7b (one bucket: NEW_VENDOR_M4)        │
│                                                              │
│   Cron (7am EAT daily):                                      │
│   - triage-report-gen on yesterday's JSONL                   │
│   - Twilio send report to Jim's personal WA                  │
└─────────────────────────────────────────────────────────────┘
                  │ structured WA DMs to Jim
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ Jim's personal WhatsApp (existing VOOM number)               │
│ - Live escalations from agent number                         │
│ - 7am EAT daily summary                                      │
│ - Manual reply to vendors via wa.me deep-links               │
└─────────────────────────────────────────────────────────────┘
```

## 4. Components

All under `voom-ceo-dashboard/server/`. Each is a single-responsibility file:

| File | Responsibility | Reuses |
|---|---|---|
| `whatsapp-inbound-route.ts` | Express handler for `POST /api/whatsapp-inbound`. Validates signature, dedupes, orchestrates the pipeline. | — |
| `whatsapp-twilio-signature.ts` | HMAC-SHA1 verification of `X-Twilio-Signature` against request URL + body. | — |
| `whatsapp-thread-context.ts` | Loads sender's prior JSONL entries + Supabase vendor row. Returns `{ sender, prior_entries, vendor_record }`. | reads from JSONL files in `data/whatsapp-triage/`; uses `server/supabase.ts` |
| `whatsapp-classifier.ts` | Calls Claude API (Sonnet) with tool-use schema mirroring `TriageEntry`. Returns validated draft entry. | imports `TriageEntry`, `TriageEntrySchema` from `scripts/triage-types.ts` |
| `whatsapp-policy-gate.ts` | Pure function: `(bucket, next_action) → 'auto' \| 'escalate'`. See §5. | — |
| `whatsapp-sender.ts` | Twilio Messages API client. Sends reply to vendor OR escalation DM to Jim. | `server/wa-config.ts` for Twilio creds |
| `whatsapp-escalator.ts` | Formats the escalation DM (bucket label + truncated last msg + proposed draft + wa.me deep-link to vendor) and calls sender. | — |
| `whatsapp-error-log.ts` | Appends to `data/whatsapp-triage/errors.jsonl`. Used by every component on failure paths. | — |
| `whatsapp-daily-summary-cron.ts` | Standalone cron entry. Runs daily at 7am EAT. Executes `triage-report-gen` on yesterday's JSONL, sends markdown to Jim via Twilio. | imports `renderReport` from `scripts/triage-report-gen.ts` |
| `routes.ts` (modified) | Mount the new `/api/whatsapp-inbound` route. | — |

### Slice 1 artifacts reused (no rewriting)

- `scripts/triage-types.ts` — schema. One refinement: add `twilio_message_sid: string \| null` field for dedupe.
- `scripts/triage-log-append.ts` — `appendEntry(entry, path)` imported directly.
- `scripts/triage-voice-audit.ts` — `auditEntries([entry])` called before every auto-send.
- `scripts/triage-report-gen.ts` — `renderReport(entries, now)` called by the daily cron.

### Pre-existing files to investigate during implementation

`server/whatsapp-api.ts` (~12KB) and `server/whatsapp-scraper.ts` (~11KB) already exist in voom-ceo-dashboard from prior agent work. The implementation plan must determine whether to extend (preferred if they wrap Twilio already) or sit alongside (if they're scoped to a different purpose). Not a design question; a Phase-A implementation reconnaissance task.

## 5. Policy gate (auto vs escalate)

| Bucket | Day-1 policy | Reason |
|---|---|---|
| `SPAM_OR_NOISE` | AUTO (no reply, just log) | Zero risk. |
| `NEW_VENDOR_M2` | AUTO | Canned voice library §2 Message 2. Highest-frequency bucket from FB funnel. |
| `OBJECTION_PRICE` | AUTO | Canned voice library §3 "Is it really free?" |
| `OBJECTION_PAYMENT` | AUTO | Canned voice library §3 "How do I get paid?" |
| `OBJECTION_TIME` | AUTO | Canned voice library §3 "I'll do it later" |
| `OBJECTION_TRUST` | AUTO | Canned voice library §3 trust branch |
| `RETURNING_VENDOR` | AUTO when bucket is unambiguous re-auth | Canned re-auth nudge pointing at `voomparts.com/vendor/login`. If classifier confidence is ambiguous, escalate. |
| `NEW_VENDOR_M3` | ESCALATE | Requires assigning a shop name to a real vendor record; Jim sets up admin-side. |
| `NEW_VENDOR_M4` | **DUAL** (auto-ack vendor AND escalate to Jim) | Photo batch. Vendor gets auto-acknowledgement ("Got them, putting them up on your shop, you'll just tap publish on each when ready"). Jim simultaneously gets an "Akua-ready" escalation DM listing photo count + thread_id so he can run Akua when free. This is the only bucket that produces BOTH outputs. |
| `NEW_VENDOR_M5` | ESCALATE | Scarcity push timing is per-vendor judgment. |
| `NEW_VENDOR_FOLLOWUP_D2` | ESCALATE | Outbound scheduling is Slice 4, not v1. |
| `BUYER_DISCOVERY` | ESCALATE | Buyer behaviour is less predictable; defer to Jim until we have more data. |
| `BUYER_BROWSE` | ESCALATE | Same. |
| `BUYER_SPECIFIC_REQUEST` | ESCALATE | Captures request data that feeds future request-routing engine; Jim should see and decide. |
| `VENDOR_QUESTION` | ESCALATE | Existing vendor with how-to or complaint. Always Jim. |

### Voice-audit-fail override

If the voice auditor flags a violation on an AUTO bucket AND the classifier retry also fails, the policy gate forces ESCALATE regardless of the bucket. The violating draft is included in the escalation DM so Jim can rewrite. The JSONL entry is marked `voice_audit_failed: true`.

### Ambiguity override

If the classifier returns a bucket label suffixed with `?` (taxonomy ambiguity protocol from Slice 1 §4), policy gate forces ESCALATE.

## 6. Voice and identity

- Identity: anonymous "VOOM Team" (no individual persona). Replies sign as "VOOM" or "VOOM Team" or omit signature for short canned responses. Voice library Message 2 pronouns shift from first-person ("I'll set up your shop") to plural ("we'll set up your shop") OR Jim's specific framing carried over for genuine warmth. Implementation plan picks the exact patterns.
- Hard rules unchanged from Slice 1: no em-dash, no en-dash, emoji whitelist `👋 🚗 ✅ 🎉 📸 🏷️ 💵 📲 🎁 👍 🙏 👌 ✨` only, 4th-grade reading level, plain Anglo-Saxon, Ghanaian English register, no invented numbers.
- Pre-send voice audit: every AUTO draft goes through `auditEntries([drafted])` before Twilio send. If violations, classifier retries once with violations injected into prompt; second failure forces escalation.

## 7. Error handling

| Failure | Behavior |
|---|---|
| Twilio webhook signature invalid | Respond 403, log to `errors.jsonl`. Never 500 (Twilio retries 500s). |
| Duplicate MessageSid (Twilio retry) | Respond 200 silently. JSONL append skipped. |
| Claude API failure | Retry once with shorter prompt. Second failure: escalate to Jim with raw inbound message and "classifier-down" flag. JSONL marks `classifier_failed: true`. |
| Twilio outbound API failure | Retry once. Second failure: write to `errors.jsonl` and DM Jim via separate code path. Inbound webhook still returns 200 to Twilio. |
| Voice audit fail twice | Force escalate as above. Never send a voice-failing draft to a vendor. |
| Supabase vendor lookup failure | Continue without vendor record. Thread context is degraded but not blocking. Log a warning. |
| JSONL schema validation failure on a new entry | Log to `errors.jsonl` and continue (with `data_quality_failed: true` in errors log). Inbound webhook still 200. |
| Cron daily summary fails | Send Jim a short failure DM. Do not retry the report send; he can run `pnpm triage:report` manually. |

## 8. State

- `data/whatsapp-triage/YYYY-MM-DD-burndown.jsonl` (one per day). Rotated by `whatsapp-inbound-route.ts` calling `todayPath()` from Slice 1's helper.
- `data/whatsapp-triage/errors.jsonl` (rotated per-month). Append-only.
- No in-memory state. Every webhook rebuilds thread context from disk. Restart-safe.
- No new DB tables. Supabase reads are read-only against existing `vendors` table.

## 9. Testing approach

- **Unit (vitest, co-located):**
  - `whatsapp-twilio-signature.test.ts`: verify HMAC-SHA1 against known Twilio fixtures.
  - `whatsapp-thread-context.test.ts`: given a fake JSONL + mock Supabase, returns the right structure.
  - `whatsapp-classifier.test.ts`: with mock Claude API, returns valid `TriageEntry` for canonical buckets.
  - `whatsapp-policy-gate.test.ts`: every bucket × every next_action × ambiguity flag × voice-fail flag.
  - `whatsapp-escalator.test.ts`: escalation DM format matches expected template.
- **Integration (manual, Twilio sandbox):**
  - End-to-end: send a sandbox WhatsApp message → confirm autoreply lands → check JSONL has the entry → check no error log.
  - Force voice violation in classifier → confirm escalation, not auto-send.
  - Force Claude API timeout → confirm escalation with classifier-down flag.
- **No DB integration tests in CI.** Same constraint as Slice 1 and existing repo conventions.

## 10. Success criteria

The slice ships when:
1. All AUTO buckets reply within 30 seconds end-to-end on the production Twilio number.
2. All ESCALATE buckets DM Jim within 30 seconds with the proposed draft + wa.me deep-link.
3. Voice audit catches em-dashes, en-dashes, and unauthorized emoji on every auto-send path (verified by red-team test).
4. Daily 7am EAT report lands in Jim's WhatsApp consistently for 7 days.
5. Zero double-sends in 7 days (MessageSid dedupe works).
6. Twilio webhook latency p95 under 5 seconds (Claude API call is the long pole).
7. JSONL data quality holds: no schema violations in 7 days of production traffic.

## 11. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Twilio number gets suspended for policy violation | We're on Business API not personal; ban risk is via Meta Commerce Policy enforcement. Mitigated by anonymous "VOOM Team" persona, no commerce-policy-restricted content in drafts, and the verification-in-flight providing legitimate business backing. |
| Classifier hallucinates a wrong bucket and auto-sends a confusing reply | Voice audit catches gross violations. For semantic-wrong-bucket cases, Jim sees patterns in the daily summary and can tighten the policy (escalate that bucket) within minutes. |
| Vendor sends complex multi-message thread that confuses the agent | Thread context loads the last 5 JSONL entries for that thread_id. If the conversation is novel, classifier escalates by default (most buckets escalate). |
| Replit Reserved VM goes down mid-conversation | Twilio retries webhooks for 4 hours with exponential backoff. Service comes back, picks up the retry. JSONL state survives restart. |
| Claude API rate-limit during volume burst | Retry-once pattern + graceful escalation. Worst case: every inbound becomes an escalation, Jim handles them by hand for the duration. |
| Daily report send fails | Failure DM. Jim runs `pnpm triage:report` manually. |
| Voice library updates aren't synced to classifier prompt | Voice library lives in `docs/specs/2026-06-05-whatsapp-agentic-system/artifacts/03-jim-wa-voice-library.md`. The classifier prompt either reads from this file at boot OR copies it inline at deploy time. Implementation plan picks; preference is read-at-boot so updates land without redeploy. |
| Vendor expects reply to escalated thread and gets silence | The escalation DM should include a draft Jim can copy-paste in under 30 seconds. Volume target: Jim handles all escalations within 4 hours. |

## 12. What this enables (next slices)

This slice produces real production data that feeds:
- **Slice 3 — Akua integration**: with M4 escalation data in the JSONL, we know exactly how often photo batches come in. That sizes the Akua integration build.
- **Slice 4 — Outbound scheduling**: with FOLLOWUP_D2 escalation data, we see how often silent vendors need pinging. That sizes the cron architecture for outbound.
- **Strategy work**: BUYER_SPECIFIC_REQUEST entries are the first real dataset for the request-routing engine (parent spec §10 Slice 4). Same with top buyer regions for future market segmentation.

## 13. Files and paths

| Purpose | Path |
|---|---|
| This spec | `~/voom-ceo-dashboard/docs/specs/2026-06-05-whatsapp-agentic-system/2026-06-07-slice-2-autonomous-triage-design.md` |
| Slice 1 spec | `~/voom-ceo-dashboard/docs/specs/2026-06-05-whatsapp-agentic-system/2026-06-05-inbound-triage-burndown-design.md` |
| Voice library (live source) | `~/voom-ceo-dashboard/docs/specs/2026-06-05-whatsapp-agentic-system/artifacts/03-jim-wa-voice-library.md` |
| Service code | `~/voom-ceo-dashboard/server/whatsapp-*.ts` (10 files per §4) |
| Service tests | `~/voom-ceo-dashboard/server/whatsapp-*.test.ts` |
| Reused scripts | `~/voom-ceo-dashboard/scripts/triage-*.ts` |
| Daily JSONL logs | `~/voom-ceo-dashboard/data/whatsapp-triage/YYYY-MM-DD-burndown.jsonl` |
| Errors log | `~/voom-ceo-dashboard/data/whatsapp-triage/errors.jsonl` |
| Implementation plan (next) | `~/voom-ceo-dashboard/docs/plans/2026-06-07-slice-2-autonomous-triage-plan.md` (writing-plans skill, next step) |

## 14. Ops prerequisites (Jim, in parallel with implementation)

1. **Meta Business Verification on Jim Bilie's Business portfolio** — submitted 2026-06-07, expected response within 48 hours. If rejected, fall back to `bilie` portfolio.
2. **Twilio WhatsApp Sender provisioning** — new dedicated number requested through the Twilio console under the verified portfolio. Display Name approval from Meta (~1-3 days).
3. **Replit env vars on voom-ceo-dashboard** — `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WA_FROM_NUMBER` (the new number, `whatsapp:+...` format), `JIM_PERSONAL_WA_NUMBER` (escalation target, `whatsapp:+...` format), `ANTHROPIC_API_KEY`. `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` may already be present from voom-ghana-marketplace and need to be copied.
4. **Webhook URL configuration in Twilio console** — point WhatsApp Business inbound to `https://<replit-public-url>/api/whatsapp-inbound`.
5. **FB ad re-pointing (gradual)** — change the WhatsApp CTA target on FB ads to the new number once production traffic on the new number is healthy for ~24 hours.
