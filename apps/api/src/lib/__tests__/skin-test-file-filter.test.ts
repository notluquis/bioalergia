import { describe, expect, it } from "vitest";
import {
  isImportableSkinTestFilename,
  isSkinTestCandidateFilename,
  isSkinTestTemplateFilename,
} from "../skin-test-file-filter";

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
    expect(isSkinTestCandidateFilename("_MULTISTEST ANTIBIOTICO - AINES.xlsx")).toBe(true);
    expect(isSkinTestCandidateFilename("_TEST DE PARCHE 30 ALERGENOS.xlsx")).toBe(true);
    expect(isSkinTestCandidateFilename("patch test alimentario.xlsx")).toBe(true);
    expect(isSkinTestCandidateFilename("_panel aeroalérgenos I, + LTP, PROFILINA, LATEX.xlsx"))
      .toBe(true);
    expect(isSkinTestCandidateFilename("TEST LATEX LORENA DELGADO.xlsx")).toBe(true);
    expect(isSkinTestCandidateFilename("PANEL ALIMENTARIO-INSECTARIO.xlsx")).toBe(true);
  });

  it("rejects generic clinical and patient spreadsheets", () => {
    expect(isSkinTestCandidateFilename("ficha clinica nueva.xlsx")).toBe(false);
    expect(isSkinTestCandidateFilename("Emilia Briceño.xlsx")).toBe(false);
    expect(isSkinTestCandidateFilename("consulta medica francisco.xlsx")).toBe(false);
    expect(isSkinTestCandidateFilename("plantilla vacunas.xlsx")).toBe(false);
  });

  it("marks generic skin test templates as non-importable", () => {
    expect(isSkinTestCandidateFilename("NUEVO PRICK TEST AEROALERGENOS PEDIATRICO.xlsx")).toBe(
      true
    );
    expect(isSkinTestTemplateFilename("NUEVO PRICK TEST AEROALERGENOS PEDIATRICO.xlsx")).toBe(
      true
    );
    expect(isImportableSkinTestFilename("NUEVO PRICK TEST AEROALERGENOS PEDIATRICO.xlsx")).toBe(
      false
    );
    expect(isSkinTestTemplateFilename("Copia de PRICK TEST panel aeroalérgenos I(219136).xlsx"))
      .toBe(true);
    expect(isSkinTestTemplateFilename("MULTITEST 1, 2 , 3 Y Acaros 2020 (2).xlsx")).toBe(true);
    expect(isSkinTestTemplateFilename("_TEST DE PARCHE 30 ALERGENOS.xlsx")).toBe(true);
    expect(isSkinTestTemplateFilename("FORMATO TEST DE PARCHE RESULTADOS.xlsx")).toBe(true);
    expect(isImportableSkinTestFilename("Costos Test Parche.xlsx")).toBe(false);
    expect(isImportableSkinTestFilename("invententario test de parche.xlsx")).toBe(false);
  });

  it("keeps patient-specific skin test files importable even if they contain nuevo or copia", () => {
    expect(
      isImportableSkinTestFilename("NUEVO MULTITEST 1, 2 , 3 Y Acaros AARON MARQUEZ.xlsx")
    ).toBe(true);
    expect(
      isImportableSkinTestFilename("Copia de PRICK TEST panel aeroalérgenos I CAMILA COLOMA.xlsx")
    ).toBe(true);
    expect(
      isImportableSkinTestFilename("MAIR HASSON GOLUBOFF - TEST CUTANEO AINES.xlsx")
    ).toBe(true);
    expect(
      isImportableSkinTestFilename("_TEST DE PARCHE 30 ALERGENOS VICTORIA SAEZ PAREDES.xlsx")
    ).toBe(true);
    expect(isImportableSkinTestFilename("TEST LATEX LORENA DELGADO.xlsx")).toBe(true);
  });
});
