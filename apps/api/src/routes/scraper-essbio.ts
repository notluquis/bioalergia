// Ingress Bearer-auth para el scraper de Essbio (browser-based login).
// El scraper loguea con sesión autenticada (reCAPTCHA v3) y postea el historial
// de facturación normalizado; acá se persiste como snapshots (dedupe por folio).

import { db } from "@finanzas/db";
import { Hono } from "hono";

import { doctoraliaScraperApiToken } from "../lib/config.ts";
import { logError, logEvent } from "../lib/logger.ts";
import { ingestEssbioHistory } from "../services/utility-bills.ts";

export const scraperEssbioRoutes = new Hono();

function bearerMatches(header: null | string | undefined): boolean {
  if (!doctoraliaScraperApiToken || !header) return false;
  const m = header.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() === doctoraliaScraperApiToken : false;
}

scraperEssbioRoutes.use("*", async (c, next) => {
  if (!doctoraliaScraperApiToken) return c.json({ error: "scraper_api_disabled" }, 503);
  if (!bearerMatches(c.req.header("authorization"))) return c.json({ error: "unauthorized" }, 401);
  return next();
});

interface IngestBody {
  dueDate?: null | string; // ISO YYYY-MM-DD
  externalAccountId?: null | string; // id_servicio Essbio
  rows?: Array<{
    consumption?: number;
    folio?: string;
    period?: string; // MM/YYYY
    reading?: number;
    total?: number;
  }>;
  serviceNumber?: string; // numero_servicio (resuelve la cuenta)
}

scraperEssbioRoutes.post("/import", async (c) => {
  let body: IngestBody;
  try {
    body = (await c.req.json()) as IngestBody;
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  if (!body.serviceNumber || !Array.isArray(body.rows)) {
    return c.json({ error: "invalid_payload" }, 400);
  }

  const account = await db.utilityAccount.findFirst({
    where: { provider: "ESSBIO", serviceNumber: body.serviceNumber },
  });
  if (!account) {
    return c.json({ error: "account_not_found", serviceNumber: body.serviceNumber }, 404);
  }

  // Setear id_servicio si vino y falta
  if (body.externalAccountId && !account.externalAccountId) {
    await db.utilityAccount.update({
      where: { id: account.id },
      data: { externalAccountId: body.externalAccountId },
    });
  }

  const entries = body.rows
    .filter((r) => r.folio)
    .map((r) => ({
      consumption: Number(r.consumption ?? 0),
      folio: String(r.folio),
      period: (r.period ?? "").trim(),
      reading: Number(r.reading ?? 0),
      total: Number(r.total ?? 0),
    }));

  try {
    const result = await ingestEssbioHistory(account.id, entries, body.dueDate ?? null);
    logEvent("scraper.essbio.import", {
      accountId: account.id,
      dueDate: body.dueDate ?? null,
      imported: result.imported,
      skipped: result.skipped,
      total: result.total,
    });
    return c.json({ status: "ok", ...result });
  } catch (err) {
    logError("scraper.essbio.import_failed", err);
    return c.json({ error: "import_failed", message: (err as Error).message }, 500);
  }
});
