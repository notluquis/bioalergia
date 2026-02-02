import type { RoleCreateArgs, RoleUpdateArgs } from "@finanzas/db";
import { db, schema } from "@finanzas/db";

// Extract input types from Zenstack args
type RoleCreateInput = NonNullable<RoleCreateArgs["data"]>;
type RoleUpdateInput = NonNullable<RoleUpdateArgs["data"]>;

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
  return await db.permission.findMany({
    orderBy: { subject: "asc" },
  });
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
