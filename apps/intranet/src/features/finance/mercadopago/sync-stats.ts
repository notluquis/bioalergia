import type { MpSyncChangeDetails, MpSyncImportStats, MpSyncLog } from "@/services/mercadopago";

function toNumber(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

export function getSyncImportStats(details?: MpSyncChangeDetails | null) {
  if (!details || typeof details !== "object") {
    return null;
  }
  const raw = details.importStats;
  if (!raw || typeof raw !== "object") {
    return null;
  }
  return {
    totalRows: toNumber(raw.totalRows),
    validRows: toNumber(raw.validRows),
    insertedRows: toNumber(raw.insertedRows),
    duplicateRows: toNumber(raw.duplicateRows),
    fieldChangeCount: toNumber(raw.fieldChangeCount),
    updatedRows: toNumber(raw.updatedRows),
    unchangedRows: toNumber(raw.unchangedRows ?? raw.duplicateRows),
    skippedRows: toNumber(raw.skippedRows),
    errorCount: toNumber(raw.errorCount),
  };
}

export function getSyncImportStatsByType(log: MpSyncLog) {
  const details = log.changeDetails;
  if (!details || typeof details !== "object") {
    return null;
  }
  const raw = details.importStatsByType;

  const buildStats = (stats?: MpSyncImportStats | null) => {
    if (!stats) {
      return null;
    }
    return {
      totalRows: toNumber(stats.totalRows),
      validRows: toNumber(stats.validRows),
      insertedRows: toNumber(stats.insertedRows),
      duplicateRows: toNumber(stats.duplicateRows),
      fieldChangeCount: toNumber(stats.fieldChangeCount),
      updatedRows: toNumber(stats.updatedRows),
      unchangedRows: toNumber(stats.unchangedRows ?? stats.duplicateRows),
      skippedRows: toNumber(stats.skippedRows),
      errorCount: toNumber(stats.errorCount),
    };
  };

  const entries: Array<{
    label: string;
    stats: ReturnType<typeof buildStats>;
    tone: "release" | "settlement";
  }> = [];

  if (raw && typeof raw === "object") {
    const releaseStats = buildStats(raw.release ?? null);
    if (releaseStats) {
      entries.push({ label: "Liberación", stats: releaseStats, tone: "release" });
    }
    const settlementStats = buildStats(raw.settlement ?? null);
    if (settlementStats) {
      entries.push({ label: "Conciliación", stats: settlementStats, tone: "settlement" });
    }
  }

  if (entries.length > 0) {
    return entries;
  }

  const fallback = getSyncImportStats(details);
  const reportTypes = getSyncReportTypes(log);
  if (!fallback || reportTypes.length !== 1) {
    return null;
  }

  return [
    {
      label: reportTypes[0] === "release" ? "Liberación" : "Conciliación",
      stats: fallback,
      tone: reportTypes[0],
    },
  ];
}

export function getSyncReportTypes(log: MpSyncLog) {
  const details = log.changeDetails;
  if (details && typeof details === "object") {
    const raw = details.reportTypes;
    if (Array.isArray(raw)) {
      return raw.filter(
        (item): item is "release" | "settlement" => item === "release" || item === "settlement"
      );
    }
  }
  if (log.triggerSource === "mp:auto-sync") {
    return ["release", "settlement"] as const;
  }
  return [];
}
