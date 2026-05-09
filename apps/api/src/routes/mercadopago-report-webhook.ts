import bcrypt from "bcryptjs";
import { Hono } from "hono";
import { logError, logEvent, logWarn } from "../lib/logger.ts";
import { isSettlementReport, MercadoPagoService, MP_WEBHOOK_PASSWORD } from "../services/mercadopago/index.ts";

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

  void processReport(payload).catch((err) =>
    logError("mercadopago.report_webhook.processing_error", err, {
      transactionId: payload?.transaction_id ?? null,
    }),
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

async function processReport(payload: ReportWebhookPayload) {
  const validFiles = (payload.files ?? []).filter(
    (f): f is { name: string; url: string; type?: string } => Boolean(f.name && f.url),
  );

  if (validFiles.length === 0) {
    logWarn("mercadopago.report_webhook.no_files", {
      transactionId: payload.transaction_id ?? null,
    });
    return;
  }

  const reportType = isSettlementReport(payload.report_type, validFiles[0]?.name)
    ? "settlement"
    : "release";

  for (const file of validFiles) {
    if (!isCsvFile(file)) {
      logEvent("mercadopago.report_webhook.skipped_non_csv", {
        transactionId: payload.transaction_id ?? null,
        fileName: file.name,
        type: file.type ?? null,
      });
      continue;
    }
    try {
      const stats = await MercadoPagoService.processReport(reportType, { url: file.url });
      logEvent("mercadopago.report_webhook.processed", {
        transactionId: payload.transaction_id ?? null,
        reportType,
        fileName: file.name,
        stats,
      });
    } catch (err) {
      logError("mercadopago.report_webhook.file_failed", err, {
        transactionId: payload.transaction_id ?? null,
        fileName: file.name,
      });
    }
  }
}

function isCsvFile(file: { name: string; type?: string }): boolean {
  return file.type === ".csv" || file.name.toLowerCase().endsWith(".csv");
}
