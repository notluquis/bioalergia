import express from "express";
import type { NextFunction, Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";

import { PORT } from "./config.js";
import { ensureDatabaseConnection, getPool } from "./db.js";
import { logger, bindRequestLogger, getRequestLogger } from "./lib/logger.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerSettingsRoutes } from "./routes/settings.js";
import { registerTransactionRoutes } from "./routes/transactions.js";
import { registerBalanceRoutes } from "./routes/balances.js";
import { registerEmployeeRoutes } from "./routes/employees.js";
import { registerTimesheetRoutes } from "./routes/timesheets.js";
import { registerCounterpartRoutes } from "./routes/counterparts.js";
import { registerInventoryRoutes } from "./routes/inventory.js";
import { registerRoleRoutes } from "./routes/roles.js";
import { registerLoanRoutes } from "./routes/loans.js";
import { registerServiceRoutes } from "./routes/services.js";
import { registerCalendarEventRoutes } from "./routes/calendar-events.js";
import { registerAssetRoutes } from "./routes/assets.js";
import suppliesRouter from "./routes/supplies.js";
import { getUploadsRootDir } from "./lib/uploads.js";

const app = express();

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
  try {
    await ensureDatabaseConnection();
    next();
  } catch (error) {
    getRequestLogger(_req).error({ error }, "Database unavailable");
    res.status(503).json({ status: "error", message: "Base de datos no disponible en este momento" });
  }
});

registerAuthRoutes(app);
registerSettingsRoutes(app);
registerTransactionRoutes(app);
registerBalanceRoutes(app);
registerEmployeeRoutes(app);
registerTimesheetRoutes(app);
registerCounterpartRoutes(app);
registerInventoryRoutes(app);
registerRoleRoutes(app);
registerLoanRoutes(app);
registerServiceRoutes(app);
registerCalendarEventRoutes(app);
registerAssetRoutes(app);
app.use("/api/supplies", suppliesRouter);

type HealthStatus = "ok" | "error";
type HealthChecks = { db: { status: HealthStatus; latency: number | null } };

app.get("/api/health", async (_req: Request, res: Response) => {
  const checks: HealthChecks = { db: { status: "ok", latency: null } };
  try {
    const start = Date.now();
    const pool = getPool();
    await pool.execute("SELECT 1");
    checks.db.latency = Date.now() - start;
  } catch (error) {
    checks.db.status = "error";
    checks.db.latency = null;
    getRequestLogger(_req).error({ error }, "Health check failed");
  }
  res.json({ status: checks.db.status === "ok" ? "ok" : "degraded", timestamp: new Date().toISOString(), checks });
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDir = path.resolve(__dirname, "../client");
const uploadsDir = getUploadsRootDir();

app.use(express.static(clientDir, { index: false }));
app.use("/uploads", express.static(uploadsDir));
app.get(/^(?!\/api).*$/, (_req: Request, res: Response) => {
  res.sendFile(path.join(clientDir, "index.html"));
});

const port = Number(PORT) || 4000;
app.listen(port, () => {
  logger.info(`Servidor listo en http://localhost:${port}`);
});
