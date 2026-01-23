import { useLocation, useNavigate, useRouterState } from "@tanstack/react-router";
import { ChevronRight, Loader2, LogOut } from "lucide-react";
import React from "react";

import { useAuth } from "@/context/AuthContext";

import Clock from "../features/Clock";
import Button from "../ui/Button";
import ThemeToggle from "../ui/ThemeToggle";

export default function Header() {
  const location = useLocation();
  const routerStatus = useRouterState({ select: (s) => s.status });
  const navigate = useNavigate();
  const { logout } = useAuth();

  const isNavigating = routerStatus === "pending";

  const { breadcrumbs, title } = React.useMemo(() => {
    const path = location.pathname;

    // Extract title from path
    const parts = path.split("/").filter(Boolean);
    let titleText = "Inicio";
    const crumbs: string[] = [];

    switch (parts[0]) {
      case "calendar": {
        crumbs.push("Calendario");
        titleText = parts[1] ? parts[1].charAt(0).toUpperCase() + parts[1].slice(1) : "Calendario";

        break;
      }
      case "finanzas": {
        crumbs.push("Finanzas");
        titleText = parts[1] ? parts[1].charAt(0).toUpperCase() + parts[1].slice(1) : "Finanzas";

        break;
      }
      case "hr": {
        crumbs.push("RRHH");
        titleText = parts[1] ? parts[1].charAt(0).toUpperCase() + parts[1].slice(1) : "RRHH";

        break;
      }
      case "operations": {
        crumbs.push("Operaciones");
        titleText = "Operaciones";

        break;
      }
      case "services": {
        crumbs.push("Servicios");
        titleText = "Servicios";

        break;
      }
      case "settings": {
        crumbs.push("Configuración");
        titleText = parts[1]
          ? parts[1].charAt(0).toUpperCase() + parts[1].slice(1)
          : "Configuración";

        break;
      }
      // No default
    }

    return { breadcrumbs: crumbs, title: titleText };
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    void navigate({ replace: true, to: "/login" });
  };

  return (
    <header className="scroll-header-animation sticky top-0 z-30 flex items-center justify-between rounded-3xl px-6 py-1 transition-all duration-300">
      <div className="flex flex-col gap-0.5">
        {breadcrumbs.length > 0 && (
          <div className="text-default-500 flex items-center gap-1 text-xs">
            {breadcrumbs.map((crumb, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: simple breadcrumb list
              <React.Fragment key={i}>
                <span>{crumb}</span>
                <ChevronRight className="h-3 w-3" />
              </React.Fragment>
            ))}
          </div>
        )}
        <div className="flex items-center gap-3">
          <h1 className="text-foreground text-2xl font-bold tracking-tight">{title}</h1>
          {isNavigating && (
            <span className="text-primary flex items-center gap-1 text-xs font-semibold">
              <Loader2 className="h-3 w-3 animate-spin" />
              Cargando...
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 md:gap-3">
        <div className="hidden md:block">
          <Clock />
        </div>
        <ThemeToggle />
        <Button
          isIconOnly
          aria-label="Cerrar sesión"
          className="border-default-200/70 bg-background/80 text-foreground hover:bg-danger/10 hover:border-danger/40 hover:text-danger rounded-full border shadow-sm transition-all duration-300"
          onClick={() => {
            void handleLogout();
          }}
          title="Cerrar sesión"
          variant="ghost"
        >
          <span className="bg-default-50/50 flex h-6 w-6 items-center justify-center rounded-full shadow-inner transition-all duration-300">
            <LogOut className="h-4 w-4" />
          </span>
        </Button>
      </div>
    </header>
  );
}
