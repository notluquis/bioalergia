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
