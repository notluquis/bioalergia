// Adapter GetOnBoard (getonbrd.com) — principal bolsa tech de Chile.
// El endpoint `/api/v0/jobs` exige token, PERO la búsqueda es PÚBLICA:
//   GET https://www.getonbrd.com/api/v0/search/jobs?query={q}&per_page=50
//   → JSON:API { data: [{ id (slug), attributes: { title, description, remote,
//        remote_modality, category_name, company, published_at (epoch s) },
//        links: { public_url } }], meta: { total_pages } }
//
// Como /jobs (listar todo) es privado, consultamos por las keywords del perfil
// y deduplicamos. source/company fijos = "getonbrd" (la bolsa) para que la
// detección de CLOSED agrupe sobre el set que realmente trajimos por keyword.
// El empleador real va en title/url + raw._company.

import { logWarn } from "../../lib/logger.ts";
import type { RawJob } from "./types.ts";

const BASE = "https://www.getonbrd.com/api/v0/search/jobs";
const SITE = "https://www.getonbrd.com";
const FETCH_TIMEOUT_MS = 15_000;
const PER_PAGE = 50;
const UA = "BioalergiaJobRadar/1.0 (+personal job search)";

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null;
}

function asString(v: unknown): string | null {
  if (typeof v === "string") return v.trim().length > 0 ? v.trim() : null;
  if (typeof v === "number") return String(v);
  return null;
}

function parseEpochSeconds(v: unknown): Date | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return new Date(v * 1000);
}

function companyName(attr: Record<string, unknown>): string | null {
  // attributes.company puede venir como { data: { attributes: { name } } } o plano.
  const comp = asRecord(attr.company);
  const data = asRecord(comp?.data) ?? comp;
  const name = asString(asRecord(data?.attributes)?.name) ?? asString(data?.name);
  return name;
}

async function fetchOne(query: string): Promise<RawJob[]> {
  const url = `${BASE}?query=${encodeURIComponent(query)}&per_page=${PER_PAGE}`;
  let text: string;
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "application/json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      logWarn("job_radar.getonbrd.non_ok", { query, status: res.status });
      return [];
    }
    text = await res.text();
  } catch (err) {
    logWarn("job_radar.getonbrd.error", {
      query,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  const data = asRecord(parsed)?.data;
  if (!Array.isArray(data)) return [];

  const out: RawJob[] = [];
  for (const item of data) {
    const rec = asRecord(item);
    const attr = asRecord(rec?.attributes);
    const externalId = asString(rec?.id);
    const title = asString(attr?.title);
    if (!rec || !attr || !externalId || !title) continue;
    const url = asString(asRecord(rec.links)?.public_url) ?? `${SITE}/jobs/${externalId}`;
    const company = companyName(attr);
    const remoteModality = asString(attr.remote_modality); // remote | hybrid | no
    out.push({
      source: "getonbrd",
      company: "getonbrd",
      externalId,
      title: company ? `${title} · ${company}` : title,
      url,
      department: asString(attr.category_name),
      location: asString(attr.remote_zone),
      remote: remoteModality && remoteModality !== "no" ? remoteModality : null,
      descriptionHtml: asString(attr.description),
      publishedAt: parseEpochSeconds(attr.published_at),
      lastmod: null,
      raw: { ...attr, _company: company, _slug: externalId },
    });
  }
  return out;
}

/**
 * Busca en GetOnBoard por cada keyword del perfil y deduplica. Devuelve [] si
 * no hay keywords (la búsqueda necesita un query; listar todo es privado).
 */
export async function fetchGetonbrdJobs(queries: string[]): Promise<RawJob[]> {
  const uniqueQueries = [...new Set(queries.map((q) => q.trim().toLowerCase()).filter(Boolean))];
  if (uniqueQueries.length === 0) {
    logWarn("job_radar.getonbrd.no_keywords", {});
    return [];
  }
  const byId = new Map<string, RawJob>();
  for (const q of uniqueQueries) {
    const jobs = await fetchOne(q);
    for (const job of jobs) byId.set(job.externalId, job);
  }
  return [...byId.values()];
}
