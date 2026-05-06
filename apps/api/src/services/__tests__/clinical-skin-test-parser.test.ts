import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import {
  normalizeRut,
  parseDateToISO,
  parseSkinTestWorkbookBuffer,
} from "../clinical-skin-test-parser";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function s(v: string): XLSX.CellObject { return { t: "s", v }; }
function n(v: number): XLSX.CellObject { return { t: "n", v }; }
function d(v: Date): XLSX.CellObject { return { t: "d", v }; }

function makeSheet(cells: Record<string, XLSX.CellObject>): XLSX.WorkSheet {
  let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
  for (const addr of Object.keys(cells)) {
    const { r, c } = XLSX.utils.decode_cell(addr);
    if (r < minR) minR = r;
    if (r > maxR) maxR = r;
    if (c < minC) minC = c;
    if (c > maxC) maxC = c;
  }
  const sheet: XLSX.WorkSheet = { ...cells };
  sheet["!ref"] = XLSX.utils.encode_range({ s: { r: minR, c: minC }, e: { r: maxR, c: maxC } });
  return sheet;
}

function makeBuffer(name: string, cells: Record<string, XLSX.CellObject>): Buffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, makeSheet(cells), name);
  return Buffer.from(XLSX.write(wb, { bookType: "xlsx", type: "buffer" }) as ArrayBuffer);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("clinical skin test parser", () => {
  it("normalizes Chilean RUTs and numeric/textual dates", () => {
    expect(normalizeRut("26.813.410-7")).toBe("26.813.410-7");
    expect(normalizeRut("268134107")).toBe("26.813.410-7");
    expect(normalizeRut("26 813 410 7")).toBe("26.813.410-7");
    // Wrong check digit → invalid
    expect(normalizeRut("26.813.410-5")).toBeNull();
    // Too short / clearly not a RUT — allergen numbers, partial dates
    expect(normalizeRut("202-5")).toBeNull();
    expect(normalizeRut("16.201-7")).toBeNull();
    expect(normalizeRut("808.202-5")).toBeNull();
    // Company RUTs (outside person range) — not attended
    expect(normalizeRut("76.354.771-K")).toBeNull();
    expect(normalizeRut("96.500.000-1")).toBeNull();
    // Venezuelan CI: V/E prefix + digits
    expect(normalizeRut("V-12345678")).toBe("V-12345678");
    expect(normalizeRut("E-9876543")).toBe("E-9876543");
    // ICAO passport (letters + digits)
    expect(normalizeRut("RD5539724")).toBe("RD5539724");
    expect(normalizeRut("AP233585")).toBe("AP233585");
    // Pure alpha section labels must NOT match
    expect(normalizeRut("ALTERNARIAS")).toBeNull();
    expect(normalizeRut("GRAMINEAS")).toBeNull();
    expect(parseDateToISO("06-01-2025")).toBe("2025-01-06");
    expect(parseDateToISO("23 - 05-2022")).toBe("2022-05-23");
    expect(parseDateToISO("10 DE OCTUBRE DE 2017")).toBe("2017-10-10");
  });

  it("parses the modern P/E multitest format", async () => {
    const buf = makeBuffer("Test", {
      B2: s("MULTITEST CUTANEO"),
      B3: s("PANEL 1, 2, 3 Y ACAROS"),
      B5: s("NOMBRE : ISIDORA GARRIDO JARA"),
      E5: s("EDAD : 5 AÑOS"),
      B6: s("RUT : 26.813.410-7"),
      E6: s("FECHA : 06-01-2025"),
      B7: s("CORREO: magustincory@gmail.com"),
      E7: s("CELULAR : 72781713"),
      B10: s("ACAROS"),
      C10: s("P"),
      D10: s("E"),
      A11: s("D1"),
      B11: s("MEZCLA ACAROS"),
      D11: n(5),
      A12: s("D5"),
      B12: s("POLVO DE CASA"),
      D12: n(5),
      B20: s("CONTROL POSITIVO"),
      C20: n(5),
      D20: n(10),
    });

    const parsed = await parseSkinTestWorkbookBuffer(buf);

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
    const buf = makeBuffer("Test", {
      B2: s("MULTITEST CUTANEO"),
      B4: s("NOMBRE: SANTIAGO CIFUENTES PARADA"),
      E4: s("EDAD: 6 MESES"),
      B5: s("RUT:"),
      E5: s("FECHA: 10 DE OCTUBRE DE 2017"),
      B8: s("ALIMENTOS"),
      A9: s("1"),
      B9: s("LECHE FRESCA"),
      C9: n(5),
      D9: n(20),
      G8: s("ÁCAROS"),
      F10: s("MA"),
      G10: s("MEZCLA ÁCAROS"),
      I10: s("<3"),
    });

    const parsed = await parseSkinTestWorkbookBuffer(buf);

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
    const buf = makeBuffer("Test", {
      D4: s("MULTITEST CUTÁNEO"),
      D5: s("PANEL 1, 2,3 Y ACAROS"),
      B7: s("NOMBRE :Joaquin Heredia Flores"),
      H7: s("EDAD"),
      I7: s(":"),
      J7: s("7 Años"),
      B8: s("RUT"),
      C8: s(": 26.200.889-4"),
      H8: s("FECHA"),
      I8: s(":"),
      J8: s("14-01-2026"),
      B9: s("CORREO:kflores28@gmail.com"),
      H9: s("CELULAR"),
      I9: s(":"),
      J9: s("990789883"),
      C13: s("PANEL 1"),
      E12: s("P"),
      F12: s("E"),
      B14: s("D1"),
      C14: s("MEZCLA ACAROS"),
      E14: n(5),
      F14: n(18),
      B15: s("D5"),
      C15: s("POLVO DE CASA"),
      E15: n(6),
      F15: n(10),
      B16: s("E1"),
      C16: s("GATO"),
      F16: n(5),
      H13: s("PANEL 3"),
      J13: s("P"),
      K13: s("E"),
      G14: s("G1"),
      H14: s("GRAMA COMUN"),
      J14: n(8),
      K14: n(25),
      C27: s("PANEL 2"),
      E28: s("P"),
      F28: s("E"),
      B29: s("A2"),
      C29: s("FRESNO"),
      F29: n(8),
      B30: s("A4"),
      C30: s("PINO"),
      E30: n(10),
      F30: n(22),
      H27: s("Acaros/ insectario"),
      J27: s("P"),
      K27: s("E"),
      G28: s("D1"),
      H28: s("DERMATOFAGOIDES P"),
      K28: n(8),
      G29: s("D2"),
      H29: s("DERMATOPHAGOIDES F"),
      J29: n(5),
      K29: n(19),
      B42: s("CONTROL POSITIVO"),
      E42: n(10),
      F42: n(29),
      B43: s("CONTROL NEGATIVO"),
      F43: n(5),
    });

    const parsed = await parseSkinTestWorkbookBuffer(buf);

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
    const buf = makeBuffer("Test", {
      B2: s("PRICKTEST CUTANEO"),
      B4: s("NOMBRE: AURALY CISTERNA"),
      E4: s("EDAD: 27 AÑOS"),
      B5: s("RUT: 17.710.040-4"),
      E5: s("FECHA: 11/09/19"),
      B8: s("ALIMENTOS"),
      A9: s("1"),
      B9: s("LECHE FRESCA"),
      C8: s("P"),
      D8: s("E"),
      C9: n(4),
      D9: n(15),
      B20: s("CEX. PIEL HIPERREACTIVA"),
      B21: s("BAJO ESTAS CONDICIONES EL PRICKTEST NO ES CONCLUYENTE"),
      B22: s("EVALUAR IGE TOTAL Y ESPECIFICAS, DESCARTAR AUTOINMUNIDAD"),
      H25: s("DR JOSE MANUEL MARTINEZ M."),
      H26: s("ALERGOLOGO-INMUNOLOGO"),
      B27: s("www.jmmmartinez-alergia-inmunologia.com"),
      B28: s("SAN MARTÍN 870, OF 509-B, CONCEPCIÓN"),
    });

    const parsed = await parseSkinTestWorkbookBuffer(buf);

    expect(parsed.interpretation.nonConclusiveDueToHyperreactivity).toBe(true);
    expect(parsed.interpretation.clinicalNote).toContain("PIEL HIPERREACTIVA");
    expect(parsed.interpretation.suggestedEvaluation).toContain("IGE TOTAL");
    expect(parsed.interpretation.physicianName).toBe("DR JOSE MANUEL MARTINEZ M.");
    expect(parsed.interpretation.physicianSpecialty).toBe("ALERGOLOGO-INMUNOLOGO");
    expect(parsed.interpretation.website).toBe("www.jmmmartinez-alergia-inmunologia.com");
    expect(parsed.interpretation.address).toBe("SAN MARTÍN 870, OF 509-B, CONCEPCIÓN");
  });

  it("parses AINES prick test format with metrics before allergen names", async () => {
    const buf = makeBuffer("Test", {
      E7: s("NOMBRE:  MAIR HASSON GULOBOFF"),
      E8: s("EDAD:       46 AÑOS"),
      E9: s("FECHA:      13.05.2022"),
      B12: s("PRICKTEST AINES"),
      C13: s("P"),
      D13: s("E"),
      D14: n(4),
      E14: s("1 IBUPROFENO"),
      C20: n(3),
      D20: n(6),
      E20: s("4 PARACETAMOL"),
      C46: n(8),
      D46: n(25),
      E46: s("CONTROL POSITIVO (HISTAMINA)"),
      D47: n(5),
      E47: s("CONTROL NEGATIVO (GLICEROL SALINO)"),
    });

    const parsed = await parseSkinTestWorkbookBuffer(buf);

    expect(parsed.header).toEqual(
      expect.objectContaining({
        ageLabel: "46 AÑOS",
        patientName: "MAIR HASSON GULOBOFF",
        panelTitle: "PRICKTEST AINES",
        testDate: "2022-05-13",
      })
    );
    expect(parsed.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          allergenName: "IBUPROFENO",
          code: "1",
          erythemaMm: 4,
          papuleMm: null,
          section: "AINES",
        }),
        expect.objectContaining({
          allergenName: "PARACETAMOL",
          code: "4",
          erythemaMm: 6,
          papuleMm: 3,
          section: "AINES",
        }),
        expect.objectContaining({
          allergenName: "CONTROL POSITIVO (HISTAMINA)",
          controlType: "POSITIVE",
          erythemaMm: 25,
          papuleMm: 8,
        }),
        expect.objectContaining({
          allergenName: "CONTROL NEGATIVO (GLICEROL SALINO)",
          controlType: "NEGATIVE",
          erythemaMm: 5,
          papuleMm: null,
        }),
      ])
    );
    expect(parsed.results).toHaveLength(4);
  });

  it("parses split PRICKTEST aeroallergen panel titles and dot dates", async () => {
    const buf = makeBuffer("Test", {
      B4: s("PRICKTEST"),
      B5: s("AEROALERGENOS I"),
      B7: s("NOMBRE: ALEXANDER MONJES AEDO"),
      G7: s("EDAD: 21 AÑOS"),
      B8: s("RUT: 20.161.683-2"),
      G8: s("FECHA:  20.11.2021"),
      C11: s("ACAROS"),
      D11: s("P"),
      E11: s("E"),
      B12: s("D1"),
      C12: s("DERMATOPHAGOIDES P"),
      E12: n(5),
      H11: s("GRAMINEAS"),
      I11: s("P"),
      J11: s("E"),
      G12: s("G1"),
      H12: s("GRAMA COMÚN"),
      I12: n(3),
      J12: n(6),
    });

    const parsed = await parseSkinTestWorkbookBuffer(buf);

    expect(parsed.header).toEqual(
      expect.objectContaining({
        ageLabel: "21 AÑOS",
        patientName: "ALEXANDER MONJES AEDO",
        patientRut: "20.161.683-2",
        panelTitle: "AEROALERGENOS I",
        testDate: "2021-11-20",
      })
    );
    expect(parsed.issues).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "missing_title" }),
        expect.objectContaining({ code: "missing_date" }),
      ])
    );
    expect(parsed.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          allergenName: "DERMATOPHAGOIDES P",
          code: "D1",
          erythemaMm: 5,
          section: "ACAROS",
        }),
        expect.objectContaining({
          allergenName: "GRAMA COMUN",
          code: "G1",
          erythemaMm: 6,
          papuleMm: 3,
          section: "GRAMINEAS",
        }),
      ])
    );
  });

  it("parses Excel date cells next to separated FECHA labels", async () => {
    const buf = makeBuffer("Test", {
      B5: s("PRICKTEST"),
      B6: s("AEROALERGENOS II"),
      B8: s("NOMBRE: GABRIELA CUEVAS TRONCOSO"),
      G8: s("EDAD: 30 AÑOS"),
      B9: s("RUT :"),
      C9: s("18.017.242-4"),
      G9: s("FECHA:  "),
      H9: d(new Date("2022-05-12T00:00:00.000Z")),
      C11: s("ACAROS"),
      D11: s("P"),
      E11: s("E"),
      B12: s("D1"),
      C12: s("DERMATOPHAGOIDES P"),
      D12: n(3),
      E12: n(5),
    });

    const parsed = await parseSkinTestWorkbookBuffer(buf);

    expect(parsed.header).toEqual(
      expect.objectContaining({
        ageLabel: "30 AÑOS",
        patientName: "GABRIELA CUEVAS TRONCOSO",
        patientRut: "18.017.242-4",
        panelTitle: "AEROALERGENOS II",
        testDate: "2022-05-12",
      })
    );
    expect(parsed.issues).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "missing_date" })])
    );
  });

  it("parses standalone RUT cells in the header area", async () => {
    const buf = makeBuffer("Test", {
      B4: s("PRICKTEST"),
      B5: s("PANEL ALIMENTOS I"),
      B7: s("NOMBRE: DAWSON MIRANDA SEPULVEDA"),
      G7: s("EDAD: 13 AÑOS"),
      B8: s("22.727.339-9"),
      G8: s("FECHA: 26/04/2022"),
      D12: s("P"),
      E12: s("E"),
      B13: s("1"),
      C13: s("LECHE FRESCA"),
      E13: n(5),
    });

    const parsed = await parseSkinTestWorkbookBuffer(buf);

    expect(parsed.header).toEqual(
      expect.objectContaining({
        ageLabel: "13 AÑOS",
        patientName: "DAWSON MIRANDA SEPULVEDA",
        patientRut: "22.727.339-9",
        panelTitle: "PANEL ALIMENTOS I",
        testDate: "2022-04-26",
      })
    );
    expect(parsed.issues).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "missing_rut" })])
    );
  });

  it("parses written dates that use DEL before the year", async () => {
    const buf = makeBuffer("Test", {
      B4: s("PRICKTEST CUTANEO"),
      B5: s("AEROALERGENOS PEDIATRICO"),
      B7: s("NOMBRE: CATALINA HIDALGO GALLARDO"),
      G7: s("EDAD: 12 AÑOS"),
      B8: s("RUT:"),
      C8: s("23.053.128-5"),
      G8: s("FECHA: 12 DE MAYO DEL 2022"),
      C11: s("ACAROS"),
      D11: s("P"),
      E11: s("E"),
      B12: s("D1"),
      C12: s("DERMATOPHAGOIDES P"),
      D12: n(5),
      E12: n(15),
    });

    const parsed = await parseSkinTestWorkbookBuffer(buf);

    expect(parsed.header).toEqual(
      expect.objectContaining({
        ageLabel: "12 AÑOS",
        patientName: "CATALINA HIDALGO GALLARDO",
        patientRut: "23.053.128-5",
        panelTitle: "AEROALERGENOS PEDIATRICO",
        testDate: "2022-05-12",
      })
    );
    expect(parsed.issues).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "missing_date" })])
    );
  });

  it("parses generic TEST CUTANEO titles and hyphenated written dates", async () => {
    const buf = makeBuffer("Test", {
      B4: s("TEST CUTÁNEO"),
      B7: s("NOMBRE: CATALINA LILLO"),
      G7: s("EDAD: 19 AÑOS"),
      B8: s("RUT: 19.906.043-0"),
      G8: s("FECHA: 08-AGOSTO-2017"),
      C11: s("ACAROS"),
      D11: s("P"),
      E11: s("E"),
      B12: s("D1"),
      C12: s("DERMATOPHAGOIDES P y F"),
      D12: n(10),
      E12: n(40),
      C13: s("CONTROL POSITIVO"),
      D13: n(10),
      E13: n(40),
      H13: s("HONGOS"),
      I13: s("P"),
      J13: s("E"),
      G14: s("H5"),
      H14: s("MEZCLA HONGOS"),
      J14: s("<3"),
    });

    const parsed = await parseSkinTestWorkbookBuffer(buf);

    expect(parsed.header).toEqual(
      expect.objectContaining({
        ageLabel: "19 AÑOS",
        patientName: "CATALINA LILLO",
        patientRut: "19.906.043-0",
        testDate: "2017-08-08",
      })
    );
    expect(parsed.issues).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "missing_date" }),
        expect.objectContaining({ code: "missing_title" }),
      ])
    );
    expect(parsed.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          allergenName: "MEZCLA HONGOS",
          code: "H5",
          erythemaMm: 3,
          section: "HONGOS",
        }),
      ])
    );
  });

  it("parses European standard patch test (ESTANDAR EUROPEO N HAPTENOS) with % / 48H / 96H columns", async () => {
    const buf = makeBuffer("Test", {
      // Spaced-letter title in merged row (common in these templates)
      B3: s("I N F O R M E    T E S T    D E    P A R C H E    STANDARD"),
      B5: s("NOMBRE                :       LUCIANA MOLINA CIFUENTES"),
      D8: s("RUT       :     26.046.147-8"),
      D9: s("FECHA  :     13-10-22"),
      // "ESTANDAR EUROPEO 17 HAPTENOS" is the title anchor
      B11: s("ESTANDAR EUROPEO 17 HAPTENOS"),
      // Double header row
      B12: s("Cod"),    C12: s("SUBSTANCIA"),  D12: s("LECTURAS"), E12: s("LECTURAS"), F12: s("LECTURAS"),
      B13: s("Cod"),    C13: s("SUBSTANCIA"),  D13: s("%"),        E13: s("48 HRS"),   F13: s("96 HRS"),
      // Data rows: concentration in D (should NOT become papule), grades in E/F
      B14: s("1"),  C14: s("Dicromato de potasio"),    D14: s("0.005"), E14: s("+"),  F14: s("+"),
      B15: s("2"),  C15: s("Sulfato de Neomicina"),    D15: s("0.2"),   E15: s("+"),  F15: s("-"),
      B16: s("8"),  C16: s("Colofonia"),               D16: s("0.2"),   E16: s("-"),  F16: s("-"),
      // Control
      C31: s("Control negativo"),                                       E31: s("-"),  F31: s("-"),
    });

    const parsed = await parseSkinTestWorkbookBuffer(buf);

    expect(parsed.header).toEqual(
      expect.objectContaining({
        patientName: "LUCIANA MOLINA CIFUENTES",
        patientRut: "26.046.147-8",
        testDate: "2022-10-13",
        panelTitle: "ESTANDAR EUROPEO 17 HAPTENOS",
      })
    );
    // No missing_title warning for known patch test format
    expect(parsed.issues).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "missing_title" })])
    );
    // % concentration must NOT be stored as papuleMm
    expect(parsed.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "1",
          allergenName: "Dicromato de potasio",
          papuleMm: null,
          rawPapule: "+",
          rawErythema: "+",
        }),
        expect.objectContaining({
          code: "2",
          allergenName: "Sulfato de Neomicina",
          rawPapule: "+",
          rawErythema: "-",
        }),
        expect.objectContaining({
          code: "8",
          allergenName: "Colofonia",
          rawPapule: "-",
          rawErythema: "-",
        }),
      ])
    );
    // Control negativo must be included
    expect(parsed.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          allergenName: "Control negativo",
          controlType: "NEGATIVE",
          rawPapule: "-",
          rawErythema: "-",
        }),
      ])
    );
  });

  it("parses date when extractLabelValue truncates on internal spaces (e.g. '16   -  10  -2025')", async () => {
    const buf = makeBuffer("Test", {
      B4: s("MULTITEST CUTÁNEO"),
      B7: s("NOMBRE : PACIENTE TEST"),
      H7: s("EDAD : 30 AÑOS"),
      B8: s("RUT            : 24.339.894-0"),
      H8: s("FECHA      :    16   -  10  -2025"),
      B9: s("CORREO:test@test.cl"),
      H9: s("CELULAR : 999999999"),
      B12: s("D1"),
      C12: s("MEZCLA ACAROS"),
      D12: s("P"),
      E12: s("E"),
      C13: s("ACAROS"),
      D13: s("5"),
      E13: s("10"),
    });
    const parsed = await parseSkinTestWorkbookBuffer(buf);
    expect(parsed.header.testDate).toBe("2025-10-16");
    expect(parsed.issues).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "missing_date" })])
    );
  });

  it("parses date with no space between digit and 'DE' (e.g. '16DE NOVIEMBRE DE 2017')", () => {
    expect(parseDateToISO("16DE NOVIEMBRE DE 2017")).toBe("2017-11-16");
    expect(parseDateToISO("FECHA: 16DE NOVIEMBRE DE 2017")).toBe("2017-11-16");
  });

  it("recognises 'ESTANDAR AINES' as a valid title", async () => {
    const buf = makeBuffer("Test", {
      B2: s("NOMBRE: JUAN PEREZ"),
      B3: s("RUT: 12.345.678-9"),
      B4: s("FECHA: 15-03-2025"),
      B11: s("ESTANDAR AINES"),
      A12: s("1 ASPIRINA"),
      B12: s("-"),
      C12: s("+"),
    });
    const parsed = await parseSkinTestWorkbookBuffer(buf);
    expect(parsed.issues).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "missing_title" })])
    );
  });

  it("recognises 'TEST DE PARCHE ALIMENTARIO' as a valid title", async () => {
    const buf = makeBuffer("Test", {
      C9: s("TEST DE PARCHE ALIMENTARIO"),
      B10: s("NOMBRE: FLORENCIA URRUTIA"),
      B11: s("RUT: 15.000.000-1"),
      B12: s("FECHA: 06-11-2024"),
      A15: s("VERDURAS"),
      A16: s("A1"),
      B16: s("Tomate"),
      C16: s("+"),
      D16: s("-"),
    });
    const parsed = await parseSkinTestWorkbookBuffer(buf);
    expect(parsed.issues).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "missing_title" })])
    );
  });

  it("does not capture right-panel allergen sequence numbers as measurements (two-column panel)", async () => {
    // Left panel: codes B, names D, measurements E/F. Right panel: codes H, names I, measurements J/K.
    // Parser must not capture H-column allergen number (e.g. "17") as the papule of the left panel.
    const buf = makeBuffer("Test", {
      E7: s("NOMBRE: "),
      G7: s("JUAN PEREZ"),
      I7: s("FECHA:"),
      E10: s("P"), F10: s("E"), G10: s("mm"),
      B11: s("1"), D11: s("LECHE FRESCA"), H11: s("17"), I11: s("CERDO"),
      B12: s("2"), D12: s("CASEINA"),     H12: s("18"), I12: s("VACA"),
      // Left panel has no measurements filled in; right panel numbers should NOT appear as metrics
    });
    const parsed = await parseSkinTestWorkbookBuffer(buf);
    // Left panel allergens parsed but with null measurements (no data filled in)
    for (const result of parsed.results) {
      expect(result.papuleMm).toBeNull();
      expect(result.erythemaMm).toBeNull();
    }
    // Right-panel sequence numbers (17, 18) must not appear as papule values
    const wrongResults = parsed.results.filter((r) => r.papuleMm === 17 || r.papuleMm === 18);
    expect(wrongResults).toHaveLength(0);
  });

  it("parses date from 'FECHA DEL TEST:' label with value two columns right (AGREE format)", async () => {
    const buf = makeBuffer("Test", {
      B4: s("I N F O R M E    T E S T    D E    P A R C H E"),
      B6: s("NOMBRE:"),
      C6: s("PATRICIA CARRASCO"),
      B7: s("EDAD"),
      C7: s("64 AÑOS"),
      E8: s("RUT:"),
      F8: s("8.183.382-6"),
      E9: s("FECHA DEL TEST:"),
      G9: s("2022-03-28"),
      B13: s("ESTANDAR EUROPEO 30 AGREE"),
      B14: s("N°"),
      C14: s("SUBSTANCIA"),
      D14: s("CONCENTRACIÓN"),
      E14: s("48 HRS"),
      F14: s("72 HRS"),
      G14: s("96 HRS"),
      B15: s("1"),
      C15: s("Dicromato de potasio"),
      D15: s("0.50%"),
      E15: s("-"),
      F15: s("-"),
      G15: s("+"),
    });

    const parsed = await parseSkinTestWorkbookBuffer(buf);

    expect(parsed.header.testDate).toBe("2022-03-28");
    expect(parsed.header.patientRut).toBe("8.183.382-6");
    expect(parsed.issues).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "missing_date" })])
    );
  });
});
