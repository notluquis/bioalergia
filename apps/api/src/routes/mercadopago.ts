/**
 * Mercado Pago Routes for Hono API
 *
 * Handles MP report config, creation, download, and schedule
 * Supports:
 * - Release Report (Liberaciones)
 * - Settlement Report (Conciliación)
 */

import { Hono } from "hono";
import { stream } from "hono/streaming";
import { getCookie } from "hono/cookie";
import { verifyToken } from "../lib/paseto";
import { hasPermission } from "../auth";

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || "";
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
  // Ensure we don't double slash if endpoint is empty
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
    return {
      status: "success",
      message: "Operation completed successfully (No Content)",
    };
  }
  const text = await res.text();
  if (!text) {
    return {
      status: "success",
      message: "Operation completed successfully (Empty Body)",
    };
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(
      `Failed to parse MP response: ${text.substring(0, 100)}...`
    );
  }
}

// ============================================================
// RELEASE REPORTS (Existing Implementation)
// ============================================================

mercadopagoRoutes.get("/config", async (c) => {
  const auth = await getAuth(c);
  if (!auth) return c.json({ status: "error", message: "No autorizado" }, 401);

  const canRead = await hasPermission(auth.userId, "read", "Integration");
  if (!canRead) return c.json({ status: "error", message: "Forbidden" }, 403);

  try {
    const res = await mpFetch("/config", MP_API_RELEASE);
    const data = await safeMpJson(res);
    return c.json(data);
  } catch (e) {
    return c.json({ status: "error", message: String(e) }, 500);
  }
});

mercadopagoRoutes.post("/config", async (c) => {
  const auth = await getAuth(c);
  if (!auth) return c.json({ status: "error", message: "No autorizado" }, 401);

  const canUpdate = await hasPermission(auth.userId, "update", "Integration");
  if (!canUpdate) return c.json({ status: "error", message: "Forbidden" }, 403);

  const body = await c.req.json();

  try {
    const res = await mpFetch("/config", MP_API_RELEASE, {
      method: "POST",
      body: JSON.stringify(body),
    });
    const data = await safeMpJson(res);
    console.log("[MP Release] Config created by", auth.email);
    return c.json(data, 201);
  } catch (e) {
    return c.json({ status: "error", message: String(e) }, 500);
  }
});

mercadopagoRoutes.put("/config", async (c) => {
  const auth = await getAuth(c);
  if (!auth) return c.json({ status: "error", message: "No autorizado" }, 401);

  const canUpdate = await hasPermission(auth.userId, "update", "Integration");
  if (!canUpdate) return c.json({ status: "error", message: "Forbidden" }, 403);

  const body = await c.req.json();

  try {
    const res = await mpFetch("/config", MP_API_RELEASE, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    const data = await safeMpJson(res);
    console.log("[MP Release] Config updated by", auth.email);
    return c.json(data);
  } catch (e) {
    return c.json({ status: "error", message: String(e) }, 500);
  }
});

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

mercadopagoRoutes.get("/reports/:id", async (c) => {
  const auth = await getAuth(c);
  if (!auth) return c.json({ status: "error", message: "No autorizado" }, 401);

  const canRead = await hasPermission(auth.userId, "read", "Integration");
  if (!canRead) return c.json({ status: "error", message: "Forbidden" }, 403);

  const id = c.req.param("id");

  try {
    const res = await mpFetch(`/${id}`, MP_API_RELEASE);
    const data = await safeMpJson(res);
    return c.json(data);
  } catch (e) {
    return c.json({ status: "error", message: String(e) }, 500);
  }
});

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

mercadopagoRoutes.post("/schedule", async (c) => {
  const auth = await getAuth(c);
  if (!auth) return c.json({ status: "error", message: "No autorizado" }, 401);

  const canUpdate = await hasPermission(auth.userId, "update", "Integration");
  if (!canUpdate) return c.json({ status: "error", message: "Forbidden" }, 403);

  try {
    const res = await mpFetch("/schedule", MP_API_RELEASE, {
      method: "POST",
      body: JSON.stringify({ enabled: true }),
    });
    const data = await safeMpJson(res);
    console.log("[MP Release] Schedule enabled by", auth.email);
    return c.json(data);
  } catch (e) {
    return c.json({ status: "error", message: String(e) }, 500);
  }
});

mercadopagoRoutes.delete("/schedule", async (c) => {
  const auth = await getAuth(c);
  if (!auth) return c.json({ status: "error", message: "No autorizado" }, 401);

  const canUpdate = await hasPermission(auth.userId, "update", "Integration");
  if (!canUpdate) return c.json({ status: "error", message: "Forbidden" }, 403);

  try {
    const res = await mpFetch("/schedule", MP_API_RELEASE, {
      method: "DELETE",
    });
    const data = await safeMpJson(res);
    console.log("[MP Release] Schedule disabled by", auth.email);
    return c.json(data);
  } catch (e) {
    return c.json({ status: "error", message: String(e) }, 500);
  }
});

// ============================================================
// SETTLEMENT REPORTS (New Implementation - Reconciliation)
// ============================================================

mercadopagoRoutes.get("/settlement/config", async (c) => {
  const auth = await getAuth(c);
  if (!auth) return c.json({ status: "error", message: "No autorizado" }, 401);

  const canRead = await hasPermission(auth.userId, "read", "Integration");
  if (!canRead) return c.json({ status: "error", message: "Forbidden" }, 403);

  try {
    const res = await mpFetch("/config", MP_API_SETTLEMENT);
    const data = await safeMpJson(res);
    return c.json(data);
  } catch (e) {
    return c.json({ status: "error", message: String(e) }, 500);
  }
});

mercadopagoRoutes.post("/settlement/config", async (c) => {
  const auth = await getAuth(c);
  if (!auth) return c.json({ status: "error", message: "No autorizado" }, 401);

  const canUpdate = await hasPermission(auth.userId, "update", "Integration");
  if (!canUpdate) return c.json({ status: "error", message: "Forbidden" }, 403);

  const body = await c.req.json();

  try {
    const res = await mpFetch("/config", MP_API_SETTLEMENT, {
      method: "POST",
      body: JSON.stringify(body),
    });
    const data = await safeMpJson(res);
    console.log("[MP Settlement] Config created by", auth.email);
    return c.json(data, 201);
  } catch (e) {
    return c.json({ status: "error", message: String(e) }, 500);
  }
});

mercadopagoRoutes.put("/settlement/config", async (c) => {
  const auth = await getAuth(c);
  if (!auth) return c.json({ status: "error", message: "No autorizado" }, 401);

  const canUpdate = await hasPermission(auth.userId, "update", "Integration");
  if (!canUpdate) return c.json({ status: "error", message: "Forbidden" }, 403);

  const body = await c.req.json();

  try {
    console.log(
      "[MP Settlement] PUT config body:",
      JSON.stringify(body, null, 2)
    );
    const res = await mpFetch("/config", MP_API_SETTLEMENT, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    const data = await safeMpJson(res);
    console.log("[MP Settlement] Config updated by", auth.email);
    return c.json(data);
  } catch (e) {
    return c.json({ status: "error", message: String(e) }, 500);
  }
});

// Manual Report Creation
mercadopagoRoutes.post("/settlement/reports", async (c) => {
  const auth = await getAuth(c);
  if (!auth) return c.json({ status: "error", message: "No autorizado" }, 401);

  const canCreate = await hasPermission(auth.userId, "read", "Integration");
  if (!canCreate) return c.json({ status: "error", message: "Forbidden" }, 403);

  // Payload: { "begin_date": "...", "end_date": "..." }
  const body = await c.req.json();

  try {
    // POST to base URL creates manual report
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

// Download Report
mercadopagoRoutes.get("/settlement/reports/download/:fileName", async (c) => {
  const auth = await getAuth(c);
  if (!auth) return c.json({ status: "error", message: "No autorizado" }, 401);

  const canRead = await hasPermission(auth.userId, "read", "Integration");
  if (!canRead) return c.json({ status: "error", message: "Forbidden" }, 403);

  const fileName = c.req.param("fileName");

  try {
    checkMpConfig();
    // According to docs: GET https://api.mercadopago.com/v1/account/settlement_report/:file_name
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

// Schedule
mercadopagoRoutes.post("/settlement/schedule", async (c) => {
  const auth = await getAuth(c);
  if (!auth) return c.json({ status: "error", message: "No autorizado" }, 401);

  const canUpdate = await hasPermission(auth.userId, "update", "Integration");
  if (!canUpdate) return c.json({ status: "error", message: "Forbidden" }, 403);

  try {
    // POST /schedule with empty body (implicit enablement?) or check docs
    // Docs say: POST .../schedule to enable.
    const res = await mpFetch("/schedule", MP_API_SETTLEMENT, {
      method: "POST",
      body: JSON.stringify({ enabled: true }),
    });
    const data = await safeMpJson(res);
    console.log("[MP Settlement] Schedule enabled by", auth.email);
    return c.json(data);
  } catch (e) {
    return c.json({ status: "error", message: String(e) }, 500);
  }
});

mercadopagoRoutes.delete("/settlement/schedule", async (c) => {
  const auth = await getAuth(c);
  if (!auth) return c.json({ status: "error", message: "No autorizado" }, 401);

  const canUpdate = await hasPermission(auth.userId, "update", "Integration");
  if (!canUpdate) return c.json({ status: "error", message: "Forbidden" }, 403);

  try {
    const res = await mpFetch("/schedule", MP_API_SETTLEMENT, {
      method: "DELETE",
    });
    const data = await safeMpJson(res);
    console.log("[MP Settlement] Schedule disabled by", auth.email);
    return c.json(data);
  } catch (e) {
    return c.json({ status: "error", message: String(e) }, 500);
  }
});
