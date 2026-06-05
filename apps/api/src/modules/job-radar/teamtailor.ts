// Adapter Teamtailor — multi-empresa. Toda career page Teamtailor expone:
//   - https://{company}.teamtailor.com/sitemap.xml  → lista COMPLETA de jobs
//     (<loc> con URL + <lastmod>). Fuente de verdad de qué jobs existen.
//   - https://{company}.teamtailor.com/jobs.json     → JSON Feed v1.1 con
//     metadata rica (title, content_html, date_published, _jobposting).
//
// Estrategia: sitemap = set autoritativo de jobs (siempre completo + lastmod);
// jobs.json = metadata cuando esté (en Tenpo trae los 20, pero no se asume:
// si un job del sitemap no aparece en el feed, title se deriva del slug).
// Todo público, sin auth, sin browser (fetch nativo).

import { logWarn } from "../../lib/logger.ts";
import type { RawJob } from "./types.ts";

const FETCH_TIMEOUT_MS = 15_000;
const UA = "BioalergiaJobRadar/1.0 (+personal job search)";

interface SitemapEntry {
  externalId: string;
  url: string;
  slug: string;
  lastmod: Date | null;
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "application/json, text/xml, */*" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      logWarn("job_radar.fetch.non_ok", { url, status: res.status });
      return null;
    }
    return await res.text();
  } catch (err) {
    logWarn("job_radar.fetch.error", {
      url,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// Extrae el id numérico del job desde una URL Teamtailor:
//   https://x.teamtailor.com/jobs/7855469-analista... → "7855469"
function parseJobUrl(url: string): { externalId: string; slug: string } | null {
  const m = url.match(/\/jobs\/(\d+)-([^/?#]+)/);
  if (!m) return null;
  return { externalId: m[1], slug: m[2] };
}

function slugToTitle(slug: string): string {
  return slug
    .split("-")
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function parseDate(raw: unknown): Date | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? null : new Date(t);
}

function parseSitemap(xml: string): SitemapEntry[] {
  const entries: SitemapEntry[] = [];
  const seen = new Set<string>();
  const urlBlocks = xml.match(/<url>[\s\S]*?<\/url>/g) ?? [];
  for (const block of urlBlocks) {
    const loc = block.match(/<loc>([^<]+)<\/loc>/)?.[1]?.trim();
    if (!loc || !loc.includes("/jobs/")) continue;
    const parsed = parseJobUrl(loc);
    if (!parsed || seen.has(parsed.externalId)) continue;
    seen.add(parsed.externalId);
    const lastmodRaw = block.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1]?.trim();
    entries.push({
      externalId: parsed.externalId,
      url: loc,
      slug: parsed.slug,
      lastmod: parseDate(lastmodRaw),
    });
  }
  return entries;
}

// ── jobs.json metadata, indexada por externalId ──────────────────────────────

interface FeedMeta {
  title: string | null;
  url: string | null;
  department: string | null;
  location: string | null;
  remote: string | null;
  descriptionHtml: string | null;
  publishedAt: Date | null;
  raw: unknown;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

// schema.org JobPosting embebido en `_jobposting` — extrae location best-effort.
// `jobLocation` puede ser un objeto o un array de Place (Teamtailor usa array).
// department/remote NO vienen en el feed (son del listing client-rendered) →
// quedan null; el filtro de perfil matchea por título de todos modos.
function extractJobPosting(jp: Record<string, unknown> | null): {
  location: string | null;
  remote: string | null;
  department: string | null;
} {
  if (!jp) return { location: null, remote: null, department: null };
  const first = Array.isArray(jp.jobLocation) ? jp.jobLocation[0] : jp.jobLocation;
  const place = asRecord(first);
  const address = place ? asRecord(place.address) : null;
  const location = address
    ? (asString(address.addressLocality) ??
      asString(address.addressRegion) ??
      asString(address.addressCountry))
    : null;
  const locType = asString(jp.jobLocationType); // "TELECOMMUTE" si remoto (algunas empresas)
  const remote = locType === "TELECOMMUTE" ? "Remoto" : null;
  return { location, remote, department: null };
}

function parseJobsJson(text: string): Map<string, FeedMeta> {
  const byId = new Map<string, FeedMeta>();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return byId;
  }
  const root = asRecord(parsed);
  const items = root?.items;
  if (!Array.isArray(items)) return byId;
  for (const item of items) {
    const rec = asRecord(item);
    if (!rec) continue;
    const url = asString(rec.url);
    const idFromUrl = url ? parseJobUrl(url)?.externalId : null;
    if (!idFromUrl) continue;
    const jp = extractJobPosting(asRecord(rec._jobposting));
    byId.set(idFromUrl, {
      title: asString(rec.title),
      url,
      department: jp.department,
      location: jp.location,
      remote: jp.remote,
      descriptionHtml: asString(rec.content_html),
      publishedAt: parseDate(rec.date_published),
      raw: item,
    });
  }
  return byId;
}

/**
 * Trae todas las ofertas vigentes de una empresa Teamtailor, normalizadas.
 * Devuelve [] si la empresa no existe o el sitemap no se pudo leer.
 */
export async function fetchTeamtailorJobs(company: string): Promise<RawJob[]> {
  const base = `https://${company}.teamtailor.com`;
  const [sitemapXml, jobsJson] = await Promise.all([
    fetchText(`${base}/sitemap.xml`),
    fetchText(`${base}/jobs.json`),
  ]);

  if (!sitemapXml) return [];
  const entries = parseSitemap(sitemapXml);
  const meta = jobsJson ? parseJobsJson(jobsJson) : new Map<string, FeedMeta>();

  return entries.map((e): RawJob => {
    const m = meta.get(e.externalId);
    return {
      source: "teamtailor",
      company,
      externalId: e.externalId,
      title: m?.title ?? slugToTitle(e.slug),
      url: m?.url ?? e.url,
      department: m?.department ?? null,
      location: m?.location ?? null,
      remote: m?.remote ?? null,
      descriptionHtml: m?.descriptionHtml ?? null,
      publishedAt: m?.publishedAt ?? null,
      lastmod: e.lastmod,
      raw: m?.raw ?? { url: e.url, slug: e.slug, lastmod: e.lastmod?.toISOString() ?? null },
    };
  });
}
