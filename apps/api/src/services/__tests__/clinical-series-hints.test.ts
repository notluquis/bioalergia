import { describe, expect, it, vi } from "vitest";

// Mock DB so the module can be imported without a real database connection
vi.mock("@finanzas/db", () => ({ db: {} }));

const { extractPatientHints } = await import("../clinical-series");

describe("extractPatientHints", () => {
  describe("patientName — capitalized names", () => {
    it("detects a capitalized full name", () => {
      const { patientName } = extractPatientHints("Juan Pérez García dosis 3", null);
      expect(patientName).toBe("juan perez garcia");
    });

    it("detects a capitalized name from description", () => {
      const { patientName } = extractPatientHints(null, "Paciente: Maria José Silva");
      expect(patientName).toBe("maria jose silva");
    });
  });

  describe("patientName — all-lowercase fallback (7+ chars per word)", () => {
    it("detects real case: celmira morales inostroza", () => {
      const { patientName } = extractPatientHints(
        "llego2da lec test de parche (60) celmira morales inostroza",
        null,
      );
      expect(patientName).toBe("celmira morales inostroza");
    });

    it("detects a two-word lowercase name with long words", () => {
      const { patientName } = extractPatientHints(
        "dosis 3 consuelo martinez",
        null,
      );
      // "dosis"(5)<7 and "3" break chain — "consuelo"(8) "martinez"(8) match
      expect(patientName).toBe("consuelo martinez");
    });

    it("does not match short medical terms (parche=6, instalacion=11 but alone)", () => {
      // "parche"(6) < 7 → no match; "instalacion"(11) ≥ 7 but alone (needs 2+ words)
      const { patientName } = extractPatientHints("test de parche instalacion", null);
      expect(patientName).toBeNull();
    });

    it("does not match short common medical words like dosis/carmen", () => {
      // "dosis"(5) < 7, "carmen"(6) < 7, "tapia"(5) < 7 — none qualify
      const { patientName } = extractPatientHints("dosis semanal carmen tapia", null);
      expect(patientName).toBeNull();
    });

    it("prefers capitalized match over lowercase when both are present", () => {
      const { patientName } = extractPatientHints(
        "Pedro Gonzalez tratamiento subcutaneo",
        null,
      );
      expect(patientName).toBe("pedro gonzalez");
    });
  });

  describe("patientRut", () => {
    it("extracts a RUT with dots and dash", () => {
      const { patientRut } = extractPatientHints("12.345.678-9 Juan Pérez", null);
      expect(patientRut).not.toBeNull();
    });

    it("extracts a RUT without formatting", () => {
      const { patientRut } = extractPatientHints("19511977-5 celmira morales", null);
      expect(patientRut).not.toBeNull();
    });

    it("extracts name and RUT together from real event text", () => {
      const { patientName, patientRut } = extractPatientHints(
        "llego2da lec test de parche (60) celmira morales inostroza",
        "19511977-5",
      );
      expect(patientName).toBe("celmira morales inostroza");
      expect(patientRut).not.toBeNull();
    });
  });

  describe("null cases", () => {
    it("returns null for both when text has no hints", () => {
      const result = extractPatientHints("dosis 3 instalacion", null);
      expect(result.patientName).toBeNull();
      expect(result.patientRut).toBeNull();
    });

    it("handles null inputs", () => {
      const result = extractPatientHints(null, null);
      expect(result.patientName).toBeNull();
      expect(result.patientRut).toBeNull();
    });
  });
});
