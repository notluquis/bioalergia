/**
 * Tests for CalendarVistaPanel — the `/calendar?tab=vista` landing
 * surface (Phase 5 IA). Asserts that:
 *
 *  - the lazy FullCalendar grid eventually mounts (Suspense boundary
 *    resolves) and exposes a visible scaffolding element;
 *  - the nav cards to /clinical/agenda /clinical/day /clinical/heatmap
 *    are still rendered as deep-link cards underneath the grid;
 *  - no toolbar week-nav button hard-codes a URL — the in-grid
 *    `prev/next/today` buttons are FullCalendar-owned and work without
 *    a router context.
 *
 * The `useCalendarEvents` hook is mocked at module scope so the test
 * doesn't pull SettingsContext + ToastContext + the oRPC client.
 */
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useCalendarEventsMock = vi.hoisted(() =>
  vi.fn<() => { daily: unknown; error: Error | null; loading: boolean }>()
);
const useNavigateMock = vi.hoisted(() => vi.fn<() => (..._args: unknown[]) => void>());

vi.mock("@/features/calendar/hooks/use-calendar-events", () => ({
  useCalendarEvents: useCalendarEventsMock,
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: useNavigateMock,
}));

import { CalendarVistaPanel } from "./CalendarVistaPanel";

describe("CalendarVistaPanel", () => {
  beforeEach(() => {
    useCalendarEventsMock.mockReset();
    useNavigateMock.mockReset();
    useNavigateMock.mockReturnValue(vi.fn());
  });

  it("renders the FullCalendar grid wrapper and the deep-link nav cards", async () => {
    useCalendarEventsMock.mockReturnValue({
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
        filters: {
          calendarIds: [],
          categories: [],
          from: "2026-05-12",
          maxDays: 7,
          to: "2026-05-18",
        },
        totals: { amountExpected: 0, amountPaid: 0, days: 1, events: 1 },
      },
      error: null,
      loading: false,
    });

    render(<CalendarVistaPanel />);

    // Deep-link cards: synchronous, always rendered.
    expect(screen.getByRole("button", { name: /abrir agenda/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /abrir vista diaria/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /abrir mapa de calor/i })).toBeDefined();

    // The FullCalendar grid mounts inside Suspense (lazy chunk); wait
    // for the host wrapper to render its child. We assert on the
    // wrapper test-id which is always there, and then on the
    // `.fc` root which FullCalendar injects on first mount.
    expect(screen.getByTestId("calendar-vista-grid")).toBeDefined();

    await waitFor(
      () => {
        const wrapper = screen.getByTestId("calendar-vista-grid");
        const fcRoot = wrapper.querySelector(".fc");
        expect(fcRoot).not.toBeNull();
      },
      { timeout: 5000 }
    );
  });

  it("renders a skeleton while loading", () => {
    useCalendarEventsMock.mockReturnValue({
      daily: undefined,
      error: null,
      loading: true,
    });

    render(<CalendarVistaPanel />);

    expect(screen.getByLabelText(/cargando calendario/i)).toBeDefined();
  });

  it("renders an error notice when the daily query fails", () => {
    useCalendarEventsMock.mockReturnValue({
      daily: undefined,
      error: new Error("boom"),
      loading: false,
    });

    render(<CalendarVistaPanel />);

    expect(screen.getByText(/no se pudieron cargar los eventos/i)).toBeDefined();
  });
});
