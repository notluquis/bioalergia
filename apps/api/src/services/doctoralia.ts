import { db } from "@finanzas/db";
import { DomainError } from "../lib/errors.ts";

export async function createDoctoraliaSyncLogEntry(params: {
  syncType?: "CALENDAR" | "EMAIL";
  triggerSource?: string;
  triggerUserId?: number | null;
}) {
  const syncType = params.syncType ?? "CALENDAR";

  const pending = await db.doctoraliaSyncLog.findFirst({
    where: { syncType, status: "PENDING" },
  });

  if (pending) {
    throw new DomainError("CONFLICT", `Sincronización Doctoralia (${syncType}) ya en curso`, {
      runningLogId: pending.id,
      syncType,
    });
  }

  const log = await db.doctoraliaSyncLog.create({
    data: {
      syncType,
      triggerSource: params.triggerSource,
      triggerUserId: params.triggerUserId,
      status: "PENDING",
      counts: {},
    },
  });

  return log.id;
}

export async function finalizeDoctoraliaSyncLogEntry(
  logId: number,
  params: {
    status: "SUCCESS" | "ERROR";
    counts?: Record<string, number>;
    errorMessage?: string;
  }
) {
  await db.doctoraliaSyncLog.update({
    where: { id: logId },
    data: {
      status: params.status,
      endedAt: new Date(),
      counts: params.counts ?? {},
      errorMessage: params.errorMessage,
    },
  });
}

export async function listDoctoraliaSyncLogs(limit = 50) {
  return db.doctoraliaSyncLog.findMany({
    orderBy: { startedAt: "desc" },
    take: limit,
  });
}
