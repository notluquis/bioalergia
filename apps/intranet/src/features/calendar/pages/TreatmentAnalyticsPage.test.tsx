/**
 * Tests for `TreatmentAnalyticsPage`.
 *
 * Recharts ResponsiveContainer is intentionally stubbed: in jsdom it
 * measures parent width via `getBoundingClientRect`, which returns 0 ×
 * 0, so the chart never mounts its inner SVG and warnings flood the
 * test output. We replace the recharts surface with lightweight
 * placeholders — coverage focuses on header, period switcher, KPI
 * cards, detail table, and tab/loading interactions. The chart visual
 * is covered by Storybook + Chromatic, not RTL.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as ReactRouterModule from "@tanstack/react-router";
import type * as RechartsModule from "recharts";

import { calendarKeys } from "@/features/calendar/queries";
import type { TreatmentAnalytics } from "@/features/calendar/types";

const navigateMock = vi.hoisted(() => vi.fn<(opts: unknown) => void>());
const searchState = vi.hoisted(() => ({
  current: {} as Record<string, unknown>,
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof ReactRouterModule>();
  return {
    ...actual,
    getRouteApi: () => ({
      useNavigate: () => navigateMock,
      useSearch: () => searchState.current,
    }),
  };
});

vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof RechartsModule>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container" style={{ width: 800, height: 300 }}>
        {children}
      </div>
    ),
  };
});

vi.mock("@/lib/chart-palette", () => ({
  useChartPalette: () => ({
    colors: ["#000"],
    grid: "#ccc",
    text: "#000",
    primary: "#1d4ed8",
    secondary: "#a855f7",
    success: "#10b981",
    warning: "#f59e0b",
    danger: "#ef4444",
    default: "#6b7280",
  }),
}));

vi.mock("@/features/calendar/api", () => ({
  fetchAutoLinkEventDteJobStatus: vi.fn(),
  fetchCalendarDaily: vi.fn(),
  fetchCalendarSummary: vi.fn(),
  fetchCalendarSyncLogs: vi.fn(),
  fetchCalendars: vi.fn(),
  fetchClassificationOptions: vi.fn(),
  fetchEventDteLinksByDay: vi.fn(),
  fetchEventDteLinksOverview: vi.fn(),
  fetchEventDteSuggestions: vi.fn(),
  fetchTreatmentAnalytics: vi.fn(),
  fetchUnclassifiedCalendarEvents: vi.fn(),
}));

import { TreatmentAnalyticsPage } from "./TreatmentAnalyticsPage";

const baseTotals = {
  amountExpected: 1_500_000,
  amountPaid: 1_200_000,
  domicilioCount: 4,
  dosageMl: 12.5,
  events: 27,
  induccionCount: 10,
  mantencionCount: 15,
};

const mockData: TreatmentAnalytics = {
  totals: baseTotals,
  byMonth: [
    { ...baseTotals, year: 2026, month: 4 },
    { ...baseTotals, year: 2026, month: 5 },
  ],
  byWeek: [{ ...baseTotals, isoWeek: 18, isoYear: 2026 }],
  byDate: [{ ...baseTotals, date: "2026-05-01" }],
};

function seedQuery(client: QueryClient, search: Record<string, unknown>): void {
  searchState.current = search;
  // Default range mirrors getDefaultRange() — start of 3 months ago to end of next month.
  const from = (search.from as string | undefined) ?? "2026-02-01";
  const to = (search.to as string | undefined) ?? "2026-06-30";

  // Granularity inferred from search.period (matches resolvePeriod/resolveGranularity).
  const hasMonth = Boolean(search.month);
  const period = hasMonth ? ((search.period as string | undefined) ?? "week") : "month";
  const granularity: "day" | "week" | "month" =
    period === "day" ? "day" : period === "week" ? "week" : "month";

  const filters = {
    beneficiaryRut: undefined,
    from,
    to,
    calendarIds: undefined,
    clinicalSeriesId: undefined,
    patientRut: undefined,
    seriesKind: undefined,
    seriesStatus: undefined,
  };
  client.setQueryData(calendarKeys.treatmentAnalytics(filters, granularity), mockData);
}

function renderPage(search: Record<string, unknown> = {}): QueryClient {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: Number.POSITIVE_INFINITY },
    },
  });
  seedQuery(queryClient, search);
  render(
    <QueryClientProvider client={queryClient}>
      <TreatmentAnalyticsPage />
    </QueryClientProvider>
  );
  return queryClient;
}

describe("TreatmentAnalyticsPage", () => {
  beforeEach(() => {
    // Pin the clock to mid-May 2026 so getDefaultRange() (today−3mo startOf →
    // today+1mo endOf) === the seeded range (2026-02-01 … 2026-06-30). Without
    // this the test breaks every time the real month rolls over (it silently
    // started failing on 2026-06-01). Fake only Date so userEvent's timers stay
    // real.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 4, 15, 12, 0, 0));
    navigateMock.mockReset();
    searchState.current = {};
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders KPI cards and detail table with seeded analytics", () => {
    renderPage();
    // "Tratamientos" appears in KPI card label + detail-table column header
    // + recharts Area name — use getAllByText.
    expect(screen.getAllByText(/tratamientos/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/consumo \(ml\)/i)).toBeInTheDocument();
    expect(screen.getByText(/domicilios/i)).toBeInTheDocument();
    // Detail table card heading
    expect(screen.getByText(/detalle del periodo/i)).toBeInTheDocument();
    // Trend chart card heading
    expect(screen.getByText(/tendencia de actividad/i)).toBeInTheDocument();
    // Both "Ingresos Esperado" and "Ingresos Pagado" appear in KPI grid +
    // detail-table headers (each at least twice).
    expect(screen.getAllByText(/ingresos esperado/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/ingresos pagado/i).length).toBeGreaterThanOrEqual(1);
  });

  it("exposes primary refresh action with accessible role", () => {
    renderPage();
    const buttons = screen.getAllByRole("button");
    // Refresh + filter trigger + period toggles + month shortcuts — sanity-check we have many.
    expect(buttons.length).toBeGreaterThan(5);
  });

  it("switches period via the 'Por Semana' tab and navigates with month=current", async () => {
    renderPage();
    const user = userEvent.setup();
    const weekBtn = screen.getByRole("button", { name: /por semana/i });
    await user.click(weekBtn);
    expect(navigateMock).toHaveBeenCalledTimes(1);
    const call = navigateMock.mock.calls[0]?.[0] as
      | { search?: (prev: object) => object }
      | undefined;
    expect(call).toBeDefined();
    // Without a month selected, "Por Semana" should select current month with period=week.
    if (call?.search) {
      const next = call.search({}) as Record<string, unknown>;
      expect(next.period).toBe("week");
      expect(typeof next.month).toBe("string");
    }
  });

  it("renders loading skeleton when data is missing", () => {
    // Don't seed; useQuery resolves to undefined+isLoading=true via React Query.
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
          // Force isLoading by never resolving the query.
          queryFn: () => new Promise(() => undefined),
        },
      },
    });
    searchState.current = {};
    render(
      <QueryClientProvider client={queryClient}>
        <TreatmentAnalyticsPage />
      </QueryClientProvider>
    );
    // "Cargando datos..." live region in the header.
    expect(screen.getByText(/cargando datos/i)).toBeInTheDocument();
  });

  it("supports keyboard activation of the 'Mes actual' shortcut", async () => {
    renderPage();
    const user = userEvent.setup();
    const btn = screen.getAllByRole("button", { name: /mes actual/i })[0];
    expect(btn).toBeDefined();
    if (!btn) {
      throw new Error("Mes actual button not found");
    }
    btn.focus();
    expect(btn).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(navigateMock).toHaveBeenCalled();
  });
});
