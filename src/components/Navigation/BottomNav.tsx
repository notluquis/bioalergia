import { useLocation, useNavigate } from "react-router-dom";
import { Home, Users, Briefcase, BarChart3 } from "@/design-system/icons";
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

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  };

  return (
    <nav className="md:hidden fixed bottom-5 left-1/2 z-50 w-[calc(100%-2.5rem)] max-w-lg -translate-x-1/2 px-2 pb-safe-bottom">
      <div className="bottom-bar-glass flex items-stretch gap-1 px-4 py-2">
        {NAV_ITEMS.map(({ path, icon: Icon, label }) => {
          const active = isActive(path);
          return (
            <button
              key={path}
              type="button"
              onClick={() => navigate(path)}
              className={`flex flex-1 select-none flex-col items-center justify-center gap-1 rounded-full px-3 py-2 text-[10px] font-semibold transition-all ${
                active ? "nav-item-active scale-105" : "nav-item-inactive"
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.6 : 2} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
