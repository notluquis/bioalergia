// Adapter Trabajando.com — portal CL multi-tenant (Nuxt SSR). Cada empleador es
// un subdominio `{slug}.trabajando.cl`. Las rutas Nuxt `/api/*` son públicas, sin
// token. Flujo: resolver `idDominio` del portal, luego paginar las ofertas.
//   1. GET /api/config/portal?dominio={slug}.trabajando.cl → { idDominio, ... }
//   2. GET /api/searchjob?idDominio=&pagina=N&ofertaConfidencial=false
//          &orden=FECHA_PUBLICACION&tipoOrden=DESC  (15 por página, server-clamp)
// `identifier` = slug del subdominio (ej "cge", "hospitalclinicosur").
//
// GOTCHA: nginx responde 502 a UAs no-browser → usamos BROWSER_UA. Sin auth/cookie.

import { asRecord, asString, BROWSER_UA, requestText, safeJsonParse } from "./_shared.ts";
import type { RawJob } from "./types.ts";

const MAX_PAGES = 50; // tope de seguridad (750 ofertas)

function slugifyTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseClDate(raw: unknown): Date | null {
  // "2026-06-08 16:42" hora local Chile → interpretamos como -04/-03 best-effort.
  if (typeof raw !== "string" || raw.length === 0) return null;
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) {
    const t = Date.parse(raw);
    return Number.isNaN(t) ? null : new Date(t);
  }
  // Chile = UTC-4 (sin DST aplicado fino); +4h para llevar a UTC aprox.
  const [, y, mo, d, h, mi] = m;
  return new Date(Date.UTC(+y, +mo - 1, +d, +h + 4, +mi));
}

async function resolveDomainId(host: string): Promise<number | null> {
  const text = await requestText(
    `https://${host}/api/config/portal?dominio=${encodeURIComponent(host)}`,
    { tag: "job_radar.trabajando.config", ctx: { host }, userAgent: BROWSER_UA }
  );
  if (!text) return null;
  const id = asRecord(safeJsonParse(text))?.idDominio;
  return typeof id === "number" ? id : null;
}

/**
 * Trae las ofertas vigentes de un portal Trabajando.com.
 * `identifier` = slug del subdominio. Devuelve [] si el portal no resuelve.
 */
export async function fetchTrabajandoJobs(identifier: string): Promise<RawJob[]> {
  const slug = identifier.trim().replace(/\.trabajando\.cl$/i, "");
  const host = `${slug}.trabajando.cl`;
  const idDominio = await resolveDomainId(host);
  if (idDominio === null) return [];

  const out: RawJob[] = [];
  const seen = new Set<string>();
  for (let pagina = 1; pagina <= MAX_PAGES; pagina++) {
    const text = await requestText(
      `https://${host}/api/searchjob?idDominio=${idDominio}&pagina=${pagina}` +
        `&ofertaConfidencial=false&orden=FECHA_PUBLICACION&tipoOrden=DESC`,
      { tag: "job_radar.trabajando", ctx: { host, pagina }, userAgent: BROWSER_UA }
    );
    if (!text) break;
    const root = asRecord(safeJsonParse(text));
    const ofertas = root?.ofertas;
    if (!Array.isArray(ofertas) || ofertas.length === 0) break;

    for (const item of ofertas) {
      const o = asRecord(item);
      if (!o) continue;
      const externalId = asString(o.idOferta);
      const title = asString(o.nombreCargo);
      if (!externalId || !title || seen.has(externalId)) continue;
      seen.add(externalId);
      out.push({
        source: "trabajando",
        company: asString(o.nombreEmpresa) ?? slug,
        externalId,
        title,
        url: `https://${host}/trabajo/${externalId}-${slugifyTitle(title)}`,
        department: null,
        location: asString(o.ubicacion),
        remote: null,
        salary: null,
        descriptionHtml: asString(o.descripcionOferta), // teaser; suficiente para el filtro
        publishedAt: parseClDate(o.fechaPublicacion),
        lastmod: parseClDate(o.fechaPublicacion),
        raw: item,
      });
    }

    const totalPages = root?.cantidadPaginas;
    if (typeof totalPages === "number" && pagina >= totalPages) break;
  }
  return out;
}
