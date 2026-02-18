// No ListBox needed here
import { Card } from "@heroui/react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import type { AnyRoute } from "@tanstack/react-router";
import { useRouter } from "@tanstack/react-router";
import { Plus, RotateCw, Shield } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Select, SelectItem } from "@/components/ui/Select";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { syncPermissions, updateRolePermissions } from "@/features/roles/api";
import { DeleteRoleModal } from "@/features/roles/components/DeleteRoleModal";
import {
  type MatrixItem,
  PermissionsMatrixTable,
} from "@/features/roles/components/PermissionsMatrixTable";
import { RoleFormModal } from "@/features/roles/components/RoleFormModal";
import { roleKeys } from "@/features/roles/queries";
import { apiClient } from "@/lib/api-client";
import { getNavSections, type NavItem, type NavSectionData } from "@/lib/nav-generator";
import { cn } from "@/lib/utils";
import type { NavConfig } from "@/types/navigation";
import type { Permission, Role } from "@/types/roles";

const RolesTelemetryResponseSchema = z.object({}).passthrough();

// --- Page Component ---
export function RolesSettingsPage() {
  const { impersonate } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const toast = useToast();
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedRole, setSelectedRole] = useState<null | Role>(null);
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
    onError: () => {
      toast.error("Error al sincronizar permisos");
    },
    onSettled: () => {
      setIsSyncing(false);
    },
    onSuccess: () => {
      toast.success("Permisos sincronizados con el sistema");
      queryClient.invalidateQueries({ queryKey: ["permissions"] });
    },
  });

  const {
    isPending: isUpdatingPermissions,
    mutate: updatePermissions,
    variables: updatingVariables,
  } = useMutation({
    mutationFn: updateRolePermissions,
    onMutate: async ({ roleId, permissionIds }) => {
      await queryClient.cancelQueries({ queryKey: ["roles"] });
      const previousRoles = queryClient.getQueryData<Role[]>(["roles"]);

      queryClient.setQueryData<Role[]>(["roles"], (old: Role[] | undefined) =>
        optimisticUpdateRole(old, roleId, permissionIds),
      );

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

    const newPermissionIds = hasPermission
      ? currentPermissionIds.filter((id) => id !== permissionId)
      : [...currentPermissionIds, permissionId];

    updatePermissions({ permissionIds: newPermissionIds, roleId: role.id });
  };

  const handleBulkToggle = (role: Role, permissionIdsToToggle: number[]) => {
    const currentPermissionIds = role.permissions.map((p) => p.permissionId);

    // Check if ALL provided permissions are already present
    const allPresent = permissionIdsToToggle.every((id) => currentPermissionIds.includes(id));

    let newPermissionIds: number[];
    if (allPresent) {
      // If all are present, remove them (toggle off)
      newPermissionIds = currentPermissionIds.filter((id) => !permissionIdsToToggle.includes(id));
    } else {
      // If not all are present, add the missing ones (toggle on)
      const missingIds = permissionIdsToToggle.filter((id) => !currentPermissionIds.includes(id));
      newPermissionIds = [...currentPermissionIds, ...missingIds];
    }

    updatePermissions({ permissionIds: newPermissionIds, roleId: role.id });
  };

  // --- Grouping Logic ---

  // Track which permissions are "used" by pages so we can show the rest in "Advanced/System"
  const usedPermissionIds = new Set<number>();

  // Pre-process navigation sections with permission data
  const sectionsWithPermissions = processNavSections(
    getNavSections(router.routeTree),
    allPermissions || [],
    usedPermissionIds,
    buildSubjectNavKeyMap(router.routeTree, allPermissions || []),
  );

  const unmappedSubjects = useMemo(
    () => getUnmappedSubjects(allPermissions || [], usedPermissionIds),
    [allPermissions, usedPermissionIds],
  );

  useEffect(() => {
    if (unmappedSubjects.length === 0) {
      return;
    }
    const payload = {
      subjects: unmappedSubjects,
      total: unmappedSubjects.length,
      timestamp: new Date().toISOString(),
    };
    const key = `roles-unmapped-${payload.subjects.join(",")}`;
    if (sessionStorage.getItem(key)) {
      return;
    }
    sessionStorage.setItem(key, "1");

    if (navigator.sendBeacon) {
      const body = new Blob([JSON.stringify(payload)], { type: "application/json" });
      navigator.sendBeacon("/api/roles/telemetry/unmapped-subjects", body);
      return;
    }

    apiClient
      .post("/api/roles/telemetry/unmapped-subjects", payload, {
        keepalive: true,
        responseSchema: RolesTelemetryResponseSchema,
      })
      .catch((error) => {
        console.warn("[Roles] Telemetry send failed", error);
      });
  }, [unmappedSubjects]);

  return (
    <div className="space-y-6">
      <Card>
        <Card.Header className="flex flex-row items-center justify-between gap-4 border-b pb-4">
          <div className="space-y-1">
            <span className="block font-semibold text-lg">Listado de roles</span>
            <span className="hidden text-default-600 text-sm md:block">
              Gestiona los permisos y roles del sistema
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Role Filter Selector */}
            <div className="hidden sm:block">
              <Select
                aria-label="Filtrar roles"
                className="w-full max-w-50"
                value={viewModeRole}
                onChange={(key) => setViewModeRole(key ? key.toString() : "")}
              >
                <SelectItem id="all" textValue="Ver todos los roles">
                  Ver todos los roles
                </SelectItem>
                {roles.map((r) => (
                  <SelectItem id={r.id.toString()} key={r.id} textValue={r.name}>
                    {r.name}
                  </SelectItem>
                ))}
              </Select>
            </div>

            <div className="ml-2 flex items-center gap-2 border-l pl-2">
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                isDisabled={isSyncing}
                onPress={() => {
                  syncMutation.mutate();
                }}
                title="Sincronizar permisos"
              >
                <RotateCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
              </Button>

              <Button size="sm" variant="primary" className="gap-2" onPress={handleCreateRole}>
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Nuevo rol</span>
              </Button>
            </div>
          </div>
        </Card.Header>
        <Card.Content className="overflow-hidden p-0">
          <PermissionsMatrixTable
            isUpdatingPermissions={isUpdatingPermissions}
            onBulkToggle={handleBulkToggle}
            onDeleteRole={handleDeleteRole}
            onEditRole={handleEditRole}
            onImpersonate={impersonate}
            onPermissionToggle={handlePermissionToggle}
            roles={roles}
            sections={sectionsWithPermissions}
            updatingRoleId={updatingVariables?.roleId}
            viewModeRole={viewModeRole}
          />

          {unmappedSubjects.length > 0 && (
            <div className="border-default-200 border-t px-6 py-3 text-default-500 text-xs">
              Subjects sin ruta: {unmappedSubjects.slice(0, 8).join(", ")}
              {unmappedSubjects.length > 8 && ` +${unmappedSubjects.length - 8} más`}
            </div>
          )}
        </Card.Content>
      </Card>

      {isRoleModalOpen && (
        <RoleFormModal
          isOpen={isRoleModalOpen}
          onClose={() => {
            setIsRoleModalOpen(false);
          }}
          role={selectedRole}
        />
      )}

      {isDeleteModalOpen && selectedRole && (
        <DeleteRoleModal
          allRoles={roles}
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
          }}
          role={selectedRole}
        />
      )}
    </div>
  );
}

// Helper: Optimistic Update Logic
function optimisticUpdateRole(
  oldRoles: Role[] | undefined,
  roleId: number,
  permissionIds: number[],
): Role[] {
  if (!oldRoles) {
    return [];
  }
  return oldRoles.map((role) => {
    if (role.id === roleId) {
      const newPermissions = permissionIds.map((id) => ({
        permission: { action: "", description: "", id, subject: "" }, // Placeholder
        permissionId: id,
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
  usedPermissionIds: Set<number>,
  subjectNavKeyMap: Map<string, Set<string>>,
) {
  const permissionsBySubject = buildPermissionsBySubject(allPermissions);
  const navKeyToSubjects = buildNavKeyToSubjects(subjectNavKeyMap);

  // 1. Get permissions explicitly defined in routes
  // This helps finding permissions even if they are not in the main nav structure
  // Although not strictly used for filtering navigation, it's useful context
  // or could be used to validation if we wanted to enforce strict matching.
  // 2. Map existing permissions to sections
  const mappedSections = navSections
    .map((section: NavSectionData) => {
      const itemsWithPermissions = section.items
        .map((item: NavItem) =>
          buildMatrixItem({
            item,
            navKeyToSubjects,
            permissionsBySubject,
            sectionTitle: section.title,
            usedPermissionIds,
          }),
        )
        .filter((item): item is NonNullable<typeof item> => item !== null);

      const sectionPermissionIds = itemsWithPermissions.flatMap((item) => item.permissionIds);

      return {
        items: itemsWithPermissions,
        permissionIds: sectionPermissionIds,
        title: section.title,
      };
    })
    .filter((section) => section.items.length > 0);

  // 3. Find permissions NOT used in nav sections (System/Technical permissions)
  const technicalPermissions = allPermissions.filter((p) => !usedPermissionIds.has(p.id));

  // For now, show all remaining permissions in a "System" section if any
  if (technicalPermissions.length > 0) {
    // Group by subject to make it readable
    const groupedBySubject = new Map<string, Permission[]>();
    for (const p of technicalPermissions) {
      const existing = groupedBySubject.get(p.subject) || [];
      groupedBySubject.set(p.subject, [...existing, p]);
    }

    const systemItems: MatrixItem[] = Array.from(groupedBySubject.entries()).map(
      ([subject, perms]) => {
        return {
          icon: Shield, // Default icon for system permissions
          label: `${subject} (Sistema)`,
          permissionIds: perms.map((p) => p.id),
          relatedPermissions: perms,
        };
      },
    );

    mappedSections.push({
      title: "Otros Permisos de Sistema",
      items: systemItems,
      permissionIds: technicalPermissions.map((p) => p.id),
    });
  }

  return mappedSections;
}

function getUnmappedSubjects(allPermissions: Permission[], usedPermissionIds: Set<number>) {
  const subjects = new Set<string>();
  const usedSubjects = new Set<string>();

  for (const permission of allPermissions) {
    const subject = permission.subject.toLowerCase();
    subjects.add(subject);
    if (usedPermissionIds.has(permission.id)) {
      usedSubjects.add(subject);
    }
  }

  return Array.from(subjects).filter((subject) => !usedSubjects.has(subject));
}

function getNavKey(section: string, label: string) {
  return `${section}::${label}`;
}

function buildPermissionsBySubject(allPermissions: Permission[]) {
  const map = new Map<string, Permission[]>();
  for (const permission of allPermissions) {
    const key = permission.subject.toLowerCase();
    const existing = map.get(key) ?? [];
    existing.push(permission);
    map.set(key, existing);
  }
  return map;
}

function buildNavKeyToSubjects(subjectNavKeyMap: Map<string, Set<string>>) {
  const navKeyToSubjects = new Map<string, Set<string>>();
  for (const [subject, navKeys] of subjectNavKeyMap.entries()) {
    for (const navKey of navKeys) {
      const existing = navKeyToSubjects.get(navKey) ?? new Set<string>();
      existing.add(subject);
      navKeyToSubjects.set(navKey, existing);
    }
  }
  return navKeyToSubjects;
}

function buildMatrixItem({
  item,
  navKeyToSubjects,
  permissionsBySubject,
  sectionTitle,
  usedPermissionIds,
}: {
  item: NavItem;
  navKeyToSubjects: Map<string, Set<string>>;
  permissionsBySubject: Map<string, Permission[]>;
  sectionTitle: string;
  usedPermissionIds: Set<number>;
}): MatrixItem | null {
  const subjects = new Set<string>();
  if (item.requiredPermission) {
    subjects.add(item.requiredPermission.subject.toLowerCase());
  }

  const navKey = getNavKey(sectionTitle, item.label);
  const extraSubjects = navKeyToSubjects.get(navKey);
  if (extraSubjects) {
    for (const subject of extraSubjects) {
      subjects.add(subject);
    }
  }

  const perms: Permission[] = [];
  for (const subject of subjects) {
    const subjectPerms = permissionsBySubject.get(subject);
    if (subjectPerms) {
      perms.push(...subjectPerms);
    }
  }

  const uniquePermissions = [...new Map(perms.map((p) => [p.id, p])).values()].sort((a, b) =>
    a.subject.localeCompare(b.subject),
  );
  for (const p of uniquePermissions) {
    usedPermissionIds.add(p.id);
  }

  if (uniquePermissions.length === 0) {
    return null;
  }

  return {
    icon: item.icon,
    label: item.label,
    permissionIds: uniquePermissions.map((p) => p.id),
    relatedPermissions: uniquePermissions,
  };
}

type RouteTreeNode = AnyRoute;

function buildSubjectNavKeyMap(routeTreeData: RouteTreeNode, allPermissions: Permission[]) {
  const mapping = new Map<string, Set<string>>();

  const walk = (route: RouteTreeNode, activeNav?: NavConfig) => {
    const currentNav = (route.options?.staticData?.nav as NavConfig | undefined) ?? activeNav;
    const permission = route.options?.staticData?.permission as { subject?: string } | undefined;

    if (permission?.subject && currentNav) {
      const key = getNavKey(currentNav.section, currentNav.label);
      const subject = permission.subject.toLowerCase();
      const existing = mapping.get(subject) ?? new Set<string>();
      existing.add(key);
      mapping.set(subject, existing);
    }

    getRouteChildren(route.children).forEach((child) => {
      walk(child, currentNav);
    });
  };

  walk(routeTreeData);

  return addInferredAliases(mapping, allPermissions);
}

function getRouteChildren(children: RouteTreeNode["children"]): RouteTreeNode[] {
  if (!children) {
    return [];
  }
  if (Array.isArray(children)) {
    return children as RouteTreeNode[];
  }
  if (typeof children === "object") {
    return Object.values(children as Record<string, RouteTreeNode>);
  }
  return [];
}

function addInferredAliases(mapping: Map<string, Set<string>>, allPermissions: Permission[]) {
  const mappedSubjects = Array.from(mapping.keys());
  const mappedTokenMap = new Map(
    mappedSubjects.map((subject) => [subject, tokenizeSubject(subject)]),
  );
  const knownSubjects = new Set(allPermissions.map((perm) => perm.subject.toLowerCase()));

  for (const subject of knownSubjects) {
    if (mapping.has(subject)) {
      continue;
    }
    const best = findBestMappedSubject(subject, mappedSubjects, mappedTokenMap);
    if (!best) {
      continue;
    }
    const target = mapping.get(best);
    if (target) {
      mapping.set(subject, new Set(target));
    }
  }

  return mapping;
}

function findBestMappedSubject(
  subject: string,
  mappedSubjects: string[],
  mappedTokenMap: Map<string, string[]>,
) {
  const subjectLower = subject.toLowerCase();
  const subjectTokens = tokenizeSubject(subjectLower);

  let best: string | null = null;
  let bestScore = 0;

  for (const candidate of mappedSubjects) {
    const score = scoreCandidateSubject(subjectLower, subjectTokens, candidate, mappedTokenMap);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  if (!best || bestScore < 2) {
    return null;
  }
  return best;
}

function scoreCandidateSubject(
  subjectLower: string,
  subjectTokens: string[],
  candidate: string,
  mappedTokenMap: Map<string, string[]>,
) {
  const candidateLower = candidate.toLowerCase();
  const candidateTokens = mappedTokenMap.get(candidate) ?? tokenizeSubject(candidateLower);

  if (subjectLower.includes(candidateLower)) {
    return 1000 + candidateLower.length;
  }

  if (candidateTokens.length === 0) {
    return 0;
  }

  const matchCount = candidateTokens.filter((token) => subjectTokens.includes(token)).length;
  if (matchCount === candidateTokens.length && matchCount > 0) {
    return 500 + matchCount;
  }

  if (matchCount > 0 && candidateLower.length >= 6) {
    return matchCount;
  }

  return 0;
}

function tokenizeSubject(subject: string) {
  const normalized = subject
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .toLowerCase();
  return normalized.split(" ").filter(Boolean);
}
