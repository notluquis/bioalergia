/**
 * Stylelint config — layered defense for layout-bug families
 * documented in the 2026 layout-regression research.
 *
 * Rule provenance:
 * - defensive-css/require-dynamic-viewport-height
 *     Catches: 100vh on iOS Safari address-bar collapse → modal cropping.
 * - declaration-property-value-disallowed-list (writing-mode vertical- / sideways- )
 *     Catches: textarea / glyph-stack collapse where vertical writing-mode
 *     interacts with HeroUI Input/Textarea height calc and produces 0-height
 *     measurement → invisible text.
 * - declaration-property-value-disallowed-list (text-overflow: clip)
 *     Catches: silent truncation without ellipsis cue (a11y regression in
 *     Table cells / Chip labels). Force authors to opt into "ellipsis" or
 *     custom string explicitly.
 * - rhythmguard/prefer-token (preset: tailwind)
 *     Catches: token drift — arbitrary px / rem values bypassing the
 *     Tailwind v4 @theme spacing scale, which causes vertical-rhythm
 *     breakage and inconsistent spacing across cards/forms.
 *
 * Deferred (intentionally NOT enabled):
 * - overflow: hidden disallow-list — too noisy in HeroUI Modal /
 *   ScrollShadow / Popover patterns; would generate dozens of false
 *   positives. Layout-helper Vitest assertions cover the real
 *   "scroll trap" cases.
 * - min-width allowlist — Tailwind v4 generates many valid
 *   `min-width: 100%` etc. via utilities. The layout-helper Vitest
 *   assertion (separate task) handles the actual "container shrink-wrap
 *   regression" we care about.
 */
module.exports = {
  plugins: ["stylelint-plugin-defensive-css", "stylelint-plugin-rhythmguard"],
  rules: {
    "defensive-css/require-dynamic-viewport-height": true,
    "defensive-css/no-fixed-sizes": null,
    "defensive-css/no-accidental-hover": null,
    "defensive-css/no-list-style-none": null,
    "declaration-property-value-disallowed-list": {
      "/^writing-mode$/": ["/^vertical-/", "/^sideways-/"],
      "/^text-overflow$/": ["/^clip$/"],
    },
    // NOTE: rhythmguard@1.5.0 does not yet ship a "tailwind" scale preset
    // (announced Apr 2026 for a later minor). Use `rhythmic-4` — 4px base —
    // which mirrors Tailwind v4's default spacing step (0.25rem). Set to
    // `warning` so it surfaces token drift without blocking CI while we
    // triage the existing raw px / rem values flagged in legacy CSS files.
    "rhythmguard/prefer-token": [true, { preset: "rhythmic-4", severity: "warning" }],
  },
  ignoreFiles: [
    "node_modules/**",
    "dist/**",
    "storybook-static/**",
    "playwright/**",
    "e2e-results/**",
    "e2e-report/**",
    "coverage/**",
  ],
};
