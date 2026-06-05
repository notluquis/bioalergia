import jaroWinkler from "talisman/metrics/jaro-winkler.js";

import { joinClinicalText } from "../../../lib/clinical-text.ts";
import { dbDateToISO } from "../../../lib/time.ts";
import type { HealthInsuranceType, InsuranceEventLike, InsuranceResolution } from "../types.ts";

// Health insurance — detect from descriptions using a normalized/fuzzy
// pass so secretary notes with separators, casing differences, and
// mild typos still map to FONASA / ISAPRE / PARTICULAR reliably.
const FONASA_PATTERN = /\bfonasa\b/i;
const PARTICULAR_PATTERN = /\bparticular\b/i;
const ISAPRE_PROVIDER_CANDIDATES = [
  { aliases: ["banmedica", "banmedica sa"], providerName: "Banmédica" },
  { aliases: ["isalud", "isapre decodelco", "decodelco", "codelco"], providerName: "Isalud" },
  { aliases: ["colmena", "golden cross", "colmena golden cross"], providerName: "Colmena" },
  { aliases: ["consalud"], providerName: "Consalud" },
  { aliases: ["cruz blanca", "cruzblanca"], providerName: "Cruz Blanca" },
  { aliases: ["cruz del norte", "cruzdelnorte"], providerName: "Cruz del Norte" },
  { aliases: ["nueva masvida", "nuevamasvida", "masvida"], providerName: "Nueva Masvida" },
  { aliases: ["fundacion", "isapre fundacion"], providerName: "Fundación" },
  { aliases: ["vida tres", "vidatres"], providerName: "Vida Tres" },
  { aliases: ["esencial", "somos esencial"], providerName: "Esencial" },
] as const;

function normalizeForInsuranceMatch(value: string): string {
  // Local clone of `normalizeName` from the name-normalization module
  // (kept local to avoid circular deps until that module is extracted).
  return value
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function textContainsNormalizedAlias(text: string, alias: string): boolean {
  const compactText = text.replace(/\s+/g, "");
  const compactAlias = alias.replace(/\s+/g, "");
  return text.includes(alias) || compactText.includes(compactAlias);
}

function findIsapreProvider(text: string): null | string {
  const tokens = text.split(" ").filter((token) => token.length >= 4);
  const compactText = text.replace(/\s+/g, "");

  for (const provider of ISAPRE_PROVIDER_CANDIDATES) {
    for (const alias of provider.aliases) {
      if (textContainsNormalizedAlias(text, alias)) return provider.providerName;

      const aliasTokens = alias.split(" ").filter((token) => token.length >= 4);
      if (
        aliasTokens.length > 1 &&
        aliasTokens.every((aliasToken) =>
          tokens.some((token) => jaroWinkler(token, aliasToken) >= 0.92)
        )
      ) {
        return provider.providerName;
      }

      const compactAlias = alias.replace(/\s+/g, "");
      if (compactAlias.length >= 6 && jaroWinkler(compactText, compactAlias) >= 0.9) {
        return provider.providerName;
      }
      if (tokens.some((token) => jaroWinkler(token, compactAlias) >= 0.9)) {
        return provider.providerName;
      }
    }
  }

  return null;
}

function inferInsuranceFromEventText(
  summary: null | string,
  description: null | string
): InsuranceResolution {
  const text = joinClinicalText(summary, description);
  const normalizedText = normalizeForInsuranceMatch(text);
  if (!normalizedText) return { healthInsurance: null, isapreName: null };
  if (FONASA_PATTERN.test(text)) return { healthInsurance: "FONASA", isapreName: null };
  if (PARTICULAR_PATTERN.test(text)) return { healthInsurance: "PARTICULAR", isapreName: null };

  const isapreName = findIsapreProvider(normalizedText);
  if (normalizedText.includes("isapre") || isapreName) {
    return { healthInsurance: "ISAPRE", isapreName };
  }

  return { healthInsurance: null, isapreName: null };
}

function resolveInsuranceEventSortKey(event: InsuranceEventLike): string {
  if (event.eventDate) return `${event.eventDate}T23:59:59`;
  // startDateTime is a real instant; startDate is @db.Date (end-of-day key,
  // dbDateToISO avoids the .tz() rollback, matching the eventDate-branch form).
  if (event.startDateTime) return new Date(event.startDateTime).toISOString();
  if (event.startDate) return `${dbDateToISO(event.startDate)}T23:59:59`;
  return "0000-00-00T00:00:00.000Z";
}

export function inferHealthInsurance(events: InsuranceEventLike[]): InsuranceResolution {
  const recentEvents = [...events]
    .sort((a, b) => {
      const keyCompare = resolveInsuranceEventSortKey(b).localeCompare(
        resolveInsuranceEventSortKey(a)
      );
      if (keyCompare !== 0) return keyCompare;
      return (b.eventId ?? b.id ?? 0) - (a.eventId ?? a.id ?? 0);
    })
    .slice(0, 3);

  const eventSignals = recentEvents
    .map((event) => inferInsuranceFromEventText(event.summary, event.description))
    .filter((signal) => signal.healthInsurance != null);

  if (eventSignals.length === 0) {
    return { healthInsurance: null, isapreName: null };
  }

  const counts = new Map<HealthInsuranceType, number>();
  for (const signal of eventSignals) {
    const healthInsurance = signal.healthInsurance;
    if (!healthInsurance) continue;
    counts.set(healthInsurance, (counts.get(healthInsurance) ?? 0) + 1);
  }

  const rankedTypes = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (rankedTypes.length === 0) {
    return { healthInsurance: null, isapreName: null };
  }

  if (rankedTypes.length > 1 && rankedTypes[0][1] === rankedTypes[1][1]) {
    return { healthInsurance: null, isapreName: null };
  }

  const healthInsurance = rankedTypes[0][0];
  if (healthInsurance !== "ISAPRE") {
    return { healthInsurance, isapreName: null };
  }

  const providerCounts = new Map<string, number>();
  for (const signal of eventSignals) {
    if (signal.healthInsurance !== "ISAPRE" || !signal.isapreName) continue;
    providerCounts.set(signal.isapreName, (providerCounts.get(signal.isapreName) ?? 0) + 1);
  }

  const rankedProviders = [...providerCounts.entries()].sort((a, b) => b[1] - a[1]);
  const isapreName =
    rankedProviders.length === 0 ||
    (rankedProviders.length > 1 && rankedProviders[0][1] === rankedProviders[1][1])
      ? null
      : rankedProviders[0][0];

  return { healthInsurance, isapreName };
}
