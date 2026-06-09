// Adapter muevete.falabella.com — BFF propio de Falabella que agrega las ofertas
// del grupo (Falabella Retail, Sodimac, Tottus, Banco Falabella, IKEA, Mallplaza,
// Seguros, Corporativo) sobre el ATS airavirtual. UNA sola llamada GET devuelve
// el catálogo completo (~1900 ofertas, mayoría Chile), sin paginar.
//
//   GET https://ftc-hr-tama-atrc.falabella.tech/bff-sgdt-job-offer/api/ofertalaboral/type/external
//   Header authorization: <token estático horneado en el bundle JS público>
//
// GOTCHA (CLAUDE.md #26): el token es un string estático del bundle público
// `muevete.falabella.com/assets/index-*.js`. Si rota → 401/403 vacío → re-extraer
// del bundle (grep `this.token=` / `url_bff`). El hash del bundle cambia por deploy.

import { asRecord, asString, requestText, safeJsonParse } from "./_shared.ts";
import type { RawJob } from "./types.ts";

const BFF_URL =
  "https://ftc-hr-tama-atrc.falabella.tech/bff-sgdt-job-offer/api/ofertalaboral/type/external";
const BFF_TOKEN = "329E7hbFSYyGUJrFlk2DqmW6sirxjvt4T2Sh0jWReX8";

function parseDate(raw: unknown): Date | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? null : new Date(t);
}

function joinLocation(o: Record<string, unknown>): string | null {
  const parts = [asString(o.city), asString(o.state), asString(o.country)].filter(
    (p): p is string => Boolean(p)
  );
  return parts.length > 0 ? [...new Set(parts)].join(", ") : null;
}

/**
 * Trae el catálogo público de Falabella (todas las marcas del grupo). El BFF
 * mezcla varios países; el filtro de perfil + la columna empresa permiten acotar.
 */
export async function fetchMueveteJobs(): Promise<RawJob[]> {
  const text = await requestText(BFF_URL, {
    tag: "job_radar.muevete",
    headers: { authorization: BFF_TOKEN },
  });
  if (!text) return [];
  const arr = safeJsonParse(text);
  if (!Array.isArray(arr)) return [];

  const out: RawJob[] = [];
  for (const item of arr) {
    const o = asRecord(item);
    if (!o) continue;
    const externalId = asString(o.offer_id);
    const title = asString(o.title);
    if (!externalId || !title) continue;
    const desc = asString(o.description);
    out.push({
      source: "muevete",
      company: asString(o.company) ?? "Falabella",
      externalId,
      title,
      url: asString(o.url) ?? `https://muevete.falabella.com/`,
      department: asString(o.area) ?? asString(o.job_function),
      location: joinLocation(o),
      remote: null, // el payload no expone modalidad/remoto
      salary: null,
      // `description` es texto plano con \n; lo pasamos como HTML con <br>.
      descriptionHtml: desc ? desc.replace(/\n/g, "<br>") : null,
      publishedAt: parseDate(o.date),
      lastmod: parseDate(o.date),
      raw: item,
    });
  }
  return out;
}
