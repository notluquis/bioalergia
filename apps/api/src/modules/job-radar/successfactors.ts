// Adapter SAP SuccessFactors Recruiting Marketing (RMK / Jobs2Web "j2w") — el
// career-site server-rendered de muchos empleadores grandes CL. NO hay JSON: la
// fuente browser-free es el fragmento HTML `/tile-search-results/?q=&startrow=N`
// (paginado por `startrow`, 40 por página). Una `<li class="job-tile job-id-{id}">`
// por oferta, con campos en `.section-field.customfieldN` y `.section-field.date`.
//
// `identifier` = base host (+ path multi-tenant), ej:
//   trabajos.achs.cl · empleos.codelco.cl · jobs.arauco.com · www.nuevotalento.cl/Essbio
// Construimos `https://{identifier}/tile-search-results/?q=&startrow=N`.

import { BROWSER_UA, deriveLocationFromText, deriveRemoteFromText, requestText } from "./_shared.ts";
import type { RawJob } from "./types.ts";

const MAX_PAGES = 40; // tope de seguridad

const MONTHS: Record<string, number> = {
  ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5,
  jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11,
};

// "9 jun 2026" → Date (mediodía UTC para evitar corrimientos de zona).
function parseSpanishDate(raw: string | null): Date | null {
  if (!raw) return null;
  const m = raw.match(/(\d{1,2})\s+([a-záéíóú]{3})\w*\.?\s+(\d{4})/i);
  if (!m) return null;
  const day = Number(m[1]);
  const mon = MONTHS[m[2].toLowerCase().slice(0, 3)];
  const year = Number(m[3]);
  if (mon === undefined) return null;
  return new Date(Date.UTC(year, mon, day, 12, 0, 0));
}

// Texto plano del primer `.section-field <field>` del tile, sin la etiqueta.
function fieldValue(tile: string, field: string, label: string): string | null {
  const re = new RegExp(`class="section-field ${field}[^"]*"[^>]*>([\\s\\S]*?)</div>`, "i");
  const m = tile.match(re);
  if (!m) return null;
  const text = m[1]
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  // El valor viene como "Etiqueta valor real" → quitamos el prefijo de etiqueta.
  const stripped = text.startsWith(label) ? text.slice(label.length).trim() : text;
  return stripped.length > 0 ? stripped : null;
}

function mapRemote(modalidad: string | null): string | null {
  if (!modalidad) return null;
  const up = modalidad.toUpperCase();
  if (up.includes("REMOT")) return "Remoto";
  if (up.includes("HIBRID") || up.includes("HÍBRID")) return "Híbrido";
  return null; // Presencial → sin chip
}

function locationUrlText(path: string): string {
  return decodeURIComponent(path).split("/job/").at(-1) ?? path;
}

function parseTiles(html: string, baseUrl: string): RawJob[] {
  const out: RawJob[] = [];
  // Cada tile arranca en `job-tile job-id-{id}` y termina donde empieza el siguiente.
  const starts = [...html.matchAll(/job-tile job-id-(\d+)/g)];
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i];
    const id = start[1];
    const from = start.index ?? 0;
    const to = i + 1 < starts.length ? (starts[i + 1].index ?? html.length) : html.length;
    const tile = html.slice(from, to);

    const urlM = tile.match(/data-url="([^"]+)"/);
    const titleM = tile.match(/jobTitle-link[^>]*>([\s\S]*?)<\/a>/);
    if (!urlM || !titleM) continue;
    const title = titleM[1]
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (title.length === 0) continue;

    const location = fieldValue(tile, "customfield3", "Lugar de Trabajo");
    const modalidad = fieldValue(tile, "customfield5", "Modalidad de Trabajo");
    out.push({
      source: "successfactors",
      company: baseUrl,
      externalId: id,
      title,
      url: `https://${baseUrl.split("/")[0]}${urlM[1]}`,
      department: fieldValue(tile, "customfield2", "Gerencia"),
      location: location ?? deriveLocationFromText(title, locationUrlText(urlM[1])),
      remote: mapRemote(modalidad) ?? deriveRemoteFromText(modalidad, title, tile),
      salary: null,
      descriptionHtml: null, // la descripción se inyecta por JS en la página de detalle
      publishedAt: parseSpanishDate(fieldValue(tile, "date", "Fecha de publicación")),
      lastmod: null,
      raw: { id, url: urlM[1] },
    });
  }
  return out;
}

/**
 * Trae todas las ofertas vigentes de un career-site SuccessFactors RMK.
 * `identifier` = host (+ path), ej "trabajos.achs.cl" o "www.nuevotalento.cl/Essbio".
 * Devuelve [] si el sitio no responde.
 */
export async function fetchSuccessFactorsJobs(identifier: string): Promise<RawJob[]> {
  const base = identifier.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const out: RawJob[] = [];
  const seen = new Set<string>();
  // `startrow` avanza por la cantidad real de tiles de la página (el page size
  // varía por tenant: 25/40/…), no por un PAGE_SIZE fijo que saltaría filas.
  let startrow = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const html = await requestText(
      `https://${base}/tile-search-results/?q=&startrow=${startrow}`,
      { tag: "job_radar.successfactors", ctx: { base, startrow }, accept: "text/html,*/*", userAgent: BROWSER_UA }
    );
    if (!html) break;
    const jobs = parseTiles(html, base);
    if (jobs.length === 0) break;
    let added = 0;
    for (const j of jobs) {
      if (seen.has(j.externalId)) continue;
      seen.add(j.externalId);
      out.push(j);
      added++;
    }
    // Sin ids nuevos (tenant que ignora startrow o última página) → cortar.
    if (added === 0) break;
    startrow += jobs.length;
  }
  return out;
}
