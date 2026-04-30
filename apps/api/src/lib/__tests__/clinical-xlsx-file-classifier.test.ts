import { describe, expect, it } from "vitest";

import { classifyClinicalXlsxFilename } from "../clinical-xlsx-file-classifier";

describe("clinical xlsx file classifier", () => {
  it("routes skin-test filenames to the skin-test module", () => {
    expect(classifyClinicalXlsxFilename("PRICK TEST AINES.xlsx").classification).toBe(
      "SKIN_TEST"
    );
    expect(classifyClinicalXlsxFilename("MULTITEST 1, 2 , 3 y acaros.xlsx").classification).toBe(
      "SKIN_TEST"
    );
    expect(classifyClinicalXlsxFilename("test cutáneo completo.xlsx").classification).toBe(
      "SKIN_TEST"
    );
  });

  it("routes explicit clinical documents and patient-name files to documents", () => {
    expect(classifyClinicalXlsxFilename("ficha clinica nueva.xlsx").classification).toBe(
      "CLINICAL_DOCUMENT"
    );
    expect(classifyClinicalXlsxFilename("control Emilia Briceño.xlsx").classification).toBe(
      "CLINICAL_DOCUMENT"
    );
    expect(classifyClinicalXlsxFilename("Emilia Briceño.xlsx").classification).toBe(
      "CLINICAL_DOCUMENT"
    );
  });

  it("keeps unrelated workbooks only in the neutral library", () => {
    expect(classifyClinicalXlsxFilename("lista alergenos.xlsx").classification).toBe("OTHER");
    expect(classifyClinicalXlsxFilename("presupuesto empresa 2025.xlsx").classification).toBe(
      "OTHER"
    );
    expect(classifyClinicalXlsxFilename("plantilla vacunas.xlsx").classification).toBe("OTHER");
  });
});
