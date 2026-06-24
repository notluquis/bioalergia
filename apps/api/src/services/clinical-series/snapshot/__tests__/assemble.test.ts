import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  assembleClinicalSeriesSnapshot,
  type SeriesWithEventsAndContacts,
  type SnapshotLinkMaps,
} from "../assemble.ts";

// The assembler is pure (no DB). Pin the clock so timing/eligible-date math is
// deterministic. Events dated 2026-01-10 are firmly in the past relative to
// the frozen 2026-05-15 "today".
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 4, 15, 12, 0, 0));
});
afterEach(() => {
  vi.useRealTimers();
});

function makeSeries(
  overrides: Partial<SeriesWithEventsAndContacts> = {}
): SeriesWithEventsAndContacts {
  const base = {
    id: 1,
    kind: "SUBCUTANEOUS",
    status: "ACTIVE",
    allergenType: null,
    vaccineProduct: null,
    deliveryModality: null,
    healthInsurance: null,
    isapreName: null,
    beneficiaryName: "Ben",
    beneficiaryRut: "1-9",
    beneficiaryPhones: [],
    patientName: "Pat",
    patientRut: "2-7",
    patientPhones: [],
    displayName: "Pat",
    abandonmentContacts: [],
    events: [],
  };
  return { ...base, ...overrides } as unknown as SeriesWithEventsAndContacts;
}

function makeEvent(over: Record<string, unknown> = {}) {
  return {
    id: 100,
    externalEventId: "ext-100",
    calendar: { googleId: "cal-1" },
    startDate: new Date(2026, 0, 10),
    startDateTime: null,
    endDate: null,
    endDateTime: null,
    amountExpected: 50_000,
    amountPaid: 0,
    beneficiaryName: null,
    beneficiaryRut: null,
    patientName: null,
    patientRut: null,
    description: null,
    summary: null,
    dosageUnit: null,
    dosageValue: null,
    seriesStageKind: null,
    seriesStageLabel: null,
    seriesStageNumber: null,
    ...over,
  };
}

describe("assembleClinicalSeriesSnapshot — empty series", () => {
  it("returns an empty snapshot with zeroed totals when no events", () => {
    const snap = assembleClinicalSeriesSnapshot(makeSeries());
    expect(snap.events).toEqual([]);
    expect(snap.totalExpected).toBe(0);
    expect(snap.totalLinkedAmount).toBe(0);
    expect(snap.linkedDocuments).toEqual([]);
    expect(snap.lastEventDate).toBeNull();
    expect(snap.id).toBe(1);
  });

  it("surfaces the most recent abandonment contact", () => {
    const snap = assembleClinicalSeriesSnapshot(
      makeSeries({
        abandonmentContacts: [{ contactedAt: new Date(2026, 3, 1, 9, 0, 0), outcome: "NO_ANSWER" }],
      } as Partial<SeriesWithEventsAndContacts>)
    );
    expect(snap.lastAbandonmentContact?.outcome).toBe("NO_ANSWER");
    expect(snap.lastAbandonmentContact?.contactedAt).toBe(
      new Date(2026, 3, 1, 9, 0, 0).toISOString()
    );
  });
});

describe("assembleClinicalSeriesSnapshot — with events + link maps", () => {
  const linkMaps: SnapshotLinkMaps = {
    linkedDocuments: [
      {
        dteSaleDetailId: "s-1",
        clientName: "Pat",
        clientRUT: "2-7",
        documentDate: "2026-01-12",
        folio: "F1",
        totalAmount: 30_000,
        matchedBy: "AUTO",
        confidenceScore: 0.9,
      },
    ],
    foliosByEventId: new Map([[100, ["F1"]]]),
    documentsByEventId: new Map([
      [100, [{ dteSaleDetailId: "s-1", folio: "F1", totalAmount: 30_000 }]],
    ]),
  };

  it("maps events and wires per-event folios + documents from the maps", () => {
    const snap = assembleClinicalSeriesSnapshot(
      makeSeries({ events: [makeEvent()] } as Partial<SeriesWithEventsAndContacts>),
      linkMaps
    );
    expect(snap.events).toHaveLength(1);
    expect(snap.events[0]?.eventId).toBe(100);
    expect(snap.events[0]?.linkedFolios).toEqual(["F1"]);
    expect(snap.events[0]?.linkedDocuments).toEqual([
      { dteSaleDetailId: "s-1", folio: "F1", totalAmount: 30_000 },
    ]);
  });

  it("sums linked amount and derives remaining = max(0, due − linked)", () => {
    const snap = assembleClinicalSeriesSnapshot(
      makeSeries({
        events: [makeEvent({ amountExpected: 50_000 })],
      } as Partial<SeriesWithEventsAndContacts>),
      linkMaps
    );
    expect(snap.totalLinkedAmount).toBe(30_000);
    expect(snap.totalExpected).toBe(50_000); // event is past → counts as due
    expect(snap.remainingExpected).toBe(20_000); // 50k due − 30k linked
  });

  it("defaults missing per-event maps to empty arrays", () => {
    const snap = assembleClinicalSeriesSnapshot(
      makeSeries({ events: [makeEvent({ id: 999 })] } as Partial<SeriesWithEventsAndContacts>),
      linkMaps
    );
    expect(snap.events[0]?.linkedFolios).toEqual([]);
    expect(snap.events[0]?.linkedDocuments).toEqual([]);
  });
});
