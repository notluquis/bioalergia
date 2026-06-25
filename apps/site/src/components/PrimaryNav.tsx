import { Link, ScrollShadow } from "@heroui/react";
import { ChevronDown } from "lucide-react";

import { Container } from "@/components/ui/Container";
import { headerNav, type NavLink, type NavNode, primaryNav } from "@/data/navigation";
import { isNavItemActive } from "@/lib/nav-active";

/** SSR-safe read of the current pathname (static prerender has no window). */
function readPathname(): string {
  return typeof window === "undefined" ? "/" : window.location.pathname;
}

function leafClass(active: boolean): string {
  const base = "whitespace-nowrap no-underline transition-colors";
  return active
    ? `${base} font-semibold text-foreground underline decoration-brand-amber decoration-2 underline-offset-8`
    : `${base} text-muted hover:text-foreground`;
}

/** A group node renders a hover/focus dropdown of its children. */
function NavGroup({ node, current }: { node: NavNode; current: string }) {
  const groupActive = node.children?.some((c) => isNavItemActive(c, current)) ?? false;
  return (
    <div className="group relative">
      <button
        className={`inline-flex items-center gap-1 whitespace-nowrap transition-colors ${
          groupActive ? "font-semibold text-foreground" : "text-muted hover:text-foreground"
        }`}
        type="button"
      >
        {node.label}
        <ChevronDown
          aria-hidden="true"
          className="size-3.5 transition-transform group-hover:rotate-180"
        />
      </button>
      {/* `pt-3` is the hover bridge so the menu doesn't close in the gap. */}
      <div className="invisible absolute left-1/2 top-full z-50 -translate-x-1/2 pt-3 opacity-0 transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
        <ul className="min-w-[208px] rounded-xl border border-line bg-surface p-2 shadow-[0_18px_50px_rgba(27,42,60,0.16)]">
          {node.children?.map((c) => {
            const active = isNavItemActive(c, current);
            return (
              <li key={c.href}>
                <Link
                  aria-current={active ? "page" : undefined}
                  className={`block rounded-lg px-3 py-2 text-sm no-underline transition-colors ${
                    active
                      ? "bg-chip font-semibold text-brand-blue"
                      : "text-foreground hover:bg-surface-2"
                  }`}
                  href={c.href}
                >
                  {c.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/**
 * Primary site navigation. Desktop (lg+): a compact centred strip where
 * "Sobre nosotros" and "Recursos" open hover/focus dropdowns (no overflow so
 * the menus aren't clipped). Mobile: a single swipeable row of every link.
 * Marks the active route with an amber underline / highlighted item.
 */
export function PrimaryNav({ pathname }: { pathname?: string }) {
  const current = pathname ?? readPathname();
  return (
    <nav aria-label="Navegación principal" className="border-line border-t">
      {/* Desktop: compact dropdown nav */}
      <Container className="hidden lg:block">
        <div className="flex items-center justify-center gap-7 py-[11px] text-[0.9rem]">
          {headerNav.map((node) =>
            node.children ? (
              <NavGroup key={node.label} current={current} node={node} />
            ) : (
              <Link
                key={node.href}
                aria-current={
                  node.href && isNavItemActive(node as NavLink, current) ? "page" : undefined
                }
                className={leafClass(node.href ? isNavItemActive(node as NavLink, current) : false)}
                href={node.href ?? "/"}
              >
                {node.label}
              </Link>
            )
          )}
        </div>
      </Container>

      {/* Mobile/tablet: swipeable flat strip of every link */}
      <Container className="px-0 lg:hidden">
        <ScrollShadow className="px-5 py-[11px] sm:px-8" hideScrollBar orientation="horizontal">
          <div className="flex flex-nowrap items-center gap-x-6 text-[0.9rem]">
            {primaryNav.map((item) => {
              const active = isNavItemActive(item, current);
              return (
                <Link
                  key={item.href}
                  aria-current={active ? "page" : undefined}
                  className={
                    item.accent
                      ? "whitespace-nowrap font-semibold text-brand-amber no-underline"
                      : leafClass(active)
                  }
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
