import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { Users, Shield, Calendar, Box, UserPlus, Loader2, Fingerprint } from "lucide-react";

const SETTINGS_SECTIONS = [
  {
    title: "Mi Cuenta",
    items: [{ label: "Seguridad", to: "/settings/security", icon: Fingerprint, requiresAdmin: false }],
  },
  {
    title: "Administración",
    items: [
      { label: "Usuarios", to: "/settings/users", icon: Users, requiresAdmin: true },
      { label: "Personas", to: "/settings/people", icon: UserPlus, requiresAdmin: true },
      { label: "Roles y Permisos", to: "/settings/roles", icon: Shield, requiresAdmin: true },
      { label: "Accesos", to: "/settings/accesos", icon: Fingerprint, requiresAdmin: true },
    ],
  },
  {
    title: "Configuración de Módulos",
    items: [
      { label: "Calendario", to: "/settings/calendar", icon: Calendar, requiresAdmin: true },
      { label: "Inventario", to: "/settings/inventario", icon: Box, requiresAdmin: true },
    ],
  },
];

export default function SettingsLayout() {
  const { hasRole } = useAuth();
  const canEdit = hasRole("GOD", "ADMIN");
  const location = useLocation();
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  // Clear pending state when location changes (page loaded)
  useEffect(() => {
    setPendingPath(null);
  }, [location.pathname]);

  // Filter sections based on user role
  const visibleSections = SETTINGS_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.requiresAdmin || canEdit),
  })).filter((section) => section.items.length > 0);

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:gap-10">
      {/* Sidebar - horizontal scroll on mobile */}
      <aside className="w-full shrink-0 lg:w-64">
        <div className="space-y-4 lg:sticky lg:top-6 lg:space-y-8">
          <div className="px-2">
            <h2 className="text-base-content text-xl font-bold">Configuración</h2>
          </div>

          {/* Horizontal scroll on mobile, vertical on desktop */}
          <nav className="space-y-4 lg:space-y-6">
            {visibleSections.map((section) => (
              <div key={section.title} className="space-y-2">
                <h3 className="text-base-content/40 px-2 text-xs font-semibold tracking-wider uppercase lg:px-4">
                  {section.title}
                </h3>
                <div className="hide-scrollbar flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isPending = pendingPath === item.to;
                    const isCurrentPath = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);

                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={(item as { end?: boolean }).end}
                        onClick={() => {
                          if (!isCurrentPath) setPendingPath(item.to);
                        }}
                        className={({ isActive }) =>
                          cn(
                            "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium whitespace-nowrap transition-all duration-200 lg:gap-3 lg:px-4 lg:py-2.5",
                            isActive || isPending
                              ? "bg-primary text-primary-content shadow-primary/20 shadow-md"
                              : "bg-base-200/50 text-base-content/60 hover:bg-base-200 hover:text-base-content lg:bg-transparent"
                          )
                        }
                      >
                        <Icon size={18} strokeWidth={2} />
                        <span>{item.label}</span>
                        {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
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
      <main className="min-w-0 flex-1 pb-24 md:pb-0">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
