import { describe, expect, it } from "vitest";
import {
  getSIIMappingsForTable,
  matchSIIHeader,
  normalizeColumnHeader,
  SII_COMPRAS_MAPPINGS,
  SII_VENTAS_MAPPINGS,
} from "../sii-mappings";

describe("getSIIMappingsForTable", () => {
  it("returns compras mappings for dte_purchases", () => {
    expect(getSIIMappingsForTable("dte_purchases")).toBe(SII_COMPRAS_MAPPINGS);
  });

  it("returns ventas mappings for dte_sales", () => {
    expect(getSIIMappingsForTable("dte_sales")).toBe(SII_VENTAS_MAPPINGS);
  });

  it("returns null for unknown table", () => {
    expect(getSIIMappingsForTable("dte_other")).toBeNull();
    expect(getSIIMappingsForTable("")).toBeNull();
  });
});

describe("normalizeColumnHeader", () => {
  it("lowercases and trims", () => {
    expect(normalizeColumnHeader("  Folio  ")).toBe("folio");
  });

  it("normalizes multiple spaces", () => {
    expect(normalizeColumnHeader("Monto  Total")).toBe("monto total");
  });

  it("removes special characters except accented letters", () => {
    expect(normalizeColumnHeader("Nº")).toBe("n");
    expect(normalizeColumnHeader("Razón Social")).toBe("razón social");
  });
});

describe("matchSIIHeader", () => {
  it("direct match takes priority", () => {
    expect(matchSIIHeader("Folio", SII_COMPRAS_MAPPINGS)).toBe("folio");
  });

  it("fuzzy match with normalization", () => {
    expect(matchSIIHeader("monto total", SII_COMPRAS_MAPPINGS)).toBe("totalAmount");
  });

  it("matches ventas headers", () => {
    expect(matchSIIHeader("RUT Cliente", SII_VENTAS_MAPPINGS)).toBe("clientRUT");
  });

  it("returns undefined for no match", () => {
    expect(matchSIIHeader("Columna Desconocida", SII_COMPRAS_MAPPINGS)).toBeUndefined();
  });

  it("handles leading-space SII headers (recoverableIVA)", () => {
    expect(matchSIIHeader("Monto IVA Recuperable", SII_COMPRAS_MAPPINGS)).toBe("recoverableIVA");
  });
});
