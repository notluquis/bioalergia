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
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-base-100 border-t border-base-300 pb-safe-bottom flex flex-row items-stretch">
      {NAV_ITEMS.map(({ path, icon: Icon, label }) => (
        <button
          key={path}
          type="button"
          onClick={() => navigate(path)}
          className={`flex-1 flex flex-col items-center justify-center gap-1 px-2 py-2 min-h-11 transition-colors ${
            isActive(path) ? "text-primary" : "text-base-content/60 active:text-base-content"
          }`}
        >
          <Icon className="w-6 h-6" strokeWidth={isActive(path) ? 2.5 : 2} />
          <span className="text-[10px] font-medium">{label}</span>
        </button>
      ))}
    </nav>
  );
}
