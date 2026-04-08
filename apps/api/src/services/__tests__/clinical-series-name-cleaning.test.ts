import { describe, expect, it } from "vitest";
import { extractPatientHints } from "../clinical-series";

describe("clinical series patient-name cleaning", () => {
  it("strips administrative prefixes from the inferred patient name", () => {
    const cases = [
      ["envio de alyson gajardo arriagada", "alyson gajardo arriagada"],
      ["toca arantxa emilia magdalena ruiz etchepare", "arantxa emilia magdalena ruiz etchepare"],
      ["confirm emilio sabath saez", "emilio sabath saez"],
      ["llegop Emilio Sabath Saez, vacuna de clustoid (50)", "emilio sabath saez"],
      ["ultima daniel escobar romero", "daniel escobar romero"],
      [
        "no vino confirma, vacuna Clustoid mantención (50), Daniel Escobar, Hualpén, 995936864",
        "daniel escobar",
      ],
      ["confirmado andres contreras gonzalez", "andres contreras gonzalez"],
      ["incluir huevos julian alonzo echeverria roa", "julian alonzo echeverria roa"],
      ["ovo y nativos luciano robles orellana", "luciano robles orellana"],
      ["quiere de standard cinthya silva mendez", "cinthya silva mendez"],
      ["licencia amelia iturra escobar", "amelia iturra escobar"],
      ["aca maite contreras parada", "maite contreras parada"],
      ["mayo emilia catalina cifuentes villar", "emilia catalina cifuentes villar"],
      [
        "se lleva vacuna de mayo , vacuna acaros (pagado 50) Emilia Catalina Cifuentes Villar, 13 años, rut: 23.570.892-2, mamá Dámaris Villar Castro, Los Álamos, Colmena, 957588167",
        "emilia catalina cifuentes villar",
      ],
      [
        "ENVIAR VACUNA DIA LUNES 25 Vac. Gramínea 0,5ml (50), Alyson Gajardo Arriagada, 27 años, Huépil, Fonasa, 967355087",
        "alyson gajardo arriagada",
      ],
      [
        "15.48, vacuna clustoid (tiene que pagar en la prox vacuna octubre) Arantxa Emilia Magdalena Ruiz Etchepare, 23 años, Rut: 20.257.932-9, Concepción, Isapre Consalud,962476246",
        "arantxa emilia magdalena ruiz etchepare",
      ],
      [
        "14:56 CONFIRMA, 2 dosis vacuna clustoid (35 no se le hizo la primera boleta) Arantxa Emilia Magdalena Ruiz Etchepare, 23 años, Rut: 20.257.932-9, Concepción, Isapre Consalud,962476246",
        "arantxa emilia magdalena ruiz etchepare",
      ],
      [
        "11.10 vacuna de clustoid (50), Emilio Sabath Saez, 9 años, Concepcion, Fonasa 990135760 (papá Gonzalo Sabath Saldivia)",
        "emilio sabath saez",
      ],
      ["confirmocarlos joaquin varela chavez", "carlos joaquin varela chavez"],
    ] as const;

    for (const [summary, expectedName] of cases) {
      const result = extractPatientHints(summary, null);
      expect(result.patientName).toBe(expectedName);
    }
  });
});
