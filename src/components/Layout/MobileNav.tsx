import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Home, Users, Briefcase, BarChart3 } from "@/components/ui/icons";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  path: string;
  icon: LucideIcon;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { path: "/", icon: Home, label: "Inicio" },
  { path: "/employees", icon: Users, label: "Personal" },
  { path: "/services", icon: Briefcase, label: "Servicios" },
  { path: "/stats", icon: BarChart3, label: "Reportes" },
];

export function BottomNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [pendingPath, setPendingPath] = React.useState<string | null>(null);

  React.useEffect(() => {
    setPendingPath(null);
  }, [pathname]);

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  };

  return (
    <nav
      className="md:hidden fixed bottom-5 left-1/2 z-50 w-[calc(100%-2.5rem)] max-w-lg -translate-x-1/2 px-2 pb-safe-bottom"
      style={{
        paddingLeft: "max(0.5rem, env(safe-area-inset-left))",
        paddingRight: "max(0.5rem, env(safe-area-inset-right))",
      }}
    >
      <div className="bottom-bar-glass flex items-stretch gap-1 px-4 py-2">
        {NAV_ITEMS.map(({ path, icon: Icon, label }) => {
          const active = isActive(path);
          return (
            <button
              key={path}
              type="button"
              onClick={() => {
                setPendingPath(path);
                navigate(path);
              }}
              className={`flex flex-1 select-none flex-col items-center justify-center gap-1 rounded-full px-3 py-2 text-[10px] font-semibold transition-all ${
                active || pendingPath === path ? "nav-item-active scale-105" : "nav-item-inactive"
              }`}
            >
              <span className="relative flex items-center justify-center">
                <Icon className="h-5 w-5" strokeWidth={active || pendingPath === path ? 2.6 : 2} />
                {pendingPath === path && (
                  <span className="absolute -right-3 h-2 w-2 animate-ping rounded-full bg-primary/80" aria-hidden />
                )}
              </span>
              <span className="flex items-center gap-1">
                {label}
                {pendingPath === path && <span className="h-1.5 w-1.5 rounded-full bg-primary/80" />}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
