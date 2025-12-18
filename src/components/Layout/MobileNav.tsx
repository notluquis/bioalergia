import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Home, Users, Briefcase, BarChart3, type LucideIcon } from "lucide-react";

interface NavItem {
  path: string;
  icon: LucideIcon;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { path: "/", icon: Home, label: "Inicio" },
  { path: "/employees", icon: Users, label: "Personal" },
  { path: "/services", icon: Briefcase, label: "Servicios" },
  { path: "/hr/reports", icon: BarChart3, label: "Reportes" },
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
    <nav className="fixed bottom-6 left-1/2 z-50 w-[min(100%-2rem,400px)] -translate-x-1/2 md:hidden">
      <div className="flex items-center justify-between gap-1 rounded-4xl border border-white/10 bg-black/80 p-2 shadow-2xl backdrop-blur-xl">
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
              className={`relative flex flex-1 flex-col items-center justify-center gap-1 rounded-3xl px-1 py-3 text-[10px] font-medium transition-all duration-300 ${
                active ? "text-white" : "text-white/50 hover:text-white/80"
              }`}
            >
              {/* Active Background Pill */}
              {active && <div className="absolute inset-0 rounded-3xl bg-white/20 shadow-inner" aria-hidden="true" />}

              <span className="relative z-10 flex flex-col items-center gap-1">
                <Icon
                  className={`h-6 w-6 transition-transform duration-300 ${active ? "scale-110" : ""}`}
                  strokeWidth={active ? 2.5 : 2}
                />
                <span
                  className={`transition-opacity duration-300 ${active ? "font-semibold opacity-100" : "opacity-70"}`}
                >
                  {label}
                </span>
              </span>

              {/* Notification Dot (Pending) */}
              {pendingPath === path && !active && (
                <span className="bg-primary shadow-primary/50 absolute top-2 right-1/4 h-2 w-2 rounded-full shadow-lg" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
