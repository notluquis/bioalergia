// apps/api/src/app.ts
import { authDb, schema } from "@finanzas/db";
import { RPCApiHandler } from "@zenstackhq/server/api";
import { createHonoHandler } from "@zenstackhq/server/hono";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { rateLimiter } from "hono-rate-limiter";
import { createAuthContext, getSessionUser } from "./auth";
import { htmlSanitizerMiddleware } from "./lib/html-sanitizer";
import { certificatesRoutes } from "./modules/certificates/index.js";
import { patientsRoutes } from "./modules/patients/index.js";
import { authRoutes } from "./routes/auth";
import { backupRoutes } from "./routes/backups";
import { balanceRoutes } from "./routes/balances";
import { calendarRoutes } from "./routes/calendar";
import { counterpartRoutes } from "./routes/counterparts";
import { csvUploadRoutes } from "./routes/csv-upload";
import { dailyProductionRoutes } from "./routes/daily-production-balances";
import { doctoraliaRoutes } from "./routes/doctoralia";
import { dteRoutes } from "./routes/dte";
import { dteAnalyticsRoutes } from "./routes/dte-analytics";
import { employeeRoutes } from "./routes/employees";
import { expenseRoutes } from "./routes/expenses";
import { haulmerRoutes } from "./routes/haulmer";
import { integrationRoutes } from "./routes/integrations";
import { inventoryRoutes } from "./routes/inventory";
import { loanScheduleRoutes } from "./routes/loan-schedules";
import { loanRoutes } from "./routes/loans";
import { mercadopagoRoutes } from "./routes/mercadopago";
import { notificationRoutes } from "./routes/notifications";
import { peopleRoutes } from "./routes/people";
import { personalFinanceRoutes } from "./routes/personal-finance";
import { releaseTransactionRoutes } from "./routes/release-transactions";
import { roleRoutes } from "./routes/roles";
import { serviceScheduleRoutes } from "./routes/service-schedules";
import { serviceRoutes } from "./routes/services";
import { settingsRoutes } from "./routes/settings";
import { settlementTransactionRoutes } from "./routes/settlement-transactions";
import { shareTargetRoutes } from "./routes/share-target";
import { suppliesRoutes } from "./routes/supplies";
import { timesheetRoutes } from "./routes/timesheets";
import { transactionRoutes } from "./routes/transactions";
import { userRoutes } from "./routes/users";

export const app = new Hono();
const enableHttpRequestLogs = process.env.API_HTTP_REQUEST_LOGS === "true";

if (enableHttpRequestLogs) {
  // Verbose request logging middleware (opt-in via API_HTTP_REQUEST_LOGS=true)
  app.use("*", async (c, next) => {
    const start = Date.now();
    const method = c.req.method;
    const path = c.req.path;
    console.log(`[${new Date().toISOString()}] --> ${method} ${path}`);
    await next();
    const duration = Date.now() - start;
    console.log(
      `[${new Date().toISOString()}] <-- ${method} ${path} ${c.res.status} (${duration}ms)`,
    );
  });
}

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

// Memory leak prevention for long-running Node.js processes
// Clears jsdom window state after each request to prevent unbounded memory growth
// Only necessary when using isomorphic-dompurify for HTML sanitization
app.use("*", htmlSanitizerMiddleware());

// CORS for frontend (same-origin in prod, localhost in dev)
app.use(
  "/api/*",
  cors({
    origin: (origin) => {
      // No origin = same-origin request (always allowed)
      if (!origin) {
        return "*";
      }

      // Explicit CORS_ORIGIN env var (production)
      if (process.env.CORS_ORIGIN && origin === process.env.CORS_ORIGIN) {
        return origin;
      }

      // Development: allow localhost
      if (process.env.NODE_ENV !== "production" && origin.includes("localhost")) {
        return origin;
      }

      // Production without CORS_ORIGIN: accept any (Railway same-domain deployment)
      if (process.env.NODE_ENV === "production" && !process.env.CORS_ORIGIN) {
        return origin;
      }

      // Reject
      return null;
    },
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowHeaders: ["Content-Type", "Authorization", "Cookie"],
    exposeHeaders: ["Content-Type", "Set-Cookie"],
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
  // Skip OPTIONS requests to not interfere with CORS preflight
  skip: (c) => c.req.method === "OPTIONS",
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

// DTE analytics routes (visualizations, summaries, comparisons)
app.route("/api/dte-analytics", dteAnalyticsRoutes);

// DTE sync routes (sync history, manual trigger, cron)
app.route("/api/dte", dteRoutes);

// Haulmer DTE sync routes (CSV downloads, imports)
app.route("/api/haulmer", haulmerRoutes);
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
// ROOT ENDPOINT
// ============================================================================
// Note: This API server does NOT serve the frontend in production.
// The frontend is served separately from intranet.bioalergia.cl (Caddy)
// which proxies /api/* requests to this server.
app.get("/", (c) => {
  const info: {
    status: string;
    service: string;
    stack: string;
    mode: string;
    endpoints: Record<string, string>;
    note?: string;
  } = {
    status: "ok",
    service: "finanzas-api",
    stack: "Hono + ZenStack v3",
    mode: process.env.NODE_ENV || "development",
    endpoints: {
      health: "/health",
      auth: "/api/auth/*",
      model: "/api/model/*",
      users: "/api/users/*",
      mercadopago: "/api/mercadopago/*",
      backup: "/api/backup/*",
    },
  };

  if (process.env.NODE_ENV !== "production") {
    info.note = "Run `pnpm --filter @finanzas/intranet dev` for frontend";
  }

  return c.json(info);
});
