import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as TimeModule from "../../lib/time.ts";

// Coverage tests for the DB-orchestration layer of dte-event-linking.ts that the
// pre-existing scoring / domain-error suites never reach: getEventDteSuggestions,
// listEventDteLinksByDate, getEventDteLinksByInternalEventId, unlinkEventDteLink,
// confirmEventDteLink (happy path), autoLinkEventDate (happy + skip), the period
// orchestrators, listAutoLinkEligiblePeriods, autoLinkAllEventPeriodsWithProgress,
// plus the internal helpers they fan out into (parseLinkedDocumentsJson,
// recordAutoLinkAttempt, recordMatchReview, getSameKindRutConflictWarnings →
// isSamePatientIdentity, hypothesisSkipReason, buildHypotheses, retrieveDteCandidates).
//
// Boundary mocks:
//  • @finanzas/db — $queryRaw / $executeRaw are tagged-template recorders. We push
//    a queue of results consumed FIFO so each sequential raw query in a function can
//    be steered. The SQL text (template strings) is captured so we can assert which
//    query ran.
//  • ./clinical-series.ts — fully mocked so getEventDteSuggestions' identity-hint +
//    snapshot fan-out is deterministic (and the @finanzas/db/slices $setOptions chain
//    is never imported).
//  • ../lib/time.ts — toChileDateString is stubbed to a fixed "today" so the
//    due-date / future-date math is deterministic; getMonthRange stays real.

const {
  queryRawQueue,
  queryRawCalls,
  executeRawQueue,
  executeRawCalls,
  mockQueryRaw,
  mockExecuteRaw,
  mockAttemptCreate,
  mockReviewCreate,
  mockLinkDeleteMany,
  mockDteFindMany,
} = vi.hoisted(() => {
  const queryRawQueue: unknown[] = [];
  const queryRawCalls: string[] = [];
  const executeRawQueue: unknown[] = [];
  const executeRawCalls: string[] = [];
  const stringify = (a: unknown[]): string => {
    const strings = a[0];
    return Array.isArray(strings) ? strings.join("?") : String(strings);
  };
  const mockQueryRaw = vi.fn((...a: unknown[]) => {
    queryRawCalls.push(stringify(a));
    return Promise.resolve(queryRawQueue.length > 0 ? queryRawQueue.shift() : []);
  });
  const mockExecuteRaw = vi.fn((...a: unknown[]) => {
    executeRawCalls.push(stringify(a));
    return Promise.resolve(executeRawQueue.length > 0 ? executeRawQueue.shift() : 0);
  });
  // ORM accessors que reemplazaron raw SQL en las 4 tablas modeladas + sale-links.
  const mockAttemptCreate = vi.fn(() => Promise.resolve({ id: 1n }));
  const mockReviewCreate = vi.fn(() => Promise.resolve({ id: 1n }));
  const mockLinkDeleteMany = vi.fn(() => Promise.resolve({ count: 0 }));
  // Chequeo de existencia de DTE migró de db.$queryRaw a db.dTESaleDetail.findMany.
  // Default: todos los ids pedidos existen (echo). Overridable por test.
  const mockDteFindMany = vi.fn((args: { where?: { id?: { in?: string[] } } }) =>
    Promise.resolve((args?.where?.id?.in ?? []).map((id) => ({ id })))
  );
  return {
    queryRawQueue,
    queryRawCalls,
    executeRawQueue,
    executeRawCalls,
    mockQueryRaw,
    mockExecuteRaw,
    mockAttemptCreate,
    mockReviewCreate,
    mockLinkDeleteMany,
    mockDteFindMany,
  };
});

vi.mock("@finanzas/db", () => ({
  db: {
    $queryRaw: (...a: unknown[]) => mockQueryRaw(...a),
    $executeRaw: (...a: unknown[]) => mockExecuteRaw(...a),
    eventDteAutoLinkAttempt: { create: (...a: unknown[]) => mockAttemptCreate(...a) },
    eventDteMatchReview: { create: (...a: unknown[]) => mockReviewCreate(...a) },
    eventDteSaleLink: { deleteMany: (...a: unknown[]) => mockLinkDeleteMany(...a) },
    dTESaleDetail: { findMany: (...a: unknown[]) => mockDteFindMany(...a) },
  },
}));

const { mockExtractIdentityHints, mockGetSnapshot, mockSyncSeries } = vi.hoisted(() => ({
  mockExtractIdentityHints: vi.fn(),
  mockGetSnapshot: vi.fn(),
  mockSyncSeries: vi.fn(),
}));

vi.mock("../clinical-series.ts", () => ({
  extractIdentityHints: (...a: unknown[]) => mockExtractIdentityHints(...a),
  getClinicalSeriesSnapshotByExternalEvent: (...a: unknown[]) => mockGetSnapshot(...a),
  syncClinicalSeriesForInternalEventId: (...a: unknown[]) => mockSyncSeries(...a),
}));

vi.mock("../../lib/time.ts", async () => {
  const actual = await vi.importActual<TimeModule>("../../lib/time.ts");
  return {
    ...actual,
    toChileDateString: () => "2026-05-15",
  };
});

const {
  confirmEventDteLink,
  getEventDteLinksByInternalEventId,
  getEventDteSuggestions,
  listAutoLinkEligiblePeriods,
  listEventDteLinksByDate,
  unlinkEventDteLink,
  autoLinkEventDate,
  autoLinkEventPeriod,
  autoLinkAllEventPeriods,
  autoLinkAllEventPeriodsWithProgress,
  listEventDteLinkOverview,
} = await import("../dte-event-linking.ts");

const { DomainError } = await import("../../lib/errors.ts");

function collectUndefinedPaths(value: unknown, path = "$"): string[] {
  if (value === undefined) {
    return [path];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectUndefinedPaths(item, `${path}[${index}]`));
  }

  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) =>
      collectUndefinedPaths(child, `${path}.${key}`)
    );
  }

  return [];
}

function reset() {
  queryRawQueue.length = 0;
  queryRawCalls.length = 0;
  executeRawQueue.length = 0;
  executeRawCalls.length = 0;
  mockQueryRaw.mockClear();
  mockExecuteRaw.mockClear();
  mockAttemptCreate.mockClear();
  mockReviewCreate.mockClear();
  mockLinkDeleteMany.mockClear();
  mockDteFindMany.mockClear();
  mockExtractIdentityHints.mockReset();
  mockGetSnapshot.mockReset();
  mockSyncSeries.mockReset();
  // sane defaults: no identity hints, no series
  mockExtractIdentityHints.mockReturnValue({
    patientName: null,
    patientRut: null,
    beneficiaryName: null,
    beneficiaryRut: null,
  });
  mockGetSnapshot.mockResolvedValue(null);
  mockSyncSeries.mockResolvedValue(undefined);
}

beforeEach(reset);
afterEach(() => vi.clearAllMocks());

// ───────────────────────────────────────────────────────────────────────────
// parseLinkedDocumentsJson (reached via listEventDteLinkOverview rows; but the
// pure-shape branches are exercised directly through getEventDteSuggestions'
// linkedDocuments mapping is trivial — instead we drive it through the overview
// path's linked records). Here we cover the simpler readers first.
// ───────────────────────────────────────────────────────────────────────────

describe("getEventDteLinksByInternalEventId", () => {
  it("maps raw rows into the link-record shape with ISO timestamps", async () => {
    const created = new Date("2026-05-01T12:00:00.000Z");
    const updated = new Date("2026-05-02T08:30:00.000Z");
    queryRawQueue.push([
      {
        id: 9,
        eventId: 42,
        dteSaleDetailId: "d-1",
        status: "CONFIRMED",
        matchedBy: "rut",
        confidenceScore: 97,
        matchedRUT: "11.111.111-1",
        matchedName: "Juan Perez",
        evidence: { source: "x" },
        createdBy: 3,
        createdAt: created,
        updatedAt: updated,
        clientName: "PEREZ JUAN",
        clientRUT: "11111111-1",
        documentDate: "2026-05-01",
        documentType: 39,
        folio: "F-1",
        totalAmount: 5000,
      },
    ]);

    const r = await getEventDteLinksByInternalEventId(42);
    expect(r).toHaveLength(1);
    expect(r[0]).toEqual({
      confidenceScore: 97,
      createdAt: created.toISOString(),
      createdBy: 3,
      dte: {
        clientName: "PEREZ JUAN",
        clientRUT: "11111111-1",
        documentDate: "2026-05-01",
        documentType: 39,
        folio: "F-1",
        totalAmount: 5000,
      },
      dteSaleDetailId: "d-1",
      evidence: { source: "x" },
      eventId: 42,
      id: 9,
      matchedBy: "rut",
      matchedName: "Juan Perez",
      matchedRUT: "11.111.111-1",
      status: "CONFIRMED",
      updatedAt: updated.toISOString(),
    });
    // the WHERE clause filters out REJECTED + scopes to the event id
    expect(queryRawCalls[0]).toContain("l.status != 'REJECTED'");
  });

  it("returns [] when there are no rows", async () => {
    queryRawQueue.push([]);
    expect(await getEventDteLinksByInternalEventId(1)).toEqual([]);
  });
});

describe("listEventDteLinksByDate", () => {
  it("passes the raw rows straight through", async () => {
    const rows = [
      {
        calendarId: "cal",
        clientName: "n",
        clientRUT: "r",
        confidenceScore: 80,
        dteSaleDetailId: "d",
        eventId: "evt",
        folio: "f",
        matchedBy: "rut",
        status: "CONFIRMED",
        totalAmount: 1000,
      },
    ];
    queryRawQueue.push(rows);
    const r = await listEventDteLinksByDate("2026-05-10");
    expect(r).toBe(rows);
    expect(queryRawCalls[0]).toContain("event_dte_sale_links");
  });
});

// ───────────────────────────────────────────────────────────────────────────
// unlinkEventDteLink
// ───────────────────────────────────────────────────────────────────────────

describe("unlinkEventDteLink", () => {
  it("returns {deleted:false} and records nothing when the event is missing", async () => {
    queryRawQueue.push([]); // getEventByExternalIds → no event
    const r = await unlinkEventDteLink({ calendarId: "c", eventId: "e" });
    expect(r).toEqual({ deleted: false });
    expect(mockExecuteRaw).not.toHaveBeenCalled();
  });

  it("deletes links and records a 'unlinked' review when previous links existed", async () => {
    queryRawQueue.push([{ eventId: 7, externalEventId: "e" }]); // event found
    queryRawQueue.push([
      {
        id: 1,
        eventId: 7,
        dteSaleDetailId: "d-1",
        status: "CONFIRMED",
        matchedBy: "rut",
        confidenceScore: 90,
        matchedRUT: null,
        matchedName: null,
        evidence: null,
        createdBy: null,
        createdAt: new Date("2026-05-01T00:00:00Z"),
        updatedAt: new Date("2026-05-01T00:00:00Z"),
        clientName: "N",
        clientRUT: "R",
        documentDate: "2026-05-01",
        documentType: 39,
        folio: "f",
        totalAmount: 1,
      },
    ]); // previousLinks → 1
    mockLinkDeleteMany.mockResolvedValueOnce({ count: 1 }); // DELETE affected 1 row

    const r = await unlinkEventDteLink({ calendarId: "c", eventId: "e", userId: 5 });
    expect(r).toEqual({ deleted: true });
    expect(mockLinkDeleteMany).toHaveBeenCalledTimes(1);
    // previousLinks=1 → a review is recorded with action 'unlinked'
    expect(mockReviewCreate).toHaveBeenCalledTimes(1);
  });

  it("reports deleted:false when the DELETE affected zero rows", async () => {
    queryRawQueue.push([{ eventId: 7, externalEventId: "e" }]);
    queryRawQueue.push([]); // no previous links
    // mockLinkDeleteMany default → { count: 0 } → nothing deleted
    const r = await unlinkEventDteLink({ calendarId: "c", eventId: "e" });
    expect(r).toEqual({ deleted: false });
    // previousLinks empty → no review insert
    expect(mockReviewCreate).not.toHaveBeenCalled();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// confirmEventDteLink — happy path (dedupes ids, caps at 3, inserts per dte,
// records review) — the guard branches live in the domain-errors suite.
// ───────────────────────────────────────────────────────────────────────────

describe("confirmEventDteLink — happy path", () => {
  it("dedupes + inserts one link per DTE and records 'confirmed' when no prior links", async () => {
    queryRawQueue.push([{ eventId: 11, externalEventId: "e" }]); // getEventByExternalIds
    // existence check ahora vía db.dTESaleDetail.findMany (mock echo → ambos existen)
    queryRawQueue.push([]); // previousLinks (getEventDteLinksByInternalEventId) → none
    queryRawQueue.push([]); // final getEventDteLinksByInternalEventId return

    const r = await confirmEventDteLink({
      calendarId: "c",
      eventId: "e",
      dteSaleDetailIds: ["d-1", "d-2", "d-1"], // duplicate collapses
      userId: 8,
    });
    expect(r).toEqual([]);
    // 1 deleteMany (ORM) + 2 INSERT links (raw, ON CONFLICT) + 1 review create (ORM)
    expect(mockLinkDeleteMany).toHaveBeenCalledTimes(1);
    expect(mockExecuteRaw).toHaveBeenCalledTimes(2);
    expect(executeRawCalls[0]).toContain("INSERT INTO event_dte_sale_links");
    expect(executeRawCalls[1]).toContain("INSERT INTO event_dte_sale_links");
    expect(mockReviewCreate).toHaveBeenCalledTimes(1);
  });

  it("records 'manual_override' when prior links existed", async () => {
    queryRawQueue.push([{ eventId: 11, externalEventId: "e" }]);
    // existence check vía db.dTESaleDetail.findMany (mock echo → existe)
    queryRawQueue.push([
      {
        id: 1,
        eventId: 11,
        dteSaleDetailId: "old",
        status: "CONFIRMED",
        matchedBy: "rut",
        confidenceScore: 90,
        matchedRUT: null,
        matchedName: null,
        evidence: null,
        createdBy: null,
        createdAt: new Date("2026-05-01T00:00:00Z"),
        updatedAt: new Date("2026-05-01T00:00:00Z"),
        clientName: "N",
        clientRUT: "R",
        documentDate: "2026-05-01",
        documentType: 39,
        folio: "f",
        totalAmount: 1,
      },
    ]); // previousLinks → 1
    queryRawQueue.push([]); // final read

    await confirmEventDteLink({
      calendarId: "c",
      eventId: "e",
      dteSaleDetailIds: ["d-1"],
      userId: 8,
    });
    // 1 deleteMany (ORM) + 1 INSERT (raw) + 1 review create (ORM)
    expect(mockLinkDeleteMany).toHaveBeenCalledTimes(1);
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
    expect(mockReviewCreate).toHaveBeenCalledTimes(1);
  });

  it("caps the dteSaleDetailIds at the first three", async () => {
    queryRawQueue.push([{ eventId: 11, externalEventId: "e" }]);
    // existence check vía db.dTESaleDetail.findMany (mock echo → los 3 trimmed existen)
    queryRawQueue.push([]); // previousLinks
    queryRawQueue.push([]); // final read

    await confirmEventDteLink({
      calendarId: "c",
      eventId: "e",
      dteSaleDetailIds: ["a", "b", "c", "d", "e"], // 5 → trimmed to 3
      userId: 8,
    });
    // deleteMany (ORM) + 3 INSERT (raw) + review create (ORM) → 3 raw executes
    expect(mockExecuteRaw).toHaveBeenCalledTimes(3);
    expect(mockLinkDeleteMany).toHaveBeenCalledTimes(1);
    expect(mockReviewCreate).toHaveBeenCalledTimes(1);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// listAutoLinkEligiblePeriods
// ───────────────────────────────────────────────────────────────────────────

describe("listAutoLinkEligiblePeriods", () => {
  it("returns the distinct period rows from the DB", async () => {
    const rows = [{ period: "2026-05" }, { period: "2026-04" }];
    queryRawQueue.push(rows);
    expect(await listAutoLinkEligiblePeriods()).toBe(rows);
    expect(queryRawCalls[0]).toContain('AS "period"');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// getEventDteSuggestions — the orchestrator. Drives getEventByExternalIds,
// extractIdentityClaims (via mocked clinical-series), resolveSuggestionDateWindow,
// retrieveDteCandidates, buildHypotheses, getEventDteLinksByInternalEventId.
// ───────────────────────────────────────────────────────────────────────────

const baseEventRow = {
  eventId: 100,
  googleCalendarId: "cal",
  externalEventId: "evt",
  eventDate: "2026-05-10",
  category: null,
  summary: "Vacuna",
  description: null,
  clinicalSeriesId: 5,
  linkedDteSaleDetailId: null,
  linkedCount: 0,
  amountExpected: null,
  amountPaid: 5000,
};

describe("getEventDteSuggestions", () => {
  it("returns the empty shell when the event is not found", async () => {
    queryRawQueue.push([]); // getEventByExternalIds → none
    const r = await getEventDteSuggestions({ calendarId: "c", eventId: "e" });
    expect(r.event).toBeNull();
    expect(r.hypotheses).toEqual([]);
    expect(r.candidateSetSummary).toEqual({
      consideredCount: 0,
      fallbackCount: 0,
      retrievedCount: 0,
      sameDayCount: 0,
    });
    expect(r.identityClaims).toBeNull();
    expect(mockSyncSeries).not.toHaveBeenCalled();
  });

  it("syncs the series when clinicalSeriesId is null, then re-reads the event", async () => {
    queryRawQueue.push([{ ...baseEventRow, clinicalSeriesId: null }]); // first read: no series
    // after sync, re-read also returns no event → returns empty shell (covers the
    // inner not-found return after sync)
    queryRawQueue.push([]);

    const r = await getEventDteSuggestions({ calendarId: "c", eventId: "e" });
    expect(mockSyncSeries).toHaveBeenCalledWith(100);
    expect(r.event).toBeNull();
  });

  it("builds an exact-RUT single hypothesis from a same-day candidate", async () => {
    mockExtractIdentityHints.mockReturnValue({
      patientName: "Nadia Yanez",
      patientRut: "22.222.222-2",
      beneficiaryName: null,
      beneficiaryRut: null,
    });
    queryRawQueue.push([baseEventRow]); // getEventByExternalIds
    queryRawQueue.push([]); // getEventDteLinksByInternalEventId (linked)
    // getClinicalSeriesSnapshotByExternalEvent is mocked → null (default)
    queryRawQueue.push([
      {
        dteSaleDetailId: "dte-1",
        documentType: 39,
        clientRUT: "22222222-2",
        clientName: "YANEZ NADIA",
        folio: "F-9",
        documentDate: "2026-05-10",
        exemptAmount: 0,
        netAmount: 4200,
        ivaAmount: 800,
        totalAmount: 5000,
        linkedEventsCount: 0,
        retrievalMeta: {
          exactRutMatch: true,
          sameSeriesRutMatch: false,
          amountCandidate: true,
          sharedSurnameMatch: false,
          trigramSimilarity: 0,
        },
      },
    ]); // retrieveDteCandidates

    const r = await getEventDteSuggestions({
      calendarId: "c",
      eventId: "e",
      sameDayOnly: true,
    });

    expect(r.event?.eventId).toBe("evt");
    expect(r.hypotheses).toHaveLength(1);
    const top = r.hypotheses[0];
    // claims.rutClaims carries the un-normalized identity-hint RUT ("22.222.222-2")
    // while the candidate RUT is normalized ("22222222-2"), so the in-app rut compare
    // misses; the token-sorted name still matches exactly → exact_name(88) +
    // amount_exactish(8) = 96, method "name_exact".
    expect(top.score).toBe(96);
    expect(top.method).toBe("name_exact");
    expect(top.autoLinkEligible).toBe(true);
    expect(top.dteSaleDetailIds).toEqual(["dte-1"]);
    expect(top.signals.some((s) => s.code === "exact_name")).toBe(true);
    // no cross-series warning query because series is null
    expect(mockGetSnapshot).toHaveBeenCalled();
    expect(r.identityClaims?.patientRut).toBe("22.222.222-2");
  });

  it("drops candidates that score below MIN_REVIEW_SCORE (35) from hypotheses", async () => {
    mockExtractIdentityHints.mockReturnValue({
      patientName: "Nadia Yanez",
      patientRut: "22.222.222-2",
      beneficiaryName: null,
      beneficiaryRut: null,
    });
    queryRawQueue.push([baseEventRow]);
    queryRawQueue.push([]); // linked
    queryRawQueue.push([
      {
        dteSaleDetailId: "dte-x",
        documentType: 39,
        clientRUT: "99999999-9", // no rut match
        clientName: "PERSONA TOTALMENTE DISTINTA",
        folio: "F-x",
        documentDate: "2026-05-10",
        exemptAmount: 0,
        netAmount: 0,
        ivaAmount: 0,
        totalAmount: 999999, // far from amountHint → no amount signal
        linkedEventsCount: 3, // not free
        retrievalMeta: {
          exactRutMatch: false,
          sameSeriesRutMatch: false,
          amountCandidate: false,
          sharedSurnameMatch: false,
          trigramSimilarity: 0,
        },
      },
    ]);

    const r = await getEventDteSuggestions({
      calendarId: "c",
      eventId: "e",
      sameDayOnly: true,
    });
    expect(r.hypotheses).toEqual([]);
    // it was linked (count 3) so it is also excluded from fallback candidates
    expect(r.fallbackCandidates).toEqual([]);
    expect(r.candidateSetSummary.retrievedCount).toBe(1);
    expect(r.candidateSetSummary.consideredCount).toBe(1);
  });

  it("queries cross-series warnings when a series snapshot is present", async () => {
    mockExtractIdentityHints.mockReturnValue({
      patientName: "Nadia Yanez",
      patientRut: "22.222.222-2",
      beneficiaryName: null,
      beneficiaryRut: null,
    });
    mockGetSnapshot.mockResolvedValue({
      id: 5,
      kind: "SKIN_TEST",
      patientName: "Nadia Yanez",
      patientRut: "22.222.222-2",
      beneficiaryName: null,
      beneficiaryRut: null,
      remainingPaid: 0,
      remainingExpected: 0,
      eligibleDocumentDateFrom: "2026-05-01",
      eligibleDocumentDateTo: "2026-05-31",
      linkedDocuments: [],
    });
    queryRawQueue.push([baseEventRow]); // event
    queryRawQueue.push([]); // linked
    queryRawQueue.push([
      {
        dteSaleDetailId: "dte-1",
        documentType: 39,
        clientRUT: "22222222-2",
        clientName: "YANEZ NADIA",
        folio: "F-9",
        documentDate: "2026-05-10",
        exemptAmount: 0,
        netAmount: 4200,
        ivaAmount: 800,
        totalAmount: 5000,
        linkedEventsCount: 0,
        retrievalMeta: {
          exactRutMatch: true,
          sameSeriesRutMatch: false,
          amountCandidate: true,
          sharedSurnameMatch: false,
          trigramSimilarity: 0,
        },
      },
    ]); // candidates
    queryRawQueue.push([]); // getSameKindRutConflictWarnings → no conflicts

    const r = await getEventDteSuggestions({
      calendarId: "c",
      eventId: "e",
      sameDayOnly: true,
    });
    expect(r.series?.id).toBe(5);
    // the cross-series conflict query ran (4th $queryRaw)
    expect(queryRawCalls.some((q) => q.includes("event_dte_sale_links l"))).toBe(true);
    expect(r.hypotheses[0].score).toBe(96);
  });

  it("emits a cross-series warning reason + conflicts for a different patient sharing the RUT", async () => {
    mockExtractIdentityHints.mockReturnValue({
      patientName: "Nadia Yanez",
      patientRut: "22.222.222-2",
      beneficiaryName: null,
      beneficiaryRut: null,
    });
    mockGetSnapshot.mockResolvedValue({
      id: 5,
      kind: "SKIN_TEST",
      patientName: "Nadia Yanez",
      patientRut: "22.222.222-2",
      beneficiaryName: null,
      beneficiaryRut: null,
      remainingPaid: 0,
      remainingExpected: 0,
      eligibleDocumentDateFrom: "2026-05-01",
      eligibleDocumentDateTo: "2026-05-31",
      linkedDocuments: [],
    });
    queryRawQueue.push([baseEventRow]); // event
    queryRawQueue.push([]); // linked
    queryRawQueue.push([
      {
        dteSaleDetailId: "dte-1",
        documentType: 39,
        clientRUT: "22222222-2",
        clientName: "YANEZ NADIA",
        folio: "F-9",
        documentDate: "2026-05-10",
        exemptAmount: 0,
        netAmount: 4200,
        ivaAmount: 800,
        totalAmount: 5000,
        linkedEventsCount: 0,
        retrievalMeta: {
          exactRutMatch: true,
          sameSeriesRutMatch: false,
          amountCandidate: true,
          sharedSurnameMatch: false,
          trigramSimilarity: 0,
        },
      },
    ]); // candidates
    // getSameKindRutConflictWarnings → the SAME rut linked in OTHER series to a
    // DIFFERENT patient (so isSamePatientIdentity returns false and the warning fires)
    queryRawQueue.push([
      {
        clientRUT: "22222222-2",
        seriesId: 99,
        patientName: "Otro Paciente",
        patientRut: "33333333-3",
        beneficiaryRut: null,
        status: "ACTIVE",
      },
    ]);

    const r = await getEventDteSuggestions({
      calendarId: "c",
      eventId: "e",
      sameDayOnly: true,
    });
    const top = r.hypotheses[0];
    expect(top.crossSeriesConflicts).toEqual([
      { patientName: "Otro Paciente", patientRut: "33333333-3", seriesId: 99, status: "ACTIVE" },
    ]);
    expect(top.reasons.some((reason) => reason.startsWith("Advertencia:"))).toBe(true);
    expect(top.reasons.some((reason) => reason.includes("Otro Paciente"))).toBe(true);
    expect(top.reasons.some((reason) => reason.includes("test cutáneo"))).toBe(true);
  });

  it("suppresses the cross-series warning when the other series is the SAME patient", async () => {
    mockExtractIdentityHints.mockReturnValue({
      patientName: "Nadia Yanez",
      patientRut: "22.222.222-2",
      beneficiaryName: null,
      beneficiaryRut: null,
    });
    mockGetSnapshot.mockResolvedValue({
      id: 5,
      kind: "SKIN_TEST",
      patientName: "Nadia Yanez",
      patientRut: "22.222.222-2",
      beneficiaryName: null,
      beneficiaryRut: null,
      remainingPaid: 0,
      remainingExpected: 0,
      eligibleDocumentDateFrom: "2026-05-01",
      eligibleDocumentDateTo: "2026-05-31",
      linkedDocuments: [],
    });
    queryRawQueue.push([baseEventRow]);
    queryRawQueue.push([]);
    queryRawQueue.push([
      {
        dteSaleDetailId: "dte-1",
        documentType: 39,
        clientRUT: "22222222-2",
        clientName: "YANEZ NADIA",
        folio: "F-9",
        documentDate: "2026-05-10",
        exemptAmount: 0,
        netAmount: 4200,
        ivaAmount: 800,
        totalAmount: 5000,
        linkedEventsCount: 0,
        retrievalMeta: {
          exactRutMatch: true,
          sameSeriesRutMatch: false,
          amountCandidate: true,
          sharedSurnameMatch: false,
          trigramSimilarity: 0,
        },
      },
    ]);
    // conflict row's patientRut == current patientRut → isSamePatientIdentity → skipped
    queryRawQueue.push([
      {
        clientRUT: "22222222-2",
        seriesId: 99,
        patientName: "Nadia Yanez",
        patientRut: "22222222-2",
        beneficiaryRut: null,
        status: "ACTIVE",
      },
    ]);

    const r = await getEventDteSuggestions({
      calendarId: "c",
      eventId: "e",
      sameDayOnly: true,
    });
    expect(r.hypotheses[0].crossSeriesConflicts).toEqual([]);
    expect(r.hypotheses[0].reasons.some((reason) => reason.startsWith("Advertencia:"))).toBe(false);
  });

  it("returns fallback candidates (free, below-hypothesis) with the appended reason", async () => {
    mockExtractIdentityHints.mockReturnValue({
      patientName: "Nadia Yanez",
      patientRut: "22.222.222-2",
      beneficiaryName: null,
      beneficiaryRut: null,
    });
    queryRawQueue.push([baseEventRow]); // event
    queryRawQueue.push([]); // linked
    queryRawQueue.push([
      // strong candidate → becomes a hypothesis
      {
        dteSaleDetailId: "dte-strong",
        documentType: 39,
        clientRUT: "22222222-2",
        clientName: "YANEZ NADIA",
        folio: "F-1",
        documentDate: "2026-05-10",
        exemptAmount: 0,
        netAmount: 4200,
        ivaAmount: 800,
        totalAmount: 5000,
        linkedEventsCount: 0,
        retrievalMeta: {
          exactRutMatch: true,
          sameSeriesRutMatch: false,
          amountCandidate: true,
          sharedSurnameMatch: false,
          trigramSimilarity: 0,
        },
      },
      // weak free candidate → too low for hypothesis, surfaces as fallback
      {
        dteSaleDetailId: "dte-weak",
        documentType: 39,
        clientRUT: "44444444-4",
        clientName: "OTRA PERSONA SIN RELACION",
        folio: "F-2",
        documentDate: "2026-05-10",
        exemptAmount: 0,
        netAmount: 0,
        ivaAmount: 0,
        totalAmount: 5300, // within 5000±5000 → amount_compatible only
        linkedEventsCount: 0,
        retrievalMeta: {
          exactRutMatch: false,
          sameSeriesRutMatch: false,
          amountCandidate: true,
          sharedSurnameMatch: false,
          trigramSimilarity: 0,
        },
      },
    ]);

    const r = await getEventDteSuggestions({
      calendarId: "c",
      eventId: "e",
      sameDayOnly: true,
    });
    expect(r.hypotheses[0].dteSaleDetailIds).toEqual(["dte-strong"]);
    expect(r.fallbackCandidates).toHaveLength(1);
    expect(r.fallbackCandidates[0].dteSaleDetailId).toBe("dte-weak");
    expect(r.fallbackCandidates[0].reasons).toContain("DTE del mismo día sin eventos vinculados");
    expect(r.candidateSetSummary.fallbackCount).toBe(1);
    expect(r.candidateSetSummary.sameDayCount).toBe(2);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// autoLinkEventDate — happy path (link), skip path (records SKIPPED attempt).
// ───────────────────────────────────────────────────────────────────────────

function eventRow(over: Record<string, unknown> = {}) {
  return {
    eventId: 100,
    googleCalendarId: "cal",
    externalEventId: "evt",
    eventDate: "2026-05-10",
    category: null,
    summary: "Vacuna",
    description: null,
    clinicalSeriesId: 5,
    linkedDteSaleDetailId: null,
    linkedCount: 0,
    amountExpected: null,
    amountPaid: 5000,
    ...over,
  };
}

describe("autoLinkEventDate", () => {
  it("auto-links an eligible high-score same-day hypothesis", async () => {
    mockExtractIdentityHints.mockReturnValue({
      patientName: "Nadia Yanez",
      patientRut: "22.222.222-2",
      beneficiaryName: null,
      beneficiaryRut: null,
    });
    // getEventsByDate → one unlinked event
    queryRawQueue.push([eventRow()]);
    // ── getEventDteSuggestions internals for that event ──
    queryRawQueue.push([eventRow()]); // getEventByExternalIds
    queryRawQueue.push([]); // linked
    queryRawQueue.push([
      {
        dteSaleDetailId: "dte-1",
        documentType: 39,
        clientRUT: "22222222-2",
        clientName: "YANEZ NADIA",
        folio: "F-9",
        documentDate: "2026-05-10",
        exemptAmount: 0,
        netAmount: 4200,
        ivaAmount: 800,
        totalAmount: 5000,
        linkedEventsCount: 0,
        retrievalMeta: {
          exactRutMatch: true,
          sameSeriesRutMatch: false,
          amountCandidate: true,
          sharedSurnameMatch: false,
          trigramSimilarity: 0,
        },
      },
    ]); // candidates
    // ── confirmEventDteLink internals ──
    queryRawQueue.push([eventRow()]); // getEventByExternalIds
    // existence vía db.dTESaleDetail.findMany (mock echo)
    queryRawQueue.push([]); // previousLinks
    queryRawQueue.push([]); // final read

    const r = await autoLinkEventDate({ date: "2026-05-10", userId: 1 });
    expect(r.linked).toBe(1);
    expect(r.skipped).toBe(0);
    expect(r.totalEvents).toBe(1);
    expect(r.details[0].reason).toMatch(/^Auto-linked \(96\)$/);
    // a LINKED auto-link attempt was recorded
    expect(mockAttemptCreate).toHaveBeenCalled();
    expect(mockReviewCreate).toHaveBeenCalledTimes(1);
    const reviewCreateArgs = mockReviewCreate.mock.calls[0]?.[0] as {
      data: {
        creator?: unknown;
        event?: unknown;
        hypothesis?: unknown;
      };
    };
    expect(reviewCreateArgs.data.event).toEqual({ connect: { id: 100 } });
    expect(reviewCreateArgs.data.creator).toEqual({ connect: { id: 1 } });
    expect(collectUndefinedPaths(reviewCreateArgs.data.hypothesis)).toEqual([]);
  });

  it("skips and records a SKIPPED attempt when no hypothesis clears the bar", async () => {
    mockExtractIdentityHints.mockReturnValue({
      patientName: null,
      patientRut: null,
      beneficiaryName: null,
      beneficiaryRut: null,
    });
    queryRawQueue.push([eventRow()]); // getEventsByDate
    queryRawQueue.push([eventRow()]); // getEventByExternalIds
    queryRawQueue.push([]); // linked
    queryRawQueue.push([]); // candidates → none

    const r = await autoLinkEventDate({ date: "2026-05-10", userId: 1 });
    expect(r.linked).toBe(0);
    expect(r.skipped).toBe(1);
    expect(r.details[0].reason).toBe("Sin candidatos");
    expect(r.skippedByReason).toEqual([{ count: 1, reason: "Sin candidatos" }]);
    // SKIPPED attempt recorded
    expect(mockAttemptCreate).toHaveBeenCalled();
  });

  it("relink_all strategy processes already-linked events too", async () => {
    mockExtractIdentityHints.mockReturnValue({
      patientName: null,
      patientRut: null,
      beneficiaryName: null,
      beneficiaryRut: null,
    });
    // one event already linked (linkedCount 1) — missing_only would skip it
    queryRawQueue.push([eventRow({ linkedCount: 1 })]); // getEventsByDate
    queryRawQueue.push([eventRow({ linkedCount: 1 })]); // getEventByExternalIds
    queryRawQueue.push([]); // linked
    queryRawQueue.push([]); // candidates → none → skip

    const r = await autoLinkEventDate({
      date: "2026-05-10",
      strategy: "relink_all",
      userId: 1,
    });
    expect(r.totalEvents).toBe(1);
    expect(r.skipped).toBe(1);
  });

  it("missing_only strategy filters out already-linked events", async () => {
    queryRawQueue.push([eventRow({ linkedCount: 1 })]); // getEventsByDate → 1 linked event
    // no further queries because eventsToProcess is empty
    const r = await autoLinkEventDate({ date: "2026-05-10", userId: 1 });
    expect(r.totalEvents).toBe(0);
    expect(r.linked).toBe(0);
    expect(r.skipped).toBe(0);
  });

  it("rejects a future date before touching the DB", async () => {
    // toChileDateString is stubbed to 2026-05-15 → 2026-05-16 is future
    const err = await autoLinkEventDate({ date: "2026-05-16", userId: 1 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).kind).toBe("BAD_REQUEST");
    expect((err as DomainError).message).toContain("2026-05-16");
    expect((err as DomainError).message).toContain("Hoy es 2026-05-15");
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// autoLinkAllEventPeriodsWithProgress — worker pool + progress callback +
// aggregation. We drive a single period with no event dates (fast path).
// ───────────────────────────────────────────────────────────────────────────

describe("autoLinkAllEventPeriodsWithProgress", () => {
  it("processes each period, invokes onProgress, and aggregates totals", async () => {
    // autoLinkEventPeriod("2026-05") → getMonthRange real; maxDate = today (2026-05-15)
    // dateRows query → returns no dates → result all-zero, no autoLinkEventDate calls.
    queryRawQueue.push([]); // dateRows for the single period

    const progress: Array<{ completedPeriods: number; currentPeriod: string }> = [];
    const r = await autoLinkAllEventPeriodsWithProgress({
      periods: [{ period: "2026-05" }],
      onProgress: (snap) =>
        progress.push({
          completedPeriods: snap.completedPeriods,
          currentPeriod: snap.currentPeriod,
        }),
      userId: 1,
    });

    expect(r.periodsProcessed).toBe(1);
    expect(r.linked).toBe(0);
    expect(r.skipped).toBe(0);
    expect(r.totalEvents).toBe(0);
    expect(r.strategy).toBe("missing_only");
    expect(progress).toEqual([{ completedPeriods: 1, currentPeriod: "2026-05" }]);
    expect(r.details).toHaveLength(1);
    expect(r.details[0].period).toBe("2026-05");
  });

  it("clamps periodConcurrency into [1,6] and sorts details descending by period", async () => {
    // two periods, each with no dates → two fast results
    queryRawQueue.push([]); // dateRows for first dequeued period
    queryRawQueue.push([]); // dateRows for second dequeued period

    const r = await autoLinkAllEventPeriodsWithProgress({
      periods: [{ period: "2026-04" }, { period: "2026-05" }],
      periodConcurrency: 99, // clamped to 6
      userId: 1,
    });
    expect(r.periodsProcessed).toBe(2);
    // details sorted descending
    expect(r.details.map((d) => d.period)).toEqual(["2026-05", "2026-04"]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// autoLinkEventPeriod — the NON-progress variant. The fast-path (period entirely
// in the future / empty dateRows) plus the populated dateRows loop that fans out
// into autoLinkEventDate per date and aggregates link/skip totals + reasons.
// ───────────────────────────────────────────────────────────────────────────

// FIFO results that drive ONE autoLinkEventDate("<date>") down its LINK path:
// getEventsByDate → getEventByExternalIds → linked → candidates (strong) →
// then confirmEventDteLink: getEventByExternalIds → existence → previousLinks →
// final read.
function queueLinkDate(date: string) {
  queryRawQueue.push([eventRow({ eventDate: date })]); // getEventsByDate
  queryRawQueue.push([eventRow({ eventDate: date })]); // getEventByExternalIds
  queryRawQueue.push([]); // linked
  queryRawQueue.push([
    {
      dteSaleDetailId: "dte-1",
      documentType: 39,
      clientRUT: "22222222-2",
      clientName: "YANEZ NADIA",
      folio: "F-9",
      documentDate: date,
      exemptAmount: 0,
      netAmount: 4200,
      ivaAmount: 800,
      totalAmount: 5000,
      linkedEventsCount: 0,
      retrievalMeta: {
        exactRutMatch: true,
        sameSeriesRutMatch: false,
        amountCandidate: true,
        sharedSurnameMatch: false,
        trigramSimilarity: 0,
      },
    },
  ]); // candidates
  queryRawQueue.push([eventRow({ eventDate: date })]); // confirm: getEventByExternalIds
  // confirm: existence vía db.dTESaleDetail.findMany (mock echo)
  queryRawQueue.push([]); // confirm: previousLinks
  queryRawQueue.push([]); // confirm: final read
}

// FIFO results that drive ONE autoLinkEventDate("<date>") down its SKIP path:
// getEventsByDate → getEventByExternalIds → linked → candidates (none).
function queueSkipDate(date: string) {
  queryRawQueue.push([eventRow({ eventDate: date })]); // getEventsByDate
  queryRawQueue.push([eventRow({ eventDate: date })]); // getEventByExternalIds
  queryRawQueue.push([]); // linked
  queryRawQueue.push([]); // candidates → none → skip
}

describe("autoLinkEventPeriod", () => {
  it("rejects an invalid period before touching the DB", async () => {
    const err = await autoLinkEventPeriod({ period: "2026-5", userId: 1 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).kind).toBe("BAD_REQUEST");
    expect((err as DomainError).message).toContain("YYYY-MM");
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it("returns the all-zero fast path when the period starts after maxDate (entirely future)", async () => {
    // today stub = 2026-05-15; 2026-07 → periodStart 2026-07-01 > maxDate (today)
    const r = await autoLinkEventPeriod({ period: "2026-07", userId: 1 });
    expect(r).toEqual({
      daysProcessed: 0,
      details: [],
      linked: 0,
      period: "2026-07",
      skipped: 0,
      skippedByReason: [],
      totalEvents: 0,
    });
    // never reached the dateRows query
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it("aggregates link + skip across ≥2 populated dates (sequential loop)", async () => {
    mockExtractIdentityHints.mockReturnValue({
      patientName: "Nadia Yanez",
      patientRut: "22.222.222-2",
      beneficiaryName: null,
      beneficiaryRut: null,
    });
    // dateRows for the period: two dates, both <= today (clamped maxDate = 2026-05-15).
    // The loop processes dates sequentially (await per row) → FIFO consumption is
    // deterministic in date order.
    queryRawQueue.push([{ eventDate: "2026-05-10" }, { eventDate: "2026-05-12" }]);
    queueLinkDate("2026-05-10"); // first date → links 1
    queueSkipDate("2026-05-12"); // second date → skips 1 ("Sin candidatos")

    const r = await autoLinkEventPeriod({ period: "2026-05", userId: 7 });

    expect(r.period).toBe("2026-05");
    expect(r.daysProcessed).toBe(2);
    expect(r.linked).toBe(1);
    expect(r.skipped).toBe(1);
    expect(r.totalEvents).toBe(2);
    expect(r.skippedByReason).toEqual([{ count: 1, reason: "Sin candidatos" }]);
    // per-date details preserve loop order (dateRows order)
    expect(r.details).toEqual([
      { date: "2026-05-10", linked: 1, skipped: 0, totalEvents: 1 },
      { date: "2026-05-12", linked: 0, skipped: 1, totalEvents: 1 },
    ]);
    // the dateRows query is the FIRST query and selects distinct local event dates
    expect(queryRawCalls[0]).toContain("SELECT DISTINCT");
    expect(queryRawCalls[0]).toContain('AS "eventDate"');
    // a LINKED and a SKIPPED attempt were recorded
    expect(mockAttemptCreate).toHaveBeenCalledTimes(2);
  });

  it("merges identical skip reasons across multiple dates into one count", async () => {
    mockExtractIdentityHints.mockReturnValue({
      patientName: null,
      patientRut: null,
      beneficiaryName: null,
      beneficiaryRut: null,
    });
    queryRawQueue.push([{ eventDate: "2026-05-10" }, { eventDate: "2026-05-12" }]);
    queueSkipDate("2026-05-10"); // skip "Sin candidatos"
    queueSkipDate("2026-05-12"); // skip "Sin candidatos"

    const r = await autoLinkEventPeriod({ period: "2026-05", userId: 7 });
    expect(r.skipped).toBe(2);
    expect(r.linked).toBe(0);
    // both same-reason skips collapse into a single count of 2
    expect(r.skippedByReason).toEqual([{ count: 2, reason: "Sin candidatos" }]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// autoLinkAllEventPeriods — the NON-progress variant. Pulls eligible periods via
// listAutoLinkEligiblePeriods, fans out into autoLinkEventPeriod with a fixed
// concurrency of 3 (no onProgress, no [1,6] clamp, no descending sort).
// ───────────────────────────────────────────────────────────────────────────

describe("autoLinkAllEventPeriods", () => {
  it("pulls eligible periods, aggregates per-period totals, defaults strategy missing_only", async () => {
    mockExtractIdentityHints.mockReturnValue({
      patientName: "Nadia Yanez",
      patientRut: "22.222.222-2",
      beneficiaryName: null,
      beneficiaryRut: null,
    });
    // listAutoLinkEligiblePeriods → one eligible period
    queryRawQueue.push([{ period: "2026-05" }]);
    // autoLinkEventPeriod("2026-05") dateRows → one date that links
    queryRawQueue.push([{ eventDate: "2026-05-10" }]);
    queueLinkDate("2026-05-10");

    const r = await autoLinkAllEventPeriods({ userId: 3 });

    expect(r.periodsProcessed).toBe(1);
    expect(r.linked).toBe(1);
    expect(r.skipped).toBe(0);
    expect(r.totalEvents).toBe(1);
    expect(r.skippedByReason).toEqual([]);
    expect(r.details).toEqual([
      { daysProcessed: 1, linked: 1, period: "2026-05", skipped: 0, totalEvents: 1 },
    ]);
    // first query is the eligible-periods discovery (distinct YYYY-MM)
    expect(queryRawCalls[0]).toContain('AS "period"');
  });

  it("returns zeroed aggregates + no details when no periods are eligible", async () => {
    queryRawQueue.push([]); // listAutoLinkEligiblePeriods → none
    const r = await autoLinkAllEventPeriods({ userId: 3 });
    expect(r.periodsProcessed).toBe(0);
    expect(r.details).toEqual([]);
    expect(r.linked).toBe(0);
    expect(r.skipped).toBe(0);
    expect(r.totalEvents).toBe(0);
    expect(r.skippedByReason).toEqual([]);
  });

  it("fans out across multiple eligible periods with the fixed concurrency pool", async () => {
    // Two eligible periods. The worker pool runs them concurrently (fixed
    // concurrency 3), so the per-period date fan-out would interleave on the shared
    // FIFO mock; we keep both periods empty-dateRows to stay deterministic and still
    // exercise the multi-period queue.shift() drain + aggregation.
    queryRawQueue.push([{ period: "2026-05" }, { period: "2026-04" }]);
    queryRawQueue.push([]); // dateRows for one dequeued period
    queryRawQueue.push([]); // dateRows for the other dequeued period

    const r = await autoLinkAllEventPeriods({ userId: 3 });
    expect(r.periodsProcessed).toBe(2);
    expect(r.linked).toBe(0);
    expect(r.skipped).toBe(0);
    expect(r.totalEvents).toBe(0);
    expect(r.skippedByReason).toEqual([]);
    // both periods produced a details entry (no sort applied — order follows
    // worker completion, so assert as a set)
    expect(new Set(r.details.map((d) => d.period))).toEqual(new Set(["2026-05", "2026-04"]));
  });
});

// ───────────────────────────────────────────────────────────────────────────
// listEventDteLinkOverview — stats query + filtered count + paginated rows, then
// per-row mapping (parseLinkedDocumentsJson, linkStatus derivation, lastAutoLinkSkip)
// and the topHypothesis recursion into getEventDteSuggestions for due+unlinked rows.
// ───────────────────────────────────────────────────────────────────────────

function overviewRow(over: Record<string, unknown> = {}) {
  return {
    calendarId: "cal",
    eventId: "evt",
    summary: "Vacuna",
    eventDate: "2026-05-10",
    eventTime: "09:00",
    amountExpected: null,
    amountPaid: 5000,
    clinicalSeriesId: 5,
    lastAutoLinkSkipAt: null,
    lastAutoLinkSkipReason: null,
    linkedCount: 0,
    linkedDocumentsJson: [],
    linkedDteSaleDetailId: null,
    linkedMatchedBy: null,
    confidenceScore: null,
    linkedClientName: null,
    linkedClientRUT: null,
    linkedFolio: null,
    linkedTotalAmount: 0,
    displayName: null,
    seriesKind: null,
    ...over,
  };
}

const overviewStats = {
  avgLinkedScore: 92.5,
  dueEvents: 4,
  linkedDueEvents: 3,
  linkedEvents: 3,
  pendingIssuanceEvents: 1,
  totalEvents: 5,
  unlinkedEvents: 1,
  withPerfectScore: 2,
};

describe("listEventDteLinkOverview", () => {
  it("rejects a malformed period before any DB call", async () => {
    const err = await listEventDteLinkOverview({ period: "2026/05" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).kind).toBe("BAD_REQUEST");
    expect((err as DomainError).message).toContain("YYYY-MM");
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it("clamps page/pageSize, computes derived stats, and maps a LINKED row's documents", async () => {
    queryRawQueue.push([overviewStats]); // statsRows
    queryRawQueue.push([{ count: 1 }]); // totalCountRows
    queryRawQueue.push([
      overviewRow({
        linkedCount: 2,
        confidenceScore: 95,
        linkedDteSaleDetailId: "dte-7",
        linkedMatchedBy: "rut",
        linkedClientName: "PEREZ JUAN",
        linkedClientRUT: "11111111-1",
        linkedFolio: "F-7",
        linkedTotalAmount: 5000,
        linkedDocumentsJson: [
          {
            clientName: "PEREZ JUAN",
            clientRUT: "11111111-1",
            confidenceScore: 95,
            documentDate: "2026-05-10",
            dteSaleDetailId: "dte-7",
            folio: "F-7",
            matchedBy: "rut",
            totalAmount: 5000,
          },
          // malformed doc (missing folio) → dropped by parseLinkedDocumentsJson
          {
            clientName: "X",
            clientRUT: "Y",
            confidenceScore: 10,
            documentDate: "2026-05-10",
            dteSaleDetailId: "z",
            matchedBy: "rut",
            totalAmount: 1,
          },
        ],
      }),
    ]); // rows

    const r = await listEventDteLinkOverview({
      period: "2026-05",
      page: -3, // clamped to 0
      pageSize: 5, // clamped up to 10
    });

    expect(r.page).toBe(0);
    expect(r.pageSize).toBe(10);
    expect(r.period).toBe("2026-05");
    expect(r.totalCount).toBe(1);
    expect(r.totalPages).toBe(1);
    // linkRate = round(3/4*100, 1) = 75; avgLinkedScore passes through
    expect(r.stats).toEqual({
      avgLinkedScore: 92.5,
      dueEvents: 4,
      linkedEvents: 3,
      linkRate: 75,
      totalEvents: 5,
      pendingIssuanceEvents: 1,
      unlinkedEvents: 1,
      withPerfectScore: 2,
    });
    expect(r.items).toHaveLength(1);
    const item = r.items[0];
    expect(item.linkStatus).toBe("linked");
    expect(item.linked).toBe(true);
    // the malformed second document is dropped → only one valid doc survives
    expect(item.linkedDocuments).toHaveLength(1);
    expect(item.linkedDocuments[0].folio).toBe("F-7");
    // linked row never recurses into getEventDteSuggestions
    expect(item.topHypothesis).toBeNull();
    // exactly 3 queries: stats + count + rows (no per-row suggestion query)
    expect(mockQueryRaw).toHaveBeenCalledTimes(3);
  });

  it("recurses into getEventDteSuggestions for a due+unlinked row and surfaces the top hypothesis", async () => {
    mockExtractIdentityHints.mockReturnValue({
      patientName: "Nadia Yanez",
      patientRut: "22.222.222-2",
      beneficiaryName: null,
      beneficiaryRut: null,
    });
    queryRawQueue.push([overviewStats]); // statsRows
    queryRawQueue.push([{ count: 1 }]); // totalCountRows
    queryRawQueue.push([
      overviewRow({
        linkedCount: 0, // unlinked
        eventDate: "2026-05-10", // <= today (2026-05-15) → due → unlinked status
        lastAutoLinkSkipAt: new Date("2026-05-14T10:00:00.000Z"),
        lastAutoLinkSkipReason: "Sin candidatos",
      }),
    ]); // rows
    // ── nested getEventDteSuggestions for the due+unlinked row ──
    queryRawQueue.push([baseEventRow]); // getEventByExternalIds
    queryRawQueue.push([]); // getEventDteLinksByInternalEventId (linked)
    queryRawQueue.push([
      {
        dteSaleDetailId: "dte-1",
        documentType: 39,
        clientRUT: "22222222-2",
        clientName: "YANEZ NADIA",
        folio: "F-9",
        documentDate: "2026-05-10",
        exemptAmount: 0,
        netAmount: 4200,
        ivaAmount: 800,
        totalAmount: 5000,
        linkedEventsCount: 0,
        retrievalMeta: {
          exactRutMatch: true,
          sameSeriesRutMatch: false,
          amountCandidate: true,
          sharedSurnameMatch: false,
          trigramSimilarity: 0,
        },
      },
    ]); // retrieveDteCandidates

    const r = await listEventDteLinkOverview({ period: "2026-05" });
    const item = r.items[0];
    expect(item.linkStatus).toBe("unlinked");
    expect(item.linked).toBe(false);
    // lastAutoLinkSkip is surfaced as ISO timestamp + reason
    expect(item.lastAutoLinkSkip).toEqual({
      attemptedAt: "2026-05-14T10:00:00.000Z",
      reason: "Sin candidatos",
    });
    // the recursion produced the same exact-name hypothesis (score 96)
    expect(item.topHypothesis?.score).toBe(96);
    expect(item.topHypothesis?.dteSaleDetailIds).toEqual(["dte-1"]);
    // stats(1) + count(1) + rows(1) + nested suggestions(3) = 6 queries
    expect(mockQueryRaw).toHaveBeenCalledTimes(6);
  });

  it("derives pending_issuance status for a future unlinked row and skips the recursion", async () => {
    queryRawQueue.push([overviewStats]);
    queryRawQueue.push([{ count: 1 }]);
    queryRawQueue.push([
      overviewRow({
        linkedCount: 0,
        eventDate: "2026-05-31", // > today (2026-05-15) → not due → pending_issuance
      }),
    ]);

    const r = await listEventDteLinkOverview({ period: "2026-05" });
    expect(r.items[0].linkStatus).toBe("pending_issuance");
    expect(r.items[0].topHypothesis).toBeNull();
    // no recursion → only the 3 top-level queries
    expect(mockQueryRaw).toHaveBeenCalledTimes(3);
  });

  it("uses the empty-stats fallback (linkRate 0) when statsRows is empty", async () => {
    queryRawQueue.push([]); // statsRows → empty → fallback object, dueEvents 0
    queryRawQueue.push([{ count: 0 }]); // totalCountRows
    queryRawQueue.push([]); // rows

    const r = await listEventDteLinkOverview({ period: "2026-05", query: "  juan  " });
    expect(r.items).toEqual([]);
    expect(r.totalCount).toBe(0);
    // dueEvents 0 → linkRate short-circuits to 0 (no division)
    expect(r.stats.linkRate).toBe(0);
    expect(r.stats.avgLinkedScore).toBe(0);
    expect(r.totalPages).toBe(1);
    // a non-empty trimmed query feeds the ILIKE search wildcard
    expect(queryRawCalls.some((q) => q.includes("ILIKE"))).toBe(true);
  });
});
