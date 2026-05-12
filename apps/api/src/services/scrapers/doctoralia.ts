// Doctoralia scraper portal profesional.
// Portal: https://www.doctoralia.cl/pro/login
//
// Alternativa preferida: la mayoría de pagos llegan como DTE compra
// (factura electrónica via SII). El DTE matcher ya las detecta. Este scraper
// es backup si Doctoralia bypassa DTE.
//
// TODO implementación real cuando Lucas pase curl observado.

import type { ScraperBillResult, ScraperContext } from "./types";

export async function fetchDoctoraliaBill(_ctx: ScraperContext): Promise<ScraperBillResult> {
  throw new Error(
    "DOCTORALIA scraper not implemented. Preferí DTE matcher (auto-detect via SII feed)"
  );
}
