// apps/api/src/app.ts
import * as Sentry from "@sentry/node";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import { timeout } from "hono/timeout";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { rateLimiter } from "hono-rate-limiter";
import { getSessionUser, hasPermission } from "./auth.ts";
import { AppError } from "./lib/app-error.ts";
import { clientIp } from "./lib/client-ip.ts";
import { csrfDoubleSubmit, ensureCsrfCookie } from "./lib/csrf-double-submit.ts";
import { htmlSanitizerMiddleware } from "./lib/html-sanitizer.ts";
import { logError } from "./lib/logger.ts";
import { isRpcTunnelRead } from "./lib/orpc-procedure-methods.ts";
import { configureSuperjson } from "./lib/superjson-config.ts";
import { authOpenAPIHandler, authORPCHandler } from "./orpc/auth.ts";
import { backupsOpenAPIHandler, backupsORPCHandler } from "./orpc/backups.ts";
import { getCurrentJobs as getCurrentBackupJobs } from "./services/backups.ts";
import { balancesOpenAPIHandler, balancesORPCHandler } from "./orpc/balances.ts";
import { calendarOpenAPIHandler, calendarORPCHandler } from "./orpc/calendar.ts";
import { certificatesOpenAPIHandler, certificatesORPCHandler } from "./orpc/certificates.ts";
import { clinicalSeriesOpenAPIHandler, clinicalSeriesORPCHandler } from "./orpc/clinical-series.ts";
import {
  clinicalRecordsOpenAPIHandler,
  clinicalRecordsORPCHandler,
} from "./orpc/clinical-records.ts";
import {
  clinicalSkinTestsOpenAPIHandler,
  clinicalSkinTestsORPCHandler,
} from "./orpc/clinical-skin-tests.ts";
import { getCurrentRebuildJob } from "./services/clinical-series.ts";
import { counterpartsOpenAPIHandler, counterpartsORPCHandler } from "./orpc/counterparts.ts";
import { csvUploadOpenAPIHandler, csvUploadORPCHandler } from "./orpc/csv-upload.ts";
import { doctoraliaOpenAPIHandler, doctoraliaORPCHandler } from "./orpc/doctoralia.ts";
import { dteOpenAPIHandler, dteORPCHandler } from "./orpc/dte.ts";
import { dteAnalyticsOpenAPIHandler, dteAnalyticsORPCHandler } from "./orpc/dte-analytics.ts";
import { dteEventLinksOpenAPIHandler, dteEventLinksORPCHandler } from "./orpc/dte-event-links.ts";
import { employeesOpenAPIHandler, employeesORPCHandler } from "./orpc/employees.ts";
import { expensesOpenAPIHandler, expensesORPCHandler } from "./orpc/expenses.ts";
import { financeOpenAPIHandler, financeORPCHandler } from "./orpc/finance.ts";
import { haulmerOpenAPIHandler, haulmerORPCHandler } from "./orpc/haulmer.ts";
import { integrationsOpenAPIHandler, integrationsORPCHandler } from "./orpc/integrations.ts";
import { inventoryOpenAPIHandler, inventoryORPCHandler } from "./orpc/inventory.ts";
import { loansOpenAPIHandler, loansORPCHandler } from "./orpc/loans.ts";
import { mercadopagoOpenAPIHandler, mercadopagoORPCHandler } from "./orpc/mercadopago.ts";
import { notificationsOpenAPIHandler, notificationsORPCHandler } from "./orpc/notifications.ts";
import { outreachOpenAPIHandler, outreachORPCHandler } from "./orpc/outreach.ts";
import { addressesOpenAPIHandler, addressesORPCHandler } from "./orpc/addresses.ts";
import { patientsOpenAPIHandler, patientsORPCHandler } from "./orpc/patients.ts";
import {
  patientCampaignsOpenAPIHandler,
  patientCampaignsORPCHandler,
} from "./orpc/patient-campaigns.ts";
import { peopleOpenAPIHandler, peopleORPCHandler } from "./orpc/people.ts";
import {
  personalFinanceOpenAPIHandler,
  personalFinanceORPCHandler,
} from "./orpc/personal-finance.ts";
import {
  productionBalancesOpenAPIHandler,
  productionBalancesORPCHandler,
} from "./orpc/production-balances.ts";
import {
  releaseTransactionsOpenAPIHandler,
  releaseTransactionsORPCHandler,
} from "./orpc/release-transactions.ts";
import { rolesOpenAPIHandler, rolesORPCHandler } from "./orpc/roles.ts";
import { servicesOpenAPIHandler, servicesORPCHandler } from "./orpc/services.ts";
import { settingsOpenAPIHandler, settingsORPCHandler } from "./orpc/settings.ts";
import {
  settlementTransactionsOpenAPIHandler,
  settlementTransactionsORPCHandler,
} from "./orpc/settlement-transactions.ts";
import { createHonoORPCRequest } from "./orpc/superjson.ts";
import { suppliesOpenAPIHandler, suppliesORPCHandler } from "./orpc/supplies.ts";
import { systemOpenAPIHandler, systemORPCHandler } from "./orpc/system.ts";
import { attendanceOpenAPIHandler, attendanceORPCHandler } from "./orpc/attendance.ts";
import { timesheetsOpenAPIHandler, timesheetsORPCHandler } from "./orpc/timesheets.ts";
import {
  transactionsInsightsOpenAPIHandler,
  transactionsInsightsORPCHandler,
} from "./orpc/transactions-insights.ts";
import { usersOpenAPIHandler, usersORPCHandler } from "./orpc/users.ts";
import { utilityBillsOpenAPIHandler, utilityBillsORPCHandler } from "./orpc/utility-bills.ts";
import { providerCredentialsORPCHandler } from "./orpc/provider-credentials.ts";
import { waCloudOpenAPIHandler, waCloudORPCHandler } from "./orpc/wa-cloud.ts";
import { shipmentsOpenAPIHandler, shipmentsORPCHandler } from "./orpc/shipments.ts";
import { doctoraliaScraperRoutes } from "./routes/doctoralia-scraper.ts";
import { googleCalendarWebhookRoutes } from "./routes/google-calendar-webhook.ts";
import { mercadopagoReportWebhookRoutes } from "./routes/mercadopago-report-webhook.ts";
import { onedriveWebhookRoutes } from "./routes/onedrive-webhook.ts";
import { waCloudMediaRoutes } from "./routes/wa-cloud-media.ts";
import { waCloudSseRoutes } from "./routes/wa-cloud-sse.ts";
import { waCloudWebhookRoutes } from "./routes/wa-cloud-webhook.ts";
import { errorReply } from "./utils/error-reply.ts";
import { normalizeErrorResponse } from "./utils/normalize-error-response.ts";
import { reply, replyRaw } from "./utils/reply.ts";

configureSuperjson();

export const app = new Hono();

// Standard security headers (CSP set separately below for Vite/Cloudflare)
app.use(
  "*",
  secureHeaders({
    contentSecurityPolicy: undefined, // we set CSP manually below
    strictTransportSecurity:
      process.env.NODE_ENV === "production" ? "max-age=31536000; includeSubDomains" : false,
    xFrameOptions: "DENY",
    xContentTypeOptions: "nosniff",
    referrerPolicy: "strict-origin-when-cross-origin",
    permissionsPolicy: { camera: [], geolocation: [], microphone: ["self"] },
    crossOriginOpenerPolicy: "same-origin",
    crossOriginResourcePolicy: "same-site",
    xPermittedCrossDomainPolicies: "none",
    originAgentCluster: "?1",
    xDownloadOptions: "noopen",
    xDnsPrefetchControl: "off",
  })
);

// Security headers and CSP for Cloudflare + Vite
app.use("*", async (c, next) => {
  await next();

  // UTF-8 encoding for JSON responses
  const contentType = c.res.headers.get("Content-Type");
  if (contentType?.includes("application/json") && !contentType.includes("charset")) {
    c.res.headers.set("Content-Type", "application/json; charset=utf-8");
  }

  // Content Security Policy - Allow Cloudflare + Vite assets. unsafe-eval
  // only kept in dev for Vite HMR; production build does not need it.
  const isProd = process.env.NODE_ENV === "production";
  const scriptSrc = isProd
    ? "script-src 'self' 'unsafe-inline' https://cdn.cloudflare.com https://static.cloudflareinsights.com https://challenges.cloudflare.com"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.cloudflare.com https://static.cloudflareinsights.com https://challenges.cloudflare.com";
  const csp = [
    "default-src 'self'",
    scriptSrc,
    "script-src-elem 'self' 'unsafe-inline' https://cdn.cloudflare.com https://static.cloudflareinsights.com https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "media-src 'self' blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.cloudflare.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
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

// CORS for frontend (same-origin in prod, localhost in dev). With
// credentials:true the browser refuses '*'; we always echo back the exact
// origin or null. Production REQUIRES CORS_ORIGIN — wildcards there would
// allow CSRF since cookies travel with credentialed requests.
const allowedProdOrigins = (process.env.CORS_ORIGIN ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
if (process.env.NODE_ENV === "production" && allowedProdOrigins.length === 0) {
  // Loud warning so the operator notices missing CORS config in prod logs.
  // Cross-origin browser requests will be rejected until CORS_ORIGIN is set
  // (comma-separated list of full origins, e.g. "https://intranet.bioalergia.cl").
  // eslint-disable-next-line no-console
  console.warn(
    "[security] CORS_ORIGIN is empty in production — all cross-origin browser requests will be rejected. Set CORS_ORIGIN env to your intranet origin."
  );
}
app.use(
  "/api/*",
  cors({
    origin: (origin) => {
      // No origin header = same-origin / curl / server-to-server. Hono
      // returns no ACAO header when callback returns null/empty for null
      // origin, which is what we want (no CORS check applies).
      if (!origin) return "";

      // Explicit allow-list (comma-separated) for production
      if (allowedProdOrigins.includes(origin)) return origin;

      // Development: localhost only
      if (process.env.NODE_ENV !== "production" && /^https?:\/\/localhost(:\d+)?$/.test(origin)) {
        return origin;
      }

      // Reject all other cross-origin requests
      return null;
    },
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowHeaders: ["Content-Type", "Authorization", "Cookie"],
    exposeHeaders: ["Content-Type", "Set-Cookie"],
  })
);

// Health check (at root for Railway healthcheck)
app.get("/health", (c) => replyRaw(c, { status: "ok" }));
app.get("/api/health", (c) => replyRaw(c, { status: "ok" }));

// CSRF bootstrap: mints (or refreshes) the csrf_token cookie so the SPA
// always has it before its first state-changing POST. The double-submit
// middleware on /api/orpc/* and /api/wa-cloud/* would otherwise reject
// the very first POST after a cold load (no cookie yet → server has to
// issue it in a 403 response, then SPA retries). Bootstrapping with a
// safe GET avoids that round-trip and keeps the failure mode of a
// genuine 403 (auth denied) unambiguous.
app.get("/api/csrf", (c) => {
  ensureCsrfCookie(c);
  return c.body(null, 204);
});

// Per-IP rate limit on credential-bearing endpoints. Uses
// Cloudflare's tamper-proof cf-connecting-ip when present, falls back
// to the rightmost (closest hop) X-Forwarded-For entry — never the
// leftmost, which an attacker can forge.
//
// Threshold: 20 requests / 15 min / IP. Tight enough to throttle
// credential-stuffing from a single source while leaving headroom for
// shared-NAT clinic networks where multiple staff log in at once.
// Per-username throttle (lib/login-throttle.ts) and the per-user
// account lockout (lib/account-lockout.ts) provide the inner layers.
//
// Refs:
//   - NIST SP 800-63-4 § 5.2.2 (rate limiting on auth endpoints)
//   - OWASP Authentication Cheat Sheet § Brute Force / Credential Stuffing
const authRateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-6",
  keyGenerator: (c) => clientIp(c) ?? "anonymous",
  skip: (c) => c.req.method === "OPTIONS",
});

// Mount on the actual oRPC auth path. The legacy /api/auth/* route
// space is unused but kept covered as defense in depth.
app.use("/api/orpc/auth/rpc/*", authRateLimiter);
app.use("/api/auth/*", authRateLimiter);

// CSRF: validate Origin / Sec-Fetch-Site for all state-changing API calls.
// Defense in depth on top of SameSite=Lax cookies + the CORS allow-list.
// Webhooks excluded (Meta / Google / OneDrive cross-site by design and
// already authenticated via HMAC signatures).
const csrfAllowedOrigin = (origin: string, c: import("hono").Context): boolean => {
  // Always allow same-origin: when the Origin header host matches the
  // request's own host (the SPA hitting its own API), there is no CSRF
  // surface. hono/csrf normally provides this default but disables it
  // when an `origin` callback is supplied — re-implement here so we
  // never lock ourselves out of the API even if CORS_ORIGIN env is empty.
  try {
    const reqHost = new URL(c.req.url).host;
    const originHost = new URL(origin).host;
    if (reqHost === originHost) return true;
  } catch {
    // Malformed origin — fall through to allow-list checks.
  }
  if (allowedProdOrigins.includes(origin)) return true;
  if (process.env.NODE_ENV !== "production") {
    return /^https?:\/\/localhost(:\d+)?$/.test(origin);
  }
  return false;
};
app.use("/api/orpc/*", csrf({ origin: csrfAllowedOrigin }));
app.use("/api/wa-cloud/*", csrf({ origin: csrfAllowedOrigin }));

// Double-submit token CSRF on top of the Origin/Sec-Fetch-Site check.
// SSE GET routes need cookie issuance but skip the header compare (safe
// method).
app.use("/api/orpc/*", csrfDoubleSubmit());
app.use("/api/wa-cloud/*", csrfDoubleSubmit());

// E2E read-only guard. Layer 2 of the defense-in-depth strategy
// described in CLAUDE.local.md — the Playwright fixture installs a
// network-level guard (layer 1) but this server-side check protects
// production when a misconfigured run somehow bypasses it. Users
// holding the E2EReadOnly role may issue reads but never mutations.
//
// oRPC's RPC tunnel POSTs *every* operation (reads + writes) to
// `/api/orpc/<ns>/rpc/<procedure>`, so the wire method is useless for
// telling them apart — a blanket POST block also rejects POST-tunnelled
// reads, which makes an E2EReadOnly session unable to load ANY
// data-backed page (every read 403s → the page renders an error card,
// and scan-only authed e2e specs then pass vacuously against it).
// Instead we classify by the *contract's* declared method via
// `isRpcTunnelRead`: declared-GET procedures are reads (allowed for
// everyone), declared-POST/PUT/PATCH/DELETE are mutations (blocked for
// the read-only role). Unknown procedures fail closed.
//
// `/api/orpc/auth/*` stays fully exempt regardless of method — it is
// session lifecycle (login, logout, session, mfa, passkey), not a data
// mutation, and the SPA calls `auth/session` on every boot.
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function readOnlyRejection(c: import("hono").Context) {
  return c.json(
    {
      status: "error",
      code: "READ_ONLY_ROLE",
      message: "E2E read-only sessions cannot perform mutations.",
    },
    403
  );
}

async function isE2EReadOnly(c: import("hono").Context): Promise<boolean> {
  const user = await getSessionUser(c);
  return Boolean(user?.roles.some((r) => r.role.name === "E2EReadOnly"));
}

app.use("/api/orpc/*", async (c, next) => {
  if (SAFE_METHODS.has(c.req.method)) return next();
  const pathname = new URL(c.req.url).pathname;
  // Session lifecycle is not a data mutation — exempt so the SPA can
  // resolve the current user on boot under an E2EReadOnly session.
  if (pathname.startsWith("/api/orpc/auth/")) return next();
  // POST-tunnelled reads (contract-declared GET) are allowed for
  // everyone — checked before the role lookup so reads skip the DB hit.
  if (isRpcTunnelRead(pathname)) return next();
  if (await isE2EReadOnly(c)) return readOnlyRejection(c);
  return next();
});
app.use("/api/wa-cloud/*", async (c, next) => {
  if (SAFE_METHODS.has(c.req.method)) return next();
  if (await isE2EReadOnly(c)) return readOnlyRejection(c);
  return next();
});

// Webhook ingress rate limit — Meta retries up to ~3x per minute per event
// per WABA, so ~120/min is a generous ceiling. Caps abusive floods that
// could DoS the DB by inserting WaWebhookLog rows for invalid signatures.
const webhookRateLimiter = rateLimiter({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: "draft-6",
  keyGenerator: (c) => c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "anonymous",
  skip: (c) => c.req.method === "OPTIONS",
});
app.use("/api/webhooks/*", webhookRateLimiter);

// Body size cap on webhook ingress: Meta payloads top out near 100KB,
// OneDrive validation tokens are small. 1 MB is a safe ceiling that
// blocks DoS amplification (an attacker firing 100 MB JSON to keep our
// JSON.parse busy) without rejecting any legitimate payload.
app.use(
  "/api/webhooks/*",
  bodyLimit({
    maxSize: 1 * 1024 * 1024,
    onError: (c) => c.text("Payload too large", 413),
  })
);

// Hard request timeout: anything that takes longer than 30s is almost
// certainly a runaway query / external API hang. Webhooks excluded —
// they fire-and-forget downstream work after the 200.
app.use("/api/orpc/*", timeout(30_000));
// wa-cloud/media handles multi-MB resumable uploads to Meta Graph
// (profile pictures, template sample media). Meta's resumable upload
// + their server-side processing routinely exceeds 30s for larger
// JPEGs, so the wa-cloud timeout is split: 30s default for the rest
// of the namespace, 120s carved out for the upload routes. Hono
// applies the most-recently-mounted timeout per request, so the
// generic mount must come first.
app.use("/api/wa-cloud/*", timeout(30_000));
app.use("/api/wa-cloud/media/*", timeout(120_000));

// All endpoints except the compatibility surfaces below
// are now exclusively served via oRPC at /api/orpc/{endpoint}/rpc/*
// See /api/orpc landing page for available modules and documentation

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
          <h2>Auth</h2>
          <p>Autenticación, sesión, MFA y passkeys.</p>
          <ul>
            <li><a href="/api/orpc/auth/docs">Reference UI</a></li>
            <li><a href="/api/orpc/auth/openapi.json">OpenAPI JSON</a></li>
            <li><code>/api/orpc/auth/rpc/*</code></li>
          </ul>
        </section>
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
          <h2>Certificates</h2>
          <p>Verificación pública de certificados médicos.</p>
          <ul>
            <li><a href="/api/orpc/certificates/docs">Reference UI</a></li>
            <li><a href="/api/orpc/certificates/openapi.json">OpenAPI JSON</a></li>
            <li><code>/api/orpc/certificates/rpc/*</code></li>
          </ul>
        </section>
        <section class="card">
          <h2>Clinical Series</h2>
          <p>Series clínicas agrupadas para tests y tratamientos.</p>
          <ul>
            <li><a href="/api/orpc/clinical-series/docs">Reference UI</a></li>
            <li><a href="/api/orpc/clinical-series/openapi.json">OpenAPI JSON</a></li>
            <li><code>/api/orpc/clinical-series/rpc/*</code></li>
          </ul>
        </section>
        <section class="card">
          <h2>System</h2>
          <p>Estado básico del sistema para frontend y observabilidad.</p>
          <ul>
            <li><a href="/api/orpc/system/docs">Reference UI</a></li>
            <li><a href="/api/orpc/system/openapi.json">OpenAPI JSON</a></li>
            <li><code>/api/orpc/system/rpc/*</code></li>
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
        <section class="card">
          <h2>DTE Analytics</h2>
          <p>Resúmenes, períodos y detalles de compras/ventas DTE.</p>
          <ul>
            <li><a href="/api/orpc/dte-analytics/docs">Reference UI</a></li>
            <li><a href="/api/orpc/dte-analytics/openapi.json">OpenAPI JSON</a></li>
            <li><code>/api/orpc/dte-analytics/rpc/*</code></li>
          </ul>
        </section>
        <section class="card">
          <h2>DTE Sync</h2>
          <p>Historial y disparo manual de sincronización DTE.</p>
          <ul>
            <li><a href="/api/orpc/dte/docs">Reference UI</a></li>
            <li><a href="/api/orpc/dte/openapi.json">OpenAPI JSON</a></li>
            <li><code>/api/orpc/dte/rpc/*</code></li>
          </ul>
        </section>
        <section class="card">
          <h2>Doctoralia</h2>
          <p>Estado, catálogo, reservas, sync y citas de calendario.</p>
          <ul>
            <li><a href="/api/orpc/doctoralia/docs">Reference UI</a></li>
            <li><a href="/api/orpc/doctoralia/openapi.json">OpenAPI JSON</a></li>
            <li><code>/api/orpc/doctoralia/rpc/*</code></li>
          </ul>
        </section>
        <section class="card">
          <h2>Employees</h2>
          <p>Listado, creación, edición y desactivación de empleados.</p>
          <ul>
            <li><a href="/api/orpc/employees/docs">Reference UI</a></li>
            <li><a href="/api/orpc/employees/openapi.json">OpenAPI JSON</a></li>
            <li><code>/api/orpc/employees/rpc/*</code></li>
          </ul>
        </section>
        <section class="card">
          <h2>Expenses</h2>
          <p>Lista/estadísticas activas y contratos placeholder coherentes para la feature.</p>
          <ul>
            <li><a href="/api/orpc/expenses/docs">Reference UI</a></li>
            <li><a href="/api/orpc/expenses/openapi.json">OpenAPI JSON</a></li>
            <li><code>/api/orpc/expenses/rpc/*</code></li>
          </ul>
        </section>
        <section class="card">
          <h2>CSV Upload</h2>
          <p>Preview e import masivo desde CSV con el mismo motor de validación.</p>
          <ul>
            <li><a href="/api/orpc/csv-upload/docs">Reference UI</a></li>
            <li><a href="/api/orpc/csv-upload/openapi.json">OpenAPI JSON</a></li>
            <li><code>/api/orpc/csv-upload/rpc/*</code></li>
          </ul>
        </section>
        <section class="card">
          <h2>Haulmer</h2>
          <p>Períodos disponibles y sincronización manual/incremental de Haulmer.</p>
          <ul>
            <li><a href="/api/orpc/haulmer/docs">Reference UI</a></li>
            <li><a href="/api/orpc/haulmer/openapi.json">OpenAPI JSON</a></li>
            <li><code>/api/orpc/haulmer/rpc/*</code></li>
          </ul>
        </section>
        <section class="card">
          <h2>Integrations</h2>
          <p>OAuth, estado y desconexión de Google Drive.</p>
          <ul>
            <li><a href="/api/orpc/integrations/docs">Reference UI</a></li>
            <li><a href="/api/orpc/integrations/openapi.json">OpenAPI JSON</a></li>
            <li><code>/api/orpc/integrations/rpc/*</code></li>
          </ul>
        </section>
        <section class="card">
          <h2>Inventory</h2>
          <p>Categorías, items, movimientos y overview de inventario.</p>
          <ul>
            <li><a href="/api/orpc/inventory/docs">Reference UI</a></li>
            <li><a href="/api/orpc/inventory/openapi.json">OpenAPI JSON</a></li>
            <li><code>/api/orpc/inventory/rpc/*</code></li>
          </ul>
        </section>
        <section class="card">
          <h2>Roles</h2>
          <p>Roles, permisos, reasignaciones y mapeos cargo→rol.</p>
          <ul>
            <li><a href="/api/orpc/roles/docs">Reference UI</a></li>
            <li><a href="/api/orpc/roles/openapi.json">OpenAPI JSON</a></li>
            <li><code>/api/orpc/roles/rpc/*</code></li>
          </ul>
        </section>
        <section class="card">
          <h2>Counterparts</h2>
          <p>Contrapartes, cuentas asociadas, sync y payout accounts.</p>
          <ul>
            <li><a href="/api/orpc/counterparts/docs">Reference UI</a></li>
            <li><a href="/api/orpc/counterparts/openapi.json">OpenAPI JSON</a></li>
            <li><code>/api/orpc/counterparts/rpc/*</code></li>
          </ul>
        </section>
        <section class="card">
          <h2>Finance</h2>
          <p>Cash flow, categorías, reglas automáticas y perfiles de compensación.</p>
          <ul>
            <li><a href="/api/orpc/finance/docs">Reference UI</a></li>
            <li><a href="/api/orpc/finance/openapi.json">OpenAPI JSON</a></li>
            <li><code>/api/orpc/finance/rpc/*</code></li>
          </ul>
        </section>
        <section class="card">
          <h2>Users</h2>
          <p>Gestión de usuarios, onboarding, MFA y passkeys.</p>
          <ul>
            <li><a href="/api/orpc/users/docs">Reference UI</a></li>
            <li><a href="/api/orpc/users/openapi.json">OpenAPI JSON</a></li>
            <li><code>/api/orpc/users/rpc/*</code></li>
          </ul>
        </section>
        <section class="card">
          <h2>Utility Bills</h2>
          <p>Consulta de deuda Essbio (agua) y CGE (electricidad).</p>
          <ul>
            <li><a href="/api/orpc/utility-bills/docs">Reference UI</a></li>
            <li><a href="/api/orpc/utility-bills/openapi.json">OpenAPI JSON</a></li>
            <li><code>/api/orpc/utility-bills/rpc/*</code></li>
          </ul>
        </section>
        <section class="card">
          <h2>People</h2>
          <p>Lectura tipada de personas con links a usuario y empleado.</p>
          <ul>
            <li><a href="/api/orpc/people/docs">Reference UI</a></li>
            <li><a href="/api/orpc/people/openapi.json">OpenAPI JSON</a></li>
            <li><code>/api/orpc/people/rpc/*</code></li>
          </ul>
        </section>
        <section class="card">
          <h2>Patients</h2>
          <p>Presupuestos y pagos de pacientes.</p>
          <ul>
            <li><a href="/api/orpc/patients/docs">Reference UI</a></li>
            <li><a href="/api/orpc/patients/openapi.json">OpenAPI JSON</a></li>
            <li><code>/api/orpc/patients/rpc/*</code></li>
          </ul>
        </section>
        <section class="card">
          <h2>Personal Finance</h2>
          <p>Créditos personales, cuotas y pagos con soporte UF.</p>
          <ul>
            <li><a href="/api/orpc/personal-finance/docs">Reference UI</a></li>
            <li><a href="/api/orpc/personal-finance/openapi.json">OpenAPI JSON</a></li>
            <li><code>/api/orpc/personal-finance/rpc/*</code></li>
          </ul>
        </section>
        <section class="card">
          <h2>Settings</h2>
          <p>Configuración interna y contratos de branding.</p>
          <ul>
            <li><a href="/api/orpc/settings/docs">Reference UI</a></li>
            <li><a href="/api/orpc/settings/openapi.json">OpenAPI JSON</a></li>
            <li><code>/api/orpc/settings/rpc/*</code></li>
          </ul>
        </section>
        <section class="card">
          <h2>Notifications</h2>
          <p>Suscripciones push y envío de notificaciones de prueba.</p>
          <ul>
            <li><a href="/api/orpc/notifications/docs">Reference UI</a></li>
            <li><a href="/api/orpc/notifications/openapi.json">OpenAPI JSON</a></li>
            <li><code>/api/orpc/notifications/rpc/*</code></li>
          </ul>
        </section>
        <section class="card">
          <h2>Services</h2>
          <p>Servicios recurrentes, schedules, pagos y conciliación financiera.</p>
          <ul>
            <li><a href="/api/orpc/services/docs">Reference UI</a></li>
            <li><a href="/api/orpc/services/openapi.json">OpenAPI JSON</a></li>
            <li><code>/api/orpc/services/rpc/*</code></li>
          </ul>
        </section>
        <section class="card">
          <h2>Supplies</h2>
          <p>Common supplies y solicitudes internas de insumos.</p>
          <ul>
            <li><a href="/api/orpc/supplies/docs">Reference UI</a></li>
            <li><a href="/api/orpc/supplies/openapi.json">OpenAPI JSON</a></li>
            <li><code>/api/orpc/supplies/rpc/*</code></li>
          </ul>
        </section>
        <section class="card">
          <h2>Production Balances</h2>
          <p>Balances diarios de producción y sus totales operativos.</p>
          <ul>
            <li><a href="/api/orpc/production-balances/docs">Reference UI</a></li>
            <li><a href="/api/orpc/production-balances/openapi.json">OpenAPI JSON</a></li>
            <li><code>/api/orpc/production-balances/rpc/*</code></li>
          </ul>
        </section>
        <section class="card">
          <h2>Balances</h2>
          <p>Balances diarios de caja y reporte entre fechas.</p>
          <ul>
            <li><a href="/api/orpc/balances/docs">Reference UI</a></li>
            <li><a href="/api/orpc/balances/openapi.json">OpenAPI JSON</a></li>
            <li><code>/api/orpc/balances/rpc/*</code></li>
          </ul>
        </section>
        <section class="card">
          <h2>Release Transactions</h2>
          <p>Release transactions de Mercado Pago para payouts y conciliación.</p>
          <ul>
            <li><a href="/api/orpc/release-transactions/docs">Reference UI</a></li>
            <li><a href="/api/orpc/release-transactions/openapi.json">OpenAPI JSON</a></li>
            <li><code>/api/orpc/release-transactions/rpc/*</code></li>
          </ul>
        </section>
        <section class="card">
          <h2>Settlement Transactions</h2>
          <p>Settlement transactions de Mercado Pago para conciliación financiera.</p>
          <ul>
            <li><a href="/api/orpc/settlement-transactions/docs">Reference UI</a></li>
            <li><a href="/api/orpc/settlement-transactions/openapi.json">OpenAPI JSON</a></li>
            <li><code>/api/orpc/settlement-transactions/rpc/*</code></li>
          </ul>
        </section>
        <section class="card">
          <h2>Shipments</h2>
          <p>Cobertura, cotización y órdenes de transporte ChileExpress.</p>
          <ul>
            <li><a href="/api/orpc/shipments/docs">Reference UI</a></li>
            <li><a href="/api/orpc/shipments/openapi.json">OpenAPI JSON</a></li>
            <li><code>/api/orpc/shipments/rpc/*</code></li>
          </ul>
        </section>
        <section class="card">
          <h2>Backups</h2>
          <p>Backups en Google Drive, restauración y metadata. El progreso sigue por SSE.</p>
          <ul>
            <li><a href="/api/orpc/backups/docs">Reference UI</a></li>
            <li><a href="/api/orpc/backups/openapi.json">OpenAPI JSON</a></li>
            <li><code>/api/orpc/backups/rpc/*</code></li>
          </ul>
        </section>
        <section class="card">
          <h2>Transactions Insights</h2>
          <p>Estadísticas, leaderboard e insight por participante para transacciones.</p>
          <ul>
            <li><a href="/api/orpc/transactions-insights/docs">Reference UI</a></li>
            <li><a href="/api/orpc/transactions-insights/openapi.json">OpenAPI JSON</a></li>
            <li><code>/api/orpc/transactions-insights/rpc/*</code></li>
          </ul>
        </section>
        <section class="card">
          <h2>Mercado Pago</h2>
          <p>Reportes y procesamiento manual; la descarga binaria sigue por REST.</p>
          <ul>
            <li><a href="/api/orpc/mercadopago/docs">Reference UI</a></li>
            <li><a href="/api/orpc/mercadopago/openapi.json">OpenAPI JSON</a></li>
            <li><code>/api/orpc/mercadopago/rpc/*</code></li>
          </ul>
        </section>
        <section class="card">
          <h2>Timesheets</h2>
          <p>Resumen, detalle, edición y payloads de correo de timesheets.</p>
          <ul>
            <li><a href="/api/orpc/timesheets/docs">Reference UI</a></li>
            <li><a href="/api/orpc/timesheets/openapi.json">OpenAPI JSON</a></li>
            <li><code>/api/orpc/timesheets/rpc/*</code></li>
          </ul>
        </section>
      </div>
    </main>
  </body>
</html>`)
);

app.use("/api/orpc/calendar/rpc/*", async (c, next) => {
  const { matched, response } = await calendarORPCHandler.handle(createHonoORPCRequest(c), {
    prefix: "/api/orpc/calendar/rpc",
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/certificates/rpc/*", async (c, next) => {
  const { matched, response } = await certificatesORPCHandler.handle(createHonoORPCRequest(c), {
    prefix: "/api/orpc/certificates/rpc",
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

// ─── Clinical Series SSE progress stream ──────────────────────────────────────
app.get("/api/clinical-series/progress", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.text("Unauthorized", 401);
  const canRead = await hasPermission(user, "read", "ClinicalSeries");
  if (!canRead) return c.text("Forbidden", 403);

  const encoder = new TextEncoder();
  const encode = (data: unknown) => encoder.encode(`data: ${JSON.stringify(data)}\n\n`);

  const stream = new ReadableStream({
    start(controller) {
      // Send initial snapshot immediately
      controller.enqueue(encode({ job: getCurrentRebuildJob() }));

      const interval = setInterval(() => {
        try {
          controller.enqueue(encode({ job: getCurrentRebuildJob() }));
        } catch {
          clearInterval(interval);
        }
      }, 500);

      c.req.raw.signal.addEventListener("abort", () => {
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return c.newResponse(stream, {
    headers: {
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
    },
  });
});

app.use("/api/orpc/clinical-series/rpc/*", async (c, next) => {
  const { matched, response } = await clinicalSeriesORPCHandler.handle(createHonoORPCRequest(c), {
    prefix: "/api/orpc/clinical-series/rpc",
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/clinical-skin-tests/rpc/*", async (c, next) => {
  const { matched, response } = await clinicalSkinTestsORPCHandler.handle(
    createHonoORPCRequest(c),
    {
      prefix: "/api/orpc/clinical-skin-tests/rpc",
      context: { hono: c },
    }
  );
  if (matched) {
    return c.newResponse(response.body, response);
  }
  return next();
});

app.use("/api/orpc/clinical-records/rpc/*", async (c, next) => {
  const { matched, response } = await clinicalRecordsORPCHandler.handle(createHonoORPCRequest(c), {
    prefix: "/api/orpc/clinical-records/rpc",
    context: { hono: c },
  });
  if (matched) {
    return c.newResponse(response.body, response);
  }
  return next();
});

app.use("/api/orpc/system/rpc/*", async (c, next) => {
  const { matched, response } = await systemORPCHandler.handle(createHonoORPCRequest(c), {
    prefix: "/api/orpc/system/rpc",
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

// ─── Backups SSE progress stream ─────────────────────────────────────────────
app.get("/api/backups/progress", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.text("Unauthorized", 401);
  const canRead = await hasPermission(user, "read", "Backup");
  if (!canRead) return c.text("Forbidden", 403);

  const encoder = new TextEncoder();
  const encode = (data: unknown) => encoder.encode(`data: ${JSON.stringify(data)}\n\n`);

  const stream = new ReadableStream({
    start(controller) {
      const currentJobs = getCurrentBackupJobs();
      const backupJob =
        currentJobs.find((j) => j.type === "full" || j.type === "scheduled") ?? null;

      // Send initial snapshot
      controller.enqueue(
        encode({
          type: "init",
          job: backupJob,
          jobs: { backup: backupJob, restore: null },
        })
      );

      const interval = setInterval(() => {
        try {
          const jobs = getCurrentBackupJobs();
          const backup = jobs.find((j) => j.type === "full" || j.type === "scheduled") ?? null;
          controller.enqueue(
            encode({
              type: backup ? "backup" : "init",
              job: backup,
              jobs: { backup, restore: null },
            })
          );
        } catch {
          clearInterval(interval);
        }
      }, 1000);

      c.req.raw.signal.addEventListener("abort", () => {
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return c.newResponse(stream, {
    headers: {
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
    },
  });
});

app.use("/api/orpc/backups/rpc/*", async (c, next) => {
  const { matched, response } = await backupsORPCHandler.handle(createHonoORPCRequest(c), {
    prefix: "/api/orpc/backups/rpc",
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/balances/rpc/*", async (c, next) => {
  const { matched, response } = await balancesORPCHandler.handle(createHonoORPCRequest(c), {
    prefix: "/api/orpc/balances/rpc",
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/release-transactions/rpc/*", async (c, next) => {
  const { matched, response } = await releaseTransactionsORPCHandler.handle(
    createHonoORPCRequest(c),
    {
      prefix: "/api/orpc/release-transactions/rpc",
      context: { hono: c },
    }
  );

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/settlement-transactions/rpc/*", async (c, next) => {
  const { matched, response } = await settlementTransactionsORPCHandler.handle(
    createHonoORPCRequest(c),
    {
      prefix: "/api/orpc/settlement-transactions/rpc",
      context: { hono: c },
    }
  );

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/transactions-insights/rpc/*", async (c, next) => {
  const { matched, response } = await transactionsInsightsORPCHandler.handle(
    createHonoORPCRequest(c),
    {
      prefix: "/api/orpc/transactions-insights/rpc",
      context: { hono: c },
    }
  );

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/dte-analytics/event-links/rpc/*", async (c, next) => {
  const { matched, response } = await dteEventLinksORPCHandler.handle(createHonoORPCRequest(c), {
    prefix: "/api/orpc/dte-analytics/event-links/rpc",
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/dte-analytics/rpc/*", async (c, next) => {
  const { matched, response } = await dteAnalyticsORPCHandler.handle(createHonoORPCRequest(c), {
    prefix: "/api/orpc/dte-analytics/rpc",
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/dte/rpc/*", async (c, next) => {
  const { matched, response } = await dteORPCHandler.handle(createHonoORPCRequest(c), {
    prefix: "/api/orpc/dte/rpc",
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/employees/rpc/*", async (c, next) => {
  const { matched, response } = await employeesORPCHandler.handle(createHonoORPCRequest(c), {
    prefix: "/api/orpc/employees/rpc",
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/expenses/rpc/*", async (c, next) => {
  const { matched, response } = await expensesORPCHandler.handle(createHonoORPCRequest(c), {
    prefix: "/api/orpc/expenses/rpc",
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/csv-upload/rpc/*", async (c, next) => {
  const { matched, response } = await csvUploadORPCHandler.handle(createHonoORPCRequest(c), {
    prefix: "/api/orpc/csv-upload/rpc",
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/haulmer/rpc/*", async (c, next) => {
  const { matched, response } = await haulmerORPCHandler.handle(createHonoORPCRequest(c), {
    prefix: "/api/orpc/haulmer/rpc",
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/integrations/rpc/*", async (c, next) => {
  const { matched, response } = await integrationsORPCHandler.handle(createHonoORPCRequest(c), {
    prefix: "/api/orpc/integrations/rpc",
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/mercadopago/rpc/*", async (c, next) => {
  const { matched, response } = await mercadopagoORPCHandler.handle(createHonoORPCRequest(c), {
    prefix: "/api/orpc/mercadopago/rpc",
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/inventory/rpc/*", async (c, next) => {
  const { matched, response } = await inventoryORPCHandler.handle(createHonoORPCRequest(c), {
    prefix: "/api/orpc/inventory/rpc",
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/loans/rpc/*", async (c, next) => {
  const { matched, response } = await loansORPCHandler.handle(createHonoORPCRequest(c), {
    prefix: "/api/orpc/loans/rpc",
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/roles/rpc/*", async (c, next) => {
  const { matched, response } = await rolesORPCHandler.handle(createHonoORPCRequest(c), {
    prefix: "/api/orpc/roles/rpc",
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/counterparts/rpc/*", async (c, next) => {
  const { matched, response } = await counterpartsORPCHandler.handle(createHonoORPCRequest(c), {
    prefix: "/api/orpc/counterparts/rpc",
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/finance/rpc/*", async (c, next) => {
  const { matched, response } = await financeORPCHandler.handle(createHonoORPCRequest(c), {
    prefix: "/api/orpc/finance/rpc",
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/users/rpc/*", async (c, next) => {
  const { matched, response } = await usersORPCHandler.handle(createHonoORPCRequest(c), {
    prefix: "/api/orpc/users/rpc",
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/utility-bills/rpc/*", async (c, next) => {
  const { matched, response } = await utilityBillsORPCHandler.handle(createHonoORPCRequest(c), {
    prefix: "/api/orpc/utility-bills/rpc",
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/provider-credentials/rpc/*", async (c, next) => {
  const { matched, response } = await providerCredentialsORPCHandler.handle(
    createHonoORPCRequest(c),
    {
      prefix: "/api/orpc/provider-credentials/rpc",
      context: { hono: c },
    }
  );

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/people/rpc/*", async (c, next) => {
  const { matched, response } = await peopleORPCHandler.handle(createHonoORPCRequest(c), {
    prefix: "/api/orpc/people/rpc",
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/personal-finance/rpc/*", async (c, next) => {
  const { matched, response } = await personalFinanceORPCHandler.handle(createHonoORPCRequest(c), {
    prefix: "/api/orpc/personal-finance/rpc",
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/settings/rpc/*", async (c, next) => {
  const { matched, response } = await settingsORPCHandler.handle(createHonoORPCRequest(c), {
    prefix: "/api/orpc/settings/rpc",
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/notifications/rpc/*", async (c, next) => {
  const { matched, response } = await notificationsORPCHandler.handle(createHonoORPCRequest(c), {
    prefix: "/api/orpc/notifications/rpc",
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/services/rpc/*", async (c, next) => {
  const { matched, response } = await servicesORPCHandler.handle(createHonoORPCRequest(c), {
    prefix: "/api/orpc/services/rpc",
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/supplies/rpc/*", async (c, next) => {
  const { matched, response } = await suppliesORPCHandler.handle(createHonoORPCRequest(c), {
    prefix: "/api/orpc/supplies/rpc",
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/timesheets/rpc/*", async (c, next) => {
  const { matched, response } = await timesheetsORPCHandler.handle(createHonoORPCRequest(c), {
    prefix: "/api/orpc/timesheets/rpc",
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/attendance/rpc/*", async (c, next) => {
  const { matched, response } = await attendanceORPCHandler.handle(createHonoORPCRequest(c), {
    prefix: "/api/orpc/attendance/rpc",
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/production-balances/rpc/*", async (c, next) => {
  const { matched, response } = await productionBalancesORPCHandler.handle(
    createHonoORPCRequest(c),
    {
      prefix: "/api/orpc/production-balances/rpc",
      context: { hono: c },
    }
  );

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/auth/rpc/*", async (c, next) => {
  const { matched, response } = await authORPCHandler.handle(createHonoORPCRequest(c), {
    prefix: "/api/orpc/auth/rpc",
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/patients/rpc/*", async (c, next) => {
  const { matched, response } = await patientsORPCHandler.handle(createHonoORPCRequest(c), {
    prefix: "/api/orpc/patients/rpc",
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/addresses/rpc/*", async (c, next) => {
  const { matched, response } = await addressesORPCHandler.handle(createHonoORPCRequest(c), {
    prefix: "/api/orpc/addresses/rpc",
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/addresses/*", async (c, next) => {
  const { matched, response } = await addressesOpenAPIHandler.handle(createHonoORPCRequest(c), {
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/patient-campaigns/rpc/*", async (c, next) => {
  const { matched, response } = await patientCampaignsORPCHandler.handle(createHonoORPCRequest(c), {
    prefix: "/api/orpc/patient-campaigns/rpc",
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/outreach/rpc/*", async (c, next) => {
  const { matched, response } = await outreachORPCHandler.handle(createHonoORPCRequest(c), {
    prefix: "/api/orpc/outreach/rpc",
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/wa-cloud/rpc/*", async (c, next) => {
  const { matched, response } = await waCloudORPCHandler.handle(createHonoORPCRequest(c), {
    prefix: "/api/orpc/wa-cloud/rpc",
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/doctoralia/rpc/*", async (c, next) => {
  const { matched, response } = await doctoraliaORPCHandler.handle(createHonoORPCRequest(c), {
    prefix: "/api/orpc/doctoralia/rpc",
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/dte-analytics/event-links/*", async (c, next) => {
  const { matched, response } = await dteEventLinksOpenAPIHandler.handle(createHonoORPCRequest(c), {
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/dte-analytics/*", async (c, next) => {
  const { matched, response } = await dteAnalyticsOpenAPIHandler.handle(createHonoORPCRequest(c), {
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/dte/*", async (c, next) => {
  const { matched, response } = await dteOpenAPIHandler.handle(createHonoORPCRequest(c), {
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/inventory/*", async (c, next) => {
  const { matched, response } = await inventoryOpenAPIHandler.handle(createHonoORPCRequest(c), {
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/loans/*", async (c, next) => {
  const { matched, response } = await loansOpenAPIHandler.handle(createHonoORPCRequest(c), {
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/csv-upload/*", async (c, next) => {
  const { matched, response } = await csvUploadOpenAPIHandler.handle(createHonoORPCRequest(c), {
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/haulmer/*", async (c, next) => {
  const { matched, response } = await haulmerOpenAPIHandler.handle(createHonoORPCRequest(c), {
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/employees/*", async (c, next) => {
  const { matched, response } = await employeesOpenAPIHandler.handle(createHonoORPCRequest(c), {
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/expenses/*", async (c, next) => {
  const { matched, response } = await expensesOpenAPIHandler.handle(createHonoORPCRequest(c), {
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/integrations/*", async (c, next) => {
  const { matched, response } = await integrationsOpenAPIHandler.handle(createHonoORPCRequest(c), {
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/mercadopago/*", async (c, next) => {
  const { matched, response } = await mercadopagoOpenAPIHandler.handle(createHonoORPCRequest(c), {
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/roles/*", async (c, next) => {
  const { matched, response } = await rolesOpenAPIHandler.handle(createHonoORPCRequest(c), {
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/counterparts/*", async (c, next) => {
  const { matched, response } = await counterpartsOpenAPIHandler.handle(createHonoORPCRequest(c), {
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/finance/*", async (c, next) => {
  const { matched, response } = await financeOpenAPIHandler.handle(createHonoORPCRequest(c), {
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/users/*", async (c, next) => {
  const { matched, response } = await usersOpenAPIHandler.handle(createHonoORPCRequest(c), {
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/utility-bills/*", async (c, next) => {
  const { matched, response } = await utilityBillsOpenAPIHandler.handle(createHonoORPCRequest(c), {
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/people/*", async (c, next) => {
  const { matched, response } = await peopleOpenAPIHandler.handle(createHonoORPCRequest(c), {
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/personal-finance/*", async (c, next) => {
  const { matched, response } = await personalFinanceOpenAPIHandler.handle(
    createHonoORPCRequest(c),
    {
      context: { hono: c },
    }
  );

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/settings/*", async (c, next) => {
  const { matched, response } = await settingsOpenAPIHandler.handle(createHonoORPCRequest(c), {
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/notifications/*", async (c, next) => {
  const { matched, response } = await notificationsOpenAPIHandler.handle(createHonoORPCRequest(c), {
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/services/*", async (c, next) => {
  const { matched, response } = await servicesOpenAPIHandler.handle(createHonoORPCRequest(c), {
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/supplies/*", async (c, next) => {
  const { matched, response } = await suppliesOpenAPIHandler.handle(createHonoORPCRequest(c), {
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/timesheets/*", async (c, next) => {
  const { matched, response } = await timesheetsOpenAPIHandler.handle(createHonoORPCRequest(c), {
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/attendance/*", async (c, next) => {
  const { matched, response } = await attendanceOpenAPIHandler.handle(createHonoORPCRequest(c), {
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/production-balances/*", async (c, next) => {
  const { matched, response } = await productionBalancesOpenAPIHandler.handle(
    createHonoORPCRequest(c),
    {
      context: { hono: c },
    }
  );

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/auth/*", async (c, next) => {
  const { matched, response } = await authOpenAPIHandler.handle(createHonoORPCRequest(c), {
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/patients/*", async (c, next) => {
  const { matched, response } = await patientsOpenAPIHandler.handle(createHonoORPCRequest(c), {
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/patient-campaigns/*", async (c, next) => {
  const { matched, response } = await patientCampaignsOpenAPIHandler.handle(
    createHonoORPCRequest(c),
    {
      context: { hono: c },
    }
  );

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/outreach/*", async (c, next) => {
  const { matched, response } = await outreachOpenAPIHandler.handle(createHonoORPCRequest(c), {
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/wa-cloud/*", async (c, next) => {
  const { matched, response } = await waCloudOpenAPIHandler.handle(createHonoORPCRequest(c), {
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/doctoralia/*", async (c, next) => {
  const { matched, response } = await doctoraliaOpenAPIHandler.handle(createHonoORPCRequest(c), {
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/calendar/*", async (c, next) => {
  const { matched, response } = await calendarOpenAPIHandler.handle(createHonoORPCRequest(c), {
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/certificates/*", async (c, next) => {
  const { matched, response } = await certificatesOpenAPIHandler.handle(createHonoORPCRequest(c), {
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/clinical-series/*", async (c, next) => {
  const { matched, response } = await clinicalSeriesOpenAPIHandler.handle(
    createHonoORPCRequest(c),
    {
      context: { hono: c },
    }
  );

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/clinical-skin-tests/*", async (c, next) => {
  const { matched, response } = await clinicalSkinTestsOpenAPIHandler.handle(
    createHonoORPCRequest(c),
    {
      context: { hono: c },
    }
  );
  if (matched) {
    return c.newResponse(response.body, response);
  }
  return next();
});

app.use("/api/orpc/clinical-records/*", async (c, next) => {
  const { matched, response } = await clinicalRecordsOpenAPIHandler.handle(
    createHonoORPCRequest(c),
    {
      context: { hono: c },
    }
  );
  if (matched) {
    return c.newResponse(response.body, response);
  }
  return next();
});

app.use("/api/orpc/system/*", async (c, next) => {
  const { matched, response } = await systemOpenAPIHandler.handle(createHonoORPCRequest(c), {
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/backups/*", async (c, next) => {
  const { matched, response } = await backupsOpenAPIHandler.handle(createHonoORPCRequest(c), {
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/balances/*", async (c, next) => {
  const { matched, response } = await balancesOpenAPIHandler.handle(createHonoORPCRequest(c), {
    context: { hono: c },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/release-transactions/*", async (c, next) => {
  const { matched, response } = await releaseTransactionsOpenAPIHandler.handle(
    createHonoORPCRequest(c),
    {
      context: { hono: c },
    }
  );

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/settlement-transactions/*", async (c, next) => {
  const { matched, response } = await settlementTransactionsOpenAPIHandler.handle(
    createHonoORPCRequest(c),
    {
      context: { hono: c },
    }
  );

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/transactions-insights/*", async (c, next) => {
  const { matched, response } = await transactionsInsightsOpenAPIHandler.handle(
    createHonoORPCRequest(c),
    {
      context: { hono: c },
    }
  );

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/shipments/rpc/*", async (c, next) => {
  const { matched, response } = await shipmentsORPCHandler.handle(createHonoORPCRequest(c), {
    prefix: "/api/orpc/shipments/rpc",
    context: {},
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

app.use("/api/orpc/shipments/*", async (c, next) => {
  const { matched, response } = await shipmentsOpenAPIHandler.handle(createHonoORPCRequest(c), {
    context: {},
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  return next();
});

// Share Target (PWA)

// Dedicated external webhook ingress (Golden Standard 2026)
app.route("/api/webhooks/google", googleCalendarWebhookRoutes);
app.route("/api/webhooks/onedrive", onedriveWebhookRoutes);
app.route("/api/webhooks/meta", waCloudWebhookRoutes);
app.route("/api/wa-cloud/media", waCloudMediaRoutes);
app.route("/api/wa-cloud/sse", waCloudSseRoutes);
app.route("/api/webhooks/mercadopago", mercadopagoReportWebhookRoutes);

// Bearer-auth ingress for the Doctoralia scraper bot (reads/writes manual cookies).
app.route("/api/scraper/doctoralia", doctoraliaScraperRoutes);

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
      users: "/api/users/*",
      orpc: "/api/orpc/*",
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
      Sentry.captureException(error);
    }

    return errorReply(
      c,
      error.status as ContentfulStatusCode,
      error.expose ? error.message : "Internal Server Error",
      {
        code: error.code,
        ...(error.expose ? { details: error.details } : {}),
      }
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
      }
    );
  }

  logError("api.unhandled.error", error, {
    method: c.req.method,
    path: c.req.path,
  });
  Sentry.captureException(error);
  return reply(
    c,
    { status: "error", code: "INTERNAL_ERROR", message: "Internal Server Error" },
    500
  );
});
