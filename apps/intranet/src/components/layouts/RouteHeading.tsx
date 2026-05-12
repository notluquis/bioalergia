import { useMatches } from "@tanstack/react-router";

/**
 * Emits exactly one `<h1>` per authed route, sourced from
 * `staticData.title` already declared on every TanStack Router file
 * route. Visually hidden so existing card / page chrome (h2 / h3)
 * stays as-is, but axe + screen readers see the page title.
 *
 * Mount once inside `<main>` in `_authed.tsx`. WCAG best-practice
 * `page-has-heading-one`.
 */
export function RouteHeading() {
  const matches = useMatches();
  const leaf = matches.at(-1);
  const title = leaf?.staticData.title;
  if (!title) return null;
  return <h1 className="sr-only">{title}</h1>;
}
