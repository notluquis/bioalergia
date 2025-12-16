import { Shield, Check, RotateCw, Plus, Loader2 } from "lucide-react";
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import { useToast } from "@/context/ToastContext";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { NAV_SECTIONS } from "@/config/navigation";
import { BulkToggleCell } from "./components/BulkToggleCell";

// --- Types ---

export type Role = {
  id: number;
  name: string;
  description: string | null;
  permissions: { permissionId: number; permission: Permission }[];
};

export type Permission = {
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

  const handleBulkToggle = (role: Role, permissionIdsToToggle: number[]) => {
    const currentPermissionIds = role.permissions.map((p) => p.permissionId);

    // Check if ALL provided permissions are already present
    const allPresent = permissionIdsToToggle.every((id) => currentPermissionIds.includes(id));

    let newPermissionIds;
    if (allPresent) {
      // If all are present, remove them (toggle off)
      newPermissionIds = currentPermissionIds.filter((id) => !permissionIdsToToggle.includes(id));
    } else {
      // If not all are present, add the missing ones (toggle on)
      const missingIds = permissionIdsToToggle.filter((id) => !currentPermissionIds.includes(id));
      newPermissionIds = [...currentPermissionIds, ...missingIds];
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
        if (!item.requiredPermission) return null;

        const subject = item.requiredPermission.subject;
        // Filter permissions matching this subject
        const relatedPermissions = allPermissions.filter((p) => p.subject.toLowerCase() === subject.toLowerCase());

        relatedPermissions.forEach((p) => usedPermissionIds.add(p.id));

        if (relatedPermissions.length === 0) return null;

        return {
          ...item,
          relatedPermissions,
          permissionIds: relatedPermissions.map((p) => p.id),
        };
      })
      .filter((item) => item !== null);

    // Collect ALL permission IDs in this section for the section bulk toggle
    const sectionPermissionIds = itemsWithPermissions.flatMap((item) => item!.permissionIds);

    return {
      ...section,
      items: itemsWithPermissions as NonNullable<(typeof itemsWithPermissions)[number]>[],
      permissionIds: sectionPermissionIds,
    };
  }).filter((section) => section.items.length > 0);

  const otherPermissions = allPermissions.filter((p) => !usedPermissionIds.has(p.id));
  otherPermissions.sort((a, b) => a.subject.localeCompare(b.subject));
  const otherPermissionIds = otherPermissions.map((p) => p.id);

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
                <React.Fragment key={section.title}>
                  {/* Section Title & Bulk Toggle */}
                  <tr className="bg-base-200/30">
                    <td className="py-2 text-xs font-bold tracking-widest uppercase opacity-70">{section.title}</td>
                    {roles.map((role) => (
                      <BulkToggleCell
                        key={role.id}
                        role={role}
                        permissionIds={section.permissionIds}
                        isUpdating={
                          updateRolePermissionsMutation.isPending &&
                          updateRolePermissionsMutation.variables?.roleId === role.id
                        }
                        onToggle={handleBulkToggle}
                        variant="section"
                      />
                    ))}
                  </tr>

                  {/* Section Items (Pages) */}
                  {section.items.map((item) => {
                    const hasMultiple = item.relatedPermissions.length > 1;

                    return (
                      <React.Fragment key={item.label}>
                        {/* If multiple permissions, show Page Header with Bulk Toggle */}
                        {hasMultiple && (
                          <tr className="bg-base-100/50 border-base-100 hover:bg-base-200/20 border-b">
                            <td className="py-2 pl-4 text-sm font-semibold">
                              <div className="flex items-center gap-2">
                                <item.icon className="h-4 w-4 opacity-70" />
                                {item.label} <span className="text-xs font-normal opacity-50">(Todos)</span>
                              </div>
                            </td>
                            {roles.map((role) => (
                              <BulkToggleCell
                                key={role.id}
                                role={role}
                                permissionIds={item.permissionIds}
                                isUpdating={
                                  updateRolePermissionsMutation.isPending &&
                                  updateRolePermissionsMutation.variables?.roleId === role.id
                                }
                                onToggle={handleBulkToggle}
                                variant="page"
                              />
                            ))}
                          </tr>
                        )}

                        {/* Individual Permissions */}
                        {item.relatedPermissions.map((perm) => {
                          const actionMap: Record<string, string> = {
                            read: "Ver",
                            manage: "Administrar",
                            create: "Crear",
                            update: "Editar",
                            delete: "Eliminar",
                          };
                          const actionLabel = actionMap[perm.action] || perm.action;

                          // Consistently format Subject (Action) when falling back, or use label
                          const displayLabel = hasMultiple ? actionLabel : `${item.label} (${actionLabel})`;
                          const indentClass = hasMultiple ? "pl-10" : "pl-6";

                          return (
                            <tr
                              key={perm.id}
                              className="hover:bg-base-200/50 border-base-100 border-b transition-colors last:border-0"
                            >
                              <td className={`py-3 ${indentClass}`}>
                                <div className="flex flex-col">
                                  <span className="flex items-center gap-2 text-sm font-medium">
                                    {!hasMultiple && <item.icon className="h-4 w-4 opacity-70" />}
                                    {displayLabel}
                                  </span>
                                  {/* Cleaner subtext: Always Action • Subject */}
                                  <span className="text-base-content/40 pl-0 font-mono text-[10px]">
                                    {perm.action} • {perm.subject}
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
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              ))}

              {/* Other Permissions (System) */}
              {otherPermissions.length > 0 && (
                <>
                  <tr className="bg-base-200/30">
                    <td className="py-2 text-xs font-bold tracking-widest uppercase opacity-70">Sistema / Avanzado</td>
                    {roles.map((role) => (
                      <BulkToggleCell
                        key={role.id}
                        role={role}
                        permissionIds={otherPermissionIds}
                        isUpdating={
                          updateRolePermissionsMutation.isPending &&
                          updateRolePermissionsMutation.variables?.roleId === role.id
                        }
                        onToggle={handleBulkToggle}
                        variant="section"
                      />
                    ))}
                  </tr>
                  {otherPermissions.map((perm) => {
                    const actionMap: Record<string, string> = {
                      read: "Ver",
                      manage: "Administrar",
                      create: "Crear",
                      update: "Editar",
                      delete: "Eliminar",
                    };
                    const actionLabel = actionMap[perm.action] || perm.action;
                    const subjectLabel = perm.subject === "all" ? "Todo el Sistema" : perm.subject;

                    return (
                      <tr key={perm.id} className="hover:bg-base-200/50 border-base-100 border-b transition-colors">
                        <td className="py-3 pl-6">
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {subjectLabel} ({actionLabel})
                            </span>
                            <span className="text-base-content/40 font-mono text-[10px]">
                              {perm.action} • {perm.subject}
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
