# CLAUDE.md — VOOM CEO Dashboard

## Project Overview

CEO/admin dashboard for VOOM Ghana marketplace platform. React 19 + Vite + Express + Drizzle ORM + PostgreSQL (Supabase). Shares the marketplace's underlying database (same `vendors`, `products`, `users` tables; schema duplicated in both repos in `shared/schema.ts`).

This is a **companion** repo to `voom-ghana-marketplace` (the customer-facing marketplace product). Together they form VOOM's operating surface; one runs the marketplace, the other runs the founder's console.

## Key Files

- `server/db.ts` — Drizzle DB connection (uses `DATABASE_URL` env var)
- `server/routes.ts` — Express API routes
- `server/supabase.ts` — Supabase admin client (for tasks the Drizzle connection can't do)
- `shared/schema.ts` — Drizzle schema (vendors, products, users, claims, etc.)
- `client/src/VendorCRM.tsx` — Vendor CRM page (pipeline stages)
- `client/src/WhatsAppAcquisition.tsx` — WhatsApp discovery module ("Outreach CRM" route)
- `WHATSAPP_ACQUISITION_SPEC.md` — full spec for the WhatsApp acquisition module
- `CEO_STRATEGIC_REVIEW.md` — periodic strategy doc
- `CLAUDE_CODE_AUDIT_FIXES.md` — audit findings for past Claude Code work

## Key Commands

```bash
pnpm dev                       # Start Express + Vite in dev
pnpm check                     # TypeScript type-check
pnpm db:push                   # Apply schema changes to DB
pnpm db:studio                 # Open Drizzle Studio (visual DB browser)
pnpm export:dormant-vendors    # Export dormant-vendor cohort to data/dormant-vendors.json (input for ashley agent)
```

## Conventions

- TypeScript strict; ESM modules.
- shadcn/ui (Arctic Glass design system — see `WHATSAPP_ACQUISITION_SPEC.md` §2.2 for color tokens).
- Use `pnpm` exclusively.
- Server entry: `server/index.ts`.
- All new tRPC-style API routes go in `server/routes.ts`.
- Database queries go through `drizzle-orm`; do not use raw `pg` queries except where Supabase admin client is needed.
- PII redaction is enforced in server logs (phone, email, name). New endpoints must respect this.
- `noindex, nofollow` robots header is set globally — do not weaken this.

## Agents

This repo hosts specialized Claude Code subagents in `.agents/`. Each agent lives in two synced locations:

| Canonical (version-tracked) | Live (read by Claude Code at session start) |
|---|---|
| `.agents/<name>.md` | `~/.claude/agents/<name>.md` |

**Sync rule:** any edit to either file must be mirrored to the other. There is no symlink in v1; treat them as a pair. After editing in the canonical location, run:

```bash
cp .agents/<name>.md ~/.claude/agents/<name>.md
```

Then commit the canonical change in this repo.

**New agents** are picked up by Claude Code on session start — restart the session after creating one.

### Current agents

| Name | Purpose | Spec | Plan | Persona seed |
|---|---|---|---|---|
| `ashley` | Dormant-vendor outreach drafting (drafts voice-note scripts + WhatsApp text for the 332-vendor dormant cohort) | `docs/specs/2026-05-20-ashley-design.md` | `docs/plans/2026-05-20-ashley-v1.md` | `.agents/ashley-persona.md` |

### Cross-repo agents

The companion repo `voom-ghana-marketplace` hosts the `wilke` (COO-persona) agent. Ashley reads wilke's six-pager output as a strategy anchor. See `voom-ghana-marketplace/CLAUDE.md` > Agents for that one.

The personal workspace `voom-fundraise` hosts the `etienne` (fundraise-outreach) agent.

## Environment

See `.env.example` for the required variables. The critical one for ashley's input pipeline is `DATABASE_URL`.
