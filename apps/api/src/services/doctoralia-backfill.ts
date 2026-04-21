import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek.js";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";

import { TIMEZONE } from "../lib/time";
import { logEvent, logWarn } from "../lib/logger";
import { doctoraliaCalendarSyncService } from "./doctoralia-calendar";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isoWeek);

export const DOCTORALIA_BACKFILL_MIN_DATE = "2017-08-21";

const WEEK_DELAY_MS = Number(process.env.DOCTORALIA_BACKFILL_WEEK_DELAY_MS ?? "1500");

export type DoctoraliaBackfillStatus = {
  running: boolean;
  startedAt: string | null;
  endedAt: string | null;
  targetEndDate: string | null;
  triggeredByUserId: number | null;
  weeksTotal: number;
  weeksProcessed: number;
  weeksFailed: number;
  appointmentsInserted: number;
  appointmentsUpdated: number;
  currentWindow: { from: string; to: string } | null;
  lastError: string | null;
};

const state: DoctoraliaBackfillStatus = {
  running: false,
  startedAt: null,
  endedAt: null,
  targetEndDate: null,
  triggeredByUserId: null,
  weeksTotal: 0,
  weeksProcessed: 0,
  weeksFailed: 0,
  appointmentsInserted: 0,
  appointmentsUpdated: 0,
  currentWindow: null,
  lastError: null,
};

export function getDoctoraliaBackfillStatus(): DoctoraliaBackfillStatus {
  return { ...state, currentWindow: state.currentWindow ? { ...state.currentWindow } : null };
}

export function isDoctoraliaBackfillRunning(): boolean {
  return state.running;
}

function resetState() {
  state.running = false;
  state.startedAt = null;
  state.endedAt = null;
  state.targetEndDate = null;
  state.triggeredByUserId = null;
  state.weeksTotal = 0;
  state.weeksProcessed = 0;
  state.weeksFailed = 0;
  state.appointmentsInserted = 0;
  state.appointmentsUpdated = 0;
  state.currentWindow = null;
  state.lastError = null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function startDoctoraliaBackfill(params: {
  endDate: string;
  triggeredByUserId: number;
}): DoctoraliaBackfillStatus {
  if (state.running) {
    throw new Error("Ya hay un backfill en curso");
  }

  const endDateNormalized = dayjs.tz(params.endDate, TIMEZONE).startOf("day");
  const minDate = dayjs.tz(DOCTORALIA_BACKFILL_MIN_DATE, TIMEZONE).startOf("day");
  const effectiveEnd = endDateNormalized.isBefore(minDate) ? minDate : endDateNormalized;

  const todayLocal = dayjs().tz(TIMEZONE).startOf("day");
  const currentMonday = todayLocal.startOf("isoWeek");

  if (effectiveEnd.isAfter(currentMonday.subtract(1, "day"))) {
    throw new Error(
      "La fecha objetivo debe ser anterior a la semana actual (el scraper ya cubre esa ventana).",
    );
  }

  const targetMonday = effectiveEnd.startOf("isoWeek");
  const totalWeeks = Math.max(1, currentMonday.diff(targetMonday, "week"));

  resetState();
  state.running = true;
  state.startedAt = new Date().toISOString();
  state.targetEndDate = effectiveEnd.format("YYYY-MM-DD");
  state.triggeredByUserId = params.triggeredByUserId;
  state.weeksTotal = totalWeeks;

  void runBackfillLoop({
    startMonday: currentMonday.subtract(1, "week"),
    stopMonday: targetMonday,
    triggerUserId: params.triggeredByUserId,
  }).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    state.lastError = message;
    logWarn("doctoralia.backfill.fatal", { error: message });
  });

  logEvent("doctoralia.backfill.started", {
    targetEndDate: state.targetEndDate,
    weeksTotal: state.weeksTotal,
    triggeredByUserId: params.triggeredByUserId,
  });

  return getDoctoraliaBackfillStatus();
}

async function runBackfillLoop(params: {
  startMonday: dayjs.Dayjs;
  stopMonday: dayjs.Dayjs;
  triggerUserId: number;
}) {
  try {
    let cursor = params.startMonday;
    while (!cursor.isBefore(params.stopMonday, "day")) {
      const from = cursor.format("YYYY-MM-DD");
      const to = cursor.add(6, "day").format("YYYY-MM-DD");
      state.currentWindow = { from, to };

      try {
        const result = await doctoraliaCalendarSyncService.syncCalendar(
          from,
          to,
          undefined,
          "manual-backfill",
          params.triggerUserId,
        );
        if ("appointments" in result) {
          state.appointmentsInserted += result.appointments.inserted;
          state.appointmentsUpdated += result.appointments.updated;
        }
        state.weeksProcessed += 1;
        logEvent("doctoralia.backfill.week.success", {
          from,
          to,
          weeksProcessed: state.weeksProcessed,
          weeksTotal: state.weeksTotal,
        });
      } catch (error) {
        state.weeksFailed += 1;
        const message = error instanceof Error ? error.message : String(error);
        state.lastError = message;
        logWarn("doctoralia.backfill.week.error", { from, to, error: message });
      }

      if (WEEK_DELAY_MS > 0) {
        await sleep(WEEK_DELAY_MS);
      }

      cursor = cursor.subtract(1, "week");
    }
  } finally {
    state.running = false;
    state.endedAt = new Date().toISOString();
    state.currentWindow = null;
    logEvent("doctoralia.backfill.finished", {
      weeksProcessed: state.weeksProcessed,
      weeksFailed: state.weeksFailed,
      weeksTotal: state.weeksTotal,
    });
  }
}
