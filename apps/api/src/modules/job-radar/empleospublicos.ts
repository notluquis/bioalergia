// Adapter Empleos Públicos (empleospublicos.cl, Servicio Civil) — sector público CL.
// Feed JSON público (con BOM): https://www.empleospublicos.cl/data/convocatorias2_nueva.txt
// → [{ "Cargo", "Institución / Entidad", "Área de Trabajo", "Región", "Ciudad",
//      "Renta Bruta" (CLP "1036481,00"), "Fecha Inicio", "Fecha Cierre Convocatoria",
//      "url" (con ?i=<id>) }]. Fuente global (sin per-empresa) → toggle en settings.

import { asRecord, asString, requestText, safeJsonParse } from "./_shared.ts";
import type { RawJob } from "./types.ts";

const FEED = "https://www.empleospublicos.cl/data/convocatorias2_nueva.txt";

// "1036481,00" → "$1.036.481"
function formatRenta(raw: unknown): string | null {
  const s = asString(raw);
  if (!s) return null;
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  // Agrupación de miles con "." determinística (no depende del ICU del runtime).
  const grouped = String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `$${grouped}`;
}

// "03/06/2026 0:00:00" → Date
function parseDmyTime(raw: unknown): Date | null {
  const s = asString(raw);
  if (!s) return null;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const t = Date.parse(`${y}-${mo}-${d}T00:00:00`);
  return Number.isNaN(t) ? null : new Date(t);
}

function idFromUrl(url: string | null): string | null {
  if (!url) return null;
  return url.match(/[?&]i=(\d+)/)?.[1] ?? null;
}

export async function fetchEmpleosPublicosJobs(): Promise<RawJob[]> {
  const text = await requestText(FEED, { tag: "job_radar.empleospublicos" });
  if (!text) return [];
  const data = safeJsonParse(text);
  if (!Array.isArray(data)) return [];

  const out: RawJob[] = [];
  for (const item of data) {
    const o = asRecord(item);
    if (!o) continue;
    const title = asString(o.Cargo);
    const url = asString(o.url);
    const externalId = idFromUrl(url) ?? url;
    if (!title || !url || !externalId) continue;
    const ciudad = asString(o.Ciudad);
    const region = asString(o["Región"]);
    out.push({
      source: "empleospublicos",
      company: "empleospublicos",
      externalId,
      title,
      url,
      department: asString(o["Institución / Entidad"]) ?? asString(o["Área de Trabajo"]),
      location: [ciudad, region].filter(Boolean).join(", ") || null,
      remote: null,
      salary: formatRenta(o["Renta Bruta"]),
      descriptionHtml: null,
      publishedAt: parseDmyTime(o["Fecha Inicio"]),
      lastmod: null,
      raw: item,
    });
  }
  return out;
}
