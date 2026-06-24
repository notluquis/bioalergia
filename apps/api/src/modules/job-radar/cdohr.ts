// Adapter CDOHR / Albatros — ATS chileno (Consultora CDO HR). Cada cliente tiene
// un landing público server-rendered:
//   GET https://atsclientes.cdohr.cl/landing/page/{slug}   → links a cada oferta
//       `https://albatros.cdohr.cl/oferta-laboral/{id}`
//   GET https://albatros.cdohr.cl/oferta-laboral/{id}      → detalle con JSON-LD
//       JobPosting (title, description, jobLocation, datePosted, validThrough,
//       employmentType, hiringOrganization).
// `identifier` = slug del landing (ej "enami"). Traemos TODO (sin filtro keyword)
// y enriquecemos cada oferta desde su JSON-LD. Concurrencia acotada en el detalle.

import { asRecord, asString, BROWSER_UA, requestText, safeJsonParse } from "./_shared.ts";
import type { RawJob } from "./types.ts";

const LANDING = "https://atsclientes.cdohr.cl/landing/page";
const DETAIL_CONCURRENCY = 5;
const OFFER_RE = /https:\/\/albatros\.cdohr\.cl\/oferta-laboral\/([A-Za-z0-9]+)/g;

function parseDate(value: unknown): Date | null {
  const s = asString(value);
  if (!s) return null;
  const t = Date.parse(s.replace(" ", "T"));
  return Number.isNaN(t) ? null : new Date(t);
}

function extractJobPosting(html: string): Record<string, unknown> | null {
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    const parsed = safeJsonParse(m[1].trim());
    const graph = asRecord(parsed)?.["@graph"];
    const nodes = Array.isArray(graph) ? graph : [parsed];
    for (const node of nodes) {
      const rec = asRecord(node);
      if (rec?.["@type"] === "JobPosting") return rec;
    }
  }
  return null;
}

/**
 * Trae todas las ofertas vigentes de un cliente CDOHR. `identifier` = slug del
 * landing (ej "enami"). Devuelve [] si el landing no responde.
 */
export async function fetchCdohrJobs(identifier: string): Promise<RawJob[]> {
  const slug = identifier.trim().replace(/^.*\/landing\/page\//, "").replace(/\/+$/, "");
  if (slug.length === 0) return [];

  const landing = await requestText(`${LANDING}/${slug}`, {
    tag: "job_radar.cdohr.landing",
    ctx: { slug },
    accept: "text/html,*/*",
    userAgent: BROWSER_UA,
  });
  if (!landing) return [];

  const ids = [...new Set([...landing.matchAll(OFFER_RE)].map((m) => m[1]).filter(Boolean))];
  if (ids.length === 0) return [];

  const jobs: RawJob[] = ids.map((id) => ({
    source: "cdohr",
    company: slug,
    externalId: String(id),
    title: String(id),
    url: `https://albatros.cdohr.cl/oferta-laboral/${id}`,
    department: null,
    location: null,
    remote: null,
    salary: null,
    descriptionHtml: null,
    publishedAt: null,
    lastmod: null,
    raw: {},
  }));

  let index = 0;
  async function worker(): Promise<void> {
    while (index < jobs.length) {
      const job = jobs[index++];
      if (!job) continue;
      const html = await requestText(job.url, {
        tag: "job_radar.cdohr.detail",
        ctx: { id: job.externalId },
        accept: "text/html,*/*",
        userAgent: BROWSER_UA,
      });
      if (!html) continue;
      const jp = extractJobPosting(html);
      if (!jp) continue;
      const address = asRecord(asRecord(jp.jobLocation)?.address);
      const city = asString(address?.addressLocality);
      const region = asString(address?.addressRegion);
      job.title = asString(jp.title) ?? job.title;
      job.descriptionHtml = asString(jp.description) ?? job.descriptionHtml;
      job.location = [city, region].filter((v) => v && v.length > 0).join(", ") || job.location;
      job.publishedAt = parseDate(jp.datePosted) ?? job.publishedAt;
      job.raw = {
        employer: asString(asRecord(jp.hiringOrganization)?.name),
        validThrough: asString(jp.validThrough),
        employmentType: asString(jp.employmentType),
      };
    }
  }
  await Promise.all(Array.from({ length: Math.min(DETAIL_CONCURRENCY, jobs.length) }, worker));

  // Descartar ofertas cuyo detalle nunca cargó (sin título real) para no inyectar ruido.
  return jobs.filter((j) => j.title !== j.externalId);
}
