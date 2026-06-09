// Adapter Genomawork / Genoma (ATS chileno). API REST pública sin auth/token:
//   GET https://api.genoma.work/api/v1/gamesandtests/{slug}/jobslisting/
//   → { name, jobapplications: [{ id, job_application, department,
//        location_city, location_country, creation_date, short_description }] }
// `identifier` = slug del board (= el de app.genoma.work/jobs/{slug}), ej:
//   sky-airline · soprole · queplan. El slug va directo en la URL (no hay id→slug).
//
// Usamos solo el listing (título alcanza para el filtro de perfil); el detalle
// (/jobapplications/{id}/public/) traería descripción/salario/modalidad a costa
// de N+1 requests — se omite.

import { asRecord, asString, requestText, safeJsonParse } from "./_shared.ts";
import type { RawJob } from "./types.ts";

function parseDate(raw: unknown): Date | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? null : new Date(t);
}

function joinLocation(o: Record<string, unknown>): string | null {
  const parts = [asString(o.location_city), asString(o.location_country)].filter(
    (p): p is string => Boolean(p)
  );
  return parts.length > 0 ? [...new Set(parts)].join(", ") : null;
}

/**
 * Trae las ofertas vigentes de una empresa en Genomawork. `identifier` = slug.
 * Devuelve [] si el slug no existe (404) o el board está vacío.
 */
export async function fetchGenomaworkJobs(identifier: string): Promise<RawJob[]> {
  const slug = identifier.trim().replace(/^\/+|\/+$/g, "");
  const text = await requestText(
    `https://api.genoma.work/api/v1/gamesandtests/${encodeURIComponent(slug)}/jobslisting/`,
    { tag: "job_radar.genomawork", ctx: { slug } }
  );
  if (!text) return [];
  const root = asRecord(safeJsonParse(text));
  const list = root?.jobapplications;
  if (!Array.isArray(list)) return [];
  const company = asString(root?.name) ?? slug;

  const out: RawJob[] = [];
  for (const item of list) {
    const o = asRecord(item);
    if (!o) continue;
    const externalId = asString(o.id);
    const title = asString(o.job_application);
    if (!externalId || !title) continue;
    out.push({
      source: "genomawork",
      company,
      externalId,
      title,
      url: `https://app.genoma.work/postulation/${externalId}`,
      department: asString(o.department),
      location: joinLocation(o),
      remote: null, // modalidad solo en el detalle (/public/), se omite el N+1
      salary: null,
      descriptionHtml: asString(o.short_description),
      publishedAt: parseDate(o.creation_date),
      lastmod: parseDate(o.creation_date),
      raw: item,
    });
  }
  return out;
}
