import { z } from "zod";

import { dateRegex } from "./shared.js";

export const employeeSchema = z.object({
  names: z.string().min(1).max(255),
  fatherName: z.string().max(255).optional(),
  rut: z.string().min(1).max(20),
  email: z.string().email().optional().nullable(),
  position: z.string().min(1).max(255),
  department: z.string().max(255).optional(),
  startDate: z.string().regex(dateRegex),
  baseSalary: z.coerce.number().min(0),
  salaryType: z.enum(["FIXED", "HOURLY"]).default("FIXED"),
  hourlyRate: z.coerce.number().min(0).optional(),
  bankName: z.string().max(255).optional(),
  bankAccountType: z.string().max(255).optional(),
  bankAccountNumber: z.string().max(255).optional(),
});

export const employeeUpdateSchema = employeeSchema.partial().extend({
  endDate: z.string().regex(dateRegex).optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE", "TERMINATED"]).optional(),
});

export const timesheetPayloadSchema = z.object({
  employee_id: z.coerce.number().int().positive(),
  work_date: z.string().regex(dateRegex),
  start_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .nullable(),
  end_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .nullable(),
  worked_minutes: z.coerce.number().int().min(0).optional(),
  overtime_minutes: z.coerce.number().int().min(0).optional(),
  comment: z.string().max(500).optional().nullable(),
});

export const timesheetUpdateSchema = timesheetPayloadSchema.partial().omit({ employee_id: true, work_date: true });

export const timesheetBulkSchema = z.object({
  employee_id: z.coerce.number().int().positive(),
  period: z.string().regex(/^\d{4}-\d{2}$/), // YYYY-MM
  entries: z.array(timesheetPayloadSchema.omit({ employee_id: true })),
  remove_ids: z.array(z.number().int()).optional(),
});

export const roleMappingSchema = z.object({
  role: z.string(),
  hourly_rate: z.number().min(0),
});

// New schemas moved from timesheets.ts

export const timesheetListQuerySchema = z.object({
  employeeId: z.coerce.number().int().positive().optional(),
  from: z.string().regex(dateRegex),
  to: z.string().regex(dateRegex),
});

export const prepareEmailSchema = z.object({
  employeeId: z.number().int().positive(),
  month: z.string().regex(/^\d{4}-\d{2}$/), // YYYY-MM
  monthLabel: z.string(), // "Diciembre 2025"
  pdfBase64: z.string(), // PDF en base64
});
