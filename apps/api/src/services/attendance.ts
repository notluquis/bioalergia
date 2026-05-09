import { db } from "@finanzas/db";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";
import { upsertTimesheetEntry } from "./timesheets.ts";

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = "America/Santiago";

export type AttendanceMarkType = "CLOCK_IN" | "CLOCK_OUT";
export type AttendanceCurrentStatus = "CLOCKED_IN" | "CLOCKED_OUT" | "NO_MARKS_TODAY";
type WeekDayStatus = "worked" | "incomplete" | "absent" | "today";

export interface AttendanceMarkData {
  id: number;
  employeeId: number;
  markedAt: Date;
  type: AttendanceMarkType;
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  ipAddress: string | null;
  isOfficeNetwork: boolean;
  userAgent: string | null;
  connectionType: string | null;
  downlinkMbps: number | null;
  isMobile: boolean | null;
  clientTimezone: string | null;
  deviceRam: number | null;
  cpuCores: number | null;
  screenResolution: string | null;
  devicePixelRatio: number | null;
  notes: string | null;
  createdByUserId: number | null;
}

export interface WeekDaySummary {
  date: string;
  isWeekend: boolean;
  status: WeekDayStatus;
  workedMinutes: number | null;
}

export interface CreateMarkPayload {
  employeeId: number;
  type: AttendanceMarkType;
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
  connectionType?: string;
  downlinkMbps?: number;
  isMobile?: boolean;
  clientTimezone?: string;
  deviceRam?: number;
  cpuCores?: number;
  screenResolution?: string;
  devicePixelRatio?: number;
  createdByUserId?: number;
  notes?: string;
}

export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
}

function mapMark(raw: {
  id: bigint;
  employeeId: number;
  markedAt: Date;
  type: string;
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  ipAddress: string | null;
  isOfficeNetwork: boolean;
  userAgent: string | null;
  connectionType: string | null;
  downlinkMbps: number | null;
  isMobile: boolean | null;
  clientTimezone: string | null;
  deviceRam: number | null;
  cpuCores: number | null;
  screenResolution: string | null;
  devicePixelRatio: number | null;
  notes: string | null;
  createdByUserId: number | null;
}): AttendanceMarkData {
  return {
    id: Number(raw.id),
    employeeId: raw.employeeId,
    markedAt: raw.markedAt,
    type: raw.type as AttendanceMarkType,
    latitude: raw.latitude,
    longitude: raw.longitude,
    accuracyMeters: raw.accuracyMeters,
    ipAddress: raw.ipAddress,
    isOfficeNetwork: raw.isOfficeNetwork,
    userAgent: raw.userAgent,
    connectionType: raw.connectionType,
    downlinkMbps: raw.downlinkMbps,
    isMobile: raw.isMobile,
    clientTimezone: raw.clientTimezone,
    deviceRam: raw.deviceRam,
    cpuCores: raw.cpuCores,
    screenResolution: raw.screenResolution,
    devicePixelRatio: raw.devicePixelRatio,
    notes: raw.notes,
    createdByUserId: raw.createdByUserId,
  };
}

/** Compute worked minutes between earliest CLOCK_IN and latest CLOCK_OUT in a set of marks */
function computeWorkedMinutes(dayMarks: AttendanceMarkData[]): number | null {
  const clockIns = dayMarks.filter((m) => m.type === "CLOCK_IN").sort((a, b) => a.markedAt.getTime() - b.markedAt.getTime());
  const clockOuts = dayMarks.filter((m) => m.type === "CLOCK_OUT").sort((a, b) => b.markedAt.getTime() - a.markedAt.getTime());
  if (clockIns.length === 0 || clockOuts.length === 0) return null;
  const firstIn = clockIns[0]!;
  const lastOut = clockOuts[0]!;
  if (lastOut.markedAt <= firstIn.markedAt) return null;
  return Math.floor((lastOut.markedAt.getTime() - firstIn.markedAt.getTime()) / 60_000);
}

/**
 * Find the Employee record linked to a given User ID via the Person chain.
 * User → Person ← Employee
 */
export async function findEmployeeByUserId(userId: number) {
  return db.employee.findFirst({
    where: { person: { user: { id: userId } } },
    select: { id: true, personId: true, status: true },
  });
}

/**
 * Check if a given IP address matches any active OfficeNetwork CIDR.
 * Supports exact IP match or simple /24, /16, /8 subnet checks.
 */
export async function checkIsOfficeNetwork(ip: string): Promise<boolean> {
  if (!ip) return false;

  const networks = await db.officeNetwork.findMany({
    where: { isActive: true },
    select: { cidr: true },
  });

  for (const { cidr } of networks) {
    if (ipMatchesCidr(ip, cidr)) return true;
  }

  return false;
}

function ipMatchesCidr(ip: string, cidr: string): boolean {
  if (!cidr.includes("/")) return ip === cidr;

  const [network, prefixStr] = cidr.split("/");
  if (!network || prefixStr === undefined) return false;
  const prefix = Number(prefixStr);
  if (Number.isNaN(prefix) || prefix < 0 || prefix > 32) return false;

  const ipNum = ipToNumber(ip);
  const netNum = ipToNumber(network);
  if (ipNum === null || netNum === null) return false;

  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (ipNum & mask) >>> 0 === (netNum & mask) >>> 0;
}

function ipToNumber(ip: string): number | null {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return null;
  return ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0;
}

/**
 * Create an attendance mark and sync to EmployeeTimesheet if both CLOCK_IN and CLOCK_OUT exist.
 */
export async function createMark(
  payload: CreateMarkPayload,
  meta: RequestMeta,
): Promise<{ mark: AttendanceMarkData; timesheetSynced: boolean }> {
  const isOfficeNetwork = await checkIsOfficeNetwork(meta.ip ?? "");
  const now = new Date();

  const raw = await db.attendanceMark.create({
    data: {
      employeeId: payload.employeeId,
      markedAt: now,
      type: payload.type,
      latitude: payload.latitude ?? null,
      longitude: payload.longitude ?? null,
      accuracyMeters: payload.accuracyMeters ?? null,
      ipAddress: meta.ip ?? null,
      isOfficeNetwork,
      userAgent: meta.userAgent ?? null,
      connectionType: payload.connectionType ?? null,
      downlinkMbps: payload.downlinkMbps ?? null,
      isMobile: payload.isMobile ?? null,
      clientTimezone: payload.clientTimezone ?? null,
      deviceRam: payload.deviceRam ?? null,
      cpuCores: payload.cpuCores ?? null,
      screenResolution: payload.screenResolution ?? null,
      devicePixelRatio: payload.devicePixelRatio ?? null,
      notes: payload.notes ?? null,
      createdByUserId: payload.createdByUserId ?? null,
    },
  });

  const mark = mapMark(raw);
  const timesheetSynced = await syncMarkToTimesheet(payload.employeeId, now);

  return { mark, timesheetSynced };
}

/**
 * Create an attendance mark at a specific past time (admin correction).
 */
export async function createAdminMark(
  employeeId: number,
  type: AttendanceMarkType,
  markedAt: Date,
  adminUserId: number,
  notes?: string,
): Promise<{ mark: AttendanceMarkData; timesheetSynced: boolean }> {
  const raw = await db.attendanceMark.create({
    data: {
      employeeId,
      markedAt,
      type,
      latitude: null,
      longitude: null,
      accuracyMeters: null,
      ipAddress: null,
      isOfficeNetwork: false,
      userAgent: null,
      connectionType: null,
      downlinkMbps: null,
      isMobile: null,
      clientTimezone: null,
      deviceRam: null,
      cpuCores: null,
      screenResolution: null,
      devicePixelRatio: null,
      notes: notes ?? null,
      createdByUserId: adminUserId,
    },
  });

  const mark = mapMark(raw);
  const timesheetSynced = await syncMarkToTimesheet(employeeId, markedAt);

  return { mark, timesheetSynced };
}

/**
 * Sync attendance marks to EmployeeTimesheet for the day containing `referenceTime`.
 */
export async function syncMarkToTimesheet(
  employeeId: number,
  referenceTime: Date,
): Promise<boolean> {
  const dayInSantiago = dayjs(referenceTime).tz(TIMEZONE);
  const dayStart = dayInSantiago.startOf("day").toDate();
  const dayEnd = dayInSantiago.endOf("day").toDate();
  const workDateStr = dayInSantiago.format("YYYY-MM-DD");

  const marks = await db.attendanceMark.findMany({
    where: { employeeId, markedAt: { gte: dayStart, lte: dayEnd } },
    orderBy: { markedAt: "asc" },
  });

  const clockIns = marks.filter((m) => m.type === "CLOCK_IN");
  const clockOuts = marks.filter((m) => m.type === "CLOCK_OUT");

  if (clockIns.length === 0 || clockOuts.length === 0) return false;

  const firstIn = clockIns[0]!.markedAt;
  const lastOut = clockOuts[clockOuts.length - 1]!.markedAt;

  if (lastOut <= firstIn) return false;

  const workedMinutes = Math.floor((lastOut.getTime() - firstIn.getTime()) / 60_000);

  await upsertTimesheetEntry({
    employee_id: employeeId,
    work_date: workDateStr,
    start_time: firstIn.toISOString(),
    end_time: lastOut.toISOString(),
    worked_minutes: workedMinutes,
    overtime_minutes: 0,
    comment: "Generado automáticamente desde marcaje",
  });

  return true;
}

/**
 * Get today's status + week summary + month stats for a given employee.
 * Single DB query covers the full month for efficiency.
 */
export async function getTodayStatus(employeeId: number): Promise<{
  currentStatus: AttendanceCurrentStatus;
  lastMark: AttendanceMarkData | null;
  todayMarks: AttendanceMarkData[];
  clockedInAt: Date | null;
  hasIncompleteYesterday: boolean;
  weekSummary: WeekDaySummary[];
  monthStats: { daysWorked: number; totalMinutes: number };
}> {
  const now = dayjs().tz(TIMEZONE);
  const monthStart = now.startOf("month").toDate();
  const dayEnd = now.endOf("day").toDate();

  const rawMarks = await db.attendanceMark.findMany({
    where: { employeeId, markedAt: { gte: monthStart, lte: dayEnd } },
    orderBy: { markedAt: "asc" },
  });

  const marks = rawMarks.map(mapMark);

  // Group marks by local date
  const byDate = new Map<string, AttendanceMarkData[]>();
  for (const mark of marks) {
    const date = dayjs(mark.markedAt).tz(TIMEZONE).format("YYYY-MM-DD");
    const existing = byDate.get(date);
    if (existing) existing.push(mark);
    else byDate.set(date, [mark]);
  }

  const today = now.format("YYYY-MM-DD");
  const yesterday = now.subtract(1, "day").format("YYYY-MM-DD");
  const todayMarks = byDate.get(today) ?? [];

  // Current status
  const lastMark = todayMarks.length > 0 ? todayMarks[todayMarks.length - 1]! : null;
  let currentStatus: AttendanceCurrentStatus;
  if (todayMarks.length === 0) currentStatus = "NO_MARKS_TODAY";
  else if (lastMark?.type === "CLOCK_IN") currentStatus = "CLOCKED_IN";
  else currentStatus = "CLOCKED_OUT";

  // First CLOCK_IN today (for live timer on client)
  const clockedInAt =
    currentStatus === "CLOCKED_IN"
      ? (todayMarks.find((m) => m.type === "CLOCK_IN")?.markedAt ?? null)
      : null;

  // Yesterday incomplete: has CLOCK_IN but no CLOCK_OUT
  const yesterdayMarks = byDate.get(yesterday) ?? [];
  const hasIncompleteYesterday =
    yesterdayMarks.some((m) => m.type === "CLOCK_IN") &&
    !yesterdayMarks.some((m) => m.type === "CLOCK_OUT");

  // Week summary (Mon → today)
  const dayOfWeek = now.day(); // 0=Sun, 1=Mon, ..., 6=Sat
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekMonday = now.subtract(daysFromMonday, "day").startOf("day");

  const weekSummary: WeekDaySummary[] = [];
  for (let i = 0; i < 7; i++) {
    const day = weekMonday.add(i, "day");
    if (day.isAfter(now, "day")) break;
    const dateStr = day.format("YYYY-MM-DD");
    const isWeekend = day.day() === 0 || day.day() === 6;
    const dayMarks = byDate.get(dateStr) ?? [];
    const hasCI = dayMarks.some((m) => m.type === "CLOCK_IN");
    const hasCO = dayMarks.some((m) => m.type === "CLOCK_OUT");

    let status: WeekDayStatus;
    let workedMinutes: number | null = null;

    if (dateStr === today) {
      status = "today";
      if (hasCI && hasCO) {
        workedMinutes = computeWorkedMinutes(dayMarks);
      } else if (hasCI) {
        const firstCI = dayMarks.find((m) => m.type === "CLOCK_IN")!;
        workedMinutes = Math.floor((Date.now() - firstCI.markedAt.getTime()) / 60_000);
      }
    } else if (!hasCI && !hasCO) {
      status = "absent";
    } else if (hasCI && hasCO) {
      status = "worked";
      workedMinutes = computeWorkedMinutes(dayMarks);
    } else {
      status = "incomplete";
    }

    weekSummary.push({ date: dateStr, isWeekend, status, workedMinutes });
  }

  // Month stats (completed days only, exclude today which may be in progress)
  let daysWorked = 0;
  let totalMinutes = 0;
  for (const [dateStr, dayMarks] of byDate.entries()) {
    if (dateStr === today) continue;
    const hasCI = dayMarks.some((m) => m.type === "CLOCK_IN");
    const hasCO = dayMarks.some((m) => m.type === "CLOCK_OUT");
    if (hasCI && hasCO) {
      const minutes = computeWorkedMinutes(dayMarks);
      if (minutes !== null) {
        daysWorked++;
        totalMinutes += minutes;
      }
    }
  }

  return {
    currentStatus,
    lastMark,
    todayMarks,
    clockedInAt,
    hasIncompleteYesterday,
    weekSummary,
    monthStats: { daysWorked, totalMinutes },
  };
}

/**
 * List marks with optional filters (admin use).
 * Returns isDayIncomplete per mark and aggregate summary.
 */
export async function listMarks(options: {
  employeeId?: number;
  from?: string;
  to?: string;
  completionStatus?: "all" | "complete" | "incomplete";
}): Promise<{
  marks: Array<AttendanceMarkData & { employeeName?: string; employeeRut?: string; isDayIncomplete: boolean }>;
  summary: { totalMarks: number; incompleteDays: number; totalWorkedMinutes: number };
}> {
  const fromDate = options.from
    ? dayjs.tz(options.from, "YYYY-MM-DD", TIMEZONE).startOf("day").toDate()
    : undefined;
  const toDate = options.to
    ? dayjs.tz(options.to, "YYYY-MM-DD", TIMEZONE).endOf("day").toDate()
    : undefined;

  const rawMarks = await db.attendanceMark.findMany({
    where: {
      ...(options.employeeId !== undefined ? { employeeId: options.employeeId } : {}),
      ...(fromDate !== undefined || toDate !== undefined
        ? {
            markedAt: {
              ...(fromDate !== undefined ? { gte: fromDate } : {}),
              ...(toDate !== undefined ? { lte: toDate } : {}),
            },
          }
        : {}),
    },
    include: {
      employee: {
        include: { person: { select: { names: true, fatherName: true, rut: true } } },
      },
    },
    orderBy: { markedAt: "desc" },
  });

  // Group by employeeId+date to detect incomplete sessions
  const sessionMap = new Map<string, { clockIns: Date[]; clockOuts: Date[] }>();
  for (const raw of rawMarks) {
    const dateStr = dayjs(raw.markedAt).tz(TIMEZONE).format("YYYY-MM-DD");
    const key = `${raw.employeeId}:${dateStr}`;
    const existing = sessionMap.get(key);
    if (!existing) {
      sessionMap.set(key, { clockIns: [], clockOuts: [] });
    }
    const session = sessionMap.get(key)!;
    if (raw.type === "CLOCK_IN") session.clockIns.push(raw.markedAt);
    else session.clockOuts.push(raw.markedAt);
  }

  // Compute which day-keys are incomplete + total worked minutes
  const incompleteDayKeys = new Set<string>();
  let incompleteDays = 0;
  let totalWorkedMinutes = 0;

  for (const [key, session] of sessionMap.entries()) {
    const isIncomplete = session.clockIns.length === 0 || session.clockOuts.length === 0;
    if (isIncomplete) {
      incompleteDayKeys.add(key);
      incompleteDays++;
    } else {
      const firstCI = session.clockIns.sort((a, b) => a.getTime() - b.getTime())[0]!;
      const lastCO = session.clockOuts.sort((a, b) => b.getTime() - a.getTime())[0]!;
      if (lastCO > firstCI) {
        totalWorkedMinutes += Math.floor((lastCO.getTime() - firstCI.getTime()) / 60_000);
      }
    }
  }

  // Build result with isDayIncomplete flag
  let allMarks = rawMarks.map((raw) => {
    const dateStr = dayjs(raw.markedAt).tz(TIMEZONE).format("YYYY-MM-DD");
    const key = `${raw.employeeId}:${dateStr}`;
    return {
      ...mapMark(raw),
      employeeName: [raw.employee.person.names, raw.employee.person.fatherName]
        .filter(Boolean)
        .join(" "),
      employeeRut: raw.employee.person.rut ?? undefined,
      isDayIncomplete: incompleteDayKeys.has(key),
    };
  });

  // Apply completionStatus filter
  if (options.completionStatus === "complete") {
    allMarks = allMarks.filter((m) => !m.isDayIncomplete);
  } else if (options.completionStatus === "incomplete") {
    allMarks = allMarks.filter((m) => m.isDayIncomplete);
  }

  return {
    marks: allMarks,
    summary: { totalMarks: allMarks.length, incompleteDays, totalWorkedMinutes },
  };
}

/**
 * Delete a mark by ID (admin only).
 */
export async function deleteMark(id: number): Promise<void> {
  await db.attendanceMark.delete({ where: { id: BigInt(id) } });
}

// ─── Office Networks ──────────────────────────────────────────────────────────

export async function listOfficeNetworks() {
  return db.officeNetwork.findMany({ orderBy: { id: "asc" } });
}

export async function createOfficeNetwork(name: string, cidr: string) {
  return db.officeNetwork.create({ data: { name, cidr, isActive: true } });
}

export async function updateOfficeNetwork(
  id: number,
  data: { name?: string; cidr?: string; isActive?: boolean },
) {
  return db.officeNetwork.update({ where: { id }, data });
}

export async function deleteOfficeNetwork(id: number) {
  await db.officeNetwork.delete({ where: { id } });
}
