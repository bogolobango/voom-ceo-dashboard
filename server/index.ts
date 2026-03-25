import express from "express";
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

  // ── Security Headers (Helmet) ──
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
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
    methods: ["GET", "POST"],
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

    // In development, allow all requests
    if (process.env.NODE_ENV !== "production") return next();

    // In production, require API key if one is configured
    if (apiKey) {
      const provided = req.headers["x-api-key"] || req.query.apiKey;
      if (provided !== apiKey) {
        return res.status(401).json({ error: "Unauthorized. Provide a valid API key." });
      }
    }

    next();
  });

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

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    console.log(`Database: ${process.env.DATABASE_URL ? "configured" : "not configured (offline mode)"}`);
    console.log(`Auth: ${apiKey ? "API key required in production" : "open access (set DASHBOARD_API_KEY for production)"}`);
    console.log(`Rate limiting: 200 req/15min (general), 60 req/15min (analytics)`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
