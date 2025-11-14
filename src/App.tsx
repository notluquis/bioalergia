import { NavLink, Outlet, useLocation, useNavigate, useNavigation } from "react-router-dom";
import React from "react";
import { useDebounce } from "use-debounce";
import Button from "./components/Button";
import ThemeToggle from "./components/ThemeToggle";
import { BottomNav } from "./components/Navigation/BottomNav";
import { useAuth } from "./context/AuthContext";
import Clock from "./components/Clock";
import ConnectionIndicator from "./components/ConnectionIndicator";
import { APP_VERSION, BUILD_TIMESTAMP } from "./version";

type NavItem = {
  to: string;
  label: string;
  roles?: Array<"GOD" | "ADMIN" | "ANALYST" | "VIEWER">;
  exact?: boolean;
};

type NavCategory = "Resumen" | "Finanzas" | "Gestión" | "Servicios" | "Calendario";

type NavSection = {
  title: string;
  category: NavCategory;
  items: NavItem[];
};

const NAV_CATEGORY_ORDER: NavCategory[] = ["Resumen", "Finanzas", "Gestión", "Servicios", "Calendario"];

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Resumen",
    category: "Resumen",
    items: [
      { to: "/", label: "Panel", exact: true },
      { to: "/stats", label: "Estadísticas", roles: ["GOD", "ADMIN", "ANALYST", "VIEWER"] },
    ],
  },
  {
    title: "Finanzas",
    category: "Finanzas",
    items: [
      { to: "/transactions/movements", label: "Movimientos", roles: ["GOD", "ADMIN", "ANALYST", "VIEWER"] },
      { to: "/transactions/balances", label: "Saldos diarios", roles: ["GOD", "ADMIN", "ANALYST", "VIEWER"] },
      { to: "/counterparts", label: "Contrapartes", roles: ["GOD", "ADMIN", "ANALYST", "VIEWER"] },
      { to: "/transactions/participants", label: "Participantes", roles: ["GOD", "ADMIN", "ANALYST", "VIEWER"] },
      { to: "/loans", label: "Préstamos", roles: ["GOD", "ADMIN", "ANALYST"] },
    ],
  },
  {
    title: "Servicios",
    category: "Servicios",
    items: [
      { to: "/services", label: "Panel", roles: ["GOD", "ADMIN", "ANALYST", "VIEWER"], exact: true },
      { to: "/services/agenda", label: "Agenda", roles: ["GOD", "ADMIN", "ANALYST"] },
      { to: "/services/create", label: "Crear servicio", roles: ["GOD", "ADMIN"] },
      { to: "/services/templates", label: "Plantillas", roles: ["GOD", "ADMIN"] },
    ],
  },
  {
    title: "Calendario",
    category: "Calendario",
    items: [
      { to: "/calendar/summary", label: "Resumen", roles: ["GOD", "ADMIN", "ANALYST", "VIEWER"] },
      { to: "/calendar/schedule", label: "Calendario", roles: ["GOD", "ADMIN", "ANALYST", "VIEWER"] },
      { to: "/calendar/daily", label: "Detalle diario", roles: ["GOD", "ADMIN", "ANALYST", "VIEWER"] },
      { to: "/calendar/heatmap", label: "Mapa de calor", roles: ["GOD", "ADMIN", "ANALYST", "VIEWER"] },
      { to: "/calendar/classify", label: "Clasificar pendientes", roles: ["GOD", "ADMIN", "ANALYST"] },
      { to: "/calendar/history", label: "Historial de sync", roles: ["GOD", "ADMIN", "ANALYST", "VIEWER"] },
    ],
  },
  {
    title: "Gestión",
    category: "Gestión",
    items: [
      { to: "/inventory", label: "Inventario", roles: ["GOD", "ADMIN", "ANALYST"] },
      { to: "/supplies", label: "Solicitud de Insumos", roles: ["GOD", "ADMIN", "ANALYST", "VIEWER"] },
      { to: "/employees", label: "Trabajadores", roles: ["GOD", "ADMIN"] },
      { to: "/timesheets", label: "Horas y pagos", roles: ["GOD", "ADMIN", "ANALYST"] },
      { to: "/timesheets-audit", label: "Auditoría de horarios", roles: ["GOD", "ADMIN", "ANALYST"] },
    ],
  },
  {
    title: "Administración",
    category: "Finanzas",
    items: [
      { to: "/upload", label: "Subir CSV", roles: ["GOD", "ADMIN", "ANALYST"] },
      { to: "/settings/general", label: "Config. general", roles: ["GOD", "ADMIN"] },
      { to: "/settings/accesos", label: "Accesos y conexiones", roles: ["GOD", "ADMIN"] },
      { to: "/settings/inventario", label: "Config. inventario", roles: ["GOD", "ADMIN"] },
      { to: "/settings/roles", label: "Roles y permisos", roles: ["GOD", "ADMIN"] },
    ],
  },
];

const TITLES: Record<string, string> = {
  "/": "Panel financiero",
  "/upload": "Subir movimientos a la base",
  "/transactions/movements": "Movimientos registrados",
  "/counterparts": "Contrapartes",
  "/transactions/participants": "Participantes",
  "/timesheets": "Horas y pagos",
  "/transactions/balances": "Saldos diarios",
  "/employees": "Trabajadores",
  "/supplies": "Solicitud de Insumos",
  "/loans": "Préstamos y créditos",
  "/services": "Servicios recurrentes",
  "/services/agenda": "Agenda de servicios",
  "/services/create": "Crear servicio",
  "/calendar/summary": "Eventos de calendario",
  "/calendar/schedule": "Calendario interactivo",
  "/calendar/daily": "Detalle diario",
  "/calendar/heatmap": "Mapa de calor",
  "/calendar/classify": "Clasificar eventos",
  "/timesheets-audit": "Auditoría de horarios",
  "/data": "Movimientos registrados",
  "/stats": "Estadísticas",
  "/settings": "Configuración",
  "/settings/general": "Identidad y marca",
  "/settings/accesos": "Accesos y conexiones",
  "/settings/inventario": "Parámetros de inventario",
  "/settings/roles": "Roles y permisos",
  "/inventory": "Gestión de Inventario",
};

const resolveCategoryForPath = (pathname: string): NavCategory => {
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      if (item.exact) {
        if (item.to === pathname) return section.category;
      } else if (pathname.startsWith(item.to)) {
        return section.category;
      }
    }
  }
  if (pathname.startsWith("/services")) return "Servicios";
  if (pathname.startsWith("/calendar")) return "Calendario";
  return "Finanzas";
};

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const navigationState = useNavigation();
  const title = React.useMemo(() => {
    if (/^\/services\/.+\/edit$/.test(location.pathname)) {
      return "Editar servicio";
    }
    return TITLES[location.pathname] ?? "Bioalergia Finanzas";
  }, [location.pathname]);
  const { user, logout, hasRole } = useAuth();

  const navigationSections = NAV_SECTIONS.map((section) => ({
    title: section.title,
    category: section.category,
    items: section.items.filter((item) => !item.roles || hasRole(...item.roles)),
  })).filter((section) => section.items.length);

  const resolvedCategory = React.useMemo(() => resolveCategoryForPath(location.pathname), [location.pathname]);
  const [activeNavCategory, setActiveNavCategory] = React.useState<NavCategory>(resolvedCategory);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const displayName = user?.name || (user?.email?.split("@")[0] ?? "");
  const firstWord = displayName.split(" ")[0];
  const capitalizedName = firstWord ? firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase() : "";

  // Sidebar state: visible/hidden
  const [sidebarOpen, setSidebarOpen] = React.useState(true);

  // Detect if mobile/tablet (md breakpoint)
  const [isMobile, setIsMobile] = React.useState(!window.matchMedia("(min-width: 768px)").matches);
  const [debouncedIsMobile] = useDebounce(isMobile, 150);

  React.useEffect(() => {
    const checkMobile = () => setIsMobile(!window.matchMedia("(min-width: 768px)").matches);
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Use debounced value for sidebar control to prevent jank
  React.useEffect(() => {
    if (debouncedIsMobile) {
      setSidebarOpen(false);
    } else {
      setSidebarOpen(true);
    }
  }, [debouncedIsMobile, location.pathname]);

  React.useEffect(() => {
    setActiveNavCategory(resolvedCategory);
  }, [resolvedCategory]);

  const navigationByCategory = navigationSections.filter((section) => section.category === activeNavCategory);

  const buildLabel = React.useMemo(() => {
    if (!BUILD_TIMESTAMP) return "Desconocido";
    const parsed = new Date(BUILD_TIMESTAMP);
    if (Number.isNaN(parsed.getTime())) {
      return BUILD_TIMESTAMP;
    }
    return parsed.toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
  }, []);

  // Toggle sidebar (hamburguesa)
  const toggleSidebar = () => setSidebarOpen((open) => !open);

  // Preline runtime removed: we avoid optional runtime helpers and rely on Tailwind + DaisyUI utilities

  const isNavigating = navigationState.state === "loading";

  return (
    <>
      {isNavigating && (
        <div className="fixed left-0 right-0 top-0 z-[60] h-1 overflow-hidden bg-base-200 shadow-lg">
          <div className="nav-progress__indicator" />
        </div>
      )}
      <div className="layout-shell relative mx-auto flex min-h-screen w-full max-w-[1600px] gap-6 px-4 py-6 text-base-content transition-colors duration-300 sm:px-6 lg:px-10">
        {/* Hamburger button: always visible */}
        <button
          type="button"
          className="apple-nav-toggle fixed left-4 top-[clamp(1rem,env(safe-area-inset-top,0px)+1rem,2.75rem)] z-40 md:hidden"
          onClick={toggleSidebar}
          aria-label={sidebarOpen ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={sidebarOpen}
          aria-controls={sidebarOpen || !isMobile ? "app-sidebar" : undefined}
        >
          {sidebarOpen ? (
            <svg
              className="h-6 w-6 text-base-content"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg
              className="h-6 w-6 text-base-content"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>

        {/* Overlay for mobile/tablet when sidebar is open */}
        {isMobile && sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-base-content/20 transition-opacity duration-300"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar: animated, overlay on mobile, collapsible on desktop */}
        {(sidebarOpen || !isMobile) && (
          <aside
            id="app-sidebar"
            className={`fixed inset-y-0 left-0 z-50 flex h-full w-[min(320px,90vw)] shrink-0 flex-col rounded-4xl border border-base-300/60 bg-base-200/70 p-4 text-sm text-base-content shadow-2xl backdrop-blur-3xl transition-transform duration-300 md:static md:h-[calc(100vh-5rem)] md:translate-x-0
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
            ${!sidebarOpen && !isMobile ? "hidden" : ""}`}
          >
            <div className="flex h-full flex-col gap-6 overflow-hidden">
              <div className="flex items-center justify-between rounded-3xl bg-base-100/10 p-4 shadow-inner">
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-linear-to-br from-primary/70 via-primary/30 to-secondary/20 text-2xl font-semibold text-white shadow-inner">
                    <span>✦</span>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.4em] text-base-content/50">Bioalergia</p>
                    <p className="text-base font-semibold">{capitalizedName || "Equipo"}</p>
                  </div>
                </div>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => setSidebarOpen(false)}
                  aria-label="Cerrar barra lateral"
                >
                  <span className="text-lg">✕</span>
                </Button>
              </div>
              <div className="space-y-3">
                <p className="text-[10px] uppercase tracking-[0.5em] text-base-content/60">Categorías</p>
                <div className="flex flex-wrap gap-2">
                  {NAV_CATEGORY_ORDER.map((category) => (
                    <Button
                      key={category}
                      size="sm"
                      variant={activeNavCategory === category ? "primary" : "ghost"}
                      className={`rounded-[999px] px-4 py-1 text-[11px] tracking-wide ${
                        activeNavCategory === category
                          ? "shadow-lg text-white"
                          : "text-base-content/70 hover:text-base-content"
                      }`}
                      onClick={() => setActiveNavCategory(category)}
                    >
                      {category}
                    </Button>
                  ))}
                </div>
              </div>
              <nav className="flex-1 overflow-y-auto pr-1">
                {navigationByCategory.length ? (
                  <div className="space-y-5">
                    {navigationByCategory.map((section) => (
                      <section
                        key={section.title}
                        className="space-y-2 rounded-3xl border border-base-300/20 bg-base-200/40 p-3 shadow-inner"
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-base-content/50">
                          {section.title}
                        </p>
                        <div className="space-y-2">
                          {section.items.map((item) => (
                            <NavLink
                              key={item.to}
                              to={item.to}
                              end={item.exact}
                              className={({ isActive }) =>
                                `group flex w-full items-center justify-between rounded-2xl border border-base-300/20 px-4 py-3 text-sm font-semibold transition-all duration-200 ${
                                  isActive
                                    ? "bg-linear-to-r from-primary/90 via-secondary/70 to-accent/70 text-white shadow-2xl"
                                    : "bg-transparent text-base-content/70 hover:text-base-content hover:bg-base-100/40"
                                }`
                              }
                              onClick={() => {
                                if (isMobile) setSidebarOpen(false);
                              }}
                            >
                              <span>{item.label}</span>
                              <span className="text-xs text-white/60">{item.to === location.pathname ? "·" : "›"}</span>
                            </NavLink>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-xs text-base-content/70">
                    No hay secciones visibles para esta categoría y rol.
                  </div>
                )}
              </nav>
              <div className="space-y-1 rounded-2xl border border-white/10 bg-black/40 p-3 text-[11px] text-base-content/60 shadow-inner">
                <p className="font-semibold text-base-content">Versión</p>
                <p>{APP_VERSION}</p>
                <p className="text-xs">Build: {buildLabel}</p>
              </div>
            </div>
          </aside>
        )}

        {/* Main content */}
        <div className="layout-container flex min-w-0 flex-1 flex-col gap-6 pb-[110px] md:pb-0">
          {/* min-w-0 permite que se encoja, pb-20 en mobile para el bottom nav */}
          <header className="surface-elevated flex items-center justify-between rounded-3xl px-6 py-4 shadow-md">
            <h1 className="text-xl font-semibold text-base-content drop-shadow-sm">{title}</h1>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <ConnectionIndicator />
              <div className="text-right">
                <p className="font-semibold text-base-content">{capitalizedName}</p>
                <p className="text-xs text-base-content/70">{user?.email}</p>
              </div>
              <Button variant="secondary" className="btn-circle" onClick={handleLogout} aria-label="Cerrar sesión">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V5h10a1 1 0 100-2H3zm12.293 4.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L16.586 13H9a1 1 0 110-2h7.586l-1.293-1.293a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </Button>
            </div>
          </header>

          <main className="flex-1 rounded-[2.25rem]">
            <div className="surface-recessed h-full rounded-[2.25rem] px-4 py-6 shadow-inner sm:px-6">
              <div className="muted-scrollbar h-full overflow-auto">
                <Outlet />
              </div>
            </div>
          </main>

          <footer className="surface-elevated hidden md:flex items-center justify-between px-6 py-3 text-sm text-base-content">
            <span className="font-medium text-base-content/70">Bioalergia Finanzas</span>
            <Clock />
          </footer>
        </div>

        {/* Mobile bottom navigation */}
        <BottomNav />
      </div>
    </>
  );
}
