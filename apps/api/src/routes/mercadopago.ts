/**
 * Mercado Pago Routes for Hono API
 *
 * Handles MP report list, creation, and download
 * Supports:
 * - Release Report (Liberaciones)
 * - Settlement Report (Conciliación)
 */

import bcrypt from "bcryptjs";
import { type Context, Hono } from "hono";
import { stream } from "hono/streaming";
import { getSessionUser, hasPermission } from "../auth";
import {
  acquireSchedulerLock,
  releaseSchedulerLock,
} from "../lib/mercadopago/mercadopago-scheduler";
import { formatMpDate, MercadoPagoService, MP_WEBHOOK_PASSWORD } from "../services/mercadopago";
import {
  createMpSyncLogEntry,
  finalizeMpSyncLogEntry,
  listMpSyncLogs,
} from "../services/mercadopago-sync";
import { getSetting, updateSetting } from "../services/settings";
import { reply } from "../utils/reply";

export const mercadopagoRoutes = new Hono();

// Helper to get auth
async function getAuth(c: Context) {
  const user = await getSessionUser(c);
  if (!user) {
    return null;
  }
  return { userId: user.id, email: user.email };
}

// ============================================================
// RELEASE REPORTS
// ============================================================

// List Reports
mercadopagoRoutes.get("/reports", async (c) => {
  const auth = await getAuth(c);
  if (!auth) {
    return reply(c, { status: "error", message: "No autorizado" }, 401);
  }

  const canRead = await hasPermission(auth.userId, "read", "Integration");
  if (!canRead) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  try {
    const limit = Number(c.req.query("limit") ?? "50");
    const offset = Number(c.req.query("offset") ?? "0");
    const data = await MercadoPagoService.listReports("release");
    const safeLimit = Number.isNaN(limit) ? 50 : Math.min(limit, 200);
    const safeOffset = Number.isNaN(offset) ? 0 : Math.max(offset, 0);
    const sliced = data.slice(safeOffset, safeOffset + safeLimit);
    return reply(c, { status: "ok", reports: sliced, total: data.length });
  } catch (e) {
    return reply(c, { status: "error", message: String(e) }, 500);
  }
});

// Create Manual Report
mercadopagoRoutes.post("/reports", async (c) => {
  const auth = await getAuth(c);
  if (!auth) {
    return reply(c, { status: "error", message: "No autorizado" }, 401);
  }

  const canCreate = await hasPermission(auth.userId, "read", "Integration");
  if (!canCreate) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const body = await c.req.json();
  const validationError = validateReportRange(body);
  if (validationError) {
    return reply(c, { status: "error", message: validationError }, 400);
  }

  try {
    const { begin_date, end_date } = body as { begin_date: string; end_date: string };
    const data = await MercadoPagoService.createReport("release", {
      begin_date: formatMpDate(new Date(begin_date)),
      end_date: formatMpDate(new Date(end_date)),
    });
    console.log("[MP Release] Report created by", auth.email);
    return reply(c, data, 201);
  } catch (e) {
    return reply(c, { status: "error", message: String(e) }, 500);
  }
});

// Download Report
mercadopagoRoutes.get("/reports/download/:fileName", async (c) => {
  const auth = await getAuth(c);
  if (!auth) {
    return reply(c, { status: "error", message: "No autorizado" }, 401);
  }

  const canRead = await hasPermission(auth.userId, "read", "Integration");
  if (!canRead) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const fileName = c.req.param("fileName");

  try {
    const res = await MercadoPagoService.downloadReport("release", fileName);
    c.header("Content-Type", res.headers.get("Content-Type") || "application/octet-stream");
    c.header("Content-Disposition", `attachment; filename="${fileName}"`);

    return stream(c, async (stream) => {
      const reader = res.body?.getReader();
      if (!reader) {
        return;
      }
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        await stream.write(value);
      }
    });
  } catch (e) {
    return reply(c, { status: "error", message: String(e) }, 500);
  }
});

// ============================================================
// SETTLEMENT REPORTS
// ============================================================

// List Reports
mercadopagoRoutes.get("/settlement/reports", async (c) => {
  const auth = await getAuth(c);
  if (!auth) {
    return reply(c, { status: "error", message: "No autorizado" }, 401);
  }

  const canRead = await hasPermission(auth.userId, "read", "Integration");
  if (!canRead) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  try {
    const limit = Number(c.req.query("limit") ?? "50");
    const offset = Number(c.req.query("offset") ?? "0");
    const data = await MercadoPagoService.listReports("settlement");
    const safeLimit = Number.isNaN(limit) ? 50 : Math.min(limit, 200);
    const safeOffset = Number.isNaN(offset) ? 0 : Math.max(offset, 0);
    const sliced = data.slice(safeOffset, safeOffset + safeLimit);
    return reply(c, { status: "ok", reports: sliced, total: data.length });
  } catch (e) {
    return reply(c, { status: "error", message: String(e) }, 500);
  }
});

// Create Manual Report
mercadopagoRoutes.post("/settlement/reports", async (c) => {
  const auth = await getAuth(c);
  if (!auth) {
    return reply(c, { status: "error", message: "No autorizado" }, 401);
  }

  const canCreate = await hasPermission(auth.userId, "read", "Integration");
  if (!canCreate) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const body = await c.req.json();
  const validationError = validateReportRange(body);
  if (validationError) {
    return reply(c, { status: "error", message: validationError }, 400);
  }

  try {
    const { begin_date, end_date } = body as { begin_date: string; end_date: string };
    const data = await MercadoPagoService.createReport("settlement", {
      begin_date: formatMpDate(new Date(begin_date)),
      end_date: formatMpDate(new Date(end_date)),
    });
    console.log("[MP Settlement] Report created by", auth.email);
    return reply(c, data, 201);
  } catch (e) {
    return reply(c, { status: "error", message: String(e) }, 500);
  }
});

// Download Report
mercadopagoRoutes.get("/settlement/reports/download/:fileName", async (c) => {
  const auth = await getAuth(c);
  if (!auth) {
    return reply(c, { status: "error", message: "No autorizado" }, 401);
  }

  const canRead = await hasPermission(auth.userId, "read", "Integration");
  if (!canRead) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const fileName = c.req.param("fileName");

  try {
    const res = await MercadoPagoService.downloadReport("settlement", fileName);
    c.header("Content-Type", res.headers.get("Content-Type") || "application/octet-stream");
    c.header("Content-Disposition", `attachment; filename="${fileName}"`);

    return stream(c, async (stream) => {
      const reader = res.body?.getReader();
      if (!reader) {
        return;
      }
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        await stream.write(value);
      }
    });
  } catch (e) {
    return reply(c, { status: "error", message: String(e) }, 500);
  }
});

// ============================================================
// MANUAL PROCESSING
// ============================================================

mercadopagoRoutes.post("/process-report", async (c) => {
  const auth = await getAuth(c);
  if (!auth) {
    return reply(c, { status: "error", message: "No autorizado" }, 401);
  }

  const canCreate = await hasPermission(auth.userId, "read", "Integration");
  if (!canCreate) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const { fileName, reportType } = await c.req.json<{
    fileName: string;
    reportType: "release" | "settlement";
  }>();

  if (!fileName || !reportType) {
    return reply(c, { status: "error", message: "Missing fileName or reportType" }, 400);
  }

  let logId: bigint | null = null;
  try {
    console.log(
      `[MP Process] Manual processing triggered for ${fileName} (${reportType}) by ${auth.email}`,
    );

    logId = await createMpSyncLogEntry({
      triggerSource: "mp:manual",
      triggerLabel: `${reportType}:${fileName}`,
      triggerUserId: auth.userId,
    });

    const stats = await MercadoPagoService.processReport(reportType, {
      fileName,
    });
    const cashFlowSync = await MercadoPagoService.syncCashFlow(auth.userId);

    await finalizeMpSyncLogEntry(logId, {
      status: "SUCCESS",
      inserted: stats.insertedRows,
      skipped: stats.skippedRows,
      excluded: stats.duplicateRows,
      changeDetails: {
        reportType,
        fileName,
        reportTypes: [reportType],
        importStatsByType: {
          [reportType]: {
            totalRows: stats.totalRows,
            validRows: stats.validRows,
            insertedRows: stats.insertedRows,
            duplicateRows: stats.duplicateRows,
            skippedRows: stats.skippedRows,
            errorCount: stats.errors?.length ?? 0,
          },
        },
        importStats: {
          totalRows: stats.totalRows,
          validRows: stats.validRows,
          insertedRows: stats.insertedRows,
          duplicateRows: stats.duplicateRows,
          skippedRows: stats.skippedRows,
          errorCount: stats.errors?.length ?? 0,
        },
        cashFlowSync,
      },
    });

    return reply(c, {
      status: "success",
      message: "Reporte procesado exitosamente",
      stats,
      cashFlowSync,
    });
  } catch (e) {
    console.error(`[MP Process] Failed to process ${fileName}:`, e);
    if (logId != null) {
      await finalizeMpSyncLogEntry(logId, {
        status: "ERROR",
        errorMessage: e instanceof Error ? e.message : String(e),
        changeDetails: { reportType, fileName },
      });
    }
    return reply(c, { status: "error", message: String(e) }, 500);
  }
});

// ============================================================
// WEBHOOK - Receive MercadoPago Report Notifications
// ============================================================

interface MPWebhookPayload {
  transaction_id: string;
  request_date: string;
  generation_date: string;
  files: Array<{
    type: string;
    url: string;
    name: string;
  }>;
  status: string;
  creation_type: "manual" | "schedule";
  report_type: string;
  is_test: boolean;
  signature: string;
}

function validateReportRange(body: unknown) {
  if (!body || typeof body !== "object") {
    return "Missing begin_date or end_date";
  }
  const { begin_date, end_date } = body as { begin_date?: unknown; end_date?: unknown };
  if (typeof begin_date !== "string" || begin_date.trim() === "") {
    return "Missing begin_date";
  }
  if (typeof end_date !== "string" || end_date.trim() === "") {
    return "Missing end_date";
  }
  const begin = new Date(begin_date);
  const end = new Date(end_date);
  if (Number.isNaN(begin.getTime()) || Number.isNaN(end.getTime())) {
    return "Invalid begin_date or end_date";
  }
  if (begin.getTime() > end.getTime()) {
    return "begin_date must be before end_date";
  }
  return null;
}

const PROCESSED_FILES_KEY = "mp:processedFiles:webhook";
const PENDING_WEBHOOKS_KEY = "mp:webhook:pending";
const MAX_PENDING_WEBHOOKS = 50;
const PROCESSED_TTL_DAYS = 45;

const isCsvWebhookFile = (file: { name: string; type: string }) =>
  file.type === ".csv" || file.name.endsWith(".csv");

const inferWebhookReportKind = (reportType: string): "release" | "settlement" =>
  reportType.includes("settlement") ? "settlement" : "release";

function logWebhookNotification(payload: MPWebhookPayload) {
  console.log("[MP Webhook] Received notification:", {
    files_count: payload.files?.length || 0,
    is_test: payload.is_test,
    report_type: payload.report_type,
    status: payload.status,
    transaction_id: payload.transaction_id,
  });
}

function validateWebhookSignature(payload: MPWebhookPayload) {
  if (!MP_WEBHOOK_PASSWORD) {
    return true;
  }
  const expectedInput = `${payload.transaction_id}-${MP_WEBHOOK_PASSWORD}-${payload.generation_date}`;
  const isValid = bcrypt.compareSync(expectedInput, payload.signature);
  return isValid || payload.is_test;
}

async function acquireWebhookLockOrQueue(payload: MPWebhookPayload) {
  const lockAcquired = await retryAcquireSchedulerLock(4);
  if (lockAcquired) {
    return true;
  }
  await enqueuePendingWebhook(payload);
  return false;
}

async function processWebhookFiles(payload: MPWebhookPayload) {
  if (!payload.files?.length) {
    return;
  }

  const processed = await loadProcessedFiles(PROCESSED_FILES_KEY);
  const logId = await createMpSyncLogEntry({
    triggerSource: "mp:webhook",
    triggerLabel: payload.transaction_id,
  });

  let processedCount = 0;
  const reportType = inferWebhookReportKind(payload.report_type);
  const processingErrors: string[] = [];

  for (const file of payload.files) {
    if (processed.has(file.name) || !isCsvWebhookFile(file)) {
      continue;
    }
    console.log("[MP Webhook] Processing file:", file.name);
    try {
      await MercadoPagoService.processReport(reportType, { url: file.url });
      processedCount += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      processingErrors.push(`${file.name}: ${message}`);
      console.error("[MP Webhook] Processing failed:", file.name, err);
      continue;
    }
    processed.add(file.name);
  }

  let cashFlowSync:
    | {
        created: number;
        duplicates: number;
        errors: string[];
        failed: number;
        total: number;
      }
    | undefined;
  if (processedCount > 0) {
    cashFlowSync = await MercadoPagoService.syncCashFlow(0);
  }

  await persistProcessedFiles(PROCESSED_FILES_KEY, processed);
  await finalizeMpSyncLogEntry(logId, {
    status: processingErrors.length > 0 ? "ERROR" : "SUCCESS",
    inserted: processedCount,
    errorMessage: processingErrors.length > 0 ? processingErrors.join(" | ") : undefined,
    changeDetails: {
      processedFiles: processedCount,
      processingErrors,
      transactionId: payload.transaction_id,
      reportType: payload.report_type,
      reportTypes: [reportType],
      cashFlowSync: cashFlowSync ?? null,
    },
  });
}

mercadopagoRoutes.post("/webhook", async (c) => {
  if (process.env.NODE_ENV === "production" && !MP_WEBHOOK_PASSWORD) {
    return reply(c, { status: "error", message: "Webhook not configured" }, 500);
  }

  try {
    const payload = await c.req.json<MPWebhookPayload>();
    logWebhookNotification(payload);

    if (!validateWebhookSignature(payload)) {
      console.warn("[MP Webhook] Invalid signature for transaction:", payload.transaction_id);
      return reply(c, { status: "error", message: "Invalid signature" }, 401);
    }

    const lockAcquired = await acquireWebhookLockOrQueue(payload);
    if (!lockAcquired) {
      return reply(c, { status: "accepted", message: "Queued for processing" }, 202);
    }

    try {
      await processWebhookFiles(payload);
    } finally {
      await releaseSchedulerLock();
    }

    return reply(c, { status: "ok", message: "Notification received" });
  } catch (e) {
    console.error("[MP Webhook] Error processing notification:", e);
    return reply(c, { status: "error", message: String(e) }, 500);
  }
});

mercadopagoRoutes.get("/sync/logs", async (c) => {
  const auth = await getAuth(c);
  if (!auth) {
    return reply(c, { status: "error", message: "No autorizado" }, 401);
  }

  const canRead = await hasPermission(auth.userId, "read", "Integration");
  if (!canRead) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const limit = Number(c.req.query("limit") ?? "50");
  const offset = Number(c.req.query("offset") ?? "0");
  const safeLimit = Number.isNaN(limit) ? 50 : Math.min(limit, 200);
  const safeOffset = Number.isNaN(offset) ? 0 : Math.max(offset, 0);
  const { logs, total } = await listMpSyncLogs({ limit: safeLimit, offset: safeOffset });
  return reply(c, { status: "ok", logs, total });
});

async function retryAcquireSchedulerLock(maxRetries: number) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const acquired = await acquireSchedulerLock();
    if (acquired) {
      return true;
    }
    if (attempt < maxRetries) {
      await sleep(200 + Math.random() * 600);
    }
  }
  return false;
}

async function enqueuePendingWebhook(payload: MPWebhookPayload) {
  const pending = await loadPendingWebhooks();
  if (pending.some((item) => item.transaction_id === payload.transaction_id)) {
    return;
  }
  pending.push({
    transaction_id: payload.transaction_id,
    report_type: payload.report_type,
    files: payload.files?.map((file) => ({
      name: file.name,
      type: file.type,
      url: file.url,
    })),
    createdAt: new Date().toISOString(),
  });
  const trimmed = pending.slice(-MAX_PENDING_WEBHOOKS);
  await updateSetting(PENDING_WEBHOOKS_KEY, JSON.stringify(trimmed));
}

async function loadPendingWebhooks() {
  const raw = await getSetting(PENDING_WEBHOOKS_KEY);
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

async function loadProcessedFiles(key: string) {
  const raw = await getSetting(key);
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

async function persistProcessedFiles(key: string, processed: Set<string>) {
  const now = new Date().toISOString();
  const trimmed = Array.from(processed)
    .slice(-250)
    .map((name) => ({ name, at: now }));
  await updateSetting(key, JSON.stringify(trimmed));
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
