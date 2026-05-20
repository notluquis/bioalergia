import { Button, Card, Label, ListBox, Select } from "@heroui/react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import type { AnyRoute } from "@tanstack/react-router";
import { useRouter } from "@tanstack/react-router";
import {
  Calendar as CalendarIcon,
  FileText,
  Heart,
  MessageSquare,
  Package,
  Plus,
  Plug,
  RotateCw,
  Settings as SettingsIcon,
  Shield,
  Stethoscope,
  Users,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  sendUnmappedSubjectsTelemetry,
  syncPermissions,
  updateRolePermissions,
} from "@/features/roles/api";
import { DeleteRoleModal } from "@/features/roles/components/DeleteRoleModal";
import {
  type MatrixItem,
  PermissionsMatrixTable,
} from "@/features/roles/components/PermissionsMatrixTable";
import { RoleFormModal } from "@/features/roles/components/RoleFormModal";
import { roleKeys } from "@/features/roles/queries";
import { getNavSections, type NavItem, type NavSectionData } from "@/lib/nav-generator";
import { cn } from "@/lib/utils";
import type { NavConfig } from "@/types/navigation";
import type { Permission, Role } from "@/types/roles";

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
      // syncPermissions() rebuilds the permission CATALOG, which feeds the
      // matrix columns via roleKeys.permissions() (queryKey ["permissions"]) —
      // a different key from the roles list (["roles"]). Invalidate both, or
      // the toast fires but the table never refetches the new permissions.
      void queryClient.invalidateQueries({ queryKey: roleKeys.lists().queryKey });
      void queryClient.invalidateQueries({ queryKey: roleKeys.permissions().queryKey });
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
        optimisticUpdateRole(old, roleId, permissionIds)
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
      void queryClient.invalidateQueries({ queryKey: ["roles"] });
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

  // Pre-process navigation sections with permission data
  const { sectionsWithPermissions, unmappedSubjects } = useMemo(() => {
    // Track which permissions are "used" by pages so we can show the rest in "Advanced/System"
    const usedPermissionIds = new Set<number>();
    const sections = processNavSections(
      getNavSections(router.routeTree),
      allPermissions || [],
      usedPermissionIds,
      buildSubjectNavKeyMap(router.routeTree, allPermissions || [])
    );
    return {
      sectionsWithPermissions: sections,
      unmappedSubjects: getUnmappedSubjects(allPermissions || [], usedPermissionIds),
    };
  }, [allPermissions, router.routeTree]);

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

    sendUnmappedSubjectsTelemetry(payload).catch((error) => {
      console.warn("[Roles] Telemetry send failed", error);
    });
  }, [unmappedSubjects]);

  return (
    <div className="space-y-6">
      <Card>
        <Card.Header className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <span className="block font-semibold text-lg">Listado de roles</span>
            <span className="text-default-600 text-sm">
              Gestiona los permisos y roles del sistema
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Role Filter Selector */}
            <div className="hidden sm:block">
              <Select
                className="w-full max-w-50"
                value={viewModeRole}
                onChange={(key) => setViewModeRole(key ? key.toString() : "")}
              >
                <Label className="sr-only">Filtrar roles</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    <ListBox.Item id="all" textValue="Ver todos los roles">
                      Ver todos los roles
                    </ListBox.Item>
                    {roles.map((r) => (
                      <ListBox.Item id={r.id.toString()} key={r.id} textValue={r.name}>
                        {r.name}
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                isIconOnly
                size="sm"
                variant="outline"
                isDisabled={isSyncing}
                onPress={() => {
                  syncMutation.mutate();
                }}
              >
                <RotateCw className={cn("size-4", isSyncing && "")} />
              </Button>

              <Button size="sm" variant="primary" className="gap-2" onPress={handleCreateRole}>
                <Plus className="size-4" />
                <span>Nuevo rol</span>
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
  permissionIds: number[]
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
  subjectNavKeyMap: Map<string, Set<string>>
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
          })
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

  // 3. Categorise permissions NOT used in nav sections by domain so the
  // admin sees logical buckets ("Clínica", "Finanzas", "Comunicaciones"…)
  // instead of one flat "Otros Permisos de Sistema" wall of names.
  // Golden-2026 RBAC UI: group by feature/domain, then by subject —
  // mirrors how Auth0, AWS IAM and Linear lay out permission matrices.
  const technicalPermissions = allPermissions.filter((p) => !usedPermissionIds.has(p.id));

  if (technicalPermissions.length > 0) {
    // Bucket by categorised subject. The category function keys off the
    // PascalCase subject name and uses substring patterns — adding a
    // new subject just needs one line in CATEGORY_RULES.
    const buckets = new Map<string, Map<string, Permission[]>>();
    for (const p of technicalPermissions) {
      const category = categorizeSubject(p.subject);
      let categoryBucket = buckets.get(category);
      if (!categoryBucket) {
        categoryBucket = new Map();
        buckets.set(category, categoryBucket);
      }
      const subjectBucket = categoryBucket.get(p.subject) ?? [];
      subjectBucket.push(p);
      categoryBucket.set(p.subject, subjectBucket);
    }

    // Stable, opinionated section order — top-of-mind clinical work
    // first, then admin/system stuff. Categories not in this list fall
    // through to the bottom alphabetically.
    const sectionOrder = [
      "Clínica",
      "Informes y documentos",
      "Pacientes",
      "Agenda",
      "Comunicaciones",
      "Operaciones",
      "Finanzas",
      "DTE / Facturación",
      "RRHH",
      "Integraciones",
      "Configuración",
      "Sistema y seguridad",
      "Otros",
    ];
    const orderedCategories = Array.from(buckets.keys()).sort((a, b) => {
      const ai = sectionOrder.indexOf(a);
      const bi = sectionOrder.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });

    for (const category of orderedCategories) {
      const categoryBucket = buckets.get(category);
      if (!categoryBucket) continue;
      const icon = CATEGORY_ICONS[category] ?? Shield;
      const items: MatrixItem[] = Array.from(categoryBucket.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([subject, perms]) => ({
          icon,
          label: subject,
          permissionIds: perms.map((p) => p.id),
          relatedPermissions: perms,
        }));
      mappedSections.push({
        title: category,
        items,
        permissionIds: items.flatMap((i) => i.permissionIds),
      });
    }
  }

  return mappedSections;
}

// ── Permission-category mapping ──────────────────────────────────────
//
// `categorizeSubject` returns the section bucket for a permission whose
// `subject` (a PascalCase model name like `ExamReportReaction` or
// `WhatsappBusinessLabel`) isn't surfaced by the nav. The rules are
// ordered: the first matching pattern wins. Add new subjects by either
// extending an existing pattern or appending a new `{ category, test }`
// block — there's no manual subject-by-subject map to keep in sync.

const CATEGORY_RULES: { category: string; test: (subject: string) => boolean }[] = [
  // Most-specific patterns first (Wa* / Whatsapp* before everything).
  {
    category: "Comunicaciones",
    test: (s) => /^(Wa|Whatsapp|Baileys|Outreach|PatientCampaign|PushSubscription)/i.test(s),
  },
  // Doctoralia is an integration but high-frequency clinical — own group.
  {
    category: "Integraciones",
    test: (s) => /^(Doctoralia|Haulmer|MercadoPago|ProviderCredential)/i.test(s),
  },
  { category: "DTE / Facturación", test: (s) => /^(DTE|EventDte)/i.test(s) },
  {
    category: "Informes y documentos",
    test: (s) =>
      /^(ExamReport|ConclusionTemplate|MedicalCertificate|Report|PatientAttachment|BulkData)/i.test(
        s
      ),
  },
  { category: "Agenda", test: (s) => /^(Calendar|Event|Service)/i.test(s) },
  { category: "Clínica", test: (s) => /^(Clinical|Consultation|AbandonmentContact)/i.test(s) },
  { category: "Pacientes", test: (s) => /^(Patient|Person|Address)/i.test(s) },
  {
    category: "Operaciones",
    test: (s) =>
      /^(Shipment|CommonSupply|SupplyRequest|Inventory|Office|ProductionBalance|DailyProductionBalance)/i.test(
        s
      ),
  },
  {
    category: "RRHH",
    test: (s) =>
      /^(Employee|Timesheet|TimesheetAudit|TimesheetList|Attendance|AttendanceAdmin|AttendanceMark|Compensation)/i.test(
        s
      ),
  },
  {
    category: "Finanzas",
    test: (s) =>
      /^(Transaction|Expense|Budget|Counterpart|Balance|DailyBalance|ReleaseTransaction|Settlement|WithdrawTransaction|PersonalCredit|UtilityAccount|UtilityBillSnapshot|Loan|BankAccount)/i.test(
        s
      ),
  },
  {
    category: "Configuración",
    test: (s) => /^(ClinicSettings|Setting|Holiday|Tax|ServiceTemplate)$|^Setting/i.test(s),
  },
  {
    category: "Sistema y seguridad",
    test: (s) =>
      /^(User|Role|Permission|Passkey|AuditLog|DebugToken|Backup|SyncLog|SecurityAlertState|Dashboard)/i.test(
        s
      ),
  },
];

function categorizeSubject(subject: string): string {
  for (const rule of CATEGORY_RULES) {
    if (rule.test(subject)) return rule.category;
  }
  return "Otros";
}

const CATEGORY_ICONS: Record<string, typeof Shield> = {
  Clínica: Stethoscope,
  "Informes y documentos": FileText,
  Pacientes: Heart,
  Agenda: CalendarIcon,
  Comunicaciones: MessageSquare,
  Operaciones: Package,
  Finanzas: Wallet,
  "DTE / Facturación": Wallet,
  RRHH: Users,
  Integraciones: Plug,
  Configuración: SettingsIcon,
  "Sistema y seguridad": Shield,
  Otros: Shield,
};

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
    a.subject.localeCompare(b.subject)
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
    const relatedSubjects = route.options?.staticData?.relatedSubjects as string[] | undefined;

    if (currentNav) {
      const key = getNavKey(currentNav.section, currentNav.label);

      if (permission?.subject) {
        const subject = permission.subject.toLowerCase();
        const existing = mapping.get(subject) ?? new Set<string>();
        existing.add(key);
        mapping.set(subject, existing);
      }

      if (relatedSubjects) {
        for (const subject of relatedSubjects) {
          const subjectLower = subject.toLowerCase();
          const existing = mapping.get(subjectLower) ?? new Set<string>();
          existing.add(key);
          mapping.set(subjectLower, existing);
        }
      }
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
    mappedSubjects.map((subject) => [subject, tokenizeSubject(subject)])
  );
  const knownSubjects = new Set(allPermissions.map((perm) => perm.subject.toLowerCase()));

  // Build token → navKey frequency index for section-based fallback (pass 2)
  const tokenToNavKeyScores = new Map<string, Map<string, number>>();
  for (const [subject, navKeys] of mapping.entries()) {
    for (const token of tokenizeSubject(subject)) {
      if (token.length < 4) continue;
      const navKeyMap = tokenToNavKeyScores.get(token) ?? new Map<string, number>();
      for (const navKey of navKeys) {
        navKeyMap.set(navKey, (navKeyMap.get(navKey) ?? 0) + 1);
      }
      tokenToNavKeyScores.set(token, navKeyMap);
    }
  }

  for (const subject of knownSubjects) {
    if (mapping.has(subject)) {
      continue;
    }

    // Pass 1: direct containment + token matching
    const best = findBestMappedSubject(subject, mappedSubjects, mappedTokenMap);
    if (best) {
      const target = mapping.get(best);
      if (target) mapping.set(subject, new Set(target));
      continue;
    }

    // Pass 2: token-based section inference — collapse navKey scores to section level
    const tokens = tokenizeSubject(subject).filter((t) => t.length >= 4);
    if (tokens.length === 0) continue;

    const sectionScores = new Map<string, number>();
    const sectionFirstNavKey = new Map<string, string>();

    for (const token of tokens) {
      const navKeyScores = tokenToNavKeyScores.get(token);
      if (!navKeyScores) continue;
      for (const [navKey, count] of navKeyScores) {
        const section = navKey.split("::")[0] ?? navKey;
        sectionScores.set(section, (sectionScores.get(section) ?? 0) + count);
        if (!sectionFirstNavKey.has(section)) {
          sectionFirstNavKey.set(section, navKey);
        }
      }
    }

    if (sectionScores.size === 0) continue;

    const sorted = [...sectionScores.entries()].sort((a, b) => b[1] - a[1]);
    const topEntry = sorted[0];
    if (!topEntry) continue;
    const bestSection = topEntry[0];
    const bestNavKey = sectionFirstNavKey.get(bestSection);
    if (bestNavKey) {
      mapping.set(subject, new Set([bestNavKey]));
    }
  }

  return mapping;
}

function findBestMappedSubject(
  subject: string,
  mappedSubjects: string[],
  mappedTokenMap: Map<string, string[]>
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

  if (!best || bestScore < 1) {
    return null;
  }
  return best;
}

function scoreCandidateSubject(
  subjectLower: string,
  subjectTokens: string[],
  candidate: string,
  mappedTokenMap: Map<string, string[]>
) {
  const candidateLower = candidate.toLowerCase();
  const candidateTokens = mappedTokenMap.get(candidate) ?? tokenizeSubject(candidateLower);

  if (subjectLower.includes(candidateLower)) {
    return 1000 + candidateLower.length;
  }
  // Also check reverse: candidate is a superstring of subject (e.g. "calendar" → "calendarschedule")
  if (candidateLower.includes(subjectLower) && subjectLower.length >= 4) {
    return 1000 + subjectLower.length;
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
