/**
 * Mercado Pago Routes for Hono API
 *
 * Handles MP report list, creation, and download
 * Supports:
 * - Release Report (Liberaciones)
 * - Settlement Report (Conciliación)
 */

import { Hono } from "hono";
import { stream } from "hono/streaming";
import { getCookie } from "hono/cookie";
import bcrypt from "bcryptjs";
import { verifyToken } from "../lib/paseto";
import { hasPermission } from "../auth";
import {
  MercadoPagoService,
  MP_WEBHOOK_PASSWORD,
} from "../services/mercadopago";

const COOKIE_NAME = "finanzas_session";

export const mercadopagoRoutes = new Hono();

// Helper to get auth
async function getAuth(c: {
  req: { header: (name: string) => string | undefined };
}) {
  const cookieHeader = c.req.header("Cookie");
  if (!cookieHeader) return null;
  const cookies = Object.fromEntries(
    cookieHeader.split(";").map((c) => c.trim().split("="))
  );
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  try {
    const decoded = await verifyToken(token);
    return { userId: Number(decoded.sub), email: String(decoded.email) };
  } catch {
    return null;
  }
}

// ============================================================
// RELEASE REPORTS
// ============================================================

// List Reports
mercadopagoRoutes.get("/reports", async (c) => {
  const auth = await getAuth(c);
  if (!auth) return c.json({ status: "error", message: "No autorizado" }, 401);

  const canRead = await hasPermission(auth.userId, "read", "Integration");
  if (!canRead) return c.json({ status: "error", message: "Forbidden" }, 403);

  try {
    const data = await MercadoPagoService.listReports("release");
    return c.json(data);
  } catch (e) {
    return c.json({ status: "error", message: String(e) }, 500);
  }
});

// Create Manual Report
mercadopagoRoutes.post("/reports", async (c) => {
  const auth = await getAuth(c);
  if (!auth) return c.json({ status: "error", message: "No autorizado" }, 401);

  const canCreate = await hasPermission(auth.userId, "read", "Integration");
  if (!canCreate) return c.json({ status: "error", message: "Forbidden" }, 403);

  const body = await c.req.json();

  try {
    const data = await MercadoPagoService.createReport("release", body);
    console.log("[MP Release] Report created by", auth.email);
    return c.json(data, 201);
  } catch (e) {
    return c.json({ status: "error", message: String(e) }, 500);
  }
});

// Download Report
mercadopagoRoutes.get("/reports/download/:fileName", async (c) => {
  const auth = await getAuth(c);
  if (!auth) return c.json({ status: "error", message: "No autorizado" }, 401);

  const canRead = await hasPermission(auth.userId, "read", "Integration");
  if (!canRead) return c.json({ status: "error", message: "Forbidden" }, 403);

  const fileName = c.req.param("fileName");

  try {
    const res = await MercadoPagoService.downloadReport("release", fileName);

    c.header(
      "Content-Type",
      res.headers.get("Content-Type") || "application/octet-stream"
    );
    c.header("Content-Disposition", `attachment; filename="${fileName}"`);

    return stream(c, async (stream) => {
      const reader = res.body?.getReader();
      if (!reader) return;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        await stream.write(value);
      }
    });
  } catch (e) {
    return c.json({ status: "error", message: String(e) }, 500);
  }
});

// ============================================================
// SETTLEMENT REPORTS
// ============================================================

// List Reports
mercadopagoRoutes.get("/settlement/reports", async (c) => {
  const auth = await getAuth(c);
  if (!auth) return c.json({ status: "error", message: "No autorizado" }, 401);

  const canRead = await hasPermission(auth.userId, "read", "Integration");
  if (!canRead) return c.json({ status: "error", message: "Forbidden" }, 403);

  try {
    const data = await MercadoPagoService.listReports("settlement");
    return c.json(data);
  } catch (e) {
    return c.json({ status: "error", message: String(e) }, 500);
  }
});

// Create Manual Report
mercadopagoRoutes.post("/settlement/reports", async (c) => {
  const auth = await getAuth(c);
  if (!auth) return c.json({ status: "error", message: "No autorizado" }, 401);

  const canCreate = await hasPermission(auth.userId, "read", "Integration");
  if (!canCreate) return c.json({ status: "error", message: "Forbidden" }, 403);

  const body = await c.req.json();

  try {
    const data = await MercadoPagoService.createReport("settlement", body);
    console.log("[MP Settlement] Report created by", auth.email);
    return c.json(data, 201);
  } catch (e) {
    return c.json({ status: "error", message: String(e) }, 500);
  }
});

// Download Report
mercadopagoRoutes.get("/settlement/reports/download/:fileName", async (c) => {
  const auth = await getAuth(c);
  if (!auth) return c.json({ status: "error", message: "No autorizado" }, 401);

  const canRead = await hasPermission(auth.userId, "read", "Integration");
  if (!canRead) return c.json({ status: "error", message: "Forbidden" }, 403);

  const fileName = c.req.param("fileName");

  try {
    const res = await MercadoPagoService.downloadReport("settlement", fileName);

    c.header(
      "Content-Type",
      res.headers.get("Content-Type") || "application/octet-stream"
    );
    c.header("Content-Disposition", `attachment; filename="${fileName}"`);

    return stream(c, async (stream) => {
      const reader = res.body?.getReader();
      if (!reader) return;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        await stream.write(value);
      }
    });
  } catch (e) {
    return c.json({ status: "error", message: String(e) }, 500);
  }
});

// ============================================================
// MANUAL PROCESSING
// ============================================================

mercadopagoRoutes.post("/process-report", async (c) => {
  const auth = await getAuth(c);
  if (!auth) return c.json({ status: "error", message: "No autorizado" }, 401);

  const canCreate = await hasPermission(auth.userId, "read", "Integration");
  if (!canCreate) return c.json({ status: "error", message: "Forbidden" }, 403);

  const { fileName, reportType } = await c.req.json<{
    fileName: string;
    reportType: "release" | "settlement";
  }>();

  if (!fileName || !reportType) {
    return c.json(
      { status: "error", message: "Missing fileName or reportType" },
      400
    );
  }

  try {
    console.log(
      `[MP Process] Manual processing triggered for ${fileName} (${reportType}) by ${auth.email}`
    );

    const stats = await MercadoPagoService.processReport(reportType, {
      fileName,
    });

    return c.json({
      status: "success",
      message: "Reporte procesado exitosamente",
      stats,
    });
  } catch (e) {
    console.error(`[MP Process] Failed to process ${fileName}:`, e);
    return c.json({ status: "error", message: String(e) }, 500);
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

mercadopagoRoutes.post("/webhook", async (c) => {
  try {
    const payload = await c.req.json<MPWebhookPayload>();

    console.log("[MP Webhook] Received notification:", {
      transaction_id: payload.transaction_id,
      report_type: payload.report_type,
      status: payload.status,
      files_count: payload.files?.length || 0,
      is_test: payload.is_test,
    });

    // Validate signature if password is configured
    if (MP_WEBHOOK_PASSWORD) {
      const expectedInput = `${payload.transaction_id}-${MP_WEBHOOK_PASSWORD}-${payload.generation_date}`;
      const isValid = bcrypt.compareSync(expectedInput, payload.signature);

      if (!isValid && !payload.is_test) {
        console.warn(
          "[MP Webhook] Invalid signature for transaction:",
          payload.transaction_id
        );
        return c.json({ status: "error", message: "Invalid signature" }, 401);
      }
    }

    // Process files
    if (payload.files?.length) {
      for (const file of payload.files) {
        console.log("[MP Webhook] Processing file:", file.name);
        if (file.type === ".csv" || file.name.endsWith(".csv")) {
          // Determine type from report_type
          const type = payload.report_type.includes("settlement")
            ? "settlement"
            : "release";

          // Process asynchronously
          MercadoPagoService.processReport(type, { url: file.url }).catch(
            (err) => {
              console.error("[MP Webhook] Async processing failed:", err);
            }
          );
        }
      }
    }

    return c.json({ status: "ok", message: "Notification received" });
  } catch (e) {
    console.error("[MP Webhook] Error processing notification:", e);
    return c.json({ status: "error", message: String(e) }, 500);
  }
});
