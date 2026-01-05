// apps/api - Hono + ZenStack Query-as-a-Service
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "@hono/node-server/serve-static";
import { createHonoHandler } from "@zenstackhq/server/hono";
import { RPCApiHandler } from "@zenstackhq/server/api";
import { schema, authDb } from "@finanzas/db";
import { getSessionUser, createAuthContext } from "./auth";
import { authRoutes } from "./routes/auth";
import { userRoutes } from "./routes/users";
import { mercadopagoRoutes } from "./routes/mercadopago";
import backupRoutes from "./routes/backups";
import notificationRoutes from "./routes/notifications";
import { csvUploadRoutes } from "./routes/csv-upload";
import { calendarRoutes } from "./routes/calendar";
import { shareTargetRoutes } from "./routes/share-target";
import { inventoryRoutes } from "./routes/inventory";
import { suppliesRoutes } from "./routes/supplies";
import loanRoutes from "./routes/loans";
import transactionRoutes from "./routes/transactions";
import balanceRoutes from "./routes/balances";
import dailyProductionRoutes from "./routes/daily-production-balances";
import counterpartRoutes from "./routes/counterparts";
import serviceRoutes from "./routes/services";
import roleRoutes from "./routes/roles";
import { settingsRoutes } from "./routes/settings";
import employeeRoutes from "./routes/employees";
import loanScheduleRoutes from "./routes/loan-schedules";
import serviceScheduleRoutes from "./routes/service-schedules";
import { readFile } from "fs/promises";
import { join } from "path";

const app = new Hono();

// CORS for frontend (same-origin in prod, localhost in dev)
app.use(
  "/api/*",
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);

// Health check (at root for Railway healthcheck)
app.get("/health", (c) => c.json({ status: "ok" }));
app.get("/api/health", (c) => c.json({ status: "ok" }));

// Auth routes (login, logout, session, MFA)

app.route("/api/auth", authRoutes);

// User routes (CRUD, roles, MFA, passkeys)
app.route("/api/users", userRoutes);

// Mercado Pago routes (reports, config, schedule)
app.route("/api/mercadopago", mercadopagoRoutes);

// Backup routes (backup, restore, SSE progress)
app.route("/api/backups", backupRoutes);

// Notification routes (push subscriptions)
app.route("/api/notifications", notificationRoutes);

// CSV upload routes (bulk import)
app.route("/api/csv-upload", csvUploadRoutes);

// Calendar routes (events, sync, logs)
app.route("/api/calendar", calendarRoutes);

// Share Target (PWA)
app.route("/api/share-target", shareTargetRoutes);

// Inventory & Supplies (Migrated)
app.route("/api/inventory", inventoryRoutes);
app.route("/api/supplies", suppliesRoutes);
app.route("/api/loans", loanRoutes);
app.route("/api/transactions", transactionRoutes);
app.route("/api/balances", balanceRoutes);
app.route("/api/daily-production-balances", dailyProductionRoutes);
app.route("/api/counterparts", counterpartRoutes);
app.route("/api/services", serviceRoutes);
app.route("/api/roles", roleRoutes);
app.route("/api/settings", settingsRoutes);
app.route("/api/employees", employeeRoutes);
app.route("/api/loan-schedules", loanScheduleRoutes);
app.route("/api/services/schedules", serviceScheduleRoutes);

// ZenStack Query-as-a-Service (auto CRUD for all models)
// Frontend uses /api/model/* (via QuerySettingsProvider in main.tsx)
const zenStackHandler = createHonoHandler({
  apiHandler: new RPCApiHandler({ schema }),
  getClient: async (ctx) => {
    // Extract user from JWT
    const user = await getSessionUser(ctx);
    const authContext = createAuthContext(user);

    if (authContext) {
      // Authenticated: apply access control policies
      return authDb.$setAuth(authContext);
    }

    // Anonymous: policies will deny access via @@deny('all', auth() == null)
    return authDb;
  },
});

// Mount at /api/model/* for frontend ZenStack hooks
app.use("/api/model/*", zenStackHandler);
// Also mount at /api/* for backward compatibility with direct API calls
app.use("/api/*", zenStackHandler);

// ============================================================================
// STATIC FILE SERVING (Frontend SPA)
// ============================================================================
// Only enable in production (when public folder exists)
if (process.env.NODE_ENV === "production") {
  // Serve static files from /public (Vite build output)
  app.use(
    "/*",
    serveStatic({
      root: "./public",
      // Don't serve index.html for missing files yet - SPA fallback handles that
    })
  );

  // SPA fallback: serve index.html for all non-API, non-asset routes
  app.get("*", async (c) => {
    try {
      const indexPath = join(process.cwd(), "public", "index.html");
      const html = await readFile(indexPath, "utf-8");
      return c.html(html);
    } catch {
      return c.text("Frontend not found", 404);
    }
  });
} else {
  // Development: show API info at root
  app.get("/", (c) => {
    return c.json({
      status: "ok",
      service: "finanzas-api",
      stack: "Hono + ZenStack v3",
      mode: "development",
      frontend: "Run `pnpm --filter @finanzas/web dev` separately",
    });
  });
}

const port = Number(process.env.PORT) || 3000;
console.log(`🚀 Finanzas API starting on port ${port}`);

serve({ fetch: app.fetch, port });
