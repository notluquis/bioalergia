import { db, schema } from "@finanzas/db";
import type { RoleCreateArgs, RoleUpdateArgs } from "@finanzas/db/input";
import { filterSafePermissions } from "../lib/permission-validator";
import { getSetting, updateSetting } from "./settings";

// Extract input types from Zenstack args
type RoleCreateInput = NonNullable<RoleCreateArgs["data"]>;
type RoleUpdateInput = NonNullable<RoleUpdateArgs["data"]>;
export interface RoleMapping {
  app_role: string;
  employee_role: string;
}

const ROLE_MAPPINGS_SETTING_KEY = "roles:employee-role-mappings";

export async function listRoles() {
  return await db.role.findMany({
    include: {
      permissions: {
        include: {
          permission: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function createRole(data: RoleCreateInput) {
  const existing = await db.role.findFirst({
    where: { name: { equals: data.name, mode: "insensitive" } },
  });
  if (existing) {
    throw new Error("El rol ya existe (nombre duplicado o muy similar)");
  }
  return await db.role.create({
    data,
  });
}

export async function updateRole(id: number, data: RoleUpdateInput) {
  if (data.name) {
    const existing = await db.role.findFirst({
      where: {
        name: { equals: data.name, mode: "insensitive" },
        id: { not: id },
      },
    });
    if (existing) {
      throw new Error("El rol ya existe (nombre duplicado o muy similar)");
    }
  }
  return await db.role.update({
    where: { id },
    data,
  });
}

export async function deleteRole(id: number) {
  return await db.role.delete({
    where: { id },
  });
}

export async function listRoleUsers(roleId: number) {
  const users = await db.user.findMany({
    where: {
      roles: {
        some: {
          roleId,
        },
      },
    },
    orderBy: {
      person: {
        names: "asc",
      },
    },
    select: {
      id: true,
      loginEmail: true,
      person: {
        select: {
          email: true,
          fatherName: true,
          names: true,
        },
      },
    },
  });

  return users.map((user) => ({
    email: user.loginEmail || user.person?.email || "",
    id: user.id,
    person: user.person
      ? {
          fatherName: user.person.fatherName ?? "",
          names: user.person.names,
        }
      : null,
  }));
}

export async function reassignRoleUsers(roleId: number, targetRoleId: number) {
  if (roleId === targetRoleId) {
    throw new Error("El rol de destino debe ser distinto al rol actual");
  }

  const [sourceRole, targetRole] = await Promise.all([
    db.role.findUnique({ where: { id: roleId }, select: { id: true } }),
    db.role.findUnique({ where: { id: targetRoleId }, select: { id: true } }),
  ]);

  if (!sourceRole) {
    throw new Error("Rol de origen no encontrado");
  }

  if (!targetRole) {
    throw new Error("Rol de destino no encontrado");
  }

  return await db.$transaction(async (tx) => {
    const assignments = await tx.userRoleAssignment.findMany({
      where: { roleId },
      select: { userId: true },
    });

    if (assignments.length === 0) {
      return { reassigned: 0 };
    }

    await tx.userRoleAssignment.createMany({
      data: assignments.map((assignment) => ({
        roleId: targetRoleId,
        userId: assignment.userId,
      })),
      skipDuplicates: true,
    });

    await tx.userRoleAssignment.deleteMany({
      where: { roleId },
    });

    return { reassigned: assignments.length };
  });
}

export async function getRoleMappings(): Promise<RoleMapping[]> {
  const raw = await getSetting(ROLE_MAPPINGS_SETTING_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(
        (item): item is RoleMapping =>
          typeof item === "object" &&
          item !== null &&
          typeof item.app_role === "string" &&
          typeof item.employee_role === "string",
      )
      .map((item) => ({
        app_role: item.app_role.trim(),
        employee_role: item.employee_role.trim(),
      }))
      .filter((item) => item.app_role.length > 0 && item.employee_role.length > 0)
      .sort((a, b) => a.employee_role.localeCompare(b.employee_role));
  } catch {
    return [];
  }
}

export async function saveRoleMapping(mapping: RoleMapping) {
  const appRole = mapping.app_role.trim();
  const employeeRole = mapping.employee_role.trim();

  if (!appRole || !employeeRole) {
    throw new Error("Mapeo inválido");
  }

  const role = await db.role.findUnique({
    where: { name: appRole },
    select: { id: true },
  });

  if (!role) {
    throw new Error("El rol de aplicación no existe");
  }

  const existing = await getRoleMappings();
  const next = [
    ...existing.filter((item) => item.employee_role !== employeeRole),
    { app_role: appRole, employee_role: employeeRole },
  ].sort((a, b) => a.employee_role.localeCompare(b.employee_role));

  await updateSetting(ROLE_MAPPINGS_SETTING_KEY, JSON.stringify(next));

  return { status: "ok" as const };
}

export async function assignPermissionsToRole(roleId: number, permissionIds: number[]) {
  return await db.$transaction(async (tx) => {
    // Clear existing permissions
    await tx.rolePermission.deleteMany({
      where: { roleId },
    });

    // Add new ones
    if (permissionIds.length > 0) {
      const data = permissionIds.map((permId) => ({
        roleId,
        permissionId: permId,
      }));
      await tx.rolePermission.createMany({
        data,
        skipDuplicates: true,
      });
    }

    return true;
  });
}

export async function listPermissions() {
  const allPermissions = await db.permission.findMany({
    orderBy: { subject: "asc" },
  });

  // Filter out dangerous/non-standard permissions before returning
  // See: lib/permission-validator.ts for validation logic
  return filterSafePermissions(allPermissions);
}

/**
 * Sync permissions by ensuring standard CRUD permissions exist for major subjects
 */
export async function syncPermissions() {
  // 1. Auto-discover model names from ZenStack schema
  const modelSubjects = Object.keys(schema.models);

  // 2. Define virtual/logical subjects that don't map directly to models
  const virtualSubjects = [
    "Report",
    "Dashboard",
    "Backup",
    "BulkData",
    "Integration",
    "DebugToken",
    "CalendarSetting",
    "InventorySetting",
    "CalendarSchedule",
    "CalendarDaily",
    "CalendarHeatmap",
    // Page-specific virtual subjects
    "TransactionList",
    "TransactionStats",
    "TransactionCSV",
    "ServiceList",
    "ServiceAgenda",
    "ServiceTemplate",
    "TimesheetList",
    "TimesheetAudit",
  ];

  // 3. Combine and merge
  const subjects = [...modelSubjects, ...virtualSubjects];

  const actions = ["create", "read", "update", "delete"];

  // Use a Set to ensure unique subjects and remove any potential duplicates
  const uniqueSubjects = Array.from(new Set(subjects));

  const created: string[] = [];
  let skipped = 0;
  const errors: string[] = [];

  for (const subject of uniqueSubjects) {
    for (const action of actions) {
      try {
        // Check if permission exists
        const existing = await db.permission.findFirst({
          where: { action, subject },
        });

        if (!existing) {
          await db.permission.create({
            data: {
              action,
              subject,
              description: `Auto-generated ${action} for ${subject}`,
            },
          });
          created.push(`${action}:${subject}`);
        } else {
          skipped++;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[syncPermissions] Failed to sync ${action}:${subject}:`, message);
        errors.push(`${action}:${subject} (${message})`);
      }
    }
  }

  return {
    created: created.length,
    skipped,
    errors: errors.length > 0 ? errors : undefined,
    total: uniqueSubjects.length * actions.length,
    details: created,
  };
}
