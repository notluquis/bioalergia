/**
 * Audit Service for Hono API
 * Logs audit events to the database
 */

import { db, JsonObject } from "@finanzas/db";

export type AuditAction =
  | "USER_INVITE"
  | "USER_SETUP"
  | "USER_PASSWORD_RESET"
  | "USER_ROLE_UPDATE"
  | "USER_MFA_RESET"
  | "PERSON_CREATE"
  | "PERSON_UPDATE"
  | "SETTINGS_UPDATE"
  | "USER_PASSKEY_DELETE";

interface LogAuditParams {
  userId?: number;
  action: AuditAction;
  entity: string;
  entityId?: string | number;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

export async function logAudit({
  userId,
  action,
  entity,
  entityId,
  details,
  ipAddress,
}: LogAuditParams) {
  try {
    await db.auditLog.create({
      data: {
        userId,
        action,
        entity,
        entityId: entityId ? String(entityId) : null,
        details: details
          ? (JSON.parse(JSON.stringify(details)) as JsonObject)
          : undefined,
        ipAddress,
      },
    });
  } catch (error) {
    console.error("[Audit] Failed to create log:", error);
  }
}
// ... imports

/**
 * Get distinct tables (entities) that have been modified since a specific date.
 * Used for incremental backups.
 */
export async function getTablesWithChanges(since?: Date): Promise<string[]> {
  const where = since ? { createdAt: { gte: since } } : undefined;

  const logs = await db.auditLog.findMany({
    where,
    select: {
      entity: true,
    },
    distinct: ["entity"],
  });

  return logs.map((log) => log.entity);
}

/**
 * Revert a specific audit change (INSERT/UPDATE/DELETE)
 * Returns success/failure status
 */
export async function revertAuditChange(
  changeId: bigint,
  userId: number
): Promise<{ success: boolean; message: string }> {
  try {
    // Fetch the audit log
    const auditLog = await db.auditLog.findUnique({
      where: { id: changeId },
    });

    if (!auditLog) {
      return { success: false, message: "Registro de auditoría no encontrado" };
    }

    const details = auditLog.details as Record<string, unknown> | null;
    const { entity, entityId, action } = auditLog;

    if (!entityId) {
      return { success: false, message: "ID de entidad no disponible" };
    }

    // Map entity names to their corresponding model delegates
    const modelMap: Record<string, any> = {
      User: db.user,
      Person: db.person,
      Employee: db.employee,
      Counterpart: db.counterpart,
      CounterpartAccount: db.counterpartAccount,
      Transaction: db.transaction,
      DailyBalance: db.dailyBalance,
      Event: db.event,
      Service: db.service,
      InventoryItem: db.inventoryItem,
      InventoryCategory: db.inventoryCategory,
      InventoryMovement: db.inventoryMovement,
      SupplyRequest: db.supplyRequest,
      CommonSupply: db.commonSupply,
      EmployeeTimesheet: db.employeeTimesheet,
      Loan: db.loan,
      LoanSchedule: db.loanSchedule,
      DailyProductionBalance: db.dailyProductionBalance,
      Calendar: db.calendar,
      CalendarWatchChannel: db.calendarWatchChannel,
      SyncLog: db.syncLog,
      CalendarSyncLog: db.calendarSyncLog,
      BackupLog: db.backupLog,
      Setting: db.setting,
      PushSubscription: db.pushSubscription,
      Role: db.role,
      Permission: db.permission,
      RolePermission: db.rolePermission,
      UserRoleAssignment: db.userRoleAssignment,
      Passkey: db.passkey,
      // Add more as needed
    };

    const model = modelMap[entity];
    if (!model) {
      return {
        success: false,
        message: `Modelo ${entity} no soportado para reversión`,
      };
    }

    // Perform revert based on action type
    if (action === "INSERT" || action === "CREATE") {
      // Delete the inserted record
      await model.delete({
        where: { id: Number(entityId) },
      });

      // Log the revert action
      await logAudit({
        userId,
        action: "USER_PASSKEY_DELETE" as AuditAction, // Generic delete action
        entity,
        entityId,
        details: { revertedChangeId: String(changeId), action: "DELETE" },
      });

      return { success: true, message: "Registro eliminado correctamente" };
    } else if (action === "UPDATE") {
      // Restore old values
      const oldData = details?.old_data as Record<string, any> | undefined;
      if (!oldData) {
        return {
          success: false,
          message: "Datos originales no disponibles",
        };
      }

      // Filter out system fields that shouldn't be updated
      const {
        id,
        createdAt,
        updatedAt,
        created_at,
        updated_at,
        ...restoreData
      } = oldData;

      await model.update({
        where: { id: Number(entityId) },
        data: restoreData,
      });

      // Log the revert action
      await logAudit({
        userId,
        action: "USER_ROLE_UPDATE" as AuditAction, // Generic update action
        entity,
        entityId,
        details: {
          revertedChangeId: String(changeId),
          restoredData: restoreData,
        },
      });

      return { success: true, message: "Valores restaurados correctamente" };
    } else if (action === "DELETE") {
      // Re-create the deleted record
      const oldData = details?.old_data as Record<string, any> | undefined;
      if (!oldData) {
        return {
          success: false,
          message: "Datos originales no disponibles para recrear",
        };
      }

      // Remove system fields
      const {
        id,
        createdAt,
        updatedAt,
        created_at,
        updated_at,
        ...createData
      } = oldData;

      await model.create({
        data: { ...createData, id: Number(entityId) },
      });

      // Log the revert action
      await logAudit({
        userId,
        action: "PERSON_CREATE" as AuditAction, // Generic create action
        entity,
        entityId,
        details: {
          revertedChangeId: String(changeId),
          recreatedData: createData,
        },
      });

      return { success: true, message: "Registro recreado correctamente" };
    }

    return { success: false, message: "Acción no soportada" };
  } catch (error) {
    console.error("[Audit] Revert error:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Error al revertir cambio",
    };
  }
}

/**
 * Export audit logs to a backup file
 * This is a placeholder - actual implementation depends on backup strategy
 */
export async function exportAuditLogs(): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    // Count unexported logs (placeholder logic)
    const count = await db.auditLog.count();

    // In a real implementation, you would:
    // 1. Fetch logs in batches
    // 2. Write to a backup file/storage
    // 3. Mark logs as exported
    // For now, we just return success

    return {
      success: true,
      message: `${count} registros listos para exportar`,
    };
  } catch (error) {
    console.error("[Audit] Export error:", error);
    return {
      success: false,
      message: "Error al exportar logs",
    };
  }
}
