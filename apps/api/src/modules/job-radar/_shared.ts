// Helpers compartidos por los adapters de Job Radar. Cada adapter mantiene su
// propia lógica de parseo de fechas / mapeo de campos (varían por fuente), pero
// el boilerplate de fetch + guards de tipo vive acá (DRY).

import { logWarn } from "../../lib/logger.ts";

export const JOB_RADAR_UA = "BioalergiaJobRadar/1.0 (+personal job search)";
const TIMEOUT_MS = 15_000;

export function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null;
}

export function asString(v: unknown): string | null {
  if (typeof v === "string") return v.trim().length > 0 ? v.trim() : null;
  if (typeof v === "number") return String(v);
  return null;
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
}

/**
 * GET/POST que devuelve el body como texto o null ante error (loguea warn).
 * Nunca lanza: el sync sigue con las demás fuentes aunque una falle.
 */
export async function requestText(url: string, opts: RequestOptions): Promise<string | null> {
  const { method = "GET", body, tag, ctx = {}, accept = "application/json" } = opts;
  try {
    const res = await fetch(url, {
      method,
      headers: {
        "user-agent": JOB_RADAR_UA,
        accept,
        ...(body ? { "content-type": "application/json" } : {}),
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
