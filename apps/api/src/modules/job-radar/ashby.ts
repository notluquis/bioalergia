// Adapter Ashby — Posting API pública (sin auth):
//   GET https://api.ashbyhq.com/posting-api/job-board/{org}?includeCompensation=true
//   → { jobs: [{ id, title, department, team, location, isRemote, workplaceType,
//        jobUrl, descriptionHtml, descriptionPlain, publishedAt (ISO) }] }
// `org` = slug del job board Ashby. Usado por startups LATAM (toku = Chile, belvo, etc).

import { logWarn } from "../../lib/logger.ts";
import type { RawJob } from "./types.ts";

const FETCH_TIMEOUT_MS = 15_000;
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

export async function fetchAshbyJobs(org: string): Promise<RawJob[]> {
  let text: string;
  try {
    const res = await fetch(
      `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(org)}?includeCompensation=true`,
      {
        headers: { "user-agent": UA, accept: "application/json" },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      }
    );
    if (!res.ok) {
      logWarn("job_radar.ashby.non_ok", { org, status: res.status });
      return [];
    }
    text = await res.text();
  } catch (err) {
    logWarn("job_radar.ashby.error", {
      org,
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
  const jobs = asRecord(parsed)?.jobs;
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
