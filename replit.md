# VOOM CEO Dashboard

A CEO/admin dashboard for the VOOM Ghana marketplace platform, built with React, Vite, and Express.

## Architecture

- **Frontend**: React 19 + Vite 7, TailwindCSS 4, shadcn/ui components, Recharts, Framer Motion
- **Backend**: Express.js server with Drizzle ORM + PostgreSQL
- **Dev mode**: Vite dev server (port 5000) proxies `/api` requests to Express (port 3001)
- **Production**: Express serves the pre-built Vite static files on port 3000

## Project Structure

```
client/        React frontend source
server/        Express backend (index.ts, routes.ts, db.ts, vite-api-plugin.ts)
shared/        Shared TypeScript schemas (Drizzle schema)
api/           Vercel serverless adapter (legacy, not used on Replit)
dist/public/   Built frontend output
dist-server/   Built server output
```

## Running the App

- **Dev**: `pnpm run dev` — starts both Express (port 3001) and Vite (port 5000) concurrently
- **Build**: `pnpm run build` — builds frontend + server
- **Start (prod)**: `pnpm run start` — runs compiled Express server

## Environment Variables

See `.env.example` for all available variables:

- `DATABASE_URL` — PostgreSQL connection string (required for live data; without it, runs in "Demo Mode")
- `PORT` — Server port (defaults: 3001 in dev, 3000 in production)
- `DASHBOARD_API_KEY` — Optional API key to protect all `/api/*` endpoints in production
- `ALLOWED_ORIGINS` — Comma-separated CORS origins (optional; open in dev)
- `NODE_ENV` — `development` or `production`

## Security Features

- Helmet.js for secure HTTP headers
- CORS with configurable allowed origins
- Rate limiting: 200 req/15min general, 60 req/15min for analytics endpoints
- API key authentication (production only, when `DASHBOARD_API_KEY` is set)
- PII redaction in server logs (phone numbers, emails, names)
- `noindex, nofollow` robots header on all responses

## Key Dependencies

- `drizzle-orm` + `pg` — PostgreSQL ORM
- `@neondatabase/serverless` — Neon DB support
- `express-rate-limit` — Rate limiting (uses `ipKeyGenerator` for IPv6 safety)
- `concurrently` — Runs Express + Vite simultaneously in dev
- `wouter` — Client-side routing (patched)

## Replit Migration Notes

- Vite dev server runs on port 5000 (required for Replit webview)
- Express API server runs on port 3001 (proxied by Vite)
- Both processes start via `pnpm run dev` using `concurrently`
- `ipKeyGenerator` from `express-rate-limit` used to fix IPv6 key generator validation errors
