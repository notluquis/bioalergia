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
import { SmoothCollapse } from "@/components/ui/SmoothCollapse";

// --- Page Component ---

export default function RolesSettingsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [viewModeRole, setViewModeRole] = useState<string>("all");

  const toggleSection = (title: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

  const toggleItem = (key: string) => {
    setOpenItems((prev) => ({
      ...prev,
      [key]: !prev[key],
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
    onMutate: async ({ roleId, permissionIds }) => {
      await queryClient.cancelQueries({ queryKey: ["roles"] });
      const previousRoles = queryClient.getQueryData<Role[]>(["roles"]);

      queryClient.setQueryData<Role[]>(["roles"], (old) => {
        if (!old) return [];
        return old.map((role) => {
          if (role.id === roleId) {
            // Reconstruct permissions array based on IDs (we only need permissionId for UI check)
            // Note: We lose the full Permission object here temporarily, but UI only checks permissionId
            // The invalidateQueries will fetch the full object back
            const newPermissions = permissionIds.map((id) => ({
              permissionId: id,
              permission: { id, action: "", subject: "", description: "" }, // Placeholder
            }));
            return { ...role, permissions: newPermissions };
          }
          return role;
        });
      });

      return { previousRoles };
    },
    onError: (_err, _newTodo, context) => {
      // toast.error("Error al actualizar permisos");
      if (context?.previousRoles) {
        queryClient.setQueryData(["roles"], context.previousRoles);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
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

  const displayRoles = viewModeRole === "all" ? roles : roles.filter((r) => r.id.toString() === viewModeRole);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-base-content text-2xl font-bold">Roles y permisos</h1>
          <p className="text-base-content/60 text-sm">Gestiona el acceso por secciones y páginas.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-outline gap-2" onClick={() => syncMutation.mutate()} disabled={isSyncing}>
            <RotateCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
            Sincronizar permisos
          </button>

          {/* Role Filter Selector */}
          <select
            className="select select-bordered select-sm max-w-xs"
            value={viewModeRole}
            onChange={(e) => setViewModeRole(e.target.value)}
          >
            <option value="all">Ver todos los roles</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>

          <button className="btn btn-primary gap-2" onClick={handleCreateRole}>
            <Plus className="h-4 w-4" />
            Nuevo rol
          </button>
        </div>
      </div>

      <div className="border-base-300 overflow-x-auto rounded-md border pb-24">
        {/* Dynamic Grid Layout */}
        <div className="min-w-full">
          {/* Note: using displayRoles for rendering */}
          <table className="table w-full table-fixed">
            {/* ... Header logic using displayRoles ... */}
            <thead>
              <tr>
                <th className="bg-base-100 border-base-300 sticky left-0 z-20 w-80 border-r px-6 text-left">
                  Permiso / acción
                </th>
                {displayRoles.map((role) => (
                  <th key={role.id} className="group relative w-48 min-w-48 p-2 text-center align-top">
                    <div className="flex flex-col items-center gap-1">
                      <span className="line-clamp-2 text-base leading-tight font-bold" title={role.name}>
                        {role.name}
                      </span>
                      <span className="line-clamp-2 text-xs font-normal opacity-70" title={role.description || ""}>
                        {role.description || "Sin descripción"}
                      </span>

                      {/* Role Actions - Dropdown for cleaner UI */}
                      <div className="mt-2 flex justify-center">
                        <details className="dropdown dropdown-end dropdown-bottom">
                          <summary className="btn btn-ghost btn-xs h-6 w-full gap-1 font-normal opacity-50 hover:opacity-100">
                            Opciones
                            <ChevronDown className="h-3 w-3" />
                          </summary>
                          <ul className="menu dropdown-content bg-base-100 rounded-box border-base-200 z-1 w-40 border p-2 shadow-sm">
                            <li>
                              <button onClick={() => handleEditRole(role)} className="gap-2">
                                <Pencil className="h-4 w-4" />
                                Editar
                              </button>
                            </li>
                            <li>
                              <button
                                onClick={() => handleDeleteRole(role)}
                                className="text-error hover:text-error gap-2"
                              >
                                <Trash2 className="h-4 w-4" />
                                Eliminar
                              </button>
                            </li>
                          </ul>
                        </details>
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
                    <td className="bg-base-200 border-base-300 sticky left-0 z-10 w-80 border-r py-2 text-xs font-bold tracking-widest uppercase opacity-70">
                      <div className="flex items-center gap-2">
                        {openSections[section.title] ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        {section.title}
                      </div>
                    </td>
                    {displayRoles.map((role) => (
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

                  {/* Collapsible Content Row */}
                  <tr>
                    <td colSpan={displayRoles.length + 1} className="border-0 p-0">
                      <SmoothCollapse isOpen={!!openSections[section.title]}>
                        <table className="w-full table-fixed">
                          <tbody>
                            {section.items.map((item) => {
                              const hasMultiple = item.relatedPermissions.length > 1;
                              const itemKey = `${section.title}-${item.label}`;
                              const isOpen = !!openItems[itemKey];

                              // If it has multiple permissions, we treat it as a collapsible group
                              if (hasMultiple) {
                                return (
                                  <React.Fragment key={item.label}>
                                    {/* Page Header (Collapsible Trigger) */}
                                    <tr
                                      className="bg-base-100/50 hover:bg-base-200/20 border-base-100 cursor-pointer border-b transition-colors"
                                      onClick={() => toggleItem(itemKey)}
                                    >
                                      <td className="bg-base-100 border-base-300 w-80 border-r py-2 pl-4 text-sm font-semibold">
                                        <div className="flex items-center gap-2">
                                          <div className="text-base-content/40 flex h-4 w-4 items-center justify-center">
                                            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                          </div>
                                          <item.icon className="h-4 w-4 opacity-70" />
                                          {item.label}
                                        </div>
                                      </td>
                                      {displayRoles.map((role) => (
                                        <td key={role.id} className="w-48 min-w-48 p-2 text-center align-top">
                                          <BulkToggleCell
                                            role={role}
                                            permissionIds={item.permissionIds}
                                            isUpdating={
                                              updateRolePermissionsMutation.isPending &&
                                              updateRolePermissionsMutation.variables?.roleId === role.id
                                            }
                                            onToggle={handleBulkToggle}
                                            variant="page"
                                          />
                                        </td>
                                      ))}
                                    </tr>

                                    {/* Individual Permissions (Collapsible) */}
                                    <tr>
                                      <td colSpan={displayRoles.length + 1} className="border-0 p-0">
                                        <SmoothCollapse isOpen={isOpen}>
                                          <table className="w-full table-fixed">
                                            <tbody>
                                              {item.relatedPermissions.map((perm) => {
                                                const actionMap: Record<string, string> = {
                                                  read: "Ver",
                                                  manage: "Administrar",
                                                  create: "Crear",
                                                  update: "Editar",
                                                  delete: "Eliminar",
                                                };
                                                const actionLabel = actionMap[perm.action] || perm.action;

                                                return (
                                                  <tr
                                                    key={perm.id}
                                                    className="hover:bg-base-200/50 border-base-100 border-b transition-colors last:border-0"
                                                  >
                                                    <td className="bg-base-100 border-base-300 w-80 border-r py-2 pl-12 text-sm">
                                                      <div className="flex flex-col">
                                                        <span className="flex items-center gap-2 font-medium">
                                                          {actionLabel}
                                                        </span>
                                                        <span className="text-base-content/60 font-mono text-[10px]">
                                                          {perm.action} • {perm.subject}
                                                        </span>
                                                      </div>
                                                    </td>
                                                    {displayRoles.map((role) => (
                                                      <td
                                                        key={role.id}
                                                        className="w-48 min-w-48 p-0 text-center align-middle"
                                                      >
                                                        <PermissionCell
                                                          role={role}
                                                          permissionId={perm.id}
                                                          isUpdating={false}
                                                          onToggle={handlePermissionToggle}
                                                        />
                                                      </td>
                                                    ))}
                                                  </tr>
                                                );
                                              })}
                                            </tbody>
                                          </table>
                                        </SmoothCollapse>
                                      </td>
                                    </tr>
                                  </React.Fragment>
                                );
                              }

                              // Single permission item (Rare case in this app, usually it's pages)
                              // Render as simple row without collapse
                              const perm = item.relatedPermissions[0];
                              if (!perm) return null; // Should not happen due to filter

                              const actionMap: Record<string, string> = {
                                read: "Ver",
                                manage: "Administrar",
                                create: "Crear",
                                update: "Editar",
                                delete: "Eliminar",
                              };
                              const actionLabel = actionMap[perm.action] || perm.action;
                              const displayLabel = `${item.label} (${actionLabel})`;

                              return (
                                <tr
                                  key={perm.id}
                                  className="hover:bg-base-200/50 border-base-100 border-b transition-colors last:border-0"
                                >
                                  <td className="bg-base-100 border-base-300 w-80 border-r py-3 pl-6">
                                    <div className="flex flex-col">
                                      <span className="flex items-center gap-2 text-sm font-medium">
                                        <item.icon className="h-4 w-4 opacity-70" />
                                        {displayLabel}
                                      </span>
                                      <span className="text-base-content/60 pl-0 font-mono text-[10px]">
                                        {perm.action} • {perm.subject}
                                      </span>
                                    </div>
                                  </td>
                                  {displayRoles.map((role) => (
                                    <td key={role.id} className="w-48 min-w-48 p-0 text-center align-middle">
                                      <PermissionCell
                                        role={role}
                                        permissionId={perm.id}
                                        isUpdating={false}
                                        onToggle={handlePermissionToggle}
                                      />
                                    </td>
                                  ))}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </SmoothCollapse>
                    </td>
                  </tr>
                </React.Fragment>
              ))}

              {/* Other Permissions (System) */}
              {otherPermissions.length > 0 && (
                <>
                  <tr
                    className="bg-base-200/30 hover:bg-base-200/50 cursor-pointer transition-colors"
                    onClick={() => toggleSection("advanced")}
                  >
                    <td className="bg-base-200 border-base-300 sticky left-0 z-10 w-80 border-r py-2 text-xs font-bold tracking-widest uppercase opacity-70">
                      <div className="flex items-center gap-2">
                        {openSections["advanced"] ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        Sistema / avanzado
                      </div>
                    </td>
                    {displayRoles.map((role) => (
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
                  {/* Collapsible System Row */}
                  <tr>
                    <td colSpan={displayRoles.length + 1} className="border-0 p-0">
                      <SmoothCollapse isOpen={!!openSections["advanced"]}>
                        <table className="w-full table-fixed">
                          <tbody>
                            {otherPermissions.map((perm) => {
                              const actionMap: Record<string, string> = {
                                read: "Ver",
                                manage: "Administrar",
                                create: "Crear",
                                update: "Editar",
                                delete: "Eliminar",
                              };
                              const actionLabel = actionMap[perm.action] || perm.action;
                              const subjectLabel = perm.subject === "all" ? "Todo el sistema" : perm.subject;

                              return (
                                <tr
                                  key={perm.id}
                                  className="hover:bg-base-200/50 border-base-100 border-b transition-colors"
                                >
                                  <td className="bg-base-100 border-base-300 w-80 border-r py-3 pl-6">
                                    <div className="flex flex-col">
                                      <span className="font-medium">
                                        {subjectLabel} ({actionLabel})
                                      </span>
                                      <span className="text-base-content/60 font-mono text-[10px]">
                                        {perm.action} • {perm.subject}
                                      </span>
                                    </div>
                                  </td>
                                  {displayRoles.map((role) => (
                                    <td key={role.id} className="w-48 min-w-48 p-0 text-center align-middle">
                                      <PermissionCell
                                        role={role}
                                        permissionId={perm.id}
                                        isUpdating={false}
                                        onToggle={handlePermissionToggle}
                                      />
                                    </td>
                                  ))}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </SmoothCollapse>
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
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
        className="group mx-auto flex h-12 w-full items-center justify-center transition-colors"
      >
        {/* Solid badge style for better visibility */}
        {hasAccess ? (
          <div className="bg-primary hover:bg-primary-focus flex h-6 w-6 items-center justify-center rounded-md shadow-sm transition-transform active:scale-95">
            <Check size={14} className="text-primary-content" />
          </div>
        ) : (
          <div className="border-base-300 group-hover:border-primary/50 group-hover:bg-primary/5 h-6 w-6 rounded-md border-2 transition-colors" />
        )}
      </button>
    </td>
  );
}
