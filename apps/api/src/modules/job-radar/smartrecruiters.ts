// Adapter SmartRecruiters — Posting API pública (sin auth):
//   GET https://api.smartrecruiters.com/v1/companies/{companyId}/postings?limit=100
//   → { content: [{ id, name, refNumber, releasedDate, location:{city,country,
//        fullLocation,remote,hybrid}, department:{label}, function:{label} }], totalFound }
// `companyId` = identificador exacto de la empresa (case-sensitive, ej "Sodexo").
// Usado por corporativos. La descripción no viene en el listado (requiere detalle)
// → queda null; el filtro de perfil usa título/área.

import { logWarn } from "../../lib/logger.ts";
import type { RawJob } from "./types.ts";

const FETCH_TIMEOUT_MS = 15_000;
const LIMIT = 100;
const UA = "BioalergiaJobRadar/1.0 (+personal job search)";

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null;
}

function asString(v: unknown): string | null {
  if (typeof v === "string") return v.trim().length > 0 ? v.trim() : null;
  if (typeof v === "number") return String(v);
  return null;
}

function parseDate(raw: unknown): Date | null {
  const s = asString(raw);
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t);
}

export async function fetchSmartRecruitersJobs(company: string): Promise<RawJob[]> {
  let text: string;
  try {
    const res = await fetch(
      `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(company)}/postings?limit=${LIMIT}`,
      {
        headers: { "user-agent": UA, accept: "application/json" },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      }
    );
    if (!res.ok) {
      logWarn("job_radar.smartrecruiters.non_ok", { company, status: res.status });
      return [];
    }
    text = await res.text();
  } catch (err) {
    logWarn("job_radar.smartrecruiters.error", {
      company,
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
  const content = asRecord(parsed)?.content;
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
      descriptionHtml: null,
      publishedAt: parseDate(job.releasedDate),
      lastmod: null,
      raw: item,
    });
  }
  return out;
}
