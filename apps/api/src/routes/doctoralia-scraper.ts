import { db } from "@finanzas/db";
import { Hono } from "hono";
import { doctoraliaScraperApiToken } from "../config";
import type { DoctoraliaCalendarResponse } from "../lib/doctoralia/doctoralia-calendar-types";
import { logError, logEvent } from "../lib/logger";
import { doctoraliaCalendarSyncService } from "../services/doctoralia-calendar";

export const doctoraliaScraperRoutes = new Hono();

type StoredCookie = {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: number;
};

const DEFAULT_LABEL = "default";

function bearerMatches(header: string | undefined | null): boolean {
  if (!doctoraliaScraperApiToken) return false;
  if (!header) return false;
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) return false;
  return m[1].trim() === doctoraliaScraperApiToken;
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

  const cookies = (store.cookiesJson as unknown as StoredCookie[]) ?? [];

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
    const store = await db.doctoraliaCookieStore.upsert({
      where: { label: parsed.label },
      create: {
        label: parsed.label,
        cookiesJson: parsed.cookies,
        lastUsedAt: new Date(),
      },
      update: {
        cookiesJson: parsed.cookies,
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
    return c.json({ error: "update_failed" }, 500);
  }
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
      "scraper-cron",
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
  body: unknown,
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
  const label = typeof raw.label === "string" && raw.label.trim() ? raw.label.trim() : DEFAULT_LABEL;
  const cookies = raw.cookies;
  if (!Array.isArray(cookies)) return null;
  const normalized: StoredCookie[] = [];
  for (const c of cookies) {
    if (!c || typeof c !== "object") continue;
    const obj = c as Record<string, unknown>;
    if (typeof obj.name !== "string" || typeof obj.value !== "string") continue;
    normalized.push({
      name: obj.name,
      value: obj.value,
      domain: typeof obj.domain === "string" ? obj.domain : undefined,
      path: typeof obj.path === "string" ? obj.path : undefined,
      expires: typeof obj.expires === "number" ? obj.expires : undefined,
    });
  }
  if (normalized.length === 0) return null;
  return { label, cookies: normalized };
}
