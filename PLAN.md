# Execution Plan — Codebase Audit Fixes + WhatsApp Module

## Phase 1: Backend Consolidation
1. **Delete `server/vite-api-plugin.ts`** — confirmed redundant. `pnpm dev` runs Express via concurrently, Vite proxy at line 50 of vite.config.ts routes `/api` → `localhost:3001`.
2. **Update `vite.config.ts`** — remove viteApiPlugin import and registration. Keep proxy config.
3. **Leave Vercel files** — user undecided on deployment target.
4. **Verify dev workflow** — ensure `pnpm dev` still works with proxy-only routing.

## Phase 2: Security
5. **Enforce service role key** in `server/supabase.ts` — throw fatal error on startup if `SUPABASE_SERVICE_ROLE_KEY` is missing in production. Keep anon-key fallback for local dev only.

## Phase 3: Error Handling & Offline States
6. **Fix ErrorBoundary.tsx** — redact stack traces in production, restyle to Arctic Glass design.
7. **Fix Home.tsx dead state** — remove global KPI null guard from `renderSection()`. Let sections handle their own empty states.
8. **Add empty states** to section components that currently crash on null kpis.

## Phase 4: CRM Pipeline Fix
9. **Fix `derivePipeline`** in VendorCRM.tsx — stop mapping rejected/suspended vendors to "Responded".
10. **Generate SQL migration** for `pipeline_stage` enum column on vendors table — output to `migrations/add_pipeline_stage.sql` for manual review and execution.
11. **Update backend** — add API support for reading/writing the new pipeline_stage field.
12. **Update CRM UI** — allow manual pipeline stage progression.

## Phase 5: Navigation & Theming Cleanup
13. **Extract shared nav config** — single source of truth for Sidebar.tsx and MobileNav.tsx.
14. **Wire up badges** — show real counts (e.g., pending approvals) from API data.
15. **Remove ThemeContext.tsx** — delete dark mode toggle, hardcode light theme.
16. **Fix hardcoded version string** — pull from package.json or make it dynamic.

## Phase 6: WhatsApp Acquisition Module
17. **Read WHATSAPP_ACQUISITION_SPEC.md** for requirements.
18. **Build React components** — group discovery UI, outreach campaign builder, tracking dashboard.
19. **Add backend routes** — Express endpoints for WhatsApp acquisition data.
20. **Integrate into navigation** — add to Sidebar, MobileNav, Home.tsx routing.

## What I will NOT do
- Delete Vercel files (user undecided)
- Run SQL migrations against production DB (user will run manually)
- Add features not in the audit document
