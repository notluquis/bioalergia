// Adapter Computrabajo (cl.computrabajo.com) — el agregador de empleo más grande
// de Chile. Muchas grandes empresas (Nestlé, Agrosuper, Turbus, …) NO usan un ATS
// scrapeable propio pero SÍ publican aquí. Página por empresa (DOS formatos):
//   canónico  GET https://cl.computrabajo.com/empresas/ofertas-de-trabajo-de-{slug}-{HASH16}
//   short     GET https://cl.computrabajo.com/{nombre-corto}/empleos
// Paginamos con `?p=N`. Cada oferta es un <article class="box_offer" data-id='HASH32'>
// con título/empresa/ubicación; el DETALLE de cada oferta trae un JSON-LD
// (`<script application/ld+json>` con `@graph` → nodo JobPosting) del que sacamos
// descripción completa, sueldo, industria (= department), fecha exacta y empleador
// real. Enriquecemos cada oferta visitando su detalle (concurrencia acotada) para
// que el filtro por keywords (que mira descriptionHtml) tenga el texto completo.
//
// GOTCHA: nginx responde 403 a UAs no-browser → BROWSER_UA. `?p=N` fuera de rango
// devuelve la home/lista vacía → cortamos cuando una página no trae ofertas nuevas.

import {
  asRecord,
  asString,
  BROWSER_UA,
  deriveRemoteFromText,
  parseRelativeEs,
  requestText,
  safeJsonParse,
  stripHtmlText,
} from "./_shared.ts";
import type { RawJob } from "./types.ts";

const BASE = "https://cl.computrabajo.com";
const MAX_PAGES = 20;
const DETAIL_CONCURRENCY = 5;
const OFFER_HASH = /[0-9A-F]{32}/;

function decodeText(raw: string | null): string | null {
  const stripped = stripHtmlText(raw);
  if (!stripped) return null;
  const decoded = stripped
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .trim();
  return decoded.length > 0 ? decoded : null;
}

// Computrabajo expone la bolsa de una empresa en DOS formatos de URL; soportamos
// ambos para que el dashboard pueda pegar cualquiera (path canónico o nombre corto).
function buildPageUrl(identifier: string, page: number): string | null {
  const cleaned = identifier
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/[?#].*$/, "")
    .replace(/^\/+|\/+$/g, "");
  if (cleaned.length === 0) return null;
  const pageQ = page > 1 ? `?p=${page}` : "";

  const empresasMatch = cleaned.match(/(?:^|\/)?(ofertas-de-trabajo-de-[a-z0-9-]+-[0-9A-Fa-f]{16})/i);
  if (empresasMatch?.[1]) return `${BASE}/empresas/${empresasMatch[1]}${pageQ}`;

  const shortName = cleaned.replace(/\/empleos$/i, "").replace(/\/+$/, "");
  if (shortName.includes("/")) return null;
  return `${BASE}/${shortName}/empleos${pageQ}`;
}

interface ParsedCard {
  externalId: string;
  title: string;
  href: string;
  company: string | null;
  location: string | null;
  publishedAt: Date | null;
}

function parseCards(html: string, now: number): ParsedCard[] {
  const out: ParsedCard[] = [];
  const blocks = html.split(/<article\b/i).slice(1);
  for (const blk of blocks) {
    if (!blk.includes("box_offer")) continue;
    const externalId = blk.match(/data-id=['"]([0-9A-F]{32})['"]/i)?.[1];
    if (!externalId) continue;

    const linkMatch = blk.match(
      /<a[^>]*class="[^"]*js-o-link[^"]*"[^>]*href="([^"#]+)[^"]*"[^>]*>([\s\S]*?)<\/a>/i
    );
    const href = linkMatch?.[1];
    const title = decodeText(linkMatch?.[2] ?? null);
    if (!href || !title) continue;

    const company = decodeText(blk.match(/offer-grid-article-company-url[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? null);
    const location = decodeText(blk.match(/<span[^>]*class="[^"]*mr10[^"]*"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? null);
    const publishedAt = parseRelativeEs(
      decodeText(blk.match(/<p[^>]*class="[^"]*fs13[^"]*fc_aux[^"]*"[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? null),
      now
    );

    out.push({ externalId, title, href, company, location, publishedAt });
  }
  return out;
}

// ── Detalle de oferta (JSON-LD JobPosting dentro de @graph) ───────────────────
interface JobDetail {
  title: string | null;
  descriptionHtml: string | null;
  department: string | null;
  location: string | null;
  salary: string | null;
  publishedAt: Date | null;
  employer: string | null;
  validThrough: string | null;
  employmentType: string | null;
}

function parseSalary(baseSalary: unknown): string | null {
  const root = asRecord(baseSalary);
  if (!root) return null;
  const valueNode = asRecord(root.value);
  const amount =
    typeof valueNode?.value === "number"
      ? valueNode.value
      : typeof root.value === "number"
        ? root.value
        : 0;
  if (!amount || amount <= 0) return null;
  const currency = asString(root.currency) ?? "CLP";
  const unit = asString(valueNode?.unitText);
  const period =
    unit === "MONTH" ? "/mes" : unit === "HOUR" ? "/hora" : unit === "YEAR" ? "/año" : "";
  return `${currency} ${amount.toLocaleString("es-CL")}${period}`;
}

function parseIsoDate(value: unknown): Date | null {
  const s = asString(value);
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t);
}

function extractJobPosting(html: string): JobDetail | null {
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    const parsed = safeJsonParse(m[1].trim());
    const graph = asRecord(parsed)?.["@graph"];
    const nodes = Array.isArray(graph) ? graph : [parsed];
    for (const node of nodes) {
      const rec = asRecord(node);
      if (rec?.["@type"] !== "JobPosting") continue;
      const address = asRecord(asRecord(rec.jobLocation)?.address);
      const city = asString(address?.addressLocality);
      const region = asString(address?.addressRegion);
      const location = [city, region].filter((v) => v && v.length > 0).join(", ") || null;
      return {
        title: asString(rec.title),
        descriptionHtml: asString(rec.description),
        department: asString(rec.industry),
        location,
        salary: parseSalary(rec.baseSalary),
        publishedAt: parseIsoDate(rec.datePosted),
        employer: asString(asRecord(rec.hiringOrganization)?.name),
        validThrough: asString(rec.validThrough),
        employmentType: asString(rec.employmentType),
      };
    }
  }
  return null;
}

async function enrichFromDetail(jobs: RawJob[]): Promise<void> {
  let index = 0;
  async function worker(): Promise<void> {
    while (index < jobs.length) {
      const job = jobs[index++];
      if (!job) continue;
      const html = await requestText(job.url, {
        tag: "job_radar.computrabajo.detail",
        ctx: { externalId: job.externalId },
        accept: "text/html,*/*",
        userAgent: BROWSER_UA,
      });
      if (!html) continue;
      const detail = extractJobPosting(html);
      if (!detail) continue;
      job.title = detail.title ?? job.title;
      job.descriptionHtml = detail.descriptionHtml ?? job.descriptionHtml;
      job.department = detail.department ?? job.department;
      job.location = detail.location ?? job.location;
      job.salary = detail.salary ?? job.salary;
      job.publishedAt = detail.publishedAt ?? job.publishedAt;
      job.remote = deriveRemoteFromText(detail.descriptionHtml, job.location, job.title);
      job.raw = {
        ...asRecord(job.raw),
        employer: detail.employer,
        validThrough: detail.validThrough,
        employmentType: detail.employmentType,
      };
    }
  }
  await Promise.all(Array.from({ length: Math.min(DETAIL_CONCURRENCY, jobs.length) }, worker));
}

/**
 * Trae todas las ofertas vigentes de una empresa en Computrabajo, enriquecidas
 * con la data completa del detalle (descripción, sueldo, industria, fecha). El
 * `identifier` acepta el path canónico (`ofertas-de-trabajo-de-{slug}-{hash}`) o
 * el nombre corto (`nestle`). Devuelve [] si la página no responde o no hay ofertas.
 */
export async function fetchComputrabajoJobs(identifier: string): Promise<RawJob[]> {
  const slug = identifier.replace(/[?#].*$/, "").trim();
  if (slug.length === 0) return [];

  const now = Date.now();
  const byId = new Map<string, RawJob>();
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = buildPageUrl(slug, page);
    if (!url) break;
    const html = await requestText(url, {
      tag: "job_radar.computrabajo",
      ctx: { slug, page },
      accept: "text/html,*/*",
      userAgent: BROWSER_UA,
    });
    if (!html) break;
    const cards = parseCards(html, now);
    if (cards.length === 0) break;

    let added = 0;
    for (const card of cards) {
      if (byId.has(card.externalId) || !OFFER_HASH.test(card.externalId)) continue;
      added++;
      const path = card.href.startsWith("http") ? card.href : `${BASE}${card.href}`;
      byId.set(card.externalId, {
        source: "computrabajo",
        company: slug,
        externalId: card.externalId,
        title: card.title,
        url: path,
        department: null,
        location: card.location,
        remote: null,
        salary: null,
        descriptionHtml: null,
        publishedAt: card.publishedAt,
        lastmod: null,
        raw: { company: card.company, listingLocation: card.location, href: card.href },
      });
    }
    if (added === 0) break;
  }

  const jobs = [...byId.values()];
  await enrichFromDetail(jobs);
  return jobs;
}
