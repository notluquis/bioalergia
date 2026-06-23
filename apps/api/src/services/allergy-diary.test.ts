import { describe, expect, it, vi } from "vitest";

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    allergyDiaryEntry: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
  };
  return { mockDb };
});

vi.mock("@finanzas/db", () => ({ db: mockDb }));

import { computeDMS, computeDSS, computeScores, seasonAggregate } from "./allergy-diary.ts";

const SYMPTOMS_MAX = {
  sneezing: 3,
  rhinorrhea: 3,
  nasalItching: 3,
  nasalCongestion: 3,
  eyeItchingRedness: 3,
  eyeWatering: 3,
};
const SYMPTOMS_ZERO = {
  sneezing: 0,
  rhinorrhea: 0,
  nasalItching: 0,
  nasalCongestion: 0,
  eyeItchingRedness: 0,
  eyeWatering: 0,
};

describe("computeDSS — Σ6 síntomas / 6 → 0–3", () => {
  it("todos 0 → 0", () => {
    expect(computeDSS(SYMPTOMS_ZERO)).toBe(0);
  });
  it("todos 3 (suma cruda 18) → 3 (normalizado, NO 18)", () => {
    expect(computeDSS(SYMPTOMS_MAX)).toBe(3);
  });
  it("mixto: 1+2+0+3+1+2 = 9 → 1.5", () => {
    expect(
      computeDSS({
        sneezing: 1,
        rhinorrhea: 2,
        nasalItching: 0,
        nasalCongestion: 3,
        eyeItchingRedness: 1,
        eyeWatering: 2,
      })
    ).toBe(1.5);
  });
});

describe("computeDMS — mayor escalón (no aditivo)", () => {
  it("nada → 0", () => {
    expect(
      computeDMS({ medAntihistamine: false, medIntranasalSteroid: false, medOralSteroid: false })
    ).toBe(0);
  });
  it("solo antihistamínico → 1", () => {
    expect(
      computeDMS({ medAntihistamine: true, medIntranasalSteroid: false, medOralSteroid: false })
    ).toBe(1);
  });
  it("intranasal → 2", () => {
    expect(
      computeDMS({ medAntihistamine: false, medIntranasalSteroid: true, medOralSteroid: false })
    ).toBe(2);
  });
  it("oral gana aunque haya antiH + intranasal (NO suma) → 3", () => {
    expect(
      computeDMS({ medAntihistamine: true, medIntranasalSteroid: true, medOralSteroid: true })
    ).toBe(3);
  });
});

describe("computeScores — CSMS = dSS + dMS → 0–6", () => {
  it("máximo: dSS 3 + dMS 3 → 6", () => {
    expect(
      computeScores({
        ...SYMPTOMS_MAX,
        medAntihistamine: false,
        medIntranasalSteroid: false,
        medOralSteroid: true,
      })
    ).toEqual({ dSS: 3, dMS: 3, csms: 6 });
  });
  it("mínimo → 0", () => {
    expect(
      computeScores({
        ...SYMPTOMS_ZERO,
        medAntihistamine: false,
        medIntranasalSteroid: false,
        medOralSteroid: false,
      })
    ).toEqual({ dSS: 0, dMS: 0, csms: 0 });
  });
});

describe("seasonAggregate — promedios sobre días registrados, faltantes NO imputados", () => {
  it("ventana 10 días, 8 registrados → completionRate 0.8, válida; promedios solo sobre registrados", async () => {
    // 8 entradas con csms variados; el promedio divide por 8, NO por 10.
    mockDb.allergyDiaryEntry.findMany.mockResolvedValueOnce(
      Array.from({ length: 8 }, () => ({ dSS: 1, dMS: 1, csms: 2 }))
    );
    const out = await seasonAggregate({
      patientId: 1,
      seasonStart: new Date("2026-01-01T00:00:00.000Z"),
      seasonEnd: new Date("2026-01-10T00:00:00.000Z"),
    });
    expect(out.windowDays).toBe(10);
    expect(out.recordedDays).toBe(8);
    expect(out.completionRate).toBe(0.8);
    expect(out.isValidSeason).toBe(true);
    expect(out.avgCsms).toBe(2);
    expect(out.avgDSS).toBe(1);
  });

  it("7 de 10 registrados → 0.7, NO válida (< 0.80)", async () => {
    mockDb.allergyDiaryEntry.findMany.mockResolvedValueOnce(
      Array.from({ length: 7 }, () => ({ dSS: 0, dMS: 0, csms: 0 }))
    );
    const out = await seasonAggregate({
      patientId: 1,
      seasonStart: new Date("2026-01-01T00:00:00.000Z"),
      seasonEnd: new Date("2026-01-10T00:00:00.000Z"),
    });
    expect(out.completionRate).toBe(0.7);
    expect(out.isValidSeason).toBe(false);
  });

  it("0 registrados → promedios null, no divide por cero", async () => {
    mockDb.allergyDiaryEntry.findMany.mockResolvedValueOnce([]);
    const out = await seasonAggregate({
      patientId: 1,
      seasonStart: new Date("2026-01-01T00:00:00.000Z"),
      seasonEnd: new Date("2026-01-10T00:00:00.000Z"),
    });
    expect(out.recordedDays).toBe(0);
    expect(out.avgCsms).toBeNull();
    expect(out.completionRate).toBe(0);
    expect(out.isValidSeason).toBe(false);
  });
});
