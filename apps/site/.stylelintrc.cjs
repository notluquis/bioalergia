/**
 * Stylelint config — mirrors apps/intranet/.stylelintrc.cjs.
 * Layered defense for layout-bug families documented in the 2026
 * layout-regression research. Tailwind v4 at-rules (@import, @theme,
 * @apply, @tailwind) are tolerated because no `extends` config with a
 * stricter at-rule allowlist is loaded — only the rules below are active.
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
 * - rhythmguard/prefer-token (preset: rhythmic-4)
 *     Catches: token drift — arbitrary px / rem values bypassing the
 *     Tailwind v4 @theme spacing scale. Severity `warning` so it surfaces
 *     drift without blocking CI.
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
