import { db } from "@finanzas/db";
import { Hono } from "hono";
import { timingSafeEqual } from "node:crypto";
import { doctoraliaScraperApiToken } from "../lib/config.ts";
import type { DoctoraliaCalendarResponse } from "../lib/doctoralia/doctoralia-calendar-types.ts";
import { logError, logEvent } from "../lib/logger.ts";
import { doctoraliaCalendarSyncService } from "../services/doctoralia-calendar.ts";
import { consumeDoctoraliaScraperForceRun } from "../services/doctoralia-scraper-run-control.ts";
import { decryptSecret, encryptSecret } from "../services/provider-credentials.ts";

export const doctoraliaScraperRoutes = new Hono();

type StoredCookie = {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: number;
};

const DEFAULT_LABEL = "default";

// Comparación timing-safe (golden 2026): `===` filtra timing del token.
function bearerMatches(header: string | undefined | null): boolean {
  if (!doctoraliaScraperApiToken || !header) return false;
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) return false;
  const a = Buffer.from(m[1].trim());
  const b = Buffer.from(doctoraliaScraperApiToken);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Cookies cifradas at-rest (AES-256-GCM, mismo helper que ProviderCredential).
// Guardadas como { enc: "<blob>" } en el jsonb → base64, también esquiva el
// problema de null-bytes en jsonb. Lee legacy (array plano) por compat.
function decodeStoredCookies(raw: unknown): StoredCookie[] {
  if (Array.isArray(raw)) return raw as StoredCookie[]; // legacy plaintext
  if (raw && typeof raw === "object" && typeof (raw as { enc?: unknown }).enc === "string") {
    try {
      return JSON.parse(decryptSecret((raw as { enc: string }).enc)) as StoredCookie[];
    } catch {
      return [];
    }
  }
  return [];
}

function encodeStoredCookies(cookies: StoredCookie[]): { enc: string } {
  return { enc: encryptSecret(JSON.stringify(cookies)) };
}

doctoraliaScraperRoutes.use("*", async (c, next) => {
  if (!doctoraliaScraperApiToken) {
    return c.json({ error: "scraper_api_disabled" }, 503);
  }
  if (!bearerMatches(c.req.header("authorization"))) {
    return c.json({ error: "unauthorized" }, 401);
  }
  return next();
});

doctoraliaScraperRoutes.get("/cookies", async (c) => {
  const label = c.req.query("label") ?? DEFAULT_LABEL;
  const store = await db.doctoraliaCookieStore.findUnique({ where: { label } });

  if (!store) {
    return c.json({ error: "not_found", label }, 404);
  }

  const cookies = decodeStoredCookies(store.cookiesJson);

  await db.doctoraliaCookieStore.update({
    where: { id: store.id },
    data: { lastUsedAt: new Date() },
  });

  logEvent("doctoralia.scraper.cookies.fetch", {
    label,
    count: cookies.length,
  });

  return c.json({
    label: store.label,
    cookies,
    updatedAt: store.updatedAt.toISOString(),
    lastUsedAt: new Date().toISOString(),
  });
});

doctoraliaScraperRoutes.post("/cookies", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  const parsed = parseCookiesBody(body);
  if (!parsed) {
    return c.json({ error: "invalid_payload" }, 400);
  }

  try {
    const encrypted = encodeStoredCookies(parsed.cookies);
    const store = await db.doctoraliaCookieStore.upsert({
      where: { label: parsed.label },
      create: {
        label: parsed.label,
        cookiesJson: encrypted,
        lastUsedAt: new Date(),
      },
      update: {
        cookiesJson: encrypted,
        lastUsedAt: new Date(),
      },
    });

    logEvent("doctoralia.scraper.cookies.update", {
      label: store.label,
      source: "bot",
      count: parsed.cookies.length,
    });

    return c.json({ status: "ok", label: store.label, count: parsed.cookies.length });
  } catch (err) {
    logError("doctoralia.scraper.cookies.update_failed", err);
    // Exponer el mensaje real (endpoint interno con token) → diagnosticar sin
    // tener que escarbar logs del API. Si el sanitize no alcanzó, acá se ve.
    return c.json(
      { error: "update_failed", detail: err instanceof Error ? err.message : String(err) },
      500
    );
  }
});

doctoraliaScraperRoutes.post("/run-control/consume", async (c) => {
  const result = await consumeDoctoraliaScraperForceRun();

  logEvent("doctoralia.scraper.run_control.consume", {
    active: result.active,
    expiresAt: result.expiresAt,
    requestedAt: result.requestedAt,
    source: result.source,
  });

  return c.json({
    active: result.active,
    expiresAt: result.expiresAt,
    requestedAt: result.requestedAt,
    source: result.source,
  });
});

doctoraliaScraperRoutes.post("/calendar/import", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  const entries = parseImportEntries(body);
  if (!entries) {
    return c.json({ error: "invalid_payload" }, 400);
  }

  try {
    const result = await doctoraliaCalendarSyncService.importFromJsonEntries(
      entries,
      "scraper-cron"
    );

    logEvent("doctoralia.scraper.calendar.import", {
      syncLogId: result.syncLogId,
      entriesProcessed: result.entriesProcessed,
      schedulesInserted: result.summary.schedules.inserted,
      schedulesUpdated: result.summary.schedules.updated,
      appointmentsInserted: result.summary.appointments.inserted,
      appointmentsUpdated: result.summary.appointments.updated,
      workPeriodsInserted: result.summary.workPeriods.inserted,
      workPeriodsUpdated: result.summary.workPeriods.updated,
      errorCount: result.errors.length,
    });

    return c.json({ status: "ok", ...result });
  } catch (err) {
    logError("doctoralia.scraper.calendar.import_failed", err);
    return c.json({ error: "import_failed", message: (err as Error).message }, 500);
  }
});

function parseImportEntries(
  body: unknown
): Array<{ ts?: string; src?: string; data: DoctoraliaCalendarResponse }> | null {
  if (!body || typeof body !== "object") return null;
  const raw = (body as { entries?: unknown }).entries;
  if (!Array.isArray(raw)) return null;
  const out: Array<{ ts?: string; src?: string; data: DoctoraliaCalendarResponse }> = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const obj = entry as Record<string, unknown>;
    if (!obj.data || typeof obj.data !== "object") continue;
    out.push({
      ts: typeof obj.ts === "string" ? obj.ts : undefined,
      src: typeof obj.src === "string" ? obj.src : undefined,
      data: obj.data as DoctoraliaCalendarResponse,
    });
  }
  if (out.length === 0) return null;
  return out;
}

function parseCookiesBody(body: unknown): { label: string; cookies: StoredCookie[] } | null {
  if (!body || typeof body !== "object") return null;
  const raw = body as Record<string, unknown>;
  const label =
    typeof raw.label === "string" && raw.label.trim() ? raw.label.trim() : DEFAULT_LABEL;
  const cookies = raw.cookies;
  if (!Array.isArray(cookies)) return null;
  // Postgres jsonb rechaza null bytes y chars de control en strings -> upsert 500.
  // Las cookies de browser (datadog, tokens) pueden traerlos. Sanitizar.
  const stripCtrl = (s: string): string =>
    [...s].filter((ch) => ch.charCodeAt(0) > 31 && ch.charCodeAt(0) !== 127).join("");
  const normalized: StoredCookie[] = [];
  for (const c of cookies) {
    if (!c || typeof c !== "object") continue;
    const obj = c as Record<string, unknown>;
    if (typeof obj.name !== "string" || typeof obj.value !== "string") continue;
    normalized.push({
      name: stripCtrl(obj.name),
      value: stripCtrl(obj.value),
      domain: typeof obj.domain === "string" ? obj.domain : undefined,
      path: typeof obj.path === "string" ? obj.path : undefined,
      expires: typeof obj.expires === "number" ? obj.expires : undefined,
    });
  }
  if (normalized.length === 0) return null;
  return { label, cookies: normalized };
}
