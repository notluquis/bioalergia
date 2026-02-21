import { describe, expect, it } from "vitest";

import type { CalendarEventDetail } from "@/features/calendar/types";

import { getCalendarEventStates } from "./event-state";

function makeEvent(overrides: Partial<CalendarEventDetail> = {}): CalendarEventDetail {
  return {
    amountExpected: null,
    amountPaid: null,
    attended: null,
    calendarId: "cal-1",
    category: null,
    colorId: null,
    controlIncluded: null,
    description: null,
    dosageUnit: null,
    dosageValue: null,
    endDate: "2026-02-21",
    endDateTime: "2026-02-21T10:30:00.000Z",
    endTimeZone: null,
    eventCreatedAt: null,
    eventDate: "2026-02-21",
    eventDateTime: "2026-02-21T10:00:00.000Z",
    eventId: "evt-1",
    eventType: null,
    eventUpdatedAt: null,
    hangoutLink: null,
    location: null,
    rawEvent: null,
    startDate: "2026-02-21",
    startDateTime: "2026-02-21T10:00:00.000Z",
    startTimeZone: null,
    status: null,
    summary: "Evento",
    transparency: null,
    treatmentStage: null,
    visibility: null,
    ...overrides,
  };
}

describe("getCalendarEventStates", () => {
  it("returns attended state when attended is true", () => {
    const states = getCalendarEventStates(makeEvent({ attended: true }));
    expect(states[0]).toMatchObject({ key: "attendance", label: "Asistió", tone: "success" });
  });

  it("returns no-show state when attended is false", () => {
    const states = getCalendarEventStates(makeEvent({ attended: false }));
    expect(states[0]).toMatchObject({ key: "attendance", label: "No asistió", tone: "danger" });
  });

  it("returns scheduled state for future events with unknown attendance", () => {
    const states = getCalendarEventStates(
      makeEvent({ attended: null, startDateTime: "2099-02-21T10:00:00.000Z" }),
    );
    expect(states[0]).toMatchObject({
      key: "attendance",
      label: "Programada",
      tone: "warning",
    });
  });

  it("maps confirmed status", () => {
    const states = getCalendarEventStates(makeEvent({ status: "confirmed" }));
    expect(states).toContainEqual(
      expect.objectContaining({ key: "event-status", label: "Confirmado", tone: "success" }),
    );
  });

  it("maps tentative status", () => {
    const states = getCalendarEventStates(makeEvent({ status: "tentative" }));
    expect(states).toContainEqual(
      expect.objectContaining({ key: "event-status", label: "Tentativo", tone: "warning" }),
    );
  });

  it("maps cancelled status", () => {
    const states = getCalendarEventStates(makeEvent({ status: "cancelled" }));
    expect(states).toContainEqual(
      expect.objectContaining({ key: "event-status", label: "Cancelado", tone: "danger" }),
    );
  });

  it("maps needsAction status", () => {
    const states = getCalendarEventStates(makeEvent({ status: "needsAction" }));
    expect(states).toContainEqual(
      expect.objectContaining({ key: "event-status", label: "Por confirmar", tone: "warning" }),
    );
  });

  it("deduplicates equal labels across attendance and status", () => {
    const states = getCalendarEventStates(makeEvent({ attended: false, status: "noShow" }));
    const noShowLabels = states.filter((state) => state.label === "No asistió");
    expect(noShowLabels).toHaveLength(1);
  });
});
