// Adapter Eightfold AI (PCSX) — careers de grandes corps LATAM. MercadoLibre /
// MercadoPago lo usan (`mercadolibre.eightfold.ai`). API PÚBLICA headless (NO
// cookie/CSRF — el 403 inicial era por pegarle al endpoint equivocado):
//   búsqueda: GET https://{tenant}.eightfold.ai/api/pcsx/search
//       ?domain={domain}&query=&location={loc}&start={N}&sort_by=distance&filter_include_remote=1
//     → { data: { positions:[{id,name,locations[],standardizedLocations[],postedTs(epoch s),
//          department,workLocationOption,atsJobId,positionUrl}], count } }  (10 por página, paginar `start`)
//   detalle: GET /api/pcsx/position_details?position_id={id}&domain={domain}&hl=es&queried_location={loc}
//     → { data: { jobDescription(HTML), location, ... } }
//
// `identifier` = "tenant:domain:location" (location opcional; vacío = todas las
// sedes). Ej MercadoLibre = "mercadolibre:mercadolibre.com:chile". Traemos TODO
// (query vacío, solo filtro location) — el filtrado por keyword es del usuario.

import { asRecord, asString, requestText, safeJsonParse } from "./_shared.ts";
import type { RawJob } from "./types.ts";

const PAGE = 10;
const MAX_PAGES = 60;
const DETAIL_CONCURRENCY = 5;

interface EightfoldRef {
  tenant: string;
  domain: string;
  location: string;
}

export function parseEightfoldIdentifier(identifier: string): EightfoldRef | null {
  const parts = identifier
    .trim()
    .split(":")
    .map((p) => p.trim());
  const tenant = parts[0];
  if (!tenant) return null;
  const domain = parts[1] && parts[1].length > 0 ? parts[1] : `${tenant}.com`;
  const location = parts[2] ?? "";
  return { tenant, domain, location };
}

function epochSecondsToDate(value: unknown): Date | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return new Date(value * 1000);
}

function firstString(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const v of value) {
      const s = asString(v);
      if (s) return s;
    }
    return null;
  }
  return asString(value);
}

async function enrichDescriptions(jobs: RawJob[], ref: EightfoldRef, base: string): Promise<void> {
  let index = 0;
  async function worker(): Promise<void> {
    while (index < jobs.length) {
      const job = jobs[index++];
      if (!job) continue;
      const url =
        `${base}/api/pcsx/position_details?position_id=${encodeURIComponent(job.externalId)}` +
        `&domain=${encodeURIComponent(ref.domain)}&hl=es` +
        (ref.location ? `&queried_location=${encodeURIComponent(ref.location)}` : "");
      const text = await requestText(url, {
        tag: "job_radar.eightfold.detail",
        ctx: { tenant: ref.tenant, id: job.externalId },
        accept: "application/json",
      });
      if (!text) continue;
      const data = asRecord(asRecord(safeJsonParse(text))?.data);
      if (!data) continue;
      job.descriptionHtml = asString(data.jobDescription) ?? job.descriptionHtml;
      job.location = asString(data.location) ?? job.location;
    }
  }
  await Promise.all(Array.from({ length: Math.min(DETAIL_CONCURRENCY, jobs.length) }, worker));
}

/**
 * Trae TODAS las posiciones de un tenant Eightfold para una location (sin filtro
 * de keyword — el usuario filtra después), enriquecidas con la descripción del
 * detalle. `identifier` = "tenant:domain:location".
 */
export async function fetchEightfoldJobs(identifier: string): Promise<RawJob[]> {
  const ref = parseEightfoldIdentifier(identifier);
  if (!ref) return [];
  const base = `https://${ref.tenant}.eightfold.ai`;
  const byId = new Map<string, RawJob>();
  let total = Infinity;

  for (let page = 0; page < MAX_PAGES; page++) {
    const start = page * PAGE;
    if (start >= total) break;
    const url =
      `${base}/api/pcsx/search?domain=${encodeURIComponent(ref.domain)}&query=` +
      `&location=${encodeURIComponent(ref.location)}&start=${start}` +
      `&sort_by=distance&filter_include_remote=1`;
    const text = await requestText(url, {
      tag: "job_radar.eightfold",
      ctx: { tenant: ref.tenant, start },
      accept: "application/json",
      headers: { referer: `${base}/careers` },
    });
    if (!text) break;
    const data = asRecord(asRecord(safeJsonParse(text))?.data);
    const positions = data?.positions;
    if (typeof data?.count === "number") total = data.count;
    if (!Array.isArray(positions) || positions.length === 0) break;

    let added = 0;
    for (const item of positions) {
      const p = asRecord(item);
      const externalId = p?.id != null ? String(p.id) : null;
      const title = asString(p?.name);
      if (!externalId || !title || byId.has(externalId)) continue;
      added++;
      const workOption = asString(p?.workLocationOption);
      const positionUrl = asString(p?.positionUrl);
      byId.set(externalId, {
        source: "eightfold",
        company: ref.tenant,
        externalId,
        title,
        url: positionUrl
          ? positionUrl.startsWith("http")
            ? positionUrl
            : `${base}${positionUrl}`
          : `${base}/careers/job/${externalId}`,
        department: asString(p?.department),
        location: firstString(p?.locations) ?? firstString(p?.standardizedLocations),
        remote: workOption && workOption !== "onsite" ? workOption : null,
        salary: null,
        descriptionHtml: null,
        publishedAt: epochSecondsToDate(p?.postedTs),
        lastmod: null,
        raw: { displayJobId: asString(p?.displayJobId), atsJobId: asString(p?.atsJobId) },
      });
    }
    if (added === 0) break;
  }

  const jobs = [...byId.values()];
  await enrichDescriptions(jobs, ref, base);
  return jobs;
}
