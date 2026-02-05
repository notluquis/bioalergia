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

interface BottomNavProps {
  isHidden?: boolean;
}

export function BottomNav({ isHidden = false }: Readonly<BottomNavProps>) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [pendingPath, setPendingPath] = React.useState<null | string>(null);

  React.useEffect(() => {
    setPendingPath(null);
  }, []);

  const isActive = (path: string) => {
    if (path === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(path);
  };

  if (isHidden) {
    return null;
  }

  return (
    <nav className="fixed bottom-[calc(env(safe-area-inset-bottom)+1.5rem)] left-1/2 z-50 w-[min(100%-2rem,400px)] -translate-x-1/2 md:hidden">
      <div className="flex items-center justify-between gap-1 rounded-4xl border border-default-100 bg-background/80 p-2 shadow-2xl backdrop-blur-xl">
        {NAV_ITEMS.map(({ icon: Icon, label, path }) => {
          const active = isActive(path);
          return (
            <button
              className={`relative flex flex-1 flex-col items-center justify-center gap-1 rounded-3xl px-1 py-3 font-medium text-[10px] transition-all duration-300 ${
                active ? "text-primary" : "text-default-400 hover:text-default-700"
              }`}
              key={path}
              onClick={() => {
                setPendingPath(path);
                void navigate({ to: path });
              }}
              type="button"
            >
              {/* Active Background Pill */}
              {active && (
                <div aria-hidden="true" className="absolute inset-0 rounded-3xl bg-primary/10" />
              )}

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
                <span className="absolute top-2 right-1/4 h-2 w-2 rounded-full bg-primary shadow-lg shadow-primary/50" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
