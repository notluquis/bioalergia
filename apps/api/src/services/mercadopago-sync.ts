import { db, type JsonValue } from "@finanzas/db";

type NonNullJsonValue = Exclude<JsonValue, null>;

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
  return log.id;
}

export async function finalizeMpSyncLogEntry(
  id: bigint,
  data: {
    status: "SUCCESS" | "ERROR";
    inserted?: number;
    updated?: number;
    skipped?: number;
    excluded?: number;
    errorMessage?: string;
    changeDetails?: NonNullJsonValue;
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
      changeDetails: data.changeDetails ?? undefined,
    },
  });
}

export async function listMpSyncLogs(options?: { limit?: number; offset?: number }) {
  const { limit = 50, offset = 0 } = options ?? {};
  const [logs, total] = await db.$transaction([
    db.syncLog.findMany({
      where: { triggerSource: { startsWith: "mp:" } },
      orderBy: { startedAt: "desc" },
      take: limit,
      skip: offset,
    }),
    db.syncLog.count({ where: { triggerSource: { startsWith: "mp:" } } }),
  ]);
  return { logs, total };
}
