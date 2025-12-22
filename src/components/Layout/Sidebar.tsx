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
              "group relative flex items-center rounded-xl transition-all duration-300 ease-out outline-none select-none",
              // Mobile vs Desktop styling
              isMobile
                ? "w-full justify-start px-4 py-3"
                : isCollapsed
                  ? "mx-auto h-10 w-10 justify-center p-0"
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
                    "relative flex items-center justify-center transition-transform duration-300",
                    isMobile ? "mr-3" : isCollapsed ? "mr-0" : "mr-3",
                    finalActive && !isCollapsed ? "scale-105" : "group-hover:scale-110"
                  )}
                >
                  <item.icon className="h-5 w-5" strokeWidth={finalActive ? 2.5 : 2} />

                  {/* Active Dot for Collapsed State */}
                  {!isMobile && isCollapsed && finalActive && (
                    <span className="bg-primary ring-base-100 absolute -top-0.5 -right-0.5 h-2 w-2 animate-pulse rounded-full ring-2" />
                  )}
                </div>

                {/* Label (Desktop Collapsed: Hidden / Expanded: Visible) */}
                <span
                  className={cn(
                    "whitespace-nowrap transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]",
                    // Desktop Logic
                    !isMobile && isCollapsed
                      ? "absolute w-0 -translate-x-2.5 overflow-hidden opacity-0" // Absolute to remove from flow
                      : "static w-auto translate-x-0 opacity-100"
                  )}
                >
                  {item.label}
                </span>

                {/* Loading Spinner */}
                {isPending && (
                  <div className={cn("absolute right-2", !isMobile && isCollapsed ? "top-0 right-0" : "")}>
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
          className="bg-base-300 border-base-200 text-base-content z-100 font-medium"
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
      // Expand quickly but with slight delay to avoid accidental triggers
      timer = setTimeout(() => setIsCollapsed(false), 80);
    } else {
      // Collapse with delay
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
    // Base
    "flex flex-col bg-base-100/90 backdrop-blur-2xl border-r border-base-200 transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] z-50",
    // Mobile
    isMobile
      ? cn("fixed inset-y-0 left-0 w-[280px] h-full shadow-2xl", isOpen ? "translate-x-0" : "-translate-x-full")
      : cn(
          // Desktop
          "sticky top-0 h-screen",
          isCollapsed ? "w-[72px]" : "w-[260px]", // 72px aligns icons perfectly
          "shadow-xl"
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
            !isMobile && isCollapsed ? "justify-center px-0" : "gap-3 px-6"
          )}
        >
          {/* Logo Container with Glow */}
          <div className="from-primary/20 to-secondary/20 relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-linear-to-br shadow-inner">
            <img src="/logo_bimi.svg" alt="Logo" className="z-10 h-6 w-6 object-contain" />
            {/* Glow effect */}
            <div className="bg-primary/10 absolute inset-0 animate-pulse blur-lg" />
          </div>

          {/* Brand Text */}
          <div
            className={cn(
              "flex flex-col overflow-hidden transition-all duration-300",
              !isMobile && isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100"
            )}
          >
            <span className="from-base-content to-base-content/60 bg-linear-to-r bg-clip-text text-lg leading-none font-bold tracking-tight text-transparent">
              {APP_CONFIG.name}
            </span>
            <span className="text-base-content/50 ml-0.5 text-[10px] font-medium tracking-wider uppercase">
              v{APP_CONFIG.version}
            </span>
          </div>
        </div>

        {/* Navigation Content */}
        <div className="scrollbar-thin scrollbar-thumb-base-300 scrollbar-track-transparent flex-1 space-y-6 overflow-x-hidden overflow-y-auto px-3 py-4">
          {visibleSections.map((section) => (
            <div key={section.title} className="space-y-1">
              {/* Section Title */}
              <div
                className={cn(
                  "flex items-center px-3 pb-1 transition-all duration-300",
                  !isMobile && isCollapsed ? "h-0 overflow-hidden opacity-0" : "h-5 opacity-100"
                )}
              >
                <h3 className="text-base-content/40 text-[10px] font-bold tracking-widest uppercase">
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

              {/* Divider for cleaner separation if expanded */}
              {!isMobile && !isCollapsed && <div className="border-base-200/50 mx-3 my-2 border-t" />}
            </div>
          ))}
        </div>

        {/* User Footer */}
        <div
          className={cn(
            "border-base-200 bg-base-100/50 mt-auto shrink-0 border-t p-3 transition-all duration-300",
            !isMobile && isCollapsed ? "items-center justify-center border-t-0 bg-transparent" : ""
          )}
        >
          <div
            className={cn(
              "hover:bg-base-200/50 group flex cursor-pointer items-center gap-3 rounded-xl p-2 transition-colors",
              !isMobile && isCollapsed ? "justify-center p-0 hover:bg-transparent" : ""
            )}
          >
            <div className="from-primary to-secondary h-10 w-10 rounded-full bg-linear-to-tr p-0.5 shadow-lg">
              <div className="bg-base-100 flex h-full w-full items-center justify-center overflow-hidden rounded-full">
                {/* Initials as fallback */}
                <span className="text-primary text-sm font-bold">{displayName.substring(0, 2).toUpperCase()}</span>
              </div>
            </div>

            <div
              className={cn(
                "flex min-w-0 flex-col transition-all duration-300",
                !isMobile && isCollapsed ? "w-0 overflow-hidden opacity-0" : "w-auto opacity-100"
              )}
            >
              <span className="text-base-content group-hover:text-primary truncate text-sm font-semibold transition-colors">
                {displayName}
              </span>
              <span className="text-base-content/60 truncate text-xs">{user?.email}</span>
            </div>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
