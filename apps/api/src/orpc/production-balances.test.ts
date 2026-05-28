import { productionBalanceItemSchema } from "@finanzas/orpc-contracts/production-balances";
import { describe, expect, it } from "vitest";

import { mapProductionBalanceResponse } from "./production-balances.ts";

// Regression guard for the prod bug where the handler returned `date: Date`
// (the raw `@db.Date` value from pg) but the contract field is `z.string()`.
// oRPC `.output()` validation rejected it with "Output validation failed"
// → 500 after a successful INSERT → every retry then hit
// `daily_production_balances_balance_date_key` (23505). The roundtrip test
// fixes the contract as the source of truth: feed `mapProductionBalanceResponse`
// the row shape the service returns (Date for balanceDate, Date for
// createdAt/updatedAt) and assert the contract schema parses it cleanly.

const sampleRow = {
  balanceDate: new Date("2026-05-27T00:00:00.000Z"),
  changeReason: null,
  comentarios: "Día normal",
  consultasMonto: 120_000,
  controlesMonto: 0,
  createdAt: new Date("2026-05-27T15:30:00.000Z"),
  gastosDiarios: 5_000,
  id: 42,
  ingresoEfectivo: 30_000,
  ingresoTarjetas: 50_000,
  ingresoTransferencias: 25_000,
  licenciasMonto: 0,
  otrosAbonos: 2_000,
  roxairMonto: 0,
  status: "DRAFT",
  testsMonto: 80_000,
  updatedAt: new Date("2026-05-27T15:31:00.000Z"),
  user: { person: { email: "ops@bioalergia.cl" } },
  vacunasMonto: 0,
};

describe("mapProductionBalanceResponse → contract roundtrip", () => {
  it("formats balanceDate (Date) to a YYYY-MM-DD string the contract accepts", () => {
    const mapped = mapProductionBalanceResponse(sampleRow);
    expect(mapped.date).toBe("2026-05-27");
    // Parse through the actual contract schema — this is what oRPC .output()
    // runs in prod. Any drift between mapper and contract fails here.
    const parsed = productionBalanceItemSchema.safeParse(mapped);
    expect(parsed.success).toBe(true);
  });

  it("computes derived totals", () => {
    const m = mapProductionBalanceResponse(sampleRow);
    // 50000 + 25000 + 30000 = 105000
    expect(m.subtotalIngresos).toBe(105_000);
    // 105000 - 5000 = 100000
    expect(m.totalIngresos).toBe(100_000);
    // 100000 + 2000 = 102000
    expect(m.total).toBe(102_000);
  });

  it("falls back to null createdByEmail when no user.person.email", () => {
    const m = mapProductionBalanceResponse({ ...sampleRow, user: null });
    expect(m.createdByEmail).toBeNull();
    expect(productionBalanceItemSchema.safeParse(m).success).toBe(true);
  });
});
