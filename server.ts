import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";

// Import route handlers & middleware
import healthRouter from "./server/routes/health";
import chatRouter from "./server/routes/chat";
import titleRouter from "./server/routes/title";
import suggestRouter from "./server/routes/suggest";
import modelsRouter from "./server/routes/models";
import memoryRouter from "./server/routes/memory";
import { requireAuth } from "./server/middleware/auth";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Trust proxy settings for secure rate limiting behind load balancers/proxies
app.set("trust proxy", 1);

// Restrict cors to ALLOWED_ORIGIN env var (default same-origin only)
const allowedOrigin = process.env.ALLOWED_ORIGIN;
app.use(cors(allowedOrigin ? { origin: allowedOrigin } : { origin: false }));

// Body parser with 25mb limit
app.use(express.json({ limit: "25mb" }));

// Rate limiter for AI endpoints: 30 req/min per Supabase user ID or IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => {
    return req.user?.id || req.ip || "anonymous";
  },
  handler: (_req, res) => {
    res.status(429).json({ error: "Rate limit reached, try again in a minute", code: 429 });
  },
});

// Protect secure AI endpoints with requireAuth and rate limiter
app.use("/api/chat", requireAuth, apiLimiter, chatRouter);
app.use("/api/title", requireAuth, apiLimiter, titleRouter);
app.use("/api/suggest", requireAuth, apiLimiter, suggestRouter);
app.use("/api/models", modelsRouter);
app.use("/api/memory", memoryRouter);

// Open healthcheck route
app.use("/api", healthRouter);

// Serve frontend with Vite middlewares in dev or static files in production
const isProd = process.env.NODE_ENV === "production";
if (!isProd) {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    server: { middlewareMode: true, host: "0.0.0.0", port: 3000 },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.join(__dirname, "dist")));
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(__dirname, "dist", "index.html"));
  });
}

const port = Number(process.env.PORT) || 3000;
app.listen(port, "0.0.0.0", () => {
  console.log(`Server is running at http://0.0.0.0:${port}`);
});
export default app;
