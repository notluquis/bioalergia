import cron from "node-cron";

import { getSetting, updateSetting } from "../../services/settings";
import { MercadoPagoService } from "../../services/mercadopago";
import { getActiveJobsByType, startJob, updateJobProgress, completeJob, failJob } from "../jobQueue";
import { logError, logEvent, logWarn } from "../logger";

type ReportType = "release" | "settlement";

const JOB_TYPE = "mp-auto-sync";
const DEFAULT_CRON = "*/20 * * * *";
const DEFAULT_TIMEZONE = "America/Santiago";
const MAX_PROCESSED_FILES = 250;
const MAX_PROCESS_PER_RUN = 4;

const SETTINGS_KEYS = {
  lastGenerated: (type: ReportType) => `mp:lastGenerated:${type}`,
  processedFiles: (type: ReportType) => `mp:processedFiles:${type}`,
  lastRun: "mp:lastAutoSyncRun",
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
  if (getActiveJobsByType(JOB_TYPE).length > 0) {
    logWarn("mp.autoSync.skip", { reason: "already_running", trigger });
    return;
  }

  const jobId = startJob(JOB_TYPE, 6);
  const startedAt = new Date();
  updateJobProgress(jobId, 0, "Inicio sincronización MercadoPago");

  try {
    const types: ReportType[] = ["release", "settlement"];
    const lists = await Promise.all(types.map((type) => MercadoPagoService.listReports(type)));
    updateJobProgress(jobId, 1, "Reportes listados");

    for (const [index, type] of types.entries()) {
      const reports = lists[index] as MPReportSummary[];
      await ensureDailyReport(type, reports);
    }
    updateJobProgress(jobId, 2, "Reportes diarios verificados");

    const results: Record<string, number> = {};
    for (const [index, type] of types.entries()) {
      const reports = lists[index] as MPReportSummary[];
      results[type] = await processReadyReports(type, reports, jobId);
    }

    await updateSetting(SETTINGS_KEYS.lastRun, startedAt.toISOString());
    completeJob(jobId, { processed: results, startedAt });
    logEvent("mp.autoSync.success", { processed: results, trigger });
  } catch (error) {
    failJob(jobId, error instanceof Error ? error.message : String(error));
    logError("mp.autoSync.error", error, { trigger });
  }
}

interface MPReportSummary {
  begin_date?: string;
  end_date?: string;
  file_name?: string;
  status?: string;
  date_created?: string;
}

async function ensureDailyReport(type: ReportType, reports: MPReportSummary[]) {
  const targetDate = getYesterdayDate();
  const existing = reports.find((report) => reportCoversDate(report, targetDate));
  if (existing) {
    return;
  }

  const lastGenerated = await getSetting(SETTINGS_KEYS.lastGenerated(type));
  if (lastGenerated && isSameDay(new Date(lastGenerated), targetDate)) {
    return;
  }

  const { beginDate, endDate } = toDayRange(targetDate);
  await MercadoPagoService.createReport(type, {
    begin_date: beginDate.toISOString(),
    end_date: endDate.toISOString(),
  });
  await updateSetting(SETTINGS_KEYS.lastGenerated(type), targetDate.toISOString());
  logEvent("mp.autoSync.reportCreated", { type, begin: beginDate, end: endDate });
}

async function processReadyReports(
  type: ReportType,
  reports: MPReportSummary[],
  jobId: string,
) {
  const processedSet = await loadProcessedFiles(type);
  let processedCount = 0;

  const readyReports = reports
    .filter((report) => report.file_name && isReportReady(report.status))
    .sort((a, b) => (a.date_created ?? "").localeCompare(b.date_created ?? ""));

  for (const report of readyReports) {
    if (processedCount >= MAX_PROCESS_PER_RUN) break;
    const fileName = report.file_name;
    if (!fileName || processedSet.has(fileName)) continue;

    updateJobProgress(jobId, 3 + processedCount, `Procesando ${type}: ${fileName}`);

    try {
      await MercadoPagoService.processReport(type, { fileName });
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

async function loadProcessedFiles(type: ReportType) {
  const raw = await getSetting(SETTINGS_KEYS.processedFiles(type));
  if (!raw) return new Set<string>();
  try {
    const parsed = JSON.parse(raw) as string[];
    return new Set(parsed.filter(Boolean));
  } catch {
    return new Set<string>();
  }
}

async function persistProcessedFiles(type: ReportType, processed: Set<string>) {
  const trimmed = Array.from(processed).slice(-MAX_PROCESSED_FILES);
  await updateSetting(SETTINGS_KEYS.processedFiles(type), JSON.stringify(trimmed));
}

function isReportReady(status?: string) {
  if (!status) return false;
  return /ready|generated|available|finished|success/i.test(status);
}

function reportCoversDate(report: MPReportSummary, targetDate: Date) {
  const begin = parseDate(report.begin_date);
  const end = parseDate(report.end_date);
  if (!begin || !end) return false;
  return begin.getTime() <= targetDate.getTime() && targetDate.getTime() <= end.getTime();
}

function parseDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getYesterdayDate() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  date.setHours(12, 0, 0, 0);
  return date;
}

function toDayRange(date: Date) {
  const beginDate = new Date(date);
  beginDate.setHours(0, 0, 0, 0);
  const endDate = new Date(date);
  endDate.setHours(23, 59, 59, 999);
  return { beginDate, endDate };
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
