// Adapter SAP SuccessFactors CLASSIC (career site v1, distinto del RMK/Jobs2Web).
// Feed XML público sin auth/CSRF/browser (SAP KB 2428902): el truco es
// `resultType=XML`, que evita el render JS por form-POST y devuelve XML server-side.
//
//   GET https://{host}/{career|careers}?company={CODE}
//        &career_ns=job_listing_summary&resultType=XML&selected_lang={locale}
//
// `selected_lang` es load-bearing: sin locale el feed filtra al idioma default y
// puede devolver casi nada. `identifier` = "host:path:company:locale", ej:
//   career8.successfactors.com:career:lan:es_CL        (LATAM)
//   career5.successfactors.eu:careers:Telefonica:es_ES (Telefónica/Movistar)
//   career2.successfactors.eu:careers:nestleHRprdBX:es_CL (Nestlé)

import { BROWSER_UA, requestText } from "./_shared.ts";
import type { RawJob } from "./types.ts";

export interface SfClassicEntry {
  host: string;
  path: string; // "career" | "careers"
  company: string;
  locale: string;
}

// "career8.successfactors.com:career:lan:es_CL" → entry. null si malformado.
export function parseSfClassicEntry(identifier: string): SfClassicEntry | null {
  const parts = identifier.split(":");
  if (parts.length !== 4) return null;
  const [host, path, company, locale] = parts;
  if (!host || !path || !company || !locale) return null;
  return { host, path, company, locale };
}

function cdata(block: string, tag: string): string | null {
  const m = block.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`, "i"));
  if (!m) return null;
  const v = m[1].trim();
  return v.length > 0 ? v : null;
}

// Los <filterN> son pares <label>/<value> configurables por tenant: se parsean
// por el TEXTO del label (Area/City/Country varían de posición), no por índice.
function filtersByLabel(block: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of block.matchAll(/<filter\d+>\s*<label>([\s\S]*?)<\/label>\s*<value>([\s\S]*?)<\/value>/gi)) {
    const label = m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim().toLowerCase();
    const value = m[2].replace(/<!\[CDATA\[|\]\]>/g, "").trim();
    if (label && value && !map.has(label)) map.set(label, value);
  }
  return map;
}

function pick(map: Map<string, string>, ...needles: string[]): string | null {
  for (const [label, value] of map) {
    if (needles.some((n) => label.includes(n))) return value;
  }
  return null;
}

// "05/27/2026" (MM/DD/YYYY) → Date mediodía UTC.
function parseMdy(raw: string | null): Date | null {
  if (!raw) return null;
  const m = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[3]), Number(m[1]) - 1, Number(m[2]), 12));
}

function stripHtml(html: string | null): string | null {
  if (!html) return null;
  const t = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  return t.length > 0 ? t : null;
}

/**
 * Trae las ofertas vigentes de un career-site SuccessFactors clásico vía feed XML.
 * Devuelve [] si el feed no responde. Sin paginación: el feed es un dump completo.
 */
export async function fetchSfClassicJobs(identifier: string): Promise<RawJob[]> {
  const e = parseSfClassicEntry(identifier);
  if (!e) return [];
  const url =
    `https://${e.host}/${e.path}?company=${encodeURIComponent(e.company)}` +
    `&career_ns=job_listing_summary&resultType=XML&selected_lang=${encodeURIComponent(e.locale)}`;
  const xml = await requestText(url, {
    tag: "job_radar.sfclassic",
    ctx: { host: e.host, company: e.company },
    accept: "application/xml,text/xml,*/*",
    userAgent: BROWSER_UA,
  });
  if (!xml) return [];

  const out: RawJob[] = [];
  const seen = new Set<string>();
  for (const m of xml.matchAll(/<Job>([\s\S]*?)<\/Job>/gi)) {
    const block = m[1];
    const reqId = cdata(block, "ReqId");
    const title = cdata(block, "JobTitle");
    if (!reqId || !title || seen.has(reqId)) continue;
    seen.add(reqId);
    const filters = filtersByLabel(block);
    const descHtml = cdata(block, "Job-Description");
    const city = pick(filters, "city", "ciudad");
    const country = pick(filters, "country", "país", "pais");
    const location = [city, country].filter(Boolean).join(", ") || null;
    out.push({
      source: "sfclassic",
      company: e.company,
      externalId: reqId,
      title,
      url:
        `https://${e.host}/${e.path}?company=${encodeURIComponent(e.company)}` +
        `&career_ns=job_listing&navBarLevel=JOB_SEARCH&career_job_req_id=${reqId}` +
        `&selected_lang=${encodeURIComponent(e.locale)}`,
      department: pick(filters, "functional area", "area", "área"),
      location,
      remote: descHtml && /remot|teletrabajo|h[íi]brid|hybrid/i.test(descHtml) ? "Remoto" : null,
      salary: null,
      descriptionHtml: descHtml,
      publishedAt: parseMdy(cdata(block, "Posted-Date")),
      lastmod: null,
      raw: { reqId, title, desc: stripHtml(descHtml)?.slice(0, 200) ?? null },
    });
  }
  return out;
}
