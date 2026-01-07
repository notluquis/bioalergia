import { db } from "@finanzas/db";

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

export async function createRole(data: any) {
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

export async function updateRole(id: number, data: any) {
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

export async function assignPermissionsToRole(
  roleId: number,
  permissionIds: number[]
) {
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
  const subjects = [
    "User",
    "Transaction",
    "Setting",
    "Role",
    "Permission",
    "Person",
    "Counterpart",
    "Loan",
    "Service",
    "InventoryItem",
    "ProductionBalance",
    "CalendarEvent",
    "Employee",
    "Timesheet",
    "Report",
    "SupplyRequest",
    "Dashboard",
    "Backup",
    "BulkData",
    // New dedicated subjects for specific pages
    "DailyBalance",
    "ProductionBalance",
    "CalendarSetting",
    "InventorySetting",
    "Integration",
  ];

  const actions = ["create", "read", "update", "delete"];

  const created: string[] = [];

  for (const subject of subjects) {
    for (const action of actions) {
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
      }
    }
  }

  return { synced: created.length, created };
}
