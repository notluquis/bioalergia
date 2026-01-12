import { AuditAction, logAudit } from "../services/audit";

interface ZenStackPlugin {
  id: string;
  onQuery?: (params: {
    model?: string;
    operation: string;
    args: any;
    proceed: (args: any) => Promise<any>;
  }) => Promise<any>;
}

/**
 * ZenStack Plugin to automatically audit log write operations.
 *
 * This plugin intercepts "create", "update", "delete", "upsert",
 * "createMany", "updateMany", and "deleteMany" operations.
 * It executes the operation and then logs the result to the AuditLog table.
 *
 * @param userId - ID of the user performing the action (from session)
 * @param ipAddress - IP address of the request
 */
export function AuditLoggingPlugin(
  userId?: number,
  ipAddress?: string
): ZenStackPlugin {
  return {
    id: "audit-logger",
    onQuery: async ({ model, operation, args, proceed }) => {
      // 1. Execute the query first
      // We need the result (e.g., the created ID) for the log
      const result = await proceed(args);

      // 2. Filter irrelevant operations (read-only)
      const writeOps = [
        "create",
        "update",
        "delete",
        "upsert",
        "createMany",
        "updateMany",
        "deleteMany",
      ];

      // If no model (raw query) or not a write op, just return result
      if (!model || !writeOps.includes(operation)) return result;

      // 3. Filter system tables to avoid recursion/spam
      // AuditLog: prevent infinite loop
      // BackupLog, SyncLog, CalendarSyncLog: system logs, not user actions
      if (
        [
          "AuditLog",
          "BackupLog",
          "SyncLog",
          "CalendarSyncLog",
          "CalendarWatchChannel",
        ].includes(model)
      ) {
        return result;
      }

      // 4. Asynchronously log the change (Fire & Forget)
      // We don't want to block the response time for auditing
      (async () => {
        try {
          let action: AuditAction = "SETTINGS_UPDATE"; // Default generic fallback

          // Determine specific action based on operation
          if (operation.includes("create")) {
            action = "PERSON_CREATE"; // Generic CREATE mapping
          } else if (operation.includes("update")) {
            action = "USER_ROLE_UPDATE"; // Generic UPDATE mapping
          } else if (operation.includes("delete")) {
            action = "USER_PASSKEY_DELETE"; // Generic DELETE mapping
          }

          // Refine action based on specific critical models if needed
          // (Can be expanded later for granularity)
          if (model === "Person") {
            if (operation.includes("create")) action = "PERSON_CREATE";
            if (operation.includes("update")) action = "PERSON_UPDATE";
          } else if (model === "User") {
            if (operation.includes("create")) action = "USER_INVITE";
            if (operation.includes("update")) action = "USER_ROLE_UPDATE";
          } else if (model === "Setting") {
            action = "SETTINGS_UPDATE";
          }

          // Extract Entity ID
          let entityId: string | undefined;

          if (result && typeof result === "object") {
            // Single record result likely has an ID
            if ("id" in result) {
              entityId = String((result as any).id);
            }
          }

          // Log the audit entry
          await logAudit({
            userId,
            action,
            entity: model,
            entityId,
            details: {
              operation,
              // We log args to capture the 'data' or 'where' clause
              // This is crucial for history replay or debugging
              args: JSON.parse(JSON.stringify(args)),
            },
            ipAddress,
          });
        } catch (e) {
          // Fail silently but log to console to not crash app
          console.error(
            `[AuditPlugin] Failed to log audit for ${model}.${operation}:`,
            e
          );
        }
      })();

      return result;
    },
  };
}
