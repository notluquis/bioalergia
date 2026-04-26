import { describe, expect, it } from "vitest";
import { isSkinTestCandidateFilename } from "../skin-test-file-filter";

describe("skin test file filter", () => {
  it("accepts multitest, prick test and test cutaneo filename variants", () => {
    expect(isSkinTestCandidateFilename("_MULTITEST 1, 2 , 3 y acaros.xlsx")).toBe(true);
    expect(isSkinTestCandidateFilename("multi test alimentos Joaquin.xlsx")).toBe(true);
    expect(isSkinTestCandidateFilename("PRICKTEST AEROALERGENOS I.xlsx")).toBe(true);
    expect(isSkinTestCandidateFilename("prick test alimentario ii.xlsx")).toBe(true);
    expect(isSkinTestCandidateFilename("prick-test panel aeroalergenos.xlsx")).toBe(true);
    expect(isSkinTestCandidateFilename("test cutáneo completo.xlsx")).toBe(true);
    expect(isSkinTestCandidateFilename("tests cutaneos pendientes.xlsx")).toBe(true);
    expect(isSkinTestCandidateFilename("testcutaneo paciente.xlsx")).toBe(true);
    expect(isSkinTestCandidateFilename("MAIR HASSON GOLUBOFF - TEST CUTANEO AINES.xlsx")).toBe(
      true
    );
  });

  it("rejects generic clinical and patient spreadsheets", () => {
    expect(isSkinTestCandidateFilename("ficha clinica nueva.xlsx")).toBe(false);
    expect(isSkinTestCandidateFilename("Emilia Briceño.xlsx")).toBe(false);
    expect(isSkinTestCandidateFilename("consulta medica francisco.xlsx")).toBe(false);
    expect(isSkinTestCandidateFilename("plantilla vacunas.xlsx")).toBe(false);
  });
});
