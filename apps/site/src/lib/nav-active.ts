import type { NavLink } from "@/data/navigation";

/**
 * Normalize a pathname for comparison: drop trailing slashes, treat empty as
 * "/". Mirrors `normalizePath` in App.tsx so active detection agrees with the
 * legal-document resolver.
 */
export function normalizePath(pathname: string): string {
  if (!pathname || pathname === "/") {
    return "/";
  }
  const normalized = pathname.replace(/\/+$/, "");
  return normalized.length === 0 ? "/" : normalized;
}

/**
 * Whether a nav item represents the page currently shown at `pathname`.
 *
 * - Anchor links (`/#contacto`) never report active by path — they jump to a
 *   section, not a route.
 * - "/" is active only on the exact root (otherwise it would match everything).
 * - Other routes are active on an exact match or any nested child
 *   (`/aprende` is active on `/aprende/rinitis`).
 */
export function isNavItemActive(item: NavLink, pathname: string): boolean {
  if (item.href.includes("#")) {
    return false;
  }
  const here = normalizePath(pathname);
  const target = normalizePath(item.href);
  if (target === "/") {
    return here === "/";
  }
  return here === target || here.startsWith(`${target}/`);
}
