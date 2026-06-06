// Adapter Workday — CXS API pública del career site (sin auth):
//   POST https://{tenant}.{wd}.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs
//   body { appliedFacets:{}, limit, offset, searchText }
//   → { jobPostings: [{ title, externalPath, locationsText, postedOn, bulletFields }], total }
//
// Workday NO usa un slug único: requiere tenant + número wd + site. Config por
// entrada "tenant:wd:site" (ej "nvidia:wd5:NVIDIAExternalCareerSite"). Usado por
// banca/retail/corporativos (alto valor para roles riesgo/finanzas en CL).
// Consultamos por cada keyword del perfil (searchText) + dedup — big corps tienen
// miles de avisos; sin query traeríamos ruido. publishedAt queda null (postedOn es
// texto relativo "Posted Today").

import { logWarn } from "../../lib/logger.ts";
import type { RawJob } from "./types.ts";

const FETCH_TIMEOUT_MS = 15_000;
const LIMIT = 20;
const UA = "BioalergiaJobRadar/1.0 (+personal job search)";

export interface WorkdayEntry {
  tenant: string;
  wd: string; // ej "wd5"
  site: string;
}

// "tenant:wd:site" → WorkdayEntry
export function parseWorkdayEntry(raw: string): WorkdayEntry | null {
  const parts = raw.split(":").map((p) => p.trim());
  if (parts.length !== 3 || parts.some((p) => p.length === 0)) return null;
  return { tenant: parts[0], wd: parts[1], site: parts[2] };
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null;
}

function asString(v: unknown): string | null {
  if (typeof v === "string") return v.trim().length > 0 ? v.trim() : null;
  if (typeof v === "number") return String(v);
  return null;
}

async function fetchPage(entry: WorkdayEntry, searchText: string): Promise<RawJob[]> {
  const host = `https://${entry.tenant}.${entry.wd}.myworkdayjobs.com`;
  const url = `${host}/wday/cxs/${entry.tenant}/${entry.site}/jobs`;
  let text: string;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": UA, accept: "application/json" },
      body: JSON.stringify({ appliedFacets: {}, limit: LIMIT, offset: 0, searchText }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      logWarn("job_radar.workday.non_ok", {
        tenant: entry.tenant,
        site: entry.site,
        status: res.status,
      });
      return [];
    }
    text = await res.text();
  } catch (err) {
    logWarn("job_radar.workday.error", {
      tenant: entry.tenant,
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
  const postings = asRecord(parsed)?.jobPostings;
  if (!Array.isArray(postings)) return [];

  const out: RawJob[] = [];
  for (const item of postings) {
    const job = asRecord(item);
    if (!job) continue;
    const externalPath = asString(job.externalPath);
    const title = asString(job.title);
    if (!title || !externalPath) continue;
    const bullet = Array.isArray(job.bulletFields) ? asString(job.bulletFields[0]) : null;
    const externalId = bullet ?? externalPath;
    out.push({
      source: "workday",
      company: entry.tenant,
      externalId,
      title,
      url: `${host}/${entry.site}${externalPath}`,
      department: null,
      location: asString(job.locationsText),
      remote: asString(job.remoteType),
      descriptionHtml: null,
      publishedAt: null, // postedOn es texto relativo ("Posted Today")
      lastmod: null,
      raw: item,
    });
  }
  return out;
}

/**
 * Trae avisos de un career site Workday consultando por cada keyword del perfil
 * (searchText) y deduplicando. Si no hay keywords, trae la primera página sin filtro.
 */
export async function fetchWorkdayJobs(entry: WorkdayEntry, queries: string[]): Promise<RawJob[]> {
  const uniqueQueries = [...new Set(queries.map((q) => q.trim()).filter(Boolean))];
  const searches = uniqueQueries.length > 0 ? uniqueQueries : [""];
  const byId = new Map<string, RawJob>();
  for (const q of searches) {
    const jobs = await fetchPage(entry, q);
    for (const job of jobs) byId.set(job.externalId, job);
  }
  return [...byId.values()];
}
