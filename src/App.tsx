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
import { CalendarDays, LayoutDashboard, Briefcase, PiggyBank, Users2, LogOut, Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type NavItem = {
  to: string;
  label: string;
  roles?: Array<"GOD" | "ADMIN" | "ANALYST" | "VIEWER">;
  exact?: boolean;
};

type NavCategory = "Resumen" | "Finanzas" | "Gestión" | "Servicios" | "Calendario";

type NavCategoryMeta = {
  description: string;
  icon: LucideIcon;
  accent: string;
};

type NavSection = {
  title: string;
  category: NavCategory;
  items: NavItem[];
};

const NAV_CATEGORY_ORDER: NavCategory[] = ["Resumen", "Finanzas", "Gestión", "Servicios", "Calendario"];

const NAV_CATEGORY_META: Record<NavCategory, NavCategoryMeta> = {
  Resumen: {
    description: "Panel general y estadísticas clave.",
    icon: LayoutDashboard,
    accent: "from-sky-500/80 via-indigo-500/80 to-fuchsia-500/80",
  },
  Finanzas: {
    description: "Movimientos, saldos y contrapartes.",
    icon: PiggyBank,
    accent: "from-emerald-500/80 via-teal-500/70 to-cyan-500/80",
  },
  Gestión: {
    description: "RRHH, inventario y operaciones internas.",
    icon: Users2,
    accent: "from-rose-500/70 via-pink-500/80 to-orange-500/80",
  },
  Servicios: {
    description: "Plantillas, agenda y creación de servicios.",
    icon: Briefcase,
    accent: "from-purple-500/80 via-violet-500/70 to-indigo-500/70",
  },
  Calendario: {
    description: "Eventos, sincronizaciones y visualizaciones.",
    icon: CalendarDays,
    accent: "from-amber-500/80 via-orange-500/70 to-red-500/70",
  },
};

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
  const pendingPath = navigationState.location?.pathname ?? null;
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

  const derivedPath = pendingPath ?? location.pathname;
  const resolvedCategory = React.useMemo(() => resolveCategoryForPath(derivedPath), [derivedPath]);
  const [activeNavCategory, setActiveNavCategory] = React.useState<NavCategory>(resolvedCategory);
  React.useEffect(() => {
    setActiveNavCategory(resolvedCategory);
  }, [resolvedCategory]);
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
  const [categoriesExpanded, setCategoriesExpanded] = React.useState(false);

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
        <div className="fixed left-0 right-0 top-0 z-50 h-1 overflow-hidden bg-base-200 shadow-lg">
          <div className="nav-progress__indicator" />
        </div>
      )}
      <div className="layout-shell relative mx-auto flex min-h-screen w-full gap-6 px-2 py-6 text-base-content transition-colors duration-300 sm:px-4 lg:px-6">
        {/* Hamburger button: accessible, compact, always visible on mobile */}
        <button
          type="button"
          className="fixed left-4 top-[clamp(0.9rem,env(safe-area-inset-top,0px)+0.9rem,2.5rem)] z-40 inline-flex items-center gap-2 rounded-full border border-base-300/70 bg-base-100/85 px-3 py-2 text-sm font-semibold text-base-content shadow-lg backdrop-blur-md transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-1 md:hidden"
          onClick={toggleSidebar}
          aria-label={sidebarOpen ? "Cerrar menú principal" : "Abrir menú principal"}
          aria-expanded={sidebarOpen}
          aria-controls="app-sidebar"
          aria-pressed={sidebarOpen}
        >
          <span
            className={`relative flex h-6 w-6 items-center justify-center rounded-full transition-colors ${
              sidebarOpen ? "bg-primary/10 text-primary" : "bg-base-200 text-base-content"
            }`}
            aria-hidden="true"
          >
            <span
              className={`block h-[1.5px] w-3 rounded-full transition-all duration-200 ${
                sidebarOpen ? "translate-y-[3px] rotate-45 bg-primary" : "-translate-y-1 bg-base-content"
              }`}
            />
            <span
              className={`block h-[1.5px] w-3 rounded-full transition-all duration-200 ${
                sidebarOpen ? "-translate-y-[3px] -rotate-45 bg-primary" : "translate-y-1 bg-base-content"
              }`}
            />
          </span>
          <span className="text-xs uppercase tracking-wide">{sidebarOpen ? "Cerrar" : "Menú"}</span>
        </button>

        {/* Overlay for mobile/tablet when sidebar is open */}
        {isMobile && sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-base-content/30 backdrop-blur-[1px] transition-opacity duration-300"
            role="presentation"
            aria-hidden="true"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar: animated, overlay on mobile, collapsible on desktop */}
        {(sidebarOpen || !isMobile) && (
          <aside
            id="app-sidebar"
            className={`fixed inset-y-0 left-0 z-50 flex h-full w-[min(300px,88vw)] shrink-0 flex-col rounded-3xl border border-base-300/50 bg-base-200/80 p-3 text-sm text-base-content shadow-2xl backdrop-blur-3xl transition-transform duration-300 md:static md:h-[calc(100vh-5rem)] md:translate-x-0
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
            ${!sidebarOpen && !isMobile ? "hidden" : ""}`}
            aria-label="Navegación principal"
          >
            <div className="flex h-full flex-col gap-4 overflow-hidden">
              <div className="rounded-2xl border border-base-300/40 bg-linear-to-brrom-base-100/85 via-base-200/70 to-base-100/50 p-3 shadow-inner">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/20 bg-base-100/80 shadow-sm">
                    <img
                      src="/logo_sin_eslogan.png"
                      alt="Bioalergia"
                      className="h-9 w-9 object-contain"
                      loading="lazy"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.4em] text-base-content/60">Bioalergia</p>
                    <p className="truncate text-lg font-semibold leading-tight text-base-content">
                      {capitalizedName || "Equipo"}
                    </p>
                    <p className="truncate text-[11px] text-base-content/60">{user?.email}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-base-300/30 bg-base-100/35 p-3 shadow-inner">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[11px] uppercase tracking-[0.45em] text-base-content/65">Secciones</p>
                  <button
                    type="button"
                    className="rounded-lg px-2 py-1 text-[11px] font-semibold text-base-content/70 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-base-100"
                    onClick={() => setCategoriesExpanded((prev) => !prev)}
                  >
                    {categoriesExpanded ? "Vista compacta" : "Ver detalle"}
                  </button>
                </div>
                <div className="muted-scrollbar flex gap-2 overflow-x-auto pb-1 pr-1">
                  {NAV_CATEGORY_ORDER.map((category) => {
                    const meta = NAV_CATEGORY_META[category];
                    const active = activeNavCategory === category;
                    return (
                      <button
                        key={category}
                        type="button"
                        onClick={() => setActiveNavCategory(category)}
                        aria-pressed={active}
                        className={`group relative flex min-w-[140px] items-center gap-3 rounded-xl px-3 py-2 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-base-100 ${
                          active
                            ? `border border-white/40 bg-linear-to-r ${meta.accent} text-white shadow-lg shadow-primary/20`
                            : "border border-base-300/50 bg-base-100/80 text-base-content/80 hover:border-primary/40 hover:text-primary"
                        }`}
                      >
                        <span
                          className={`flex h-9 w-9 items-center justify-center rounded-lg border text-sm transition-colors ${
                            active
                              ? "border-white/60 bg-white/10 text-white"
                              : "border-base-300/70 bg-base-100/70 text-base-content"
                          }`}
                        >
                          <meta.icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <p className={`text-sm font-semibold ${active ? "text-white" : "text-base-content"}`}>
                            {category}
                          </p>
                          {categoriesExpanded && (
                            <p
                              className={`text-[11px] leading-snug ${active ? "text-white/80" : "text-base-content/65"}`}
                            >
                              {meta.description}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <nav className="flex-1 overflow-y-auto pr-1">
                {navigationByCategory.length ? (
                  <div className="space-y-3">
                    {navigationByCategory.map((section) => (
                      <section
                        key={section.title}
                        className="rounded-2xl border border-base-300/25 bg-base-100/30 p-3 shadow-inner"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] uppercase tracking-[0.35em] text-base-content/60">
                            {section.title}
                          </p>
                          <span className="text-[10px] text-base-content/50">
                            {section.items.length === 1 ? "1 opción" : `${section.items.length} opciones`}
                          </span>
                        </div>
                        <div className="mt-2 space-y-1.5">
                          {section.items.map((item) => (
                            <NavLink
                              key={item.to}
                              to={item.to}
                              end={item.exact}
                              className={({ isActive }) => {
                                const pendingMatch =
                                  pendingPath && (pendingPath === item.to || pendingPath.startsWith(`${item.to}/`));
                                const active = isActive || Boolean(pendingMatch);
                                return `group relative flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all duration-200 ${
                                  active
                                    ? "border-primary/60 bg-base-100/90 text-base-content shadow-lg shadow-primary/10"
                                    : "border-base-300/30 bg-transparent text-base-content/75 hover:border-primary/40 hover:bg-base-100/60 hover:text-base-content"
                                }`;
                              }}
                              onClick={() => {
                                if (isMobile) setSidebarOpen(false);
                              }}
                            >
                              <div className="flex items-center gap-3 overflow-hidden">
                                <span
                                  className="h-2.5 w-2.5 rounded-full bg-linear-to-br from-primary/80 via-secondary/70 to-accent/70 opacity-50 transition-opacity group-hover:opacity-100"
                                  aria-hidden="true"
                                />
                                <span className="truncate">{item.label}</span>
                              </div>
                              <span
                                className={`text-xs font-medium ${
                                  pendingPath && (pendingPath === item.to || pendingPath.startsWith(`${item.to}/`))
                                    ? "text-primary"
                                    : "text-base-content/50 group-hover:text-primary"
                                }`}
                              >
                                {pendingPath && (pendingPath === item.to || pendingPath.startsWith(`${item.to}/`))
                                  ? "…"
                                  : "›"}
                              </span>
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

              <div className="rounded-2xl border border-base-300/30 bg-base-100/30 p-3 text-[11px] text-base-content/60 shadow-inner">
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
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-base-content drop-shadow-sm">{title}</h1>
              {isNavigating && (
                <span className="flex items-center gap-1 text-xs font-semibold text-primary">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Cargando...
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <ConnectionIndicator />
              <Button
                variant="ghost"
                className="btn-circle border border-base-300/60 text-base-content hover:border-primary/60 hover:text-primary"
                onClick={handleLogout}
                aria-label="Cerrar sesión"
              >
                <LogOut className="h-4 w-4" />
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
