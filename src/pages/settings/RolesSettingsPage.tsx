import { Loader2, Pencil, Trash2, Plus, RotateCw, Check, ChevronDown, ChevronRight } from "lucide-react";
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import { useToast } from "@/context/ToastContext";
import { NAV_SECTIONS } from "@/config/navigation";
import { BulkToggleCell } from "./components/BulkToggleCell";
import { RoleFormModal } from "./components/RoleFormModal";
import { DeleteRoleModal } from "./components/DeleteRoleModal";
import { Role, Permission } from "@/types/roles";

// --- Page Component ---

export default function RolesSettingsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const toggleSection = (title: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

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
      // toast.error("Error al actualizar permisos");
    },
  });

  // Handlers
  const handleCreateRole = () => {
    setSelectedRole(null);
    setIsRoleModalOpen(true);
  };

  const handleEditRole = (role: Role) => {
    setSelectedRole(role);
    setIsRoleModalOpen(true);
  };

  const handleDeleteRole = (role: Role) => {
    setSelectedRole(role);
    setIsDeleteModalOpen(true);
  };

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
          <button className="btn btn-outline gap-2" onClick={() => syncMutation.mutate()} disabled={isSyncing}>
            <RotateCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
            Sincronizar Permisos
          </button>
          <button className="btn btn-primary gap-2" onClick={handleCreateRole}>
            <Plus className="h-4 w-4" />
            Nuevo Rol
          </button>
        </div>
      </div>

      <div className="border-base-300 overflow-x-auto rounded-md border">
        <table className="table">
          <thead>
            <tr>
              <th className="bg-base-100 border-base-300 sticky left-0 z-20 w-80 border-r px-6 text-left">
                Permiso / Acción
              </th>
              {roles.map((role) => (
                <th key={role.id} className="group relative min-w-45 p-2 text-center align-top">
                  <div className="flex flex-col items-center gap-1">
                    <span className="line-clamp-2 text-base leading-tight font-bold" title={role.name}>
                      {role.name}
                    </span>
                    <span className="line-clamp-2 text-xs font-normal opacity-70" title={role.description || ""}>
                      {role.description || "Sin descripción"}
                    </span>

                    {/* Role Actions - Visible on hover/group - Moved to static position to avoid overlap */}
                    <div className="bg-base-100/50 mt-2 flex justify-center gap-1 rounded-full p-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        className="hover:bg-base-200 text-base-content/70 hover:text-primary btn btn-ghost btn-xs btn-circle h-6 w-6"
                        title="Editar Rol"
                        onClick={() => handleEditRole(role)}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        className="hover:bg-error/10 text-error/70 hover:text-error btn btn-ghost btn-xs btn-circle h-6 w-6"
                        title="Eliminar Rol"
                        onClick={() => handleDeleteRole(role)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sectionsWithPermissions.map((section) => (
              <React.Fragment key={section.title}>
                {/* Section Title & Bulk Toggle */}
                <tr
                  className="bg-base-200/30 hover:bg-base-200/50 cursor-pointer transition-colors"
                  onClick={() => toggleSection(section.title)}
                >
                  <td className="bg-base-200 border-base-300 sticky left-0 z-10 border-r py-2 text-xs font-bold tracking-widest uppercase opacity-70">
                    <div className="flex items-center gap-2">
                      {openSections[section.title] ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      {section.title}
                    </div>
                  </td>
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

                {/* Section Items (Pages) - Collapsible */}
                {openSections[section.title] &&
                  section.items.map((item) => {
                    const hasMultiple = item.relatedPermissions.length > 1;

                    return (
                      <React.Fragment key={item.label}>
                        {/* If multiple permissions, show Page Header with Bulk Toggle */}
                        {hasMultiple && (
                          <tr className="bg-base-100/50 border-base-100 hover:bg-base-200/20 border-b">
                            <td className="bg-base-100 border-base-300 sticky left-0 z-10 border-r py-2 pl-4 text-sm font-semibold">
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
                              <td
                                className={`bg-base-100 sticky left-0 z-10 py-3 ${indentClass} border-base-300 border-r`}
                              >
                                <div className="flex flex-col">
                                  <span className="flex items-center gap-2 text-sm font-medium">
                                    {!hasMultiple && <item.icon className="h-4 w-4 opacity-70" />}
                                    {displayLabel}
                                  </span>
                                  {/* Cleaner subtext: Always Action • Subject */}
                                  <span className="text-base-content/60 pl-0 font-mono text-[10px]">
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
                <tr
                  className="bg-base-200/30 hover:bg-base-200/50 cursor-pointer transition-colors"
                  onClick={() => toggleSection("advanced")}
                >
                  <td className="bg-base-200 border-base-300 sticky left-0 z-10 border-r py-2 text-xs font-bold tracking-widest uppercase opacity-70">
                    <div className="flex items-center gap-2">
                      {openSections["advanced"] ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      Sistema / Avanzado
                    </div>
                  </td>
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
                {openSections["advanced"] &&
                  otherPermissions.map((perm) => {
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
                        <td className="bg-base-100 border-base-300 sticky left-0 z-10 border-r py-3 pl-6">
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {subjectLabel} ({actionLabel})
                            </span>
                            <span className="text-base-content/60 font-mono text-[10px]">
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

      {isRoleModalOpen && (
        <RoleFormModal isOpen={isRoleModalOpen} onClose={() => setIsRoleModalOpen(false)} role={selectedRole} />
      )}

      {isDeleteModalOpen && selectedRole && (
        <DeleteRoleModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          role={selectedRole}
          allRoles={roles}
        />
      )}
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
          hasAccess ? "hover:bg-error/10" : "hover:bg-success/10"
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
