// apps/api/src/instrument.ts
// Sentry init for the API. Imported FIRST in src/index.ts so that
// http/fetch instrumentation is patched before any other module loads.
//
// PHI-safe defaults for a Chilean clinical SaaS:
//   - sendDefaultPii: false  → never auto-collect IPs / cookies / headers
//   - beforeSend             → strips request bodies and scrubs clinical
//                              path segments (/patients/:id, /skin-tests/:id, ...)
//   - ignoreErrors           → drops noisy 404 / 429 from bot probes
//
// Profiling (`@sentry/profiling-node`) intentionally NOT installed: it ships
// a >50MB native binding that complicates the Railway slim image. Add later
// only if perf data is genuinely needed.
import * as Sentry from "@sentry/node";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    release: process.env.RAILWAY_GIT_COMMIT_SHA,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    integrations: [
      Sentry.httpIntegration({
        ignoreOutgoingRequests: (url) => url.includes("ingest.sentry.io"),
      }),
    ],
    beforeSend(event) {
      if (event.request?.url) {
        event.request.url = event.request.url.replace(
          /\/(patients|clinical|skin-tests|consultations|documents|medical-records|certificates)\/[^/?#]+/g,
          "/$1/[id]"
        );
      }
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
      }
      return event;
    },
    beforeSendTransaction(event) {
      if (event.request?.url) {
        event.request.url = event.request.url.replace(
          /\/(patients|clinical|skin-tests|consultations|documents|medical-records|certificates)\/[^/?#]+/g,
          "/$1/[id]"
        );
      }
      return event;
    },
    ignoreErrors: [/NOT_FOUND/, /TOO_MANY_REQUESTS/],
  });
}
