import { NavLink } from "react-router-dom";
import { SETTINGS_PAGES } from "./constants";

export default function SettingsOverviewPage() {
  return (
    <div className="space-y-8">
      <div className="surface-elevated grid gap-6 rounded-3xl p-6 shadow-lg lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Administración</p>
          <h1 className="text-3xl font-semibold text-base-content drop-shadow-sm">Centro de configuración</h1>
          <p className="text-sm text-base-content/70">
            Ajusta identidad, calendarios, conexiones y accesos desde un solo lugar. Cada sección agrupa tareas
            frecuentes para que el mantenimiento sea más rápido y seguro.
          </p>
        </div>
        <div className="grid gap-3 rounded-2xl border border-base-300/60 bg-base-100/70 p-4 text-sm shadow-inner">
          <p className="text-xs font-semibold uppercase tracking-wide text-base-content/60">Atajos rápidos</p>
          <div className="flex flex-wrap gap-2">
            {SETTINGS_PAGES.slice(0, 3).map((page) => (
              <span key={page.to} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {page.label}
              </span>
            ))}
          </div>
          <p className="text-xs text-base-content/60">
            Cambios críticos quedan registrados con tu usuario para auditoría interna.
          </p>
        </div>
      </div>

      <nav className="grid gap-4 md:grid-cols-2">
        {SETTINGS_PAGES.map((page) => {
          const Icon = page.icon;
          return (
            <NavLink
              key={page.to}
              to={page.to}
              className={({ isActive }) =>
                `flex min-h-[150px] flex-col gap-3 rounded-3xl border px-6 py-5 transition ${
                  isActive
                    ? "border-primary/60 bg-primary/10 text-primary shadow-xl"
                    : "border-base-300 bg-base-200 text-base-content hover:border-primary/35 hover:bg-primary/5"
                }`
              }
            >
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-2xl border px-3 py-2 ${
                    page.to === "general"
                      ? "border-primary/40 bg-primary/15 text-primary"
                      : "border-base-300 text-base-content/80"
                  }`}
                >
                  <Icon size={18} />
                </span>
                <span className="text-sm font-semibold uppercase tracking-wide">{page.label}</span>
              </div>
              <p className="text-sm text-base-content/70">{page.description}</p>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
