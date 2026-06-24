import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";

import {
  autoLinkEventDteByAllPeriods,
  autoLinkEventDteByDay,
  autoLinkEventDteByPeriod,
  classifyCalendarEvent,
  confirmEventDteLink,
  fetchAutoLinkEventDteJobStatus,
  fetchCalendarDaily,
  fetchCalendarJobStatus,
  fetchCalendarSummary,
  fetchCalendarSyncLogs,
  fetchCalendars,
  fetchClassificationOptions,
  fetchEventDteLinksByDay,
  fetchEventDteLinksOverview,
  fetchEventDteSuggestions,
  fetchTreatmentAnalytics,
  fetchUnclassifiedCalendarEvents,
  rebuildClinicalSeries,
  reclassifyAllCalendarEvents,
  reclassifyCalendarEvents,
  startAutoLinkEventDteAllPeriodsJob,
  syncCalendarEvents,
  unlinkEventDteLink,
} from "./api";
import { dteEventLinksORPCClient } from "./dte-orpc";
import { calendarORPCClient } from "./orpc";

// Mock the calendar oRPC client and DTE event-links oRPC client. We
// re-export the real toCalendarApiError so error-path assertions land on
// real ApiError instances. Same pattern as features/patients/api.test.ts.
vi.mock("./orpc", async () => {
  const { ApiError: RealApiError } = await import("@/lib/api-client");
  const { ORPCError } = await import("@orpc/client");
  return {
    calendarORPCClient: {
      calendars: vi.fn(),
      classificationOptions: vi.fn(),
      classifyEvent: vi.fn(),
      dailyEvents: vi.fn(),
      jobStatus: vi.fn(),
      rebuildClinicalSeries: vi.fn(),
      reclassifyAllEvents: vi.fn(),
      reclassifyEvents: vi.fn(),
      summaryEvents: vi.fn(),
      syncEvents: vi.fn(),
      syncLogs: vi.fn(),
      treatmentAnalytics: vi.fn(),
      unclassifiedEvents: vi.fn(),
    },
    toCalendarApiError: (error: unknown) => {
      if (error instanceof RealApiError) return error;
      if (error instanceof ORPCError) {
        return new RealApiError(error.message, error.status, error.data);
      }
      if (error instanceof Error) return new RealApiError(error.message, 500);
      return new RealApiError("Error inesperado", 500, error);
    },
  };
});

vi.mock("./dte-orpc", () => ({
  dteEventLinksORPCClient: {
    autoLinkAllPeriods: vi.fn(),
    autoLinkDay: vi.fn(),
    autoLinkJobStatus: vi.fn(),
    autoLinkPeriod: vi.fn(),
    byDay: vi.fn(),
    confirmLink: vi.fn(),
    overview: vi.fn(),
    startAutoLinkAllPeriods: vi.fn(),
    suggestions: vi.fn(),
    unlinkLink: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const NOW = new Date("2026-05-12T10:00:00.000Z");

const baseFilters = {
  calendarIds: [] as string[],
  categories: [] as string[],
  from: "2026-05-01",
  maxDays: 30,
  to: "2026-05-31",
};

const summaryFilters = {
  calendarIds: [],
  categories: [],
  from: "2026-05-01",
  to: "2026-05-31",
};

const totals = { amountExpected: 0, amountPaid: 0, days: 0, events: 0 };

describe("classifyCalendarEvent", () => {
  it("calls client and resolves", async () => {
    vi.mocked(calendarORPCClient.classifyEvent).mockResolvedValue(undefined as never);
    await expect(
      classifyCalendarEvent({ eventId: "e1", calendarId: "c1" } as never)
    ).resolves.toBeUndefined();
    expect(calendarORPCClient.classifyEvent).toHaveBeenCalled();
  });

  it("wraps errors into ApiError", async () => {
    vi.mocked(calendarORPCClient.classifyEvent).mockRejectedValue(new Error("nope"));
    await expect(classifyCalendarEvent({} as never)).rejects.toBeInstanceOf(ApiError);
  });
});

describe("fetchCalendarDaily", () => {
  it("parses response and converts dates", async () => {
    vi.mocked(calendarORPCClient.dailyEvents).mockResolvedValue({
      days: [
        {
          amountExpected: 0,
          amountPaid: 0,
          date: "2026-05-12",
          events: [],
          total: 0,
        },
      ],
      filters: baseFilters,
      totals,
    } as never);
    const result = await fetchCalendarDaily(baseFilters as never);
    expect(result.days[0]?.date).toBeInstanceOf(Date);
    expect(result.totals).toEqual(totals);
  });

  it("wraps errors", async () => {
    vi.mocked(calendarORPCClient.dailyEvents).mockRejectedValue(new Error("x"));
    await expect(fetchCalendarDaily(baseFilters as never)).rejects.toBeInstanceOf(ApiError);
  });

  it("throws on schema mismatch", async () => {
    vi.mocked(calendarORPCClient.dailyEvents).mockResolvedValue({} as never);
    await expect(fetchCalendarDaily(baseFilters as never)).rejects.toBeInstanceOf(ApiError);
  });
});

describe("fetchCalendars", () => {
  it("parses calendar list", async () => {
    vi.mocked(calendarORPCClient.calendars).mockResolvedValue([
      {
        createdAt: NOW,
        eventCount: 5,
        googleId: "g1",
        id: 1,
        name: "Main",
        updatedAt: NOW,
      },
    ] as never);
    const out = await fetchCalendars();
    expect(out).toHaveLength(1);
    expect(out[0]?.googleId).toBe("g1");
  });

  it("wraps errors", async () => {
    vi.mocked(calendarORPCClient.calendars).mockRejectedValue(new Error("x"));
    await expect(fetchCalendars()).rejects.toBeInstanceOf(ApiError);
  });
});

describe("fetchCalendarSummary", () => {
  it("parses summary", async () => {
    vi.mocked(calendarORPCClient.summaryEvents).mockResolvedValue({
      aggregates: {
        byDate: [],
        byDateType: [],
        byMonth: [],
        byWeek: [],
        byWeekday: [],
        byYear: [],
      },
      available: { calendars: [], categories: [], eventTypes: [] },
      filters: summaryFilters,
      totals,
    } as never);
    const out = await fetchCalendarSummary(baseFilters as never);
    expect(out.totals.events).toBe(0);
  });

  it("wraps errors", async () => {
    vi.mocked(calendarORPCClient.summaryEvents).mockRejectedValue(new Error("x"));
    await expect(fetchCalendarSummary(baseFilters as never)).rejects.toBeInstanceOf(ApiError);
  });
});

describe("fetchCalendarSyncLogs", () => {
  it("parses logs and forwards default limit", async () => {
    vi.mocked(calendarORPCClient.syncLogs).mockResolvedValue([] as never);
    const out = await fetchCalendarSyncLogs();
    expect(out).toEqual([]);
    expect(calendarORPCClient.syncLogs).toHaveBeenCalledWith({ limit: 50 });
  });

  it("forwards custom limit", async () => {
    vi.mocked(calendarORPCClient.syncLogs).mockResolvedValue([] as never);
    await fetchCalendarSyncLogs(10);
    expect(calendarORPCClient.syncLogs).toHaveBeenCalledWith({ limit: 10 });
  });

  it("wraps errors", async () => {
    vi.mocked(calendarORPCClient.syncLogs).mockRejectedValue(new Error("x"));
    await expect(fetchCalendarSyncLogs()).rejects.toBeInstanceOf(ApiError);
  });
});

describe("fetchClassificationOptions", () => {
  it("parses options", async () => {
    vi.mocked(calendarORPCClient.classificationOptions).mockResolvedValue({
      categories: ["A"],
      missingFilters: [{ key: "k", label: "L" }],
      patchReadings: [],
      testSubtypes: [],
      treatmentStages: [],
    } as never);
    const out = await fetchClassificationOptions();
    expect(out.categories).toEqual(["A"]);
  });

  it("wraps errors", async () => {
    vi.mocked(calendarORPCClient.classificationOptions).mockRejectedValue(new Error("x"));
    await expect(fetchClassificationOptions()).rejects.toBeInstanceOf(ApiError);
  });
});

describe("fetchUnclassifiedCalendarEvents", () => {
  it("parses with default args", async () => {
    vi.mocked(calendarORPCClient.unclassifiedEvents).mockResolvedValue({
      events: [],
      totalCount: 0,
    } as never);
    const out = await fetchUnclassifiedCalendarEvents();
    expect(out).toEqual({ events: [], totalCount: 0 });
    expect(calendarORPCClient.unclassifiedEvents).toHaveBeenCalledWith({
      filterMode: undefined,
      limit: 50,
      missing: undefined,
      offset: 0,
    });
  });

  it("dedupes missing filters", async () => {
    vi.mocked(calendarORPCClient.unclassifiedEvents).mockResolvedValue({
      events: [],
      totalCount: 0,
    } as never);
    await fetchUnclassifiedCalendarEvents(20, 5, {
      filterMode: "AND",
      missing: ["missingCategory", "missingCategory", "missingDosage"],
    });
    expect(calendarORPCClient.unclassifiedEvents).toHaveBeenCalledWith({
      filterMode: "AND",
      limit: 20,
      missing: ["missingCategory", "missingDosage"],
      offset: 5,
    });
  });

  it("wraps errors", async () => {
    vi.mocked(calendarORPCClient.unclassifiedEvents).mockRejectedValue(new Error("x"));
    await expect(fetchUnclassifiedCalendarEvents()).rejects.toBeInstanceOf(ApiError);
  });
});

describe("reclassifyAllCalendarEvents", () => {
  it("parses job response", async () => {
    vi.mocked(calendarORPCClient.reclassifyAllEvents).mockResolvedValue({
      jobId: "j1",
      status: "accepted",
      totalEvents: 7,
    } as never);
    const out = await reclassifyAllCalendarEvents();
    expect(out).toEqual({ jobId: "j1", totalEvents: 7 });
  });

  it("wraps errors", async () => {
    vi.mocked(calendarORPCClient.reclassifyAllEvents).mockRejectedValue(new Error("x"));
    await expect(reclassifyAllCalendarEvents()).rejects.toBeInstanceOf(ApiError);
  });
});

describe("reclassifyCalendarEvents", () => {
  it("parses without filters and forwards empty body", async () => {
    vi.mocked(calendarORPCClient.reclassifyEvents).mockResolvedValue({
      jobId: "j1",
      status: "accepted",
      totalEvents: 3,
    } as never);
    await reclassifyCalendarEvents();
    expect(calendarORPCClient.reclassifyEvents).toHaveBeenCalledWith({});
  });

  it("dedupes missing filters when provided", async () => {
    vi.mocked(calendarORPCClient.reclassifyEvents).mockResolvedValue({
      jobId: "j1",
      status: "accepted",
      totalEvents: 3,
    } as never);
    await reclassifyCalendarEvents({
      filterMode: "OR",
      missing: ["missingAttended", "missingAttended"],
    });
    expect(calendarORPCClient.reclassifyEvents).toHaveBeenCalledWith({
      filterMode: "OR",
      missing: ["missingAttended"],
    });
  });

  it("wraps errors", async () => {
    vi.mocked(calendarORPCClient.reclassifyEvents).mockRejectedValue(new Error("x"));
    await expect(reclassifyCalendarEvents()).rejects.toBeInstanceOf(ApiError);
  });
});

describe("syncCalendarEvents", () => {
  it("parses sync response", async () => {
    vi.mocked(calendarORPCClient.syncEvents).mockResolvedValue({
      logId: 99,
      message: "ok",
      status: "accepted",
    } as never);
    const out = await syncCalendarEvents();
    expect(out.logId).toBe(99);
  });

  it("wraps errors", async () => {
    vi.mocked(calendarORPCClient.syncEvents).mockRejectedValue(new Error("x"));
    await expect(syncCalendarEvents()).rejects.toBeInstanceOf(ApiError);
  });
});

describe("fetchCalendarJobStatus", () => {
  it("parses job status", async () => {
    vi.mocked(calendarORPCClient.jobStatus).mockResolvedValue({
      job: {
        error: null,
        id: "j1",
        message: "running",
        progress: 50,
        result: null,
        status: "running",
        total: 100,
        type: "reclassify",
      },
    } as never);
    const out = await fetchCalendarJobStatus("j1");
    expect(out.id).toBe("j1");
    expect(calendarORPCClient.jobStatus).toHaveBeenCalledWith({ jobId: "j1" });
  });

  it("wraps errors", async () => {
    vi.mocked(calendarORPCClient.jobStatus).mockRejectedValue(new Error("x"));
    await expect(fetchCalendarJobStatus("j1")).rejects.toBeInstanceOf(ApiError);
  });
});

describe("fetchTreatmentAnalytics", () => {
  it("parses analytics, forwarding granularity", async () => {
    const period = {
      amountExpected: 0,
      amountPaid: 0,
      domicilioCount: 0,
      dosageMl: 0,
      events: 0,
      induccionCount: 0,
      mantencionCount: 0,
    };
    vi.mocked(calendarORPCClient.treatmentAnalytics).mockResolvedValue({
      data: { totals: period },
      filters: { calendarIds: [] },
    } as never);
    const out = await fetchTreatmentAnalytics(
      {
        calendarIds: [],
        from: "2026-05-01",
        to: "2026-05-31",
      } as never,
      "month"
    );
    expect(out.totals.events).toBe(0);
    expect(calendarORPCClient.treatmentAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({ granularity: "month" })
    );
  });

  it("wraps errors", async () => {
    vi.mocked(calendarORPCClient.treatmentAnalytics).mockRejectedValue(new Error("x"));
    await expect(
      fetchTreatmentAnalytics({ calendarIds: [], from: "2026-05-01", to: "2026-05-31" } as never)
    ).rejects.toBeInstanceOf(ApiError);
  });
});

describe("rebuildClinicalSeries", () => {
  it("parses response with default empty params", async () => {
    vi.mocked(calendarORPCClient.rebuildClinicalSeries).mockResolvedValue({
      from: null,
      processed: 3,
      to: null,
    } as never);
    const out = await rebuildClinicalSeries();
    expect(out.processed).toBe(3);
    expect(calendarORPCClient.rebuildClinicalSeries).toHaveBeenCalledWith({});
  });

  it("forwards range params", async () => {
    vi.mocked(calendarORPCClient.rebuildClinicalSeries).mockResolvedValue({
      from: "2026-05-01",
      processed: 1,
      to: "2026-05-10",
    } as never);
    await rebuildClinicalSeries({ from: "2026-05-01", to: "2026-05-10" });
    expect(calendarORPCClient.rebuildClinicalSeries).toHaveBeenCalledWith({
      from: "2026-05-01",
      to: "2026-05-10",
    });
  });

  it("wraps errors", async () => {
    vi.mocked(calendarORPCClient.rebuildClinicalSeries).mockRejectedValue(new Error("x"));
    await expect(rebuildClinicalSeries()).rejects.toBeInstanceOf(ApiError);
  });
});

describe("DTE event-link fetchers", () => {
  it("fetchEventDteLinksByDay parses array", async () => {
    vi.mocked(dteEventLinksORPCClient.byDay).mockResolvedValue([] as never);
    const out = await fetchEventDteLinksByDay("2026-05-12");
    expect(out).toEqual([]);
    expect(dteEventLinksORPCClient.byDay).toHaveBeenCalledWith({ date: "2026-05-12" });
  });

  it("fetchEventDteLinksByDay wraps errors", async () => {
    vi.mocked(dteEventLinksORPCClient.byDay).mockRejectedValue(new Error("x"));
    await expect(fetchEventDteLinksByDay("2026-05-12")).rejects.toBeInstanceOf(ApiError);
  });

  it("fetchEventDteSuggestions parses response", async () => {
    vi.mocked(dteEventLinksORPCClient.suggestions).mockResolvedValue({
      candidateSetSummary: {
        consideredCount: 0,
        fallbackCount: 0,
        retrievedCount: 0,
        sameDayCount: 0,
      },
      event: null,
      fallbackCandidates: [],
      hypotheses: [],
      identityClaims: null,
      linked: null,
      linkedDocuments: [],
      series: null,
    } as never);
    const out = await fetchEventDteSuggestions({ calendarId: "c", eventId: "e" });
    expect(out.hypotheses).toEqual([]);
  });

  it("fetchEventDteSuggestions wraps errors", async () => {
    vi.mocked(dteEventLinksORPCClient.suggestions).mockRejectedValue(new Error("x"));
    await expect(
      fetchEventDteSuggestions({ calendarId: "c", eventId: "e" })
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("confirmEventDteLink resolves on success and defaults dteSaleDetailIds", async () => {
    vi.mocked(dteEventLinksORPCClient.confirmLink).mockResolvedValue(null as never);
    await expect(confirmEventDteLink({ calendarId: "c", eventId: "e" })).resolves.toBeUndefined();
    expect(dteEventLinksORPCClient.confirmLink).toHaveBeenCalledWith(
      expect.objectContaining({ dteSaleDetailIds: [] })
    );
  });

  it("confirmEventDteLink forwards dteSaleDetailIds when provided", async () => {
    vi.mocked(dteEventLinksORPCClient.confirmLink).mockResolvedValue(null as never);
    await confirmEventDteLink({
      calendarId: "c",
      dteSaleDetailIds: ["d1"],
      eventId: "e",
    });
    expect(dteEventLinksORPCClient.confirmLink).toHaveBeenCalledWith(
      expect.objectContaining({ dteSaleDetailIds: ["d1"] })
    );
  });

  it("confirmEventDteLink wraps errors", async () => {
    vi.mocked(dteEventLinksORPCClient.confirmLink).mockRejectedValue(new Error("x"));
    await expect(confirmEventDteLink({ calendarId: "c", eventId: "e" })).rejects.toBeInstanceOf(
      ApiError
    );
  });

  it("unlinkEventDteLink resolves on success", async () => {
    vi.mocked(dteEventLinksORPCClient.unlinkLink).mockResolvedValue(null as never);
    await expect(unlinkEventDteLink({ calendarId: "c", eventId: "e" })).resolves.toBeUndefined();
  });

  it("unlinkEventDteLink wraps errors", async () => {
    vi.mocked(dteEventLinksORPCClient.unlinkLink).mockRejectedValue(new Error("x"));
    await expect(unlinkEventDteLink({ calendarId: "c", eventId: "e" })).rejects.toBeInstanceOf(
      ApiError
    );
  });

  it("autoLinkEventDteByDay parses response", async () => {
    vi.mocked(dteEventLinksORPCClient.autoLinkDay).mockResolvedValue({
      date: "2026-05-12",
      details: [],
      linked: 1,
      skipped: 0,
      skippedByReason: [],
      totalEvents: 1,
    } as never);
    const out = await autoLinkEventDteByDay({ date: "2026-05-12" });
    expect(out.linked).toBe(1);
  });

  it("autoLinkEventDteByDay wraps errors", async () => {
    vi.mocked(dteEventLinksORPCClient.autoLinkDay).mockRejectedValue(new Error("x"));
    await expect(autoLinkEventDteByDay({ date: "2026-05-12" })).rejects.toBeInstanceOf(ApiError);
  });

  it("autoLinkEventDteByPeriod parses response", async () => {
    vi.mocked(dteEventLinksORPCClient.autoLinkPeriod).mockResolvedValue({
      daysProcessed: 0,
      details: [],
      linked: 0,
      period: "2026-05",
      skipped: 0,
      skippedByReason: [],
      totalEvents: 0,
    } as never);
    const out = await autoLinkEventDteByPeriod({ period: "2026-05" });
    expect(out.period).toBe("2026-05");
  });

  it("autoLinkEventDteByPeriod wraps errors", async () => {
    vi.mocked(dteEventLinksORPCClient.autoLinkPeriod).mockRejectedValue(new Error("x"));
    await expect(autoLinkEventDteByPeriod({ period: "2026-05" })).rejects.toBeInstanceOf(ApiError);
  });

  it("autoLinkEventDteByAllPeriods uses empty default payload and parses response", async () => {
    vi.mocked(dteEventLinksORPCClient.autoLinkAllPeriods).mockResolvedValue({
      details: [],
      linked: 0,
      periodsProcessed: 0,
      skipped: 0,
      skippedByReason: [],
      totalEvents: 0,
    } as never);
    await autoLinkEventDteByAllPeriods();
    expect(dteEventLinksORPCClient.autoLinkAllPeriods).toHaveBeenCalledWith({});
  });

  it("autoLinkEventDteByAllPeriods wraps errors", async () => {
    vi.mocked(dteEventLinksORPCClient.autoLinkAllPeriods).mockRejectedValue(new Error("x"));
    await expect(autoLinkEventDteByAllPeriods()).rejects.toBeInstanceOf(ApiError);
  });

  it("startAutoLinkEventDteAllPeriodsJob parses response with default payload", async () => {
    vi.mocked(dteEventLinksORPCClient.startAutoLinkAllPeriods).mockResolvedValue({
      jobId: "j1",
      periodConcurrency: 2,
      totalPeriods: 12,
    } as never);
    const out = await startAutoLinkEventDteAllPeriodsJob();
    expect(out.jobId).toBe("j1");
    expect(dteEventLinksORPCClient.startAutoLinkAllPeriods).toHaveBeenCalledWith({});
  });

  it("startAutoLinkEventDteAllPeriodsJob wraps errors", async () => {
    vi.mocked(dteEventLinksORPCClient.startAutoLinkAllPeriods).mockRejectedValue(new Error("x"));
    await expect(startAutoLinkEventDteAllPeriodsJob()).rejects.toBeInstanceOf(ApiError);
  });

  it("fetchAutoLinkEventDteJobStatus parses response", async () => {
    vi.mocked(dteEventLinksORPCClient.autoLinkJobStatus).mockResolvedValue({
      error: null,
      id: "j1",
      message: "ok",
      progress: 100,
      result: null,
      status: "completed",
      total: 1,
      type: "auto-link",
    } as never);
    const out = await fetchAutoLinkEventDteJobStatus("j1");
    expect(out.status).toBe("completed");
  });

  it("fetchAutoLinkEventDteJobStatus wraps errors", async () => {
    vi.mocked(dteEventLinksORPCClient.autoLinkJobStatus).mockRejectedValue(new Error("x"));
    await expect(fetchAutoLinkEventDteJobStatus("j1")).rejects.toBeInstanceOf(ApiError);
  });

  it("fetchEventDteLinksOverview parses response", async () => {
    vi.mocked(dteEventLinksORPCClient.overview).mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 25,
      period: "2026-05",
      stats: {
        avgLinkedScore: 0,
        dueEvents: 0,
        linkRate: 0,
        linkedEvents: 0,
        pendingIssuanceEvents: 0,
        totalEvents: 0,
        unlinkedEvents: 0,
        withPerfectScore: 0,
      },
      totalCount: 0,
      totalPages: 0,
    } as never);
    const out = await fetchEventDteLinksOverview({ period: "2026-05" });
    expect(out.period).toBe("2026-05");
  });

  it("fetchEventDteLinksOverview wraps errors", async () => {
    vi.mocked(dteEventLinksORPCClient.overview).mockRejectedValue(new Error("x"));
    await expect(fetchEventDteLinksOverview({ period: "2026-05" })).rejects.toBeInstanceOf(
      ApiError
    );
  });
});

describe("ApiError passthrough", () => {
  it("does not double-wrap an existing ApiError", async () => {
    const original = new ApiError("forbidden", 403);
    vi.mocked(calendarORPCClient.calendars).mockRejectedValue(original);
    await expect(fetchCalendars()).rejects.toBe(original);
  });
});
