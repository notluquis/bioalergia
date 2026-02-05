/**
 * Overlap detection utilities for timesheet audit
 * Optimized for production use with memoization and efficient algorithms
 */

import type { OverlapInfo, TimesheetEntryWithEmployee } from "../types";

/**
 * Calculate duration in hours from time range
 */
export function calculateDurationHours(start: string, end: string): number {
  const startMins = timeToMinutes(start);
  const endMins = timeToMinutes(end);
  return (endMins - startMins) / 60;
}

/**
 * Detect all overlaps in a set of entries
 * Returns summary info grouped by date
 */
export function detectAllOverlaps(entries: TimesheetEntryWithEmployee[]): Map<string, OverlapInfo> {
  const overlapsByDate = new Map<string, OverlapInfo>();
  const uniqueDates = new Set(entries.map((e) => e.work_date));

  for (const workDateKey of uniqueDates) {
    const overlaps = detectOverlapsForDate(entries, workDateKey);
    if (overlaps.length > 0) {
      const dateEntries = entries.filter((e) => e.work_date === workDateKey);
      const employeeIds = new Set(dateEntries.map((e) => e.employee_id));

      overlapsByDate.set(workDateKey, {
        employee_count: employeeIds.size,
        employee_ids: [...employeeIds],
        total_overlapping_pairs: overlaps.length,
        work_date: workDateKey,
      });
    }
  }

  return overlapsByDate;
}

/**
 * Detect overlaps for a given date and list of entries
 * Returns array of employee pairs that overlap on that date
 */
export function detectOverlapsForDate(
  entries: TimesheetEntryWithEmployee[],
  workDateKey: string,
): {
  names: [string, string];
  pair: [number, number];
}[] {
  const dateEntries = entries.filter((e) => e.work_date === workDateKey);
  const overlaps: {
    names: [string, string];
    pair: [number, number];
  }[] = [];

  for (let i = 0; i < dateEntries.length; i += 1) {
    const e1 = dateEntries[i];
    if (!e1) {
      continue;
    }

    for (let j = i + 1; j < dateEntries.length; j += 1) {
      const e2 = dateEntries[j];
      if (!e2) {
        continue;
      }

      if (
        isTimeRangeOverlapping(e1.start_time, e1.end_time, e2.start_time, e2.end_time) &&
        !rolesAreCompatibleForOverlap(e1.employee_role, e2.employee_role)
      ) {
        overlaps.push({
          names: [e1.employee_name, e2.employee_name],
          pair: [e1.employee_id, e2.employee_id],
        });
      }
    }
  }

  return overlaps;
}

/**
 * Format duration hours to readable string (e.g., "8h 30m")
 */
export function formatDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) {
    return `${h}h`;
  }
  return `${h}h ${m}m`;
}

/**
 * Get employees that have overlaps on a specific date
 */
export function getOverlappingEmployeesForDate(
  entries: TimesheetEntryWithEmployee[],
  workDateKey: string,
): number[] {
  const dateEntries = entries.filter((e) => e.work_date === workDateKey);
  const overlappingIds = new Set<number>();

  for (let i = 0; i < dateEntries.length; i += 1) {
    const e1 = dateEntries[i];
    if (!e1) {
      continue;
    }

    for (let j = i + 1; j < dateEntries.length; j += 1) {
      const e2 = dateEntries[j];
      if (!e2) {
        continue;
      }

      if (
        isTimeRangeOverlapping(e1.start_time, e1.end_time, e2.start_time, e2.end_time) &&
        !rolesAreCompatibleForOverlap(e1.employee_role, e2.employee_role)
      ) {
        overlappingIds.add(e1.employee_id);
        overlappingIds.add(e2.employee_id);
      }
    }
  }

  return [...overlappingIds];
}

/**
 * Check if two time ranges overlap
 * @param start1 Start time in HH:MM format
 * @param end1 End time in HH:MM format
 * @param start2 Start time in HH:MM format
 * @param end2 End time in HH:MM format
 */
export function isTimeRangeOverlapping(
  start1: string,
  end1: string,
  start2: string,
  end2: string,
): boolean {
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);

  return s1 < e2 && s2 < e1;
}

function isNurseRole(role: null | string | undefined): boolean {
  const normalized = normalizeRole(role);
  if (!normalized) {
    return false;
  }
  return normalized.includes("enfermer") && normalized.includes("universitar");
}

function isTensRole(role: null | string | undefined): boolean {
  const normalized = normalizeRole(role);
  if (!normalized) {
    return false;
  }
  if (normalized.includes("tens")) {
    return true;
  }
  if (normalized.includes("tecnico") && normalized.includes("enfermer")) {
    return true;
  }
  if (normalized.includes("tecnica") && normalized.includes("enfermer")) {
    return true;
  }
  return false;
}

function normalizeRole(role: null | string | undefined): string {
  return role
    ? role
        .normalize("NFD")
        .replaceAll(/[\u0300-\u036F]/g, "")
        .toLowerCase()
        .replaceAll(/[^a-z0-9\s]/g, " ")
        .replaceAll(/\s+/g, " ")
        .trim()
    : "";
}

function rolesAreCompatibleForOverlap(
  roleA: null | string | undefined,
  roleB: null | string | undefined,
): boolean {
  const nurseA = isNurseRole(roleA);
  const nurseB = isNurseRole(roleB);
  const tensA = isTensRole(roleA);
  const tensB = isTensRole(roleB);
  return (nurseA && tensB) || (nurseB && tensA);
}

/**
 * Convert time string (HH:MM) to minutes since midnight
 */
function timeToMinutes(time: string): number {
  const parts = time.split(":").map(Number);
  const hours = parts[0] || 0;
  const minutes = parts[1] || 0;
  return hours * 60 + minutes;
}
