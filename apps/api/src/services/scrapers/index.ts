// Dispatcher: provider → scraper function.
// Llamado por refreshUtilityAccount cuando provider ≠ CGE/ESSBIO (que tienen
// implementación directa en utility-bills.ts).

import type { ScraperBillResult, ScraperContext } from "./types";
import { fetchDoctoraliaBill } from "./doctoralia";
import { fetchMasvidaBill } from "./masvida";
import { fetchMedipassBill } from "./medipass";
import { fetchMovistarBill } from "./movistar";
import { fetchPreviredBill } from "./previred";
import { fetchTelsurBill } from "./telsur";

export type ScraperProvider =
  | "DOCTORALIA"
  | "MASVIDA"
  | "MEDIPASS"
  | "MOVISTAR"
  | "PREVIRED"
  | "TELSUR";

export async function fetchProviderBill(
  provider: ScraperProvider,
  ctx: ScraperContext
): Promise<ScraperBillResult> {
  switch (provider) {
    case "DOCTORALIA":
      return fetchDoctoraliaBill(ctx);
    case "MASVIDA":
      return fetchMasvidaBill(ctx);
    case "MEDIPASS":
      return fetchMedipassBill(ctx);
    case "MOVISTAR":
      return fetchMovistarBill(ctx);
    case "PREVIRED":
      return fetchPreviredBill(ctx);
    case "TELSUR":
      return fetchTelsurBill(ctx);
    default: {
      const _exhaustive: never = provider;
      throw new Error(`No scraper for provider: ${String(_exhaustive)}`);
    }
  }
}

export type { ScraperBillResult, ScraperContext } from "./types";
