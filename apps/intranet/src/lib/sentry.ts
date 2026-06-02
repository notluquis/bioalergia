/**
 * Sentry init for the intranet SPA.
 *
 * PHI policy:
 *   - Patient data (RUT, names, diagnoses, clinical notes) renders across
 *     many routes. We default to maximum masking and stripping so nothing
 *     leaves the browser unless we explicitly opt in.
 *   - `sendDefaultPii: false` keeps IPs / cookies / headers off events.
 *   - Replay: text + inputs masked, media blocked, network details disabled.
 *   - Path segments after PHI-bearing route prefixes are scrubbed to `[id]`.
 *   - The Replay integration is *lazy-loaded* (only when a DSN is set and
 *     after first paint) so the main entry chunk stays small for users that
 *     never trigger an error.
 *
 * Bootstrap:
 *   - If `VITE_SENTRY_DSN` is not set we skip `init()` entirely; every
 *     `Sentry.*` call becomes a no-op. This keeps dev / preview / unauthed
 *     CI runs working without any keys.
 *
 * Compliance reminder:
 *   - Do NOT enable a real DSN in production until the BAA with Sentry
 *     (Business plan) is signed.
 */

import * as Sentry from "@sentry/react";

const dsn = import.meta.env.VITE_SENTRY_DSN;

// Path prefixes whose next segment encodes a PHI identifier (patient id,
// clinical record id, skin test id, etc). We rewrite them to `[id]` before
// any transaction or breadcrumb URL leaves the client.
const PHI_PATH_REGEX =
  /\/(patients|clinical|clinical-records|skin-tests|consultations|documents|medical-records|certificates)\/[^/?#]+/g;

function scrubPhiUrl(url: string): string {
  return url.replace(PHI_PATH_REGEX, "/$1/[id]");
}

let initialized = false;

export function isSentryEnabled(): boolean {
  return initialized;
}

export function initSentry(): void {
  if (!dsn || initialized) {
    return;
  }
  initialized = true;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_APP_BUILD_TIMESTAMP,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0, // off by default
    replaysOnErrorSampleRate: 1.0, // 100% of sessions that hit an error
    sendDefaultPii: false,
    integrations: [Sentry.browserTracingIntegration()],
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.data && typeof breadcrumb.data.url === "string") {
        breadcrumb.data.url = scrubPhiUrl(breadcrumb.data.url);
      }
      return breadcrumb;
    },
    beforeSend(event) {
      if (event.request?.url) {
        event.request.url = scrubPhiUrl(event.request.url);
      }
      return event;
    },
    beforeSendTransaction(event) {
      if (event.request?.url) {
        event.request.url = scrubPhiUrl(event.request.url);
      }
      if (event.transaction) {
        event.transaction = scrubPhiUrl(event.transaction);
      }
      return event;
    },
  });

  // Replay lazy-load is intentionally DISABLED for now. lazyLoadIntegration
  // injects a <script> from browser.sentry-cdn.com; under our strict CSP
  // (`script-src 'nonce-…' 'strict-dynamic'`) that injection path needs
  // verification, and Replay's rrweb recorder hooks every DOM mutation +
  // input — measurable input latency on auth (passkey prompt felt slow
  // once Sentry shipped to prod). Re-enable behind an explicit opt-in
  // after confirming the CDN script loads cleanly + measuring overhead.
  // void loadReplay();

  // Web Vitals (LCP/CLS/INP) are captured automatically by
  // browserTracingIntegration into transactions/spans (accepted on the free
  // Developer plan). The old manual `Sentry.metrics.distribution(...)` piping
  // was REMOVED: custom Metrics is a trial/paid feature — on the free plan
  // (post-trial) every metric envelope 403'd ("Failed to load resource:
  // envelope" spam), and it duplicated what tracing already records.
}

// NOTE: Session Replay deliberately NOT wired.
//   1. lazyLoadIntegration injects a <script> from browser.sentry-cdn.com;
//      under our strict CSP (`script-src 'nonce-…' 'strict-dynamic'`) that
//      CDN injection path is not verified and a hanging load correlated
//      with prod auth-flow latency.
//   2. Replay's rrweb recorder hooks every DOM mutation + input event.
//   3. Replaying a clinical SaaS = PHI on Sentry's servers, which needs a
//      signed BAA (Sentry Business) before it can be turned on at all.
//   When all three are resolved, re-add via `lazyLoadIntegration` per the
//   current Sentry docs — the PHI-safe option block lived here in git
//   history (maskAllText / maskAllInputs / blockAllMedia /
//   networkDetailAllowUrls: [] / [data-phi] selectors).

export { Sentry };
