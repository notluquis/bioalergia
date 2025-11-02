import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";

import { getPool } from "./db.js";
import { bindRequestLogger, getRequestLogger, logger } from "./lib/logger.js";
import { runMigrations } from "./migrationRunner.js";
import { PORT } from "./config.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerSettingsRoutes } from "./routes/settings.js";
import { registerTransactionRoutes } from "./routes/transactions.js";
import { registerBalanceRoutes } from "./routes/balances.js";
import { registerEmployeeRoutes } from "./routes/employees.js";
import { registerTimesheetRoutes } from "./routes/timesheets.js";
import { registerCounterpartRoutes } from "./routes/counterparts.js";
import suppliesRouter from "./routes/supplies.js";
import { registerInventoryRoutes } from "./routes/inventory.js";
import { registerRoleRoutes } from "./routes/roles.js";
import { registerLoanRoutes } from "./routes/loans.js";
import { registerServiceRoutes } from "./routes/services.js";
import { registerAssetRoutes } from "./routes/assets.js";

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use((req, res, next) => {
  const requestLogger = bindRequestLogger(req, res);
  requestLogger.info({ event: "request:start" });
  res.on("finish", () => {
    requestLogger.info({ event: "request:complete", statusCode: res.statusCode });
  });
  next();
});

// API Routes
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
app.use("/api/supplies", suppliesRouter);
registerAssetRoutes(app);

app.get("/api/health", async (_req, res) => {
  const requestLogger = getRequestLogger(_req);
  requestLogger.info({ event: "health:start" });
  const checks: {
    db: { status: "ok" | "error"; latency: number | null; message?: string };
  } = {
    db: { status: "ok", latency: null },
  };

  let status: "ok" | "degraded" | "error" = "ok";

  const start = Date.now();
  try {
    const pool = getPool();
    await pool.execute("SELECT 1");
    checks.db.latency = Date.now() - start;
  } catch (error) {
    checks.db.status = "error";
    checks.db.message = error instanceof Error ? error.message : "Error desconocido";
    status = "degraded";
    requestLogger.error({ event: "health:error", error }, "Fallo al consultar la base de datos");
  }

  res.json({
    status,
    timestamp: new Date().toISOString(),
    checks,
  });
  requestLogger.info({ event: "health:complete", status });
});

// --- Production Frontend Serving ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carpeta con el build del cliente (Vite)
const clientDir = path.resolve(__dirname, "../dist/client");

// Archivos estáticos de la SPA en la raíz
app.use(express.static(clientDir, { index: false }));

// Cualquier ruta que no sea /api responde index.html para que React Router se encargue
app.get(/^(?!\/api).*$/, (_req, res) => {
  res.sendFile(path.join(clientDir, "index.html"));
});
// --- End Production Frontend Serving ---

app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  getRequestLogger(req).error({ err }, "Unhandled server error");
  const status = typeof err.statusCode === "number" ? err.statusCode : 500;
  res.status(status).json({
    status: "error",
    message: err.message || "Error inesperado en el servidor",
  });
});

runMigrations()
  .then(() => {
    app.listen(PORT, () => {
      logger.info("🚀 ===== SERVIDOR FINANZAS APP =====");
      logger.info(`📡 API: http://localhost:${PORT}/api/health`);
      logger.info(`🌐 Frontend: http://localhost:${PORT}/`);
      logger.info("⚡ Estado: Servidor iniciado y listo");
      logger.info("=====================================");
    });
  })
  .catch((error) => {
    logger.error({ error }, "❌ ===== ERROR DE INICIALIZACIÓN =====");
    logger.error("💾 No se pudo inicializar la base de datos");
    logger.error("=====================================");
    process.exit(1);
  });
