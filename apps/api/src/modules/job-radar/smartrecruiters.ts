// Adapter SmartRecruiters — Posting API pública (sin auth):
//   GET https://api.smartrecruiters.com/v1/companies/{companyId}/postings?limit=100
//   → { content: [{ id, name, refNumber, releasedDate, location:{city,country,
//        fullLocation,remote,hybrid}, department:{label}, function:{label} }], totalFound }
// `companyId` = identificador exacto de la empresa (case-sensitive, ej "Sodexo").
// Usado por corporativos. La descripción no viene en el listado (requiere detalle)
// → queda null; el filtro de perfil usa título/área.

import { asRecord, asString, requestText, safeJsonParse } from "./_shared.ts";
import type { RawJob } from "./types.ts";

const LIMIT = 100;

function parseDate(raw: unknown): Date | null {
  const s = asString(raw);
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t);
}

export async function fetchSmartRecruitersJobs(company: string): Promise<RawJob[]> {
  const text = await requestText(
    `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(company)}/postings?limit=${LIMIT}`,
    { tag: "job_radar.smartrecruiters", ctx: { company } }
  );
  if (!text) return [];
  const content = asRecord(safeJsonParse(text))?.content;
  if (!Array.isArray(content)) return [];

  const out: RawJob[] = [];
  for (const item of content) {
    const job = asRecord(item);
    if (!job) continue;
    const externalId = asString(job.id);
    const title = asString(job.name);
    if (!externalId || !title) continue;
    const loc = asRecord(job.location);
    const location = loc
      ? (asString(loc.fullLocation) ?? asString(loc.city) ?? asString(loc.country))
      : null;
    const remote = loc?.remote === true ? "Remoto" : loc?.hybrid === true ? "Híbrido" : null;
    const department =
      asString(asRecord(job.department)?.label) ?? asString(asRecord(job.function)?.label);
    out.push({
      source: "smartrecruiters",
      company,
      externalId,
      title,
      url: `https://jobs.smartrecruiters.com/${encodeURIComponent(company)}/${externalId}`,
      department,
      location,
      remote,
      salary: null,
      descriptionHtml: null,
      publishedAt: parseDate(job.releasedDate),
      lastmod: null,
      raw: item,
    });
  }
  return out;
}
