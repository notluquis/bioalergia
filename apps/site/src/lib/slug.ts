// Slug → human-readable title, extracted from the three identical inline
// implementations in routes/producto/$slug.tsx, routes/aprende/$slug.tsx
// (named `humanizeSlug`) and routes/noticias/$slug.tsx. Behavior is
// byte-identical to the original inline expression.

/**
 * Turns a hyphenated slug into a Title Case label by upper-casing the first
 * character of each hyphen-delimited word and joining with spaces.
 *
 * Mirrors `slug.split("-").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(" ")`.
 * Note: only the FIRST char of each word is touched — the rest is preserved
 * as-is (already-capitalized or mixed-case words are not lower-cased).
 */
export function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}
