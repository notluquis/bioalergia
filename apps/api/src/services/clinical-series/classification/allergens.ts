import { joinClinicalText } from "../../../lib/clinical-text.ts";

import type { SubcutaneousAllergenType, SubcutaneousVaccineProduct } from "../types.ts";

const ACAROS_PATTERN = /\b[áa]caros?\b/i;
const GRAMINEAS_PATTERN = /\bgram[íi]neas?\b/i;

/**
 * Scan all events in a series to determine which allergen(s) are
 * treated. When no specific allergen keyword is found the treatment
 * defaults to ACAROS_GRAMINEAS because the clinic refers to the
 * combined product as plain "clustoid" (without qualification).
 */
export function inferAllergenType(
  events: Array<{ description: null | string; summary: null | string }>
): SubcutaneousAllergenType {
  let hasAcaros = false;
  let hasGramineas = false;

  for (const event of events) {
    const text = joinClinicalText(event.summary, event.description);
    if (!hasAcaros && ACAROS_PATTERN.test(text)) hasAcaros = true;
    if (!hasGramineas && GRAMINEAS_PATTERN.test(text)) hasGramineas = true;
    if (hasAcaros && hasGramineas) break;
  }

  if (hasAcaros && hasGramineas) return "ACAROS_GRAMINEAS";
  if (hasAcaros) return "ACAROS";
  if (hasGramineas) return "GRAMINEAS";
  // Default: plain "clustoid" without allergen qualifier = combined treatment
  return "ACAROS_GRAMINEAS";
}

// Vaccine product — Cluxin and Clustek are trade names for Clustoid.
// Forte and B120 are concentration variants of the same base product.
const ORAL_TEC_PATTERN = /oral[\s-]?tec/i;
const ALXOID_PATTERN = /\balxoid\b/i;
const CLUSTOID_BASE_PATTERN = /cl[au]s[i]?t[oau]?id[eo]?|cluxin|clustek|clutoid|\bclust/i;
const CLUSTOID_FORTE_PATTERN = /\bforte\b/i;
const CLUSTOID_B120_PATTERN = /\bb[\s-]?120\b/i;

export function inferVaccineProduct(
  events: Array<{ description: null | string; summary: null | string }>
): null | SubcutaneousVaccineProduct {
  let hasOralTec = false;
  let hasAlxoid = false;
  let hasClustoid = false;
  let hasForte = false;
  let hasB120 = false;

  for (const event of events) {
    const text = joinClinicalText(event.summary, event.description);
    if (!hasOralTec && ORAL_TEC_PATTERN.test(text)) hasOralTec = true;
    if (!hasAlxoid && ALXOID_PATTERN.test(text)) hasAlxoid = true;
    if (!hasClustoid && CLUSTOID_BASE_PATTERN.test(text)) hasClustoid = true;
    if (hasClustoid && !hasForte && CLUSTOID_FORTE_PATTERN.test(text)) hasForte = true;
    if (hasClustoid && !hasB120 && CLUSTOID_B120_PATTERN.test(text)) hasB120 = true;
  }

  if (hasOralTec) return "ORAL_TEC";
  if (hasAlxoid) return "ALXOID";
  if (hasClustoid) {
    if (hasForte) return "CLUSTOID_FORTE";
    if (hasB120) return "CLUSTOID_B120";
    return "CLUSTOID";
  }
  return null;
}
