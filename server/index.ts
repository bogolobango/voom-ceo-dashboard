import express from "express";
import compression from "compression";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import helmet from "helmet";
import cors from "cors";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { z } from "zod";
import apiRoutes from "./routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Environment Validation ────────────────────────────────

const envSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
  PORT: z.string().regex(/^\d+$/).optional(),
  DASHBOARD_API_KEY: z.string().min(1).optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).optional(),
  ALLOWED_ORIGINS: z.string().optional(),
  // Agent A1
  ANTHROPIC_API_KEY: z.string().startsWith("sk-ant-").optional(),
  AGENT_MODEL: z.string().default("claude-sonnet-4-6"),
  MAX_AGENT_MESSAGES_PER_HOUR: z.coerce.number().int().positive().default(30),
  MAX_AGENT_MESSAGES_PER_DAY: z.coerce.number().int().positive().default(200),
  MAX_DAILY_AGENT_SPEND_CENTS: z.coerce.number().int().positive().default(500),
  MAX_TOOL_CALLS_PER_TURN: z.coerce.number().int().positive().default(8),
  AGENT_SPEND_ALERT_EMAIL: z.string().email().default("sales@voomparts.com"),
});

const env = envSchema.safeParse(process.env);
if (!env.success) {
  console.error("Invalid environment variables:", env.error.flatten().fieldErrors);
  process.exit(1);
}

// ─── Safe Error Logging (PII Redaction) ────────────────────

function redactPII(message: string): string {
  return message
    .replace(/\b0[23]\d{8,9}\b/g, "[PHONE_REDACTED]")
    .replace(/\b[\w.-]+@[\w.-]+\.\w{2,}\b/g, "[EMAIL_REDACTED]")
    .replace(/buyerName\s*[:=]\s*'[^']*'/gi, "buyerName='[REDACTED]'")
    .replace(/buyerPhone\s*[:=]\s*'[^']*'/gi, "buyerPhone='[REDACTED]'")
    .replace(/guestName\s*[:=]\s*'[^']*'/gi, "guestName='[REDACTED]'")
    .replace(/contactPhone\s*[:=]\s*'[^']*'/gi, "contactPhone='[REDACTED]'");
}

export function safeLogError(label: string, error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  console.error(`${label}: ${redactPII(msg)}`);
}

// ─── Server Setup ──────────────────────────────────────────

async function startServer() {
  const app = express();
  const server = createServer(app);

  // ── Compression (gzip/brotli — 80% smaller responses) ──
  app.use(compression());

  // ── Security Headers (Helmet) ──
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://*.supabase.co", "wss://*.supabase.co"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  // ── CORS ──
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map(o => o.trim())
    : undefined;

  app.use(cors({
    origin: allowedOrigins || (process.env.NODE_ENV === "production" ? false : true),
    credentials: true,
    methods: ["GET", "POST", "PATCH"],
    maxAge: 86400,
  }));

  // ── Rate Limiting ──
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests. Please try again later." },
    keyGenerator: (req) => ipKeyGenerator(req),
  });

  const heavyEndpointLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many analytics requests. Please try again later." },
    keyGenerator: (req) => ipKeyGenerator(req),
  });

  app.use(express.json({ limit: "1mb" }));

  // ── Prevent Search Engine Indexing ──
  app.use((_req, res, next) => {
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    next();
  });

  // ── API Authentication Middleware ──
  const apiKey = process.env.DASHBOARD_API_KEY;
  app.use("/api", (req, res, next) => {
    // Health check is always public
    if (req.path === "/health") return next();

    // Track endpoint is public — marketplace sends events without auth
    if (req.path === "/track" && req.method === "POST") return next();

    // In development, allow all requests
    if (process.env.NODE_ENV !== "production") return next();

    // In production: if DASHBOARD_API_KEY is set, enforce it for external
    // API consumers. If not set, allow all requests (dashboard is served
    // from the same origin and can't send custom headers).
    if (apiKey) {
      const provided = req.headers["x-api-key"];
      if (provided !== apiKey) {
        return res.status(401).json({ error: "Unauthorized. Provide a valid X-API-Key header." });
      }
    }

    next();
  });

  // ── Track endpoint: explicit CORS + higher rate limit (public ingestion) ──
  const trackLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000, // marketplace can send many events
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(req),
  });
  app.options("/api/track", cors()); // CORS preflight
  app.use("/api/track", trackLimiter);

  // ── Apply rate limiters ──
  app.use("/api/revenue", heavyEndpointLimiter);
  app.use("/api/growth", heavyEndpointLimiter);
  app.use("/api", apiLimiter);

  // ── API routes (database-connected) ──
  app.use(apiRoutes);

  // ── Static Files ──
  const staticPath = path.resolve(__dirname, "..", "dist", "public");
  app.use(express.static(staticPath));

  // ── robots.txt ──
  app.get("/robots.txt", (_req, res) => {
    res.type("text/plain").send("User-agent: *\nDisallow: /\n");
  });

  // ── Client-side routing fallback ──
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  // ── Global Error Handler ──
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    safeLogError("Unhandled server error", err);
    res.status(500).json({ error: "Internal server error" });
  });

  // In dev: 3001 (Vite proxies /api from 3000 → 3001). In prod: 3000.
  const port = process.env.PORT || (process.env.NODE_ENV === "production" ? 3000 : 3001);

  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${port}/`);
    console.log(`Database: ${process.env.VITE_SUPABASE_URL ? "Supabase configured" : "not configured (offline mode)"}`);
    console.log(`Auth: ${apiKey ? "API key required in production" : "open access (set DASHBOARD_API_KEY for production)"}`);
    console.log(`Rate limiting: 200 req/15min (general), 60 req/15min (analytics)`);
  });
}

// Only start the server when this file is executed directly (e.g. `tsx server/index.ts`).
// When imported by another module (e.g. tests importing safeLogError), do nothing —
// otherwise every test run would boot a real listening server.
const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMainModule) {
  startServer().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
}
