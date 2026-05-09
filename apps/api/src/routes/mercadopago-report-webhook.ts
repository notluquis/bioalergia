import { createHmac, timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { logError, logEvent, logWarn } from "../lib/logger";
import { MercadoPagoService, MP_WEBHOOK_PASSWORD } from "../services/mercadopago";

export const mercadopagoReportWebhookRoutes = new Hono();

type ReportWebhookPayload = {
  transaction_id?: string;
  generation_date?: string;
  file_name?: string;
  files?: Array<{ file_name?: string; url?: string }>;
  url?: string;
  signature?: string;
  type?: string;
  report_type?: string;
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

  if (!verifySignature(payload, MP_WEBHOOK_PASSWORD)) {
    logWarn("mercadopago.report_webhook.signature_invalid", {
      hasSignature: Boolean(payload.signature),
      transactionId: payload.transaction_id ?? null,
    });
    return c.text("Unauthorized", 401);
  }

  logEvent("mercadopago.report_webhook.received", {
    transactionId: payload.transaction_id ?? null,
    generationDate: payload.generation_date ?? null,
    fileName: payload.file_name ?? payload.files?.[0]?.file_name ?? null,
  });

  void processReportNotification(payload).catch((err) =>
    logError("mercadopago.report_webhook.processing_error", err),
  );

  return c.text("Accepted", 202);
});

function verifySignature(payload: ReportWebhookPayload, secret: string): boolean {
  const provided = payload.signature;
  if (!provided || !payload.transaction_id || !payload.generation_date) {
    return false;
  }

  const message = `${payload.transaction_id}${payload.generation_date}`;
  const expected = createHmac("sha256", secret).update(message).digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function processReportNotification(payload: ReportWebhookPayload) {
  const reportType = inferReportType(payload);
  const url = payload.url ?? payload.files?.[0]?.url;
  const fileName = payload.file_name ?? payload.files?.[0]?.file_name;

  if (!url && !fileName) {
    logWarn("mercadopago.report_webhook.no_source", {
      transactionId: payload.transaction_id ?? null,
    });
    return;
  }

  const stats = await MercadoPagoService.processReport(reportType, { url, fileName });
  logEvent("mercadopago.report_webhook.processed", {
    transactionId: payload.transaction_id ?? null,
    reportType,
    stats,
  });
}

function inferReportType(payload: ReportWebhookPayload): "release" | "settlement" {
  const raw = (payload.report_type ?? payload.type ?? "").toLowerCase();
  if (raw.includes("settlement")) return "settlement";
  return "release";
}
