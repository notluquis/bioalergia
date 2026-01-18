import { useLocation, useNavigate } from "@tanstack/react-router";
import { BarChart3, Briefcase, Home, type LucideIcon, Users } from "lucide-react";
import React from "react";

interface NavItem {
  icon: LucideIcon;
  label: string;
  path: string;
}

const NAV_ITEMS: NavItem[] = [
  { icon: Home, label: "Inicio", path: "/" },
  { icon: Users, label: "Personal", path: "/employees" },
  { icon: Briefcase, label: "Servicios", path: "/services" },
  { icon: BarChart3, label: "Reportes", path: "/hr/reports" },
];

export function BottomNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [pendingPath, setPendingPath] = React.useState<null | string>(null);

  React.useEffect(() => {
    setPendingPath(null);
  }, [pathname]);

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-6 left-1/2 z-50 w-[min(100%-2rem,400px)] -translate-x-1/2 md:hidden">
      <div className="bg-base-100/80 border-base-200 flex items-center justify-between gap-1 rounded-4xl border p-2 shadow-2xl backdrop-blur-xl">
        {NAV_ITEMS.map(({ icon: Icon, label, path }) => {
          const active = isActive(path);
          return (
            <button
              className={`relative flex flex-1 flex-col items-center justify-center gap-1 rounded-3xl px-1 py-3 text-[10px] font-medium transition-all duration-300 ${
                active ? "text-primary" : "text-base-content/50 hover:text-base-content/80"
              }`}
              key={path}
              onClick={() => {
                setPendingPath(path);
                void navigate({ to: path });
              }}
              type="button"
            >
              {/* Active Background Pill */}
              {active && <div aria-hidden="true" className="bg-primary/10 absolute inset-0 rounded-3xl" />}

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
