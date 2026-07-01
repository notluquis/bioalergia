import { describe, expect, it } from "vitest";

import type {
  DoctoraliaCalendarMerged,
  DoctoraliaEmailNotification,
} from "@/features/doctoralia/types";

import { mergedToCalendarEventDetails, normalizePatientName } from "./doctoralia-merge";

function email(over: Partial<DoctoraliaEmailNotification>): DoctoraliaEmailNotification {
  return {
    appointmentDate: new Date("2026-06-30T14:00:00.000Z"),
    appointmentDoctor: null,
    appointmentService: null,
    calendarAppointmentId: null,
    clinicAddress: null,
    createdAt: new Date("2026-06-29T00:00:00.000Z"),
    emailMessageId: "msg",
    eventType: "BOOKING",
    id: "1",
    patientEmail: null,
    patientName: "Juan Pérez",
    patientPhone: null,
    previousAppointmentDate: null,
    updatedAt: new Date("2026-06-29T00:00:00.000Z"),
    ...over,
  };
}

describe("doctoralia-merge", () => {
  it("strips accents/titles for grouping keys", () => {
    expect(normalizePatientName("Dra. José Ñández")).toBe("jose nandez");
  });

  it("groups same patient+minute orphan emails into one event, cancellation wins", () => {
    const merged: DoctoraliaCalendarMerged = {
      counts: { appointments: 0, matchedEmails: 0, orphanEmails: 2 },
      entries: [],
      orphanEmails: [
        email({ id: "a", eventType: "BOOKING" }),
        email({ id: "b", eventType: "CANCELLATION" }),
      ],
    };

    const events = mergedToCalendarEventDetails(merged);

    expect(events).toHaveLength(1);
    expect(events[0]?.eventId).toBe("a+b");
    // primary = highest priority (CANCELLATION) → status drives the card state.
    expect(events[0]?.status).toBe("CANCELLATION");
  });

  it("keeps emails without a date as separate single-item events", () => {
    const merged: DoctoraliaCalendarMerged = {
      counts: { appointments: 0, matchedEmails: 0, orphanEmails: 2 },
      entries: [],
      orphanEmails: [
        email({ id: "x", appointmentDate: null }),
        email({ id: "y", appointmentDate: null }),
      ],
    };

    expect(mergedToCalendarEventDetails(merged)).toHaveLength(2);
  });
});
