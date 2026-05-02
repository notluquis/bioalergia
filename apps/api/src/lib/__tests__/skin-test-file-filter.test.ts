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
    expect(isSkinTestCandidateFilename("PRICK MEDICAMENTOS ana maria luna.xlsx")).toBe(true);
    expect(isSkinTestCandidateFilename("test de aeroalergenos vanina bravo.xlsx")).toBe(true);
    expect(isSkinTestCandidateFilename("PANEL 28 AEROALERGENOS.xlsx")).toBe(true);
    expect(isSkinTestCandidateFilename("PANEL COMPLETO AEROALERGENOS.xlsx")).toBe(true);
    expect(isSkinTestCandidateFilename("AEROALERGENO II LUIS RAMIREZ.xlsx")).toBe(true);
    expect(isSkinTestCandidateFilename("PANEL ALIMENTARIO ADULTO.xlsx")).toBe(true);
    expect(isSkinTestCandidateFilename("AYLIN SILVA PEDREROS - ALIMENTOS I.xlsx")).toBe(true);
    expect(isSkinTestCandidateFilename("MARTIN TORO RINITIA ACAROS.xlsx")).toBe(true);
    expect(isSkinTestCandidateFilename("CHRISTOPHER AINES.xlsx")).toBe(true);
    expect(isSkinTestCandidateFilename("MAITE OLIVA GRANDFELDT - ULTITEST 1, 2 , 3 Y Acaros.xlsx"))
      .toBe(true);
    expect(isSkinTestCandidateFilename("HELGA HEIM GONZALEZ - TEST PARCHE DERIVADOS.xlsx")).toBe(
      true
    );
    expect(isSkinTestCandidateFilename("TEST PARCHE MARIA PALMA.xlsx")).toBe(true);
    expect(isSkinTestCandidateFilename("TESTE DE PARCHE CARLOS PEREZ.xlsx")).toBe(true);
    expect(isSkinTestCandidateFilename("LIBNI OYARZO PARCHE.xlsx")).toBe(true);
    expect(isSkinTestCandidateFilename("PRICK CAROLINA VENEGAS.xlsx")).toBe(true);
    expect(isSkinTestCandidateFilename("MARTINEZ PRICK.xlsx")).toBe(true);
    expect(isSkinTestCandidateFilename("NICOLE SANCHEZ SANDOVAL - LATEX.xlsx")).toBe(true);
  });

  it("rejects generic clinical and patient spreadsheets", () => {
    expect(isSkinTestCandidateFilename("ficha clinica nueva.xlsx")).toBe(false);
    expect(isSkinTestCandidateFilename("Emilia Briceño.xlsx")).toBe(false);
    expect(isSkinTestCandidateFilename("consulta medica francisco.xlsx")).toBe(false);
    expect(isSkinTestCandidateFilename("plantilla vacunas.xlsx")).toBe(false);
    expect(isSkinTestCandidateFilename("Costos Test Parche.xlsx")).toBe(false);
    expect(isSkinTestCandidateFilename("INVENTARIO ALERGENOS 2025(1).xlsx")).toBe(false);
    expect(isSkinTestCandidateFilename("STOCK ALERGENOS.xlsx")).toBe(false);
    expect(isSkinTestCandidateFilename("COTIZACION ALERGENOS.xlsx")).toBe(false);
    expect(isSkinTestCandidateFilename("recepcion alergenos 04-12-2024.xlsx")).toBe(false);
    expect(isSkinTestCandidateFilename("SOLICITUD ALERGENOS - MULTIAPLICADORES - LANCETAS.xlsx"))
      .toBe(false);
    expect(isSkinTestCandidateFilename("SOLICITUD ALIMENTARIO-INSECTARIO.xlsx")).toBe(false);
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
    expect(isImportableSkinTestFilename("invententario test de parche.xlsx")).toBe(false);
    expect(isImportableSkinTestFilename("PANEL 28 AEROALERGENOS.xlsx")).toBe(false);
    expect(isImportableSkinTestFilename("PANEL COMPLETO AEROALERGENOS.xlsx")).toBe(false);
    expect(isImportableSkinTestFilename("PANEL ALIMENTARIO ADULTO.xlsx")).toBe(false);
    expect(isImportableSkinTestFilename("TEST LATEX.xlsx")).toBe(false);
    expect(isImportableSkinTestFilename("Formulario MULTITEST.xlsx")).toBe(false);
    expect(isImportableSkinTestFilename("TEST CUTANEO multiaplicador.xlsx")).toBe(false);
    expect(isImportableSkinTestFilename("PRICK AEROALERGENO II NUEVO 2019.xlsx")).toBe(false);
    expect(isImportableSkinTestFilename("PANEL 28 AEROALERGENOS_41834.xlsx")).toBe(false);
    expect(isImportableSkinTestFilename("FORMATO TEST DE PARCHE ACHS.xlsx")).toBe(false);
    expect(isImportableSkinTestFilename("Multitest PANEL 9 y grupo de 8.xlsx")).toBe(false);
    expect(isImportableSkinTestFilename("_Multitest panel 4,g8 , ovalacteos, p,m.xlsx")).toBe(
      false
    );
    expect(isImportableSkinTestFilename("MULTITEST PANEL 5, 6, G8 y pescado.xlsx")).toBe(false);
    expect(isImportableSkinTestFilename("_MULTITEST PANEL 1, AC,INSECTARIOS, GR8.xlsx")).toBe(
      false
    );
    expect(
      isImportableSkinTestFilename("MULTITEST Panel 1^J Acaros^J Ovolacteo y grupo de los 8.xlsx")
    ).toBe(false);
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
    expect(isImportableSkinTestFilename("PRICK MEDICAMENTOS ana maria luna.xlsx")).toBe(true);
    expect(isImportableSkinTestFilename("AEROALERGENO II LUIS RAMIREZ.xlsx")).toBe(true);
    expect(isImportableSkinTestFilename("CHRISTOPHER AINES.xlsx")).toBe(true);
    expect(isImportableSkinTestFilename("HELGA HEIM GONZALEZ - TEST PARCHE DERIVADOS.xlsx")).toBe(
      true
    );
    expect(isImportableSkinTestFilename("TEST PARCHE MARIA PALMA.xlsx")).toBe(true);
    expect(isImportableSkinTestFilename("TESTE DE PARCHE CARLOS PEREZ.xlsx")).toBe(true);
    expect(isImportableSkinTestFilename("LIBNI OYARZO PARCHE.xlsx")).toBe(true);
    expect(isImportableSkinTestFilename("PRICK DANIELA MATAMALA.xlsx")).toBe(true);
    expect(isImportableSkinTestFilename("MARTINEZ PRICK.xlsx")).toBe(true);
    expect(isImportableSkinTestFilename("NICOLE SANCHEZ SANDOVAL - LATEX.xlsx")).toBe(true);
  });
});
