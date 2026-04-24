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
      ]),
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
      ]),
    );
  });
});
