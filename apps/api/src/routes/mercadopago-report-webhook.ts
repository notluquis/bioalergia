import bcrypt from "bcryptjs";
import { Hono } from "hono";
import { logError, logEvent, logWarn } from "../lib/logger";
import { MercadoPagoService, MP_WEBHOOK_PASSWORD } from "../services/mercadopago";

export const mercadopagoReportWebhookRoutes = new Hono();

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

  if (!(await verifySignature(payload, MP_WEBHOOK_PASSWORD))) {
    logWarn("mercadopago.report_webhook.signature_invalid", {
      hasSignature: Boolean(payload.signature),
      transactionId: payload.transaction_id ?? null,
    });
    return c.text("Unauthorized", 401);
  }

  logEvent("mercadopago.report_webhook.received", {
    transactionId: payload.transaction_id ?? null,
    generationDate: payload.generation_date ?? null,
    reportType: payload.report_type ?? null,
    status: payload.status ?? null,
    isTest: payload.is_test ?? null,
    fileCount: payload.files?.length ?? 0,
  });

  void processReportNotification(payload).catch((err) =>
    logError("mercadopago.report_webhook.processing_error", err),
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

async function processReportNotification(payload: ReportWebhookPayload) {
  if (payload.is_test) {
    logEvent("mercadopago.report_webhook.test_skipped", {
      transactionId: payload.transaction_id ?? null,
    });
    return;
  }

  const reportType = inferReportType(payload);
  const files = payload.files ?? [];

  if (files.length === 0) {
    logWarn("mercadopago.report_webhook.no_files", {
      transactionId: payload.transaction_id ?? null,
    });
    return;
  }

  for (const file of files) {
    const url = file.url;
    const fileName = file.name;
    if (!url && !fileName) continue;

    const stats = await MercadoPagoService.processReport(reportType, { url, fileName });
    logEvent("mercadopago.report_webhook.processed", {
      transactionId: payload.transaction_id ?? null,
      reportType,
      fileName: fileName ?? null,
      stats,
    });
  }
}

function inferReportType(payload: ReportWebhookPayload): "release" | "settlement" {
  const raw = (payload.report_type ?? "").toLowerCase();
  if (raw.includes("settlement") || raw.includes("liquidaci")) return "settlement";
  return "release";
}
