import { joinClinicalText } from "../../../lib/clinical-text.ts";

import type { DeliveryModality } from "../types.ts";

// Delivery modality — domicilio if any event was sent/picked up;
// otherwise presencial.
const DOMICILIO_DELIVERY_PATTERN =
  /\bdomicilio\b|\bse\s+envi[oó]\b|\bse\s+la?\s+llev[oó]\b|\bse\s+lo\s+llev[oó]\b|\bretira\b|\benviar\b|\bdespacho\b/i;

export function inferDeliveryModality(
  events: Array<{ description: null | string; summary: null | string }>
): DeliveryModality {
  for (const event of events) {
    const text = joinClinicalText(event.summary, event.description);
    if (DOMICILIO_DELIVERY_PATTERN.test(text)) return "DOMICILIO";
  }
  return "PRESENCIAL";
}
