// Adapter Computrabajo (cl.computrabajo.com) — el agregador de empleo más grande
// de Chile. Muchas grandes empresas (SQM, Agrosuper, Collahuasi, Derco, …) NO
// usan un ATS scrapeable propio pero SÍ publican aquí. Página por empresa:
//   GET https://cl.computrabajo.com/empresas/{identifier}?p=N   (HTML, sin token)
// `identifier` = el segmento slug+hash de la URL de la empresa, ej
//   "ofertas-de-trabajo-de-agrosuper-sa-ADDC0B1F7D4B1150".
//
// Cada oferta es un <article class="box_offer" data-id='HASH32'> con:
//   - <a class="js-o-link" href="/ofertas-de-trabajo/…-HASH#lc=…">Título</a>
//   - <a … offer-grid-article-company-url>Empresa</a>
//   - <p class="fs16 fc_base …"><span>Comuna, Región</span></p>   (ubicación)
//   - <p class="fs13 fc_aux …">Hace N días</p>                     (publicación)
// externalId = data-id (estable por oferta). Paginamos con `?p=N` hasta que una
// página no traiga ofertas nuevas. nginx responde 403 a UAs no-browser → BROWSER_UA.
//
// GOTCHA: el host antepone `www.` a veces vía redirect; requestText sigue 30x.

import { BROWSER_UA, parseRelativeEs, requestText, stripHtmlText } from "./_shared.ts";
import type { RawJob } from "./types.ts";

const BASE = "https://cl.computrabajo.com";
const MAX_PAGES = 20;
const OFFER_HASH = /[0-9A-F]{32}/;

function decodeText(raw: string | null): string | null {
  // stripHtmlText quita tags + colapsa espacios; aquí además resolvemos las
  // entidades hex/decimal que Computrabajo emite (ej "d&#xED;as", "&amp;").
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
  // Cada bloque arranca en `box_offer`; cortamos hasta el próximo article o fin.
  const blocks = html.split(/<article\b/i).slice(1);
  for (const blk of blocks) {
    if (!blk.includes("box_offer")) continue;
    const idMatch = blk.match(/data-id=['"]([0-9A-F]{32})['"]/i);
    const externalId = idMatch?.[1];
    if (!externalId) continue;

    const linkMatch = blk.match(/<a[^>]*class="[^"]*js-o-link[^"]*"[^>]*href="([^"#]+)[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
    const href = linkMatch?.[1];
    const title = decodeText(linkMatch?.[2] ?? null);
    if (!href || !title) continue;

    const companyMatch = blk.match(/offer-grid-article-company-url[^>]*>([\s\S]*?)<\/a>/i);
    const company = decodeText(companyMatch?.[1] ?? null);

    // Ubicación = <span class="mr10"> dentro del <p> de ubicación. Apuntamos al
    // span directo para no chocar con el <p> de empresa (mismas clases fs16 fc_base).
    const locMatch = blk.match(/<span[^>]*class="[^"]*mr10[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    const location = decodeText(locMatch?.[1] ?? null);

    const dateMatch = blk.match(/<p[^>]*class="[^"]*fs13[^"]*fc_aux[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
    const publishedAt = parseRelativeEs(decodeText(dateMatch?.[1] ?? null), now);

    out.push({ externalId, title, href, company, location, publishedAt });
  }
  return out;
}

// Computrabajo expone la bolsa de una empresa en DOS formatos de URL; soportamos
// ambos para que el dashboard pueda pegar cualquiera:
//   1. canónico  /empresas/ofertas-de-trabajo-de-{slug}-{HASH16}
//   2. short     /{nombre-corto}/empleos        (ej "bancochile", "nestle")
// `identifier` = el path completo o solo el segmento. Detectamos la forma por el
// prefijo "ofertas-de-trabajo-de-" / hash de 16 hex.
function buildPageUrl(identifier: string, page: number): string | null {
  const cleaned = identifier
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/[?#].*$/, "")
    .replace(/^\/+|\/+$/g, "");
  if (cleaned.length === 0) return null;
  const pageQ = page > 1 ? `?p=${page}` : "";

  // Forma canónica: "empresas/ofertas-de-trabajo-de-…" o solo "ofertas-de-trabajo-de-…".
  const empresasMatch = cleaned.match(/(?:^|\/)?(ofertas-de-trabajo-de-[a-z0-9-]+-[0-9A-Fa-f]{16})/i);
  if (empresasMatch?.[1]) return `${BASE}/empresas/${empresasMatch[1]}${pageQ}`;

  // Forma short: nombre corto (con o sin "/empleos" final).
  const shortName = cleaned.replace(/\/empleos$/i, "").replace(/\/+$/, "");
  if (shortName.includes("/")) return null; // identifier inesperado
  return `${BASE}/${shortName}/empleos${pageQ}`;
}

/**
 * Trae todas las ofertas vigentes de una empresa en Computrabajo. `identifier`
 * acepta el path canónico (`ofertas-de-trabajo-de-{slug}-{hash}`) o el nombre
 * corto (`bancochile`). Devuelve [] si la página no responde o no tiene ofertas.
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
      if (byId.has(card.externalId)) continue;
      if (!OFFER_HASH.test(card.externalId)) continue;
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
        raw: { company: card.company, location: card.location, href: card.href },
      });
    }
    // Página sin ofertas nuevas (tenant que ignora ?p o última página) → cortar.
    if (added === 0) break;
  }
  return [...byId.values()];
}
