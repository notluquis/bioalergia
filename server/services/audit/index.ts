/**
 * Audit Service - Query and manage audit logs
 *
 * Provides functions to:
 * - Get pending (unexported) changes
 * - Export changes to Drive
 * - Mark changes as exported
 * - Revert changes (granular)
 */

import { prisma, Prisma } from "../../prisma.js";
import { logEvent, logWarn } from "../../lib/logger.js";

// Map actual table names (dbName) to Prisma Client model property names (camelCase)
// Define a generic delegate interface for the methods we use
interface GenericPrismaDelegate {
  delete(args: { where: { id: number | string } }): Promise<unknown>;
  update(args: { where: { id: number | string }; data: unknown }): Promise<unknown>;
  create(args: { data: unknown }): Promise<unknown>;
  findMany(): Promise<unknown[]>;
}

const TABLE_TO_MODEL_PROP: Record<string, string> = {};

Prisma.dmmf.datamodel.models.forEach((m) => {
  const tableName = m.dbName || m.name;
  // Prisma Client exposes models as camelCase property (e.g. model User -> prisma.user)
  const modelProp = m.name.charAt(0).toLowerCase() + m.name.slice(1);
  TABLE_TO_MODEL_PROP[tableName] = modelProp;
  // Also handle lowercased table name just in case
  if (tableName.toLowerCase() !== tableName) {
    TABLE_TO_MODEL_PROP[tableName.toLowerCase()] = modelProp;
  }
});

export interface AuditChange {
  id: bigint;
  table_name: string;
  row_id: string;
  operation: "INSERT" | "UPDATE" | "DELETE";
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  diff: Record<string, unknown> | null;
  transaction_id: bigint;
  created_at: Date;
  exported_at: Date | null;
}

/**
 * Get all pending (unexported) changes.
 */
export async function getPendingChanges(): Promise<AuditChange[]> {
  const changes = await prisma.$queryRaw<AuditChange[]>`
    SELECT * FROM audit.data_changes 
    WHERE exported_at IS NULL 
    ORDER BY created_at ASC
  `;
  return changes;
}

/**
 * Get count of pending changes.
 */
export async function getPendingChangesCount(): Promise<number> {
  const result = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) as count FROM audit.data_changes WHERE exported_at IS NULL
  `;
  return Number(result[0].count);
}

/**
 * Get recent changes with pagination.
 */
export async function getRecentChanges(limit = 100, offset = 0): Promise<AuditChange[]> {
  const changes = await prisma.$queryRaw<AuditChange[]>`
    SELECT * FROM audit.data_changes 
    ORDER BY created_at DESC 
    LIMIT ${limit} OFFSET ${offset}
  `;
  return changes;
}

/**
 * Get changes for a specific table.
 */
export async function getChangesByTable(tableName: string, limit = 50): Promise<AuditChange[]> {
  const changes = await prisma.$queryRaw<AuditChange[]>`
    SELECT * FROM audit.data_changes 
    WHERE table_name = ${tableName}
    ORDER BY created_at DESC 
    LIMIT ${limit}
  `;
  return changes;
}

/**
 * Get changes for a specific row.
 */
export async function getRowHistory(tableName: string, rowId: string): Promise<AuditChange[]> {
  const changes = await prisma.$queryRaw<AuditChange[]>`
    SELECT * FROM audit.data_changes 
    WHERE table_name = ${tableName} AND row_id = ${rowId}
    ORDER BY created_at DESC
  `;
  return changes;
}

/**
 * Mark changes as exported.
 */
export async function markAsExported(ids: bigint[]): Promise<void> {
  if (ids.length === 0) return;

  await prisma.$executeRaw`
    UPDATE audit.data_changes 
    SET exported_at = NOW() 
    WHERE id = ANY(${ids}::bigint[])
  `;

  logEvent("audit.marked_exported", { count: ids.length });
}

/**
 * Prepare changes for export (JSON format).
 */
export function formatChangesForExport(changes: AuditChange[]): string {
  const lines = changes.map((change) => {
    return JSON.stringify({
      id: change.id.toString(),
      table: change.table_name,
      row_id: change.row_id,
      op: change.operation,
      diff: change.diff,
      old: change.old_data,
      new: change.new_data,
      ts: change.created_at.toISOString(),
    });
  });

  return lines.join("\n"); // JSONL format
}

/**
 * Revert a specific change by ID.
 * Applies the inverse operation.
 */
export async function revertChange(changeId: bigint): Promise<{ success: boolean; message: string }> {
  const changes = await prisma.$queryRaw<AuditChange[]>`
    SELECT * FROM audit.data_changes WHERE id = ${changeId}
  `;

  if (changes.length === 0) {
    return { success: false, message: "Change not found" };
  }

  const change = changes[0];

  // Security: Validate table name against known models
  const modelProp = TABLE_TO_MODEL_PROP[change.table_name] || TABLE_TO_MODEL_PROP[change.table_name.toLowerCase()];

  if (!modelProp) {
    logWarn("audit.revert_invalid_table", { table: change.table_name });
    return { success: false, message: `Invalid table: ${change.table_name}` };
  }

  try {
    // 3. Execute Revert in Transaction
    // usage of explicit any for dynamic model access is required but scoped
    await prisma.$transaction(async (tx) => {
      // Organic type safety: Cast transaction client to a record of generic delegates
      const txClient = tx as unknown as Record<string, GenericPrismaDelegate>;
      const model = txClient[modelProp];

      if (!model) {
        throw new Error(`Model property '${modelProp}' not found on Prisma Client`);
      }

      // Parse row_id
      const rowId = /^\d+$/.test(change.row_id) ? parseInt(change.row_id, 10) : change.row_id;

      switch (change.operation) {
        case "INSERT":
          // Revert INSERT = DELETE
          await model.delete({ where: { id: rowId } });
          break;

        case "UPDATE": {
          // Revert UPDATE: Use 'diff' to identify ONLY the fields that changed,
          // and restore their values from 'old_data'.
          if (!change.old_data) {
            throw new Error("No old_data available to restore");
          }

          const oldData = change.old_data as Record<string, unknown>;
          const dataToRestore: Record<string, unknown> = {};

          if (change.diff && typeof change.diff === "object" && Object.keys(change.diff).length > 0) {
            const changedKeys = Object.keys(change.diff);
            const skippedKeys: string[] = [];

            changedKeys.forEach((key) => {
              // Skip ID and timestamps if they are managed by DB/Prisma
              if (key === "id" || key === "updated_at" || key === "updatedAt") {
                skippedKeys.push(key);
                return;
              }

              // Ensure we retrieve the value from old_data, even if it's null
              if (Object.prototype.hasOwnProperty.call(oldData, key)) {
                dataToRestore[key] = oldData[key];
              }
            });

            if (Object.keys(dataToRestore).length === 0) {
              if (skippedKeys.length === changedKeys.length) {
                // All changed fields were system fields (ignored) -> Consider this a success (no-op)
                logEvent("audit.revert_skipped", { changeId: changeId.toString(), reason: "only_system_fields" });
                return { success: true, message: "No revertable fields changed (only system fields like updated_at)" };
              } else {
                // Valid fields were changed but missing in old_data
                throw new Error("Cannot revert: Original data is missing for the changed fields");
              }
            }
          } else {
            // Fallback for legacy records without diff
            Object.assign(dataToRestore, oldData);
            delete dataToRestore.id;
          }

          if (Object.keys(dataToRestore).length === 0) {
            throw new Error("No valid fields to revert (change might be empty or restricted)");
          }

          await model.update({
            where: { id: rowId },
            data: dataToRestore,
          });
          break;
        }

        case "DELETE":
          // Revert DELETE = CREATE
          if (!change.old_data) {
            throw new Error("No old_data available to restore");
          }
          await model.create({ data: change.old_data });
          break;
      }
    });

    logEvent("audit.reverted", { changeId: changeId.toString(), table: change.table_name, op: change.operation });
    return { success: true, message: `Reverted ${change.operation} on ${change.table_name}` };
  } catch (error) {
    // Native Prisma Error Handling
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // P2003: Foreign key constraint failed
      if (error.code === "P2003") {
        const field = error.meta?.field_name || "relation";
        return {
          success: false,
          message: `Cannot revert: Linked record is missing (Foreign Key constraint on ${field})`,
        };
      }
      // P2025: Record not found
      if (error.code === "P2025") {
        return { success: false, message: "Cannot revert: The target record no longer exists." };
      }
    }

    logWarn("audit.revert_failed", { changeId: changeId.toString(), error: String(error) });
    return { success: false, message: String(error) };
  }
}

/**
 * Get audit statistics.
 */
export async function getAuditStats(): Promise<{
  totalChanges: number;
  pendingExport: number;
  byTable: { table_name: string; count: number }[];
  byOperation: { operation: string; count: number }[];
}> {
  const [total, pending, byTable, byOp] = await Promise.all([
    prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM audit.data_changes`,
    prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM audit.data_changes WHERE exported_at IS NULL`,
    prisma.$queryRaw<{ table_name: string; count: bigint }[]>`
      SELECT table_name, COUNT(*) as count FROM audit.data_changes 
      GROUP BY table_name ORDER BY count DESC LIMIT 10
    `,
    prisma.$queryRaw<{ operation: string; count: bigint }[]>`
      SELECT operation, COUNT(*) as count FROM audit.data_changes 
      GROUP BY operation ORDER BY count DESC
    `,
  ]);

  return {
    totalChanges: Number(total[0].count),
    pendingExport: Number(pending[0].count),
    byTable: byTable.map((r) => ({ table_name: r.table_name, count: Number(r.count) })),
    byOperation: byOp.map((r) => ({ operation: r.operation, count: Number(r.count) })),
  };
}

/**
 * Cleanup old exported records (default: older than 30 days).
 * This prevents the audit table from growing indefinitely.
 * Only deletes records that have been exported to Drive.
 */
export async function cleanupOldAuditRecords(retentionDays = 30): Promise<{ deleted: number }> {
  const result = await prisma.$executeRaw`
    DELETE FROM audit.data_changes 
    WHERE exported_at IS NOT NULL 
    AND exported_at < NOW() - INTERVAL '${retentionDays} days'
  `;

  if (result > 0) {
    logEvent("audit.cleanup", { deleted: result, retentionDays });
  }

  return { deleted: result };
}
