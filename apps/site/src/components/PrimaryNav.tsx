import { Link, ScrollShadow } from "@heroui/react";

import { type NavLink, primaryNav } from "@/data/navigation";
import { isNavItemActive } from "@/lib/nav-active";

/** SSR-safe read of the current pathname (static prerender has no window). */
function readPathname(): string {
  return typeof window === "undefined" ? "/" : window.location.pathname;
}

function linkClass(item: NavLink, active: boolean): string {
  const base = "whitespace-nowrap no-underline transition-colors";
  const tone = item.accent
    ? "font-semibold text-(--accent) hover:text-(--ink)"
    : active
      ? "font-semibold text-(--ink)"
      : "hover:text-(--ink)";
  // Accent underline marks the active route in both tones.
  const mark = active ? "underline decoration-(--accent) decoration-2 underline-offset-8" : "";
  return [base, tone, mark].filter(Boolean).join(" ");
}

/**
 * Primary site navigation strip — single source of truth for the top-nav links,
 * shared by SiteHeader (content routes) and App.tsx (home/legal). Marks the
 * active route with `aria-current="page"` + an accent underline.
 *
 * Mobile: a single swipeable row (`overflow-x-auto`, no wrap) so 12 links don't
 * stack into four cramped rows; sm+ wraps and centers like before.
 *
 * `pathname` is optional — callers that already track it (App.tsx) pass it for
 * reactivity; SiteHeader omits it and we read `window.location` on mount (it
 * remounts per route, so this stays fresh).
 */
export function PrimaryNav({ pathname }: { pathname?: string }) {
  const current = pathname ?? readPathname();
  return (
    <nav aria-label="Navegación principal" className="border-border border-t">
      <ScrollShadow className="px-4 py-2.5 lg:px-5" hideScrollBar orientation="horizontal">
        <div className="flex flex-nowrap items-center justify-start gap-x-5 gap-y-2 text-(--ink-muted) text-sm sm:flex-wrap sm:justify-center">
          {primaryNav.map((item) => {
            const active = isNavItemActive(item, current);
            return (
              <Link
                key={item.href}
                aria-current={active ? "page" : undefined}
                className={linkClass(item, active)}
                href={item.href}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </ScrollShadow>
    </nav>
  );
}
