// Adapter Buk (`{slug}.buk.cl`, suite HR/payroll dominante en el mid-market CL).
// El portal "trabaja con nosotros" es HTML server-rendered, sin API JSON. Cada
// card lleva el título (en `<p class="d-none">`, el nombre completo) y el link
// `/s/{token}` (token = externalId). `identifier` = slug del subdominio (ej hites).

import {
  asRecord,
  asString,
  BROWSER_UA,
  deriveLocationFromText,
  deriveRemoteFromText,
  requestText,
  safeJsonParse,
} from "./_shared.ts";
import type { RawJob } from "./types.ts";

const MAX_PAGES = 20;
const DETAIL_CONCURRENCY = 4;

function clean(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCards(html: string, slug: string): RawJob[] {
  const out: RawJob[] = [];
  // Card = bloque `jobs__card` … con su link `/s/{token}`.
  for (const m of html.matchAll(/jobs__card[\s\S]*?\/s\/([A-Za-z0-9]{6,})/g)) {
    const token = m[1];
    const block = m[0];
    // Título completo en <p class="d-none">…</p>; fallback al <b> visible.
    const full = block.match(/class="d-none"[^>]*>([\s\S]*?)<\/p>/i);
    const bold = block.match(/<b[^>]*>([\s\S]*?)<\/b>/i);
    const locationText = block.match(/jobs__card-info[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i);
    const title = clean(full?.[1] ?? bold?.[1] ?? "");
    const location = clean(locationText?.[1] ?? "");
    if (!title) continue;
    out.push({
      source: "buk",
      company: slug,
      externalId: token,
      title,
      url: `https://${slug}.buk.cl/s/${token}`,
      department: bold ? clean(bold[1]) : null,
      location: location || deriveLocationFromText(title),
      remote: deriveRemoteFromText(title, block),
      salary: null,
      descriptionHtml: null,
      publishedAt: null,
      lastmod: null,
      raw: { token, title, location: location || null },
    });
  }
  return out;
}

function parseBukDate(raw: string | null): Date | null {
  if (!raw) return null;
  const normalized = raw.replace(
    /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2})(\d{2})$/,
    "$1T$2$3:$4"
  );
  const time = Date.parse(normalized);
  return Number.isNaN(time) ? null : new Date(time);
}

function extractJsonLdJobPosting(html: string): Record<string, unknown> | null {
  for (const match of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )) {
    const parsed = safeJsonParse(match[1]?.trim() ?? "");
    const records = Array.isArray(parsed) ? parsed : [parsed];
    for (const value of records) {
      const record = asRecord(value);
      if (record?.["@type"] === "JobPosting") return record;
    }
  }
  return null;
}

function locationFromJsonLd(jobPosting: Record<string, unknown> | null): string | null {
  const address = asRecord(asRecord(jobPosting?.jobLocation)?.address);
  const locality = asString(address?.addressLocality);
  const region = asString(address?.addressRegion);
  if (!locality && !region) return null;
  const parts = [locality, region, asString(address?.addressCountry)].filter(
    (part): part is string => Boolean(part)
  );
  return parts.length > 0 ? [...new Set(parts)].join(", ") : null;
}

function applyDetail(job: RawJob, html: string): RawJob {
  const jobPosting = extractJsonLdJobPosting(html);
  if (!jobPosting) return job;

  const detailTitle = asString(jobPosting.title);
  const description = asString(jobPosting.description);
  const location = locationFromJsonLd(jobPosting);
  const datePosted = parseBukDate(asString(jobPosting.datePosted));

  return {
    ...job,
    title: detailTitle ?? job.title,
    location: job.location ?? location,
    descriptionHtml: description ?? job.descriptionHtml,
    publishedAt: datePosted ?? job.publishedAt,
    lastmod: datePosted ?? job.lastmod,
    raw: {
      ...(asRecord(job.raw) ?? {}),
      detail: jobPosting,
    },
  };
}

async function enrichDetails(jobs: RawJob[]): Promise<RawJob[]> {
  const out = [...jobs];
  let cursor = 0;

  async function worker() {
    while (cursor < out.length) {
      const index = cursor++;
      const job = out[index];
      if (!job) continue;
      const html = await requestText(job.url, {
        tag: "job_radar.buk.detail",
        ctx: { company: job.company, externalId: job.externalId },
        accept: "text/html,*/*",
        userAgent: BROWSER_UA,
      });
      if (html) out[index] = applyDetail(job, html);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(DETAIL_CONCURRENCY, out.length) }, async () => worker())
  );
  return out;
}

/**
 * Trae las ofertas vigentes de un portal Buk. `identifier` = slug del subdominio.
 * Devuelve [] si no hay portal/ofertas.
 */
export async function fetchBukJobs(identifier: string): Promise<RawJob[]> {
  const slug = identifier.trim().toLowerCase();
  const out: RawJob[] = [];
  const seen = new Set<string>();
  for (let page = 1; page <= MAX_PAGES; page++) {
    const html = await requestText(`https://${slug}.buk.cl/trabaja-con-nosotros?page=${page}`, {
      tag: "job_radar.buk",
      ctx: { slug, page },
      accept: "text/html,*/*",
      userAgent: BROWSER_UA,
    });
    if (!html) break;
    const cards = parseCards(html, slug);
    let added = 0;
    for (const j of cards) {
      if (seen.has(j.externalId)) continue;
      seen.add(j.externalId);
      out.push(j);
      added++;
    }
    if (added === 0) break; // sin tokens nuevos → última página
  }
  return enrichDetails(out);
}
