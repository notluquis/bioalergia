import { describe, expect, it, vi } from "vitest";

vi.mock("@finanzas/db", () => ({ db: {} }));

const {
  findSkinTestBundleSuggestions,
  resolveMatchAmountHint,
  scoreCandidate,
  selectGlobalAutoLinkHypotheses,
} =
  await import("../dte-event-linking");

describe("scoreCandidate", () => {
  it("surfaces a same-day same-amount guardian/patient surname match as a review candidate", () => {
    const result = scoreCandidate({
      amountHint: 30000,
      dte: {
        clientName: "LORENA EDUVINA JAQUE VILLA",
        clientRUT: "13108274-6",
        documentDate: "2026-03-16",
        documentType: 41,
        dteSaleDetailId: "sale-1",
        exemptAmount: 0,
        folio: "20034",
        ivaAmount: 0,
        linkedEventsCount: 0,
        netAmount: 30000,
        totalAmount: 30000,
      },
      nameHints: ["benjamin saez jaque"],
      rutHints: ["22574388-6"],
    });

    expect(result.confidenceScore).toBeGreaterThanOrEqual(35);
    expect(result.reasons).toContain("Monto coincide casi exacto");
    expect(
      result.reasons.some((reason) =>
        reason.includes("posible responsable/paciente") && reason.includes("jaque"),
      ),
    ).toBe(true);
  });

  it("does not apply the guardian heuristic when the DTE is already linked elsewhere", () => {
    const result = scoreCandidate({
      amountHint: 30000,
      dte: {
        clientName: "LORENA EDUVINA JAQUE VILLA",
        clientRUT: "13108274-6",
        documentDate: "2026-03-16",
        documentType: 41,
        dteSaleDetailId: "sale-1",
        exemptAmount: 0,
        folio: "20034",
        ivaAmount: 0,
        linkedEventsCount: 1,
        netAmount: 30000,
        totalAmount: 30000,
      },
      nameHints: ["benjamin saez jaque"],
      rutHints: ["22574388-6"],
    });

    expect(result.confidenceScore).toBeLessThan(35);
    expect(
      result.reasons.some((reason) => reason.includes("posible responsable/paciente")),
    ).toBe(false);
  });

  it("boosts a candidate when the same RUT was already linked in another event of the series", () => {
    const result = scoreCandidate({
      amountHint: 60000,
      dte: {
        clientName: "NADIA YAÑEZ ROJAS",
        clientRUT: "10370222-4",
        documentDate: "2026-03-20",
        documentType: 41,
        dteSaleDetailId: "sale-20062",
        exemptAmount: 0,
        folio: "20062",
        ivaAmount: 0,
        linkedEventsCount: 0,
        netAmount: 60000,
        totalAmount: 60000,
      },
      nameHints: ["nadia yañez rojas"],
      rutHints: [],
      seriesLinkedRuts: ["10370222-4"],
    });

    expect(result.confidenceScore).toBe(100);
    expect(result.reasons).toContain("RUT ya confirmado en otro evento de la misma serie clínica");
    expect(result.reasons).not.toContain("RUT exacto encontrado en título/descripción del evento");
  });

  it("surfaces same-series RUT as a stronger review candidate even when the event text lacks a direct RUT", () => {
    const result = scoreCandidate({
      amountHint: 60000,
      dte: {
        clientName: "NADIA YAÑEZ ROJAS",
        clientRUT: "10370222-4",
        documentDate: "2026-03-20",
        documentType: 41,
        dteSaleDetailId: "sale-20062",
        exemptAmount: 0,
        folio: "20062",
        ivaAmount: 0,
        linkedEventsCount: 0,
        netAmount: 60000,
        totalAmount: 60000,
      },
      nameHints: ["llevara hijo clustoid ag nadia yañez rojas"],
      rutHints: [],
      seriesLinkedRuts: ["10370222-4"],
    });

    expect(result.confidenceScore).toBeGreaterThanOrEqual(35);
    expect(result.reasons).toContain("RUT ya confirmado en otro evento de la misma serie clínica");
  });
});

describe("findSkinTestBundleSuggestions", () => {
  it("builds a same-day same-RUT skin-test bundle when two DTE sum to the event amount", () => {
    const result = findSkinTestBundleSuggestions({
      amountHint: 60000,
      candidates: [
        {
          clientName: "LORENA PAZ ALFARO PICEROS",
          clientRUT: "17777348-4",
          documentDate: "2026-03-10",
          documentType: 41,
          dteSaleDetailId: "sale-19992",
          exemptAmount: 0,
          folio: "19992",
          ivaAmount: 0,
          linkedEventsCount: 0,
          netAmount: 30000,
          totalAmount: 30000,
        },
        {
          clientName: "LORENA PAZ ALFARO PICEROS",
          clientRUT: "17777348-4",
          documentDate: "2026-03-10",
          documentType: 41,
          dteSaleDetailId: "sale-19993",
          exemptAmount: 0,
          folio: "19993",
          ivaAmount: 0,
          linkedEventsCount: 0,
          netAmount: 30000,
          totalAmount: 30000,
        },
      ],
      nameHints: ["lorena alfaro piceros"],
      rutHints: ["17777348-4"],
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.dteSaleDetailIds).toEqual(["sale-19992", "sale-19993"]);
    expect(result[0]?.folios).toEqual(["19992", "19993"]);
    expect(result[0]?.totalAmount).toBe(60000);
    expect(result[0]?.confidenceScore).toBe(100);
  });

  it("does not build bundles when the RUT differs from the event hints", () => {
    const result = findSkinTestBundleSuggestions({
      amountHint: 60000,
      candidates: [
        {
          clientName: "LORENA PAZ ALFARO PICEROS",
          clientRUT: "17777348-4",
          documentDate: "2026-03-10",
          documentType: 41,
          dteSaleDetailId: "sale-19992",
          exemptAmount: 0,
          folio: "19992",
          ivaAmount: 0,
          linkedEventsCount: 0,
          netAmount: 30000,
          totalAmount: 30000,
        },
        {
          clientName: "LORENA PAZ ALFARO PICEROS",
          clientRUT: "17777348-4",
          documentDate: "2026-03-10",
          documentType: 41,
          dteSaleDetailId: "sale-19993",
          exemptAmount: 0,
          folio: "19993",
          ivaAmount: 0,
          linkedEventsCount: 0,
          netAmount: 30000,
          totalAmount: 30000,
        },
      ],
      nameHints: ["lorena alfaro piceros"],
      rutHints: ["99999999-9"],
    });

    expect(result).toEqual([]);
  });
});

describe("resolveMatchAmountHint", () => {
  it("prefers the event amount over the series remaining balance in same-day matching", () => {
    const amountHint = resolveMatchAmountHint({
      event: {
        amountExpected: 50000,
        amountPaid: 50000,
        description: "13620145-k",
        summary: "llego vacuna mensual clustoid 50 Mario Lopez Gonzalez",
      },
      sameDayOnly: true,
      series: {
        beneficiaryName: null,
        beneficiaryRut: null,
        displayName: "Mario Lopez Gonzalez",
        eligibleDocumentDateFrom: "2026-04-06",
        eligibleDocumentDateTo: "2026-04-06",
        events: [],
        id: 76,
        kind: "SUBCUTANEOUS_TREATMENT",
        lastAbandonmentContact: null,
        linkedDocuments: [],
        patientName: "Mario Lopez Gonzalez",
        patientRut: "13620145-K",
        remainingExpected: 250000,
        remainingPaid: 250000,
        status: "ACTIVE",
        totalExpected: 250000,
        totalLinkedAmount: 0,
        totalPaid: 250000,
      },
    });

    expect(amountHint).toBe(50000);
  });

  it("does not fall back to the series remaining balance during same-day matching when the event has no amount", () => {
    const amountHint = resolveMatchAmountHint({
      event: {
        amountExpected: null,
        amountPaid: null,
        description: null,
        summary: "vacuna acaros Gonzalo Valenzuela Osorio",
      },
      sameDayOnly: true,
      series: {
        beneficiaryName: null,
        beneficiaryRut: null,
        displayName: "Gonzalo Valenzuela Osorio",
        eligibleDocumentDateFrom: "2026-04-06",
        eligibleDocumentDateTo: "2026-04-06",
        events: [],
        id: 45,
        kind: "SUBCUTANEOUS_TREATMENT",
        lastAbandonmentContact: null,
        linkedDocuments: [],
        patientName: "Gonzalo Valenzuela Osorio",
        patientRut: "14030350-K",
        remainingExpected: 1200000,
        remainingPaid: 1200000,
        status: "ACTIVE",
        totalExpected: 1200000,
        totalLinkedAmount: 0,
        totalPaid: 1200000,
      },
    });

    expect(amountHint).toBeNull();
  });

  it("can still use the series remaining balance outside same-day matching when the event amount is unavailable", () => {
    const amountHint = resolveMatchAmountHint({
      event: {
        amountExpected: null,
        amountPaid: null,
        description: null,
        summary: "evento sin monto explicito",
      },
      sameDayOnly: false,
      series: {
        beneficiaryName: null,
        beneficiaryRut: null,
        displayName: "Paciente de bundle",
        eligibleDocumentDateFrom: "2026-04-01",
        eligibleDocumentDateTo: "2026-04-30",
        events: [],
        id: 999,
        kind: "SKIN_TEST",
        lastAbandonmentContact: null,
        linkedDocuments: [],
        patientName: "Paciente de bundle",
        patientRut: "11111111-1",
        remainingExpected: 60000,
        remainingPaid: 0,
        status: "ACTIVE",
        totalExpected: 60000,
        totalLinkedAmount: 0,
        totalPaid: 0,
      },
    });

    expect(amountHint).toBe(60000);
  });
});

describe("selectGlobalAutoLinkHypotheses", () => {
  it("chooses the highest total-score combination without reusing a DTE across events", () => {
    const selected = selectGlobalAutoLinkHypotheses([
      {
        event: {
          amountExpected: 30000,
          amountPaid: 30000,
          clinicalSeriesId: 1,
          description: null,
          eventDate: "2026-03-16",
          eventId: 10,
          externalEventId: "event-a",
          googleCalendarId: "calendar-1",
          linkedCount: 0,
          linkedDteSaleDetailId: null,
          summary: "Evento A",
        },
        hypotheses: [
          {
            amountDiff: 0,
            autoLinkEligible: true,
            clientName: "Paciente A",
            clientRUT: "11111111-1",
            documentDate: "2026-03-16",
            documents: [],
            crossSeriesConflicts: [],
            dteSaleDetailIds: ["shared-dte"],
            folios: ["100"],
            hypothesisId: "a-shared",
            kind: "single",
            method: "rut",
            policyKey: "default_same_day",
            reasons: [],
            score: 95,
            signals: [],
            totalAmount: 30000,
          },
        ],
      },
      {
        event: {
          amountExpected: 30000,
          amountPaid: 30000,
          clinicalSeriesId: 2,
          description: null,
          eventDate: "2026-03-16",
          eventId: 11,
          externalEventId: "event-b",
          googleCalendarId: "calendar-1",
          linkedCount: 0,
          linkedDteSaleDetailId: null,
          summary: "Evento B",
        },
        hypotheses: [
          {
            amountDiff: 0,
            autoLinkEligible: true,
            clientName: "Paciente B",
            clientRUT: "22222222-2",
            documentDate: "2026-03-16",
            documents: [],
            crossSeriesConflicts: [],
            dteSaleDetailIds: ["shared-dte"],
            folios: ["100"],
            hypothesisId: "b-shared",
            kind: "single",
            method: "rut",
            policyKey: "default_same_day",
            reasons: [],
            score: 90,
            signals: [],
            totalAmount: 30000,
          },
          {
            amountDiff: 0,
            autoLinkEligible: true,
            clientName: "Paciente B",
            clientRUT: "22222222-2",
            crossSeriesConflicts: [],
            documentDate: "2026-03-16",
            documents: [],
            dteSaleDetailIds: ["exclusive-dte"],
            folios: ["101"],
            hypothesisId: "b-exclusive",
            kind: "single",
            method: "rut",
            policyKey: "default_same_day",
            reasons: [],
            score: 89,
            signals: [],
            totalAmount: 30000,
          },
        ],
      },
    ]);

    expect(selected.get("event-a")?.hypothesisId).toBe("a-shared");
    expect(selected.get("event-b")?.hypothesisId).toBe("b-exclusive");
  });
});
