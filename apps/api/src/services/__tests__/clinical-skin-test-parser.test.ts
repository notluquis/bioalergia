import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import {
  normalizeRut,
  parseDateToISO,
  parseSkinTestWorkbookBuffer,
} from "../clinical-skin-test-parser";

describe("clinical skin test parser", () => {
  it("normalizes Chilean RUTs and numeric/textual dates", () => {
    expect(normalizeRut("26.813.410-7")).toBe("26.813.410-7");
    expect(normalizeRut("268134107")).toBe("26.813.410-7");
    expect(parseDateToISO("06-01-2025")).toBe("2025-01-06");
    expect(parseDateToISO("23 - 05-2022")).toBe("2022-05-23");
    expect(parseDateToISO("10 DE OCTUBRE DE 2017")).toBe("2017-10-10");
  });

  it("parses the modern P/E multitest format", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Test");
    sheet.getCell("B2").value = "MULTITEST CUTANEO";
    sheet.getCell("B3").value = "PANEL 1, 2, 3 Y ACAROS";
    sheet.getCell("B5").value = "NOMBRE : ISIDORA GARRIDO JARA";
    sheet.getCell("E5").value = "EDAD : 5 AÑOS";
    sheet.getCell("B6").value = "RUT : 26.813.410-7";
    sheet.getCell("E6").value = "FECHA : 06-01-2025";
    sheet.getCell("B7").value = "CORREO: magustincory@gmail.com";
    sheet.getCell("E7").value = "CELULAR : 72781713";
    sheet.getCell("B10").value = "ACAROS";
    sheet.getCell("C10").value = "P";
    sheet.getCell("D10").value = "E";
    sheet.getCell("A11").value = "D1";
    sheet.getCell("B11").value = "MEZCLA ACAROS";
    sheet.getCell("D11").value = 5;
    sheet.getCell("A12").value = "D5";
    sheet.getCell("B12").value = "POLVO DE CASA";
    sheet.getCell("D12").value = 5;
    sheet.getCell("B20").value = "CONTROL POSITIVO";
    sheet.getCell("C20").value = 5;
    sheet.getCell("D20").value = 10;

    const parsed = await parseSkinTestWorkbookBuffer(await workbook.xlsx.writeBuffer());

    expect(parsed.header.patientRut).toBe("26.813.410-7");
    expect(parsed.header.testDate).toBe("2025-01-06");
    expect(parsed.header.panelTitle).toBe("PANEL 1, 2, 3 Y ACAROS");
    expect(parsed.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          allergenName: "MEZCLA ACAROS",
          code: "D1",
          erythemaMm: 5,
          section: "ACAROS",
        }),
        expect.objectContaining({
          allergenName: "CONTROL POSITIVO",
          controlType: "POSITIVE",
          erythemaMm: 10,
          papuleMm: 5,
        }),
      ])
    );
  });

  it("parses the older two-mm-column format and <3 values", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Test");
    sheet.getCell("B2").value = "MULTITEST CUTANEO";
    sheet.getCell("B4").value = "NOMBRE: SANTIAGO CIFUENTES PARADA";
    sheet.getCell("E4").value = "EDAD: 6 MESES";
    sheet.getCell("B5").value = "RUT:";
    sheet.getCell("E5").value = "FECHA: 10 DE OCTUBRE DE 2017";
    sheet.getCell("B8").value = "ALIMENTOS";
    sheet.getCell("A9").value = "1";
    sheet.getCell("B9").value = "LECHE FRESCA";
    sheet.getCell("C9").value = 5;
    sheet.getCell("D9").value = 20;
    sheet.getCell("G8").value = "ÁCAROS";
    sheet.getCell("F10").value = "MA";
    sheet.getCell("G10").value = "MEZCLA ÁCAROS";
    sheet.getCell("I10").value = "<3";

    const parsed = await parseSkinTestWorkbookBuffer(await workbook.xlsx.writeBuffer());

    expect(parsed.header.patientName).toBe("SANTIAGO CIFUENTES PARADA");
    expect(parsed.header.testDate).toBe("2017-10-10");
    expect(parsed.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          allergenName: "LECHE FRESCA",
          code: "1",
          erythemaMm: 20,
          papuleMm: 5,
          section: "ALIMENTOS",
        }),
        expect.objectContaining({
          allergenName: "MEZCLA ACAROS",
          code: "MA",
          rawPapule: "<3",
          section: "ACAROS",
        }),
      ])
    );
  });

  it("parses the panel grid format with separated P/E blocks", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Test");
    sheet.getCell("D4").value = "MULTITEST CUTÁNEO";
    sheet.getCell("D5").value = "PANEL 1, 2,3 Y ACAROS";
    sheet.getCell("B7").value = "NOMBRE :Joaquin Heredia Flores";
    sheet.getCell("H7").value = "EDAD";
    sheet.getCell("I7").value = ":";
    sheet.getCell("J7").value = "7 Años";
    sheet.getCell("B8").value = "RUT";
    sheet.getCell("C8").value = ": 26.200.889-4";
    sheet.getCell("H8").value = "FECHA";
    sheet.getCell("I8").value = ":";
    sheet.getCell("J8").value = "14-01-2026";
    sheet.getCell("B9").value = "CORREO:kflores28@gmail.com";
    sheet.getCell("H9").value = "CELULAR";
    sheet.getCell("I9").value = ":";
    sheet.getCell("J9").value = "990789883";

    sheet.getCell("C13").value = "PANEL 1";
    sheet.getCell("E12").value = "P";
    sheet.getCell("F12").value = "E";
    sheet.getCell("B14").value = "D1";
    sheet.getCell("C14").value = "MEZCLA ACAROS";
    sheet.getCell("E14").value = 5;
    sheet.getCell("F14").value = 18;
    sheet.getCell("B15").value = "D5";
    sheet.getCell("C15").value = "POLVO DE CASA";
    sheet.getCell("E15").value = 6;
    sheet.getCell("F15").value = 10;
    sheet.getCell("B16").value = "E1";
    sheet.getCell("C16").value = "GATO";
    sheet.getCell("F16").value = 5;

    sheet.getCell("H13").value = "PANEL 3";
    sheet.getCell("J13").value = "P";
    sheet.getCell("K13").value = "E";
    sheet.getCell("G14").value = "G1";
    sheet.getCell("H14").value = "GRAMA COMUN";
    sheet.getCell("J14").value = 8;
    sheet.getCell("K14").value = 25;

    sheet.getCell("C27").value = "PANEL 2";
    sheet.getCell("E28").value = "P";
    sheet.getCell("F28").value = "E";
    sheet.getCell("B29").value = "A2";
    sheet.getCell("C29").value = "FRESNO";
    sheet.getCell("F29").value = 8;
    sheet.getCell("B30").value = "A4";
    sheet.getCell("C30").value = "PINO";
    sheet.getCell("E30").value = 10;
    sheet.getCell("F30").value = 22;

    sheet.getCell("H27").value = "Acaros/ insectario";
    sheet.getCell("J27").value = "P";
    sheet.getCell("K27").value = "E";
    sheet.getCell("G28").value = "D1";
    sheet.getCell("H28").value = "DERMATOFAGOIDES P";
    sheet.getCell("K28").value = 8;
    sheet.getCell("G29").value = "D2";
    sheet.getCell("H29").value = "DERMATOPHAGOIDES F";
    sheet.getCell("J29").value = 5;
    sheet.getCell("K29").value = 19;

    sheet.getCell("B42").value = "CONTROL POSITIVO";
    sheet.getCell("E42").value = 10;
    sheet.getCell("F42").value = 29;
    sheet.getCell("B43").value = "CONTROL NEGATIVO";
    sheet.getCell("F43").value = 5;

    const parsed = await parseSkinTestWorkbookBuffer(await workbook.xlsx.writeBuffer());

    expect(parsed.header).toEqual(
      expect.objectContaining({
        ageLabel: "7 Años",
        patientEmail: "kflores28@gmail.com",
        patientName: "Joaquin Heredia Flores",
        patientPhone: "990789883",
        patientRut: "26.200.889-4",
        panelTitle: "PANEL 1, 2,3 Y ACAROS",
        testDate: "2026-01-14",
      })
    );
    expect(parsed.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          allergenName: "MEZCLA ACAROS",
          code: "D1",
          erythemaMm: 18,
          papuleMm: 5,
          section: "PANEL 1",
        }),
        expect.objectContaining({
          allergenName: "GATO",
          code: "E1",
          erythemaMm: 5,
          papuleMm: null,
          section: "PANEL 1",
        }),
        expect.objectContaining({
          allergenName: "GRAMA COMUN",
          code: "G1",
          erythemaMm: 25,
          papuleMm: 8,
          section: "PANEL 3",
        }),
        expect.objectContaining({
          allergenName: "DERMATOPHAGOIDES F",
          code: "D2",
          erythemaMm: 19,
          papuleMm: 5,
          section: "Acaros/ insectario",
        }),
        expect.objectContaining({
          allergenName: "CONTROL POSITIVO",
          controlType: "POSITIVE",
          erythemaMm: 29,
          papuleMm: 10,
        }),
        expect.objectContaining({
          allergenName: "CONTROL NEGATIVO",
          controlType: "NEGATIVE",
          erythemaMm: 5,
          papuleMm: null,
        }),
      ])
    );
    expect(parsed.results).toHaveLength(10);
  });

  it("extracts interpretation notes and non-conclusive hyperreactivity flags", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Test");
    sheet.getCell("B2").value = "PRICKTEST CUTANEO";
    sheet.getCell("B4").value = "NOMBRE: AURALY CISTERNA";
    sheet.getCell("E4").value = "EDAD: 27 AÑOS";
    sheet.getCell("B5").value = "RUT: 17.710.040-4";
    sheet.getCell("E5").value = "FECHA: 11/09/19";
    sheet.getCell("B8").value = "ALIMENTOS";
    sheet.getCell("A9").value = "1";
    sheet.getCell("B9").value = "LECHE FRESCA";
    sheet.getCell("C8").value = "P";
    sheet.getCell("D8").value = "E";
    sheet.getCell("C9").value = 4;
    sheet.getCell("D9").value = 15;
    sheet.getCell("B20").value = "CEX. PIEL HIPERREACTIVA";
    sheet.getCell("B21").value = "BAJO ESTAS CONDICIONES EL PRICKTEST NO ES CONCLUYENTE";
    sheet.getCell("B22").value = "EVALUAR IGE TOTAL Y ESPECIFICAS, DESCARTAR AUTOINMUNIDAD";
    sheet.getCell("H25").value = "DR JOSE MANUEL MARTINEZ M.";
    sheet.getCell("H26").value = "ALERGOLOGO-INMUNOLOGO";
    sheet.getCell("B27").value = "www.jmmmartinez-alergia-inmunologia.com";
    sheet.getCell("B28").value = "SAN MARTÍN 870, OF 509-B, CONCEPCIÓN";

    const parsed = await parseSkinTestWorkbookBuffer(await workbook.xlsx.writeBuffer());

    expect(parsed.interpretation.nonConclusiveDueToHyperreactivity).toBe(true);
    expect(parsed.interpretation.clinicalNote).toContain("PIEL HIPERREACTIVA");
    expect(parsed.interpretation.suggestedEvaluation).toContain("IGE TOTAL");
    expect(parsed.interpretation.physicianName).toBe("DR JOSE MANUEL MARTINEZ M.");
    expect(parsed.interpretation.physicianSpecialty).toBe("ALERGOLOGO-INMUNOLOGO");
    expect(parsed.interpretation.website).toBe("www.jmmmartinez-alergia-inmunologia.com");
    expect(parsed.interpretation.address).toBe("SAN MARTÍN 870, OF 509-B, CONCEPCIÓN");
  });
});
