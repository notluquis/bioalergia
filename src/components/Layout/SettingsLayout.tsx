import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { cn } from "../../lib/utils";
import { Users, Shield, Settings as SettingsIcon, CreditCard, Calendar, Box, UserPlus } from "lucide-react";

const SETTINGS_SECTIONS = [
  {
    title: "General",
    items: [
      { label: "Visión General", to: "/settings", icon: SettingsIcon, end: true },
      { label: "Seguridad", to: "/settings/security", icon: Shield },
    ],
  },
  {
    title: "Organización",
    items: [
      { label: "Usuarios", to: "/settings/users", icon: Users },
      { label: "Personas", to: "/settings/people", icon: UserPlus },
      { label: "Roles y Permisos", to: "/settings/roles", icon: Shield },
    ],
  },
  {
    title: "Módulos",
    items: [
      { label: "Finanzas", to: "/settings/finance", icon: CreditCard },
      { label: "Calendario", to: "/settings/calendar", icon: Calendar },
      { label: "Inventario", to: "/settings/inventory", icon: Box },
    ],
  },
];

export default function SettingsLayout() {
  const { hasRole } = useAuth();
  const canEdit = hasRole("GOD", "ADMIN");

  if (!canEdit) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <Shield className="h-16 w-16 text-base-content/20" />
        <div>
          <h1 className="text-2xl font-bold text-base-content">Acceso Restringido</h1>
          <p className="text-base-content/60">Necesitas permisos de administrador para acceder a la configuración.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:gap-10">
      {/* Sidebar */}
      <aside className="w-full shrink-0 lg:w-64">
        <div className="sticky top-6 space-y-8">
          <div className="px-2">
            <h2 className="text-xl font-bold text-base-content">Configuración</h2>
            <p className="text-xs font-medium text-base-content/50">Administración del sistema</p>
          </div>

          <nav className="space-y-6">
            {SETTINGS_SECTIONS.map((section) => (
              <div key={section.title} className="space-y-2">
                <h3 className="px-4 text-xs font-semibold uppercase tracking-wider text-base-content/40">
                  {section.title}
                </h3>
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        className={({ isActive }) =>
                          cn(
                            "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200",
                            isActive
                              ? "bg-primary text-primary-content shadow-md shadow-primary/20"
                              : "text-base-content/60 hover:bg-base-200 hover:text-base-content"
                          )
                        }
                      >
                        <Icon size={18} strokeWidth={2} />
                        <span>{item.label}</span>
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>
      </aside>

      {/* Content */}
      <main className="min-w-0 flex-1">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
