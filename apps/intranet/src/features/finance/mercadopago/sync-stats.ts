import type { MpSyncChangeDetails, MpSyncImportStats, MpSyncLog } from "@/services/mercadopago";

const REPORT_TYPE_LABELS: Record<"release" | "settlement" | "withdraw", string> = {
  release: "Liberación",
  settlement: "Conciliación",
  withdraw: "Retiros",
};

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
    tone: "release" | "settlement" | "withdraw";
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
    const withdrawStats = buildStats(raw.withdraw ?? null);
    if (withdrawStats) {
      entries.push({ label: "Retiros", stats: withdrawStats, tone: "withdraw" });
    }
  }

  if (entries.length > 0) {
    return entries;
  }

  const fallback = getSyncImportStats(details);
  const reportTypes = getSyncReportTypes(log);
  const soleType = reportTypes.length === 1 ? reportTypes[0] : undefined;
  if (!fallback || !soleType) {
    return null;
  }

  return [
    {
      label: REPORT_TYPE_LABELS[soleType],
      stats: fallback,
      tone: soleType,
    },
  ];
}

export function getSyncReportTypes(log: MpSyncLog): Array<"release" | "settlement" | "withdraw"> {
  const details = log.changeDetails;
  if (details && typeof details === "object") {
    const raw = details.reportTypes;
    if (Array.isArray(raw)) {
      return raw.filter(
        (item): item is "release" | "settlement" | "withdraw" =>
          item === "release" || item === "settlement" || item === "withdraw"
      );
    }
  }
  if (log.triggerSource === "mp:auto-sync") {
    return ["release", "settlement"];
  }
  return [];
}
