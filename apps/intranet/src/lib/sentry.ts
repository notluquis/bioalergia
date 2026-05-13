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
import { onCLS, onINP, onLCP, type Metric } from "web-vitals/attribution";

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

  // Lazy-load Replay so it doesn't bloat the main entry. Replay adds ~70KB
  // gzipped — only fetch it after the page is interactive.
  void loadReplay();

  // Pipe Web Vitals to Sentry. v10 exposes `metrics` from @sentry/core; we
  // call optional-chained so older runtimes (or future removals) don't blow
  // up.
  const send = (name: string) => (metric: Metric) => {
    const m = (Sentry as unknown as { metrics?: { distribution?: typeof distributionStub } }).metrics;
    m?.distribution?.(`web_vital.${name}`, metric.value, {
      tags: { rating: metric.rating },
    });
  };
  onCLS(send("cls"));
  onINP(send("inp"));
  onLCP(send("lcp"));
}

async function loadReplay(): Promise<void> {
  try {
    const replayIntegration = await Sentry.lazyLoadIntegration("replayIntegration");
    Sentry.addIntegration(
      replayIntegration({
        // PHI defaults: mask everything textual, block media, do not capture
        // request/response bodies.
        maskAllText: true,
        maskAllInputs: true,
        blockAllMedia: true,
        networkDetailAllowUrls: [],
        // Extra explicit selectors for clinical surfaces.
        mask: ["[data-phi]", "input", "textarea", "[contenteditable]"],
        block: ["[data-phi-block]", "canvas", ".patient-photo"],
      })
    );
  } catch {
    // Replay is optional — failing to load it must not break the app.
  }
}

// Type stub purely so the optional-chained metrics call above type-checks
// across SDK versions where `metrics` may or may not exist.
declare function distributionStub(
  name: string,
  value: number,
  data?: { tags?: Record<string, string> }
): void;

export { Sentry };
