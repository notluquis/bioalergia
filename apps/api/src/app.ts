// apps/api/src/app.ts
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { authDb, schema } from "@finanzas/db";
import { serveStatic } from "@hono/node-server/serve-static";
import { RPCApiHandler } from "@zenstackhq/server/api";
import { createHonoHandler } from "@zenstackhq/server/hono";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { rateLimiter } from "hono-rate-limiter";
import { createAuthContext, getSessionUser } from "./auth";
import { authRoutes } from "./routes/auth";
import backupRoutes from "./routes/backups";
import balanceRoutes from "./routes/balances";
import { calendarRoutes } from "./routes/calendar";
import counterpartRoutes from "./routes/counterparts";
import { csvUploadRoutes } from "./routes/csv-upload";
import dailyProductionRoutes from "./routes/daily-production-balances";
import { doctoraliaRoutes } from "./routes/doctoralia";
import employeeRoutes from "./routes/employees";
import expenseRoutes from "./routes/expenses";
import { integrationRoutes } from "./routes/integrations";
import { inventoryRoutes } from "./routes/inventory";
import loanScheduleRoutes from "./routes/loan-schedules";
import loanRoutes from "./routes/loans";
import { mercadopagoRoutes } from "./routes/mercadopago";
import notificationRoutes from "./routes/notifications";
import peopleRoutes from "./routes/people";
import { personalFinanceRoutes } from "./routes/personal-finance";
import releaseTransactionRoutes from "./routes/release-transactions";
import roleRoutes from "./routes/roles";
import serviceScheduleRoutes from "./routes/service-schedules";
import serviceRoutes from "./routes/services";
import { settingsRoutes } from "./routes/settings";
import settlementTransactionRoutes from "./routes/settlement-transactions";
import { shareTargetRoutes } from "./routes/share-target";
import { suppliesRoutes } from "./routes/supplies";
import timesheetRoutes from "./routes/timesheets";
import transactionRoutes from "./routes/transactions";
import { userRoutes } from "./routes/users";
import certificatesRoutes from "./modules/certificates/index.js";
import patientsRoutes from "./modules/patients/index.js";

const app = new Hono();

// Security headers and CSP for Cloudflare + Vite
app.use("*", async (c, next) => {
  await next();

  // UTF-8 encoding for JSON responses
  const contentType = c.res.headers.get("Content-Type");
  if (contentType?.includes("application/json") && !contentType.includes("charset")) {
    c.res.headers.set("Content-Type", "application/json; charset=utf-8");
  }

  // Content Security Policy - Allow Cloudflare + Vite assets
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.cloudflare.com https://static.cloudflareinsights.com https://challenges.cloudflare.com",
    "script-src-elem 'self' 'unsafe-inline' https://cdn.cloudflare.com https://static.cloudflareinsights.com https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.cloudflare.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "frame-ancestors 'none'",
  ].join("; ");

  c.res.headers.set("Content-Security-Policy", csp);
});

// CORS for frontend (same-origin in prod, localhost in dev)
app.use(
  "/api/*",
  cors({
    origin: (origin) => {
      // Allow requests from same origin (Railway static hosting) or explicit env var
      if (!origin || origin === process.env.CORS_ORIGIN) {
        return origin ?? "*";
      }
      if (!process.env.CORS_ORIGIN && origin.includes("localhost")) {
        // Dev fallback
        return origin;
      }
      // Not allowed
      return null;
    },
    credentials: true,
  }),
);

// Health check (at root for Railway healthcheck)
app.get("/health", (c) => c.json({ status: "ok" }));
app.get("/api/health", (c) => c.json({ status: "ok" }));

// Rate limiting for auth routes (prevent brute force attacks)
const authRateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 50, // 50 requests per 15 minutes per IP
  standardHeaders: "draft-6",
  keyGenerator: (c) => c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "anonymous",
});

// Apply rate limiting to sensitive routes
app.use("/api/auth/*", authRateLimiter);

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
app.route("/api/release-transactions", releaseTransactionRoutes);
app.route("/api/settlement-transactions", settlementTransactionRoutes);
app.route("/api/balances", balanceRoutes);
app.route("/api/daily-production-balances", dailyProductionRoutes);
app.route("/api/counterparts", counterpartRoutes);
app.route("/api/services", serviceRoutes);
app.route("/api/roles", roleRoutes);
app.route("/api/settings", settingsRoutes);
app.route("/api/employees", employeeRoutes);
app.route("/api/loan-schedules", loanScheduleRoutes);
app.route("/api/services/schedules", serviceScheduleRoutes);
app.route("/api/timesheets", timesheetRoutes);
app.route("/api/people", peopleRoutes);
app.route("/api/expenses", expenseRoutes);
app.route("/api/integrations", integrationRoutes);
app.route("/api/personal-finance", personalFinanceRoutes);

// Doctoralia integration routes
app.route("/api/doctoralia", doctoraliaRoutes);

// Medical certificates (PDF generation with digital signature)
app.route("/api/certificates", certificatesRoutes);

// Patients management
app.route("/api/patients", patientsRoutes);

// ZenStack Query-as-a-Service (auto CRUD for all models)
// Frontend uses /api/model/* (via QuerySettingsProvider in main.tsx)
const zenStackHandler = createHonoHandler({
  apiHandler: new RPCApiHandler({ schema }),
  getClient: async (ctx) => {
    // Extract user from JWT
    const user = await getSessionUser(ctx);
    const authContext = createAuthContext(user);

    if (authContext) {
      // Authenticated: apply access control policies AND audit logging
      const policyClient = authDb.$setAuth(authContext);
      // Inject Audit Plugin - This ensures every write operation via the content-aware client is logged
      return policyClient;
    }

    // Anonymous: policies will deny access via @@deny('all', auth() == null)
    return authDb;
  },
});

// Mount ZenStack at /api/model/* for frontend hooks (useFindMany, etc.)
app.use("/api/model/*", zenStackHandler);

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
    }),
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

export default app;
