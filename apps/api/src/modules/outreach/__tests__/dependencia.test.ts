import { describe, expect, it } from "vitest";
import { mapDependencia } from "../dependencia.ts";

describe("mapDependencia", () => {
  it("maps code '1' to MUNICIPAL", () => {
    expect(mapDependencia("1")).toBe("MUNICIPAL");
  });

  it("maps code '2' to PARTICULAR_SUBVENCIONADO", () => {
    expect(mapDependencia("2")).toBe("PARTICULAR_SUBVENCIONADO");
  });

  it("maps code '3' to PARTICULAR_PAGADO", () => {
    expect(mapDependencia("3")).toBe("PARTICULAR_PAGADO");
  });

  it("maps code '4' to SLEP", () => {
    expect(mapDependencia("4")).toBe("SLEP");
  });

  it("maps code '5' to CORPORACION_MUNICIPAL", () => {
    expect(mapDependencia("5")).toBe("CORPORACION_MUNICIPAL");
  });

  it("returns OTRO for unknown codes", () => {
    expect(mapDependencia("9")).toBe("OTRO");
    expect(mapDependencia("")).toBe("OTRO");
    expect(mapDependencia(null)).toBe("OTRO");
    expect(mapDependencia(undefined)).toBe("OTRO");
  });

  it("accepts numeric code as number", () => {
    expect(mapDependencia(1)).toBe("MUNICIPAL");
    expect(mapDependencia(3)).toBe("PARTICULAR_PAGADO");
  });
});
