// apps/api/src/instrument.ts
// Sentry init for the API. Loaded via `node --import ./src/instrument.ts`
// (see Dockerfile CMD + package.json start/dev) so that Sentry's OpenTelemetry
// distribution patches http/fetch/pg BEFORE any application module is imported.
// Sentry v10's @sentry/node IS an OpenTelemetry distro: Sentry.init wires up the
// OTel SpanProcessor / Propagator / ContextManager and we extend it with extra
// instrumentations via `openTelemetryInstrumentations`. We do NOT stand up a
// parallel @opentelemetry/sdk-node pipeline.
//
// PHI-safe defaults for a Chilean clinical SaaS:
//   - dataCollection               → keeps PII categories off by default
//   - PgInstrumentation default    → enhancedDatabaseReporting is OFF, so bound
//                                    parameter VALUES (where the PHI lives in a
//                                    parameterized query) are never attached to
//                                    db spans
//   - beforeSend / beforeSendTransaction → strip request bodies, scrub clinical
//                                    path segments (/patients/:id, …) and drop
//                                    any captured `db.statement` from spans
//   - ignoreErrors                 → drops noisy 404 / 429 from bot probes
//
// Profiling (`@sentry/profiling-node`) intentionally NOT installed: it ships
// a >50MB native binding that complicates the Railway slim image. Add later
// only if perf data is genuinely needed.
import * as Sentry from "@sentry/node";
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg";

const dsn = process.env.SENTRY_DSN;

// Clinical path segments that may embed identifiers (patient ids, RUTs encoded
// in route params, etc). Replaced with a placeholder on any URL we report.
const CLINICAL_PATH_RE =
  /\/(patients|clinical|skin-tests|consultations|documents|medical-records|certificates)\/[^/?#]+/g;

// Base sample rate for ordinary transactions. Kept conservative.
const BASE_TRACES_SAMPLE_RATE = 0.1;

/**
 * Per-transaction sampling decision. Health checks, OPTIONS preflights and
 * static asset probes are dropped entirely (rate 0); everything else inherits
 * the conservative base rate. Errors/slow transactions are still surfaced via
 * Sentry's error pipeline (beforeSend), independent of this trace sampler.
 */
function tracesSampler(samplingContext: {
  name: string;
  attributes?: Record<string, unknown>;
  parentSampled?: boolean;
}): number {
  // Respect an upstream sampling decision if one was propagated.
  if (typeof samplingContext.parentSampled === "boolean") {
    return samplingContext.parentSampled ? 1 : 0;
  }

  const name = samplingContext.name ?? "";
  const attrs = samplingContext.attributes ?? {};
  const method = String(attrs["http.request.method"] ?? attrs["http.method"] ?? "");
  const target = String(attrs["http.route"] ?? attrs["url.path"] ?? attrs["http.target"] ?? name);

  // Never trace preflights — they carry no business work.
  if (method.toUpperCase() === "OPTIONS") return 0;

  // Drop liveness/health probes and static asset noise.
  if (
    target.includes("/health") ||
    target.includes("/api/csrf") ||
    target.startsWith("/assets/") ||
    target.startsWith("/static/") ||
    /\.(?:js|css|map|png|jpe?g|svg|ico|woff2?)$/.test(target)
  ) {
    return 0;
  }

  return BASE_TRACES_SAMPLE_RATE;
}

/**
 * Strip any `db.statement` (and related pg span attributes) from a transaction
 * event's spans. Bound parameter values are already excluded by leaving
 * PgInstrumentation's `enhancedDatabaseReporting` OFF, but the raw SQL text can
 * still hint at table/column shape, so we drop it defensively on the wire.
 */
function scrubDbStatements(event: Sentry.Event): void {
  const spans = (event as { spans?: Array<{ data?: Record<string, unknown> }> }).spans;
  if (!Array.isArray(spans)) return;
  for (const span of spans) {
    if (span.data) {
      delete span.data["db.statement"];
      delete span.data["db.query.text"];
    }
  }
}

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    release: process.env.RAILWAY_GIT_COMMIT_SHA,
    tracesSampler,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: { request: false, response: false },
      httpBodies: [],
      queryParams: false,
      genAI: { inputs: false, outputs: false },
    },
    // Sentry's OTel distro already instruments http/fetch. We add pg here so
    // Kysely / ZenStack / graphile-worker queries (all via node-postgres) emit
    // DB spans. enhancedDatabaseReporting stays at its default (false) so bound
    // parameter values — where PHI lives — are never captured.
    openTelemetryInstrumentations: [new PgInstrumentation()],
    integrations: [
      Sentry.httpIntegration({
        ignoreOutgoingRequests: (url) => url.includes("ingest.sentry.io"),
      }),
    ],
    beforeSend(event) {
      if (event.request?.url) {
        event.request.url = event.request.url.replace(CLINICAL_PATH_RE, "/$1/[id]");
      }
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
      }
      scrubDbStatements(event);
      return event;
    },
    beforeSendTransaction(event) {
      if (event.request?.url) {
        event.request.url = event.request.url.replace(CLINICAL_PATH_RE, "/$1/[id]");
      }
      scrubDbStatements(event);
      return event;
    },
    ignoreErrors: [/NOT_FOUND/, /TOO_MANY_REQUESTS/],
  });
}
