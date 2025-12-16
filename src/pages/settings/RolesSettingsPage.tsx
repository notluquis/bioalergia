import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { Shield, Check, RotateCw, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/context/ToastContext";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { NAV_SECTIONS } from "@/config/navigation";

// --- Types ---

type Role = {
  id: number;
  name: string;
  description: string | null;
  permissions: { permissionId: number; permission: Permission }[];
};

type Permission = {
  id: number;
  action: string;
  subject: string;
  description: string | null;
};

// --- Page Component ---

export default function RolesSettingsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [isSyncing, setIsSyncing] = useState(false);

  // Queries
  const rolesQuery = useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const res = await apiClient.get<{ status: string; roles: Role[] }>("/api/roles");
      return res.roles;
    },
  });

  const permissionsQuery = useQuery({
    queryKey: ["permissions"],
    queryFn: async () => {
      const res = await apiClient.get<{ status: string; permissions: Permission[] }>("/api/permissions");
      return res.permissions;
    },
  });

  // Mutations
  const syncMutation = useMutation({
    mutationFn: async () => {
      setIsSyncing(true);
      await apiClient.post("/api/permissions/sync", {});
    },
    onSuccess: () => {
      toast.success("Permisos sincronizados con el sistema");
      queryClient.invalidateQueries({ queryKey: ["permissions"] });
    },
    onError: () => {
      toast.error("Error al sincronizar permisos");
    },
    onSettled: () => setIsSyncing(false),
  });

  const updateRolePermissionsMutation = useMutation({
    mutationFn: async ({ roleId, permissionIds }: { roleId: number; permissionIds: number[] }) => {
      await apiClient.post(`/api/roles/${roleId}/permissions`, { permissionIds });
    },
    onSuccess: () => {
      // toast.success("Permisos actualizados"); // Too noisy
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: () => {
      toast.error("Error al actualizar permisos");
    },
  });

  const createRoleMutation = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      await apiClient.post("/api/roles", data);
    },
    onSuccess: () => {
      toast.success("Rol creado");
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
  });

  // Derived state
  const roles = rolesQuery.data || [];
  const allPermissions = permissionsQuery.data || [];
  const isLoading = rolesQuery.isLoading || permissionsQuery.isLoading;

  const handlePermissionToggle = (role: Role, permissionId: number) => {
    const currentPermissionIds = role.permissions.map((p) => p.permissionId);
    const hasPermission = currentPermissionIds.includes(permissionId);

    let newPermissionIds;
    if (hasPermission) {
      newPermissionIds = currentPermissionIds.filter((id) => id !== permissionId);
    } else {
      newPermissionIds = [...currentPermissionIds, permissionId];
    }

    updateRolePermissionsMutation.mutate({ roleId: role.id, permissionIds: newPermissionIds });
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
      </div>
    );
  }

  // --- Grouping Logic ---

  // Track which permissions are "used" by pages so we can show the rest in "Advanced/System"
  const usedPermissionIds = new Set<number>();

  const sectionsWithPermissions = NAV_SECTIONS.map((section) => {
    const itemsWithPermissions = section.items
      .map((item) => {
        // Find all permissions related to this item's subject
        // If item has no subject, maybe it's public or we skip it?
        if (!item.requiredPermission) return null;

        const subject = item.requiredPermission.subject;

        // Filter permissions matching this subject (case insensitive just in case, though usually exact)
        const relatedPermissions = allPermissions.filter((p) => p.subject.toLowerCase() === subject.toLowerCase());

        relatedPermissions.forEach((p) => usedPermissionIds.add(p.id));

        return {
          ...item,
          relatedPermissions,
        };
      })
      .filter((item) => item !== null && item.relatedPermissions.length > 0);

    return {
      ...section,
      items: itemsWithPermissions,
    };
  }).filter((section) => section.items.length > 0);

  // Find remaining permissions not linked to any page (e.g., manage.all, user.delete if distinct from page?)
  // Actually "user.delete" has subject "User", if "RRHH" uses subject "Employee" or "User", let's check.
  // Sidebar says RRHH -> requiredPermission: { action: "read", subject: "Employee" }.
  // Users Page? Not in sidebar explicitly? Ah, "Usuarios" might be under Admin?
  // Let's check config/navigation.
  // Administration -> Settings (subject: Setting).
  // "SystemAdministrator" needs manage.all.

  const otherPermissions = allPermissions.filter((p) => !usedPermissionIds.has(p.id));

  // Sort other permissions by subject for cleanliness
  otherPermissions.sort((a, b) => a.subject.localeCompare(b.subject));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-base-content text-2xl font-bold">Roles y Permisos</h1>
          <p className="text-base-content/60 text-sm">Gestiona el acceso por secciones y páginas.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => syncMutation.mutate()} disabled={isSyncing}>
            <RotateCw className={cn("mr-2 h-4 w-4", isSyncing && "animate-spin")} />
            Sincronizar
          </Button>
          <CreateRoleDialog onCreate={createRoleMutation.mutate} />
        </div>
      </div>

      {/* Role Headers (Card View) */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {roles.map((role) => (
          <div key={role.id} className="surface-elevated space-y-2 rounded-xl p-4 transition-all hover:shadow-md">
            <div className="flex items-start justify-between">
              <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-full">
                <Shield size={20} />
              </div>
            </div>
            <h3 className="font-bold">{role.name}</h3>
            <p className="text-base-content/60 line-clamp-2 text-xs">{role.description || "Sin descripción"}</p>
          </div>
        ))}
      </div>

      {/* Permissions Table Grouped by Sections */}
      <div className="surface-elevated border-base-200 overflow-hidden rounded-2xl border">
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr className="border-b-2">
                <th className="bg-base-200/50 w-1/3 min-w-50">Acceso / Recurso</th>
                {roles.map((role) => (
                  <th key={role.id} className="bg-base-200/50 min-w-25 text-center">
                    <span className="text-xs font-bold">{role.name}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sectionsWithPermissions.map((section) => (
                <>
                  {/* Section Title */}
                  <tr key={section.title} className="bg-base-200/30">
                    <td
                      colSpan={roles.length + 1}
                      className="py-2 text-xs font-bold tracking-widest uppercase opacity-70"
                    >
                      {section.title}
                    </td>
                  </tr>

                  {/* Section Items (Pages) */}
                  {section.items.map((item) => {
                    if (!item) return null;

                    // Group permissions by this page (read, manage, etc.)
                    // item.relatedPermissions are all permissions matching the subject
                    // We want to show a single row for the Page, with columns for actions?
                    // No, the table structure is Roles as columns.
                    // So we show the Page Name, and maybe list the actions underneath or have separate rows per action?
                    // User wants "Movimientos" -> [Checkboxes for roles]

                    // Current implementation lists every permission in a new row.
                    // To make it cleaner:
                    // Row: "Movimientos" (Page Label)
                    // Subtext: "Ver (Read), Editar (Manage)" -> Wait, granular control means we need a checkbox for EACH permission.
                    // If we have separate Read/Manage permissions, we need separate toggles.
                    // Let's render:
                    // Row 1: Movimientos (Ver)
                    // Row 2: Movimientos (Editar) - if applicable.
                    // Using the Page Label + Action Label.

                    return item.relatedPermissions.map((perm) => {
                      // Map action to friendly name
                      const actionLabel =
                        perm.action === "read" ? "Ver" : perm.action === "manage" ? "Administrar" : perm.action;
                      const fullLabel = `${item.label} (${actionLabel})`;

                      return (
                        <tr key={perm.id} className="hover:bg-base-200/50 border-base-100 border-b transition-colors">
                          <td className="py-3 pl-6">
                            <div className="flex flex-col">
                              <span className="flex items-center gap-2 font-medium">
                                <item.icon className="h-4 w-4 opacity-70" />
                                {fullLabel}
                              </span>
                              <span className="text-base-content/40 pl-6 font-mono text-[10px]">
                                {perm.description || `${perm.action}.${perm.subject}`}
                              </span>
                            </div>
                          </td>
                          {roles.map((role) => (
                            <PermissionCell
                              key={role.id}
                              role={role}
                              permissionId={perm.id}
                              isUpdating={
                                updateRolePermissionsMutation.isPending &&
                                updateRolePermissionsMutation.variables?.roleId === role.id
                              }
                              onToggle={handlePermissionToggle}
                            />
                          ))}
                        </tr>
                      );
                    });
                  })}
                </>
              ))}

              {/* Other Permissions (System) */}
              {otherPermissions.length > 0 && (
                <>
                  <tr className="bg-base-200/30">
                    <td
                      colSpan={roles.length + 1}
                      className="py-2 text-xs font-bold tracking-widest uppercase opacity-70"
                    >
                      Sistema / Avanzado
                    </td>
                  </tr>
                  {otherPermissions.map((perm) => {
                    const actionLabel =
                      perm.action === "read" ? "Ver" : perm.action === "manage" ? "Administrar" : perm.action;
                    // Try to humanize subject
                    const subjectLabel = perm.subject === "all" ? "Todo el Sistema" : perm.subject;

                    return (
                      <tr key={perm.id} className="hover:bg-base-200/50 border-base-100 border-b transition-colors">
                        <td className="py-3 pl-6">
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {subjectLabel} ({actionLabel})
                            </span>
                            <span className="text-base-content/40 font-mono text-[10px]">
                              {perm.action}.{perm.subject}
                            </span>
                          </div>
                        </td>
                        {roles.map((role) => (
                          <PermissionCell
                            key={role.id}
                            role={role}
                            permissionId={perm.id}
                            isUpdating={
                              updateRolePermissionsMutation.isPending &&
                              updateRolePermissionsMutation.variables?.roleId === role.id
                            }
                            onToggle={handlePermissionToggle}
                          />
                        ))}
                      </tr>
                    );
                  })}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PermissionCell({
  role,
  permissionId,
  isUpdating,
  onToggle,
}: {
  role: Role;
  permissionId: number;
  isUpdating: boolean;
  onToggle: (r: Role, i: number) => void;
}) {
  const hasAccess = role.permissions.some((rp) => rp.permissionId === permissionId);

  return (
    <td className="p-0 text-center align-middle">
      <button
        onClick={() => onToggle(role, permissionId)}
        disabled={isUpdating}
        className={cn(
          "mx-auto flex h-12 w-full items-center justify-center px-4 transition-colors",
          hasAccess ? "hover:bg-red-500/10" : "hover:bg-green-500/10"
        )}
      >
        {isUpdating ? (
          <Loader2 className="text-base-content/40 h-4 w-4 animate-spin" />
        ) : hasAccess ? (
          <Check size={18} className="text-success" />
        ) : (
          <div className="border-base-300 bg-base-100 h-4 w-4 rounded-full border" />
        )}
      </button>
    </td>
  );
}

function CreateRoleDialog({ onCreate }: { onCreate: (data: { name: string; description: string }) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [open, setOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate({ name, description });
    setOpen(false);
    setName("");
    setDescription("");
  };

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} className="gap-2">
        <Plus size={16} />
        Nuevo Rol
      </Button>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Crear Nuevo Rol">
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Nombre</label>
            <Input
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              placeholder="Ej. Editor de Contenidos"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Descripción</label>
            <Input
              value={description}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
              placeholder="Descripción breve del rol"
            />
          </div>
          <div className="flex justify-end pt-4">
            <Button type="submit">Crear Rol</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
