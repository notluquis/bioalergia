import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import {
  employeeIdInputSchema,
  employeePayloadSchema,
  employeeResponseSchema,
  employeeStatusResponseSchema,
  employeeUpdatePayloadSchema,
  employeesListInputSchema,
  employeesResponseSchema,
} from "@finanzas/orpc-contracts/employees";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import type { z } from "zod";
import { getSessionUser, hasPermission } from "../auth.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import {
  createEmployee,
  deactivateEmployee,
  getEmployeeById,
  listEmployees,
  updateEmployee,
} from "../services/employees.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type EmployeesORPCContext = {
  hono: HonoContext;
};

const base = os.$context<EmployeesORPCContext>();

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
  const canRead = await hasPermission(context.user, "read", "Employee");

  if (!canRead) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const createEmployees = authed.use(async ({ context, next }) => {
  const canCreate = await hasPermission(context.user, "create", "Employee");

  if (!canCreate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const updateEmployees = authed.use(async ({ context, next }) => {
  const canUpdate = await hasPermission(context.user, "update", "Employee");

  if (!canUpdate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const deleteEmployees = authed.use(async ({ context, next }) => {
  const canDelete = await hasPermission(context.user, "delete", "Employee");

  if (!canDelete) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const employeesORPCRouterBase = {
  create: createEmployees
    .route({ method: "POST", path: "/" })
    .input(employeePayloadSchema)
    .output(employeeResponseSchema)
    .handler(async ({ input }: { input: z.input<typeof employeePayloadSchema> }) => {
      const employee = await createEmployee(input);
      return { employee: toPlainEmployee(employee) };
    }),

  deactivate: deleteEmployees
    .route({ method: "DELETE", path: "/{id}" })
    .input(employeeIdInputSchema)
    .output(employeeStatusResponseSchema)
    .handler(async ({ input }: { input: z.input<typeof employeeIdInputSchema> }) => {
      await deactivateEmployee(input.id);
      return { status: "ok" as const };
    }),

  detail: readEmployees
    .route({ method: "GET", path: "/{id}" })
    .input(employeeIdInputSchema)
    .output(employeeResponseSchema)
    .handler(async ({ input }: { input: z.input<typeof employeeIdInputSchema> }) => {
      const employee = await getEmployeeById(input.id);
      return { employee: toPlainEmployee(employee) };
    }),

  list: readEmployees
    .route({ method: "GET", path: "/" })
    .input(employeesListInputSchema)
    .output(employeesResponseSchema)
    .handler(async ({ input }: { input: z.input<typeof employeesListInputSchema> }) => {
      const employees = await listEmployees({
        includeInactive: input.includeInactive,
      });

      return {
        employees: employees.map((employee) => toPlainEmployee(employee)),
      };
    }),

  update: updateEmployees
    .route({ method: "PUT", path: "/{id}" })
    .input(employeeIdInputSchema.extend({ payload: employeeUpdatePayloadSchema }))
    .output(employeeResponseSchema)
    .handler(
      async ({
        input,
      }: {
        input: { id: number; payload: z.input<typeof employeeUpdatePayloadSchema> };
      }) => {
        const employee = await updateEmployee(input.id, input.payload);
        return { employee: toPlainEmployee(employee) };
      }
    ),
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
      docsTitle: "Bioalergia Employees API Reference",
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Employees API",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError("employees.orpc.openapi", error, {});
    }),
  ],
});

export type EmployeesORPCRouter = typeof employeesORPCRouter;
