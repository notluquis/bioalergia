import { prisma } from "../prisma.js";

/**
 * Logs an audit event to the database.
 * @param userId - The ID of the user performing the action (optional, if system action)
 * @param action - A string describing the action (e.g., "USER_INVITE", "SETTINGS_UPDATE")
 * @param entity - The entity being affected (e.g., "User", "Person", "Setting")
 * @param entityId - The ID of the entity (as a string)
 * @param details - Optional JSON object with additional details (e.g., changed fields)
 * @param ipAddress - Optional IP address of the user
 */
export async function logAudit(
  userId: number | null,
  action: string,
  entity: string,
  entityId: string,
  details?: object,
  ipAddress?: string
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entity,
        entityId,
        details: details ? JSON.parse(JSON.stringify(details)) : undefined, // Ensure it's valid JSON
        ipAddress,
      },
    });
  } catch (error) {
    console.error("Failed to log audit event:", error);
    // We don't throw here to avoid blocking the main operation
  }
}
