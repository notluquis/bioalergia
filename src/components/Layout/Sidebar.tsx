import React from "react";
import { NavLink, useLocation, useNavigation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useCan } from "@/hooks/useCan";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { NAV_SECTIONS } from "@/config/navigation";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/Tooltip";
import { APP_CONFIG } from "@/config/app";

interface SidebarProps {
  isOpen: boolean;
  isMobile: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen, isMobile, onClose }: SidebarProps) {
  const { user } = useAuth();
  const { can } = useCan();
  const navigation = useNavigation();
  const location = useLocation();
  const [pendingPath, setPendingPath] = React.useState<string | null>(null);

  // Local state for collapse behavior (Desktop only)
  const [isCollapsed, setIsCollapsed] = React.useState(true);

  // Use full name from backend, fallback to email prefix
  const displayName = user?.name || user?.email?.split("@")[0] || "Usuario";

  React.useEffect(() => {
    // Clear manual pending once the URL actually changed
    setPendingPath(null);
  }, [location.pathname]);

  const handleMouseEnter = () => {
    if (!isMobile) setIsCollapsed(false);
  };

  const handleMouseLeave = () => {
    if (!isMobile) setIsCollapsed(true);
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        id="app-sidebar"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          "border-base-300/50 bg-base-200/80 text-base-content z-50 flex shrink-0 flex-col rounded-3xl border text-sm shadow-2xl backdrop-blur-3xl transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
          // Mobile: VS Desktop Layout
          isMobile
            ? "fixed inset-y-0 left-0 z-[100] h-full"
            : "hidden md:sticky md:top-4 md:flex md:h-[calc(100dvh-2rem)]",
          // Mobile: Drawer transform
          isMobile && !isOpen ? "-translate-x-full" : "translate-x-0",
          // Desktop: Width Transition
          !isMobile && isCollapsed ? "w-20 px-2 py-2" : "w-[260px] p-3",
          "overflow-x-hidden"
        )}
        aria-label="Navegación principal"
      >
        <div className="flex h-full flex-col gap-2 overflow-hidden">
          {/* User Profile / Brand Card */}
          <div
            className={cn(
              "border-base-300/40 from-base-100/85 via-base-200/70 to-base-100/50 relative flex items-center overflow-hidden rounded-2xl border bg-linear-to-br shadow-inner transition-all duration-300",
              !isMobile && isCollapsed ? "justify-center p-1.5" : "gap-3 p-2 px-3"
            )}
          >
            <div className="bg-base-100/80 border-base-300 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-sm">
              <img src="/logo_bimi.svg" alt="Bioalergia" className="h-7 w-7 object-contain" loading="lazy" />
            </div>

            {/* Text Content - Fluid Reveal */}
            <div
              className={cn(
                "flex min-w-0 flex-col overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out",
                !isMobile && isCollapsed ? "w-0 opacity-0 md:hidden" : "w-auto opacity-100"
              )}
            >
              <span className="truncate text-sm leading-tight font-semibold">{displayName}</span>
              <span className="text-base-content/60 truncate text-[10px]">{user?.email}</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="muted-scrollbar flex-1 space-y-4 overflow-x-hidden overflow-y-auto py-2 contain-layout">
            <div className="space-y-1">
              {NAV_SECTIONS.map((section) => {
                const visibleItems = section.items.filter((item) => {
                  if (item.requiredPermission && !can(item.requiredPermission.action, item.requiredPermission.subject))
                    return false;
                  return true;
                });
                if (!visibleItems.length) return null;

                return (
                  <section key={section.title} className="space-y-0.5">
                    {/* Section Title - Fades out on collapse */}
                    <div
                      className={cn(
                        "mb-1 overflow-hidden px-3 whitespace-nowrap transition-all duration-300",
                        !isMobile && isCollapsed ? "h-0 py-0 opacity-0" : "h-auto opacity-100"
                      )}
                    >
                      <p className="text-base-content/50 truncate text-[10px] font-bold tracking-widest uppercase">
                        {section.title}
                      </p>
                    </div>

                    <div className="space-y-1">
                      {visibleItems.map((item) => {
                        const isPending =
                          pendingPath === item.to || (navigation.state === "loading" && pendingPath === item.to);

                        return (
                          <Tooltip key={item.to} delayDuration={300}>
                            <TooltipTrigger asChild>
                              <NavLink
                                to={item.to}
                                end={item.exact}
                                onClick={() => {
                                  if (location.pathname !== item.to) setPendingPath(item.to);
                                  if (isMobile && onClose) onClose();
                                }}
                                className={({ isActive }) => {
                                  const finalActive = isActive || isPending;

                                  return cn(
                                    "group relative my-0.5 flex items-center rounded-xl transition-all duration-200 outline-none",
                                    !isMobile && isCollapsed
                                      ? "mx-auto w-10 justify-center px-0 py-2.5"
                                      : "w-full px-3 py-2.5",
                                    finalActive
                                      ? "bg-primary text-primary-content shadow-primary/80 shadow-md"
                                      : "text-base-content/70 hover:bg-base-100 hover:text-base-content hover:shadow-sm"
                                  );
                                }}
                              >
                                {({ isActive }) => {
                                  // NavLink's isActive + our local pending state
                                  const finalActive = isActive || isPending;

                                  return (
                                    <>
                                      <div
                                        className={cn(
                                          "flex shrink-0 items-center justify-center transition-colors duration-200",
                                          "h-5 w-5"
                                        )}
                                      >
                                        <item.icon
                                          className={cn(
                                            "h-5 w-5 transition-transform duration-200",
                                            finalActive ? "scale-110" : "group-hover:scale-110"
                                          )}
                                        />
                                      </div>

                                      <span
                                        className={cn(
                                          "overflow-hidden text-sm font-medium whitespace-nowrap transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
                                          !isMobile && isCollapsed
                                            ? "w-0 translate-x-4 opacity-0"
                                            : "ml-3 w-auto translate-x-0 opacity-100"
                                        )}
                                      >
                                        {item.label}
                                      </span>

                                      {isPending && <Loader2 className="ml-auto h-3 w-3 animate-spin opacity-50" />}

                                      {/* Active Indicator Dot (collapsed only) */}
                                      {!isMobile && isCollapsed && finalActive && (
                                        <div className="bg-primary shadow-primary/80 absolute top-1/2 right-1 h-1.5 w-1.5 -translate-y-1/2 rounded-full shadow-md" />
                                      )}
                                    </>
                                  );
                                }}
                              </NavLink>
                            </TooltipTrigger>
                            {/* Only show tooltip content when collapsed */}
                            {!isMobile && isCollapsed && (
                              <TooltipContent
                                side="right"
                                className="bg-base-300 text-base-content border-base-200 font-medium"
                                sideOffset={10}
                              >
                                {item.label}
                              </TooltipContent>
                            )}
                          </Tooltip>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          </nav>

          {/* Footer / Version Info */}
          <div
            className={cn(
              "text-base-content/40 mt-auto overflow-hidden text-center text-[10px] whitespace-nowrap transition-all duration-300",
              !isMobile && isCollapsed ? "h-0 opacity-0" : "h-auto py-2 opacity-100"
            )}
          >
            {APP_CONFIG.name} v{APP_CONFIG.version}
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
