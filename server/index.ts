import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";

import { ensureSchema, getPool } from "./db.js";
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
app.use((req, _res, next) => {
  console.log(`[req] ${req.method} ${req.originalUrl}`);
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
  console.info("[steps][health] Step 0: /api/health recibido");
  const checks: {
    db: { status: "ok" | "error"; latency: number | null; message?: string };
  } = {
    db: { status: "ok", latency: null },
  };

  let status: "ok" | "degraded" | "error" = "ok";

  const start = Date.now();
  try {
    const pool = getPool();
    console.info("[steps][health] Step 1: ejecutando SELECT 1");
    await pool.execute("SELECT 1");
    checks.db.latency = Date.now() - start;
    console.info("[steps][health] Step 2: SELECT 1 OK", checks.db.latency);
  } catch (error) {
    checks.db.status = "error";
    checks.db.message = error instanceof Error ? error.message : "Error desconocido";
    status = "degraded";
    console.error("[steps][health] Step error: fallo en consulta", error);
  }

  res.json({
    status,
    timestamp: new Date().toISOString(),
    checks,
  });
  console.info("[steps][health] Step final: respuesta enviada", status);
});

// --- Production Frontend Serving ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carpeta con el build del cliente (Vite)
// Nota: en runtime __dirname === dist/server, por lo tanto el cliente está en ../client
const clientDir = path.resolve(__dirname, "../client");

if (!process.env.VITE_SKIP_CLIENT_CHECK) {
  try {
    // Lightweight existence check
    if (!require('fs').existsSync(clientDir)) {
      console.warn(`[startup] Advertencia: carpeta de cliente no encontrada en ${clientDir}. ¿Olvidaste ejecutar 'npm run build:prod'?`);
    }
  } catch {
    // ignore
  }
}

// Archivos estáticos de la SPA en la raíz
app.use(express.static(clientDir, { index: false }));

// Cualquier ruta que no sea /api responde index.html para que React Router se encargue
app.get(/^(?!\/api).*$/, (_req, res) => {
  res.sendFile(path.join(clientDir, "index.html"));
});
// --- End Production Frontend Serving ---

interface GenericErrorLike { statusCode?: number; message?: unknown }
function isGenericErrorLike(value: unknown): value is GenericErrorLike {
  return typeof value === 'object' && value !== null;
}
app.use((err: unknown, _req: express.Request, res: express.Response) => {
  console.error(err);
  let status = 500;
  let message = 'Error inesperado en el servidor';
  if (err instanceof Error) {
    message = err.message;
  } else if (isGenericErrorLike(err)) {
    if (typeof err.message === 'string') message = err.message;
    if (typeof err.statusCode === 'number') status = err.statusCode;
  }
  res.status(status).json({ status: 'error', message });
});

ensureSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log('\n🚀 ===== SERVIDOR FINANZAS APP =====');
      console.log(`📡 API: http://localhost:${PORT}/api/health`);
      console.log(`🌐 Frontend: http://localhost:${PORT}/`);
      console.log(`⚡ Estado: Servidor iniciado y listo`);
      console.log('=====================================\n');
    });
  })
  .catch((error) => {
    console.error('\n❌ ===== ERROR DE INICIALIZACIÓN =====');
    console.error("💾 No se pudo inicializar la base de datos:");
    console.error(error);
    console.error('=====================================\n');
    process.exit(1);
  });
