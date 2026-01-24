import { db } from "@finanzas/db";

export async function createMpSyncLogEntry(params: {
  triggerSource: string;
  triggerLabel?: string | null;
  triggerUserId?: number | null;
}) {
  const log = await db.syncLog.create({
    data: {
      triggerSource: params.triggerSource,
      triggerUserId: params.triggerUserId ?? null,
      triggerLabel: params.triggerLabel ?? null,
      status: "RUNNING",
      startedAt: new Date(),
    },
  });
  return Number(log.id);
}

export async function finalizeMpSyncLogEntry(
  id: number,
  data: {
    status: "SUCCESS" | "ERROR";
    inserted?: number;
    updated?: number;
    skipped?: number;
    excluded?: number;
    errorMessage?: string;
    changeDetails?: Record<string, unknown>;
  },
) {
  await db.syncLog.update({
    where: { id },
    data: {
      status: data.status,
      finishedAt: new Date(),
      inserted: data.inserted,
      updated: data.updated,
      skipped: data.skipped,
      excluded: data.excluded,
      errorMessage: data.errorMessage,
      changeDetails: data.changeDetails,
    },
  });
}

export async function listMpSyncLogs(limit = 50) {
  return db.syncLog.findMany({
    where: { triggerSource: { startsWith: "mp:" } },
    orderBy: { startedAt: "desc" },
    take: limit,
  });
}
