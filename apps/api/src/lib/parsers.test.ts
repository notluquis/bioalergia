import { describe, it, expect } from "vitest";
import { parseCalendarMetadata } from "./parsers.ts";

describe("parseCalendarMetadata - Classification Issues", () => {
  it("should classify 'vacuna clust 0,5ml' as Tratamiento subcutáneo with Mantención stage", () => {
    const result = parseCalendarMetadata({
      summary: "Sergio Jara Hermosilla (60) vacuna clust 0,5ml",
      description: "",
    });

    expect(result.category).toBe("Tratamiento subcutáneo");
    expect(result.treatmentStage).toBe("Mantención");
    expect(result.dosageValue).toBe(0.5);
    expect(result.dosageUnit).toBe("ml");
  });

  it("should keep explicit 4th dose as induction even when amount implies 0.5ml", () => {
    const result = parseCalendarMetadata({
      summary: "4ta dosis acaros(50) clustoid: Marco Peña Medina",
      description: "",
    });

    expect(result.category).toBe("Tratamiento subcutáneo");
    expect(result.treatmentStage).toBe("Inducción");
    expect(result.seriesStageKind).toBe("DOSE");
    expect(result.seriesStageLabel).toBe("4ta dosis");
    expect(result.seriesStageNumber).toBe(4);
    expect(result.dosageValue).toBeNull();
  });

  it("should keep explicit monthly dose as maintenance even with an ordinal marker", () => {
    const result = parseCalendarMetadata({
      summary: "5ta dosis mensual clustoid Marco Peña Medina",
      description: "",
    });

    expect(result.category).toBe("Tratamiento subcutáneo");
    expect(result.treatmentStage).toBe("Mantención");
    expect(result.seriesStageKind).toBe("MAINTENANCE");
    expect(result.seriesStageLabel).toBe("Mantención");
  });

  it("should classify '1ra lec S/C test parche' as Test y exámenes", () => {
    const result = parseCalendarMetadata({
      summary: "1ra lec S/C test parche tomas david mellado parra",
      description: "",
    });

    expect(result.category).toBe("Test y exámenes");
  });

  it("should classify 'test de parche' alone as Test y exámenes", () => {
    const result = parseCalendarMetadata({
      summary: "test de parche",
      description: "",
    });

    expect(result.category).toBe("Test y exámenes");
  });

  it("should classify 'vacuna' as Tratamiento subcutáneo", () => {
    const result = parseCalendarMetadata({
      summary: "vacuna",
      description: "",
    });

    expect(result.category).toBe("Tratamiento subcutáneo");
  });

  it("should prefer subcutaneous vaccine signals in the summary over exam mentions in the description", () => {
    const result = parseCalendarMetadata({
      summary: "confirma Maite Gajardo Sepulveda, vacuna ácaros (50)",
      description:
        "dosis de mantencion acaros (50)\nEdad: 11 años\nRUT: 24170380-0\nComuna: concepcion\nPrevisión: consalud\nTeléfono: 972727212\n\ncontinuas alergias, asma, muchos resfríos, tiene examenes de sangre\nprefiere ver a doctor primero",
    });

    expect(result.category).toBe("Tratamiento subcutáneo");
    expect(result.clinicalSeriesKind).toBe("SUBCUTANEOUS_TREATMENT");
    expect(result.treatmentStage).toBe("Mantención");
  });

  it("should keep patch test events as tests even if the summary also mentions acaros and vacuna", () => {
    const result = parseCalendarMetadata({
      summary:
        "16.10 1 lectura test de parche, test cutaneo panel 1, acaros, 4, 5 y Grupo los 8 (80 autorizado por el doctor) Pamela Andaur Arenas",
      description:
        "Pamela Andaur Arenas, 14.324.845-3, 45 años, Concepción, Nueva mas vida,995083273 , pamandaur@gmail.com\nDermatitis atópica en ambas manos",
    });

    expect(result.category).toBe("Test y exámenes");
    expect(result.clinicalSeriesKind).toBe("PATCH_TEST");
    expect(result.seriesStageKind).toBe("READING");
    expect(result.seriesStageNumber).toBe(1);
  });

  it("should classify roxair with default amount 150000", () => {
    const result = parseCalendarMetadata({
      summary: "RETIRA ROXAIR (pagado): Alondra Valenzuela",
      description: "",
    });

    expect(result.category).toBe("Roxair");
    expect(result.amountExpected).toBe(150000);
    expect(result.amountPaid).toBe(150000);
  });

  it("should mark explicit no-show as not attended", () => {
    const result = parseCalendarMetadata({
      summary: "no viene hoy",
      description: "",
    });

    expect(result.attended).toBe(false);
    expect(result.amountPaid).toBe(0);
  });

  it("should mark 'no podrá asistir' as not attended", () => {
    const result = parseCalendarMetadata({
      summary: "Paciente no podrá asistir",
      description: "",
    });

    expect(result.attended).toBe(false);
    expect(result.amountPaid).toBe(0);
  });

  it("should mark 'cancelo la hora' as not attended and unpaid", () => {
    const result = parseCalendarMetadata({
      summary: "cancelo la hora test de parche (60) Ana Graciela Figueroa Campos",
      description: "ESPERADO $60.000 PAGADO $0 ASISTENCIA PENDIENTE CONFIRMADO",
    });

    expect(result.category).toBe("Test y exámenes");
    expect(result.attended).toBe(false);
    expect(result.amountExpected).toBe(60000);
    expect(result.amountPaid).toBe(0);
  });

  it("should keep pending confirmation unpaid", () => {
    const result = parseCalendarMetadata({
      summary: "1era confirma 40 cristian",
      description: "",
    });

    expect(result.amountPaid).toBeNull();
    expect(result.attended).toBeNull();
  });

  it("should parse contextual test amount from 'ambiente 40'", () => {
    const result = parseCalendarMetadata({
      summary: "no viene test cutaneo ambiente 40 pedro neira alarcon",
      description: "arauco, 11 años , fonasa , 37714573",
    });

    expect(result.category).toBe("Test y exámenes");
    expect(result.amountExpected).toBe(40000);
    expect(result.attended).toBe(false);
    expect(result.amountPaid).toBe(0);
  });

  it("should infer attended for roxair when summary has 'listo'", () => {
    const result = parseCalendarMetadata({
      summary: "listo retirar roxair amalia rojas",
      description: "",
    });

    expect(result.category).toBe("Roxair");
    expect(result.attended).toBe(true);
    expect(result.amountExpected).toBe(150000);
  });

  it("should infer attended when summary has 'listo' even with roxair typo", () => {
    const result = parseCalendarMetadata({
      summary: "listo retirar roxai amalia rojas",
      description: "",
    });

    expect(result.category).toBe("Roxair");
    expect(result.attended).toBe(true);
    expect(result.amountExpected).toBe(150000);
  });

  it("should classify typo 'muñtitest' as Test y exámenes and infer skin test", () => {
    const result = parseCalendarMetadata({
      summary: "Matteo moreno gonzalez (30) muñtitest 1 2 3 g8",
      description: "",
    });

    expect(result.category).toBe("Test y exámenes");
    expect(result.clinicalSeriesKind).toBe("SKIN_TEST");
  });

  it("should parse attendance typo variants like 'lllego' and 'llegp'", () => {
    const typo1 = parseCalendarMetadata({
      summary: "lllego Constanza figueroa",
      description: "",
    });
    const typo2 = parseCalendarMetadata({
      summary: "LLEGP Domingo Miguelis Quijada",
      description: "",
    });
    const attached = parseCalendarMetadata({
      summary: "llegoKatherine Toledo schuffeneger",
      description: "",
    });

    expect(typo1.attended).toBe(true);
    expect(typo2.attended).toBe(true);
    expect(attached.attended).toBe(true);
  });

  it("should detect attached first dose numbers like 'llego1 dosis'", () => {
    const result = parseCalendarMetadata({
      summary: "llego1 dosis vacuna clustoid 0,1ml (20)Emilia Cardenas Faunes",
      description: "",
    });

    expect(result.category).toBe("Tratamiento subcutáneo");
    expect(result.treatmentStage).toBe("Inducción");
    expect(result.seriesStageKind).toBe("DOSE");
    expect(result.seriesStageLabel).toBe("1ra dosis");
    expect(result.seriesStageNumber).toBe(1);
  });

  it("should not parse '(1era dosis)' as amount and should keep trailing 20 as 20000", () => {
    const result = parseCalendarMetadata({
      summary:
        "lllego Constanza figueroa gonzalez, acaros + gramineas (clustoid) (1era dosis) 20)",
      description: "",
    });

    expect(result.amountExpected).toBe(20000);
  });

  it("should treat 'se la lleva' and 'se envio pagada' as domicilio and paid", () => {
    const takeAway = parseCalendarMetadata({
      summary: "se la lleva maria teresa hernandez pavez mantencion alxoid arboles 0.50(50)",
      description: "",
    });
    const sentPaid = parseCalendarMetadata({
      summary: "se envio pagada de vacuna mensual(50) Alyson gajardo Arriagada",
      description: "",
    });

    expect(takeAway.isDomicilio).toBe(true);
    expect(sentPaid.isDomicilio).toBe(true);
    expect(sentPaid.amountExpected).toBe(50000);
    expect(sentPaid.amountPaid).toBe(50000);
  });

  it("should treat 'se envia dosis mantencion' as domicilio, attended and paid", () => {
    const result = parseCalendarMetadata({
      summary: "se envia dosis mantencion clustoid 0,5ml(60). francisco pinto aravena",
      description: "ASISTENCIA PENDIENTE CONFIRMADO",
    });

    expect(result.category).toBe("Tratamiento subcutáneo");
    expect(result.treatmentStage).toBe("Mantención");
    expect(result.isDomicilio).toBe(true);
    expect(result.attended).toBe(true);
    expect(result.amountExpected).toBe(60000);
    expect(result.amountPaid).toBe(60000);
  });

  it("should detect maintenance from typo 'mesual' and default dosage 0.5ml", () => {
    const result = parseCalendarMetadata({
      summary: "Paulina Andrea Parra Vásquez, mesual dosis vacuna acaros + gramineas (clustoid)(60",
      description: "",
    });

    expect(result.category).toBe("Tratamiento subcutáneo");
    expect(result.treatmentStage).toBe("Mantención");
    expect(result.dosageValue).toBe(0.5);
    expect(result.dosageUnit).toBe("ml");
  });

  it("should default to maintenance for generic 'dosis clustoid' with 60", () => {
    const result = parseCalendarMetadata({
      summary: "dosis clustoid benjamin mardones parra (60)",
      description: "",
    });

    expect(result.category).toBe("Tratamiento subcutáneo");
    expect(result.treatmentStage).toBe("Mantención");
    expect(result.dosageValue).toBe(0.5);
  });

  it("should infer maintenance for clustoid amount 50 without explicit stage", () => {
    const result = parseCalendarMetadata({
      summary: "Xavier VIDAUX,vacuna clustoid 50",
      description: "",
    });

    expect(result.category).toBe("Tratamiento subcutáneo");
    expect(result.treatmentStage).toBe("Mantención");
    expect(result.dosageValue).toBe(0.5);
  });

  it("should classify HTML-formatted calendar descriptions using normalized clinical text", () => {
    const result = parseCalendarMetadata({
      summary: "17:00confirma Pedro Eduardo Tiznado Rubio, dosis mesual clustoid (50)",
      description: [
        "<b>BOLETA: EDUARDO BEBIN SOLANO, 9543240-9</b>",
        "<br><b>Marta Rubio Gajardo, 8193485-1</b>",
        "<br><b><br></b><br>-Rut del paciente: 15175620-4 -Edad: 41 años -Comuna: Lota -Previsión: Fonasa -Número de contacto: 995990301",
        "<b><br></b><br>-Correo electrónico: <a href=\"mailto:pedro.tiznado@gmail.com\" target=\"_blank\">pedro.tiznado@gmail.com</a>",
        "<br>-Motivo de la consulta: Rinitis alérgica",
      ].join(""),
    });

    expect(result.category).toBe("Tratamiento subcutáneo");
    expect(result.treatmentStage).toBe("Mantención");
    expect(result.amountExpected).toBe(50000);
    expect(result.amountPaid).toBeNull();
    expect(result.controlIncluded).toBe(false);
  });

  it("should infer induction for ordinal '3era dosis'", () => {
    const result = parseCalendarMetadata({
      summary: "Constanza figueroa gonzalez, acaros + gramineas (clustoid) (3era dosis) 40)",
      description: "",
    });

    expect(result.category).toBe("Tratamiento subcutáneo");
    expect(result.treatmentStage).toBe("Inducción");
    expect(result.amountExpected).toBe(40000);
  });

  it("should infer induction for subcutaneous amounts different from 50/60", () => {
    const result = parseCalendarMetadata({
      summary: "llego Renatop Esparza Contreras (20) clust acaros",
      description: "",
    });

    expect(result.category).toBe("Tratamiento subcutáneo");
    expect(result.treatmentStage).toBe("Inducción");
    expect(result.amountExpected).toBe(20000);
  });

  it("should not parse '(0,5)' dosage as amount when '(50)' exists", () => {
    const result = parseCalendarMetadata({
      summary: "llego Daniela pastorini aravena (0,5) dosis clust mantencion (50)",
      description:
        "ESPERADO $5.000 PAGADO $5.000 ASISTIÓ CONFIRMADO rut pcte: 18.810.653-6 30 fonasa coronel 944279758",
    });

    expect(result.category).toBe("Tratamiento subcutáneo");
    expect(result.dosageValue).toBe(0.5);
    expect(result.amountExpected).toBe(50000);
    expect(result.amountPaid).toBe(50000);
    expect(result.attended).toBe(true);
    expect(result.treatmentStage).toBe("Mantención");
  });

  it("should ignore mg as subcutaneous dosage and keep maintenance fallback in ml", () => {
    const result = parseCalendarMetadata({
      summary: "Maximiliano Soto Hernandez vacuna clustoid 10 mg (50)",
      description: "",
    });

    expect(result.category).toBe("Tratamiento subcutáneo");
    expect(result.treatmentStage).toBe("Mantención");
    expect(result.dosageValue).toBe(0.5);
    expect(result.dosageUnit).toBe("ml");
  });

  it("should ignore out-of-range integer liquid dosage for subcutaneous events", () => {
    const result = parseCalendarMetadata({
      summary: "Maximiliano Soto Hernandez vacuna clustoid 10 ml (50)",
      description: "",
    });

    expect(result.category).toBe("Tratamiento subcutáneo");
    expect(result.treatmentStage).toBe("Mantención");
    expect(result.dosageValue).toBe(0.5);
    expect(result.dosageUnit).toBe("ml");
  });

  // ── Gramíneas and word-form ordinals ─────────────────────────────────────
  it("classifies 'cuarta dosis Gramíneas' as Tratamiento subcutáneo", () => {
    // Real case: Valeria Palma Onetto events weren't classified because
    // SUBCUT_PATTERNS only handled digit-prefix ordinals (2da, 3ra) not word-form.
    const result = parseCalendarMetadata({
      summary: "Valeria Palma Onetto, cuarta dosis Gramíneas (Lucas emite boleta)",
      description: "937039005\ngramineas + arboles",
    });
    expect(result.category).toBe("Tratamiento subcutáneo");
  });

  it("classifies 'gramineas' alone as Tratamiento subcutáneo", () => {
    const result = parseCalendarMetadata({
      summary: "llego Rodrigo Soto, gramíneas mensual (50)",
      description: "",
    });
    expect(result.category).toBe("Tratamiento subcutáneo");
  });

  // ── Patch test typos ──────────────────────────────────────────────────────
  it("classifies '1ra lecura est de parche' as Test y exámenes despite typos", () => {
    // Real case: "lecura" (missing 't') + "est de parche" (leading 't' missing)
    const result = parseCalendarMetadata({
      summary: "llego 1ra lecura est de parche (60) felipe martinez osorio",
      description: "14 años\nhualpen\nfonasa\n23.847.555-4",
    });
    expect(result.category).toBe("Test y exámenes");
  });

  it("classifies standalone 'parche' as Test y exámenes", () => {
    const result = parseCalendarMetadata({
      summary: "llego lectura parche rosa diaz (30)",
      description: "",
    });
    expect(result.category).toBe("Test y exámenes");
  });

  // ── Schedule reminders (horario) ─────────────────────────────────────────
  it("should ignore 'horario vacunas mañana' schedule reminders", () => {
    // Real case: recurring admin event "horario vacunas MAÑANA 10:00 a 12:00 hrs."
    // has "vacunas" which used to classify it as Tratamiento subcutáneo,
    // producing a bogus 728-event series with no patient.
    const result = parseCalendarMetadata({
      summary: "horario vacunas MAÑANA 10:00 a 12:00 hrs.",
      description: "",
    });
    expect(result.category).toBeNull();
  });

  // ── Amount at end of summary (followed by description) ───────────────────
  it("extracts amount from 'N)' at end of summary even when description follows", () => {
    // Real case: Constanza's summary ends with "(3era dosis) 40)" but description
    // has patient contact info after — combined text end-fallback missed it.
    const result = parseCalendarMetadata({
      summary:
        "confirma, Constanza figueroa gonzalez, acaros + gramineas (clustoid) (3era dosis) 40)",
      description: "Constanza Carolina Figueroa González\n25.007.330-5\nc.gonzalez@gmail.com\n995060355",
    });
    expect(result.category).toBe("Tratamiento subcutáneo");
    expect(result.amountExpected).toBe(40_000);
  });
});
