// Adapter Ashby — Posting API pública (sin auth):
//   GET https://api.ashbyhq.com/posting-api/job-board/{org}?includeCompensation=true
//   → { jobs: [{ id, title, department, team, location, isRemote, workplaceType,
//        jobUrl, descriptionHtml, descriptionPlain, publishedAt (ISO) }] }
// `org` = slug del job board Ashby. Usado por startups LATAM (toku = Chile, belvo, etc).

import { asRecord, asString, requestText, safeJsonParse } from "./_shared.ts";
import type { RawJob } from "./types.ts";

function parseDate(raw: unknown): Date | null {
  const s = asString(raw);
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t);
}

export async function fetchAshbyJobs(org: string): Promise<RawJob[]> {
  const text = await requestText(
    `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(org)}?includeCompensation=true`,
    { tag: "job_radar.ashby", ctx: { org } }
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
    const url = asString(job.jobUrl);
    if (!externalId || !title || !url) continue;
    const workplace = asString(job.workplaceType);
    out.push({
      source: "ashby",
      company: org,
      externalId,
      title,
      url,
      department: asString(job.department) ?? asString(job.team),
      location: asString(job.location),
      remote: job.isRemote === true ? (workplace ?? "Remote") : workplace,
      descriptionHtml: asString(job.descriptionHtml),
      publishedAt: parseDate(job.publishedAt),
      lastmod: null,
      raw: item,
    });
  }
  return out;
}
