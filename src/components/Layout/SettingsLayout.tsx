import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { Users, Shield, CreditCard, Calendar, Box, UserPlus, Loader2, Settings, Fingerprint } from "lucide-react";

const SETTINGS_SECTIONS = [
  {
    title: "Personal",
    items: [{ label: "Seguridad", to: "/settings/security", icon: Fingerprint, requiresAdmin: false }],
  },
  {
    title: "General",
    items: [{ label: "Ajustes", to: "/settings/general", icon: Settings, requiresAdmin: true }],
  },
  {
    title: "Organización",
    items: [
      { label: "Usuarios", to: "/settings/users", icon: Users, requiresAdmin: true },
      { label: "Personas", to: "/settings/people", icon: UserPlus, requiresAdmin: true },
      { label: "Roles y Permisos", to: "/settings/roles", icon: Shield, requiresAdmin: true },
    ],
  },
  {
    title: "Módulos",
    items: [
      { label: "Finanzas", to: "/settings/finance", icon: CreditCard, requiresAdmin: true },
      { label: "Calendario", to: "/settings/calendar", icon: Calendar, requiresAdmin: true },
      { label: "Inventario", to: "/settings/inventory", icon: Box, requiresAdmin: true },
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
    <div className="flex flex-col gap-8 lg:flex-row lg:gap-10">
      {/* Sidebar */}
      <aside className="w-full shrink-0 lg:w-64">
        <div className="sticky top-6 space-y-8">
          <div className="px-2">
            <h2 className="text-xl font-bold text-base-content">Configuración</h2>
          </div>

          <nav className="space-y-6">
            {visibleSections.map((section) => (
              <div key={section.title} className="space-y-2">
                <h3 className="px-4 text-xs font-semibold uppercase tracking-wider text-base-content/40">
                  {section.title}
                </h3>
                <div className="space-y-1">
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
                            "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200",
                            isActive || isPending
                              ? "bg-primary text-primary-content shadow-md shadow-primary/20"
                              : "text-base-content/60 hover:bg-base-200 hover:text-base-content"
                          )
                        }
                      >
                        <Icon size={18} strokeWidth={2} />
                        <span className="flex-1">{item.label}</span>
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
      <main className="min-w-0 flex-1">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
