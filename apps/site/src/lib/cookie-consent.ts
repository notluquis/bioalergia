// Cookie-consent persistence, extracted from
// features/shop/components/CookiesBanner.tsx so the pure read/parse logic is
// unit-testable AND so the component file only exports React components (fixes
// oxlint react(only-export-components)). Behavior is byte-identical to the
// original inline `read()` / `getCookieConsent()`.
//
// Ley 21.719 (Protección de Datos, Chile, vigente diciembre 2026): the decision
// is persisted in localStorage so external apps (PostHog, Meta Pixel, GA4) can
// read the flag before loading.

export const STORAGE_KEY = "bioalergia.cookies";

export type Decision = "accept" | "reject" | null;

/**
 * Reads the persisted cookie decision from localStorage. Returns `null` when
 * running without a `window` (SSR) or when no valid decision is stored.
 */
export function getCookieConsent(): Decision {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw === "accept" || raw === "reject" ? raw : null;
}
