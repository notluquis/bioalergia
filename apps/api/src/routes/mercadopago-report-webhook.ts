import bcrypt from "bcryptjs";
import { Hono } from "hono";
import { runMercadoPagoAutoSync } from "../lib/mercadopago/mercadopago-scheduler";
import { logError, logEvent, logWarn } from "../lib/logger";
import { MP_WEBHOOK_PASSWORD } from "../services/mercadopago";
import { getSetting, updateSetting } from "../services/settings";

export const mercadopagoReportWebhookRoutes = new Hono();

const PENDING_WEBHOOKS_SETTING = "mp:webhook:pending";
const MAX_QUEUE_SIZE = 100;

type ReportWebhookFile = {
  name?: string;
  url?: string;
  type?: string;
};

type ReportWebhookPayload = {
  transaction_id?: string;
  request_date?: string;
  generation_date?: string;
  files?: ReportWebhookFile[];
  status?: string;
  creation_type?: string;
  report_type?: string;
  is_test?: boolean;
  signature?: string;
};

type QueuedWebhook = {
  transaction_id: string;
  report_type: string;
  files: Array<{ name: string; type: string; url: string }>;
  createdAt: string;
};

mercadopagoReportWebhookRoutes.post("/", async (c) => {
  let payload: ReportWebhookPayload | null = null;
  try {
    payload = await c.req.json();
  } catch {
    logWarn("mercadopago.report_webhook.invalid_json", {});
    return c.text("Bad Request", 400);
  }

  if (!payload) {
    return c.text("Bad Request", 400);
  }

  if (!MP_WEBHOOK_PASSWORD) {
    logError("mercadopago.report_webhook.missing_secret", new Error("MP_WEBHOOK_PASSWORD not set"));
    return c.text("Service Unavailable", 503);
  }

  if (!payload.transaction_id || !payload.generation_date) {
    logWarn("mercadopago.report_webhook.missing_fields", {
      hasTransactionId: Boolean(payload.transaction_id),
      hasGenerationDate: Boolean(payload.generation_date),
    });
    return c.text("Bad Request", 400);
  }

  if (!(await verifySignature(payload, MP_WEBHOOK_PASSWORD))) {
    logWarn("mercadopago.report_webhook.signature_invalid", {
      hasSignature: Boolean(payload.signature),
      transactionId: payload.transaction_id,
    });
    return c.text("Unauthorized", 401);
  }

  logEvent("mercadopago.report_webhook.received", {
    transactionId: payload.transaction_id,
    generationDate: payload.generation_date,
    reportType: payload.report_type ?? null,
    status: payload.status ?? null,
    isTest: payload.is_test ?? null,
    fileCount: payload.files?.length ?? 0,
  });

  if (payload.is_test) {
    logEvent("mercadopago.report_webhook.test_skipped", {
      transactionId: payload.transaction_id,
    });
    return c.text("Accepted", 202);
  }

  void enqueueAndTrigger(payload).catch((err) =>
    logError("mercadopago.report_webhook.enqueue_error", err),
  );

  return c.text("Accepted", 202);
});

async function verifySignature(payload: ReportWebhookPayload, secret: string): Promise<boolean> {
  const provided = payload.signature;
  if (!provided || !payload.transaction_id || !payload.generation_date) {
    return false;
  }

  const plain = `${payload.transaction_id}-${secret}-${payload.generation_date}`;
  try {
    return await bcrypt.compare(plain, provided);
  } catch {
    return false;
  }
}

async function enqueueAndTrigger(payload: ReportWebhookPayload) {
  const validFiles = (payload.files ?? [])
    .filter((f): f is { name: string; url: string; type?: string } => Boolean(f.name && f.url))
    .map((f) => ({ name: f.name, url: f.url, type: f.type ?? "" }));

  if (validFiles.length === 0) {
    logWarn("mercadopago.report_webhook.no_files", {
      transactionId: payload.transaction_id ?? null,
    });
    return;
  }

  const normalizedType = normalizeReportType(payload.report_type, validFiles[0]?.name);
  const entry: QueuedWebhook = {
    transaction_id: payload.transaction_id ?? "",
    report_type: normalizedType,
    files: validFiles,
    createdAt: new Date().toISOString(),
  };

  const existing = await loadQueue();
  if (existing.some((q) => q.transaction_id === entry.transaction_id)) {
    logEvent("mercadopago.report_webhook.duplicate_skip", {
      transactionId: entry.transaction_id,
    });
    return;
  }

  const next = [...existing, entry].slice(-MAX_QUEUE_SIZE);
  await updateSetting(PENDING_WEBHOOKS_SETTING, JSON.stringify(next));

  logEvent("mercadopago.report_webhook.enqueued", {
    transactionId: entry.transaction_id,
    queueSize: next.length,
  });

  void runMercadoPagoAutoSync({ trigger: `webhook:${entry.transaction_id}` }).catch((err) =>
    logError("mercadopago.report_webhook.autosync_trigger_error", err),
  );
}

function normalizeReportType(reportType: string | undefined, fileName: string | undefined): string {
  const haystack = `${reportType ?? ""} ${fileName ?? ""}`.toLowerCase();
  if (
    haystack.includes("settlement") ||
    haystack.includes("liquidaci") ||
    haystack.includes("account_money") ||
    haystack.includes("all_transactions") ||
    haystack.includes("todas_las_transacciones") ||
    haystack.includes("todas-las-transacciones")
  ) {
    return "settlement";
  }
  return "release";
}

async function loadQueue(): Promise<QueuedWebhook[]> {
  const raw = await getSetting(PENDING_WEBHOOKS_SETTING);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueuedWebhook[]) : [];
  } catch {
    return [];
  }
}
