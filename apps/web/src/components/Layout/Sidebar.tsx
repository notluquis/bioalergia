import { Link, useLocation, useRouterState } from "@tanstack/react-router";
import { LogOut, User } from "lucide-react";
import React from "react";

import Backdrop from "@/components/ui/Backdrop";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/Tooltip";
import { useAuth } from "@/context/AuthContext";
import { useCan } from "@/hooks/useCan";
import { getNavSections, type NavItem } from "@/lib/nav-generator";
import { cn } from "@/lib/utils";

interface SidebarProps {
  isOpen: boolean; // For mobile drawer state
  isMobile: boolean;
  onClose?: () => void;
}

// Sub-component for individual Nav Items to keep main component clean
function SidebarItem({
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
  const routerStatus = useRouterState({ select: (s) => s.status });
  const isPending = pendingPath === item.to || (routerStatus === "pending" && pendingPath === item.to);

  // Check if this link is currently active
  const isActive = locationPath === item.to || locationPath.startsWith(`${item.to}/`);
  const finalActive = isActive || isPending;

  const getLinkClasses = () => {
    const base =
      "group relative flex items-center rounded-xl transition-all duration-200 ease-in-out outline-none select-none";
    let sizing = "w-full justify-start px-3 py-2.5";

    if (isMobile) {
      sizing = "w-full justify-start px-4 py-3";
    } else if (isCollapsed) {
      sizing = "mx-auto h-9 w-9 justify-center p-0";
    }

    const coloring = finalActive
      ? "bg-primary/10 text-primary font-semibold"
      : "text-base-content/60 hover:text-base-content hover:bg-base-content/5";

    return cn(base, sizing, coloring);
  };

  const linkClassName = getLinkClasses();

  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <Link
          to={item.to as "/"}
          onClick={() => {
            if (locationPath !== item.to) onNavigate();
          }}
          className={linkClassName}
        >
          {/* Active Indicator (Vertical Bar for Expanded/Mobile) */}
          {finalActive && (!isCollapsed || isMobile) && (
            <span className="bg-primary absolute top-1/2 left-0 h-5 w-1 -translate-y-1/2 rounded-r-full" />
          )}

          {/* Icon Container */}
          <div
            className={cn(
              "relative flex items-center justify-center transition-colors duration-200",
              getIconMargin(isMobile, isCollapsed)
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
            className={cn("bg-transparent text-sm whitespace-nowrap", !isMobile && isCollapsed ? "hidden" : "block")}
          >
            {item.label}
          </span>
        </Link>
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
}

function getIconMargin(isMobile: boolean, isCollapsed: boolean) {
  if (isMobile) return "mr-4";
  return isCollapsed ? "mr-0" : "mr-3";
}

export default function Sidebar({ isOpen, isMobile, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const { can } = useCan();
  const location = useLocation();
  const [pendingPath, setPendingPath] = React.useState<string | null>(null);

  // Desktop Hover Collapse State
  // Default to collapsed (true)
  const [isCollapsed, setIsCollapsed] = React.useState(true);
  const [isHovered, setIsHovered] = React.useState(false);

  // Debounced expansion to avoid flickering
  React.useEffect(() => {
    const timeoutMs = isHovered ? 150 : 300;
    const timer = setTimeout(() => setIsCollapsed(!isHovered), timeoutMs);
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

  const visibleSections = getNavSections()
    .map((section) => {
      const filteredItems = section.items.filter((item) => {
        return !(item.requiredPermission && !can(item.requiredPermission.action, item.requiredPermission.subject));
      });
      return { ...section, items: filteredItems };
    })
    .filter((section) => section.items.length > 0);

  const displayName = user?.name || user?.email?.split("@")[0] || "Usuario";

  // Sidebar Classes

  return (
    <TooltipProvider delayDuration={0}>
      <Backdrop isVisible={isMobile && isOpen} onClose={onClose} zIndex={40} />

      {/* Lint disabled: This is a pure UI hover zone for expanding sidebar, not semantically interactive */}
      {}
      <div
        role="presentation"
        // Tab index -1 ensures it's not in tab order
        tabIndex={-1}
        onMouseEnter={() => !isMobile && setIsHovered(true)}
        onMouseLeave={() => !isMobile && setIsHovered(false)}
        className={cn(
          "z-50 h-full transform-gpu transition-[width] duration-300 ease-in-out will-change-[width]",
          isMobile
            ? "safe-area-left fixed inset-y-0 left-0 w-64 rounded-r-3xl border-r shadow-2xl"
            : "bg-base-100 border-base-200 relative rounded-2xl border shadow-xl",
          !isMobile && (isCollapsed ? "w-16" : "w-64"),
          isMobile && (isOpen ? "translate-x-0" : "-translate-x-full")
        )}
      >
        <aside className="flex h-full w-full flex-col overflow-hidden" aria-label="Navegación principal">
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

          {/* User Footer - Pinned to bottom, with dropdown menu */}
          <div
            className={cn(
              "border-base-200/50 bg-base-100/30 mt-auto shrink-0 border-t px-3 pt-3 pb-6 transition-all duration-300",
              !isMobile && isCollapsed ? "items-center justify-center px-2 pt-3 pb-6" : ""
            )}
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "hover:bg-base-200/50 group flex w-full cursor-pointer items-center gap-3 rounded-2xl p-2 transition-all outline-none",
                    !isMobile && isCollapsed ? "justify-center p-0 hover:bg-transparent" : "px-3 py-2"
                  )}
                >
                  <div className="bg-base-200 border-base-300 h-10 w-10 shrink-0 overflow-hidden rounded-full border">
                    <div className="bg-base-100 text-primary flex h-full w-full items-center justify-center font-bold">
                      {displayName.slice(0, 2).toUpperCase()}
                    </div>
                  </div>

                  <div
                    className={cn(
                      "flex min-w-0 flex-1 flex-col gap-0.5 text-left transition-all duration-300",
                      !isMobile && isCollapsed ? "hidden" : "block"
                    )}
                  >
                    <span className="text-base-content group-hover:text-primary truncate text-sm font-semibold transition-colors">
                      {displayName}
                    </span>
                    <span className="text-base-content/50 truncate text-xs">{user?.email}</span>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm leading-none font-medium">{displayName}</p>
                    <p className="text-base-content/60 text-xs leading-none">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/account" className="flex cursor-pointer items-center">
                    <User className="mr-2 size-4" />
                    Mi Cuenta
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => logout()}
                  className="text-error focus:bg-error/10 focus:text-error cursor-pointer"
                >
                  <LogOut className="mr-2 size-4" />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </aside>
      </div>
    </TooltipProvider>
  );
}
