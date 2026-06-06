import { toChileDateString } from "../lib/time.ts";
import { logEvent, logWarn } from "../lib/logger.ts";
import { doctoraliaCalendarSyncService } from "./doctoralia-calendar.ts";

// Monday of the ISO week containing `d` (dayOfWeek: 1=Mon … 7=Sun).
const isoMonday = (d: Temporal.PlainDate) => d.subtract({ days: d.dayOfWeek - 1 });

export const DOCTORALIA_BACKFILL_MIN_DATE = "2017-08-21";

function getWeekDelayMs(): number {
  return Number(process.env.DOCTORALIA_BACKFILL_WEEK_DELAY_MS ?? "1500");
}

export type BackfillBucketCounts = {
  inserted: number;
  updated: number;
  skipped: number;
};

export type DoctoraliaBackfillStatus = {
  running: boolean;
  cancelRequested: boolean;
  startedAt: string | null;
  endedAt: string | null;
  targetEndDate: string | null;
  triggeredByUserId: number | null;
  weeksTotal: number;
  weeksProcessed: number;
  weeksFailed: number;
  schedules: BackfillBucketCounts;
  appointments: BackfillBucketCounts;
  workPeriods: BackfillBucketCounts;
  currentWindow: { from: string; to: string } | null;
  lastError: string | null;
};

function emptyBucket(): BackfillBucketCounts {
  return { inserted: 0, updated: 0, skipped: 0 };
}

const state: DoctoraliaBackfillStatus = {
  running: false,
  cancelRequested: false,
  startedAt: null,
  endedAt: null,
  targetEndDate: null,
  triggeredByUserId: null,
  weeksTotal: 0,
  weeksProcessed: 0,
  weeksFailed: 0,
  schedules: emptyBucket(),
  appointments: emptyBucket(),
  workPeriods: emptyBucket(),
  currentWindow: null,
  lastError: null,
};

export function getDoctoraliaBackfillStatus(): DoctoraliaBackfillStatus {
  return {
    ...state,
    schedules: { ...state.schedules },
    appointments: { ...state.appointments },
    workPeriods: { ...state.workPeriods },
    currentWindow: state.currentWindow ? { ...state.currentWindow } : null,
  };
}

export function isDoctoraliaBackfillRunning(): boolean {
  return state.running;
}

function resetState() {
  state.running = false;
  state.cancelRequested = false;
  state.startedAt = null;
  state.endedAt = null;
  state.targetEndDate = null;
  state.triggeredByUserId = null;
  state.weeksTotal = 0;
  state.weeksProcessed = 0;
  state.weeksFailed = 0;
  state.schedules = emptyBucket();
  state.appointments = emptyBucket();
  state.workPeriods = emptyBucket();
  state.currentWindow = null;
  state.lastError = null;
}

export function requestDoctoraliaBackfillCancel(params: {
  requestedByUserId: number;
}): DoctoraliaBackfillStatus {
  if (!state.running) {
    throw new Error("No hay un backfill en curso");
  }
  if (!state.cancelRequested) {
    state.cancelRequested = true;
    logEvent("doctoralia.backfill.cancel_requested", {
      requestedByUserId: params.requestedByUserId,
      weeksProcessed: state.weeksProcessed,
      weeksTotal: state.weeksTotal,
    });
  }
  return getDoctoraliaBackfillStatus();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type PlannedBackfill = {
  startMonday: Temporal.PlainDate;
  stopMonday: Temporal.PlainDate;
  effectiveEndDate: string;
  weeksTotal: number;
};

export function planDoctoraliaBackfill(
  endDate: string,
  startDate?: string,
  now: Date = new Date()
): PlannedBackfill {
  let endDateNormalized: Temporal.PlainDate;
  try {
    endDateNormalized = Temporal.PlainDate.from(endDate);
  } catch {
    throw new Error("Fecha objetivo inválida");
  }

  const minDate = Temporal.PlainDate.from(DOCTORALIA_BACKFILL_MIN_DATE);
  const effectiveEnd =
    Temporal.PlainDate.compare(endDateNormalized, minDate) < 0 ? minDate : endDateNormalized;

  const currentMonday = isoMonday(Temporal.PlainDate.from(toChileDateString(now)));

  // Start from a specific date or default to last week
  let startMonday: Temporal.PlainDate;
  if (startDate) {
    let startNormalized: Temporal.PlainDate;
    try {
      startNormalized = Temporal.PlainDate.from(startDate);
    } catch {
      throw new Error("Fecha de inicio inválida");
    }
    startMonday = isoMonday(startNormalized);
    // Don't allow start in the future
    const maxStart = currentMonday.subtract({ weeks: 1 });
    if (Temporal.PlainDate.compare(startMonday, maxStart) > 0) {
      startMonday = maxStart;
    }
  } else {
    startMonday = currentMonday.subtract({ weeks: 1 });
  }

  if (Temporal.PlainDate.compare(effectiveEnd, startMonday.add({ weeks: 1 })) >= 0) {
    throw new Error("La fecha final debe ser anterior a la fecha de inicio.");
  }

  const targetMonday = isoMonday(effectiveEnd);
  const weeksTotal = Math.max(
    1,
    targetMonday.until(startMonday, { largestUnit: "week" }).weeks + 1
  );

  return {
    startMonday,
    stopMonday: targetMonday,
    effectiveEndDate: effectiveEnd.toString(),
    weeksTotal,
  };
}

export function startDoctoraliaBackfill(params: {
  endDate: string;
  startDate?: string;
  triggeredByUserId: number;
}): DoctoraliaBackfillStatus {
  if (state.running) {
    throw new Error("Ya hay un backfill en curso");
  }

  const plan = planDoctoraliaBackfill(params.endDate, params.startDate);

  resetState();
  state.running = true;
  state.startedAt = new Date().toISOString();
  state.targetEndDate = plan.effectiveEndDate;
  state.triggeredByUserId = params.triggeredByUserId;
  state.weeksTotal = plan.weeksTotal;

  void runBackfillLoop({
    startMonday: plan.startMonday,
    stopMonday: plan.stopMonday,
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

function addCounts(target: BackfillBucketCounts, delta: BackfillBucketCounts) {
  target.inserted += delta.inserted;
  target.updated += delta.updated;
  target.skipped += delta.skipped;
}

async function runBackfillLoop(params: {
  startMonday: Temporal.PlainDate;
  stopMonday: Temporal.PlainDate;
  triggerUserId: number;
}) {
  try {
    let cursor = params.startMonday;
    while (Temporal.PlainDate.compare(cursor, params.stopMonday) >= 0) {
      if (state.cancelRequested) break;

      const from = cursor.toString();
      const to = cursor.add({ days: 6 }).toString();
      state.currentWindow = { from, to };

      try {
        const result = await doctoraliaCalendarSyncService.syncCalendar(
          from,
          to,
          undefined,
          "manual-backfill",
          params.triggerUserId
        );
        if ("schedules" in result) addCounts(state.schedules, result.schedules);
        if ("appointments" in result) addCounts(state.appointments, result.appointments);
        if ("workPeriods" in result) addCounts(state.workPeriods, result.workPeriods);
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

      if (state.cancelRequested) break;

      const weekDelayMs = getWeekDelayMs();
      if (weekDelayMs > 0) {
        await sleep(weekDelayMs);
      }

      cursor = cursor.subtract({ weeks: 1 });
    }
  } finally {
    const wasCancelled = state.cancelRequested;
    state.running = false;
    state.endedAt = new Date().toISOString();
    state.currentWindow = null;
    logEvent("doctoralia.backfill.finished", {
      weeksProcessed: state.weeksProcessed,
      weeksFailed: state.weeksFailed,
      weeksTotal: state.weeksTotal,
      cancelled: wasCancelled,
    });
  }
}

// Exported for tests only — resets the module-level mutex between test cases.
export function __resetDoctoraliaBackfillStateForTests() {
  resetState();
}
