import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { SETTINGS_PAGES } from "./settings/constants";
import { cn } from "../lib/utils";

export default function SettingsLayout() {
  const { hasRole } = useAuth();
  const canEdit = hasRole("GOD", "ADMIN");

  if (!canEdit) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold text-primary">Configuración</h1>
        <p className="border-l-4 border-amber-300/80 bg-base-100 p-6 text-sm text-amber-700">
          Necesitas permisos de administrador para ver la configuración.
        </p>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:gap-10">
      {/* Settings Sidebar */}
      <aside className="w-full shrink-0 lg:w-72">
        <div className="sticky top-6 space-y-6">
          <div className="px-2">
            <h2 className="text-lg font-bold text-base-content">Configuración</h2>
            <p className="text-xs text-base-content/60">Administración del sistema</p>
          </div>

          <nav className="space-y-1">
            <NavLink
              to="/settings"
              end
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all",
                  isActive
                    ? "bg-primary/10 text-primary shadow-sm"
                    : "text-base-content/70 hover:bg-base-200 hover:text-base-content"
                )
              }
            >
              <span className="text-lg">⌘</span>
              <span>Visión general</span>
            </NavLink>

            <div className="my-2 h-px bg-base-300/50 mx-4" />

            {SETTINGS_PAGES.map((page) => {
              const Icon = page.icon;
              return (
                <NavLink
                  key={page.to}
                  to={page.to}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all",
                      isActive
                        ? "bg-primary/10 text-primary shadow-sm"
                        : "text-base-content/70 hover:bg-base-200 hover:text-base-content"
                    )
                  }
                >
                  <Icon size={18} />
                  <span>{page.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="min-w-0 flex-1">
        <div className="surface-recessed rounded-3xl p-6 shadow-inner min-h-[500px]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
