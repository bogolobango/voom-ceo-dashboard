# VOOM Ghana CEO Dashboard — Exhaustive Codebase Audit & Fix Plan

This document contains a comprehensive, unbiased audit of the `voom-ceo-dashboard` codebase. It is designed to be fed directly into Claude Code to execute a series of structural, security, UX/UI, and feature fixes.

The audit covers the entire stack: frontend React architecture, backend Express/Supabase integration, database schema, design system consistency, and deployment configuration.

---

## 1. Architectural & Backend Consolidation

The most critical issue in the codebase is the presence of three overlapping backend implementations. This causes environment drift, inconsistent authentication, and deployment confusion.

### 1.1. The "Three Backends" Problem
Currently, the application attempts to serve `/api/*` routes through three different paths:
1. **Express + Supabase (`server/routes.ts`)**: The intended production backend. It uses the Supabase JS client and requires an API key in production.
2. **Vite Dev Plugin (`server/vite-api-plugin.ts`)**: A custom Vite middleware that intercepts API calls during development. It uses a Supabase anon client and bypasses all authentication and rate-limiting middleware.
3. **Vercel Serverless (`api/[...path].ts`)**: A legacy or alternate backend using Drizzle ORM and raw PostgreSQL connections, with its own caching and error handling.

**Fix Instructions for Claude Code:**
- **Delete `api/[...path].ts`**: The user has confirmed the deployment target is Replit (Express server), not Vercel serverless. Remove this file entirely to eliminate the Drizzle/Postgres duplication.
- **Delete `server/vite-api-plugin.ts`**: The user does not need offline/no-server development. Remove this custom Vite plugin.
- **Update `vite.config.ts`**: Remove the `viteApiPlugin` import and registration. Ensure the dev server relies exclusively on the `proxy` configuration to route `/api` requests to the Express server running on port 3001.
- **Update `vercel.json`**: Remove or update this file to reflect that the app is a Node.js Express application, not a static site with serverless functions, or delete it if Replit is the sole deployment target.

### 1.2. Supabase Key Security & Privilege Escalation
In `server/supabase.ts`, the server initializes the Supabase client by falling back through environment variables: `SUPABASE_SERVICE_ROLE_KEY` → `SUPABASE_ANON_KEY` → `VITE_SUPABASE_ANON_KEY`.

If the service role key is missing, the server silently uses the anon key. Because the server performs privileged operations (e.g., updating vendor status, changing tiers, inserting notifications), using an anon key subject to Row Level Security (RLS) will cause these mutations to fail silently or behave unpredictably.

**Fix Instructions for Claude Code:**
- **Enforce Service Role Key**: Modify `server/supabase.ts` to strictly require `SUPABASE_SERVICE_ROLE_KEY` for server-side operations.
- **Throw on Missing Key**: If the service role key is not provided, throw a fatal error during server startup rather than falling back to an anon key. The server must not run in a degraded, unprivileged state for admin operations.

---

## 2. Frontend UX/UI & Error Handling

The frontend generally adheres to the Arctic Glass design system, but there are significant gaps in error handling, offline states, and component consistency.

### 2.1. Global Error Boundary Leaks Stack Traces
The root `ErrorBoundary.tsx` catches unhandled React exceptions and displays the raw `error.stack` in a `<pre>` tag. This leaks internal file paths and code structure to end users. Furthermore, it uses shadcn/Tailwind utility classes, which visually clash with the inline-styled Arctic Glass aesthetic used throughout the rest of the dashboard.

**Fix Instructions for Claude Code:**
- **Redact Stack Traces**: Modify `ErrorBoundary.tsx` to display a generic, user-friendly error message in production. Only log the full stack trace to the console.
- **Redesign Fallback UI**: Rewrite the error boundary's render method to use the Arctic Glass design system (e.g., `glass-card` classes, Plus Jakarta Sans typography) so it matches the dashboard's visual language.

### 2.2. The "Dead State" Offline Bug
In `Home.tsx`, the `renderSection()` function returns a "No data available" screen if the derived `kpis` object is null. `kpis` is null when the initial data fetch fails or the database is offline. This design choice completely blocks access to sections that do not require live data, such as Security, Competitive Intel, and the CRM UI.

**Fix Instructions for Claude Code:**
- **Remove Global KPI Guard**: Modify `Home.tsx` so that `renderSection()` always attempts to render the active section, even if `kpis` is null.
- **Handle Null KPIs Locally**: Update individual section components (e.g., `Overview.tsx`, `Growth.tsx`) to handle a null `kpis` prop gracefully, displaying empty states or skeleton loaders instead of crashing.

### 2.3. Navigation Inconsistencies
The desktop `Sidebar.tsx` and the mobile `MobileNav.tsx` maintain separate, hardcoded lists of navigation items. The mobile nav includes descriptions and colors not present in the desktop sidebar. Additionally, the desktop sidebar supports a `badge` property for nav items, but no badges are ever passed or rendered.

**Fix Instructions for Claude Code:**
- **Consolidate Navigation Data**: Extract the navigation item definitions into a shared configuration file or constant.
- **Implement Badges**: Wire up the `badge` property in `Sidebar.tsx` to display actual counts (e.g., pending vendor approvals) fetched from the API.
- **Align Mobile and Desktop**: Ensure both navigation components use the same labels, icons, and ordering where appropriate, while respecting their distinct form factors.

### 2.4. Unused Dark Mode
The `ThemeContext.tsx` implements a light/dark theme toggle, but the user has explicitly requested that dark mode be removed. The Arctic Glass design system is currently optimized only for a light theme.

**Fix Instructions for Claude Code:**
- **Remove ThemeContext**: Delete `ThemeContext.tsx` and remove the `ThemeProvider` wrapper from `App.tsx`.
- **Hardcode Light Theme**: Ensure the application defaults to and strictly enforces the light theme, removing any dark-mode specific CSS variants or logic.

---

## 3. Feature Logic & Data Integrity

Several business logic implementations are semantically incorrect or incomplete, leading to inaccurate data representation on the dashboard.

### 3.1. CRM Pipeline Semantic Errors
In `VendorCRM.tsx`, the `derivePipeline` function maps vendors with a `rejected` or `suspended` status to the "Responded" stage of the sales funnel. This artificially inflates the positive response rate by categorizing banned or rejected vendors as active prospects.

**Fix Instructions for Claude Code:**
- **Correct Pipeline Mapping**: Update `derivePipeline` to exclude `rejected` and `suspended` vendors from the active sales funnel metrics.
- **Add Pipeline Stage Field**: Update the database schema (`shared/schema.ts`) to include a dedicated `pipeline_stage` enum field on the `vendors` table.
- **Update API and UI**: Modify the backend to support updating this new field, and update the CRM UI to allow manual progression of vendors through the pipeline stages, rather than deriving it solely from their approval status.

### 3.2. Hardcoded Version Strings
The `Sidebar.tsx` component contains a hardcoded version string: `"Early Stage · Mar 2026"`. This will quickly become outdated.

**Fix Instructions for Claude Code:**
- **Dynamic Versioning**: Replace the hardcoded date with a dynamic value, or remove the date entirely and rely on a version number pulled from `package.json` or an environment variable.

### 3.3. Missing WhatsApp Acquisition Module
The previous task generated backend scaffolding and a specification (`WHATSAPP_ACQUISITION_SPEC.md`) for a WhatsApp group discovery and outreach bot. However, the frontend UI component for this feature was never built or integrated into the dashboard.

**Fix Instructions for Claude Code:**
- **Implement WhatsApp UI**: Read `WHATSAPP_ACQUISITION_SPEC.md` and build the corresponding React components.
- **Integrate into Dashboard**: Add the new WhatsApp Acquisition module to the navigation (Sidebar and MobileNav) and routing logic in `Home.tsx`.

---

## Execution Summary for Claude Code

When executing this plan, prioritize the fixes in the following order:
1. **Backend Consolidation**: Delete the redundant backends and fix the Vite proxy configuration.
2. **Security**: Enforce the Supabase service role key requirement.
3. **Error Handling & Offline States**: Fix the global error boundary and remove the `kpis` render guard.
4. **CRM Logic**: Correct the pipeline derivation and add the new database field.
5. **Navigation & Theming**: Consolidate nav data, remove dark mode, and fix hardcoded strings.
6. **WhatsApp Module**: Implement the missing frontend UI based on the existing specification.
