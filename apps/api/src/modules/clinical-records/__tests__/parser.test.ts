import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import {
  CLINICAL_RECORD_PARSER_VERSION,
  parseClinicalRecordWorkbook,
  parseSpanishDate,
} from "../parser.ts";

// Build an xlsx buffer from a 2D array of cell strings, mirroring exactly how
// the parser reads it (sheet_to_json header:1). Empty string = blank cell.
// Synthetic data only — no real PHI from the corpus.
function gridBuffer(grid: string[][]): Buffer {
  const ws = XLSX.utils.aoa_to_sheet(grid);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

describe("parseSpanishDate", () => {
  it("parses '11 DE ENERO DE 2024'", () => {
    expect(parseSpanishDate("11 DE ENERO DE 2024")).toBe("2024-01-11");
  });
  it("parses bare-month '20 FEBRERO DE 2019'", () => {
    expect(parseSpanishDate("20 FEBRERO DE 2019")).toBe("2019-02-20");
  });
  it("tolerates the double-DE typo", () => {
    expect(parseSpanishDate("03 DE DICIEMBRE DE DE 2018")).toBe("2018-12-03");
  });
  it("parses ISO and dd/mm/yyyy", () => {
    expect(parseSpanishDate("2025-7-3")).toBe("2025-07-03");
    expect(parseSpanishDate("03/07/2025")).toBe("2025-07-03");
  });
  it("returns null on garbage", () => {
    expect(parseSpanishDate("no es fecha")).toBeNull();
  });
});

// ─── Variant A — labelled "ficha clínica" template ──────────────────────────
// NOMBRE / EDAD / FECHA / HISTORIA / EXAMEN FÍSICO / DIAGNÓSTICO / INDICACIONES
// text labels in one column, values to the right. The historically supported
// layout.
describe("parseClinicalRecordWorkbook — labelled (marker) variant", () => {
  const grid: string[][] = [
    ["", "FICHA CLÍNICA"],
    ["", "", "NOMBRE", "PACIENTE PRUEBA UNO"],
    ["", "", "EDAD", "10 MESES"],
    ["", "", "FECHA", "13 DE SEPTIEMBRE DE 2017"],
    ["", "", "HISTORIA", "Tomó leche y presentó deposiciones blandas"],
    ["", "", "", "dolor abdominal, coriza y tos"],
    ["", "", "EXAMEN FÍSICO:", "", "P/E", "N"],
    ["", "", "PESO:", "9,750", "P/T", "N"],
    ["", "", "TALLA:", "76", "T/E", "N"],
    ["", "", "", "Piel sin eccema, otoscopia normal"],
    ["", "", "DIAGNÓSTICO"],
    ["", "", "", "EUTRÓFICO"],
    ["", "", "", "RINITIS-FARINGITIS"],
    ["", "", "INDICACIONES:"],
    ["", "1.", "Lactancia materna y dos comidas"],
    ["", "2.", "Aseo nasal"],
    ["", "Dr. José Manuel Martínez M."],
  ];

  it("extracts header, anthropometrics and sections", () => {
    const p = parseClinicalRecordWorkbook(gridBuffer(grid));
    expect(p.patientName).toBe("PACIENTE PRUEBA UNO");
    expect(p.ageLabel).toBe("10 MESES");
    expect(p.consultDate).toBe("2017-09-13");
    expect(p.weightKg).toBe(9.75);
    expect(p.heightCm).toBe(76);
    expect(p.history).toContain("deposiciones");
    expect(p.physicalExam).toContain("otoscopia");
    expect(p.diagnosis).toContain("RINITIS-FARINGITIS");
    expect(p.indications).toHaveLength(2);
    expect(p.confidence).toBeGreaterThanOrEqual(70);
  });

  it("splits comuna out of the EDAD value", () => {
    const withCity = grid.map((r, i) =>
      i === 2 ? ["", "", "EDAD", "38 AÑOS - SAN PEDRO DE LA PAZ"] : r
    );
    const p = parseClinicalRecordWorkbook(gridBuffer(withCity));
    expect(p.ageLabel).toBe("38 AÑOS");
    expect(p.rawHeader.CIUDAD).toBe("SAN PEDRO DE LA PAZ");
  });
});

// ─── Variant B — label-less "dash" consulta template ────────────────────────
// row 0 `CONSULTA MEDICA- PEGAR CUADERNO`; header values in col 2 of dash rows;
// positional body split by literal "-" separator rows.
describe("parseClinicalRecordWorkbook — positional (dash) variant", () => {
  const grid: string[][] = [
    ["CONSULTA MEDICA- PEGAR CUADERNO"],
    ["-", "", "PACIENTE PRUEBA DOS"],
    ["-", "", "17 AÑOS - TALCAHUANO"],
    ["-"],
    ["-"],
    ["-", "", "27 DE ABRIL DE 2026"],
    ["", "Desde hace meses con rinitis, toma antialérgicos"],
    ["", "con respuesta parcial, descarga nasal"],
    ["-", "", "", "", "", "picor ocular en primavera."],
    ["", "", "", "", "", "padre con rinitis estacional"],
    ["", "otoscopia normal, nasal congestiva", "", "", "", "", "", "", "", "", "U"],
    ["", "faringe y amígdalas normales"],
    ["-"],
    ["", "RINITIS CRÓNICA ALÉRGICA"],
    ["-"],
    ["", "MEDIDAS DE CONTROL AMBIENTAL"],
    ["", "AVAMYS 1 APLIC CFN CADA 12 HORAS"],
    [""],
  ];

  it("recovers header positionally (name / age / city / date)", () => {
    const p = parseClinicalRecordWorkbook(gridBuffer(grid));
    expect(p.patientName).toBe("PACIENTE PRUEBA DOS");
    expect(p.ageLabel).toBe("17 AÑOS");
    expect(p.rawHeader.CIUDAD).toBe("TALCAHUANO");
    expect(p.consultDate).toBe("2026-04-27");
  });

  it("brackets DIAGNÓSTICO and INDICACIONES on the trailing separators", () => {
    const p = parseClinicalRecordWorkbook(gridBuffer(grid));
    // Diagnosis must NOT leak indications, and indications must be populated —
    // this was the trailing-blank-row-as-separator bug.
    expect(p.diagnosis).toBe("RINITIS CRÓNICA ALÉRGICA");
    expect(p.indications).toEqual([
      "MEDIDAS DE CONTROL AMBIENTAL",
      "AVAMYS 1 APLIC CFN CADA 12 HORAS",
    ]);
  });

  it("captures history/exam and detects familial antecedents", () => {
    const p = parseClinicalRecordWorkbook(gridBuffer(grid));
    expect(p.history).toContain("rinitis");
    expect(p.physicalExam).toContain("otoscopia");
    // Stray single-letter junk ("U") must not become an antecedent.
    expect(p.antecedents.personal).not.toContain("U");
    expect(p.antecedents.family).toContain("padre con rinitis estacional");
    expect(p.confidence).toBeGreaterThanOrEqual(70);
  });
});

// ─── Variant B shifted one column to the right ──────────────────────────────
// Some exports put the dash markers in col 1, body in col 2, header in col 3.
// The parser anchors to the CONSULTA MEDICA banner column, so the offset must
// be handled generically.
describe("parseClinicalRecordWorkbook — dash variant shifted +1 column", () => {
  const grid: string[][] = [
    ["", "CONSULTA MEDICA- PEGAR CUADERNO"],
    ["", "-", "", "PACIENTE PRUEBA CUATRO"],
    ["", "-", "", "33 AÑOS - TALCAHUANO"],
    ["", "-"],
    ["", "-", "", "11 DE JULIO DE 2025"],
    ["", "", "Rinitis alérgica en tratamiento con loratadina"],
    ["", "", "síntomas persistentes todo el año"],
    ["", "-"],
    ["", "-"],
    ["", "", "RINOSINUSITIS AGUDA"],
    ["", "", "RINITIS ALERGICA"],
    ["", "-"],
    ["", "", "LORATADINA 1 AL DIA"],
  ];

  it("recovers header, diagnosis and indications at the shifted offset", () => {
    const p = parseClinicalRecordWorkbook(gridBuffer(grid));
    expect(p.patientName).toBe("PACIENTE PRUEBA CUATRO");
    expect(p.ageLabel).toBe("33 AÑOS");
    expect(p.rawHeader.CIUDAD).toBe("TALCAHUANO");
    expect(p.consultDate).toBe("2025-07-11");
    expect(p.diagnosis).toBe("RINOSINUSITIS AGUDA\nRINITIS ALERGICA");
    expect(p.indications).toEqual(["LORATADINA 1 AL DIA"]);
    expect(p.confidence).toBeGreaterThanOrEqual(70);
  });
});

// ─── Non-ficha guard ────────────────────────────────────────────────────────
describe("parseClinicalRecordWorkbook — non-ficha documents", () => {
  it("flags a SOLICITUD DE EXÁMENES form", () => {
    const grid: string[][] = [
      ["", "SOLICITUD   DE   EXAMENES"],
      ["", "", "", "NOMBRE :", "PACIENTE PRUEBA TRES"],
      ["", "", "", "EDAD       :", "45 AÑOS"],
      ["", "", "", "FECHA     :", "23 DE DICIEMBRE DE 2019"],
      ["", "", "X", "HEMOGRAMA"],
      ["", "", "X", "PERFIL BIOQUIMICO"],
    ];
    const p = parseClinicalRecordWorkbook(gridBuffer(grid));
    expect(p.issues.map((i) => i.code)).toContain("document_type_not_ficha");
    expect(p.history).toBeNull();
  });
});

describe("parser version", () => {
  it("is current", () => {
    expect(CLINICAL_RECORD_PARSER_VERSION).toBe("0.3.0");
  });
});
