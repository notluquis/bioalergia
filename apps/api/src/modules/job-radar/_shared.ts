// Helpers compartidos por los adapters de Job Radar. Cada adapter mantiene su
// propia lógica de parseo de fechas / mapeo de campos (varían por fuente), pero
// el boilerplate de fetch + guards de tipo vive acá (DRY).

import { logWarn } from "../../lib/logger.ts";

export const JOB_RADAR_UA = "BioalergiaJobRadar/1.0 (+personal job search)";
// Algunos portales (Trabajando.com nginx) responden 502 a UAs no-browser.
export const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const TIMEOUT_MS = 15_000;

export function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null;
}

export function asString(v: unknown): string | null {
  if (typeof v === "string") return v.trim().length > 0 ? v.trim() : null;
  if (typeof v === "number") return String(v);
  return null;
}

export function stripHtmlText(html: string | null): string | null {
  if (!html) return null;
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#13;|&#10;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 0 ? text : null;
}

function normText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const LOCATION_HINTS: Array<[string, string]> = [
  ["region metropolitana", "Región Metropolitana"],
  ["metropolitana", "Región Metropolitana"],
  ["santiago", "Santiago"],
  ["quilicura", "Quilicura"],
  ["providencia", "Providencia"],
  ["las condes", "Las Condes"],
  ["nunoa", "Ñuñoa"],
  ["maipu", "Maipú"],
  ["valparaiso", "Valparaíso"],
  ["vina del mar", "Viña del Mar"],
  ["biobio", "Biobío"],
  ["bio bio", "Biobío"],
  ["concepcion", "Concepción"],
  ["antofagasta", "Antofagasta"],
  ["atacama", "Atacama"],
  ["copiapo", "Copiapó"],
  ["chanaral", "Chañaral"],
  ["coquimbo", "Coquimbo"],
  ["la serena", "La Serena"],
  ["maule", "Maule"],
  ["constitucion", "Constitución"],
  ["curico", "Curicó"],
  ["tarapaca", "Tarapacá"],
  ["iquique", "Iquique"],
  ["los lagos", "Los Lagos"],
  ["x region", "Los Lagos"],
  ["calbuco", "Calbuco"],
  ["chonchi", "Los Lagos"],
  ["pargua", "Los Lagos"],
  ["puerto montt", "Puerto Montt"],
  ["araucania", "La Araucanía"],
  ["ix region", "La Araucanía"],
  ["melipeuco", "La Araucanía"],
  ["curarrehue", "La Araucanía"],
  ["temuco", "Temuco"],
  ["ohiggins", "O'Higgins"],
  ["santa cruz", "Santa Cruz"],
  ["san vicente", "San Vicente"],
  ["nuble", "Ñuble"],
  ["chillan", "Chillán"],
  ["magallanes", "Magallanes"],
  ["xii region", "Magallanes"],
  ["puerto natales", "Magallanes"],
  ["valdivia", "Valdivia"],
  ["arauco", "Arauco"],
  ["los angeles", "Los Ángeles"],
  ["argentina", "Argentina"],
  ["mexico", "México"],
  ["peru", "Perú"],
  ["brasil", "Brasil"],
  ["colombia", "Colombia"],
  ["espana", "España"],
  ["estados unidos", "Estados Unidos"],
  ["united states", "Estados Unidos"],
  ["chile", "Chile"],
];

export function deriveLocationFromText(...values: Array<string | null | undefined>): string | null {
  const raw = values.filter((value): value is string => Boolean(value)).join(" ");
  if (!raw) return null;
  const text = normText(stripHtmlText(raw) ?? raw);
  let best: { index: number; length: number; label: string } | null = null;
  for (const [needle, label] of LOCATION_HINTS) {
    const index = text.indexOf(needle);
    if (index === -1) continue;
    if (!best || index < best.index || (index === best.index && needle.length > best.length)) {
      best = { index, length: needle.length, label };
    }
  }
  return best?.label ?? null;
}

export function deriveRemoteFromText(...values: Array<string | null | undefined>): string | null {
  const raw = values.filter((value): value is string => Boolean(value)).join(" ");
  if (!raw) return null;
  const text = normText(stripHtmlText(raw) ?? raw);
  if (/\b(remoto|remote|teletrabajo|telecommute|home office)\b/.test(text)) return "Remoto";
  if (/\b(hibrid\w*|hybrid|mixto)\b/.test(text)) return "Híbrido";
  if (/\b(presencial|onsite|on site)\b/.test(text)) return "Presencial";
  return null;
}

// "Publicado hace 4 días", "hace 23 horas", "hace 3 días, 23 horas" → Date aprox
// (now - delta). `now` se pasa para tests; default Date.now().
export function parseRelativeEs(text: string | null, now: number = Date.now()): Date | null {
  if (!text) return null;
  const t = text.toLowerCase();
  let ms = 0;
  let matched = false;
  for (const m of t.matchAll(/(\d+)\s*(minuto|hora|d[íi]a|semana|mes|a[ñn]o)/g)) {
    const n = Number(m[1]);
    const unit = m[2];
    const factor = unit.startsWith("minuto")
      ? 60_000
      : unit.startsWith("hora")
        ? 3_600_000
        : unit.startsWith("d")
          ? 86_400_000
          : unit.startsWith("semana")
            ? 604_800_000
            : unit.startsWith("mes")
              ? 2_592_000_000
              : 31_536_000_000; // año
    ms += n * factor;
    matched = true;
  }
  return matched ? new Date(now - ms) : null;
}

export function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text.replace(/^﻿/, "")); // tolera BOM (ej. empleospublicos)
  } catch {
    return null;
  }
}

export interface RequestOptions {
  method?: "GET" | "POST";
  body?: string;
  tag: string; // ej "job_radar.ashby" → loguea {tag}.non_ok / {tag}.error
  ctx?: Record<string, unknown>;
  // Algunos orígenes (Teamtailor sitemap.xml tras Cloudflare) responden 404 si
  // el Accept no matchea el content-type real. Default JSON (la mayoría de las
  // fuentes son APIs), override a XML/`*​/*` para sitemaps.
  accept?: string;
  // UA por defecto = JOB_RADAR_UA; override a BROWSER_UA donde el portal lo exija.
  userAgent?: string;
  // Headers extra (ej. authorization para el BFF de muevete/Falabella).
  headers?: Record<string, string>;
}

/**
 * GET/POST que devuelve el body como texto o null ante error (loguea warn).
 * Nunca lanza: el sync sigue con las demás fuentes aunque una falle.
 */
export async function requestText(url: string, opts: RequestOptions): Promise<string | null> {
  const {
    method = "GET",
    body,
    tag,
    ctx = {},
    accept = "application/json",
    userAgent = JOB_RADAR_UA,
    headers = {},
  } = opts;
  try {
    const res = await fetch(url, {
      method,
      headers: {
        "user-agent": userAgent,
        accept,
        ...(body ? { "content-type": "application/json" } : {}),
        ...headers,
      },
      body,
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      logWarn(`${tag}.non_ok`, { ...ctx, status: res.status });
      return null;
    }
    return await res.text();
  } catch (err) {
    logWarn(`${tag}.error`, { ...ctx, error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}
