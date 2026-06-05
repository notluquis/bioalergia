// Adapter BCI (trabajaenbci.cl). El portal público es una SPA React con búsqueda
// ReactiveSearch/ElasticSearch, PERO el proxy ES `_search` es PÚBLICO (sin token):
//
//   POST https://trabajaenbci.cl/api/v3/bci_portals/_search
//   body: {"query":{"match_all":{}},"size":N}
//   → respuesta ElasticSearch cruda: hits.hits[]._source (objeto de la oferta).
//
// Incluye ofertas Chile Y Perú (is_peruvian_process) — se incluyen ambas a propósito.
// FRÁGIL: depende de que BCI mantenga el endpoint público + nombres de campos del
// índice `bci_solutions-production-portals`. Si rota a token/cambia índice, se rompe
// (decisión consciente: reverse ES en vez de headless browser).

import { logWarn } from "../../lib/logger.ts";
import type { RawJob } from "./types.ts";

const SEARCH_URL = "https://trabajaenbci.cl/api/v3/bci_portals/_search";
const SITE_BASE = "https://trabajaenbci.cl";
const FETCH_TIMEOUT_MS = 15_000;
const PAGE_SIZE = 100;
const UA = "BioalergiaJobRadar/1.0 (+personal job search)";

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null;
}

function asString(v: unknown): string | null {
  if (typeof v === "string") return v.trim().length > 0 ? v.trim() : null;
  if (typeof v === "number") return String(v);
  return null;
}

function asBool(v: unknown): boolean {
  return v === true;
}

// "DD/MM/YYYY" (published_at_date_text / close_time_date_text) o ISO.
function parseDate(raw: unknown): Date | null {
  const s = asString(raw);
  if (!s) return null;
  const dmy = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const t = Date.parse(`${y}-${m}-${d}T00:00:00`);
    return Number.isNaN(t) ? null : new Date(t);
  }
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t);
}

function buildLocation(s: Record<string, unknown>): string | null {
  const commune = asString(s.commune_name);
  const region = asString(s.region_name);
  if (commune && region) return `${commune}, ${region}`;
  return commune ?? region ?? null;
}

function mapHit(source: Record<string, unknown>): RawJob | null {
  const externalId = asString(source.id);
  const title = asString(source.title);
  if (!externalId || !title) return null;

  const publicUrl = asString(source.public_url); // ej "/offers/112152"
  const url = publicUrl
    ? `${SITE_BASE}${publicUrl.startsWith("/") ? "" : "/"}${publicUrl}`
    : `${SITE_BASE}/offers/${externalId}`;

  const peru = asBool(source.is_peruvian_process);
  const typeName = asString(source.postulation_process_type_name);

  return {
    source: "bci",
    company: "bci",
    externalId,
    title,
    url,
    department: asString(source.bci_department_title),
    location: peru ? (buildLocation(source) ?? "Perú") : buildLocation(source),
    remote: null, // BCI no expone modalidad estructurada en el índice
    descriptionHtml: asString(source.long_description) ?? asString(source.description),
    publishedAt: parseDate(source.published_at_date_text) ?? parseDate(source.created_at),
    lastmod: parseDate(source.updated_at),
    raw: { ...source, _country: peru ? "PE" : "CL", _type: typeName },
  };
}

/**
 * Trae todas las ofertas vigentes de BCI (Chile + Perú), normalizadas.
 * Devuelve [] si el endpoint falla.
 */
export async function fetchBciJobs(): Promise<RawJob[]> {
  let text: string;
  try {
    const res = await fetch(SEARCH_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": UA, accept: "application/json" },
      body: JSON.stringify({ query: { match_all: {} }, size: PAGE_SIZE }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      logWarn("job_radar.bci.non_ok", { status: res.status });
      return [];
    }
    text = await res.text();
  } catch (err) {
    logWarn("job_radar.bci.error", { error: err instanceof Error ? err.message : String(err) });
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    logWarn("job_radar.bci.bad_json", {});
    return [];
  }

  const hits = asRecord(asRecord(parsed)?.hits)?.hits;
  if (!Array.isArray(hits)) return [];

  const jobs: RawJob[] = [];
  for (const hit of hits) {
    const source = asRecord(asRecord(hit)?._source);
    if (!source) continue;
    const job = mapHit(source);
    if (job) jobs.push(job);
  }
  return jobs;
}
