import { describe, expect, it, vi } from "vitest";

// Mock DB so the module can be imported without a real database connection
vi.mock("@finanzas/db", () => ({ db: {} }));

const { extractIdentityHints, extractPatientHints } = await import("../clinical-series");

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

    // ── ALL-CAPS event summaries ─────────────────────────────────────────────
    it("extracts name from ALL-CAPS summary (RENATO RIQUELME MUÑOZ)", () => {
      // Secretaries sometimes type full caps. Stopwords filter "confirma",
      // "test", "cutaneo", "ambiental" — leaving the real name.
      const { patientName } = extractPatientHints(
        "confirma TEST CUTANEO AMBIENTAL RENATO RIQUELME MUÑOZ",
        null,
      );
      expect(patientName).toBe("renato riquelme munoz");
    });

    it("extracts name from ALL-CAPS when mixed with lowercase tokens", () => {
      // "LLEGO" is a stopword; "PAULINA ANGÉLICA VIVEROS INZUNZA" should be extracted.
      const { patientName } = extractPatientHints(
        "LLEGO, vacuna clustoid 0,5 PAULINA ANGELICA VIVEROS INZUNZA (50)",
        null,
      );
      expect(patientName).toBe("paulina angelica viveros inzunza");
    });

    // ── Title-case name in the middle of a mixed summary ────────────────────
    it("extracts Title-case name following lowercase clinical noise", () => {
      // Real pattern: "confirma,vacuna clustoid 0,5 Paulina Angélica Viveros Inzunza (50)"
      const { patientName } = extractPatientHints(
        "confirma,vacuna clustoid 0,5 Paulina Angélica Viveros Inzunza (50)",
        "ano por medio antibioticos asma",
      );
      expect(patientName).toBe("paulina angelica viveros inzunza");
    });

    // ── Compound surnames with particles ────────────────────────────────────
    it("extracts name with 'de la' compound surname via RUT-adjacent walk", () => {
      // "claudio de la cuadra" — "de" and "la" are particles (length <3) that
      // would break a plain walk; particle-aware logic keeps them.
      const { patientName } = extractPatientHints(
        "11:35 control test de parche claudio de la cuadra 967534216",
        null,
      );
      expect(patientName).toBe("claudio de la cuadra");
    });
  });

  describe("patientName — stopword filtering", () => {
    it("does not use 'ambiental' as a name token", () => {
      const { patientName } = extractPatientHints(
        "test cutaneo ambiental rosa pineda",
        null,
      );
      // "ambiental" is a stopword — result should skip it and find "rosa pineda"
      expect(patientName).toBe("rosa pineda");
    });

    it("does not use 'cutaneo' as a name token", () => {
      // Real case: "llego Test cutaneo javiera vera" → should be "javiera vera"
      const { patientName } = extractPatientHints("llego Test cutaneo javiera vera", null);
      expect(patientName).toBe("javiera vera");
    });

    it("does not use 'vincular' or 'evento' as name tokens", () => {
      // If someone wrote "Vincular evento con boleta DTE" in a description,
      // those words must be filtered as stopwords.
      const { patientName } = extractPatientHints(
        "Vincular evento boleta DTE",
        "javiera vera paciente",
      );
      expect(patientName).toBe("javiera vera");
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

    it("extracts a short-token name when at least one token is ≥5 chars", () => {
      // "dosis" and "semanal" are stopwords → filtered. "carmen"(6) ≥ 5 → qualifies.
      const { patientName } = extractPatientHints("dosis semanal carmen tapia", null);
      expect(patientName).toBe("carmen tapia");
    });

    it("prefers capitalized match over lowercase when both are present", () => {
      const { patientName } = extractPatientHints(
        "Pedro Gonzalez tratamiento subcutaneo",
        null,
      );
      expect(patientName).toBe("pedro gonzalez");
    });

    it("ignores medical noise in description when summary has a capitalized name", () => {
      // Real case: description contained "ano por medio antibioticos asma" while
      // ALL 12 event summaries show "Paulina Angélica Viveros Inzunza". The
      // capitalized extractor must win over the lowercase description noise.
      const { patientName } = extractPatientHints(
        "llego vacuna clustoid 0,5 Paulina Angélica Viveros Inzunza (50)",
        "ano por medio antibioticos asma",
      );
      expect(patientName).toBe("paulina angelica viveros inzunza");
    });

    it("detects lowercase names with shorter surnames when enough real tokens are present", () => {
      const { patientName } = extractPatientHints(
        "llego 2da dosis acaros 0,2ml(30); benjamin saez jaque",
        null,
      );
      expect(patientName).toBe("benjamin saez jaque");
    });
  });

  // ── Age annotations between name and RUT ────────────────────────────────
  describe("patientName — age annotation between name and RUT", () => {
    it("extracts name when 'N años:' separates it from the RUT", () => {
      // Real case: "llego test de parche(60mil), aero I(30): javiera rio: 18 años: 940951267"
      // "18 años:" must be stripped before the backwards walk, otherwise "18"
      // breaks the walk before we reach "javiera rio".
      const { patientName, patientRut } = extractPatientHints(
        "llego test de parche(60mil), aero I(30): javiera rio: 18 años: 940951267",
        null,
      );
      expect(patientName).toBe("javiera rio");
      expect(patientRut).not.toBeNull();
    });

    it("extracts name before 'N años:' with three-part surname", () => {
      // Real case: "llego confir. test de parche, aer, ali: nicole roa zuchel: 35 años: 988330481"
      const { patientName } = extractPatientHints(
        "llego confir. test de parche, aer, ali: nicole roa zuchel: 35 años: 988330481",
        null,
      );
      expect(patientName).toBe("nicole roa zuchel");
    });

    it("extracts short first name before 'N años;' separator", () => {
      // Real case: "llego test cutaneo mia brito; 2 años; 988388227"
      const { patientName } = extractPatientHints(
        "llego test cutaneo mia brito; 2 años; 988388227",
        null,
      );
      expect(patientName).toBe("mia brito");
    });

    it("extracts name when digit is attached to the last surname token", () => {
      // Real case: "llego conf.test cutaneo amb mauricio san martin9 56750226"
      // "martin9" has a trailing digit that should be stripped before the walk.
      const { patientName } = extractPatientHints(
        "llego conf.test cutaneo amb mauricio san martin9 56750226",
        null,
      );
      expect(patientName).toBe("mauricio san martin");
    });
  });

  // ── Summary always has priority over description ─────────────────────────
  describe("patientName — summary priority over description", () => {
    it("summary capitalized name wins over description noise", () => {
      // Real case: Paulina Viveros series had "ano por medio antibioticos asma"
      // stored from an old event description, overriding the correct summary name.
      const { patientName } = extractPatientHints(
        "llego vacuna clustoid 0,5 Paulina Angélica Viveros Inzunza (50)",
        "ano por medio antibioticos asma",
      );
      expect(patientName).toBe("paulina angelica viveros inzunza");
    });

    it("summary name wins over description field labels", () => {
      // Real case: older Maximiliano events had structured description with
      // "-Rut del paciente:", "-Previsión: Colmena", "-Número de contacto:" etc.
      // that should never override the clearly-named summary.
      const { patientName } = extractPatientHints(
        "llego Maximiliano Soto Hernández ,vacuna clustoid (50)",
        "-Rut del paciente: 21825149-8 -Edad: 18 años -Previsión: Colmena -Número de contacto: 97583527",
      );
      expect(patientName).toBe("maximiliano soto hernandez");
    });

    it("description name used when summary has none", () => {
      const { patientName } = extractPatientHints(
        "dosis mensual clustoid",
        "celmira morales inostroza",
      );
      expect(patientName).toBe("celmira morales inostroza");
    });
  });

  // ── Field labels and delimiters ───────────────────────────────────────────
  describe("patientName — field labels and delimiters", () => {
    it("stops at hyphen-prefixed field label like '-Rut del paciente'", () => {
      // Real case: "vacuna clustoid (50) Maximiliano Soto Hernández -Rut del paciente: 21825149-8"
      const { patientName } = extractPatientHints(
        "vacuna clustoid (50) Maximiliano Soto Hernández -Rut del paciente: 21825149-8",
        null,
      );
      expect(patientName).toBe("maximiliano soto hernandez");
    });

    it("handles comma-attached surname+word as two tokens (Xavier VIDAUX,vacuna)", () => {
      // Real case: "confirma vacuna mensual clustoid 50 Xavier VIDAUX, 21770139-2, 51 años"
      // "VIDAUX," with comma: comma is stripped → "vidaux" only, not "vidaux vacuna".
      const { patientName } = extractPatientHints(
        "confirma vacuna mensual clustoid 50 Xavier VIDAUX, 21770139-2, 51 años, isapre, concepcion, 961552808",
        null,
      );
      expect(patientName).toBe("xavier vidaux");
    });

    it("does not include 'rut' as a name token", () => {
      // "rut" is a common label abbreviation (Rol Único Tributario), not a name.
      const { patientName } = extractPatientHints(
        "llego,Amanda valentina gallardo gonzález rut 22341364-1",
        null,
      );
      expect(patientName).toBe("amanda valentina gallardo gonzalez");
    });

    it("extracts name from summaries with comma-separated segments", () => {
      // Real case: "confirma Joaquin Garcia Torres, dosis mensual clustoid (60)"
      const { patientName } = extractPatientHints(
        "confirma Joaquin Garcia Torres, dosis mensual clustoid (60)",
        null,
      );
      expect(patientName).toBe("joaquin garcia torres");
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

describe("extractIdentityHints", () => {
  it("assigns the first RUT to patient and the second to beneficiary", () => {
    const result = extractIdentityHints(
      "Roxair Juan Pérez 12.345.678-5",
      "Boleta a nombre de María Pérez 9.876.543-2",
    );

    expect(result.patientRut).toBe("12345678-5");
    expect(result.beneficiaryRut).toBe("9876543-2");
  });

  it("keeps beneficiary null when only one identity is present", () => {
    const result = extractIdentityHints("Test cutáneo Ana Soto 12.345.678-5", null);

    expect(result.patientRut).toBe("12345678-5");
    expect(result.beneficiaryRut).toBeNull();
  });
});
