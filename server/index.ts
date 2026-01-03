import express from "express";
import type { NextFunction, Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";

import { PORT } from "./config.js";
import { prisma } from "./prisma.js";
import { logger, bindRequestLogger, getRequestLogger } from "./lib/logger.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerSettingsRoutes } from "./routes/settings.js";
import { registerTransactionRoutes } from "./routes/transactions.js";
import { registerEmployeeRoutes } from "./routes/employees.js";
import { registerTimesheetRoutes } from "./routes/timesheets.js";
import { registerCounterpartRoutes } from "./routes/counterparts.js";
import { registerInventoryRoutes } from "./routes/inventory.js";
import { registerUserRoutes } from "./routes/users.js";
import { registerLoanRoutes } from "./routes/loans.js";
import { registerServiceRoutes } from "./routes/services.js";
import { registerCalendarEventRoutes } from "./routes/calendar-events.js";
import { getUploadsRootDir } from "./lib/uploads.js";
import { registerDailyProductionBalanceRoutes } from "./routes/daily-production-balances.js";

import { startCalendarCron, stopCalendarCron } from "./lib/calendar-cron.js";
import { setupAllWatchChannels } from "./lib/google-calendar-watch.js";
import shareTargetRouter from "./routes/share-target.js";
import notificationsRouter from "./routes/notifications.js";
import csvUploadRouter from "./routes/csv-upload/index.js";

export const app = express();

app.disable("x-powered-by");
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cookieParser());
import { softAuthenticate } from "./lib/http.js";
import { attachAbility } from "./middleware/attachAbility.js";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

// Cloudflare Proxy Trust
app.set("trust proxy", 1); // Trust the first proxy (Cloudflare)

// Security Headers
app.use(
  helmet({
    contentSecurityPolicy: false, // We handle CSP manually below due to strict requirements
    crossOriginEmbedderPolicy: false,
  })
);

// Rate Limiting (Basic DDoS Prevention)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per window
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: "Too many requests from this IP, please try again later.",
});
app.use("/api", limiter);

// Stricter Auth Rate Limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50, // 50 login attempts per 15 min
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/auth", authLimiter);

app.use(softAuthenticate);
app.use(attachAbility);

const CSP_HEADER_VALUE = [
  "default-src 'self'",
  [
    "script-src",
    "'self'",
    "https://intranet.bioalergia.cl",
    "https://intranet.bioalergia.cl/assets/",
    "https://intranet.bioalergia.cl/cdn-cgi/scripts/7d0fa10a/cloudflare-static/",
    "https://intranet.bioalergia.cl/cdn-cgi/rum",
    "https://static.cloudflareinsights.com",
    "'unsafe-inline'",
  ].join(" "),
  ["worker-src", "'self'", "https://intranet.bioalergia.cl"].join(" "),
  ["connect-src", "'self'", "https://intranet.bioalergia.cl", "https://static.cloudflareinsights.com"].join(" "),
  "img-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "base-uri 'self'",
  "frame-ancestors 'self'",
].join("; ");

app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Content-Security-Policy", CSP_HEADER_VALUE);
  next();
});
app.use((req: Request, res: Response, next: NextFunction) => {
  const requestLogger = bindRequestLogger(req, res);
  requestLogger.info({ event: "request:start" });
  res.on("finish", () => {
    requestLogger.info({ event: "request:complete", statusCode: res.statusCode });
  });
  next();
});

app.use("/api", async (_req: Request, res: Response, next: NextFunction) => {
  // Prisma handles connection management automatically.
  // We can add a simple check if needed, but usually it's not required per request.
  next();
});

registerAuthRoutes(app);
registerSettingsRoutes(app);
registerTransactionRoutes(app);
registerEmployeeRoutes(app);
registerTimesheetRoutes(app);
registerCounterpartRoutes(app);
registerInventoryRoutes(app);
import { registerBalanceRoutes } from "./routes/balances.js";
registerBalanceRoutes(app);
import personRouter from "./routes/person.routes.js";

app.use("/api/people", personRouter);
registerUserRoutes(app);
registerLoanRoutes(app);
registerServiceRoutes(app);
registerCalendarEventRoutes(app);
registerDailyProductionBalanceRoutes(app);
app.use("/share-target", shareTargetRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/csv-upload", csvUploadRouter);
import { registerSuppliesRoutes } from "./routes/supplies.js";
registerSuppliesRoutes(app);
import { registerRoleRoutes } from "./routes/roles.js";
registerRoleRoutes(app);
import backupsRouter from "./routes/backups.js";
app.use("/api/backups", backupsRouter);
import auditRouter from "./routes/audit.js";
app.use("/api/audit", auditRouter);

import mercadopagoRouter from "./routes/mercadopago.js";
app.use("/api/mercadopago", mercadopagoRouter);

import { startGoogleCalendarScheduler } from "./lib/google-calendar-scheduler.js";
startGoogleCalendarScheduler();
import { initializeBackupScheduler, stopBackupScheduler } from "./services/backup/scheduler.js";

type HealthStatus = "ok" | "error";
type HealthChecks = { db: { status: HealthStatus; latency: number | null } };

app.get("/api/health", async (_req: Request, res: Response) => {
  const checks: HealthChecks = { db: { status: "ok", latency: null } };
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    checks.db.latency = Date.now() - start;
  } catch (error) {
    checks.db.status = "error";
    checks.db.latency = null;
    getRequestLogger(_req).error({ error }, "Health check failed");
  }
  res.json({ status: checks.db.status === "ok" ? "ok" : "degraded", timestamp: new Date().toISOString(), checks });
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.join(__dirname, "../client");
const uploadsDir = getUploadsRootDir();

// ============= CACHE CONTROL =============
// Middleware para controlar cache del browser según tipo de archivo
app.use((req, res, next) => {
  const url = req.url;

  // HTML: NO cache (siempre debe ser fresh para detectar nuevos builds)
  if (url.endsWith(".html") || url === "/" || !url.includes(".")) {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
  // SW y Manifest: NO cache (necesitan ser fresh)
  else if (url.includes("/sw.js") || url.includes("/manifest.json")) {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
  }
  // Assets con hash (JS, CSS): Cache largo (son immutables por hash)
  // Vite genera: script-a1b2c3d4.js, style-e5f6g7h8.css
  else if (url.match(/\.(js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|webp|ico)$/)) {
    if (url.match(/\.[a-f0-9]{8}\./)) {
      // Tiene hash → cache 1 año (immutable)
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    } else {
      // Sin hash → cache corto con revalidation
      res.setHeader("Cache-Control", "public, max-age=3600, must-revalidate");
    }
  }

  next();
});

// Cache headers: index.html never cached, assets cached forever (Vite hashes handle busting)
app.use((req: Request, res: Response, next) => {
  if (req.path === "/" || req.path.endsWith("/index.html")) {
    res.set("Cache-Control", "public, max-age=0, must-revalidate");
  } else if (STATIC_EXTENSIONS.test(req.path)) {
    res.set("Cache-Control", "public, max-age=31536000, immutable");
  }
  next();
});

app.use(express.static(clientDir, { index: false }));
app.use("/uploads", express.static(uploadsDir));

// Redirect manifest.json to manifest.webmanifest
app.get("/manifest.json", (_req: Request, res: Response) => {
  res.sendFile(path.join(clientDir, "manifest.webmanifest"));
});

// SPA fallback - serve index.html para rutas no encontradas
// Express 5: need separate handlers for "/" and "/*path"
const sendIndexHtml = (_req: Request, res: Response) => {
  res.sendFile(path.join(clientDir, "index.html"));
};

// Known static file extensions that should NOT fallback to index.html
// If these don't exist, return 404 instead of HTML (prevents MIME type errors)
const STATIC_EXTENSIONS = /\.(js|mjs|css|map|json|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$/i;

app.get("/", sendIndexHtml);
app.get("/*path", (req: Request, res: Response) => {
  // If requesting a static asset that doesn't exist, return 404
  // This prevents returning HTML for missing JS chunks (MIME type error)
  if (STATIC_EXTENSIONS.test(req.path)) {
    return res.status(404).send("Not found");
  }
  // For all other routes (SPA navigation), serve index.html
  sendIndexHtml(req, res);
});

import { syncPermissions } from "./services/permissions.js";

const server = app.listen(PORT, async () => {
  logger.info(`🚀 Server ready at http://localhost:${PORT}`);
  logger.info(`📦 Serving static files from: ${clientDir}`);
  logger.info(`📤 Uploads directory: ${uploadsDir}`);

  // Auto-sync permissions on startup (only if changed - uses hash-based detection)
  try {
    const result = await syncPermissions();
    logger.info({ event: "permissions_sync", ...result });
  } catch (err) {
    logger.error({ event: "permissions_sync_error", error: err });
  }

  // Start calendar cron jobs (webhook renewal + fallback sync)
  startCalendarCron();

  // Setup webhook watch channels for all calendars (register if missing)
  setupAllWatchChannels().catch((err) => {
    logger.error({ event: "setup_watch_channels_error", error: err });
  });

  // Start backup scheduler (hourly Mon-Sat 10-22, daily at 03:00)
  initializeBackupScheduler();
});

// Graceful Shutdown
const shutdown = async (signal: string) => {
  logger.info({ event: "shutdown:start", signal });

  // 1. Stop accepting new requests
  server.close(async () => {
    logger.info({ event: "shutdown:server_closed" });

    try {
      // 2. Stop cron jobs
      stopCalendarCron();
      stopBackupScheduler();
      logger.info({ event: "shutdown:cron_stopped" });

      // 3. Disconnect Database
      await prisma.$disconnect();
      logger.info({ event: "shutdown:db_disconnected" });

      // 4. Exit
      process.exit(0);
    } catch (err) {
      logger.error({ event: "shutdown:error", error: err });
      process.exit(1);
    }
  });

  // Force exit if graceful shutdown takes too long (e.g. 10s)
  setTimeout(() => {
    logger.error({ event: "shutdown:timeout" });
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export default server;
