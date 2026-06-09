import { describe, expect, it } from "vitest";
import { buildFolio } from "./folio.ts";

describe("buildFolio", () => {
  it("formats RX-AAAA-NNNNNN-XXXX with zero-padded correlativo", () => {
    const folio = buildFolio(123, 2026);
    expect(folio).toMatch(/^RX-2026-000123-[0-9A-Z]{4}$/);
  });

  it("uses Crockford base32 suffix (no I/L/O/U)", () => {
    for (let i = 0; i < 200; i++) {
      const suffix = buildFolio(i, 2026).split("-")[3];
      expect(suffix).toMatch(/^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{4}$/);
      expect(suffix).not.toMatch(/[ILOU]/);
    }
  });

  it("random suffix makes folios non-enumerable (high uniqueness)", () => {
    const suffixes = new Set(
      Array.from({ length: 500 }, () => buildFolio(1, 2026).split("-")[3])
    );
    // 32^4 espacio → 500 muestras casi todas únicas.
    expect(suffixes.size).toBeGreaterThan(480);
  });

  it("pads correlativos over 6 digits without truncating", () => {
    expect(buildFolio(1_234_567, 2026)).toMatch(/^RX-2026-1234567-/);
  });
});
