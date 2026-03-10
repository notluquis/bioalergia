import { createORPCClient } from "@orpc/client";
import { SuperJSONLink } from "./orpc";
import type {
  ClinicalSeriesSnapshot,
  EventDteConfirmedLink,
  EventDteOverviewResponseData,
  EventDteSuggestion,
} from "./types";

type EventDteAutoLinkJobStatus = {
  error: null | string;
  id: string;
  message: string;
  progress: number;
  result: unknown;
  status: "completed" | "failed" | "pending" | "running";
  total: number;
  type: string;
};

type DteEventLinksORPCClient = {
  autoLinkJobStatus: (input: { jobId: string }) => Promise<EventDteAutoLinkJobStatus>;
  autoLinkAllPeriods: (input?: { minScore?: number; periodConcurrency?: number }) => Promise<{
    details: Array<{
      daysProcessed: number;
      linked: number;
      period: string;
      skipped: number;
      totalEvents: number;
    }>;
    linked: number;
    periodsProcessed: number;
    skipped: number;
    skippedByReason: Array<{ count: number; reason: string }>;
    totalEvents: number;
  }>;
  autoLinkDay: (input: { date: string; minScore?: number }) => Promise<{
    date: string;
    details: Array<{ eventId: string; reason: string }>;
    linked: number;
    skipped: number;
    skippedByReason: Array<{ count: number; reason: string }>;
    totalEvents: number;
  }>;
  autoLinkPeriod: (input: { minScore?: number; period: string }) => Promise<{
    daysProcessed: number;
    details: Array<{ date: string; linked: number; skipped: number; totalEvents: number }>;
    linked: number;
    period: string;
    skipped: number;
    skippedByReason: Array<{ count: number; reason: string }>;
    totalEvents: number;
  }>;
  byDay: (input: { date: string }) => Promise<EventDteConfirmedLink[]>;
  confirmLink: (input: {
    calendarId: string;
    confidenceScore?: number;
    dteSaleDetailId: string;
    eventId: string;
    matchedBy?: "manual" | "mixed" | "name_exact" | "name_fuzzy" | "rut";
    matchedName?: null | string;
    matchedRUT?: null | string;
  }) => Promise<unknown>;
  overview: (input: {
    page?: number;
    pageSize?: number;
    period: string;
    query?: string;
    status?: "all" | "linked" | "pending_issuance" | "unlinked";
  }) => Promise<EventDteOverviewResponseData>;
  suggestions: (input: { calendarId: string; eventId: string; limit?: number }) => Promise<{
    event: null | {
      amountExpected: null | number;
      amountPaid: null | number;
      calendarId: string;
      description: null | string;
      eventDate: string;
      eventId: string;
      hints: { nameHints: string[]; rutHints: string[] };
      summary: null | string;
    };
    linked: unknown;
    series: ClinicalSeriesSnapshot | null;
    suggestions: EventDteSuggestion[];
  }>;
  startAutoLinkAllPeriods: (input?: { minScore?: number; periodConcurrency?: number }) => Promise<{
    jobId: string;
    periodConcurrency: number;
    totalPeriods: number;
  }>;
  unlinkLink: (input: { calendarId: string; eventId: string }) => Promise<{ deleted: boolean }>;
};

const dteEventLinksORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export const dteEventLinksORPCClient = createORPCClient<DteEventLinksORPCClient>(
  dteEventLinksORPCLink,
  {
    path: ["api", "orpc", "dte-analytics", "event-links", "rpc"],
  },
);
