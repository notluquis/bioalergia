import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Plus, RotateCw } from "lucide-react";
import { useState } from "react";

import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { syncPermissions, updateRolePermissions } from "@/features/roles/api";
import { DeleteRoleModal } from "@/features/roles/components/DeleteRoleModal";
import { PermissionsMatrixTable } from "@/features/roles/components/PermissionsMatrixTable";
import { RoleFormModal } from "@/features/roles/components/RoleFormModal";
import { roleKeys } from "@/features/roles/queries";
import { getNavSections, type NavItem, type NavSectionData } from "@/lib/nav-generator";
import { cn } from "@/lib/utils";
import { Permission, Role } from "@/types/roles";

// --- Page Component ---

export default function RolesSettingsPage() {
  const { impersonate } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [viewModeRole, setViewModeRole] = useState<string>("all");

  // Queries
  const { data: roles } = useSuspenseQuery(roleKeys.lists());

  const { data: allPermissions } = useSuspenseQuery(roleKeys.permissions());

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

      queryClient.setQueryData<Role[]>(["roles"], (old) => optimisticUpdateRole(old, roleId, permissionIds));

      return { previousRoles };
    },
    onError: (_err, _newTodo, context) => {
      toast.error("Error al actualizar permisos. Inténtalo de nuevo.");
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

  const handlePermissionToggle = (role: Role, permissionId: number) => {
    const currentPermissionIds = role.permissions.map((p) => p.permissionId);
    const hasPermission = currentPermissionIds.includes(permissionId);

    let newPermissionIds;
    newPermissionIds = hasPermission
      ? currentPermissionIds.filter((id) => id !== permissionId)
      : [...currentPermissionIds, permissionId];

    updatePermissions({ roleId: role.id, permissionIds: newPermissionIds });
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

    updatePermissions({ roleId: role.id, permissionIds: newPermissionIds });
  };

  // --- Grouping Logic ---

  // Track which permissions are "used" by pages so we can show the rest in "Advanced/System"
  const usedPermissionIds = new Set<number>();

  // Pre-process navigation sections with permission data
  const sectionsWithPermissions = processNavSections(getNavSections(), allPermissions || [], usedPermissionIds);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 border-b pb-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Listado de roles</h2>
            <p className="text-base-content/70 hidden text-sm md:block">Gestiona los permisos y roles del sistema</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Role Filter Selector */}
            <div className="hidden sm:block">
              <select
                className="select select-bordered select-sm w-full max-w-50"
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
            </div>

            <div className="ml-2 flex items-center gap-2 border-l pl-2">
              <button
                className="btn btn-ghost btn-sm btn-square"
                onClick={() => syncMutation.mutate()}
                disabled={isSyncing}
                title="Sincronizar permisos"
              >
                <RotateCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
              </button>

              <button className="btn btn-primary btn-sm gap-2" onClick={handleCreateRole}>
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Nuevo rol</span>
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-hidden p-0">
          <PermissionsMatrixTable
            roles={roles}
            sections={sectionsWithPermissions}
            viewModeRole={viewModeRole}
            isUpdatingPermissions={isUpdatingPermissions}
            updatingRoleId={updatingVariables?.roleId}
            onPermissionToggle={handlePermissionToggle}
            onBulkToggle={handleBulkToggle}
            onEditRole={handleEditRole}
            onDeleteRole={handleDeleteRole}
            onImpersonate={impersonate}
          />
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

// Helper: Optimistic Update Logic
function optimisticUpdateRole(oldRoles: Role[] | undefined, roleId: number, permissionIds: number[]): Role[] {
  if (!oldRoles) return [];
  return oldRoles.map((role) => {
    if (role.id === roleId) {
      const newPermissions = permissionIds.map((id) => ({
        permissionId: id,
        permission: { id, action: "", subject: "", description: "" }, // Placeholder
      }));
      return { ...role, permissions: newPermissions };
    }
    return role;
  });
}

// Helper: Navigation Processing Logic
// Updated return type to match PermissionsMatrixTable requirements implicitly
function processNavSections(
  navSections: NavSectionData[],
  allPermissions: Permission[],
  usedPermissionIds: Set<number>
) {
  return navSections
    .map((section: NavSectionData) => {
      const itemsWithPermissions = section.items
        .map((item: NavItem) => {
          const perms: Permission[] = [];

          if (item.requiredPermission) {
            const subject = item.requiredPermission.subject;
            const related = allPermissions.filter((p) => p.subject.toLowerCase() === subject.toLowerCase());
            perms.push(...related);
          }

          const uniquePermissions = [...new Map(perms.map((p) => [p.id, p])).values()];
          uniquePermissions.forEach((p) => usedPermissionIds.add(p.id));

          if (uniquePermissions.length === 0) return null;

          return {
            label: item.label,
            icon: item.icon,
            relatedPermissions: uniquePermissions,
            permissionIds: uniquePermissions.map((p) => p.id),
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      const sectionPermissionIds = itemsWithPermissions.flatMap((item) => item.permissionIds);

      return {
        title: section.title,
        items: itemsWithPermissions,
        permissionIds: sectionPermissionIds,
      };
    })
    .filter((section) => section.items.length > 0);
}
