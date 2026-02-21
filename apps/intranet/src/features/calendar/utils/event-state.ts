import dayjs from "dayjs";

import type { CalendarEventDetail } from "@/features/calendar/types";

export type CalendarEventStateTone = "danger" | "default" | "success" | "warning";

export interface CalendarEventState {
  key: "attendance" | "event-status";
  label: string;
  tone: CalendarEventStateTone;
}

function getAttendanceState(event: CalendarEventDetail): CalendarEventState {
  const start = event.startDateTime ? dayjs(event.startDateTime) : null;
  const isPastOrNow = start ? !start.isAfter(dayjs()) : false;

  if (event.attended === true) {
    return { key: "attendance", label: "Asistió", tone: "success" };
  }
  if (event.attended === false) {
    return { key: "attendance", label: "No asistió", tone: "danger" };
  }
  return {
    key: "attendance",
    label: isPastOrNow ? "Asistencia pendiente" : "Programada",
    tone: "warning",
  };
}

function getEventStatusState(status: null | string): CalendarEventState | null {
  const raw = status?.trim();
  if (!raw) {
    return null;
  }

  const normalized = raw.toLowerCase();

  if (["cancelled", "canceled"].includes(normalized)) {
    return { key: "event-status", label: "Cancelado", tone: "danger" };
  }
  if (["tentative"].includes(normalized)) {
    return { key: "event-status", label: "Tentativo", tone: "warning" };
  }
  if (["confirmed", "booked"].includes(normalized)) {
    return { key: "event-status", label: "Confirmado", tone: "success" };
  }
  if (["needsaction", "needs_action"].includes(normalized)) {
    return { key: "event-status", label: "Por confirmar", tone: "warning" };
  }
  if (["noshow", "no_show", "no-show"].includes(normalized)) {
    return { key: "event-status", label: "No asistió", tone: "danger" };
  }

  return { key: "event-status", label: raw, tone: "default" };
}

export function getCalendarEventStates(event: CalendarEventDetail): CalendarEventState[] {
  const statusState = getEventStatusState(event.status);
  const states: CalendarEventState[] = [];

  for (const state of [getAttendanceState(event), statusState]) {
    if (!state) {
      continue;
    }
    const duplicated = states.some(
      (existing) => existing.label.toLowerCase() === state.label.toLowerCase(),
    );
    if (!duplicated) {
      states.push(state);
    }
  }

  return states;
}
