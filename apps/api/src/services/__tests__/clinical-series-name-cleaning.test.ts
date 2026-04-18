import { describe, expect, it } from "vitest";
import { extractPatientHints, resolveClinicalIdentity } from "../clinical-series";

type NameCase =
  | readonly [summary: string, expectedName: string]
  | {
      readonly summary: string;
      readonly description: string;
      readonly expectedName: string;
    };

describe("clinical series patient-name cleaning", () => {
  it("strips administrative prefixes from the inferred patient name", () => {
    const cases: readonly NameCase[] = [
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
        "llego,1 dosis mensual debe 10 total a pagar 60.000 dosis clustoid viviana gutierrez sanhueza 963104453 7925268-9",
        "viviana gutierrez sanhueza",
      ],
      [
        "1323 control prox mes confirma vacuna clustoid (50) Romulo Velasquez , 14727301-0, 65 años.spp, isapre, 993427879 / esposa: 983251614",
        "romulo velasquez",
      ],
      [
        "llego Karina Ortiz Osorio (60) dosis mantencion clust a-g 0,5ml 14603947-2 962388428 correo: kortiz2@hotmail.com",
        "karina ortiz osorio",
      ],
      [
        "llego Lucas Torres Diaz (60) 1 dosis clustoid A-P mensual 24.966.813-3 10 años colmena ccp 964959013 adiazfuentes.prev@gmail.com",
        "lucas torres diaz",
      ],
      [
        "no podra asistir Gladys Díaz Figueroa, dosis 8 mensual clustoid (50) 12737050-8 Edad: 49 años Contacto: 949479225 Barbara.aamunoz@gmail.com +56926421700",
        "gladys diaz figueroa",
      ],
      [
        "esta de viaje llamara para reagendar, Marizu Velásquez Flores (60) clustoid 0,5ml pago listo boleta realizada por esta vacuna 14.665.829-6 994432696 marizu.velasquez@gmail.com ccp fonasa",
        "marizu velasquez flores",
      ],
      [
        "dr. suspendio vacuna junio Cristobal Quiroz Mariñao (50) CUARTAdosis clustoid ac 9 años 25.320.867-8 fonasa hualpen 942698769",
        "cristobal quiroz marinao",
      ],
      [
        "llego, multitest alimentos 4,5,6,8, y pescado marisco (35), Zurait Higuera Morales",
        "zurait higuera morales",
      ],
      [
        "LLEGO aurora gatica cid (30) multitest panel 5 ovolacteos Y G8",
        "aurora gatica cid",
      ],
      [
        "llego Paloma Olate quintana, multitest 1 2 3 acaros y alimentario debe incluir pescados (panel 9) (60)",
        "paloma olate quintana",
      ],
      [
        "se le envia por pick up pagamos el envio nosotros dosis clustoid (50) Fernanda isidora Campos henriquez 23886375-9 12 años Los angeles Fonasa 974434688",
        "fernanda isidora campos henriquez",
      ],
      [
        "retira vacuna Roberto castillo rubilar clustoid 0.5 ML 8.700.053-2 956234225 los angeles",
        "roberto castillo rubilar",
      ],
      {
        summary:
          "no asistira por temas economicosHiles Morales Salcedo, Vacuna mantención clustoid (50)",
        description:
          "Hiles Morales Salcedo\nEdad: 46 años\nRUT: 13142377-2\nComuna: Laja\nPrevisión: fonasa\nTeléfono: 962249362",
        expectedName: "hiles morales salcedo",
      },
      [
        "11.10 vacuna de clustoid (50), Emilio Sabath Saez, 9 años, Concepcion, Fonasa 990135760 (papá Gonzalo Sabath Saldivia)",
        "emilio sabath saez",
      ],
      [
        "12:40Mingtsu Leonardo Chang Liu primera dosis vacuna CLUSTOID(25)",
        "mingtsu leonardo chang liu",
      ],
      ["confirmocarlos joaquin varela chavez", "carlos joaquin varela chavez"],
      [
        "16.08 1ra dosis vacuna clustoid (abono $10.000/25)León Alfonso Saavedra Grob -Rut del paciente: 24510075-2 -Edad: 10 años -Comuna: Hualpen -Previsión: Fonasa -Número de contacto: 998791716",
        "leon alfonso saavedra grob",
      ],
    ];

    for (const testCase of cases) {
      if ("expectedName" in testCase) {
        const result = extractPatientHints(testCase.summary, testCase.description);
        expect(result.patientName).toBe(testCase.expectedName);
        continue;
      }

      const [summary, expectedName] = testCase;
      const result = extractPatientHints(summary, null);
      expect(result.patientName).toBe(expectedName);
    }
  });

  it("drops extra noisy tokens found in persisted clinical-series patient names", () => {
    const cases = [
      ["picktest Aurora Gatica Cid", "aurora gatica cid"],
      ["temporalmultitest Martin Bascunan Heredia", "martin bascunan heredia"],
      ["confirmaq León Alfonso Saavedra Grob", "leon alfonso saavedra grob"],
      ["mariscox Zurait Higuera Morales", "zurait higuera morales"],
      ["nubleprevision Valeria Danae Palma Onetto", "valeria danae palma onetto"],
      ["epivac Fernanda Isidora Campos Henriquez", "fernanda isidora campos henriquez"],
      ["cambio antes Aurora Gatica Cid", "aurora gatica cid"],
      ["lecturs Paloma Olate Quintana", "paloma olate quintana"],
      ["mantencio Karina Ortiz Osorio", "karina ortiz osorio"],
      ["amoxicilina Fernanda Isidora Campos Henriquez", "fernanda isidora campos henriquez"],
      ["riffo-rut Mauricio Riffo", "mauricio riffo"],
    ] as const;

    for (const [summary, expectedName] of cases) {
      const result = extractPatientHints(summary, null);
      expect(result.patientName).toBe(expectedName);
    }
  });

  it("keeps boleta-holder identity as beneficiary when patient data appears after the boleta block", () => {
    const summary = "llego 2dA DOSIS CLUSTOID, Fuentes Espinoza Favianna (pagado/30)";
    const description =
      "\nBOLETAS a nombre;\nSolange Espinoza Sepulveda\n13377899-3\n\n951984330\n21268081-8\n22 años\nchillan";

    const result = resolveClinicalIdentity(summary, description);

    expect(result.patientName).toBe("fuentes espinoza favianna");
    expect(result.patientRut).toBe("21268081-8");
    expect(result.beneficiaryRut).toBe("13377899-3");
  });
});
