import { describe, expect, it } from "vitest";
import { calculateSummary, formatDateFull, formatSaveTime, getDayAbbrev } from "./utils";

// ─── calculateSummary ─────────────────────────────────────────────────────────

describe("calculateSummary", () => {
  const baseData = {
    consultas: 0,
    controles: 0,
    efectivo: 0,
    gastos: 0,
    licencias: 0,
    otros: 0,
    roxair: 0,
    tarjeta: 0,
    tests: 0,
    transferencia: 0,
    vacunas: 0,
  };

  it("returns cuadra=true when totals balance", () => {
    const result = calculateSummary({
      ...baseData,
      consultas: 100,
      tarjeta: 100,
    });
    expect(result.cuadra).toBe(true);
    expect(result.diferencia).toBe(0);
  });

  it("returns cuadra=false when totals do not balance", () => {
    const result = calculateSummary({
      ...baseData,
      consultas: 100,
      tarjeta: 80,
    });
    expect(result.cuadra).toBe(false);
    expect(result.diferencia).toBe(-20);
  });

  it("sums all payment methods into totalMetodos", () => {
    const result = calculateSummary({
      ...baseData,
      tarjeta: 50,
      transferencia: 30,
      efectivo: 20,
    });
    expect(result.totalMetodos).toBe(100);
  });

  it("sums all services into totalServicios", () => {
    const result = calculateSummary({
      ...baseData,
      consultas: 10,
      controles: 20,
      tests: 5,
      vacunas: 15,
      licencias: 5,
      roxair: 10,
      otros: 5,
    });
    expect(result.totalServicios).toBe(70);
  });

  it("passes gastos through unchanged", () => {
    const result = calculateSummary({ ...baseData, gastos: 500 });
    expect(result.gastos).toBe(500);
  });

  it("returns zero diferencia for all-zero input", () => {
    const result = calculateSummary(baseData);
    expect(result.diferencia).toBe(0);
    expect(result.cuadra).toBe(true);
  });

  it("handles large values correctly", () => {
    const result = calculateSummary({
      ...baseData,
      consultas: 1_000_000,
      tarjeta: 1_000_000,
    });
    expect(result.cuadra).toBe(true);
    expect(result.totalServicios).toBe(1_000_000);
    expect(result.totalMetodos).toBe(1_000_000);
  });

  it("diferencia is positive when metodos exceed servicios", () => {
    const result = calculateSummary({
      ...baseData,
      tarjeta: 200,
      consultas: 100,
    });
    expect(result.diferencia).toBe(100);
  });
});

// ─── formatDateFull ───────────────────────────────────────────────────────────

describe("formatDateFull", () => {
  it("returns a non-empty string", () => {
    const result = formatDateFull(new Date(2026, 0, 10)); // Sat Jan 10 2026
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
  });

  it("includes the year", () => {
    const result = formatDateFull(new Date(2026, 0, 10));
    expect(result).toContain("2026");
  });

  it("includes the day number", () => {
    const result = formatDateFull(new Date(2026, 0, 10));
    expect(result).toContain("10");
  });
});

// ─── formatSaveTime ───────────────────────────────────────────────────────────

describe("formatSaveTime", () => {
  it("returns 'ahora' for very recent date (within 5 seconds)", () => {
    const now = new Date();
    expect(formatSaveTime(now)).toBe("ahora");
  });

  it("returns seconds format for dates < 1 minute ago", () => {
    const date = new Date(Date.now() - 30_000); // 30 seconds ago
    expect(formatSaveTime(date)).toBe("30s");
  });

  it("returns minutes format for dates < 1 hour ago", () => {
    const date = new Date(Date.now() - 5 * 60_000); // 5 minutes ago
    expect(formatSaveTime(date)).toBe("5m");
  });

  it("returns hours format for dates >= 1 hour ago", () => {
    const date = new Date(Date.now() - 2 * 3_600_000); // 2 hours ago
    expect(formatSaveTime(date)).toBe("2h");
  });
});

// ─── getDayAbbrev ─────────────────────────────────────────────────────────────

describe("getDayAbbrev", () => {
  it("returns D for Sunday (day 0)", () => {
    // Jan 4, 2026 is a Sunday
    expect(getDayAbbrev(new Date(2026, 0, 4))).toBe("D");
  });

  it("returns L for Monday (day 1)", () => {
    // Jan 5, 2026 is a Monday
    expect(getDayAbbrev(new Date(2026, 0, 5))).toBe("L");
  });

  it("returns M for Tuesday (day 2)", () => {
    expect(getDayAbbrev(new Date(2026, 0, 6))).toBe("M");
  });

  it("returns X for Wednesday (day 3)", () => {
    expect(getDayAbbrev(new Date(2026, 0, 7))).toBe("X");
  });

  it("returns J for Thursday (day 4)", () => {
    expect(getDayAbbrev(new Date(2026, 0, 8))).toBe("J");
  });

  it("returns V for Friday (day 5)", () => {
    expect(getDayAbbrev(new Date(2026, 0, 9))).toBe("V");
  });

  it("returns S for Saturday (day 6)", () => {
    expect(getDayAbbrev(new Date(2026, 0, 10))).toBe("S");
  });
});
