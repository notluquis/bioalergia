import { Link } from "@tanstack/react-router";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";
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
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "relative flex items-center rounded-xl transition-all duration-200 ease-in-out",
                isMobile
                  ? "w-full justify-start px-4 py-3"
                  : "mx-auto h-12 w-12 justify-center p-0",
                isActive
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-base-content/60 hover:text-base-content hover:bg-base-content/5",
              )}
            >
              {/* Active Indicator */}
              {isActive && (
                <span
                  className={cn(
                    "bg-primary absolute rounded-full transition-all duration-300",
                    isMobile
                      ? "top-1/2 left-0 h-6 w-1 -translate-y-1/2"
                      : "top-2 -right-0.5 h-8 w-1",
                  )}
                />
              )}

              {/* Icon */}
              <item.icon
                className={cn(
                  "h-6 w-6 transform-gpu transition-transform duration-200 will-change-transform",
                  isActive ? "scale-110" : "group-hover:scale-110",
                )}
                strokeWidth={isActive ? 2.5 : 2}
              />

              {/* Label (Mobile only, hidden on Slim Desktop) */}
              {isMobile && <span className="ml-4 text-sm font-medium">{item.label}</span>}
            </div>
          </TooltipTrigger>
          {!isMobile && (
            <TooltipContent
              className="bg-base-300 border-base-200 text-base-content z-100 px-3 py-1.5 text-xs font-bold shadow-xl"
              side="right"
              sideOffset={12}
            >
              {item.label}
            </TooltipContent>
          )}
        </Tooltip>
      )}
    </Link>
  );
}
