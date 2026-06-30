import { describe, expect, it } from "vitest";
import { mapFlowDataToIntake } from "../intake.ts";

describe("mapFlowDataToIntake", () => {
  it("maps flow fields + normalizes a valid RUT + parses insurance/minor", () => {
    const out = mapFlowDataToIntake(
      {
        nombre: "Juan Pérez",
        rut: "12.345.678-5",
        correo: "j@x.cl",
        prevision: "isapre",
        isapre: "Colmena",
        direccion: "Calle 1",
        motivo: "alergia",
        alergias: "polen",
        condiciones: "asma",
        es_menor: "no",
        telefono: "+56999",
      },
      { patientName: "Fallback", patientPhone: "+56900" }
    );
    expect(out.patientName).toBe("Juan Pérez");
    expect(out.patientPhone).toBe("+56999");
    expect(out.patientRut).toBe("12345678-5"); // normalized
    expect(out.healthInsurance).toBe("ISAPRE");
    expect(out.isapreName).toBe("Colmena");
    expect(out.isMinor).toBe(false);
    expect(out.knownAllergies).toBe("polen");
  });

  it("keeps an invalid RUT raw (staff verify) + falls back to token name/phone", () => {
    const out = mapFlowDataToIntake({ rut: "99999999-9" }, {
      patientName: "Token Name",
      patientPhone: "+56911",
    });
    expect(out.patientRut).toBe("99999999-9"); // invalid mod-11 → kept raw
    expect(out.patientName).toBe("Token Name");
    expect(out.patientPhone).toBe("+56911");
    expect(out.healthInsurance).toBeNull();
  });

  it("parses a DatePicker epoch-ms birthDate", () => {
    const ms = Date.UTC(2015, 0, 15);
    const out = mapFlowDataToIntake({ fecha_nacimiento: String(ms) }, {});
    expect(out.patientBirthDate?.getTime()).toBe(ms);
    expect(out.isMinor).toBeNull();
  });
});
