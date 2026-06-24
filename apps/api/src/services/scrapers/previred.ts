// Previred scraper para empresas — descarga planillas + certificados.
// Portal: https://www.previred.com (Empresas)
// Auth: RUT empresa + clave
//
// Endpoints útiles (a confirmar via DevTools):
//   - /wPortal/login/login.jsp (POST credentials)
//   - /portal/empresas/planillas (listar planillas pagadas)
//   - /portal/empresas/certificado (certificado de cotizaciones)
//
// TODO: completar después de credencial Previred Bioalergia configurada.

import type { ScraperBillResult, ScraperContext } from "./types.ts";

export async function fetchPreviredBill(_ctx: ScraperContext): Promise<ScraperBillResult> {
  throw new Error(
    "PREVIRED scraper not implemented. Requiere credencial empresa + curl observado del portal."
  );
}
