import { oc } from "@orpc/contract";
import { z } from "zod";

export const attendanceMarkTypeSchema = z.enum(["CLOCK_IN", "CLOCK_OUT"]);

export const attendanceMarkSchema = z.object({
  id: z.number(),
  employeeId: z.number(),
  markedAt: z.coerce.date(),
  type: attendanceMarkTypeSchema,
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  accuracyMeters: z.number().nullable(),
  ipAddress: z.string().nullable(),
  isOfficeNetwork: z.boolean(),
  userAgent: z.string().nullable(),
  connectionType: z.string().nullable(),
  downlinkMbps: z.number().nullable(),
  isMobile: z.boolean().nullable(),
  clientTimezone: z.string().nullable(),
  deviceRam: z.number().nullable(),
  cpuCores: z.number().nullable(),
  screenResolution: z.string().nullable(),
  devicePixelRatio: z.number().nullable(),
  notes: z.string().nullable(),
  createdByUserId: z.number().nullable(),
});

export const attendanceMarkWithEmployeeSchema = attendanceMarkSchema.extend({
  employeeName: z.string().optional(),
  employeeRut: z.string().optional(),
  isDayIncomplete: z.boolean(),
});

// POST /attendance/mark — empleado marca entrada o salida
export const attendanceMarkInputSchema = z.object({
  type: attendanceMarkTypeSchema,
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  accuracyMeters: z.number().optional(),
  connectionType: z.string().optional(),
  downlinkMbps: z.number().optional(),
  isMobile: z.boolean().optional(),
  clientTimezone: z.string().optional(),
  deviceRam: z.number().optional(),
  cpuCores: z.number().optional(),
  screenResolution: z.string().optional(),
  devicePixelRatio: z.number().optional(),
});

export const attendanceMarkResponseSchema = z.object({
  mark: attendanceMarkSchema,
  timesheetSynced: z.boolean(),
  status: z.literal("ok"),
});

// GET /attendance/status — estado del empleado autenticado
export const weekDaySummarySchema = z.object({
  date: z.string(), // YYYY-MM-DD
  isWeekend: z.boolean(),
  status: z.enum(["worked", "incomplete", "absent", "today"]),
  workedMinutes: z.number().nullable(),
});

export const attendanceStatusResponseSchema = z.object({
  currentStatus: z.enum(["CLOCKED_IN", "CLOCKED_OUT", "NO_MARKS_TODAY"]),
  lastMark: attendanceMarkSchema.nullable(),
  todayMarks: z.array(attendanceMarkSchema),
  clockedInAt: z.coerce.date().nullable(), // primer CLOCK_IN hoy (para timer en vivo)
  hasIncompleteYesterday: z.boolean(),
  weekSummary: z.array(weekDaySummarySchema),
  monthStats: z.object({
    daysWorked: z.number(),
    totalMinutes: z.number(),
  }),
  status: z.literal("ok"),
});

// GET /attendance/list — admin: listar marcas con filtros
export const attendanceListInputSchema = z.object({
  employeeId: z.number().optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  completionStatus: z.enum(["all", "complete", "incomplete"]).optional(),
});

export const attendanceListSummarySchema = z.object({
  totalMarks: z.number(),
  incompleteDays: z.number(),
  totalWorkedMinutes: z.number(),
});

export const attendanceListResponseSchema = z.object({
  marks: z.array(attendanceMarkWithEmployeeSchema),
  summary: attendanceListSummarySchema,
  status: z.literal("ok"),
});

// POST /attendance/admin-mark — corrección manual por admin
export const attendanceAdminMarkInputSchema = z.object({
  employeeId: z.number(),
  type: attendanceMarkTypeSchema,
  markedAt: z.string().datetime(),
  notes: z.string().optional(),
});

// DELETE /attendance/mark/{id}
export const attendanceMarkIdInputSchema = z.object({
  id: z.number(),
});

export const attendanceDeleteResponseSchema = z.object({
  status: z.literal("ok"),
});

// GET /attendance/office-networks
export const officeNetworkSchema = z.object({
  id: z.number(),
  name: z.string(),
  cidr: z.string(),
  isActive: z.boolean(),
});

export const officeNetworksResponseSchema = z.object({
  networks: z.array(officeNetworkSchema),
  status: z.literal("ok"),
});

// POST /attendance/office-networks
export const officeNetworkCreateInputSchema = z.object({
  name: z.string().min(1),
  cidr: z.string().min(7),
});

// PUT /attendance/office-networks/{id}
export const officeNetworkUpdateInputSchema = z.object({
  id: z.number(),
  name: z.string().min(1).optional(),
  cidr: z.string().min(7).optional(),
  isActive: z.boolean().optional(),
});

export const officeNetworkResponseSchema = z.object({
  network: officeNetworkSchema,
  status: z.literal("ok"),
});

export const attendanceContract = {
  adminMark: oc
    .route({ method: "POST", path: "/admin-mark" })
    .input(attendanceAdminMarkInputSchema)
    .output(attendanceMarkResponseSchema),
  createOfficeNetwork: oc
    .route({ method: "POST", path: "/office-networks" })
    .input(officeNetworkCreateInputSchema)
    .output(officeNetworkResponseSchema),
  deleteOfficeNetwork: oc
    .route({ method: "DELETE", path: "/office-networks/{id}" })
    .input(attendanceMarkIdInputSchema)
    .output(attendanceDeleteResponseSchema),
  deleteMark: oc
    .route({ method: "DELETE", path: "/mark/{id}" })
    .input(attendanceMarkIdInputSchema)
    .output(attendanceDeleteResponseSchema),
  listMarks: oc
    .route({ method: "GET", path: "/list" })
    .input(attendanceListInputSchema)
    .output(attendanceListResponseSchema),
  listOfficeNetworks: oc
    .route({ method: "GET", path: "/office-networks" })
    .output(officeNetworksResponseSchema),
  mark: oc
    .route({ method: "POST", path: "/mark" })
    .input(attendanceMarkInputSchema)
    .output(attendanceMarkResponseSchema),
  status: oc.route({ method: "GET", path: "/status" }).output(attendanceStatusResponseSchema),
  updateOfficeNetwork: oc
    .route({ method: "PUT", path: "/office-networks/{id}" })
    .input(officeNetworkUpdateInputSchema)
    .output(officeNetworkResponseSchema),
};

export type AttendanceContract = typeof attendanceContract;
