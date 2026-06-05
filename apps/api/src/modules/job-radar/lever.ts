// Adapter Lever — Postings API pública (sin auth):
//   GET https://api.lever.co/v0/postings/{company}?mode=json
//   → [{ id, text, hostedUrl, categories:{location,team,commitment}, workplaceType,
//        description (HTML), descriptionPlain, createdAt (epoch ms) }]
// `company` = slug del board Lever.

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

function parseEpoch(v: unknown): Date | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return new Date(v);
}

export async function fetchLeverJobs(company: string): Promise<RawJob[]> {
  let text: string;
  try {
    const res = await fetch(
      `https://api.lever.co/v0/postings/${encodeURIComponent(company)}?mode=json`,
      {
        headers: { "user-agent": UA, accept: "application/json" },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      }
    );
    if (!res.ok) {
      logWarn("job_radar.lever.non_ok", { company, status: res.status });
      return [];
    }
    text = await res.text();
  } catch (err) {
    logWarn("job_radar.lever.error", {
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
  if (!Array.isArray(parsed)) return [];

  const out: RawJob[] = [];
  for (const item of parsed) {
    const p = asRecord(item);
    if (!p) continue;
    const externalId = asString(p.id);
    const title = asString(p.text);
    const url = asString(p.hostedUrl);
    if (!externalId || !title || !url) continue;
    const cats = asRecord(p.categories);
    out.push({
      source: "lever",
      company,
      externalId,
      title,
      url,
      department: asString(cats?.team),
      location: asString(cats?.location),
      remote: asString(p.workplaceType),
      descriptionHtml: asString(p.description) ?? asString(p.descriptionPlain),
      publishedAt: parseEpoch(p.createdAt),
      lastmod: null,
      raw: item,
    });
  }
  return out;
}
