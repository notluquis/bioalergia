// Adapter Greenhouse — Job Board API pública (sin auth):
//   GET https://boards-api.greenhouse.io/v1/boards/{board}/jobs?content=true
//   → { jobs: [{ id, title, absolute_url, location:{name}, updated_at,
//                first_published, content (HTML entity-encoded), departments:[{name}] }] }
// `board` = token del board (slug de la empresa). content=true incluye la descripción.

import { asRecord, asString, requestText, safeJsonParse } from "./_shared.ts";
import type { RawJob } from "./types.ts";

function parseDate(raw: unknown): Date | null {
  const s = asString(raw);
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t);
}

function firstDepartment(job: Record<string, unknown>): string | null {
  const deps = job.departments;
  if (!Array.isArray(deps)) return null;
  for (const d of deps) {
    const name = asString(asRecord(d)?.name);
    if (name && name.toLowerCase() !== "no department") return name;
  }
  return null;
}

export async function fetchGreenhouseJobs(board: string): Promise<RawJob[]> {
  const text = await requestText(
    `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs?content=true`,
    { tag: "job_radar.greenhouse", ctx: { board } }
  );
  if (!text) return [];
  const jobs = asRecord(safeJsonParse(text))?.jobs;
  if (!Array.isArray(jobs)) return [];

  const out: RawJob[] = [];
  for (const item of jobs) {
    const job = asRecord(item);
    if (!job) continue;
    const externalId = asString(job.id);
    const title = asString(job.title);
    const url = asString(job.absolute_url);
    if (!externalId || !title || !url) continue;
    out.push({
      source: "greenhouse",
      company: board,
      externalId,
      title,
      url,
      department: firstDepartment(job),
      location: asString(asRecord(job.location)?.name),
      remote: null,
      descriptionHtml: asString(job.content),
      publishedAt: parseDate(job.first_published) ?? parseDate(job.updated_at),
      lastmod: parseDate(job.updated_at),
      raw: item,
    });
  }
  return out;
}
