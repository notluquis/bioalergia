import React, { useMemo } from "react";
import { NavLink, useLocation, useNavigation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useCan } from "@/hooks/useCan";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { NAV_SECTIONS, type NavItem } from "@/config/navigation";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/Tooltip";
import { APP_CONFIG } from "@/config/app";

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
              "group relative flex items-center rounded-xl transition-[width,transform,background-color] duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] outline-none select-none",
              // Mobile vs Desktop styling
              isMobile
                ? "w-full justify-start px-4 py-3"
                : isCollapsed
                  ? "mx-auto h-9 w-9 justify-center p-0"
                  : "w-full justify-start px-3 py-2.5",
              finalActive
                ? "bg-primary text-primary-content shadow-primary/30 font-medium shadow-md"
                : "text-base-content/70 hover:bg-base-content/5 hover:text-base-content hover:shadow-sm"
            );
          }}
        >
          {({ isActive }) => {
            const finalActive = isActive || isPending;
            return (
              <>
                {/* Icon Container */}
                <div
                  className={cn(
                    "relative flex items-center justify-center transition-transform duration-300 will-change-transform",
                    isMobile ? "mr-4" : isCollapsed ? "mr-0" : "mr-4",
                    finalActive && !isCollapsed ? "scale-105" : "group-hover:scale-110"
                  )}
                >
                  <item.icon className="h-5 w-5" strokeWidth={finalActive ? 2.5 : 2} />
                  {/* Active Dot for Collapsed State */}
                  {!isMobile && isCollapsed && finalActive && (
                    <span className="bg-primary ring-base-100 absolute top-0 right-0 h-2.5 w-2.5 animate-pulse rounded-full ring-2" />
                  )}
                </div>

                {/* Label (Desktop Collapsed: Hidden / Expanded: Visible) */}
                <span
                  className={cn(
                    "text-sm font-medium whitespace-nowrap transition-[opacity,transform,width] duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] will-change-transform",
                    // Desktop Logic
                    !isMobile && isCollapsed
                      ? "absolute w-0 -translate-x-4 overflow-hidden opacity-0" // Absolute to remove from flow
                      : "static w-auto translate-x-0 opacity-100"
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
      {/* Tooltip only on Desktop Collapsed */}
      {!isMobile && isCollapsed && (
        <TooltipContent
          side="right"
          sideOffset={10}
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
      // Expand quickly
      timer = setTimeout(() => setIsCollapsed(false), 50);
    } else {
      // Collapse
      timer = setTimeout(() => setIsCollapsed(true), 200);
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
    // Base - optimized ease & height for MacOS/Safari (dvh)
    "flex flex-col bg-base-100/95 backdrop-blur-2xl border-r border-base-200 transition-[width,transform] duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] z-50 will-change-transform",
    // Mobile
    isMobile
      ? cn(
          "fixed inset-y-0 left-0 w-[280px] h-[100dvh] shadow-2xl safe-area-left",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )
      : cn(
          // Desktop
          "sticky top-0 h-[100dvh]", // Use 100dvh to handle dynamic viewport height correctly
          isCollapsed ? "w-[80px]" : "w-[280px]", // Increased widths for breathing room
          "shadow-2xl"
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
          {/* Logo Container with Glow */}
          <div className="from-primary/10 to-secondary/10 relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/5 bg-linear-to-br shadow-sm">
            <img
              src="/logo_bimi.svg"
              alt="Logo"
              className="brand-logo z-10 h-7 w-7 object-contain"
              fetchPriority="high"
            />
          </div>

          {/* Brand Text */}
          <div
            className={cn(
              "flex min-w-37.5 flex-col overflow-hidden transition-all duration-300",
              !isMobile && isCollapsed ? "pointer-events-none absolute w-0 opacity-0" : "static w-auto opacity-100"
            )}
          >
            <span className="text-base-content text-xl leading-none font-extrabold tracking-tight">
              {APP_CONFIG.name}
            </span>
          </div>
        </div>

        {/* Navigation Content - The ONLY scrollable area */}
        <div className="scrollbar-thin scrollbar-thumb-base-300 scrollbar-track-transparent flex-1 space-y-8 overflow-x-hidden overflow-y-auto px-3 py-2">
          {visibleSections.map((section) => (
            <div key={section.title} className="space-y-2">
              {/* Section Title */}
              <div
                className={cn(
                  "flex items-center px-4 pb-1 transition-all duration-300",
                  !isMobile && isCollapsed ? "h-0 overflow-hidden opacity-0" : "h-auto opacity-100"
                )}
              >
                <h3 className="text-base-content/30 text-[10px] font-bold tracking-[0.2em] uppercase">
                  {section.title}
                </h3>
              </div>

              {/* Section Items */}
              <div className="space-y-1">
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

        {/* User Footer - Pinned to bottom */}
        <div
          className={cn(
            "border-base-200/50 bg-base-100/30 shrink-0 border-t p-4 transition-all duration-300",
            !isMobile && isCollapsed ? "items-center justify-center px-0 py-4" : ""
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
                "flex min-w-35 flex-col transition-all duration-300",
                !isMobile && isCollapsed ? "absolute w-0 overflow-hidden opacity-0" : "static w-auto opacity-100"
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
