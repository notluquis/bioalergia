// apps/api/src/app.ts
import { authDb, schema } from "@finanzas/db";
import { RPCApiHandler } from "@zenstackhq/server/api";
import { createHonoHandler } from "@zenstackhq/server/hono";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { rateLimiter } from "hono-rate-limiter";
import { createAuthContext, getSessionUser } from "./auth";
import { AppError } from "./lib/app-error";
import { htmlSanitizerMiddleware } from "./lib/html-sanitizer";
import { logError } from "./lib/logger";
import { configureSuperjson } from "./lib/superjson-config";
import { certificatesRoutes } from "./modules/certificates/index.js";
import { patientsRoutes } from "./modules/patients/index.js";
import { calendarOpenAPIHandler, calendarORPCHandler } from "./orpc/calendar";
import { dteEventLinksOpenAPIHandler, dteEventLinksORPCHandler } from "./orpc/dte-event-links";
import { createHonoORPCRequest } from "./orpc/superjson";
import { authRoutes } from "./routes/auth";
import { backupRoutes } from "./routes/backups";
import { balanceRoutes } from "./routes/balances";
import { counterpartRoutes } from "./routes/counterparts";
import { csvUploadRoutes } from "./routes/csv-upload";
import { dailyProductionRoutes } from "./routes/daily-production-balances";
import { doctoraliaRoutes } from "./routes/doctoralia";
import { dteRoutes } from "./routes/dte";
import { dteAnalyticsRoutes } from "./routes/dte-analytics";
import { employeeRoutes } from "./routes/employees";
import { expenseRoutes } from "./routes/expenses";
import { financeRoutes } from "./routes/finance";
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
import { errorReply } from "./utils/error-reply";
import { normalizeErrorResponse } from "./utils/normalize-error-response";
import { reply, replyRaw } from "./utils/reply";

configureSuperjson();

export const app = new Hono();

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

// Normalize legacy/manual JSON error responses to a single contract
app.use("*", async (c, next) => {
  await next();
  await normalizeErrorResponse(c);
});

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
app.get("/health", (c) => replyRaw(c, { status: "ok" }));
app.get("/api/health", (c) => replyRaw(c, { status: "ok" }));

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

// Calendar routes moved to oRPC: /api/orpc/calendar/rpc/*
app.get("/api/orpc", (c) =>
  c.html(`<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Bioalergia oRPC</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f5f7f4;
        --panel: #ffffff;
        --text: #16302b;
        --muted: #5f7a72;
        --accent: #0f766e;
        --accent-soft: #ccfbf1;
        --border: #d8e4de;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
        background:
          radial-gradient(circle at top left, #ccfbf1 0, transparent 28rem),
          linear-gradient(180deg, #f9fbfa 0%, var(--bg) 100%);
        color: var(--text);
      }
      main {
        max-width: 60rem;
        margin: 0 auto;
        padding: 3rem 1.5rem 4rem;
      }
      h1 {
        margin: 0 0 0.75rem;
        font-size: clamp(2rem, 4vw, 3.25rem);
        line-height: 1;
      }
      p {
        color: var(--muted);
        max-width: 42rem;
      }
      .grid {
        display: grid;
        gap: 1rem;
        margin-top: 2rem;
      }
      .card {
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 1.25rem;
        padding: 1.25rem;
        box-shadow: 0 18px 50px rgba(15, 23, 42, 0.06);
      }
      .eyebrow {
        display: inline-block;
        margin-bottom: 0.75rem;
        padding: 0.3rem 0.6rem;
        border-radius: 999px;
        background: var(--accent-soft);
        color: var(--accent);
        font-size: 0.8rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      h2 {
        margin: 0 0 0.5rem;
        font-size: 1.2rem;
      }
      ul {
        margin: 1rem 0 0;
        padding: 0;
        list-style: none;
      }
      li + li {
        margin-top: 0.6rem;
      }
      a {
        color: var(--accent);
        text-decoration: none;
        font-weight: 600;
      }
      a:hover {
        text-decoration: underline;
      }
      code {
        font-family: "IBM Plex Mono", "SFMono-Regular", monospace;
        font-size: 0.9em;
      }
    </style>
  </head>
  <body>
    <main>
      <span class="eyebrow">oRPC + OpenAPI</span>
      <h1>Bioalergia API Contracts</h1>
      <p>
        Referencia viva de los módulos publicados con oRPC. Cada módulo expone RPC,
        REST OpenAPI y documentación navegable.
      </p>
      <div class="grid">
        <section class="card">
          <h2>Calendar</h2>
          <p>Clasificación, sync, analytics y jobs de calendario.</p>
          <ul>
            <li><a href="/api/orpc/calendar/docs">Reference UI</a></li>
            <li><a href="/api/orpc/calendar/openapi.json">OpenAPI JSON</a></li>
            <li><code>/api/orpc/calendar/rpc/*</code></li>
          </ul>
        </section>
        <section class="card">
          <h2>DTE Event Links</h2>
          <p>Vínculos, sugerencias y auto-link entre eventos y DTE.</p>
          <ul>
            <li><a href="/api/orpc/dte-analytics/event-links/docs">Reference UI</a></li>
            <li><a href="/api/orpc/dte-analytics/event-links/openapi.json">OpenAPI JSON</a></li>
            <li><code>/api/orpc/dte-analytics/event-links/rpc/*</code></li>
          </ul>
        </section>
      </div>
    </main>
  </body>
</html>`),
);

app.use("/api/orpc/calendar/rpc/*", async (c, next) => {
  const { matched, response } = await calendarORPCHandler.handle(createHonoORPCRequest(c), {
    prefix: "/api/orpc/calendar/rpc",
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  await next();
});

app.use("/api/orpc/dte-analytics/event-links/rpc/*", async (c, next) => {
  const { matched, response } = await dteEventLinksORPCHandler.handle(createHonoORPCRequest(c), {
    prefix: "/api/orpc/dte-analytics/event-links/rpc",
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  await next();
});

app.use("/api/orpc/dte-analytics/event-links/*", async (c, next) => {
  const { matched, response } = await dteEventLinksOpenAPIHandler.handle(createHonoORPCRequest(c), {
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  await next();
});

app.use("/api/orpc/calendar/*", async (c, next) => {
  const { matched, response } = await calendarOpenAPIHandler.handle(createHonoORPCRequest(c), {
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  await next();
});

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

// Finance (Cash Flow)
app.route("/api/finance", financeRoutes);

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

  return replyRaw(c, info);
});

app.notFound((c) => {
  return errorReply(c, 404, "Ruta no encontrada", {
    code: "NOT_FOUND",
    details: { method: c.req.method, path: c.req.path },
  });
});

app.onError((error, c) => {
  if (error instanceof AppError) {
    if (error.status >= 500) {
      logError("api.unhandled.app_error", error, {
        method: c.req.method,
        path: c.req.path,
        code: error.code,
      });
    }

    return errorReply(
      c,
      error.status as ContentfulStatusCode,
      error.expose ? error.message : "Internal Server Error",
      {
        code: error.code,
        ...(error.expose ? { details: error.details } : {}),
      },
    );
  }

  if (error instanceof HTTPException) {
    const httpErrorMessages: Record<number, string> = {
      400: "Bad Request",
      401: "Unauthorized",
      403: "Forbidden",
      404: "Not Found",
      405: "Method Not Allowed",
      409: "Conflict",
      422: "Unprocessable Entity",
      429: "Too Many Requests",
      500: "Internal Server Error",
    };

    return errorReply(
      c,
      error.status as ContentfulStatusCode,
      httpErrorMessages[error.status] ?? "Request Error",
      {
        code: "HTTP_EXCEPTION",
      },
    );
  }

  logError("api.unhandled.error", error, {
    method: c.req.method,
    path: c.req.path,
  });
  return reply(
    c,
    { status: "error", code: "INTERNAL_ERROR", message: "Internal Server Error" },
    500,
  );
});
