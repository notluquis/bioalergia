import { describe, expect, it, vi } from "vitest";

// @finanzas/db/slices transitively imports db.$setOptions which the
// main db mock above does not provide. Self-contained factory required
// because vi.mock hoists above any outer references.
vi.mock("@finanzas/db/slices", () => {
  const noopDb = { $setOptions: () => noopDb };
  return { dbClinicalSeries: noopDb };
});

// Mock DB so the module can be imported without a real database connection
vi.mock("@finanzas/db", () => ({ db: {} }));

const { extractIdentityHints, extractPatientHints, inferHealthInsurance, resolveClinicalIdentity } =
  await import("../clinical-series.ts");

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
        null
      );
      expect(patientName).toBe("renato riquelme munoz");
    });

    it("extracts name from ALL-CAPS when mixed with lowercase tokens", () => {
      // "LLEGO" is a stopword; "PAULINA ANGÉLICA VIVEROS INZUNZA" should be extracted.
      const { patientName } = extractPatientHints(
        "LLEGO, vacuna clustoid 0,5 PAULINA ANGELICA VIVEROS INZUNZA (50)",
        null
      );
      expect(patientName).toBe("paulina angelica viveros inzunza");
    });

    // ── Title-case name in the middle of a mixed summary ────────────────────
    it("extracts Title-case name following lowercase clinical noise", () => {
      // Real pattern: "confirma,vacuna clustoid 0,5 Paulina Angélica Viveros Inzunza (50)"
      const { patientName } = extractPatientHints(
        "confirma,vacuna clustoid 0,5 Paulina Angélica Viveros Inzunza (50)",
        "ano por medio antibioticos asma"
      );
      expect(patientName).toBe("paulina angelica viveros inzunza");
    });

    // ── Compound surnames with particles ────────────────────────────────────
    it("extracts name with 'de la' compound surname via RUT-adjacent walk", () => {
      // "claudio de la cuadra" — "de" and "la" are particles (length <3) that
      // would break a plain walk; particle-aware logic keeps them.
      const { patientName } = extractPatientHints(
        "11:35 control test de parche claudio de la cuadra 967534216",
        null
      );
      expect(patientName).toBe("claudio de la cuadra");
    });
  });

  describe("patientName — stopword filtering", () => {
    it("does not use 'ambiental' as a name token", () => {
      const { patientName } = extractPatientHints("test cutaneo ambiental rosa pineda", null);
      // "ambiental" is a stopword — result should skip it and find "rosa pineda"
      expect(patientName).toBe("rosa pineda");
    });

    it("does not use 'cutaneo' as a name token", () => {
      // Real case: "llego Test cutaneo javiera vera" → should be "javiera vera"
      const { patientName } = extractPatientHints("llego Test cutaneo javiera vera", null);
      expect(patientName).toBe("javiera vera");
    });

    it("does not use 'avisara cuando pueda' as name tokens", () => {
      // Real case: secretary writes "avisara cuando pueda matias Aguirre (50) 0,5ml vacuna gramineas+acaros"
      // "avisara", "cuando", "pueda" are appointment notes, not name components.
      const { patientName } = extractPatientHints(
        "avisara cuando pueda matias Aguirre (50) 0,5ml vacuna gramineas+acaros",
        null
      );
      expect(patientName).toBe("matias aguirre");
    });

    it("does not use 'reagendara' as a name token", () => {
      const { patientName } = extractPatientHints("reagendara ingrid rivas vergara", null);
      expect(patientName).toBe("ingrid rivas vergara");
    });

    it("does not use 'vendra' as a name token", () => {
      const { patientName } = extractPatientHints(
        "avisara ella cuando vendra Marcela Andra Aravena Alarcón, Vacuna de refuerzo Clustoid 0,3(30)",
        null
      );
      expect(patientName).toBe("marcela andra aravena alarcon");
    });

    it("does not use the typo 'cosulta' as a name token", () => {
      const { patientName } = extractPatientHints(
        "16.38, 1era cosulta (40) pablo sanchez rivero, 16 años, 22.479.080-5",
        null
      );
      expect(patientName).toBe("pablo sanchez rivero");
    });

    it("does not treat schedule announcements as patient names", () => {
      const { patientName } = extractPatientHints(
        "horario vacunas MAÑANA 10:00 a 12:00 hrs.",
        null
      );
      expect(patientName).toBeNull();
    });

    it("extracts Mia Isabella San Martin from a structured summary without keeping clinical noise", () => {
      const { patientName } = extractPatientHints(
        "15.28 test cutaneo ambiental y aliment (80), Mia Isabella San Martín San Martín,Edad: 6 años, Mamá: Yohana San Martín, Numero de teléfono: 923761767 (solo whatsapp)",
        null
      );
      expect(patientName).toBe("mia isabella san martin san martin");
    });

    it("does not append a parent name written after the patient", () => {
      const { patientName } = extractPatientHints(
        "llego 14:47mantención Clustoid 50 mil (0.5 ml), Antonia Paz Concha Coronado, Cristian Concha Medina (papá), (7 años), 976068776, Alergias, Particular, Curanilahue",
        null
      );
      expect(patientName).toBe("antonia paz concha coronado");
    });

    it("does not append a parent name written with a leading parent label", () => {
      const { patientName } = extractPatientHints(
        "11:30 confirma,vacuna mantención Clustoid 50 mil (0.5ml),Antonia Paz Concha Coronado , 7 años, papá Cristian Concha Medina, Particular, Curanilahue, 976068776",
        null
      );
      expect(patientName).toBe("antonia paz concha coronado");
    });

    it("does not treat allergen/product tails as patient names", () => {
      const { patientName } = extractPatientHints(
        "Gustavo Saez mantencion Clustoid(50) gramineas cylondon dactilon",
        null
      );
      expect(patientName).toBe("gustavo saez");
    });

    it("does not append commune or diagnosis terms to the patient name", () => {
      const { patientName, patientRut } = extractPatientHints(
        "13.10,Vac. Clustoid (50) Gustavo Sáez Sáez,19.109.016-0 27 años, hualqui, rinitis alérgica, 994025774",
        null
      );
      expect(patientName).toBe("gustavo saez saez");
      expect(patientRut).toBe("19109016-0");
    });

    it("does not append commune or diagnosis terms when no rut is present", () => {
      const { patientName } = extractPatientHints(
        "11:30confirma, 1 dosis clustoid 25)Gustavo Saez Saez, 27 años, hualqui, rinitis alergica, 994025774",
        null
      );
      expect(patientName).toBe("gustavo saez saez");
    });

    it("does not keep age month text as part of the patient name", () => {
      const { patientName } = extractPatientHints(
        "17.40 Multitest 1.2.3. Ácaros, (40) Emilia Briones Vega, 5 años 8 meses, Fonasa, San Pedro, 944268788",
        null
      );
      expect(patientName).toBe("emilia briones vega");
    });

    it("does not keep age month text in alternate spelling variants", () => {
      const { patientName } = extractPatientHints(
        "12:40 Confirma Multitest 1.2.3. acaros(40) Emila Briones Vega, 5 años 8 meses, fonasa, San pedro de la paz,944268788",
        null
      );
      expect(patientName).toBe("emila briones vega");
    });

    it("does not use 'san pedro' as part of a patient name", () => {
      const { patientName } = extractPatientHints(
        "Vacuna Clustoid (50), Lucas medina, 13 años, San Pedro, 996990238",
        null
      );
      expect(patientName).toBe("lucas medina");
    });

    it("does not use 'san carlos' as part of a patient name", () => {
      const { patientName } = extractPatientHints(
        "se lleva vacuna de mayo Vacuna Clustoid 0,5ml, (50) Sara Muñoz Muñoz, 43 años, San Carlos, Fonasa, 984137627",
        null
      );
      expect(patientName).toBe("sara munoz munoz");
    });

    it("does not use 'vincular' or 'evento' as name tokens", () => {
      // If someone wrote "Vincular evento con boleta DTE" in a description,
      // those words must be filtered as stopwords.
      const { patientName } = extractPatientHints(
        "Vincular evento boleta DTE",
        "javiera vera paciente"
      );
      expect(patientName).toBe("javiera vera");
    });
  });

  describe("structured BOLETA parsing", () => {
    it("keeps patient rut outside the BOLETA block when age and patient rut come after billing data", () => {
      const hints = extractIdentityHints(
        "llego1 dosis vacuna clustoid 0,1ml (20)Emilia Cardenas Faunes",
        [
          "BOLETA:Oscar Cardenas Barrientos",
          "14041763-7",
          "oscar.car.bar@gmail.com",
          "993423246",
          "",
          "15 años",
          "23.250.312-2",
          "993423246",
        ].join("\n")
      );

      expect(hints.patientName).toBe("emilia cardenas faunes");
      expect(hints.patientRut).toBe("23250312-2");
      expect(hints.beneficiaryName).toBe("oscar cardenas barrientos");
      expect(hints.beneficiaryRut).toBe("14041763-7");
    });

    it("keeps explicit billing holder separated from the patient across induction doses", () => {
      const hints = extractIdentityHints(
        "llego 2da dosis vacuna clustoid 0,2ml (30)Emilia Cardenas Faunes",
        [
          "BOLETA:",
          "Oscar Cardenas Barrientos",
          "14041763-7",
          "oscar.car.bar@gmail.com",
          "993423246",
          "",
          "15 años",
          "23.250.312-2",
        ].join("\n")
      );

      expect(hints.patientName).toBe("emilia cardenas faunes");
      expect(hints.patientRut).toBe("23250312-2");
      expect(hints.beneficiaryName).toBe("oscar cardenas barrientos");
      expect(hints.beneficiaryRut).toBe("14041763-7");
    });

    it("extracts a patient RUT even when it is glued to the age annotation", () => {
      const hints = extractIdentityHints(
        "1327 Vacuna Clustoid (50), Lucas medina, 22988126-413 años, San Pedro, 996990238",
        null
      );

      expect(hints.patientName).toBe("lucas medina");
      expect(hints.patientRut).toBe("22988126-4");
      expect(hints.beneficiaryName).toBeNull();
      expect(hints.beneficiaryRut).toBeNull();
    });
  });

  describe("patientName — all-lowercase fallback (7+ chars per word)", () => {
    it("detects real case: celmira morales inostroza", () => {
      const { patientName } = extractPatientHints(
        "llego2da lec test de parche (60) celmira morales inostroza",
        null
      );
      expect(patientName).toBe("celmira morales inostroza");
    });

    it("detects a two-word lowercase name with long words", () => {
      const { patientName } = extractPatientHints("dosis 3 consuelo martinez", null);
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
      const { patientName } = extractPatientHints("Pedro Gonzalez tratamiento subcutaneo", null);
      expect(patientName).toBe("pedro gonzalez");
    });

    it("ignores medical noise in description when summary has a capitalized name", () => {
      // Real case: description contained "ano por medio antibioticos asma" while
      // ALL 12 event summaries show "Paulina Angélica Viveros Inzunza". The
      // capitalized extractor must win over the lowercase description noise.
      const { patientName } = extractPatientHints(
        "llego vacuna clustoid 0,5 Paulina Angélica Viveros Inzunza (50)",
        "ano por medio antibioticos asma"
      );
      expect(patientName).toBe("paulina angelica viveros inzunza");
    });

    it("detects lowercase names with shorter surnames when enough real tokens are present", () => {
      const { patientName } = extractPatientHints(
        "llego 2da dosis acaros 0,2ml(30); benjamin saez jaque",
        null
      );
      expect(patientName).toBe("benjamin saez jaque");
    });
  });

  // ── Stopword prefix glued to name ("llegodiego" → "diego") ──────────────
  describe("patientName — stopword prefix glued to name token", () => {
    it("strips 'llego' glued to the first name token", () => {
      // Real case: secretary types "llegodiego" without a space.
      // "llegodiego" alone is not a stopword; stripStopwordPrefix finds the
      // "llego" prefix and returns "diego", leaving "diego musiet" as the name.
      const { patientName } = extractPatientHints(
        "llegodiego musiet (50) clustoid 19511977-5",
        null
      );
      expect(patientName).toBe("diego musiet");
    });

    it("drops chained administrative prefixes with typos before the real patient name", () => {
      const { patientName } = extractPatientHints(
        "lleegoconfirma paola andrea gonzalez gamboa",
        null
      );
      expect(patientName).toBe("paola andrea gonzalez gamboa");
    });

    it("drops 'cancela hasta aviso' before the real patient name", () => {
      const { patientName } = extractPatientHints("cancela hasta aviso mario lopez gonzalez", null);
      expect(patientName).toBe("mario lopez gonzalez");
    });

    it("does not extract 'autorizado por doctor' as a person name", () => {
      // Real case: note "autorizado por doctor miriam" was matched as a
      // duplicate because isLikelyPersonName counted clinical words as tokens.
      const { patientName } = extractPatientHints(
        "autorizado por doctor miriam tratamiento subcutaneo",
        null
      );
      // Only "miriam" survives — 1 token < 2 required → no name extracted
      expect(patientName).toBeNull();
    });
  });

  // ── Clinical phrases mistaken for names ──────────────────────────────────
  describe("patientName — clinical phrases not treated as names", () => {
    it("does not extract 'inicio' as a name token", () => {
      // Real case: "inicio david merino" → "inicio" is a treatment start marker.
      const { patientName } = extractPatientHints(
        "inicio david merino subcutaneo acaros 26606696-1",
        null
      );
      // "david merino" has only 2 tokens, last is 6 chars — valid name
      expect(patientName).toBe("david merino");
    });

    it("does not extract 'alergia alimentaria' as a name", () => {
      // Real case: two series matched by name "alergia alimentaria" — both words
      // are allergy/medical terms and must be filtered.
      const { patientName } = extractPatientHints("alergia alimentaria test cutaneo", null);
      expect(patientName).toBeNull();
    });

    it("does not extract 'diagnostico de asma bronquial infantil' as a name", () => {
      const { patientName } = extractPatientHints(
        "diagnostico de asma bronquial infantil test cutaneo ambiental",
        null
      );
      expect(patientName).toBeNull();
    });

    it("does not extract 'tomo antihistaminico' as a name", () => {
      const { patientName } = extractPatientHints("tomo antihistaminico parche", null);
      expect(patientName).toBeNull();
    });

    it("does not extract 'solo examen' as a name", () => {
      const { patientName } = extractPatientHints("solo examen test cutaneo", null);
      expect(patientName).toBeNull();
    });

    it("does not include 's/c' (sin costo) abbreviation in patient name", () => {
      // Real case: "s/c Ignacio Vergara Guzman 19813018-4" — "s/c" normalizes
      // to "s c" (3 chars total) which used to pass the `n.length < 3` check
      // even though each individual word is only 1 char.
      const { patientName } = extractPatientHints("s/c Ignacio Vergara Guzman 19813018-4", null);
      expect(patientName).toBe("ignacio vergara guzman");
      expect(patientName).not.toContain("s c");
    });

    it("does not include 's/cacaros' prefix before the patient name", () => {
      const { patientName } = extractPatientHints(
        "15:42 CONTROL dosis de mantencion s/cacaros (50) Maite Gajardo Sepulveda, 11 años, 24170380-0, concepcion, consalud, 24170380-0, 972727212",
        null
      );
      expect(patientName).toBe("maite gajardo sepulveda");
      expect(patientName).not.toContain("s cacaros");
    });

    it("stops backwards walk at 'clustoid' and does not strip it to 'oid'", () => {
      // Bug fix: stripStopwordPrefix ran before stopword check. "clustoid" was
      // stripped to "oid" (clust=prefix stopword) instead of breaking the walk.
      const { patientName } = extractPatientHints(
        "llegodiego musiet clustoid 0,5ml (50) 95703962-7",
        null
      );
      // "diego musiet" — "oid" must NOT appear in the extracted name
      expect(patientName).toBe("diego musiet");
      expect(patientName).not.toContain("oid");
    });
  });

  // ── Amount annotations and comma-joined stopwords ───────────────────────
  describe("patientName — amount annotations and comma-joined stopwords", () => {
    it("strips (N) amounts glued to the name token before backwards walk", () => {
      // Real case: "(50)luis" — the amount in parens was concatenated with the
      // first name with no space. Without stripping, normalizeName("(50)luis") →
      // "50 luis" → digit check broke the walk before reaching "luis".
      const { patientName } = extractPatientHints(
        "se lleva vacuna SE agosto y septiembre dosis (100)mensual clusitoid (50)luis villar castro, los alamos,fonasa, 994923189",
        null
      );
      expect(patientName).toBe("luis villar castro");
    });

    it("stops backwards walk at comma-joined stopwords like 'alamos,fonasa,'", () => {
      // Real case: "alamos,fonasa," is a single whitespace-token that normalizes
      // to "alamos fonasa". Without per-word checking, the full string wasn't in
      // the stopwords set so it leaked into the extracted name.
      const { patientName } = extractPatientHints(
        "dosis mensual clusitoid luis villar castro, los alamos,fonasa, 994923189",
        null
      );
      expect(patientName).toBe("luis villar castro");
    });

    it("stops backwards walk at comma-joined place+insurance like 'concepcion,isapre.'", () => {
      // Real case: "37 años,concepcion,isapre.973361751" — after age stripping
      // leaves ",concepcion,isapre." as one token. Per-word check must catch
      // "concepcion" (commune stopword) and break before adding it to the name.
      const { patientName } = extractPatientHints(
        "1602 test cutaneo ambiental II (30) lorena ortiz fierro. 37 años,concepcion,isapre.973361751",
        null
      );
      expect(patientName).toBe("lorena ortiz fierro");
    });

    it("does not include 'esquema' as part of the patient name", () => {
      const { patientName } = extractPatientHints("esquema florencia carrasco albornoz", null);
      expect(patientName).toBe("florencia carrasco albornoz");
    });

    it("does not include 'acaro' as part of the patient name", () => {
      const { patientName } = extractPatientHints("acaro nicolas vergara bustos", null);
      expect(patientName).toBe("nicolas vergara bustos");
    });
  });

  // ── Ordinal dose words ───────────────────────────────────────────────────
  describe("patientName — ordinal dose words", () => {
    it("does not include 'primera' after the name", () => {
      // Real case: "Valeria Palma Onetto, Primera dosis Gramíneas"
      // "Primera" is Title-case and passes the capitalized extractor unless
      // it is listed as a stopword.
      const { patientName } = extractPatientHints(
        "llego Valeria Palma Onetto, Primera dosis Gramíneas (Lucas emite boleta)",
        null
      );
      expect(patientName).toBe("valeria palma onetto");
    });

    it("does not include 'segunda', 'tercera', 'cuarta' as name tokens", () => {
      for (const ordinal of ["segunda", "tercera", "cuarta", "quinta", "sexta"]) {
        const { patientName } = extractPatientHints(
          `llego Ana Soto Reyes ${ordinal} dosis clustoid (50)`,
          null
        );
        expect(patientName).toBe("ana soto reyes");
      }
    });
  });

  // ── Age annotations between name and RUT ────────────────────────────────
  describe("patientName — age annotation between name and RUT", () => {
    it("extracts name when 'N años:' separates it from the RUT", () => {
      // Real case: "llego test de parche(60mil), aero I(30): javiera rio: 18 años: 940951267"
      // "18 años:" must be stripped before the backwards walk, otherwise "18"
      // breaks the walk before we reach "javiera rio".
      // NOTE: 940951267 normalizes to 94095126-7 (valid checksum) but body ≥ 50M
      // → filtered as company RUT. Name extraction is the main assertion here.
      const { patientName } = extractPatientHints(
        "llego test de parche(60mil), aero I(30): javiera rio: 18 años: 940951267",
        null
      );
      expect(patientName).toBe("javiera rio");
    });

    it("extracts name before 'N años:' with three-part surname", () => {
      // Real case: "llego confir. test de parche, aer, ali: nicole roa zuchel: 35 años: 988330481"
      const { patientName } = extractPatientHints(
        "llego confir. test de parche, aer, ali: nicole roa zuchel: 35 años: 988330481",
        null
      );
      expect(patientName).toBe("nicole roa zuchel");
    });

    it("extracts short first name before 'N años;' separator", () => {
      // Real case: "llego test cutaneo mia brito; 2 años; 988388227"
      const { patientName } = extractPatientHints(
        "llego test cutaneo mia brito; 2 años; 988388227",
        null
      );
      expect(patientName).toBe("mia brito");
    });

    it("extracts name when digit is attached to the last surname token", () => {
      // Real case: "llego conf.test cutaneo amb mauricio san martin9 56750226"
      // "martin9" has a trailing digit that should be stripped before the walk.
      const { patientName } = extractPatientHints(
        "llego conf.test cutaneo amb mauricio san martin9 56750226",
        null
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
        "ano por medio antibioticos asma"
      );
      expect(patientName).toBe("paulina angelica viveros inzunza");
    });

    it("summary name wins over description field labels", () => {
      // Real case: older Maximiliano events had structured description with
      // "-Rut del paciente:", "-Previsión: Colmena", "-Número de contacto:" etc.
      // that should never override the clearly-named summary.
      const { patientName } = extractPatientHints(
        "llego Maximiliano Soto Hernández ,vacuna clustoid (50)",
        "-Rut del paciente: 21825149-8 -Edad: 18 años -Previsión: Colmena -Número de contacto: 97583527"
      );
      expect(patientName).toBe("maximiliano soto hernandez");
    });

    it("description name used when summary has none", () => {
      const { patientName } = extractPatientHints(
        "dosis mensual clustoid",
        "celmira morales inostroza"
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
        null
      );
      expect(patientName).toBe("maximiliano soto hernandez");
    });

    it("handles comma-attached surname+word as two tokens (Xavier VIDAUX,vacuna)", () => {
      // Real case: "confirma vacuna mensual clustoid 50 Xavier VIDAUX, 21770139-2, 51 años"
      // "VIDAUX," with comma: comma is stripped → "vidaux" only, not "vidaux vacuna".
      const { patientName } = extractPatientHints(
        "confirma vacuna mensual clustoid 50 Xavier VIDAUX, 21770139-2, 51 años, isapre, concepcion, 961552808",
        null
      );
      expect(patientName).toBe("xavier vidaux");
    });

    it("does not include 'rut' as a name token", () => {
      // "rut" is a common label abbreviation (Rol Único Tributario), not a name.
      const { patientName } = extractPatientHints(
        "llego,Amanda valentina gallardo gonzález rut 22341364-1",
        null
      );
      expect(patientName).toBe("amanda valentina gallardo gonzalez");
    });

    it("extracts name from summaries with comma-separated segments", () => {
      // Real case: "confirma Joaquin Garcia Torres, dosis mensual clustoid (60)"
      const { patientName } = extractPatientHints(
        "confirma Joaquin Garcia Torres, dosis mensual clustoid (60)",
        null
      );
      expect(patientName).toBe("joaquin garcia torres");
    });

    it("does not include hyphen-prefixed labels like -edad -comuna florida -prevision", () => {
      const { patientName } = extractPatientHints(
        "nicolas vergara bustos -edad 18 años -comuna florida -prevision colmena",
        null
      );
      expect(patientName).toBe("nicolas vergara bustos");
    });

    it("does not include insurance phrases like 'mas vida' as part of the patient name", () => {
      const { patientName } = extractPatientHints("mas vida nicolas vergara bustos", null);
      expect(patientName).toBe("nicolas vergara bustos");
    });

    it("does not include short insurance prefixes like 'ban' as part of the patient name", () => {
      const { patientName } = extractPatientHints("ban esteban escobar ortiz", null);
      expect(patientName).toBe("esteban escobar ortiz");
    });

    it("does not include locality tails like 'yerbas buenas linares' as part of the patient name", () => {
      const { patientName } = extractPatientHints(
        "maria gonzalez soto yerbas buenas linares",
        null
      );
      expect(patientName).toBe("maria gonzalez soto");
    });

    it("does not include locality tails like 'los alamos' as part of the patient name", () => {
      const { patientName } = extractPatientHints("damaris villar castro los alamos", null);
      expect(patientName).toBe("damaris villar castro");
    });

    it("does not treat admin or clinical phrases like 'alimentaria y ahora evaluacion de porque' as a name", () => {
      const { patientName } = extractPatientHints("alimentaria y ahora evaluacion de porque", null);
      expect(patientName).toBeNull();
    });

    it("does not include symptom chatter like 'resfria mucho' as part of the patient name", () => {
      const { patientName } = extractPatientHints(
        "resfria mucho carolina elizabeth fierro moya",
        null
      );
      expect(patientName).toBe("carolina elizabeth fierro moya");
    });

    it("strips glued symptom chatter like 'muchocarolina' before the patient name", () => {
      const { patientName } = extractPatientHints(
        "resfria muchocarolina elizabeth fierro moya",
        null
      );
      expect(patientName).toBe("carolina elizabeth fierro moya");
    });
  });

  describe("patientRut", () => {
    it("extracts a RUT with dots and dash", () => {
      // 12.345.678-5: DV = 11 - (138 % 11) = 11 - 6 = 5 ✓
      const { patientRut } = extractPatientHints("12.345.678-5 Juan Pérez", null);
      expect(patientRut).not.toBeNull();
    });

    it("extracts a valid unformatted RUT when it passes checksum", () => {
      const { patientRut } = extractPatientHints("123456785 Juan Pérez", null);
      expect(patientRut).toBe("12345678-5");
    });

    it("rejects bare phone-like numbers without RUT label", () => {
      const { patientName, patientRut } = extractPatientHints(
        "MULTITEST DANIEL IBAÑEZ 56251216",
        null
      );
      expect(patientName).toBe("daniel ibanez");
      expect(patientRut).toBeNull();
    });

    it("rejects bare mobile-like numbers that start with 9", () => {
      const { patientName, patientRut } = extractPatientHints(
        "LLEGO Control multitest Daniel Ibañez; 956251216",
        null
      );
      expect(patientName).toBe("daniel ibanez");
      expect(patientRut).toBeNull();
    });

    it("extracts name and RUT together from real event text", () => {
      const { patientName, patientRut } = extractPatientHints(
        "llego2da lec test de parche (60) celmira morales inostroza",
        "19511977-5"
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
    // 9.876.543-3: DV = 11 - (184 % 11) = 11 - 8 = 3 ✓
    const result = extractIdentityHints(
      "Roxair Juan Pérez 12.345.678-5",
      "Boleta a nombre de María Pérez 9.876.543-3"
    );

    expect(result.patientRut).toBe("12345678-5");
    expect(result.beneficiaryRut).toBe("9876543-3");
  });

  it("keeps beneficiary null when only one identity is present", () => {
    const result = extractIdentityHints("Test cutáneo Ana Soto 12.345.678-5", null);

    expect(result.patientRut).toBe("12345678-5");
    expect(result.beneficiaryRut).toBeNull();
  });

  it("rejects company RUTs (numeric body ≥ 50M)", () => {
    // Company RUTs in Chile are typically ≥ 50,000,000.
    // The clinic only serves natural persons — company RUTs must be filtered out.
    // 76.354.771-K: valid checksum but company RUT
    const result = extractIdentityHints("vacuna clustoid 76.354.771-K Ana López", null);
    expect(result.patientRut).toBeNull();
  });

  it("accepts personal RUT below 50M even with wrong check digit (secretary typo)", () => {
    // Real case: 26.606.696-1 has correct DV=5 but was typed as -1 by the secretary.
    // We keep it so duplicate detection can still match two series with the same typo'd RUT.
    const result = extractIdentityHints("jose luis ojeda 26.606.696-1", null);
    expect(result.patientRut).toBe("26606696-1");
  });

  it("accepts valid personal RUT below 50M threshold", () => {
    // Personal RUTs are currently up to ~26M — must still be accepted.
    const result = extractIdentityHints("test cutaneo 12.345.678-5 Ana López", null);
    expect(result.patientRut).toBe("12345678-5");
  });

  it("prefers '-Rut del paciente' over BOLETA recipients when assigning patient identity", () => {
    const result = extractIdentityHints(
      "confirmaPedro Tiznado rubio Dosis mensual clustoid (50)",
      [
        "BOLETA: EDUARDO BEBIN SOLANO, 9543240-9",
        "Marta Rubio Gajardo, 8193485-1",
        "",
        "-Rut del paciente: 15175620-4 -Edad: 41 años -Comuna: Lota -Previsión: Fonasa -Número de contacto: 995990301",
        "-Correo electrónico: pedro.tiznado@gmail.com",
        "-Motivo de la consulta: Rinitis alérgica",
      ].join("\n")
    );

    expect(result.patientName).toBe("pedro tiznado rubio");
    expect(result.patientRut).toBe("15175620-4");
    expect(result.beneficiaryName).toBe("eduardo bebin solano");
    expect(result.beneficiaryRut).toBe("9543240-9");
  });

  it("does not let BOLETA names override the patient name when the summary already identifies the patient", () => {
    const result = extractIdentityHints(
      "Pedro Tiznado rubio Dosis mensual clustoid (50) (0,5)",
      [
        "BOLETA: MARTA RUBIO GAJARDO, 8193485-1",
        "",
        "-Rut del paciente: 15175620-4 -Edad: 41 años -Comuna: Lota -Previsión: Fonasa",
      ].join("\n")
    );

    expect(result.patientName).toBe("pedro tiznado rubio");
    expect(result.patientRut).toBe("15175620-4");
    expect(result.beneficiaryName).toBe("marta rubio gajardo");
    expect(result.beneficiaryRut).toBe("8193485-1");
  });

  it("parses HTML-formatted Google Calendar descriptions before extracting patient and beneficiary RUTs", () => {
    const result = extractIdentityHints(
      "17:00confirma Pedro Eduardo Tiznado Rubio, dosis mesual clustoid (50)",
      [
        "<b>BOLETA: EDUARDO BEBIN SOLANO, 9543240-9</b>",
        "<br><b>Marta Rubio Gajardo, 8193485-1</b>",
        "<br><b><br></b><br>-Rut del paciente: 15175620-4 -Edad: 41 años -Comuna: Lota -Previsión: Fonasa -Número de contacto: 995990301",
        '<b><br></b><br>-Correo electrónico: <a href="mailto:pedro.tiznado@gmail.com" target="_blank">pedro.tiznado@gmail.com</a>',
        "<br>-Motivo de la consulta: Rinitis alérgica",
        "<br>-Tiempo de evolución: 20 años -Tratamiento usado: diferentes antihistamínicos, puff nasal",
        "<br>-Enfermedades base: ninguna",
      ].join("")
    );

    expect(result.patientName).toBe("pedro eduardo tiznado rubio");
    expect(result.patientRut).toBe("15175620-4");
    expect(result.beneficiaryName).toBe("eduardo bebin solano");
    expect(result.beneficiaryRut).toBe("9543240-9");
  });

  it("does not invent a beneficiary from structured clinical history when only the patient is identified", () => {
    const result = extractIdentityHints(
      "11.11 test cutaneo ambiental I (40) Pedro Eduardo Tiznado Rubio -Rut del paciente: 15175620-4 -Edad: 41 años -Comuna: Lota -Previsión: Fonasa -Número de contacto: 995990301",
      [
        "-Correo electrónico: pedro.tiznado@gmail.com",
        "-Motivo de la consulta: Rinitis alérgica",
        "-Tiempo de evolución: 20 años",
        "-Tratamiento usado: diferentes antihistamínicos, puff nasal",
        "-Enfermedades base: ninguna",
      ].join("\n")
    );

    expect(result.patientName).toBe("pedro eduardo tiznado rubio");
    expect(result.patientRut).toBe("15175620-4");
    expect(result.beneficiaryName).toBeNull();
    expect(result.beneficiaryRut).toBeNull();
  });

  it("does not invent a beneficiary from unlabeled contact and email lines", () => {
    const result = extractIdentityHints(
      "Test cutaneo Antonella hermosilla Ortega",
      [
        "Antonella hermosilla Ortega",
        "22.710.901-7",
        "17 años",
        "Coronel",
        "FONASA",
        "949394164",
        "antonellahermosill4@gmail.com",
      ].join("\n")
    );

    expect(result.patientName).toBe("antonella hermosilla ortega");
    expect(result.patientRut).toBe("22710901-7");
    expect(result.beneficiaryName).toBeNull();
    expect(result.beneficiaryRut).toBeNull();
  });

  it("does not invent a beneficiary from HTML email anchors or clinical history text", () => {
    const result = extractIdentityHints(
      "1450 Vacuna clustoid (50) Vicente Agustin Paredes Cruces",
      [
        "12254595-8",
        "11 años",
        "Coronel",
        "Particular",
        "977733560",
        '-Correo electrónico: <a href="mailto:Coratoti@gmail.com" target="_blank">Coratoti@gmail.com</a>',
        "-Motivo de la consulta: Dermatitis cronica",
        "-Tratamiento usado: Desloratadina, unguentos",
      ].join("\n")
    );

    expect(result.patientName).toBe("vicente agustin paredes cruces");
    expect(result.patientRut).toBe("12254595-8");
    expect(result.beneficiaryName).toBeNull();
    expect(result.beneficiaryRut).toBeNull();
  });

  it("does not append clinical complaint adjectives to the patient name", () => {
    const result = extractIdentityHints(
      "LLEGO, Test cutáneo Aero ambiental 40 mil, Valeria Palma Onetto, 31 años, Alergia fuerte a pastos y polen. Desea iniciar tratamiento de inmunoterapia, Concepción, Fonasa, 937039005",
      null
    );

    expect(result.patientName).toBe("valeria palma onetto");
    expect(result.patientRut).toBeNull();
  });
});

describe("resolveClinicalIdentity", () => {
  it("does not keep a stale stored patient RUT when current text only contains a phone number", () => {
    const result = resolveClinicalIdentity("MULTITEST DANIEL IBAÑEZ 56251216", null, {
      patientName: "daniel ibanez",
      patientRut: "5625121-6",
    });

    expect(result.patientName).toBe("daniel ibanez");
    expect(result.patientRut).toBeNull();
  });

  it("does not keep a stale stored beneficiary name when current text has no beneficiary", () => {
    const result = resolveClinicalIdentity(
      "Test cutaneo Antonella hermosilla Ortega",
      [
        "Antonella hermosilla Ortega",
        "22.710.901-7",
        "17 años",
        "Coronel",
        "FONASA",
        "949394164",
        "antonellahermosill4@gmail.com",
      ].join("\n"),
      {
        beneficiaryName: "gmail com",
        beneficiaryRut: "94939416-4",
        patientName: "antonella hermosilla ortega",
        patientRut: "22710901-7",
      }
    );

    expect(result.patientName).toBe("antonella hermosilla ortega");
    expect(result.patientRut).toBe("22710901-7");
    expect(result.beneficiaryName).toBeNull();
    expect(result.beneficiaryRut).toBeNull();
  });

  it("falls back to stored values only when the event has no identity text at all", () => {
    const result = resolveClinicalIdentity(null, null, {
      beneficiaryName: "marta rubio gajardo",
      beneficiaryRut: "8193485-1",
      patientName: "pedro tiznado rubio",
      patientRut: "15175620-4",
    });

    expect(result.patientName).toBe("pedro tiznado rubio");
    expect(result.patientRut).toBe("15175620-4");
    expect(result.beneficiaryName).toBe("marta rubio gajardo");
    expect(result.beneficiaryRut).toBe("8193485-1");
  });
});

describe("inferHealthInsurance", () => {
  it("uses the last 3 events and resolves the majority insurance type", () => {
    const result = inferHealthInsurance([
      { description: "prevision fonasa", eventDate: "2026-04-01", summary: "control" },
      { description: "prevision fonasa", eventDate: "2026-04-03", summary: "control" },
      { description: "prevision consalud", eventDate: "2026-04-05", summary: "control" },
      { description: "prevision particular", eventDate: "2026-01-01", summary: "viejo" },
    ]);

    expect(result).toEqual({
      healthInsurance: "FONASA",
      isapreName: null,
    });
  });

  it("returns the dominant isapre name from the last 3 events", () => {
    const result = inferHealthInsurance([
      { description: "isapre colmena", eventDate: "2026-04-01", summary: "control" },
      { description: "isapre consalud", eventDate: "2026-04-03", summary: "control" },
      {
        description: "prevision colmena golden cross",
        eventDate: "2026-04-05",
        summary: "control",
      },
    ]);

    expect(result).toEqual({
      healthInsurance: "ISAPRE",
      isapreName: "Colmena",
    });
  });

  it("returns indeterminate when the last 3 events tie across insurance types", () => {
    const result = inferHealthInsurance([
      { description: "fonasa", eventDate: "2026-04-01", summary: "control" },
      { description: "particular", eventDate: "2026-04-03", summary: "control" },
      { description: "isapre banmedica", eventDate: "2026-04-05", summary: "control" },
    ]);

    expect(result).toEqual({
      healthInsurance: null,
      isapreName: null,
    });
  });
});
