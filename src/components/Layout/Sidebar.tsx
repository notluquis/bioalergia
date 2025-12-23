import React, { useMemo } from "react";
import { NavLink, useLocation, useNavigation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useCan } from "@/hooks/useCan";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { NAV_SECTIONS, type NavItem } from "@/config/navigation";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/Tooltip";

interface SidebarProps {
  isOpen: boolean; // For mobile drawer state
  isMobile: boolean;
  onClose?: () => void;
}

// Sub-component for individual Nav Items to keep main component clean
const SidebarItem = React.memo(function SidebarItem({
  item,
  isCollapsed,
  isMobile,
  pendingPath,
  locationPath,
  onNavigate,
}: {
  item: NavItem;
  isCollapsed: boolean;
  isMobile: boolean;
  pendingPath: string | null;
  locationPath: string;
  onNavigate: () => void;
}) {
  const navigation = useNavigation();
  const isPending = pendingPath === item.to || (navigation.state === "loading" && pendingPath === item.to);

  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <NavLink
          to={item.to}
          end={item.exact}
          onClick={() => {
            if (locationPath !== item.to) onNavigate(); // Notify parent of nav intent (sets pending)
          }}
          className={({ isActive }) => {
            const finalActive = isActive || isPending;
            return cn(
              "group relative flex items-center rounded-xl transition-all duration-200 ease-in-out outline-none select-none",
              // Mobile vs Desktop styling
              isMobile
                ? "w-full justify-start px-4 py-3"
                : isCollapsed
                  ? "mx-auto h-9 w-9 justify-center p-0"
                  : "w-full justify-start px-3 py-2.5",
              finalActive
                ? "bg-primary/10 text-primary font-semibold"
                : "text-base-content/60 hover:text-base-content hover:bg-base-content/5"
            );
          }}
        >
          {({ isActive }) => {
            const finalActive = isActive || isPending;
            return (
              <>
                {/* Active Indicator (Vertical Bar for Expanded/Mobile) */}
                {finalActive && (!isCollapsed || isMobile) && (
                  <span className="bg-primary absolute top-1/2 left-0 h-5 w-1 -translate-y-1/2 rounded-r-full" />
                )}

                {/* Icon Container */}
                <div
                  className={cn(
                    "relative flex items-center justify-center transition-colors duration-200",
                    isMobile ? "mr-4" : isCollapsed ? "mr-0" : "mr-3"
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-5 w-5 transition-transform duration-200",
                      finalActive ? "scale-105" : "group-hover:scale-105"
                    )}
                    strokeWidth={finalActive ? 2.5 : 2}
                  />

                  {/* Active Dot for Collapsed State (replaces bar when collapsed) */}
                  {!isMobile && isCollapsed && finalActive && (
                    <span className="bg-primary absolute top-0 -right-1 h-2 w-2 rounded-full shadow-sm ring-2 ring-white dark:ring-black" />
                  )}
                </div>

                {/* Label */}
                <span
                  className={cn(
                    "bg-transparent text-sm whitespace-nowrap",
                    !isMobile && isCollapsed ? "hidden" : "block"
                  )}
                >
                  {item.label}
                </span>

                {/* Loading Spinner */}
                {isPending && (
                  <div className={cn("absolute right-3", !isMobile && isCollapsed ? "top-1 right-1" : "")}>
                    <Loader2 className="h-3 w-3 animate-spin opacity-50" />
                  </div>
                )}
              </>
            );
          }}
        </NavLink>
      </TooltipTrigger>
      {/* Tooltip only on Desktop Collapsed - force close when expanded */}
      {!isMobile && (
        <TooltipContent
          side="right"
          sideOffset={10}
          hidden={!isCollapsed}
          className="bg-base-300 border-base-200 text-base-content z-100 px-3 py-1.5 font-semibold shadow-xl"
        >
          {item.label}
        </TooltipContent>
      )}
    </Tooltip>
  );
});

export default function Sidebar({ isOpen, isMobile, onClose }: SidebarProps) {
  const { user } = useAuth();
  const { can } = useCan();
  const location = useLocation();
  const [pendingPath, setPendingPath] = React.useState<string | null>(null);

  // Desktop Hover Collapse State
  // Default to collapsed (true)
  const [isCollapsed, setIsCollapsed] = React.useState(true);
  const [isHovered, setIsHovered] = React.useState(false);

  // Debounced expansion to avoid flickering
  React.useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isHovered) {
      // Expand quickly but not instantly
      timer = setTimeout(() => setIsCollapsed(false), 150);
    } else {
      // Collapse
      timer = setTimeout(() => setIsCollapsed(true), 300);
    }
    return () => clearTimeout(timer);
  }, [isHovered]);

  // Clear pending path on route change
  React.useEffect(() => {
    setPendingPath(null);
  }, [location.pathname]);

  const handleNavigate = (path: string) => {
    setPendingPath(path);
    if (isMobile && onClose) onClose();
  };

  const visibleSections = useMemo(() => {
    return NAV_SECTIONS.map((section) => {
      const filteredItems = section.items.filter((item) => {
        if (item.requiredPermission && !can(item.requiredPermission.action, item.requiredPermission.subject)) {
          return false;
        }
        return true;
      });
      return { ...section, items: filteredItems };
    }).filter((section) => section.items.length > 0);
  }, [can]);

  const displayName = user?.name || user?.email?.split("@")[0] || "Usuario";

  // Sidebar Classes
  const sidebarClasses = cn(
    // Base - GPU-accelerated transitions only (transform, opacity)
    // Rounded corners on the right side for modern look
    // Base - GPU-accelerated transitions
    // Removed backdrop-blur-xl as it causes massive repaints during width animation
    "flex flex-col bg-base-100 border-base-200 transition-[width] duration-300 ease-in-out z-50 will-change-[width] transform-gpu",
    // Mobile
    isMobile
      ? cn(
          "fixed inset-y-0 left-0 w-64 h-[100dvh] shadow-2xl safe-area-left rounded-r-3xl border-r",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )
      : cn(
          // Desktop
          "h-full rounded-2xl border shadow-xl",
          isCollapsed ? "w-16" : "w-64"
        )
  );

  return (
    <TooltipProvider delayDuration={0}>
      {/* Mobile Overlay */}
      {isMobile && isOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      )}

      <aside
        className={sidebarClasses}
        onMouseEnter={() => !isMobile && setIsHovered(true)}
        onMouseLeave={() => !isMobile && setIsHovered(false)}
        aria-label="Navegación principal"
      >
        {/* Header / Logo */}
        <div
          className={cn(
            "flex h-16 shrink-0 items-center transition-all duration-300",
            !isMobile && isCollapsed ? "justify-center px-0" : "gap-3 px-5"
          )}
        >
          {/* Logo Container */}
          <div
            className={cn(
              "relative flex items-center transition-all duration-300",
              !isMobile && isCollapsed ? "h-10 w-10 justify-center" : "h-12 w-full justify-center"
            )}
          >
            <img
              src="/logo.png"
              alt="Bioalergia"
              className={cn(
                "object-contain transition-all duration-300",
                !isMobile && isCollapsed ? "h-8 w-8" : "h-10 w-auto"
              )}
              fetchPriority="high"
            />
          </div>
        </div>

        {/* Navigation Content - Native scrollbar behavior */}
        <div className="flex-1 space-y-4 overflow-x-hidden overflow-y-auto px-2 py-2">
          {visibleSections.map((section) => (
            <div key={section.title} className="space-y-1">
              {/* Section Title */}
              <div
                className={cn(
                  "flex items-center px-4 pb-1 transition-all duration-300",
                  !isMobile && isCollapsed ? "h-0 overflow-hidden opacity-0" : "h-auto opacity-100"
                )}
              >
                <h3 className="text-base-content/50 text-[10px] font-bold tracking-[0.2em] uppercase">
                  {section.title}
                </h3>
              </div>

              {/* Section Items */}
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <SidebarItem
                    key={item.to}
                    item={item}
                    isCollapsed={!isMobile && isCollapsed}
                    isMobile={isMobile}
                    pendingPath={pendingPath}
                    locationPath={location.pathname}
                    onNavigate={() => handleNavigate(item.to)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* User Footer - Pinned to bottom, aligned with main footer */}
        <div
          className={cn(
            "border-base-200/50 bg-base-100/30 mt-auto shrink-0 border-t px-3 pt-3 pb-6 transition-all duration-300",
            !isMobile && isCollapsed ? "items-center justify-center px-2 pt-3 pb-6" : ""
          )}
        >
          <div
            className={cn(
              "hover:bg-base-200/50 group flex cursor-pointer items-center gap-3 rounded-2xl p-2 transition-all",
              !isMobile && isCollapsed ? "justify-center p-0 hover:bg-transparent" : "px-3 py-2"
            )}
          >
            <div className="bg-base-200 border-base-300 h-10 w-10 shrink-0 overflow-hidden rounded-full border">
              <div className="bg-base-100 text-primary flex h-full w-full items-center justify-center font-bold">
                {displayName.substring(0, 2).toUpperCase()}
              </div>
            </div>

            <div
              className={cn(
                "flex min-w-0 flex-1 flex-col gap-0.5 transition-all duration-300",
                !isMobile && isCollapsed ? "hidden" : "block"
              )}
            >
              <span className="text-base-content group-hover:text-primary truncate text-sm font-semibold transition-colors">
                {displayName}
              </span>
              <span className="text-base-content/50 truncate text-xs">{user?.email}</span>
            </div>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
