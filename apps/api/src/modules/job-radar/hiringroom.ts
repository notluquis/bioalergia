// Adapter HiringRoom — career boards multi-tenant `{slug}.hiringroom.com/jobs`.
// NO hay API JSON pública: el board es HTML server-rendered. Parseamos las cards
// de la lista (`/jobs?page=N`, 20 por página, footer "1-20 de N vacantes").
// Cada card trae título (h4.name__vacancy), ubicación (icono hr-Location-pin) y
// área (icono hr-Work-area) + link `/jobs/get_vacancy/{id}` (id = 24-hex).
// `identifier` = slug del subdominio, ej: cinepolis, tvn, duoc, bicevida.
//
// La descripción y la fecha absoluta solo están en el detalle (fecha en la lista
// es relativa "Hace X") → publishedAt null, descriptionHtml null (alcanza el
// título para el filtro de perfil).

import { BROWSER_UA, requestText } from "./_shared.ts";
import type { RawJob } from "./types.ts";

const MAX_PAGES = 20;
// Países extranjeros: HiringRoom mezcla tenants multi-país (makrohr=AR). Filtramos a CL.
const FOREIGN = [
  "argentina",
  "méxico",
  "mexico",
  "perú",
  "peru",
  "colombia",
  "uruguay",
  "paraguay",
];

function clean(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

// Texto que sigue a un <i class="{icon}..."> dentro de su <span>.
function afterIcon(card: string, icon: string): string | null {
  const m = card.match(new RegExp(`${icon}[^>]*></i>([\\s\\S]*?)</span>`, "i"));
  return m ? clean(m[1]) || null : null;
}

function parseCards(html: string, slug: string): RawJob[] {
  const out: RawJob[] = [];
  // Cada card = anchor a /jobs/get_vacancy/{id} con la tarjeta adentro.
  for (const m of html.matchAll(
    /href="(?:https?:\/\/[^"]*)?\/jobs\/get_vacancy\/([a-f0-9]{24})"[^>]*>([\s\S]*?)<\/a>/gi
  )) {
    const id = m[1];
    const card = m[2];
    const titleM = card.match(/name__vacancy[^>]*>([\s\S]*?)<\/h4>/i);
    if (!titleM) continue; // anchors sin h4 (ej "Subir CV a base general")
    const title = clean(titleM[1]);
    if (!title) continue;
    const location = afterIcon(card, "hr-Location-pin");
    const area = afterIcon(card, "hr-Work-area");
    out.push({
      source: "hiringroom",
      company: slug,
      externalId: id,
      title,
      url: `https://${slug}.hiringroom.com/jobs/get_vacancy/${id}`,
      department: area,
      location,
      remote: null,
      salary: null,
      descriptionHtml: null,
      publishedAt: null, // la lista solo da fecha relativa
      lastmod: null,
      raw: { id, title, location, area },
    });
  }
  return out;
}

/**
 * Trae las vacantes vigentes de un board HiringRoom (filtradas a Chile).
 * `identifier` = slug del subdominio. Devuelve [] si no hay board/ofertas.
 */
export async function fetchHiringRoomJobs(identifier: string): Promise<RawJob[]> {
  const slug = identifier.trim().toLowerCase();
  const out: RawJob[] = [];
  const seen = new Set<string>();
  for (let page = 1; page <= MAX_PAGES; page++) {
    const html = await requestText(`https://${slug}.hiringroom.com/jobs?page=${page}`, {
      tag: "job_radar.hiringroom",
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
      const loc = (j.location ?? "").toLowerCase();
      if (FOREIGN.some((c) => loc.includes(c))) continue; // solo Chile
      out.push(j);
      added++;
    }
    // Footer "1-20 de N": si esta página no aportó ids nuevos, cortar.
    if (cards.every((c) => seen.has(c.externalId)) && added === 0) break;
    const totalM = html.match(/de\s+(\d+)\s+vacante/i);
    if (totalM && seen.size >= Number(totalM[1])) break;
  }
  return out;
}
