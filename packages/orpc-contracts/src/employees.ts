import { oc } from "@orpc/contract";
import { z } from "zod";

export const employeePersonSchema = z
  .object({
    createdAt: z.coerce.date(),
    email: z.string().nullable(),
    fatherName: z.string().nullable(),
    id: z.number().int(),
    motherName: z.string().nullable(),
    names: z.string(),
    personType: z.enum(["JURIDICAL", "NATURAL"]),
    rut: z.string().nullable(),
    updatedAt: z.coerce.date(),
  })
  .passthrough();

export const employeeSchema = z
  .object({
    bankAccountNumber: z.string().nullable(),
    bankAccountType: z.string().nullable(),
    bankName: z.string().nullable(),
    baseSalary: z.number(),
    createdAt: z.coerce.date(),
    department: z.string().nullable().optional(),
    endDate: z.coerce.date().nullable().optional(),
    hourlyRate: z.number().nullable(),
    id: z.number().int(),
    metadata: z.unknown().nullable().optional(),
    overtimeRate: z.number().nullable().optional(),
    person: employeePersonSchema.nullable().optional(),
    personId: z.number().int(),
    position: z.string(),
    retentionRate: z.number().nullable().optional(),
    salaryType: z.enum(["FIXED", "HOURLY"]),
    startDate: z.coerce.date(),
    status: z.enum(["ACTIVE", "INACTIVE", "TERMINATED"]),
    updatedAt: z.coerce.date(),
  })
  .passthrough();

export const employeePayloadSchema = z.object({
  bank_account_number: z.string().nullable().optional(),
  bank_account_type: z.string().nullable().optional(),
  bank_name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  fatherName: z.string().nullable().optional(),
  fixed_salary: z.number().nullable().optional(),
  hourly_rate: z.number().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  motherName: z.string().nullable().optional(),
  names: z.string().min(1),
  overtime_rate: z.number().nullable().optional(),
  retention_rate: z.number(),
  role: z.string(),
  rut: z.string().min(1),
  salary_type: z.enum(["FIXED", "HOURLY"]),
});

export const employeeUpdatePayloadSchema = employeePayloadSchema.partial().extend({
  status: z.enum(["ACTIVE", "INACTIVE", "TERMINATED"]).optional(),
});

export const employeeIdInputSchema = z.object({
  id: z.number().int(),
});

export const employeesListInputSchema = z.object({
  includeInactive: z.boolean().optional(),
});

export const employeeResponseSchema = z.object({
  employee: employeeSchema,
});

export const employeesResponseSchema = z.object({
  employees: z.array(employeeSchema),
});

export const employeeStatusResponseSchema = z.object({
  status: z.literal("ok"),
});

export const employeesContract = {
  create: oc
    .route({ method: "POST", path: "/" })
    .input(employeePayloadSchema)
    .output(employeeResponseSchema),
  deactivate: oc
    .route({ method: "DELETE", path: "/{id}" })
    .input(employeeIdInputSchema)
    .output(employeeStatusResponseSchema),
  detail: oc
    .route({ method: "GET", path: "/{id}" })
    .input(employeeIdInputSchema)
    .output(employeeResponseSchema),
  list: oc
    .route({ method: "GET", path: "/" })
    .input(employeesListInputSchema)
    .output(employeesResponseSchema),
  update: oc
    .route({ method: "PUT", path: "/{id}" })
    .input(z.object({ id: z.number().int(), payload: employeeUpdatePayloadSchema }))
    .output(employeeResponseSchema),
};

export type EmployeesContract = typeof employeesContract;
