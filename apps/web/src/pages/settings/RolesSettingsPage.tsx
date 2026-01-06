import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, ChevronRight, Eye, Pencil, Plus, RotateCw, Trash2 } from "lucide-react";
import { Fragment, useCallback, useState } from "react";

import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { SmoothCollapse } from "@/components/ui/SmoothCollapse";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { fetchPermissions, fetchRoles, syncPermissions, updateRolePermissions } from "@/features/roles/api";
import { getNavSections, type NavItem, type NavSectionData } from "@/lib/nav-generator";
import { cn } from "@/lib/utils";
import { Permission, Role } from "@/types/roles";

import { BulkToggleCell } from "./components/BulkToggleCell";
import { DeleteRoleModal } from "./components/DeleteRoleModal";
import { RoleFormModal } from "./components/RoleFormModal";

// --- Page Component ---

export default function RolesSettingsPage() {
  const { impersonate } = useAuth();
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
    queryFn: fetchRoles,
  });

  const permissionsQuery = useQuery({
    queryKey: ["permissions"],
    queryFn: fetchPermissions,
  });

  // Mutations
  const syncMutation = useMutation({
    mutationFn: async () => {
      setIsSyncing(true);
      await syncPermissions();
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

  const {
    mutate: updatePermissions,
    isPending: isUpdatingPermissions,
    variables: updatingVariables,
  } = useMutation({
    mutationFn: updateRolePermissions,
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

  const handlePermissionToggle = useCallback(
    (role: Role, permissionId: number) => {
      const currentPermissionIds = role.permissions.map((p) => p.permissionId);
      const hasPermission = currentPermissionIds.includes(permissionId);

      let newPermissionIds;
      if (hasPermission) {
        newPermissionIds = currentPermissionIds.filter((id) => id !== permissionId);
      } else {
        newPermissionIds = [...currentPermissionIds, permissionId];
      }

      updatePermissions({ roleId: role.id, permissionIds: newPermissionIds });
    },
    [updatePermissions]
  );

  const handleBulkToggle = useCallback(
    (role: Role, permissionIdsToToggle: number[]) => {
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

      updatePermissions({ roleId: role.id, permissionIds: newPermissionIds });
    },
    [updatePermissions]
  );

  if (isLoading) {
    // Standard loading state - could be replaced with a localized skeleton if preferred
    return (
      <div className="flex h-64 items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  // --- Grouping Logic ---

  // Track which permissions are "used" by pages so we can show the rest in "Advanced/System"
  const usedPermissionIds = new Set<number>();

  const sectionsWithPermissions = getNavSections()
    .map((section: NavSectionData) => {
      const itemsWithPermissions = section.items
        .map((item: NavItem) => {
          // Collect permissions for this nav item
          const perms: Permission[] = [];

          // Direct permissions from requiredPermission
          if (item.requiredPermission) {
            const subject = item.requiredPermission.subject;
            const related = allPermissions.filter((p) => p.subject.toLowerCase() === subject.toLowerCase());
            perms.push(...related);
          }

          // Deduplicate
          const uniquePermissions = Array.from(new Map(perms.map((p) => [p.id, p])).values());

          // Mark as used
          uniquePermissions.forEach((p) => usedPermissionIds.add(p.id));

          if (uniquePermissions.length === 0) return null;

          return {
            ...item,
            relatedPermissions: uniquePermissions,
            permissionIds: uniquePermissions.map((p) => p.id),
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      // Collect ALL permission IDs in this section for the section bulk toggle
      const sectionPermissionIds = itemsWithPermissions.flatMap((item) => item.permissionIds);

      return {
        ...section,
        items: itemsWithPermissions,
        permissionIds: sectionPermissionIds,
      };
    })
    .filter((section) => section.items.length > 0);

  const displayRoles = viewModeRole === "all" ? roles : roles.filter((r) => r.id.toString() === viewModeRole);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Listado de roles</h2>
            <p className="text-base-content/70 text-sm">Gestiona los permisos y roles del sistema</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn btn-outline btn-sm gap-2" onClick={() => syncMutation.mutate()} disabled={isSyncing}>
              <RotateCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
              Sincronizar
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

            <button className="btn btn-primary btn-sm gap-2" onClick={handleCreateRole}>
              <Plus className="h-4 w-4" />
              Nuevo rol
            </button>
          </div>
        </CardHeader>
        <CardContent className="overflow-hidden p-0">
          <div className="border-base-300 w-full overflow-x-auto border-t">
            {/* Dynamic Grid Layout */}
            <div className="min-w-full">
              {/* Note: using displayRoles for rendering */}
              <table className="table w-auto table-fixed border-collapse">
                {/* ... Header logic using displayRoles ... */}
                <thead>
                  <tr>
                    <th className="bg-base-100 border-base-300 sticky left-0 z-20 w-80 border-r px-6 text-left">
                      Permiso / acción
                    </th>
                    {displayRoles.map((role) => (
                      <th key={role.id} className="group relative w-32 min-w-32 p-2 text-center align-top">
                        <div className="flex flex-col items-center gap-1">
                          <span className="line-clamp-2 text-base leading-tight font-bold" title={role.name}>
                            {role.name}
                          </span>
                          <span className="line-clamp-2 text-xs font-normal opacity-70" title={role.description || ""}>
                            {role.description || "Sin descripción"}
                          </span>

                          {/* Role Actions - Radix DropdownMenu for proper click-outside */}
                          <div className="mt-2 flex justify-center">
                            <DropdownMenu>
                              <DropdownMenuTrigger className="btn btn-ghost btn-xs h-6 w-full gap-1 font-normal opacity-50 hover:opacity-100">
                                Opciones
                                <ChevronDown className="h-3 w-3" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" sideOffset={4}>
                                <DropdownMenuItem onClick={() => impersonate(role)}>
                                  <Eye className="h-4 w-4" />
                                  Previsualizar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleEditRole(role)}>
                                  <Pencil className="h-4 w-4" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleDeleteRole(role)}
                                  className="text-error focus:text-error"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Eliminar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sectionsWithPermissions.map((section) => (
                    <Fragment key={section.title}>
                      {/* Section Title & Bulk Toggle */}
                      <tr
                        className="bg-base-200/50 hover:bg-base-200/70 border-base-300 cursor-pointer border-b transition-colors"
                        onClick={() => toggleSection(section.title)}
                      >
                        <td className="bg-base-200 border-base-300 sticky left-0 z-10 w-80 border-r py-3 pl-4 text-xs font-bold tracking-widest uppercase">
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
                            isUpdating={isUpdatingPermissions && updatingVariables?.roleId === role.id}
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
                                  // const hasMultiple = item.relatedPermissions.length > 1; // Unused
                                  const itemKey = `${section.title}-${item.label}`;
                                  const isOpen = !!openItems[itemKey];

                                  // For pages that aggregate multiple permissions (typical)
                                  const hasMultiple = item.relatedPermissions.length > 1;

                                  // If it has multiple permissions, we treat it as a collapsible group
                                  if (hasMultiple) {
                                    return (
                                      <Fragment key={item.label}>
                                        {/* Page Header (Collapsible Trigger) */}
                                        <tr
                                          className="bg-base-100/50 hover:bg-base-200/20 border-base-100 cursor-pointer border-b transition-colors"
                                          onClick={() => toggleItem(itemKey)}
                                        >
                                          <td className="bg-base-100 border-base-300 w-80 border-r py-3 pl-8 text-sm font-semibold">
                                            <div className="flex items-center gap-2">
                                              <div className="text-base-content/40 flex h-4 w-4 items-center justify-center">
                                                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                              </div>
                                              <item.icon className="h-4 w-4 opacity-70" />
                                              {item.label}
                                            </div>
                                          </td>
                                          {displayRoles.map((role) => (
                                            <BulkToggleCell
                                              key={role.id}
                                              role={role}
                                              permissionIds={item.permissionIds}
                                              isUpdating={
                                                isUpdatingPermissions && updatingVariables?.roleId === role.id
                                              }
                                              onToggle={handleBulkToggle}
                                              variant="page"
                                              className="py-3"
                                            />
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
                                                        <td className="bg-base-100 border-base-300 w-80 border-r py-2 pl-16 text-sm">
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
                                                          <PermissionCell
                                                            key={role.id}
                                                            role={role}
                                                            permissionId={perm.id}
                                                            isUpdating={false}
                                                            onToggle={handlePermissionToggle}
                                                          />
                                                        ))}
                                                      </tr>
                                                    );
                                                  })}
                                                </tbody>
                                              </table>
                                            </SmoothCollapse>
                                          </td>
                                        </tr>
                                      </Fragment>
                                    );
                                  }

                                  // Single permission item (Rare case in this app, usually it's pages)
                                  // Render as simple row without collapse
                                  const perm = item.relatedPermissions[0];
                                  if (!perm) return null; // Should not happen due to filter

                                  const actionMap: Record<string, string> = {
                                    read: "Ver",
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
                                      <td className="bg-base-100 border-base-300 w-80 border-r py-3 pl-8">
                                        <div className="flex flex-col">
                                          <span className="flex items-center gap-2 text-sm font-medium">
                                            <item.icon className="h-4 w-4 opacity-70" />
                                            {displayLabel}
                                          </span>
                                          <span className="text-base-content/60 pl-6 font-mono text-[10px]">
                                            {perm.action} • {perm.subject}
                                          </span>
                                        </div>
                                      </td>
                                      {displayRoles.map((role) => (
                                        <PermissionCell
                                          key={role.id}
                                          role={role}
                                          permissionId={perm.id}
                                          isUpdating={false}
                                          onToggle={handlePermissionToggle}
                                        />
                                      ))}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </SmoothCollapse>
                        </td>
                      </tr>
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

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
  className,
}: {
  role: Role;
  permissionId: number;
  isUpdating: boolean;
  onToggle: (r: Role, i: number) => void;
  className?: string;
}) {
  const hasAccess = role.permissions.some((rp) => rp.permissionId === permissionId);

  return (
    <td className={`p-0 text-center align-middle ${className || ""}`}>
      <button
        onClick={() => onToggle(role, permissionId)}
        disabled={isUpdating}
        className="group mx-auto flex h-8 w-full items-center justify-center transition-colors"
      >
        {/* Solid badge style for better visibility */}
        {hasAccess ? (
          <div className="bg-primary hover:bg-primary-focus flex h-5 w-5 items-center justify-center rounded-md shadow-sm transition-transform active:scale-95">
            <Check size={12} className="text-primary-content" />
          </div>
        ) : (
          <div className="border-base-300 bg-base-100 group-hover:border-primary/50 group-hover:bg-primary/5 h-5 w-5 rounded-md border-2 transition-colors" />
        )}
      </button>
    </td>
  );
}
