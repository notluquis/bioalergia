import { Shield, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

const ROLES = [
  {
    id: "GOD",
    name: "Super Admin (GOD)",
    description: "Acceso total al sistema y configuración de bajo nivel.",
    color: "text-warning",
    bg: "bg-warning/10",
  },
  {
    id: "ADMIN",
    name: "Administrador",
    description: "Gestión completa de usuarios, finanzas y operaciones.",
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    id: "ANALYST",
    name: "Analista",
    description: "Acceso a reportes, dashboards y gestión básica.",
    color: "text-secondary",
    bg: "bg-secondary/10",
  },
  {
    id: "VIEWER",
    name: "Visualizador",
    description: "Solo lectura de dashboards y reportes públicos.",
    color: "text-base-content",
    bg: "bg-base-200",
  },
];

const PERMISSIONS = [
  { name: "Gestión de Usuarios (Crear/Editar)", roles: ["GOD", "ADMIN"] },
  { name: "Gestión de Roles y Permisos", roles: ["GOD"] },
  { name: "Configuración del Sistema", roles: ["GOD", "ADMIN"] },
  { name: "Ver Dashboard Financiero", roles: ["GOD", "ADMIN", "ANALYST", "VIEWER"] },
  { name: "Gestionar Transacciones", roles: ["GOD", "ADMIN", "ANALYST"] },
  { name: "Ver Reportes Detallados", roles: ["GOD", "ADMIN", "ANALYST"] },
  { name: "Gestionar Inventario", roles: ["GOD", "ADMIN", "ANALYST"] },
  { name: "Acceso a Logs de Auditoría", roles: ["GOD", "ADMIN"] },
  { name: "Restablecer contraseñas", roles: ["GOD", "ADMIN"] },
  { name: "Eliminar Registros", roles: ["GOD"] },
];

export default function RolesSettingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-base-content text-2xl font-bold">Roles y permisos</h1>
          <p className="text-base-content/60 text-sm">Visualiza los niveles de acceso disponibles en el sistema.</p>
        </div>
        <a href="/settings/users" className="btn btn-primary btn-sm gap-2">
          Gestionar Usuarios
        </a>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {ROLES.map((role) => (
          <div key={role.id} className="surface-elevated space-y-2 rounded-xl p-4">
            <div className={cn("flex h-10 w-10 items-center justify-center rounded-full", role.bg, role.color)}>
              <Shield size={20} />
            </div>
            <h3 className="font-bold">{role.name}</h3>
            <p className="text-base-content/60 text-xs">{role.description}</p>
          </div>
        ))}
      </div>

      <div className="surface-elevated overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th className="w-1/3">Permiso / Acción</th>
                {ROLES.map((role) => (
                  <th key={role.id} className="text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className={cn("text-xs font-bold", role.color)}>{role.id}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map((perm, idx) => (
                <tr key={idx} className="hover:bg-base-200/50">
                  <td className="text-sm font-medium">{perm.name}</td>
                  {ROLES.map((role) => {
                    const hasAccess = perm.roles.includes(role.id);
                    return (
                      <td key={role.id} className="text-center">
                        {hasAccess ? (
                          <Check size={16} className="text-success mx-auto" />
                        ) : (
                          <X size={16} className="text-base-content/20 mx-auto" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
