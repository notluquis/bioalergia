import { describe, expect, it } from "vitest";
import { extractPatientHints } from "../clinical-series";

describe("clinical series patient-name cleaning", () => {
  it("strips administrative prefixes from the inferred patient name", () => {
    const cases = [
      ["envio de alyson gajardo arriagada", "alyson gajardo arriagada"],
      ["toca arantxa emilia magdalena ruiz etchepare", "arantxa emilia magdalena ruiz etchepare"],
      ["confirm emilio sabath saez", "emilio sabath saez"],
      ["ultima daniel escobar romero", "daniel escobar romero"],
      ["confirmado andres contreras gonzalez", "andres contreras gonzalez"],
      ["incluir huevos julian alonzo echeverria roa", "julian alonzo echeverria roa"],
      ["ovo y nativos luciano robles orellana", "luciano robles orellana"],
      ["quiere de standard cinthya silva mendez", "cinthya silva mendez"],
      ["licencia amelia iturra escobar", "amelia iturra escobar"],
      ["aca maite contreras parada", "maite contreras parada"],
      ["mayo emilia catalina cifuentes villar", "emilia catalina cifuentes villar"],
      ["confirmocarlos joaquin varela chavez", "carlos joaquin varela chavez"],
    ] as const;

    for (const [summary, expectedName] of cases) {
      const result = extractPatientHints(summary, null);
      expect(result.patientName).toBe(expectedName);
    }
  });
});
