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
import { startDailyProductionReminderJob } from "./modules/dailyProductionReminders.js";
import shareTargetRouter from "./routes/share-target.js";
import notificationsRouter from "./routes/notifications.js";

export const app = express();

app.disable("x-powered-by");
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
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
import personRouter from "./routes/person.routes.js";
import userManagementRouter from "./routes/user-management.js";

// ... existing imports ...

app.use("/api/people", personRouter);
app.use("/api/users", userManagementRouter);
registerUserRoutes(app);
registerLoanRoutes(app);
registerServiceRoutes(app);
registerCalendarEventRoutes(app);
registerDailyProductionBalanceRoutes(app);
app.use("/share-target", shareTargetRouter);
app.use("/api/notifications", notificationsRouter);
startDailyProductionReminderJob();

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

// Serve static files
app.use(express.static(clientDir, { index: false }));
app.use("/uploads", express.static(uploadsDir));

// SPA fallback - serve index.html para rutas no encontradas
// Express 5: need separate handlers for "/" and "/*path"
const sendIndexHtml = (_req: Request, res: Response) => {
  res.sendFile(path.join(clientDir, "index.html"));
};

app.get("/", sendIndexHtml);
app.get("/*path", sendIndexHtml);

const server = app.listen(PORT, () => {
  logger.info(`🚀 Server ready at http://localhost:${PORT}`);
  logger.info(`📦 Serving static files from: ${clientDir}`);
  logger.info(`📤 Uploads directory: ${uploadsDir}`);
});

export default server;
