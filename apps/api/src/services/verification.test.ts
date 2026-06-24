import { describe, expect, it, vi } from "vitest";

// El service importa `@finanzas/db`; lo mockeamos (no tocamos DB en este test).
// `db.$setOptions` lo exige slices.ts al cargar; incluirlo evita el crash.
vi.mock("@finanzas/db", () => {
  const noopDb = { $setOptions: () => noopDb };
  return { db: noopDb };
});

import { generateVerificationCode } from "./verification.ts";

describe("generateVerificationCode", () => {
  const CODE_RE = /^BA-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;

  it("emite el formato BA-XXXX-XXXX en alfabeto Crockford base32", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateVerificationCode();
      expect(code).toMatch(CODE_RE);
      // Sin caracteres ambiguos I/L/O/U.
      expect(code.slice(3)).not.toMatch(/[ILOU]/);
    }
  });

  it("genera códigos distintos (entropía suficiente)", () => {
    const codes = new Set(Array.from({ length: 500 }, () => generateVerificationCode()));
    // Colisiones en 500 muestras sobre 32^8 son prácticamente imposibles.
    expect(codes.size).toBe(500);
  });
});
