// Adapter Greenhouse — Job Board API pública (sin auth):
//   GET https://boards-api.greenhouse.io/v1/boards/{board}/jobs?content=true
//   → { jobs: [{ id, title, absolute_url, location:{name}, updated_at,
//                first_published, content (HTML entity-encoded), departments:[{name}] }] }
// `board` = token del board (slug de la empresa). content=true incluye la descripción.

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
  let text: string;
  try {
    const res = await fetch(
      `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs?content=true`,
      {
        headers: { "user-agent": UA, accept: "application/json" },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      }
    );
    if (!res.ok) {
      logWarn("job_radar.greenhouse.non_ok", { board, status: res.status });
      return [];
    }
    text = await res.text();
  } catch (err) {
    logWarn("job_radar.greenhouse.error", {
      board,
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
