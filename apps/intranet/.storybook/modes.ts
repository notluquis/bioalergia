/**
 * Chromatic modes (https://www.chromatic.com/docs/modes/).
 *
 * Each mode = one snapshot per story. The combinations below take a
 * single story and capture it under {light,dark} × {mobile,tablet,desktop}
 * = 6 visual variants. Layout-shift, dark-mode contrast bugs, and
 * mobile breakpoint regressions all become diff-able instead of relying
 * on a human spotting them.
 *
 * Forced-colors is intentionally *not* a global mode (Chromatic doesn't
 * support media features in modes — see chromatic.com/docs/media-features).
 * Apply per-story via `parameters.chromatic.forcedColors: "active"` for
 * components that risk Windows High Contrast regressions (forms, modals).
 */
export const allModes = {
  "light mobile": { viewport: "mobile", theme: "light" },
  "dark mobile": { viewport: "mobile", theme: "dark" },
  "light tablet": { viewport: "tablet", theme: "light" },
  "dark tablet": { viewport: "tablet", theme: "dark" },
  "light desktop": { viewport: "desktop", theme: "light" },
  "dark desktop": { viewport: "desktop", theme: "dark" },
} as const;
