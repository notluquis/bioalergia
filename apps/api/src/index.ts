// apps/api - Hono + ZenStack Query-as-a-Service
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
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

const app = new Hono();

// CORS for frontend
app.use(
  "/*",
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));
app.get("/", (c) => {
  return c.json({
    status: "ok",
    service: "finanzas-api",
    stack: "Hono + ZenStack v3",
  });
});

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

// ZenStack Query-as-a-Service (auto CRUD for all models)
app.use(
  "/api/*",
  createHonoHandler({
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
  })
);

const port = Number(process.env.PORT) || 3000;
console.log(`🚀 Finanzas API running on http://localhost:${port}`);
console.log(
  `📡 Query-as-a-Service: http://localhost:${port}/api/[model]/[operation]`
);
console.log(`🔐 Auth routes: http://localhost:${port}/api/auth/*`);

serve({ fetch: app.fetch, port });
