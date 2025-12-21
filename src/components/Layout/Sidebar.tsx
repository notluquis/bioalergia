import React from "react";
import { NavLink, useLocation, useNavigation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useCan } from "@/hooks/useCan";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { NAV_SECTIONS } from "@/config/navigation";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/Tooltip";
import { APP_CONFIG } from "@/config/app";

// Removed local types definition in favor of types from config if needed,
// though here we just consume the exported constant.

interface SidebarProps {
  isOpen: boolean;
  isMobile: boolean;
  onClose?: () => void;
  isCollapsed?: boolean;
  toggleCollapse?: () => void;
}

export default function Sidebar({ isOpen, isMobile, onClose }: SidebarProps) {
  const { user } = useAuth();
  const { can } = useCan();
  const navigation = useNavigation();
  const location = useLocation();
  const [pendingPath, setPendingPath] = React.useState<string | null>(null);

  // Local state for collapse behavior (Desktop only)
  // Default to collapsed (true) as requested
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
          "border-base-300/50 bg-base-200/80 text-base-content fixed inset-y-0 left-0 z-50 flex h-full shrink-0 flex-col rounded-3xl border text-sm shadow-2xl backdrop-blur-3xl transition-all duration-300 md:fixed md:top-4 md:bottom-4 md:left-4 md:h-[calc(100dvh-2rem)] md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
          !isOpen && !isMobile && "hidden", // This line might hide it on desktop if isOpen is false (from mobile logic).
          // App.tsx passes sidebarOpen=true on desktop (line 44). So isOpen is true.

          isCollapsed ? "w-20" : "w-[min(300px,88vw)]",
          isCollapsed ? "px-1.5 py-2" : "p-2",
          "overflow-x-hidden" // Prevent horizontal scroll
        )}
        aria-label="Navegación principal"
      >
        <div className="flex h-full flex-col gap-2 overflow-hidden">
          {/* User Profile Card */}
          <div
            className={cn(
              "border-base-300/40 from-base-100/85 via-base-200/70 to-base-100/50 rounded-2xl border bg-linear-to-br shadow-inner transition-all",
              isCollapsed ? "p-1.5" : "p-2"
            )}
          >
            {isCollapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center justify-center">
                    <div className="bg-base-100/80 border-base-300 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-sm">
                      <img src="/logo_bimi.svg" alt="Bioalergia" className="h-7 w-7 object-contain" loading="lazy" />
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <div className="text-left">
                    <p className="font-semibold">{displayName}</p>
                    <p className="text-base-content/70 text-xs">{user?.email}</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            ) : (
              <div className="flex items-center gap-2">
                <div className="bg-base-100/80 border-base-300 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-sm">
                  <img
                    src="/logo_bimi.svg"
                    alt="Bioalergia"
                    className="h-7 w-7 object-contain"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <div className="min-w-0 overflow-hidden transition-all duration-300">
                  <p className="text-base-content truncate text-sm leading-tight font-semibold">{displayName}</p>
                  <p className="text-base-content/70 truncate text-xs">{APP_CONFIG.name}</p>
                </div>
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="muted-scrollbar flex-1 space-y-0.5 overflow-y-auto px-2 py-2 contain-layout">
            <div className="space-y-1">
              {NAV_SECTIONS.map((section) => {
                const visibleItems = section.items.filter((item) => {
                  if (item.requiredPermission && !can(item.requiredPermission.action, item.requiredPermission.subject))
                    return false;
                  return true;
                });
                if (!visibleItems.length) return null;

                return (
                  <section key={section.title} className={cn("space-y-0.5", isCollapsed && "text-center")}>
                    {!isCollapsed && (
                      <div className="mb-1 px-2">
                        <p className="text-base-content/60 text-[9px] font-bold tracking-widest uppercase">
                          {section.title}
                        </p>
                      </div>
                    )}

                    <div className="space-y-0.5">
                      {visibleItems.map((item) => {
                        const isPending =
                          pendingPath === item.to || (navigation.state === "loading" && pendingPath === item.to);
                        const alreadyHere =
                          location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);

                        return (
                          <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.exact}
                            onClick={() => {
                              if (!alreadyHere) setPendingPath(item.to);
                              if (isMobile && onClose) onClose();
                            }}
                            className={({ isActive }) => {
                              const active = isActive;
                              if (isCollapsed) {
                                return cn(
                                  "mx-auto flex h-9 w-9 items-center justify-center rounded-xl transition-all active:scale-95",
                                  active || isPending
                                    ? "bg-primary text-primary-content"
                                    : "text-base-content/70 hover:bg-base-100/50 hover:text-base-content"
                                );
                              }
                              return cn(
                                "group relative flex items-center gap-3 rounded-lg px-3 py-1.5 text-xs font-medium active:scale-[0.98]",
                                active || isPending
                                  ? "bg-primary text-primary-content"
                                  : "text-base-content/70 hover:bg-base-100/50 hover:text-base-content"
                              );
                            }}
                          >
                            {({ isActive }) => {
                              const active = isActive || isPending;

                              if (isCollapsed) {
                                return (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="flex h-full w-full items-center justify-center">
                                        <item.icon className="h-5 w-5" />
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent
                                      side="right"
                                      sideOffset={10}
                                      className="bg-base-300 text-base-content border-base-200 z-50 border font-medium shadow-sm"
                                    >
                                      {item.label}
                                    </TooltipContent>
                                  </Tooltip>
                                );
                              }
                              return (
                                <>
                                  <item.icon
                                    className={cn(
                                      "h-4 w-4 shrink-0",
                                      active ? "text-primary-content" : "text-base-content/60 group-hover:text-primary"
                                    )}
                                  />
                                  <span className="truncate">{item.label}</span>
                                  {isPending && (
                                    <Loader2 className="text-primary-content/80 h-3 w-3 shrink-0 animate-spin" />
                                  )}
                                </>
                              );
                            }}
                          </NavLink>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          </nav>

          {/* Footer Info / Collapse Toggle */}
          <div
            className={cn(
              "border-base-300/20 bg-base-100/20 mt-auto rounded-2xl border backdrop-blur-sm",
              isCollapsed ? "p-2" : "p-3"
            )}
          >
            {/* Toggle button removed as sidebar is now hover-controlled */}
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
