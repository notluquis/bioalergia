// Medipass (ex-IMED) scraper portal prestador.
// Portal: https://www.medipass.cl
//
// Misma observación que Doctoralia: las facturas Medipass llegan por DTE.
// DTE matcher las detecta auto si counterpart_id Medipass está linkeado al
// ExpenseService Medipass.

import type { ScraperBillResult, ScraperContext } from "./types";

export async function fetchMedipassBill(_ctx: ScraperContext): Promise<ScraperBillResult> {
  throw new Error(
    "MEDIPASS scraper not implemented. Preferí DTE matcher (auto-detect via SII feed)"
  );
}
