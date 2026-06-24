// Adapter "Minisite" — producto white-label CL (Rails + ElasticSearch) que
// varias empresas montan en su PROPIO dominio (ej SQM = trabajaensqm.com). La
// búsqueda es un proxy ES PÚBLICO (sin token):
//   POST https://{host}/app/minisite/site/_search
//     body {"size":50,"from":N,"sort":[{"created_at":"desc"}]}
//   → { hits: { total, hits:[{ _source:{ id, title, description, position, city,
//        company_contract_type, recruitment_type, created_at, desactivate_at,
//        company_location, seo_path } }] } }
// `identifier` = host completo (ej "trabajaensqm.com"). Traemos TODO (sin query)
// — el usuario filtra después. Paginamos con `from` hasta cubrir `hits.total`.

import { asRecord, asString, requestText, safeJsonParse } from "./_shared.ts";
import type { RawJob } from "./types.ts";

const PAGE = 50;
const MAX_PAGES = 40;

function parseIsoDate(value: unknown): Date | null {
  const s = asString(value);
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t);
}

/**
 * Trae todas las ofertas vigentes de un minisite (host propio). Devuelve [] si
 * el host no responde o no expone el proxy ES.
 */
export async function fetchMinisiteJobs(identifier: string): Promise<RawJob[]> {
  const host = identifier
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
  if (host.length === 0) return [];

  const byId = new Map<string, RawJob>();
  let total = Infinity;
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE;
    if (from >= total) break;
    const text = await requestText(`https://${host}/app/minisite/site/_search`, {
      method: "POST",
      body: JSON.stringify({ size: PAGE, from, sort: [{ created_at: "desc" }] }),
      tag: "job_radar.minisite",
      ctx: { host, from },
      accept: "application/json, text/plain, */*",
    });
    if (!text) break;
    const hits = asRecord(asRecord(safeJsonParse(text))?.hits);
    const list = hits?.hits;
    const totalRaw = hits?.total;
    if (typeof totalRaw === "number") total = totalRaw;
    else if (asRecord(totalRaw)?.value != null) total = Number(asRecord(totalRaw)?.value);
    if (!Array.isArray(list) || list.length === 0) break;

    let added = 0;
    for (const hit of list) {
      const src = asRecord(asRecord(hit)?._source);
      if (!src) continue;
      const externalId = src.id != null ? String(src.id) : asString(asRecord(hit)?._id);
      const title = asString(src.title);
      if (!externalId || !title || byId.has(externalId)) continue;
      added++;
      const seoPath = asString(src.seo_path);
      byId.set(externalId, {
        source: "minisite",
        company: host,
        externalId,
        title,
        url: seoPath ? `https://${host}/${seoPath}` : `https://${host}/#ofertas-laborales`,
        department: asString(src.position),
        location: asString(src.city) ?? asString(src.company_location),
        remote: null,
        salary: null,
        descriptionHtml: asString(src.description),
        publishedAt: parseIsoDate(src.created_at),
        lastmod: null,
        raw: {
          contractType: asString(src.company_contract_type),
          recruitmentType: asString(src.recruitment_type),
          deactivateAt: asString(src.desactivate_at),
        },
      });
    }
    if (added === 0) break;
  }
  return [...byId.values()];
}
