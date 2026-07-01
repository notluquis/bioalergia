/**
 * Tests for CalendarVistaPanel — the unified `/calendar?tab=vista` agenda.
 * Asserts the lazy FullCalendar grid mounts, the loading skeleton shows, and
 * the error notice renders. `useCalendarEvents` + the router hooks are mocked
 * so the test doesn't pull SettingsContext / ToastContext / the oRPC client;
 * the Doctoralia `useQuery` is inert under the Google source but still needs a
 * QueryClient in context.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useCalendarEventsMock = vi.hoisted(() => vi.fn());
const useNavigateMock = vi.hoisted(() => vi.fn<() => (..._args: unknown[]) => void>());
const useSearchMock = vi.hoisted(() => vi.fn<() => Record<string, unknown>>());

vi.mock("@/features/calendar/hooks/use-calendar-events", () => ({
  useCalendarEvents: useCalendarEventsMock,
}));

vi.mock("@tanstack/react-router", () => ({
  getRouteApi: () => ({ useNavigate: useNavigateMock, useSearch: useSearchMock }),
}));

vi.mock("../components/CalendarFiltersPopover", () => ({
  CalendarFiltersPopover: () => <div data-testid="filters-popover" />,
}));

import { CalendarVistaPanel } from "./CalendarVistaPanel";

const appliedFilters = {
  calendarIds: [],
  categories: [],
  from: "2026-05-12",
  maxDays: 7,
  search: "",
  to: "2026-05-18",
};

function baseHook(over: Record<string, unknown>) {
  return {
    appliedFilters,
    availableCategories: [],
    daily: undefined,
    defaults: appliedFilters,
    error: null,
    loading: false,
    summary: { totals: { events: 0 } },
    ...over,
  };
}

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CalendarVistaPanel />
    </QueryClientProvider>
  );
}

describe("CalendarVistaPanel", () => {
  beforeEach(() => {
    useCalendarEventsMock.mockReset();
    useNavigateMock.mockReset();
    useNavigateMock.mockReturnValue(vi.fn());
    useSearchMock.mockReset();
    useSearchMock.mockReturnValue({});
  });

  it("mounts the FullCalendar grid with events", async () => {
    useCalendarEventsMock.mockReturnValue(
      baseHook({
        daily: {
          days: [
            {
              amountExpected: 0,
              amountPaid: 0,
              date: new Date("2026-05-18T00:00:00.000Z"),
              events: [
                {
                  calendarId: "cal-1",
                  colorId: null,
                  description: null,
                  endDate: null,
                  endDateTime: "2026-05-18T11:00:00.000Z",
                  endTimeZone: null,
                  eventCreatedAt: null,
                  eventDate: "2026-05-18",
                  eventDateTime: "2026-05-18T10:00:00.000Z",
                  eventId: "evt-1",
                  eventType: null,
                  eventUpdatedAt: null,
                  hangoutLink: null,
                  location: null,
                  rawEvent: null,
                  startDate: null,
                  startDateTime: "2026-05-18T10:00:00.000Z",
                  startTimeZone: null,
                  status: "confirmed",
                  summary: "Cita test",
                  transparency: null,
                  visibility: null,
                },
              ],
              total: 1,
            },
          ],
          filters: appliedFilters,
          totals: { amountExpected: 0, amountPaid: 0, days: 1, events: 1 },
        },
        summary: { totals: { events: 1 } },
      })
    );

    renderPanel();

    expect(screen.getByTestId("calendar-vista-grid")).toBeDefined();
    await waitFor(
      () => {
        const wrapper = screen.getByTestId("calendar-vista-grid");
        expect(wrapper.querySelector(".fc")).not.toBeNull();
      },
      { timeout: 5000 }
    );
  });

  it("renders a skeleton while loading", () => {
    useCalendarEventsMock.mockReturnValue(baseHook({ daily: undefined, loading: true }));
    renderPanel();
    expect(screen.getByLabelText(/cargando calendario/i)).toBeDefined();
  });

  it("renders an error notice when the daily query fails", () => {
    useCalendarEventsMock.mockReturnValue(baseHook({ daily: undefined, error: new Error("boom") }));
    renderPanel();
    expect(screen.getByText(/no se pudieron cargar los eventos/i)).toBeDefined();
  });
});
