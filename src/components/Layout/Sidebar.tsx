import React from "react";
import { NavLink, useLocation, useNavigation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  PiggyBank,
  Users2,
  Briefcase,
  CalendarDays,
  Box,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  FileSpreadsheet,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/Tooltip";

type NavItem = {
  to: string;
  label: string;
  icon: React.ElementType;
  roles?: Array<"GOD" | "ADMIN" | "ANALYST" | "VIEWER">;
  exact?: boolean;
};

type NavCategory = "Resumen" | "Finanzas" | "Gestión" | "Servicios" | "Calendario";

type NavSection = {
  title: string;
  category: NavCategory;
  items: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Resumen",
    category: "Resumen",
    items: [{ to: "/", label: "Panel", icon: LayoutDashboard, exact: true }],
  },
  {
    title: "Finanzas",
    category: "Finanzas",
    items: [
      {
        to: "/finanzas/movements",
        label: "Movimientos",
        icon: PiggyBank,
        roles: ["GOD", "ADMIN", "ANALYST", "VIEWER"],
      },
      {
        to: "/finanzas/balances",
        label: "Saldos Diarios",
        icon: PiggyBank,
        roles: ["GOD", "ADMIN", "ANALYST", "VIEWER"],
      },
      {
        to: "/finanzas/counterparts",
        label: "Contrapartes",
        icon: Users2,
        roles: ["GOD", "ADMIN", "ANALYST", "VIEWER"],
      },
      {
        to: "/finanzas/participants",
        label: "Participantes",
        icon: Users2,
        roles: ["GOD", "ADMIN", "ANALYST", "VIEWER"],
      },
      {
        to: "/finanzas/production-balances",
        label: "Balance Diario",
        icon: FileSpreadsheet,
        roles: ["GOD", "ADMIN", "ANALYST", "VIEWER"],
      },
      { to: "/finanzas/loans", label: "Préstamos", icon: PiggyBank, roles: ["GOD", "ADMIN", "ANALYST", "VIEWER"] },
    ],
  },
  {
    title: "Servicios",
    category: "Servicios",
    items: [{ to: "/services", label: "Servicios", icon: Briefcase, roles: ["GOD", "ADMIN", "ANALYST", "VIEWER"] }],
  },
  {
    title: "Calendario",
    category: "Calendario",
    items: [
      {
        to: "/calendar/summary",
        label: "Calendario",
        icon: CalendarDays,
        roles: ["GOD", "ADMIN", "ANALYST", "VIEWER"],
      },
    ],
  },
  {
    title: "Operaciones",
    category: "Gestión",
    items: [
      { to: "/operations/inventory", label: "Inventario", icon: Box, roles: ["GOD", "ADMIN", "ANALYST"] },
      { to: "/hr/employees", label: "RRHH", icon: Users2, roles: ["GOD", "ADMIN"] },
    ],
  },
  {
    title: "Administración",
    category: "Finanzas",
    items: [{ to: "/settings/security", label: "Ajustes", icon: Settings }],
  },
];

interface SidebarProps {
  isOpen: boolean;
  isMobile: boolean;
  onClose?: () => void;
  isCollapsed?: boolean;
  toggleCollapse?: () => void;
}

export default function Sidebar({ isOpen, isMobile, onClose, isCollapsed = false, toggleCollapse }: SidebarProps) {
  const { user, hasRole } = useAuth();
  const navigation = useNavigation();
  const location = useLocation();
  const [pendingPath, setPendingPath] = React.useState<string | null>(null);

  // Use full name from backend, fallback to email prefix
  const displayName = user?.name || user?.email?.split("@")[0] || "Usuario";

  React.useEffect(() => {
    // Clear manual pending once the URL actually changed
    setPendingPath(null);
  }, [location.pathname]);

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        id="app-sidebar"
        className={cn(
          "border-base-300/50 bg-base-200/80 text-base-content fixed inset-y-0 left-0 z-50 flex h-full shrink-0 flex-col rounded-3xl border text-sm shadow-2xl backdrop-blur-3xl transition-all duration-300 md:static md:h-[calc(100vh-5rem)] md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
          !isOpen && !isMobile && "hidden",
          isCollapsed ? "w-20" : "w-[min(300px,88vw)]",
          isCollapsed ? "px-2 py-3" : "p-3",
          "overflow-x-hidden" // Prevent horizontal scroll
        )}
        aria-label="Navegación principal"
      >
        <div className="flex h-full flex-col gap-4 overflow-hidden">
          {/* User Profile Card */}
          <div
            className={cn(
              "border-base-300/40 from-base-100/85 via-base-200/70 to-base-100/50 rounded-2xl border bg-linear-to-br shadow-inner transition-all",
              isCollapsed ? "p-2" : "p-3"
            )}
          >
            {isCollapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center justify-center">
                    <div className="bg-base-100/80 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/20 shadow-sm">
                      <img src="/logo_bimi.svg" alt="Bioalergia" className="h-9 w-9 object-contain" loading="lazy" />
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <div className="text-left">
                    <p className="font-semibold">{displayName}</p>
                    <p className="text-base-content/60 text-xs">{user?.email}</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            ) : (
              <div className="flex items-center gap-3">
                <div className="bg-base-100/80 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/20 shadow-sm">
                  <img src="/logo_bimi.svg" alt="Bioalergia" className="h-9 w-9 object-contain" loading="lazy" />
                </div>
                <div className="min-w-0 overflow-hidden transition-all duration-300">
                  <p className="text-base-content/60 text-[10px] tracking-[0.2em] uppercase">Bioalergia</p>
                  <p className="text-base-content truncate text-lg leading-tight font-semibold">{displayName}</p>
                  <p className="text-base-content/60 truncate text-[11px]">{user?.email}</p>
                </div>
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="muted-scrollbar flex-1 overflow-y-auto pr-1">
            <div className="space-y-4">
              {NAV_SECTIONS.map((section) => {
                const visibleItems = section.items.filter((item) => !item.roles || hasRole(...item.roles));
                if (!visibleItems.length) return null;

                return (
                  <section key={section.title} className={cn("space-y-1", isCollapsed && "text-center")}>
                    {!isCollapsed && (
                      <div className="mb-2 px-2">
                        <p className="text-base-content/40 text-[10px] font-bold tracking-widest uppercase">
                          {section.title}
                        </p>
                      </div>
                    )}

                    <div className="space-y-1">
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
                                  "flex h-10 w-full items-center justify-center rounded-xl active:scale-95",
                                  active || isPending
                                    ? "bg-primary text-primary-content shadow-primary/20 ring-primary/60 shadow-md ring-1"
                                    : "text-base-content/60 hover:bg-base-100 hover:text-base-content"
                                );
                              }
                              return cn(
                                "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium active:scale-[0.98]",
                                active || isPending
                                  ? "bg-primary text-primary-content shadow-primary/20 shadow-md"
                                  : "text-base-content/70 hover:bg-base-100 hover:text-base-content"
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
                                    <TooltipContent side="right">{item.label}</TooltipContent>
                                  </Tooltip>
                                );
                              }
                              return (
                                <>
                                  <item.icon
                                    className={cn(
                                      "h-4 w-4 shrink-0",
                                      active ? "text-primary-content" : "text-base-content/50 group-hover:text-primary"
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
            {!isMobile && toggleCollapse && (
              <button
                onClick={toggleCollapse}
                className={cn(
                  "group text-base-content/40 hover:text-base-content/70 hover:bg-base-300/20 flex w-full items-center justify-center rounded-lg py-2 transition-all duration-200 active:scale-95",
                  !isCollapsed && "mb-2"
                )}
                aria-label={isCollapsed ? "Expandir menú" : "Colapsar menú"}
              >
                {isCollapsed ? (
                  <ChevronsRight className="h-4 w-4 transition-transform group-hover:scale-110" />
                ) : (
                  <ChevronsLeft className="h-4 w-4 transition-transform group-hover:scale-110" />
                )}
              </button>
            )}
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
