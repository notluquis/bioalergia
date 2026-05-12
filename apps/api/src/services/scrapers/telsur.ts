// Telsur / GTD scraper post-login.
// Portal: https://sucursalvirtual.telsur.cl
// Auth: RUT + serie ID
//
// TODO implementación real:
//   1. POST login a sucursalvirtual.telsur.cl con credentials
//   2. Capturar cookies de sesión
//   3. GET /consulta-boletas?rut=X → parsea HTML/JSON
//   4. Return ScraperBillResult
//
// Lucas: necesito que abras DevTools en el portal, vayas a Network tab,
// loguées, navegues a "consulta boletas", y me pases el curl exacto que
// genera el browser. Con eso completo este scraper sin guess.

import type { ScraperBillResult, ScraperContext } from "./types";

export async function fetchTelsurBill(_ctx: ScraperContext): Promise<ScraperBillResult> {
  throw new Error(
    "TELSUR scraper not implemented. Lucas debe pegar curl observado del portal sucursalvirtual.telsur.cl"
  );
}
