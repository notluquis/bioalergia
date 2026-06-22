// P3 — pronóstico de polen para /polen.
//
// GRASS: en vivo desde la Google Pollen API (Maps Platform; reusa la key de
// Places `GOOGLE_PLACES_API_KEY`). En Chile la API solo cubre gramíneas.
// TREE/WEED: calendario polínico curado (services/pollen-calendar.ts).
//
// El cron `pollen_sync` (graphile-worker, diario) llama a `syncPollenForecast`,
// que SOBRESCRIBE las filas GRASS (cache temporal, conforme a los Maps Service
// Terms). El sitio lee `getCachedForecast` (db raw, público) — NUNCA llama a
// Google por page-view.

import type { PollenForecastResponse, PollenGrassDay } from "@finanzas/orpc-contracts/pollen";
import { db } from "@finanzas/db";
import { DomainError } from "../lib/errors.ts";
import { logEvent } from "../lib/logger.ts";
import { pollenCalendarForMonth } from "./pollen-calendar.ts";

const POLLEN_API = "https://pollen.googleapis.com/v1/forecast:lookup";

export const CONCEPCION = {
  key: "concepcion",
  label: "Concepción",
  lat: -36.827,
  lng: -73.0503,
} as const;

function pollenApiKey(): string {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new DomainError("BAD_REQUEST", "GOOGLE_PLACES_API_KEY no configurada");
  return key;
}

/** Mes actual (1–12) en America/Santiago. */
function santiagoMonth(): number {
  const m = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Santiago",
    month: "numeric",
  }).format(new Date());
  return Number.parseInt(m, 10);
}

/** Fecha de hoy (YYYY-MM-DD) en America/Santiago. */
function santiagoToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function toYMD(d: { year: number; month: number; day: number }): string {
  const mm = String(d.month).padStart(2, "0");
  const dd = String(d.day).padStart(2, "0");
  return `${d.year}-${mm}-${dd}`;
}

function colorToHex(color?: { red?: number; green?: number; blue?: number }): string | null {
  if (!color) return null;
  const c = (v?: number) =>
    Math.max(0, Math.min(255, Math.round((v ?? 0) * 255)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(color.red)}${c(color.green)}${c(color.blue)}`;
}

type GoogleIndexInfo = {
  value?: number;
  category?: string;
  color?: { red?: number; green?: number; blue?: number };
};
type GooglePollenTypeInfo = { code?: string; inSeason?: boolean; indexInfo?: GoogleIndexInfo };
type GoogleDailyInfo = {
  date?: { year: number; month: number; day: number };
  pollenTypeInfo?: GooglePollenTypeInfo[];
};
type GoogleResponse = { dailyInfo?: GoogleDailyInfo[] };

/** Llama a la Google Pollen API y extrae el pronóstico DIARIO de gramíneas. */
export async function fetchGrassForecast(
  lat: number,
  lng: number,
  days = 5
): Promise<PollenGrassDay[]> {
  const url = new URL(POLLEN_API);
  url.searchParams.set("key", pollenApiKey());
  url.searchParams.set("location.latitude", String(lat));
  url.searchParams.set("location.longitude", String(lng));
  url.searchParams.set("days", String(days));
  url.searchParams.set("languageCode", "es");

  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new DomainError("BAD_REQUEST", `Google Pollen API ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as GoogleResponse;

  const out: PollenGrassDay[] = [];
  for (const day of json.dailyInfo ?? []) {
    if (!day.date) continue;
    const grass = (day.pollenTypeInfo ?? []).find((p) => p.code === "GRASS");
    out.push({
      date: toYMD(day.date),
      upi: grass?.indexInfo?.value ?? null,
      category: grass?.indexInfo?.category ?? null,
      colorHex: colorToHex(grass?.indexInfo?.color),
      inSeason: grass?.inSeason ?? false,
    });
  }
  return out;
}

/**
 * Refresca el cache de gramíneas (cron diario). Sobrescribe todas las filas
 * GRASS de la ubicación (overwrite temporal, Maps ToS). Devuelve cuántos días
 * quedaron cacheados.
 */
export async function syncPollenForecast(
  location: { key: string; lat: number; lng: number } = CONCEPCION
): Promise<{ days: number }> {
  const forecast = await fetchGrassForecast(location.lat, location.lng, 5);

  await db.pollenForecast.deleteMany({
    where: { locationKey: location.key, pollenType: "GRASS" },
  });
  if (forecast.length > 0) {
    await db.pollenForecast.createMany({
      data: forecast.map((d) => ({
        locationKey: location.key,
        forecastDate: new Date(`${d.date}T00:00:00.000Z`),
        pollenType: "GRASS" as const,
        upiValue: d.upi,
        category: d.category,
        colorHex: d.colorHex,
        inSeason: d.inSeason,
        source: "GOOGLE" as const,
      })),
    });
  }

  logEvent("pollen.sync.done", { location: location.key, days: forecast.length });
  return { days: forecast.length };
}

/**
 * Lectura pública (db raw): cache de gramíneas (hoy en adelante) + calendario
 * mensual de árboles/malezas. Si el cache está vacío (cron no corrió o falta la
 * key), `provenance.grass = "unavailable"` y solo se devuelve el calendario.
 */
export async function getCachedForecast(
  location: { key: string; label: string } = CONCEPCION
): Promise<PollenForecastResponse> {
  const today = new Date(`${santiagoToday()}T00:00:00.000Z`);
  const rows = await db.pollenForecast.findMany({
    where: { locationKey: location.key, pollenType: "GRASS", forecastDate: { gte: today } },
    orderBy: { forecastDate: "asc" },
  });

  const grassForecast: PollenGrassDay[] = rows.map((r) => ({
    date: r.forecastDate.toISOString().slice(0, 10),
    upi: r.upiValue,
    category: r.category,
    colorHex: r.colorHex,
    inSeason: r.inSeason,
  }));

  const updatedAt =
    rows.length > 0
      ? rows.reduce<Date>(
          (max, r) => (r.fetchedAt > max ? r.fetchedAt : max),
          rows[0]?.fetchedAt ?? today
        )
      : null;

  return {
    location: location.label,
    updatedAt,
    grassForecast,
    calendar: pollenCalendarForMonth(santiagoMonth()),
    provenance: {
      grass: rows.length > 0 ? "live" : "unavailable",
      treeWeed: "calendar",
    },
  };
}
