// Isapre MasVida scraper portal beneficiario.
// Estado real Excel: cancelada desde 2025-08. El ExpenseService Isapre
// quedó endDate=2025-08-31 isActive=false. Scraper queda preparado por si
// alguien retoma plan en futuro.

import type { ScraperBillResult, ScraperContext } from "./types";

export async function fetchMasvidaBill(_ctx: ScraperContext): Promise<ScraperBillResult> {
  throw new Error(
    "MASVIDA scraper not implemented. Plan cancelado desde 2025-08; reactivar si retoma."
  );
}
