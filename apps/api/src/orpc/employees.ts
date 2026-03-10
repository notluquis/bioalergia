import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { z } from "zod";
import { getSessionUser, hasPermission } from "../auth";
import { logError } from "../lib/logger";
import { configureSuperjson } from "../lib/superjson-config";
import {
  createEmployee,
  deactivateEmployee,
  getEmployeeById,
  listEmployees,
  updateEmployee,
} from "../services/employees";
import { SuperJSONRPCHandler } from "./superjson";

configureSuperjson();

type EmployeesORPCContext = {
  hono: HonoContext;
};

const base = os.$context<EmployeesORPCContext>();

const personSchema = z
  .object({
    createdAt: z.date(),
    email: z.string().nullable(),
    fatherName: z.string().nullable(),
    id: z.number().int(),
    motherName: z.string().nullable(),
    names: z.string(),
    personType: z.enum(["JURIDICAL", "NATURAL"]),
    rut: z.string(),
    updatedAt: z.date(),
  })
  .passthrough();

const employeeSchema = z
  .object({
    bankAccountNumber: z.string().nullable(),
    bankAccountType: z.string().nullable(),
    bankName: z.string().nullable(),
    baseSalary: z.number(),
    createdAt: z.date(),
    department: z.string().nullable().optional(),
    endDate: z.date().nullable().optional(),
    hourlyRate: z.number().nullable(),
    id: z.number().int(),
    metadata: z.unknown().nullable().optional(),
    overtimeRate: z.number().nullable().optional(),
    person: personSchema.nullable().optional(),
    personId: z.number().int(),
    position: z.string(),
    retentionRate: z.number().nullable().optional(),
    salaryType: z.enum(["FIXED", "HOURLY"]),
    startDate: z.date(),
    status: z.enum(["ACTIVE", "INACTIVE", "TERMINATED"]),
    updatedAt: z.date(),
  })
  .passthrough();

const employeePayloadSchema = z.object({
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

const employeeUpdatePayloadSchema = employeePayloadSchema.partial().extend({
  status: z.enum(["ACTIVE", "INACTIVE", "TERMINATED"]).optional(),
});

const employeeIdInputSchema = z.object({
  id: z.number().int(),
});

const employeesListInputSchema = z.object({
  includeInactive: z.boolean().optional(),
});

const employeeResponseSchema = z.object({
  employee: employeeSchema,
});

const employeesResponseSchema = z.object({
  employees: z.array(employeeSchema),
});

const statusResponseSchema = z.object({
  status: z.literal("ok"),
});

function toNumberValue(value: unknown) {
  if (value == null) {
    return null;
  }

  if (typeof value === "object" && "toString" in value && typeof value.toString === "function") {
    return Number(value.toString());
  }

  return Number(value);
}

function toPlainEmployee<T extends Record<string, unknown>>(employee: T) {
  return {
    ...employee,
    baseSalary: toNumberValue(employee.baseSalary) ?? 0,
    hourlyRate: toNumberValue(employee.hourlyRate),
    overtimeRate: toNumberValue(employee.overtimeRate),
    retentionRate: toNumberValue(employee.retentionRate),
  };
}

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);

  if (!user) {
    throw new ORPCError("UNAUTHORIZED", { message: "No autorizado" });
  }

  return next({
    context: {
      ...context,
      user,
    },
  });
});

const readEmployees = authed.use(async ({ context, next }) => {
  const canRead = await hasPermission(context.user.id, "read", "Employee");

  if (!canRead) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const createEmployees = authed.use(async ({ context, next }) => {
  const canCreate = await hasPermission(context.user.id, "create", "Employee");

  if (!canCreate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const updateEmployees = authed.use(async ({ context, next }) => {
  const canUpdate = await hasPermission(context.user.id, "update", "Employee");

  if (!canUpdate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const deleteEmployees = authed.use(async ({ context, next }) => {
  const canDelete = await hasPermission(context.user.id, "delete", "Employee");

  if (!canDelete) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const employeesORPCRouterBase = {
  create: createEmployees
    .route({
      method: "POST",
      path: "/",
      summary: "Create employee",
      tags: ["Employees"],
    })
    .input(employeePayloadSchema)
    .output(employeeResponseSchema)
    .handler(async ({ input }) => {
      const employee = await createEmployee(input);
      return { employee: toPlainEmployee(employee) };
    }),

  deactivate: deleteEmployees
    .route({
      method: "DELETE",
      path: "/{id}",
      summary: "Deactivate employee",
      tags: ["Employees"],
    })
    .input(employeeIdInputSchema)
    .output(statusResponseSchema)
    .handler(async ({ input }) => {
      await deactivateEmployee(input.id);
      return { status: "ok" as const };
    }),

  detail: readEmployees
    .route({
      method: "GET",
      path: "/{id}",
      summary: "Get employee by id",
      tags: ["Employees"],
    })
    .input(employeeIdInputSchema)
    .output(employeeResponseSchema)
    .handler(async ({ input }) => {
      const employee = await getEmployeeById(input.id);
      return { employee: toPlainEmployee(employee) };
    }),

  list: readEmployees
    .route({
      method: "GET",
      path: "/",
      summary: "List employees",
      tags: ["Employees"],
    })
    .input(employeesListInputSchema)
    .output(employeesResponseSchema)
    .handler(async ({ input }) => {
      const employees = await listEmployees({
        includeInactive: input.includeInactive,
      });

      return {
        employees: employees.map((employee) => toPlainEmployee(employee)),
      };
    }),

  update: updateEmployees
    .route({
      method: "PUT",
      path: "/{id}",
      summary: "Update employee",
      tags: ["Employees"],
    })
    .input(
      z.object({
        id: z.number().int(),
        payload: employeeUpdatePayloadSchema,
      }),
    )
    .output(employeeResponseSchema)
    .handler(async ({ input }) => {
      const employee = await updateEmployee(input.id, input.payload);
      return { employee: toPlainEmployee(employee) };
    }),
};

export const employeesORPCRouter = base
  .prefix("/api/orpc/employees")
  .tag("Employees")
  .router(employeesORPCRouterBase);

export const employeesORPCHandler = new SuperJSONRPCHandler(employeesORPCRouter, {
  interceptors: [
    onError((error) => {
      logError("employees.orpc", error, {});
    }),
  ],
});

export const employeesOpenAPIHandler = new OpenAPIHandler(employeesORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      docsPath: "/api/orpc/employees/docs",
      docsTitle: "Bioalergia Employees API Reference",
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Employees API",
          version: "1.0.0",
        },
      },
      specPath: "/api/orpc/employees/openapi.json",
    }),
  ],
  interceptors: [
    onError((error) => {
      logError("employees.orpc.openapi", error, {});
    }),
  ],
});

export type EmployeesORPCRouter = typeof employeesORPCRouter;
