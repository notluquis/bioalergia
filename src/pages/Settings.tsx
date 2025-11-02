import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/auth-context";

const SETTINGS_PAGES = [
  {
    to: "general",
    label: "Identidad y marca",
    description: "Colores, logo y datos básicos de la organización.",
  },
  {
    to: "calendar",
    label: "Calendario",
    description: "Zona horaria, ventanas de sincronización y exclusiones de eventos.",
  },
  {
    to: "accesos",
    label: "Accesos y conexiones",
    description: "URLs de cPanel, base de datos y credenciales visibles.",
  },
  {
    to: "inventario",
    label: "Inventario",
    description: "Categorías y organización del inventario.",
  },
  {
    to: "roles",
    label: "Roles y permisos",
    description: "Mapeo de roles de empleados a permisos en la app.",
  },
] as const;

export default function SettingsLayout() {
  const { hasRole } = useAuth();
  const canEdit = hasRole("GOD", "ADMIN");

  if (!canEdit) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold text-(--brand-primary)">Configuración</h1>
        <p className="border-l-4 border-amber-300/80 bg-linear-to-r from-amber-50/75 via-white/70 to-white/55 p-6 text-sm text-amber-700">
          Necesitas permisos de administrador para ver la configuración.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="bg-base-100 space-y-2 p-6">
        <h1 className="text-2xl font-bold text-(--brand-primary) drop-shadow-sm">Centro de configuración</h1>
        <p className="text-sm text-slate-600/90">
          Agrupamos la configuración en secciones temáticas para facilitar su administración.
        </p>
      </div>

      <nav className="grid gap-3 md:grid-cols-2">
        {SETTINGS_PAGES.map((page) => (
          <NavLink
            key={page.to}
            to={page.to}
            className={({ isActive }) =>
              `bg-base-100 flex flex-col gap-1 rounded-2xl border px-5 py-4 transition ${
                isActive
                  ? "border-(--brand-primary)/50 bg-(--brand-primary)/15 text-(--brand-primary) shadow-[0_16px_32px_-20px_rgba(14,100,183,0.6)]"
                  : "border-white/45 bg-base-100/65 text-slate-700 hover:border-(--brand-primary)/35 hover:bg-(--brand-primary)/8 hover:text-(--brand-primary)"
              }`
            }
          >
            <span className="text-sm font-semibold uppercase tracking-wide text-slate-500">{page.label}</span>
            <p className="text-xs text-slate-500/90">{page.description}</p>
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </section>
  );
}
