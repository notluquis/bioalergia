/**
 * HR schemas (Employees & Timesheets)
 */
import { z } from "zod";
import { validateRut } from "../lib/rut.js";
import { dateRegex, timeRegex } from "./shared.js";

export const employeeSchema = z.object({
  full_name: z.string().min(1).max(191),
  role: z.string().min(1).max(120),
  email: z.string().email().nullable().optional(),
  rut: z
    .string()
    .trim()
    .min(3)
    .max(20)
    .nullable()
    .optional()
    .refine((val) => !val || validateRut(val), { message: "RUT inválido" }),
  bank_name: z.string().trim().max(120).nullable().optional(),
  bank_account_type: z.string().trim().max(32).nullable().optional(),
  bank_account_number: z.string().trim().max(64).nullable().optional(),
  salary_type: z.enum(["HOURLY", "FIXED"]).default("HOURLY"),
  hourly_rate: z.coerce.number().min(0).optional(),
  fixed_salary: z.coerce.number().min(0).nullable().optional(),
  overtime_rate: z.coerce.number().min(0).nullable().optional(),
  retention_rate: z.coerce.number().min(0).max(1),
  metadata: z.record(z.string(), z.any()).nullable().optional(),
});

export const employeeUpdateSchema = employeeSchema.partial().extend({
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export const timesheetPayloadSchema = z.object({
  employee_id: z.coerce.number().int().positive(),
  work_date: z.string().regex(dateRegex),
  start_time: z.string().regex(timeRegex).nullable().optional(),
  end_time: z.string().regex(timeRegex).nullable().optional(),
  worked_minutes: z.coerce.number().int().min(0),
  overtime_minutes: z.coerce.number().int().min(0).default(0),
  comment: z.string().max(255).nullable().optional(),
});

export const timesheetUpdateSchema = timesheetPayloadSchema.omit({ employee_id: true, work_date: true }).partial();

export const timesheetBulkSchema = z.object({
  employee_id: z.coerce.number().int().positive(),
  entries: z
    .array(
      z.object({
        work_date: z.string().regex(dateRegex),
        start_time: z.string().regex(timeRegex).nullable().optional(),
        end_time: z.string().regex(timeRegex).nullable().optional(),
        worked_minutes: z.coerce.number().int().min(0).optional(),
        overtime_minutes: z.coerce.number().int().min(0).default(0),
        comment: z.string().max(255).nullable().optional(),
      })
    )
    .max(200),
  remove_ids: z.array(z.coerce.number().int().positive()).optional(),
});

export const roleMappingSchema = z.object({
  employee_role: z.string().min(1).max(120),
  app_role: z.string().min(1),
});
