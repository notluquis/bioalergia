import { db } from "@finanzas/db";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";
import { upsertTimesheetEntry } from "./timesheets";

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = "America/Santiago";

export type AttendanceMarkType = "CLOCK_IN" | "CLOCK_OUT";
export type AttendanceCurrentStatus = "CLOCKED_IN" | "CLOCKED_OUT" | "NO_MARKS_TODAY";

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
  notes: string | null;
  createdByUserId: number | null;
}

export interface CreateMarkPayload {
  employeeId: number;
  type: AttendanceMarkType;
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
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
    notes: raw.notes,
    createdByUserId: raw.createdByUserId,
  };
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
 * For production use, consider a proper CIDR library (e.g. ip-cidr).
 */
export async function checkIsOfficeNetwork(ip: string): Promise<boolean> {
  if (!ip) return false;

  const networks = await db.officeNetwork.findMany({
    where: { isActive: true },
    select: { cidr: true },
  });

  for (const { cidr } of networks) {
    if (ipMatchesCidr(ip, cidr)) {
      return true;
    }
  }

  return false;
}

/**
 * Minimal CIDR matching without external dependencies.
 * Supports IPv4 exact match ("x.x.x.x") and prefix notation ("x.x.x.x/prefix").
 */
function ipMatchesCidr(ip: string, cidr: string): boolean {
  if (!cidr.includes("/")) {
    return ip === cidr;
  }

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
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return null;
  }
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
 * Uses the earliest CLOCK_IN and latest CLOCK_OUT of the day.
 * Returns true if a timesheet was upserted.
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
    where: {
      employeeId,
      markedAt: { gte: dayStart, lte: dayEnd },
    },
    orderBy: { markedAt: "asc" },
  });

  const clockIns = marks.filter((m) => m.type === "CLOCK_IN");
  const clockOuts = marks.filter((m) => m.type === "CLOCK_OUT");

  if (clockIns.length === 0 || clockOuts.length === 0) {
    return false;
  }

  const firstIn = clockIns[0]!.markedAt;
  const lastOut = clockOuts[clockOuts.length - 1]!.markedAt;

  if (lastOut <= firstIn) {
    return false;
  }

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
 * Get today's marks and status for a given employee.
 */
export async function getTodayStatus(employeeId: number): Promise<{
  currentStatus: AttendanceCurrentStatus;
  lastMark: AttendanceMarkData | null;
  todayMarks: AttendanceMarkData[];
}> {
  const now = dayjs().tz(TIMEZONE);
  const dayStart = now.startOf("day").toDate();
  const dayEnd = now.endOf("day").toDate();

  const rawMarks = await db.attendanceMark.findMany({
    where: {
      employeeId,
      markedAt: { gte: dayStart, lte: dayEnd },
    },
    orderBy: { markedAt: "asc" },
  });

  const todayMarks = rawMarks.map(mapMark);

  if (todayMarks.length === 0) {
    return { currentStatus: "NO_MARKS_TODAY", lastMark: null, todayMarks };
  }

  const lastMark = todayMarks[todayMarks.length - 1]!;
  const currentStatus: AttendanceCurrentStatus =
    lastMark.type === "CLOCK_IN" ? "CLOCKED_IN" : "CLOCKED_OUT";

  return { currentStatus, lastMark, todayMarks };
}

/**
 * List marks with optional filters (admin use).
 */
export async function listMarks(options: {
  employeeId?: number;
  from?: string;
  to?: string;
}): Promise<Array<AttendanceMarkData & { employeeName?: string; employeeRut?: string }>> {
  const fromDate = options.from ? dayjs.tz(options.from, "YYYY-MM-DD", TIMEZONE).startOf("day").toDate() : undefined;
  const toDate = options.to ? dayjs.tz(options.to, "YYYY-MM-DD", TIMEZONE).endOf("day").toDate() : undefined;

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

  return rawMarks.map((raw) => ({
    ...mapMark(raw),
    employeeName: [raw.employee.person.names, raw.employee.person.fatherName]
      .filter(Boolean)
      .join(" "),
    employeeRut: raw.employee.person.rut,
  }));
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
