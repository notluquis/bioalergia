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

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || "";
const MP_WEBHOOK_PASSWORD = process.env.MP_WEBHOOK_PASSWORD || "";
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

// Check MP configured
function checkMpConfig() {
  if (!MP_ACCESS_TOKEN) {
    throw new Error("MP_ACCESS_TOKEN not configured");
  }
}

// API Endpoints
const MP_API_RELEASE = "https://api.mercadopago.com/v1/account/release_report";
const MP_API_SETTLEMENT =
  "https://api.mercadopago.com/v1/account/settlement_report";

// Generic fetcher for both report types
async function mpFetch(
  endpoint: string,
  baseUrl: string,
  options: RequestInit = {}
) {
  checkMpConfig();
  const url = endpoint ? `${baseUrl}${endpoint}` : baseUrl;

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MP API error: ${res.status} - ${text}`);
  }
  return res;
}

// Helper to safely parse MP response (handles 204 No Content)
async function safeMpJson(res: Response) {
  if (res.status === 204) {
    return { status: "success", message: "Operation completed successfully" };
  }
  const text = await res.text();
  if (!text) {
    return { status: "success", message: "Operation completed successfully" };
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `Failed to parse MP response: ${text.substring(0, 100)}...`
    );
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
    const res = await mpFetch("/list", MP_API_RELEASE);
    const data = await safeMpJson(res);
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

  const { begin_date, end_date } = await c.req.json<{
    begin_date: string;
    end_date: string;
  }>();

  try {
    const res = await mpFetch("", MP_API_RELEASE, {
      method: "POST",
      body: JSON.stringify({ begin_date, end_date }),
    });
    const data = await safeMpJson(res);
    console.log(
      "[MP Release] Report created by",
      auth.email,
      ":",
      begin_date,
      "-",
      end_date
    );
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
    checkMpConfig();
    const res = await fetch(`${MP_API_RELEASE}/${fileName}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    });

    if (!res.ok) throw new Error(`Download failed: ${res.status}`);

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
    const res = await mpFetch("/list", MP_API_SETTLEMENT);
    const data = await safeMpJson(res);
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
    const res = await mpFetch("", MP_API_SETTLEMENT, {
      method: "POST",
      body: JSON.stringify(body),
    });
    const data = await safeMpJson(res);
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
    checkMpConfig();
    const res = await fetch(`${MP_API_SETTLEMENT}/${fileName}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    });

    if (!res.ok) throw new Error(`Download failed: ${res.status}`);

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

      if (!isValid) {
        console.warn(
          "[MP Webhook] Invalid signature for transaction:",
          payload.transaction_id
        );
        return c.json({ status: "error", message: "Invalid signature" }, 401);
      }

      console.log(
        "[MP Webhook] Signature validated for transaction:",
        payload.transaction_id
      );
    } else {
      console.warn(
        "[MP Webhook] MP_WEBHOOK_PASSWORD not configured, skipping signature validation"
      );
    }

    // Log the files available for download
    if (payload.files?.length) {
      for (const file of payload.files) {
        console.log("[MP Webhook] File available:", {
          name: file.name,
          type: file.type,
          url: file.url,
        });
      }
    }

    // TODO: Add download logic and database storage here

    // Return 200 OK to acknowledge receipt
    return c.json({ status: "ok", message: "Notification received" });
  } catch (e) {
    console.error("[MP Webhook] Error processing notification:", e);
    return c.json({ status: "error", message: String(e) }, 500);
  }
});
