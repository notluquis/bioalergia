// Adapter Hirefront / HCMFront (`{slug}.myfront.cl`, ATS chileno, sector público
// y mid-market). Portal HTML server-rendered, sin API JSON. La home ES el listado
// (`/?page=N`). Cada oferta = link `/oferta-de-empleo/{id}/{slug}/` con el título
// en un <h3>. `identifier` = slug del subdominio (ej junji).

import { BROWSER_UA, deriveLocationFromText, parseRelativeEs, requestText } from "./_shared.ts";
import type { RawJob } from "./types.ts";

const MAX_PAGES = 30;

function clean(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCards(html: string, slug: string): RawJob[] {
  const out: RawJob[] = [];
  const seen = new Set<string>();
  // El <a> envuelve la card: href a la oferta + un <h3> con el título adentro.
  for (const m of html.matchAll(
    /<a[^>]+href="[^"]*\/oferta-de-empleo\/(\d+)\/([a-z0-9-]+)\/"[^>]*>([\s\S]*?)<\/a>/gi
  )) {
    const id = m[1];
    const titleSlug = m[2];
    if (seen.has(id)) continue;
    seen.add(id);
    const h3 = m[3].match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    if (!h3) continue;
    // Título = h3 sin los <small> (ubicación + fecha relativa).
    const title = clean(h3[1].replace(/<small[\s\S]*?<\/small>/gi, ""));
    if (!title) continue;
    // "Publicado hace X días" (relativo) → fecha aprox. Jornada de la card.
    const publishedAt = parseRelativeEs(m[3].match(/Publicado\s+hace[^<]*/i)?.[0] ?? null);
    const jornada = clean(m[3].match(/fa-clock-o[^>]*><\/i>\s*([^<]{1,30})/i)?.[1] ?? "");
    out.push({
      source: "hirefront",
      company: slug,
      externalId: id,
      title,
      url: `https://${slug}.myfront.cl/oferta-de-empleo/${id}/${titleSlug}/`,
      department: null,
      location: deriveLocationFromText(title),
      remote: null,
      salary: null,
      descriptionHtml: null,
      publishedAt,
      lastmod: null,
      raw: { id, title, jornada: jornada || null },
    });
  }
  return out;
}

/**
 * Trae las ofertas vigentes de un portal Hirefront. `identifier` = slug subdominio.
 * Devuelve [] si no hay portal/ofertas.
 */
export async function fetchHirefrontJobs(identifier: string): Promise<RawJob[]> {
  const slug = identifier.trim().toLowerCase();
  const out: RawJob[] = [];
  const seen = new Set<string>();
  for (let page = 1; page <= MAX_PAGES; page++) {
    const html = await requestText(`https://${slug}.myfront.cl/?page=${page}`, {
      tag: "job_radar.hirefront",
      ctx: { slug, page },
      accept: "text/html,*/*",
      userAgent: BROWSER_UA,
    });
    if (!html) break;
    const cards = parseCards(html, slug);
    if (cards.length === 0) break;
    let added = 0;
    for (const j of cards) {
      if (seen.has(j.externalId)) continue;
      seen.add(j.externalId);
      out.push(j);
      added++;
    }
    if (added === 0) break;
  }
  return out;
}
