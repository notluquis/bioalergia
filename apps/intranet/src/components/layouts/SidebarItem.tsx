import { Tooltip } from "@heroui/react";
import { Link } from "@tanstack/react-router";
import type { NavItem } from "@/lib/nav-generator";
import { cn } from "@/lib/utils";

interface SidebarItemProps {
  readonly item: NavItem;
  readonly onNavigate: () => void;
}

/**
 * Sidebar nav row.
 *
 * Responsive via Tailwind utilities only — no `isMobile` JS prop. Mobile
 * defaults (`flex w-full justify-start px-4 py-3`) cover the Drawer
 * context (parent renders at <md viewport). `md:` overrides collapse
 * to the slim icon-only desktop rail (`size-12`, `mx-auto`, label
 * hidden). Tooltip is only enabled at `md+` to avoid intercepting
 * touch on the inline-label mobile variant; HeroUI React Aria
 * `isDisabled` accepts a boolean computed at render time from the
 * matchMedia hook, but for pure layout switches CSS wins.
 *
 * Golden 2026: don't pass viewport as prop. Couples component to
 * layout context, re-renders on resize, SSR hydration mismatch risk.
 * See https://heroui.com/docs/react/getting-started/styling and the
 * `useMediaQuery` rule of thumb — JS hook only when *behavior*
 * differs (different React subtree, mount/unmount), not for styling.
 */
export function SidebarItem({ item, onNavigate }: SidebarItemProps) {
  return (
    <Link
      activeOptions={{ exact: true, includeSearch: false }}
      className="group block min-w-0 select-none outline-none md:inline-block md:min-w-0"
      onClick={() => {
        onNavigate();
      }}
      to={item.to as "/"}
    >
      {({ isActive }) => (
        <Tooltip delay={0}>
          <Tooltip.Trigger aria-label={item.label}>
            <div
              className={cn(
                "relative flex w-full min-w-0 items-center justify-start rounded-xl px-4 py-3",
                "md:mx-auto md:justify-center md:p-0 md:size-12",
                isActive
                  ? "bg-primary/10 font-semibold text-primary"
                  : "text-default-600 hover:bg-default-50 hover:text-foreground"
              )}
            >
              {/* Active indicator — bar on the left (mobile) / right (desktop). */}
              {isActive && (
                <span
                  className={cn(
                    "absolute rounded-full bg-primary",
                    "top-1/2 left-0 h-6 w-1 -translate-y-1/2",
                    "md:top-2 md:right-0 md:left-auto md:h-7 md:w-1 md:translate-y-0"
                  )}
                />
              )}

              <item.icon className="size-6 shrink-0" strokeWidth={isActive ? 2.5 : 2} />

              {/* Inline label — visible mobile, hidden on slim desktop rail. */}
              <span className="ml-4 min-w-0 flex-1 truncate font-medium text-sm md:hidden">
                {item.label}
              </span>
            </div>
          </Tooltip.Trigger>
          {/* Tooltip is the desktop affordance for icon-only rail — hide
              on mobile so it doesn't intercept touch on the labeled
              inline variant. `hidden md:block` on Content keeps the
              accessible name on Trigger for SR users on both breakpoints. */}
          <Tooltip.Content
            className="hidden border-default-100 bg-default-100 px-3 py-1.5 font-bold text-foreground text-xs shadow-xl z-100 md:block"
            offset={12}
            placement="right"
          >
            {item.label}
          </Tooltip.Content>
        </Tooltip>
      )}
    </Link>
  );
}
