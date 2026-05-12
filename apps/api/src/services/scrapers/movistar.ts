// Movistar Chile scraper (Mi Movistar Empresas + Hogar).
// Portal: https://ww2.movistar.cl/sucursal-virtual/
// Auth: RUT + clave Mi Movistar
//
// TODO implementación real:
//   1. POST login a ww2.movistar.cl/sucursal-virtual/login (capturar XSRF/csrf si aplica)
//   2. GET /facturacion/boletas → JSON con boletas
//   3. Parsear, normalizar, return
//
// Lucas: pásame curl exacto del portal (DevTools Network) cuando logueado.

import type { ScraperBillResult, ScraperContext } from "./types";

export async function fetchMovistarBill(_ctx: ScraperContext): Promise<ScraperBillResult> {
  throw new Error(
    "MOVISTAR scraper not implemented. Lucas debe pegar curl observado del portal Mi Movistar"
  );
}
