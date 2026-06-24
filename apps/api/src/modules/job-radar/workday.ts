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

import { asRecord, asString, requestText, safeJsonParse } from "./_shared.ts";
import type { RawJob } from "./types.ts";

const LIMIT = 20;

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

async function fetchPage(entry: WorkdayEntry, searchText: string): Promise<RawJob[]> {
  const host = `https://${entry.tenant}.${entry.wd}.myworkdayjobs.com`;
  const url = `${host}/wday/cxs/${entry.tenant}/${entry.site}/jobs`;
  const text = await requestText(url, {
    method: "POST",
    body: JSON.stringify({ appliedFacets: {}, limit: LIMIT, offset: 0, searchText }),
    tag: "job_radar.workday",
    ctx: { tenant: entry.tenant, site: entry.site },
  });
  if (!text) return [];
  const postings = asRecord(safeJsonParse(text))?.jobPostings;
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
      salary: null,
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
