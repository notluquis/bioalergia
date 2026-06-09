// Adapter Pandapé (by Computrabajo) — career sites `{slug}.pandape.computrabajo.com`.
// HTML server-rendered, sin API JSON pública. La página `/Vacancies` lista cards
// `<a class="card card-vacancy" href="/Detail/{id}">` con `<h3 title="...">` +
// ubicación (icono `icon-location-pin`) + modalidad (icono `icon-buildings`).
// `identifier` = slug del subdominio (ej `ripleychile`). Muy usado en CL.

import { BROWSER_UA, requestText } from "./_shared.ts";
import type { RawJob } from "./types.ts";

const MAX_PAGES = 20;

function clean(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Texto que sigue a un `<i class="{icon}...">` dentro de su contenedor.
function afterIcon(card: string, icon: string): string | null {
  const m = card.match(new RegExp(`${icon}[^>]*></i>\\s*</div>\\s*([^<]+)`, "i"));
  return m ? clean(m[1]) || null : null;
}

function mapRemote(modalidad: string | null): string | null {
  if (!modalidad) return null;
  const up = modalidad.toUpperCase();
  if (up.includes("REMOT")) return "Remoto";
  if (up.includes("HÍBRID") || up.includes("HIBRID")) return "Híbrido";
  return null;
}

function parseCards(html: string, slug: string): RawJob[] {
  const out: RawJob[] = [];
  for (const m of html.matchAll(
    /<a[^>]+class="card card-vacancy[^"]*"[^>]+href="\/Detail\/(\d+)"([\s\S]*?)<\/a>/gi
  )) {
    const id = m[1];
    const card = m[2];
    const titleM = card.match(/<h3[^>]*title="([^"]*)"/i) ?? card.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    if (!titleM) continue;
    const title = clean(titleM[1]);
    if (!title) continue;
    const location = afterIcon(card, "icon-location-pin");
    out.push({
      source: "pandape",
      company: slug,
      externalId: id,
      title,
      url: `https://${slug}.pandape.computrabajo.com/Detail/${id}`,
      department: null,
      location,
      remote: mapRemote(afterIcon(card, "icon-buildings")),
      salary: null,
      descriptionHtml: null,
      publishedAt: null,
      lastmod: null,
      raw: { id, title, location },
    });
  }
  return out;
}

/**
 * Trae las vacantes vigentes de un career site Pandapé. `identifier` = slug.
 * Devuelve [] si no hay portal/ofertas.
 */
export async function fetchPandapeJobs(identifier: string): Promise<RawJob[]> {
  const slug = identifier.trim().toLowerCase();
  const out: RawJob[] = [];
  const seen = new Set<string>();
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url =
      page === 1
        ? `https://${slug}.pandape.computrabajo.com/Vacancies`
        : `https://${slug}.pandape.computrabajo.com/Vacancies?page=${page}`;
    const html = await requestText(url, {
      tag: "job_radar.pandape",
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
