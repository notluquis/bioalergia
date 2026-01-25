import { Link } from "@tanstack/react-router";
import { Tooltip } from "@/components/ui/Tooltip";
import type { NavItem } from "@/lib/nav-generator";
import { cn } from "@/lib/utils";

interface SidebarItemProps {
  readonly isMobile: boolean;
  readonly item: NavItem;
  readonly onNavigate: () => void;
}

export function SidebarItem({ isMobile, item, onNavigate }: SidebarItemProps) {
  return (
    <Link
      activeOptions={{ exact: item.to === "/" }}
      className="group outline-none select-none"
      onClick={() => {
        onNavigate();
      }}
      to={item.to as "/"}
    >
      {({ isActive }) => (
        <Tooltip
          classNames={{
            content:
              "bg-default-100 border-default-100 text-foreground z-100 px-3 py-1.5 text-xs font-bold shadow-xl",
          }}
          content={!isMobile ? item.label : null}
          delay={0}
          isDisabled={isMobile}
          offset={12}
          placement="right"
        >
          <div
            className={cn(
              "relative flex items-center rounded-xl transition-all duration-200 ease-in-out",
              isMobile ? "w-full justify-start px-4 py-3" : "mx-auto h-12 w-12 justify-center p-0",
              isActive
                ? "bg-primary/10 text-primary font-semibold"
                : "text-default-500 hover:text-foreground hover:bg-default-50",
            )}
          >
            {/* Active Indicator */}
            {isActive && (
              <span
                className={cn(
                  "bg-primary absolute rounded-full transition-all duration-300",
                  isMobile ? "top-1/2 left-0 h-6 w-1 -translate-y-1/2" : "top-2 right-0 h-7 w-1",
                )}
              />
            )}

            {/* Icon */}
            <item.icon
              className="h-6 w-6 transition-transform duration-200"
              strokeWidth={isActive ? 2.5 : 2}
            />

            {/* Label (Mobile only, hidden on Slim Desktop) */}
            {isMobile && <span className="ml-4 text-sm font-medium">{item.label}</span>}
          </div>
        </Tooltip>
      )}
    </Link>
  );
}
