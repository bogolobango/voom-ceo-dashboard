import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import apiRoutes from "./routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(express.json());

  // API routes (database-connected)
  app.use(apiRoutes);

  // Serve static files from dist/public in production
  // In production, server runs from dist-server/, client files are in dist/public/
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "..", "dist", "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  // In dev: 3001 (Vite proxies /api from 3000 → 3001). In prod: 3000.
  const port = process.env.PORT || (process.env.NODE_ENV === "production" ? 3000 : 3001);

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    console.log(`Database: ${process.env.DATABASE_URL ? "configured" : "not configured (using mock data)"}`);
  });
}

startServer().catch(console.error);
