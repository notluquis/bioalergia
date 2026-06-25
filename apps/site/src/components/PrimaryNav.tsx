import { Link, ScrollShadow } from "@heroui/react";

import { Container } from "@/components/ui/Container";
import { type NavLink, primaryNav } from "@/data/navigation";
import { isNavItemActive } from "@/lib/nav-active";

/** SSR-safe read of the current pathname (static prerender has no window). */
function readPathname(): string {
  return typeof window === "undefined" ? "/" : window.location.pathname;
}

function linkClass(item: NavLink, active: boolean): string {
  const base = "whitespace-nowrap no-underline transition-colors";
  const tone = item.accent
    ? "font-semibold text-brand-amber hover:text-foreground"
    : active
      ? "font-semibold text-foreground"
      : "text-muted hover:text-foreground";
  const mark = active ? "underline decoration-brand-amber decoration-2 underline-offset-8" : "";
  return [base, tone, mark].filter(Boolean).join(" ");
}

/**
 * Primary site navigation strip (editorial restyle) — single source of truth
 * for the top-nav links, shared by SiteHeader and App. Marks the active route
 * with `aria-current="page"` + an amber underline. Mobile: one swipeable row;
 * sm+ wraps and centers, aligned to the 1200px container.
 */
export function PrimaryNav({ pathname }: { pathname?: string }) {
  const current = pathname ?? readPathname();
  return (
    <nav aria-label="Navegación principal" className="border-line border-t">
      <Container className="px-0">
        <ScrollShadow
          className="px-5 py-[11px] sm:px-8 lg:px-10"
          hideScrollBar
          orientation="horizontal"
        >
          <div className="flex flex-nowrap items-center justify-start gap-x-7 gap-y-2 text-[0.9rem] sm:flex-wrap sm:justify-center">
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
      </Container>
    </nav>
  );
}
