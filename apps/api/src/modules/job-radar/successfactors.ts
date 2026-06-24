// Adapter SAP SuccessFactors Recruiting Marketing (RMK / Jobs2Web "j2w") — el
// career-site server-rendered de muchos empleadores grandes CL. NO hay JSON: la
// fuente browser-free es el fragmento HTML `/tile-search-results/?q=&startrow=N`
// (paginado por `startrow`, 40 por página). Una `<li class="job-tile job-id-{id}">`
// por oferta, con campos en `.section-field.customfieldN` y `.section-field.date`.
//
// `identifier` = base host (+ path multi-tenant), ej:
//   trabajos.achs.cl · empleos.codelco.cl · jobs.arauco.com · www.nuevotalento.cl/Essbio
// Construimos `https://{identifier}/tile-search-results/?q=&startrow=N`.

import {
  BROWSER_UA,
  deriveLocationFromText,
  deriveRemoteFromText,
  requestText,
} from "./_shared.ts";
import type { RawJob } from "./types.ts";

const MAX_PAGES = 40; // tope de seguridad

type RawObject = Record<string, unknown>;

const MONTHS: Record<string, number> = {
  ene: 0,
  feb: 1,
  mar: 2,
  abr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  ago: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dic: 11,
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

// El índice `customfieldN` NO es estable entre tenants SF: en codelco
// `customfield2` es la Región, en otros es la Gerencia, en BHP es basura de
// campaña. Lo único confiable es la ETIQUETA de texto embebida en cada
// `.section-field` ("Gerencia ...", "Región ...", "Lugar de Trabajo ..."). Por
// eso mapeamos por etiqueta, no por número de campo.
type FieldKey = "department" | "location" | "region" | "modalidad" | "date";

const FIELD_LABELS: ReadonlyArray<{ key: FieldKey | "ignore"; labels: readonly string[] }> = [
  {
    key: "department",
    labels: [
      "Gerencia",
      "Vicepresidencia",
      "Subgerencia",
      "Dirección",
      "Direccion",
      "División",
      "Division",
      "Departamento",
      "Unidad",
      "Área",
      "Area",
    ],
  },
  {
    key: "location",
    labels: ["Lugar de Trabajo", "Centro de Trabajo", "Ubicación", "Ubicacion", "Localidad"],
  },
  { key: "region", labels: ["Región", "Region"] },
  { key: "modalidad", labels: ["Modalidad de Trabajo", "Modalidad", "Jornada"] },
  { key: "date", labels: ["Fecha de publicación", "Fecha de publicacion", "Fecha"] },
  {
    key: "ignore",
    labels: ["ID de proceso", "Id de proceso", "Código postal", "Codigo postal", "Empresa"],
  },
];

function normLabel(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

// Lee TODOS los `.section-field` del tile y los indexa por significado según la
// etiqueta. Devuelve el valor (sin la etiqueta) del primer campo de cada tipo.
function tileFields(tile: string): Partial<Record<FieldKey, string>> {
  const out: Partial<Record<FieldKey, string>> = {};
  const re = /class="section-field [a-z0-9]+[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  for (const m of tile.matchAll(re)) {
    const text = cleanText(m[1]);
    if (!text) continue;
    const normText = normLabel(text);
    for (const { key, labels } of FIELD_LABELS) {
      const label = labels.find((l) => normText.startsWith(normLabel(l)));
      if (!label) continue;
      if (key !== "ignore" && out[key] == null) {
        const value = text
          .slice(label.length)
          .replace(/^[\s:.-]+/, "")
          .trim();
        if (value) out[key] = value;
      }
      break;
    }
  }
  return out;
}

// "2da.Reg.Antofagasta" / "Reg. Metropolitana" / "5ta.Reg.Valparaíso" →
// nombre de región limpio que el normalizador de la intranet sí reconoce.
function cleanChileRegion(raw: string): string {
  const stripped = raw.replace(/^\s*\d*\s*[a-zºª°]*\.?\s*reg(?:i[oó]n)?\.?\s*/i, "").trim();
  return normalizeLocation(stripped || raw) ?? raw;
}

// Valores que algunos tenants meten en el campo de ubicación pero NO son lugares
// (estado de la requisición, campaña, confidencial).
function isJunkLocation(value: string | null): boolean {
  if (!value) return true;
  return /not yet confirmed|global campaign|confidential|^\d+\s*\.\s*/i.test(value.trim());
}

function cleanText(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
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

function titleCaseLocation(raw: string): string {
  const connectors = new Set(["de", "del", "da", "do", "das", "dos", "la", "las", "los", "y", "e"]);
  return raw
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => {
      if (connectors.has(part)) return part;
      if (part.length <= 2) return part.toUpperCase();
      return part[0].toUpperCase() + part.slice(1);
    })
    .join(" ");
}

function locationFromJobPath(path: string, title: string): string | null {
  const decoded = locationUrlText(path);
  const titleSlug = title
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const beforeId = decoded.replace(/\/?\d+\/?$/, "");
  const prefix = beforeId.endsWith(`-${titleSlug}`)
    ? beforeId.slice(0, -titleSlug.length - 1)
    : beforeId.split("-").slice(0, 4).join("-");
  const cleaned = prefix
    .replace(/-REGI(?:ON)?$/i, "")
    .replace(/-/g, " ")
    .replace(/\bQUIT\b/g, "QUITO")
    .trim();
  if (!cleaned) return null;
  return titleCaseLocation(cleaned.replace(/\bEC\b/g, "Ecuador"));
}

function normalizeLocation(raw: string | null): string | null {
  if (!raw) return null;
  const expanded = raw
    .replace(/\bQUIT\b/g, "QUITO")
    .replace(/,\s*EC\b/g, ", Ecuador")
    .replace(/\bECUADOR\b/g, "Ecuador")
    .replace(/\s+/g, " ")
    .trim();
  if (!expanded) return null;
  const hasLowercase = /[a-záéíóúñãõç]/.test(expanded);
  if (hasLowercase) return expanded;
  return expanded
    .split(",")
    .map((part) => titleCaseLocation(part.trim()))
    .join(", ");
}

function isBroadLocation(location: string | null): boolean {
  if (!location) return true;
  return /^(Chile|Argentina|Brasil|Brazil|Ecuador|Peru|México|Mexico|Colombia|US|USA)$/i.test(
    location.trim()
  );
}

function rawObject(raw: unknown): RawObject {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as RawObject) : {};
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
    // cleanText decodifica entidades (&amp; → &, &#39; → ') que el strip manual
    // dejaba crudas en el título.
    const title = cleanText(titleM[1]);
    if (title.length === 0) continue;

    const fields = tileFields(tile);
    // Ubicación: campo explícito de lugar > Región (limpia) > derivada del texto >
    // derivada del path. Descartamos valores-basura (estado de requisición, etc.).
    const fieldLocation = isJunkLocation(fields.location ?? null)
      ? null
      : normalizeLocation(fields.location ?? null);
    const regionLocation = fields.region ? cleanChileRegion(fields.region) : null;
    const textLocation = deriveLocationFromText(title, locationUrlText(urlM[1]));
    const rawPathLocation = locationFromJobPath(urlM[1], title);
    const pathLocation = isJunkLocation(rawPathLocation) ? null : rawPathLocation;
    const resolvedLocation = fieldLocation ?? regionLocation ?? textLocation ?? pathLocation;
    const locationSource = fieldLocation
      ? "tile"
      : regionLocation
        ? "region"
        : textLocation
          ? "text"
          : pathLocation
            ? "path"
            : null;
    const modalidad = fields.modalidad ?? null;
    out.push({
      source: "successfactors",
      company: baseUrl,
      externalId: id,
      title,
      url: `https://${baseUrl.split("/")[0]}${urlM[1]}`,
      // Solo se rellena Área cuando hay una etiqueta de unidad organizativa real
      // (Gerencia/Dirección/…); evita filtrar la Región o el título a esta columna.
      department: fields.department ?? null,
      location: resolvedLocation,
      remote: mapRemote(modalidad) ?? deriveRemoteFromText(modalidad, title, tile),
      salary: null,
      descriptionHtml: null, // la descripción se inyecta por JS en la página de detalle
      publishedAt: parseSpanishDate(fields.date ?? null),
      lastmod: null,
      raw: {
        id,
        url: urlM[1],
        locationSource,
      },
    });
  }
  return out;
}

function cellValue(row: string, className: string): string | null {
  const re = new RegExp(`<td[^>]*class="[^"]*${className}[^"]*"[^>]*>([\\s\\S]*?)<\\/td>`, "i");
  const m = row.match(re);
  if (!m) return null;
  const text = cleanText(m[1]);
  return text.length > 0 ? text : null;
}

function parseSearchRows(html: string, baseUrl: string): RawJob[] {
  const out: RawJob[] = [];
  const host = baseUrl.split("/")[0];
  const rows = html.match(/<tr[^>]*class="[^"]*data-row[^"]*"[^>]*>[\s\S]*?<\/tr>/gi) ?? [];
  for (const row of rows) {
    const link =
      row.match(
        /<a[^>]*class="[^"]*jobTitle-link[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i
      ) ??
      row.match(/<a[^>]*href="([^"]+)"[^>]*class="[^"]*jobTitle-link[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
    if (!link) continue;
    const path = link[1];
    const id = path.match(/\/(\d+)\/?$/)?.[1];
    if (!id) continue;
    const title = cleanText(link[2]);
    if (!title) continue;
    const location = normalizeLocation(cellValue(row, "colLocation"));
    const facility = cellValue(row, "colFacility") ?? null;
    const date = cellValue(row, "colDate");
    out.push({
      source: "successfactors",
      company: baseUrl,
      externalId: id,
      title,
      url: `https://${host}${path}`,
      department: facility,
      location,
      remote: deriveRemoteFromText(title, row),
      salary: null,
      descriptionHtml: null,
      publishedAt: parseSpanishDate(date),
      lastmod: null,
      raw: { id, url: path, source: "search" },
    });
  }
  return out;
}

function parseDetailLocation(html: string): string | null {
  const propertyValues = new Map<string, string>();
  const propertyRe = /<span[^>]*data-careersite-propertyid="([^"]+)"[^>]*>([\s\S]*?)<\/span>/gi;
  for (const match of html.matchAll(propertyRe)) {
    const value = normalizeLocation(cleanText(match[2]));
    if (value) propertyValues.set(match[1].toLowerCase(), value);
  }

  const city = propertyValues.get("city");
  const province =
    propertyValues.get("customfield4") ??
    propertyValues.get("state") ??
    propertyValues.get("province") ??
    null;
  const country = propertyValues.get("location") ?? null;
  const composite = [city, province, country]
    .filter((part): part is string => Boolean(part))
    .filter(
      (part, index, parts) =>
        parts.findIndex((other) => other.toLowerCase() === part.toLowerCase()) === index
    )
    .join(", ");
  if (composite) return composite;

  const geo = html.match(/<span[^>]*class="[^"]*jobGeoLocation[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
  if (geo) return normalizeLocation(cleanText(geo[1]));

  const locationBlock = html.match(
    /<span[^>]*class="[^"]*joblayouttoken-label[^"]*"[^>]*>\s*Location:\s*<\/span>([\s\S]{0,2000}?)(?:<\/div>\s*<\/div>|<div class="joblayouttoken)/i
  );
  if (!locationBlock) return null;
  return normalizeLocation(cleanText(locationBlock[1]));
}

async function enrichDetailLocations(jobs: RawJob[]): Promise<void> {
  const pending = jobs.filter((job) => {
    const raw = rawObject(job.raw);
    return raw.locationSource === "path" || isBroadLocation(job.location);
  });
  let index = 0;
  const worker = async () => {
    while (index < pending.length) {
      const job = pending[index++];
      const html = await requestText(job.url, {
        tag: "job_radar.successfactors.detail",
        ctx: { url: job.url },
        accept: "text/html,*/*",
        userAgent: BROWSER_UA,
      });
      if (!html) continue;
      const location = parseDetailLocation(html);
      if (!location) continue;
      job.location = location;
      job.raw = { ...rawObject(job.raw), detailLocation: location };
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, pending.length) }, worker));
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
    const html = await requestText(`https://${base}/tile-search-results/?q=&startrow=${startrow}`, {
      tag: "job_radar.successfactors",
      ctx: { base, startrow },
      accept: "text/html,*/*",
      userAgent: BROWSER_UA,
    });
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

  startrow = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const html = await requestText(
      `https://${base}/search/?q=&sortColumn=referencedate&sortDirection=desc&startrow=${startrow}`,
      {
        tag: "job_radar.successfactors.search",
        ctx: { base, startrow },
        accept: "text/html,*/*",
        userAgent: BROWSER_UA,
      }
    );
    if (!html) break;
    const rows = parseSearchRows(html, base);
    if (rows.length === 0) break;
    let touched = 0;
    for (const row of rows) {
      const current = out.find((job) => job.externalId === row.externalId);
      if (current) {
        current.location = row.location ?? current.location;
        current.publishedAt = row.publishedAt ?? current.publishedAt;
        current.department = current.department ?? row.department;
        current.remote = current.remote ?? row.remote;
        current.raw = {
          ...rawObject(current.raw),
          locationSource: row.location ? "search" : rawObject(current.raw).locationSource,
          search: row.raw,
        };
      } else if (!seen.has(row.externalId)) {
        seen.add(row.externalId);
        out.push(row);
      }
      touched++;
    }
    if (touched === 0) break;
    startrow += rows.length;
  }
  await enrichDetailLocations(out);
  return out;
}
