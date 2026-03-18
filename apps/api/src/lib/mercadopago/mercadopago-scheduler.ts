import { db } from "@finanzas/db";
import cron from "node-cron";
import { formatMpDate, type ImportStats, MercadoPagoService } from "../../services/mercadopago";
import { createMpSyncLogEntry, finalizeMpSyncLogEntry } from "../../services/mercadopago-sync";
import { getSetting, updateSetting } from "../../services/settings";
import {
  completeJob,
  failJob,
  getActiveJobsByType,
  startJob,
  updateJobProgress,
} from "../jobQueue";
import { logError, logEvent, logWarn } from "../logger";

type ReportType = "release" | "settlement";
type ProcessedFilesKey = ReportType | "webhook";

const JOB_TYPE = "mp-auto-sync";
const DEFAULT_CRON = "20 17 * * *";
const DEFAULT_TIMEZONE = "America/Santiago";
const MAX_PROCESSED_FILES = 250;
const MAX_PROCESS_PER_RUN = 4;
const CREATE_COOLDOWN_MINUTES = 30;
const REPORT_POLL_INTERVAL_MS = 30_000;
const REPORT_POLL_MAX_ATTEMPTS = 20; // hasta 10 minutos
const ADVISORY_LOCK_KEY = 924_017_221;
const JITTER_MAX_MS = 45_000;
const PROCESSED_TTL_DAYS = 45;
const REPORT_READY_REGEX = /ready|generated|available|finished|success/i;

const SETTINGS_KEYS = {
  lastGenerated: (type: ReportType) => `mp:lastGenerated:${type}`,
  lastCreateAttempt: (type: ReportType) => `mp:lastCreateAttempt:${type}`,
  processedFiles: (type: ProcessedFilesKey) => `mp:processedFiles:${type}`,
  lastRun: "mp:lastAutoSyncRun",
  pendingWebhooks: "mp:webhook:pending",
  autoSyncEnabled: "mp:autoSync:enabled",
};

export function startMercadoPagoScheduler() {
  const cronExpression = process.env.MP_AUTO_SYNC_CRON || DEFAULT_CRON;
  const timezone = process.env.MP_AUTO_SYNC_TIMEZONE || DEFAULT_TIMEZONE;

  if (!cron.validate(cronExpression)) {
    logWarn("mp.scheduler.disabled", {
      reason: "invalid_cron",
      cronExpression,
    });
    return;
  }

  cron.schedule(
    cronExpression,
    async () => {
      await runMercadoPagoAutoSync({ trigger: `cron:${cronExpression}` });
    },
    { timezone },
  );

  logEvent("mp.scheduler.started", {
    cronExpression,
    timezone,
  });
}

export async function runMercadoPagoAutoSync({ trigger }: { trigger: string }) {
  const enabled = await isAutoSyncEnabled();
  if (!enabled) {
    logWarn("mp.autoSync.skip", { reason: "disabled", trigger });
    return;
  }

  const acquired = await acquireSchedulerLock();
  if (!acquired) {
    logWarn("mp.autoSync.skip", { reason: "lock_busy", trigger });
    return;
  }

  if (getActiveJobsByType(JOB_TYPE).length > 0) {
    logWarn("mp.autoSync.skip", { reason: "already_running", trigger });
    await releaseSchedulerLock();
    return;
  }

  const jobId = startJob(JOB_TYPE, 6);
  const startedAt = new Date();
  updateJobProgress(jobId, 0, "Inicio sincronización MercadoPago");
  const logId = await createMpSyncLogEntry({
    triggerSource: "mp:auto-sync",
    triggerLabel: trigger,
  });

  try {
    await jitterDelay();
    const types: ReportType[] = ["release", "settlement"];
    const lists = await Promise.all(types.map((type) => MercadoPagoService.listReports(type)));
    updateJobProgress(jobId, 1, "Reportes listados");

    const importStats = createImportStatsAggregate();
    const importStatsByType: Record<ReportType, ImportStatsAggregate> = {
      release: createImportStatsAggregate(),
      settlement: createImportStatsAggregate(),
    };
    const refreshedReportsByType = new Map<ReportType, MPReportSummary[]>();
    for (const [index, type] of types.entries()) {
      const reports = lists[index] as MPReportSummary[];
      const refreshed = await ensureDailyReport(type, reports);
      refreshedReportsByType.set(type, refreshed);
    }
    updateJobProgress(jobId, 2, "Reportes diarios verificados");

    const pendingProcessed = await processPendingWebhooks(jobId, importStats, importStatsByType);
    const results: Record<string, number> = {
      pendingWebhooks: pendingProcessed,
    };
    for (const type of types) {
      const reports = refreshedReportsByType.get(type) ?? [];
      results[type] = await processReadyReports(
        type,
        reports,
        jobId,
        importStats,
        importStatsByType[type],
      );
    }

    const processedReportsTotal =
      pendingProcessed + (results.release ?? 0) + (results.settlement ?? 0);
    const cashFlowSync =
      processedReportsTotal > 0 ? await MercadoPagoService.syncCashFlow(0) : undefined;

    await finalizeMpSyncLogEntry(logId, {
      status: "SUCCESS",
      inserted: importStats.insertedRows,
      skipped: importStats.skippedRows,
      excluded: importStats.duplicateRows,
      changeDetails: {
        ...results,
        importStats,
        importStatsByType,
        reportTypes: ["release", "settlement"],
        cashFlowSync: cashFlowSync ?? null,
      },
    });
    await updateSetting(SETTINGS_KEYS.lastRun, startedAt.toISOString());
    completeJob(jobId, { processed: results, startedAt });
    logEvent("mp.autoSync.success", { processed: results, trigger });
  } catch (error) {
    failJob(jobId, error instanceof Error ? error.message : String(error));
    logError("mp.autoSync.error", error, { trigger });
    await finalizeMpSyncLogEntry(logId, {
      status: "ERROR",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  } finally {
    await releaseSchedulerLock();
  }
}

interface MPReportSummary {
  begin_date?: string;
  end_date?: string;
  file_name?: string;
  status?: string;
  date_created?: string;
}

async function ensureDailyReport(
  type: ReportType,
  reports: MPReportSummary[],
): Promise<MPReportSummary[]> {
  const range = getAutoSyncReportRange();
  const existing = reports.find((report) =>
    reportCoversRange(report, range.beginDate, range.endDate),
  );
  if (existing) {
    if (existing.file_name && isReportReady(existing.status)) {
      logEvent("mp.autoSync.reportSkipped", {
        type,
        reason: "already_exists",
        begin: existing.begin_date,
        end: existing.end_date,
        targetBegin: range.beginDate.toISOString(),
        targetEnd: range.endDate.toISOString(),
      });
      return reports;
    }

    logEvent("mp.autoSync.reportPending", {
      type,
      reason: "exists_not_ready",
      status: existing.status,
      begin: existing.begin_date,
      end: existing.end_date,
      targetBegin: range.beginDate.toISOString(),
      targetEnd: range.endDate.toISOString(),
    });
    return await pollUntilReady(type, range);
  }

  const lastCreateAttempt = await getValidSettingDate(SETTINGS_KEYS.lastCreateAttempt(type));
  if (lastCreateAttempt && minutesSince(lastCreateAttempt) < CREATE_COOLDOWN_MINUTES) {
    logWarn("mp.autoSync.reportSkipped", {
      type,
      reason: "cooldown",
      lastCreateAttempt: lastCreateAttempt.toISOString(),
      cooldownMinutes: CREATE_COOLDOWN_MINUTES,
    });
    return await pollUntilReady(type, range);
  }

  logEvent("mp.autoSync.reportCreating", {
    type,
    begin: range.beginDate.toISOString(),
    end: range.endDate.toISOString(),
  });
  await updateSetting(SETTINGS_KEYS.lastCreateAttempt(type), new Date().toISOString());
  await MercadoPagoService.createReport(type, {
    begin_date: formatMpDate(range.beginDate),
    end_date: formatMpDate(range.endDate),
  });
  await updateSetting(SETTINGS_KEYS.lastGenerated(type), range.endDate.toISOString());
  logEvent("mp.autoSync.reportCreated", {
    type,
    begin: range.beginDate.toISOString(),
    end: range.endDate.toISOString(),
  });

  return await pollUntilReady(type, range);
}

async function pollUntilReady(
  type: ReportType,
  range: { beginDate: Date; endDate: Date },
): Promise<MPReportSummary[]> {
  for (let attempt = 0; attempt < REPORT_POLL_MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, REPORT_POLL_INTERVAL_MS));
    }
    const refreshed = (await MercadoPagoService.listReports(type, {
      silent: true,
    })) as MPReportSummary[];
    const target = refreshed.find((r) => reportCoversRange(r, range.beginDate, range.endDate));
    if (target?.file_name && isReportReady(target.status)) {
      logEvent("mp.autoSync.reportReady", {
        type,
        attempt: attempt + 1,
        fileName: target.file_name,
      });
      return refreshed;
    }
    logEvent("mp.autoSync.reportPolling", {
      type,
      attempt: attempt + 1,
      status: target?.status ?? "not_found",
    });
  }
  logWarn("mp.autoSync.reportPollTimeout", {
    type,
    maxAttempts: REPORT_POLL_MAX_ATTEMPTS,
    intervalMs: REPORT_POLL_INTERVAL_MS,
  });
  return (await MercadoPagoService.listReports(type, { silent: true })) as MPReportSummary[];
}

async function processReadyReports(
  type: ReportType,
  reports: MPReportSummary[],
  jobId: string,
  importStats: ImportStatsAggregate,
  importStatsForType: ImportStatsAggregate,
) {
  const processedSet = await loadProcessedFiles(type);
  let processedCount = 0;

  const readyReports = reports
    .filter((report) => report.file_name && isReportReady(report.status))
    .sort((a, b) => (a.date_created ?? "").localeCompare(b.date_created ?? ""));

  for (const report of readyReports) {
    if (processedCount >= MAX_PROCESS_PER_RUN) {
      break;
    }
    const fileName = report.file_name;
    if (!fileName || processedSet.has(fileName)) {
      continue;
    }

    updateJobProgress(jobId, 3 + processedCount, `Procesando ${type}: ${fileName}`);

    try {
      const stats = await MercadoPagoService.processReport(type, { fileName });
      accumulateImportStats(importStats, stats);
      accumulateImportStats(importStatsForType, stats);
      processedSet.add(fileName);
      processedCount += 1;
      logEvent("mp.autoSync.reportProcessed", { type, fileName });
    } catch (error) {
      logError("mp.autoSync.reportFailed", error, { type, fileName });
    }
  }

  await persistProcessedFiles(type, processedSet);
  return processedCount;
}

async function processPendingWebhooks(
  jobId: string,
  importStats: ImportStatsAggregate,
  importStatsByType: Record<ReportType, ImportStatsAggregate>,
) {
  const pending = await loadPendingWebhooks();
  if (pending.length === 0) {
    return 0;
  }

  const processed = await loadProcessedFiles("webhook");
  let processedCount = 0;

  for (const payload of pending) {
    if (!payload.files?.length) {
      continue;
    }

    for (const file of payload.files) {
      if (processed.has(file.name)) {
        continue;
      }
      if (!isCsvWebhookFile(file)) {
        continue;
      }

      const type = resolveWebhookReportType(payload.report_type);
      const processedOk = await processWebhookFile({
        file,
        jobId,
        type,
        importStats,
        importStatsByType,
        processed,
      });
      if (processedOk) {
        processedCount += 1;
      }
    }
  }

  await persistProcessedFiles("webhook", processed);
  await updateSetting(SETTINGS_KEYS.pendingWebhooks, JSON.stringify([]));
  return processedCount;
}

function resolveWebhookReportType(reportType: string): ReportType {
  return reportType.includes("settlement") ? "settlement" : "release";
}

function isCsvWebhookFile(file: { name: string; type?: string }) {
  return file.type === ".csv" || file.name.endsWith(".csv");
}

async function processWebhookFile({
  file,
  jobId,
  type,
  importStats,
  importStatsByType,
  processed,
}: {
  file: { name: string; url: string };
  jobId: string;
  type: ReportType;
  importStats: ImportStatsAggregate;
  importStatsByType: Record<ReportType, ImportStatsAggregate>;
  processed: Set<string>;
}) {
  updateJobProgress(jobId, 3, `Procesando webhook: ${file.name}`);

  try {
    const stats = await MercadoPagoService.processReport(type, { url: file.url });
    accumulateImportStats(importStats, stats);
    accumulateImportStats(importStatsByType[type], stats);
    processed.add(file.name);
    logEvent("mp.autoSync.webhookProcessed", { type, file: file.name });
    return true;
  } catch (error) {
    logError("mp.autoSync.webhookFailed", error, { type, file: file.name });
    return false;
  }
}

async function isAutoSyncEnabled() {
  const raw = await getSetting(SETTINGS_KEYS.autoSyncEnabled);
  if (raw == null || raw === "") {
    return true;
  }
  return raw === "true";
}

async function loadProcessedFiles(type: ProcessedFilesKey) {
  const raw = await getSetting(SETTINGS_KEYS.processedFiles(type));
  if (!raw) {
    return new Set<string>();
  }
  try {
    const parsed = JSON.parse(raw) as Array<string | { name: string; at?: string }>;
    const now = Date.now();
    const ttlMs = PROCESSED_TTL_DAYS * 24 * 60 * 60 * 1000;
    const entries = parsed
      .map((item) => {
        if (typeof item === "string") {
          return { name: item, at: null };
        }
        return { name: item.name, at: item.at ?? null };
      })
      .filter((item) => item.name);

    const filtered = entries.filter((entry) => {
      if (!entry.at) {
        return true;
      }
      const timestamp = Date.parse(entry.at);
      if (Number.isNaN(timestamp)) {
        return true;
      }
      return now - timestamp <= ttlMs;
    });

    return new Set(filtered.map((entry) => entry.name));
  } catch {
    return new Set<string>();
  }
}

async function persistProcessedFiles(type: ProcessedFilesKey, processed: Set<string>) {
  const now = new Date().toISOString();
  const trimmed = Array.from(processed)
    .slice(-MAX_PROCESSED_FILES)
    .map((name) => ({ name, at: now }));
  await updateSetting(SETTINGS_KEYS.processedFiles(type), JSON.stringify(trimmed));
}

function isReportReady(status?: string) {
  if (!status) {
    return false;
  }
  return REPORT_READY_REGEX.test(status);
}

function reportCoversRange(report: MPReportSummary, targetBegin: Date, targetEnd: Date) {
  const begin = parseDate(report.begin_date);
  const end = parseDate(report.end_date);
  if (!begin || !end) {
    return false;
  }
  return begin.getTime() <= targetBegin.getTime() && end.getTime() >= targetEnd.getTime();
}

function parseDate(value?: string) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getAutoSyncReportRange() {
  const now = new Date();

  const yesterdayStart = new Date(now);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  yesterdayStart.setHours(0, 0, 0, 0);

  return {
    beginDate: yesterdayStart,
    endDate: now,
  };
}

function minutesSince(date: Date) {
  return (Date.now() - date.getTime()) / 60000;
}

type ImportStatsAggregate = {
  totalRows: number;
  validRows: number;
  insertedRows: number;
  duplicateRows: number;
  skippedRows: number;
  errorCount: number;
};

function createImportStatsAggregate(): ImportStatsAggregate {
  return {
    totalRows: 0,
    validRows: 0,
    insertedRows: 0,
    duplicateRows: 0,
    skippedRows: 0,
    errorCount: 0,
  };
}

function accumulateImportStats(target: ImportStatsAggregate, stats: ImportStats) {
  target.totalRows += stats.totalRows ?? 0;
  target.validRows += stats.validRows ?? 0;
  target.insertedRows += stats.insertedRows ?? 0;
  target.duplicateRows += stats.duplicateRows ?? 0;
  target.skippedRows += stats.skippedRows ?? 0;
  target.errorCount += stats.errors?.length ?? 0;
}

async function getValidSettingDate(key: string) {
  const raw = await getSetting(key);
  if (!raw) {
    return null;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    logWarn("mp.autoSync.settingInvalid", { key, value: raw });
    await updateSetting(key, "");
    return null;
  }
  if (parsed.getTime() > Date.now() + 5 * 60 * 1000) {
    logWarn("mp.autoSync.settingFuture", { key, value: raw });
    await updateSetting(key, "");
    return null;
  }
  return parsed;
}

async function jitterDelay() {
  const delay = Math.floor(Math.random() * JITTER_MAX_MS);
  if (delay <= 0) {
    return;
  }
  await new Promise((resolve) => {
    setTimeout(resolve, delay);
  });
}

export async function acquireSchedulerLock() {
  try {
    const result = await db.$queryRaw<{ acquired: boolean }[]>`
      SELECT pg_try_advisory_lock(${ADVISORY_LOCK_KEY}) AS acquired
    `;
    return result[0]?.acquired === true;
  } catch (error) {
    logError("mp.autoSync.lockError", error, {});
    return false;
  }
}

export async function releaseSchedulerLock() {
  try {
    await db.$queryRaw`
      SELECT pg_advisory_unlock(${ADVISORY_LOCK_KEY})
    `;
  } catch (error) {
    logError("mp.autoSync.unlockError", error, {});
  }
}

async function loadPendingWebhooks() {
  const raw = await getSetting(SETTINGS_KEYS.pendingWebhooks);
  if (!raw) {
    return [];
  }
  try {
    return JSON.parse(raw) as Array<{
      transaction_id: string;
      report_type: string;
      files: Array<{ name: string; type: string; url: string }>;
      createdAt: string;
    }>;
  } catch {
    return [];
  }
}
