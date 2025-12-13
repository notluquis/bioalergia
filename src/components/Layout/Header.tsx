import React from "react";
import { useLocation, useNavigation, useNavigate, useMatches } from "react-router-dom";
import { Loader2, LogOut, ChevronRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import ThemeToggle from "../ui/ThemeToggle";
import ConnectionIndicator from "../features/ConnectionIndicator";
import Clock from "../features/Clock";

type RouteHandle = {
  title?: string;
  breadcrumb?: string;
};

export default function Header() {
  const location = useLocation();
  const navigationState = useNavigation();
  const navigate = useNavigate();
  const matches = useMatches();
  const { logout } = useAuth();

  const isNavigating = navigationState.state === "loading";

  const { breadcrumbs, title } = React.useMemo(() => {
    const path = location.pathname;

    // Obtener título desde route handle
    const currentMatch = matches[matches.length - 1];
    const handle = currentMatch?.handle as RouteHandle | undefined;
    const titleText = handle?.title;

    if (!titleText) {
      return { breadcrumbs: [], title: "Inicio" };
    }

    // Extraer breadcrumbs desde el path
    const parts = path.split("/").filter(Boolean);
    const crumbs: string[] = [];

    if (parts[0] === "finanzas") crumbs.push("Finanzas");
    else if (parts[0] === "services") crumbs.push("Servicios");
    else if (parts[0] === "calendar") crumbs.push("Calendario");
    else if (parts[0] === "operations") crumbs.push("Operaciones");
    else if (parts[0] === "hr") crumbs.push("RRHH");
    else if (parts[0] === "settings") crumbs.push("Configuración");

    return { breadcrumbs: crumbs, title: titleText };
  }, [location.pathname, matches]);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <header className="scroll-header-animation flex items-center justify-between rounded-3xl px-6 py-1 transition-all duration-300">
      <div className="flex flex-col gap-0.5">
        {breadcrumbs.length > 0 && (
          <div className="text-base-content/60 flex items-center gap-1 text-xs">
            {breadcrumbs.map((crumb, i) => (
              <React.Fragment key={i}>
                <span>{crumb}</span>
                <ChevronRight className="h-3 w-3" />
              </React.Fragment>
            ))}
          </div>
        )}
        <div className="flex items-center gap-3">
          <h1 className="text-base-content text-2xl font-bold tracking-tight">{title}</h1>
          {isNavigating && (
            <span className="text-primary flex items-center gap-1 text-xs font-semibold">
              <Loader2 className="h-3 w-3 animate-spin" />
              Cargando...
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 md:gap-3">
        <Clock />
        <ThemeToggle />
        <ConnectionIndicator />
        <button
          type="button"
          onClick={handleLogout}
          className="btn btn-circle border-base-300/70 bg-base-100/80 text-base-content hover:bg-error/10 hover:border-error/40 hover:text-error border shadow-sm transition-all duration-300"
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
        >
          <span className="bg-base-200/50 flex h-6 w-6 items-center justify-center rounded-full shadow-inner transition-all duration-300">
            <LogOut className="h-4 w-4" />
          </span>
        </button>
      </div>
    </header>
  );
}
