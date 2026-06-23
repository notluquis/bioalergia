import { oc } from "@orpc/contract";
import { z } from "zod";

/**
 * Pronóstico de polen para el widget público /polen (sin auth).
 *
 * `grassForecast` = pronóstico DIARIO en vivo de gramíneas (Google Pollen API;
 * en Chile solo hay datos de gramíneas). `calendar` = fallback estacional
 * CUALITATIVO de gramíneas para cuando el pronóstico en vivo no esté disponible.
 * No publicamos árboles ni malezas: Google no los entrega en Chile y no hay
 * estación local que los mida, así que no existe un dato exacto que mostrar.
 */

export const pollenLevelSchema = z.enum(["nulo", "bajo", "medio", "alto"]);

export const pollenGrassDaySchema = z.object({
  date: z.string(), // YYYY-MM-DD
  upi: z.number().int().nullable(), // Universal Pollen Index 0–5
  category: z.string().nullable(), // "Muy bajo" … "Muy alto" (languageCode=es)
  colorHex: z.string().nullable(),
  inSeason: z.boolean(),
  // Texto humano del índice para ese día (Google `indexInfo.indexDescription`, es).
  indexDescription: z.string().nullable(),
  // Recomendaciones de salud del día para gramíneas (Google `healthRecommendations`, es).
  healthRecommendations: z.array(z.string()),
});

export const pollenCalendarTaxonSchema = z.object({
  type: z.literal("GRASS"),
  label: z.string(),
  level: pollenLevelSchema,
  inSeason: z.boolean(),
  examples: z.array(z.string()),
});

export const pollenForecastResponseSchema = z.object({
  location: z.string(),
  updatedAt: z.coerce.date().nullable(),
  grassForecast: z.array(pollenGrassDaySchema),
  calendar: z.array(pollenCalendarTaxonSchema),
  provenance: z.object({
    grass: z.enum(["live", "unavailable"]),
  }),
});

export const pollenContract = {
  getForecast: oc.route({ method: "GET", path: "/forecast" }).output(pollenForecastResponseSchema),
};

export type PollenContract = typeof pollenContract;
export type PollenForecastResponse = z.infer<typeof pollenForecastResponseSchema>;
export type PollenGrassDay = z.infer<typeof pollenGrassDaySchema>;
export type PollenCalendarTaxon = z.infer<typeof pollenCalendarTaxonSchema>;
export type PollenLevel = z.infer<typeof pollenLevelSchema>;
