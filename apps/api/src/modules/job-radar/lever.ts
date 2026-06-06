// Adapter Lever — Postings API pública (sin auth):
//   GET https://api.lever.co/v0/postings/{company}?mode=json
//   → [{ id, text, hostedUrl, categories:{location,team,commitment}, workplaceType,
//        description (HTML), descriptionPlain, createdAt (epoch ms) }]
// `company` = slug del board Lever.

import { asRecord, asString, requestText, safeJsonParse } from "./_shared.ts";
import type { RawJob } from "./types.ts";

function parseEpoch(v: unknown): Date | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return new Date(v);
}

export async function fetchLeverJobs(company: string): Promise<RawJob[]> {
  const text = await requestText(
    `https://api.lever.co/v0/postings/${encodeURIComponent(company)}?mode=json`,
    { tag: "job_radar.lever", ctx: { company } }
  );
  if (!text) return [];
  const parsed = safeJsonParse(text);
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
