import { describe, expect, it, vi } from "vitest";

vi.mock("@finanzas/db", () => ({ db: {} }));

const { parseProductionBalanceRows, parseSpanishLongDate } =
  await import("./production-balance-import.ts");

describe("parseSpanishLongDate", () => {
  it("parses Google Sheets long format without 'de'", () => {
    expect(parseSpanishLongDate("martes, 28 enero 2025")).toBe("2025-01-28");
  });

  it("parses long format with 'de' and accents", () => {
    expect(parseSpanishLongDate("miércoles, 29 de enero de 2025")).toBe("2025-01-29");
    expect(parseSpanishLongDate("sábado, 1 de septiembre de 2025")).toBe("2025-09-01");
  });

  it("rejects non-date strings and unknown months", () => {
    expect(parseSpanishLongDate("28-01-2025")).toBeNull();
    expect(parseSpanishLongDate("martes, 28 enero")).toBeNull();
    expect(parseSpanishLongDate("martes, 28 eneroo 2025")).toBeNull();
  });
});

describe("parseProductionBalanceRows", () => {
  it("parses CLP money strings and Spanish dates", () => {
    const { errors, validRows } = parseProductionBalanceRows([
      {
        balanceDate: "martes, 28 enero 2025",
        comentarios: "",
        consultasMonto: "$0",
        ingresoEfectivo: "$70.000",
        ingresoTarjetas: "$75.000",
        ingresoTransferencias: "$320.000",
      },
    ]);
    expect(errors).toEqual([]);
    expect(validRows).toHaveLength(1);
    const row = validRows[0];
    expect(row?.dateKey).toBe("2025-01-28");
    expect(row?.ingresoTarjetas).toBe(75_000);
    expect(row?.ingresoTransferencias).toBe(320_000);
    expect(row?.ingresoEfectivo).toBe(70_000);
    // Campos no mapeados en el CSV quedan en 0, no null.
    expect(row?.gastosDiarios).toBe(0);
    expect(row?.comentarios).toBeNull();
  });

  it("accepts plain ISO dates too", () => {
    const { errors, validRows } = parseProductionBalanceRows([
      { balanceDate: "2026-01-07", ingresoTarjetas: "1000" },
    ]);
    expect(errors).toEqual([]);
    expect(validRows[0]?.dateKey).toBe("2026-01-07");
  });

  it("silently skips fully-empty rows (trailing sheet rows arrive as {})", () => {
    const { emptyRows, errors, validRows } = parseProductionBalanceRows([
      {},
      { balanceDate: "" },
      { balanceDate: "2026-01-07", ingresoTarjetas: "1000" },
    ]);
    expect(errors).toEqual([]);
    expect(emptyRows).toBe(2);
    expect(validRows).toHaveLength(1);
  });

  it("still errors when a row has data but no valid date", () => {
    const { errors } = parseProductionBalanceRows([{ balanceDate: "", ingresoTarjetas: "1000" }]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("balanceDate inválida");
  });

  it("skips all-zero template rows without comment", () => {
    const { emptyRows, errors, validRows } = parseProductionBalanceRows([
      { balanceDate: "jueves, 20 agosto 2026" },
      { balanceDate: "2026-08-21", comentarios: "cerrado por feriado" },
    ]);
    expect(errors).toEqual([]);
    expect(emptyRows).toBe(1);
    // Fila $0 con comentario sí se conserva.
    expect(validRows).toHaveLength(1);
    expect(validRows[0]?.comentarios).toBe("cerrado por feriado");
  });

  it("flags invalid dates and in-file duplicates", () => {
    const { errors, validRows } = parseProductionBalanceRows([
      { balanceDate: "no es fecha" },
      { balanceDate: "2026-01-07", ingresoTarjetas: "1000" },
      { balanceDate: "martes, 7 enero 2026", ingresoTarjetas: "2000" },
    ]);
    expect(validRows).toHaveLength(1);
    expect(errors).toHaveLength(2);
    expect(errors[0]).toContain("balanceDate inválida");
    expect(errors[1]).toContain("duplicada");
  });
});
