/**
 * Mercado Pago Routes for Hono API
 *
 * Handles MP report config, creation, download, and schedule
 */

import { Hono } from "hono";
import { stream } from "hono/streaming";
import { getCookie } from "hono/cookie";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "";
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || "";
const COOKIE_NAME = "finanzas_session";

export const mercadopagoRoutes = new Hono();

// Helper to get auth
function getAuth(c: { req: { header: (name: string) => string | undefined } }) {
  const cookieHeader = c.req.header("Cookie");
  if (!cookieHeader) return null;
  const cookies = Object.fromEntries(
    cookieHeader.split(";").map((c) => c.trim().split("=")),
  );
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
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

// API calls to MP
const MP_API = "https://api.mercadopago.com/v1/account/release_report";

async function mpFetch(path: string, options: RequestInit = {}) {
  checkMpConfig();
  const res = await fetch(`${MP_API}${path}`, {
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

// ============================================================
// GET CONFIG
// ============================================================

mercadopagoRoutes.get("/config", async (c) => {
  const auth = getAuth(c);
  if (!auth) return c.json({ status: "error", message: "No autorizado" }, 401);

  try {
    const res = await mpFetch("/config");
    const data = await res.json();
    return c.json(data);
  } catch (e) {
    return c.json({ status: "error", message: String(e) }, 500);
  }
});

// ============================================================
// CREATE/UPDATE CONFIG
// ============================================================

mercadopagoRoutes.post("/config", async (c) => {
  const auth = getAuth(c);
  if (!auth) return c.json({ status: "error", message: "No autorizado" }, 401);

  const body = await c.req.json();

  try {
    const res = await mpFetch("/config", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const data = await res.json();
    console.log("[MP] Config created by", auth.email);
    return c.json(data, 201);
  } catch (e) {
    return c.json({ status: "error", message: String(e) }, 500);
  }
});

mercadopagoRoutes.put("/config", async (c) => {
  const auth = getAuth(c);
  if (!auth) return c.json({ status: "error", message: "No autorizado" }, 401);

  const body = await c.req.json();

  try {
    const res = await mpFetch("/config", {
      method: "PUT",
      body: JSON.stringify(body),
    });
    const data = await res.json();
    console.log("[MP] Config updated by", auth.email);
    return c.json(data);
  } catch (e) {
    return c.json({ status: "error", message: String(e) }, 500);
  }
});

// ============================================================
// REPORTS CRUD
// ============================================================

mercadopagoRoutes.get("/reports", async (c) => {
  const auth = getAuth(c);
  if (!auth) return c.json({ status: "error", message: "No autorizado" }, 401);

  try {
    const res = await mpFetch("/list");
    const data = await res.json();
    return c.json(data);
  } catch (e) {
    return c.json({ status: "error", message: String(e) }, 500);
  }
});

mercadopagoRoutes.post("/reports", async (c) => {
  const auth = getAuth(c);
  if (!auth) return c.json({ status: "error", message: "No autorizado" }, 401);

  const { begin_date, end_date } = await c.req.json<{
    begin_date: string;
    end_date: string;
  }>();

  try {
    const res = await mpFetch("", {
      method: "POST",
      body: JSON.stringify({ begin_date, end_date }),
    });
    const data = await res.json();
    console.log(
      "[MP] Report created by",
      auth.email,
      ":",
      begin_date,
      "-",
      end_date,
    );
    return c.json(data, 201);
  } catch (e) {
    return c.json({ status: "error", message: String(e) }, 500);
  }
});

mercadopagoRoutes.get("/reports/:id", async (c) => {
  const auth = getAuth(c);
  if (!auth) return c.json({ status: "error", message: "No autorizado" }, 401);

  const id = c.req.param("id");

  try {
    const res = await mpFetch(`/${id}`);
    const data = await res.json();
    return c.json(data);
  } catch (e) {
    return c.json({ status: "error", message: String(e) }, 500);
  }
});

// ============================================================
// DOWNLOAD REPORT
// ============================================================

mercadopagoRoutes.get("/reports/download/:fileName", async (c) => {
  const auth = getAuth(c);
  if (!auth) return c.json({ status: "error", message: "No autorizado" }, 401);

  const fileName = c.req.param("fileName");

  try {
    checkMpConfig();
    const res = await fetch(
      `https://api.mercadopago.com/v1/account/release_report/${fileName}`,
      {
        headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
      },
    );

    if (!res.ok) throw new Error(`Download failed: ${res.status}`);

    c.header(
      "Content-Type",
      res.headers.get("Content-Type") || "application/octet-stream",
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
// SCHEDULE
// ============================================================

mercadopagoRoutes.post("/schedule", async (c) => {
  const auth = getAuth(c);
  if (!auth) return c.json({ status: "error", message: "No autorizado" }, 401);

  try {
    const res = await mpFetch("/schedule", {
      method: "POST",
      body: JSON.stringify({ enabled: true }),
    });
    const data = await res.json();
    console.log("[MP] Schedule enabled by", auth.email);
    return c.json(data);
  } catch (e) {
    return c.json({ status: "error", message: String(e) }, 500);
  }
});

mercadopagoRoutes.delete("/schedule", async (c) => {
  const auth = getAuth(c);
  if (!auth) return c.json({ status: "error", message: "No autorizado" }, 401);

  try {
    const res = await mpFetch("/schedule", { method: "DELETE" });
    const data = await res.json();
    console.log("[MP] Schedule disabled by", auth.email);
    return c.json(data);
  } catch (e) {
    return c.json({ status: "error", message: String(e) }, 500);
  }
});
