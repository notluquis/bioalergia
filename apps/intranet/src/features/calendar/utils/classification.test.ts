import { describe, expect, it } from "vitest";
import type { CalendarUnclassifiedEvent } from "@/features/calendar/types";
import {
  buildDefaultEntry,
  buildPayload,
  eventKey,
  isExplicitNoShowEvent,
  parseAmountInput,
} from "./classification";

// Minimal CalendarUnclassifiedEvent factory
function makeEvent(overrides: Partial<CalendarUnclassifiedEvent> = {}): CalendarUnclassifiedEvent {
  return {
    amountExpected: null,
    amountPaid: null,
    attended: null,
    calendarId: "cal-1",
    category: null,
    clinicalSeriesId: null,
    description: null,
    dosageUnit: null,
    dosageValue: null,
    endDate: null,
    endDateTime: null,
    eventId: "evt-1",
    eventType: null,
    seriesStageKind: null,
    seriesStageLabel: null,
    seriesStageNumber: null,
    startDate: null,
    startDateTime: null,
    status: null,
    summary: null,
    testMetadata: null,
    treatmentStage: null,
    ...overrides,
  };
}

// ─── parseAmountInput ──────────────────────────────────────────────────────────

describe("parseAmountInput", () => {
  it("returns null for null", () => {
    expect(parseAmountInput(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(parseAmountInput(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseAmountInput("")).toBeNull();
  });

  it("parses a plain integer string", () => {
    expect(parseAmountInput("50000")).toBe(50000);
  });

  it("strips non-digit characters (currency formatting)", () => {
    expect(parseAmountInput("$1.500.000")).toBe(1500000);
  });

  it("strips dots and commas", () => {
    expect(parseAmountInput("1,000")).toBe(1000);
  });

  it("returns null when string contains only non-digits", () => {
    expect(parseAmountInput("abc")).toBeNull();
  });

  it("parses '0' as 0", () => {
    expect(parseAmountInput("0")).toBe(0);
  });

  it("strips spaces and parses correctly", () => {
    expect(parseAmountInput("$ 25 000")).toBe(25000);
  });
});

// ─── isExplicitNoShowEvent ─────────────────────────────────────────────────────

describe("isExplicitNoShowEvent", () => {
  it("returns false when summary and description are null", () => {
    expect(isExplicitNoShowEvent({ summary: null, description: null })).toBe(false);
  });

  it("detects 'no viene' in summary (case insensitive)", () => {
    expect(isExplicitNoShowEvent({ summary: "No viene", description: null })).toBe(true);
  });

  it("detects 'no vino' in description", () => {
    expect(isExplicitNoShowEvent({ summary: null, description: "el paciente no vino" })).toBe(true);
  });

  it("detects 'no asiste' (case insensitive)", () => {
    expect(isExplicitNoShowEvent({ summary: "No Asiste mañana", description: null })).toBe(true);
  });

  it("detects 'no asistio' without accent (pattern covers both forms)", () => {
    // The pattern uses [oó] so both forms match
    expect(isExplicitNoShowEvent({ summary: "no asistio hoy", description: null })).toBe(true);
  });

  it("detects 'no asistio' without accent", () => {
    expect(isExplicitNoShowEvent({ summary: "no asistio", description: null })).toBe(true);
  });

  it("detects 'no podrá asistir'", () => {
    expect(isExplicitNoShowEvent({ summary: "no podrá asistir", description: null })).toBe(true);
  });

  it("does not trigger on partial word 'noviene'", () => {
    expect(isExplicitNoShowEvent({ summary: "noviene", description: null })).toBe(false);
  });

  it("returns false for normal positive event text", () => {
    expect(isExplicitNoShowEvent({ summary: "Consulta Dra. García", description: "listo" })).toBe(
      false
    );
  });

  it("checks both summary and description combined", () => {
    expect(isExplicitNoShowEvent({ summary: "Consulta", description: "no viene" })).toBe(true);
  });
});

// ─── eventKey ─────────────────────────────────────────────────────────────────

describe("eventKey", () => {
  it("produces a composite key with ::: separator", () => {
    expect(eventKey({ calendarId: "cal-abc", eventId: "evt-xyz" })).toBe("cal-abc:::evt-xyz");
  });

  it("different calendarIds produce different keys", () => {
    const k1 = eventKey({ calendarId: "A", eventId: "1" });
    const k2 = eventKey({ calendarId: "B", eventId: "1" });
    expect(k1).not.toBe(k2);
  });

  it("different eventIds produce different keys", () => {
    const k1 = eventKey({ calendarId: "A", eventId: "1" });
    const k2 = eventKey({ calendarId: "A", eventId: "2" });
    expect(k1).not.toBe(k2);
  });
});

// ─── buildDefaultEntry ────────────────────────────────────────────────────────

describe("buildDefaultEntry", () => {
  it("returns empty strings for null amounts", () => {
    const entry = buildDefaultEntry(makeEvent());
    expect(entry.amountExpected).toBe("");
    expect(entry.amountPaid).toBe("");
  });

  it("converts non-null amountExpected to string", () => {
    const entry = buildDefaultEntry(makeEvent({ amountExpected: 30000 }));
    expect(entry.amountExpected).toBe("30000");
  });

  it("converts non-null amountPaid to string", () => {
    const entry = buildDefaultEntry(makeEvent({ amountPaid: 15000 }));
    expect(entry.amountPaid).toBe("15000");
  });

  it("sets Roxair default amount when category is Roxair and amountExpected is null", () => {
    const entry = buildDefaultEntry(makeEvent({ category: "Roxair", amountExpected: null }));
    expect(entry.amountExpected).toBe("150000");
  });

  it("does NOT override Roxair default when amountExpected is already set", () => {
    const entry = buildDefaultEntry(makeEvent({ category: "Roxair", amountExpected: 80000 }));
    expect(entry.amountExpected).toBe("80000");
  });

  it("infers attended=false when event is a no-show", () => {
    const entry = buildDefaultEntry(makeEvent({ summary: "no viene" }));
    expect(entry.attended).toBe(false);
  });

  it("infers attended=true when summary contains the word 'listo'", () => {
    // The pattern is \blisto\b (word boundary), so "listo" must appear as a whole word
    const entry = buildDefaultEntry(makeEvent({ summary: "Paciente listo" }));
    expect(entry.attended).toBe(true);
  });

  it("uses event.attended when present and no no-show keyword", () => {
    const entry = buildDefaultEntry(makeEvent({ attended: true }));
    expect(entry.attended).toBe(true);
  });

  it("preserves category trimmed from event", () => {
    const entry = buildDefaultEntry(makeEvent({ category: "  Consulta  " }));
    expect(entry.category).toBe("Consulta");
  });

  it("maps testMetadata fields to individual booleans", () => {
    const entry = buildDefaultEntry(
      makeEvent({
        testMetadata: {
          skinTest: true,
          patchTest: false,
          firstReading: true,
          secondReading: false,
          thirdReading: true,
        },
      })
    );
    expect(entry.testSubtypeSkin).toBe(true);
    expect(entry.testSubtypePatch).toBe(false);
    expect(entry.testPatchFirstReading).toBe(true);
    expect(entry.testPatchSecondReading).toBe(false);
    expect(entry.testPatchThirdReading).toBe(true);
  });

  it("defaults all testMetadata booleans to false when null", () => {
    const entry = buildDefaultEntry(makeEvent({ testMetadata: null }));
    expect(entry.testSubtypeSkin).toBe(false);
    expect(entry.testSubtypePatch).toBe(false);
    expect(entry.testPatchFirstReading).toBe(false);
    expect(entry.testPatchSecondReading).toBe(false);
    expect(entry.testPatchThirdReading).toBe(false);
  });
});

// ─── buildPayload ──────────────────────────────────────────────────────────────

describe("buildPayload", () => {
  const baseEntry = {
    attended: true,
    amountExpected: "30000",
    amountPaid: "30000",
    category: "Consulta",
    clinicalSeriesId: null,
    dosageValue: "",
    dosageUnit: "",
    seriesStageKind: null,
    seriesStageLabel: null,
    seriesStageNumber: null,
    testPatchFirstReading: false,
    testPatchSecondReading: false,
    testPatchThirdReading: false,
    testSubtypePatch: false,
    testSubtypeSkin: false,
    treatmentStage: "",
  } as const;

  it("parses amountExpected from string entry", () => {
    const payload = buildPayload(baseEntry, makeEvent());
    expect(payload.amountExpected).toBe(30000);
  });

  it("sets attended=false when event is locked no-show", () => {
    const payload = buildPayload(
      { ...baseEntry, attended: true },
      makeEvent({ summary: "no viene" })
    );
    expect(payload.attended).toBe(false);
  });

  it("sets amountPaid=0 when attended is false", () => {
    const payload = buildPayload(
      { ...baseEntry, attended: false, amountPaid: "20000" },
      makeEvent()
    );
    expect(payload.amountPaid).toBe(0);
  });

  it("sets testMetadata to null for non-test categories", () => {
    const payload = buildPayload(baseEntry, makeEvent());
    expect(payload.testMetadata).toBeNull();
  });

  it("populates testMetadata for 'Test y exámenes' category", () => {
    const testEntry = {
      ...baseEntry,
      category: "Test y exámenes",
      testSubtypeSkin: true,
      testSubtypePatch: false,
      testPatchFirstReading: false,
      testPatchSecondReading: false,
      testPatchThirdReading: false,
    };
    const payload = buildPayload(testEntry, makeEvent());
    expect(payload.testMetadata).not.toBeNull();
    expect(payload.testMetadata?.skinTest).toBe(true);
  });

  it("sets amountExpected=0 when there is a patch reading", () => {
    const testEntry = {
      ...baseEntry,
      category: "Test y exámenes",
      testSubtypePatch: true,
      testPatchFirstReading: true,
      testPatchSecondReading: false,
      testPatchThirdReading: false,
    };
    const payload = buildPayload(testEntry, makeEvent());
    expect(payload.amountExpected).toBe(0);
    expect(payload.amountPaid).toBe(0);
  });

  it("applies Roxair default when category is Roxair and entry amount is empty", () => {
    const roxairEntry = { ...baseEntry, category: "Roxair", amountExpected: "" };
    const payload = buildPayload(roxairEntry, makeEvent({ amountExpected: null }));
    expect(payload.amountExpected).toBe(150000);
  });

  it("normalizes subcutaneous category casing/accents", () => {
    const entry = {
      ...baseEntry,
      category: "Tratamiento subcutáneo",
      treatmentStage: "Inducción",
    };
    const payload = buildPayload(entry, makeEvent());
    expect(payload.category).toBe("Tratamiento subcutáneo");
    expect(payload.treatmentStage).toBe("Inducción");
  });

  it("sets treatmentStage=null for non-subcutaneous category", () => {
    const payload = buildPayload({ ...baseEntry, treatmentStage: "Inducción" }, makeEvent());
    expect(payload.treatmentStage).toBeNull();
  });

  it("falls back to event.clinicalSeriesId when entry has none", () => {
    const payload = buildPayload(
      { ...baseEntry, clinicalSeriesId: null },
      makeEvent({ clinicalSeriesId: 42 })
    );
    expect(payload.clinicalSeriesId).toBe(42);
  });
});
