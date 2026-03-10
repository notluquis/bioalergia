import { db } from "@finanzas/db";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import Decimal from "decimal.js";
import type { Context as HonoContext } from "hono";
import { z } from "zod";
import { getSessionUser, hasPermission } from "../auth";
import { logError } from "../lib/logger";
import { configureSuperjson } from "../lib/superjson-config";
import { SuperJSONRPCHandler } from "./superjson";

configureSuperjson();
dayjs.extend(timezone);

const TIMEZONE = "America/Santiago";

type PatientsORPCContext = {
  hono: HonoContext;
};

const base = os.$context<PatientsORPCContext>();

const decimalSchema = z.union([z.instanceof(Decimal), z.number(), z.string()]);

const budgetItemInputSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().min(1),
  unitPrice: z.number().min(0),
});

const createBudgetInputSchema = z.object({
  discount: z.number().min(0),
  items: z.array(budgetItemInputSchema).min(1),
  notes: z.string().optional(),
  patientId: z.number().int(),
  title: z.string().min(1),
});

const patientIdInputSchema = z.object({
  patientId: z.number().int(),
});

const createPaymentInputSchema = z.object({
  amount: z.number().positive(),
  budgetId: z.number().int().optional(),
  notes: z.string().optional(),
  patientId: z.number().int(),
  paymentDate: z.string().min(1),
  paymentMethod: z.enum(["Transferencia", "Efectivo", "Tarjeta", "Otro"]),
  reference: z.string().optional(),
});

const patientPaymentSchema = z.object({
  amount: decimalSchema,
  budgetId: z.number().nullable().optional(),
  createdAt: z.date(),
  id: z.number().int(),
  notes: z.string().nullable().optional(),
  patientId: z.number().int(),
  paymentDate: z.date(),
  paymentMethod: z.string(),
  reference: z.string().nullable().optional(),
});

const budgetSchema = z.object({
  createdAt: z.date(),
  discount: decimalSchema,
  finalAmount: decimalSchema,
  id: z.number().int(),
  items: z.array(z.unknown()),
  notes: z.string().nullable().optional(),
  patientId: z.number().int(),
  payments: z.array(patientPaymentSchema).optional(),
  status: z.string(),
  title: z.string(),
  totalAmount: decimalSchema,
  updatedAt: z.date(),
});

const budgetListResponseSchema = z.object({
  budgets: z.array(budgetSchema),
  status: z.literal("ok"),
});

const budgetResponseSchema = z.object({
  budget: budgetSchema,
  status: z.literal("ok"),
});

const paymentResponseSchema = z.object({
  payment: patientPaymentSchema,
  status: z.literal("ok"),
});

const paymentListResponseSchema = z.object({
  payments: z.array(patientPaymentSchema),
  status: z.literal("ok"),
});

function parseDateOnly(value: string) {
  return dayjs.tz(value, "YYYY-MM-DD", TIMEZONE).toDate();
}

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);

  if (!user) {
    throw new ORPCError("UNAUTHORIZED", { message: "Unauthorized" });
  }

  return next({
    context: {
      ...context,
      user,
    },
  });
});

const readBudgets = authed.use(async ({ context, next }) => {
  const canRead = await hasPermission(context.user.id, "read", "Budget");

  if (!canRead) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const createBudgets = authed.use(async ({ context, next }) => {
  const canCreate = await hasPermission(context.user.id, "create", "Budget");

  if (!canCreate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const readPayments = authed.use(async ({ context, next }) => {
  const canRead = await hasPermission(context.user.id, "read", "PatientPayment");

  if (!canRead) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const createPayments = authed.use(async ({ context, next }) => {
  const canCreate = await hasPermission(context.user.id, "create", "PatientPayment");

  if (!canCreate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const patientsORPCRouterBase = {
  createBudget: createBudgets
    .route({
      method: "POST",
      path: "/budgets",
      summary: "Create patient budget",
      tags: ["Patients"],
    })
    .input(createBudgetInputSchema)
    .output(budgetResponseSchema)
    .handler(async ({ input }) => {
      const totalAmount = input.items.reduce(
        (sum, item) => sum + item.unitPrice * item.quantity,
        0,
      );
      const finalAmount = totalAmount - input.discount;

      const budget = await db.budget.create({
        data: {
          patientId: input.patientId,
          title: input.title,
          totalAmount: new Decimal(totalAmount),
          discount: new Decimal(input.discount),
          finalAmount: new Decimal(finalAmount),
          notes: input.notes,
        },
        include: {
          payments: true,
        },
      });

      return {
        budget: {
          ...budget,
          items: [],
        },
        status: "ok",
      };
    }),

  createPayment: createPayments
    .route({
      method: "POST",
      path: "/payments",
      summary: "Create patient payment",
      tags: ["Patients"],
    })
    .input(createPaymentInputSchema)
    .output(paymentResponseSchema)
    .handler(async ({ input }) => {
      const payment = await db.patientPayment.create({
        data: {
          patientId: input.patientId,
          budgetId: input.budgetId,
          amount: new Decimal(input.amount),
          paymentDate: parseDateOnly(input.paymentDate),
          paymentMethod: input.paymentMethod,
          reference: input.reference,
          notes: input.notes,
        },
      });

      return {
        payment,
        status: "ok",
      };
    }),

  listBudgets: readBudgets
    .route({
      method: "GET",
      path: "/{patientId}/budgets",
      summary: "List patient budgets",
      tags: ["Patients"],
    })
    .input(patientIdInputSchema)
    .output(budgetListResponseSchema)
    .handler(async ({ input }) => {
      const budgets = await db.budget.findMany({
        where: { patientId: input.patientId },
        include: { payments: true },
        orderBy: { updatedAt: "desc" },
      });

      return {
        budgets: budgets.map((budget) => ({
          ...budget,
          items: [],
        })),
        status: "ok",
      };
    }),

  listPayments: readPayments
    .route({
      method: "GET",
      path: "/{patientId}/payments",
      summary: "List patient payments",
      tags: ["Patients"],
    })
    .input(patientIdInputSchema)
    .output(paymentListResponseSchema)
    .handler(async ({ input }) => {
      const payments = await db.patientPayment.findMany({
        where: { patientId: input.patientId },
        orderBy: { paymentDate: "desc" },
      });

      return {
        payments,
        status: "ok",
      };
    }),
};

export const patientsORPCRouter = base.router(patientsORPCRouterBase).prefix("/api/orpc/patients");

export const patientsORPCHandler = new SuperJSONRPCHandler(patientsORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "orpc.patients",
      });
    }),
  ],
});

export const patientsOpenAPIHandler = new OpenAPIHandler(patientsORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      docsPath: "/api/orpc/patients/docs",
      specPath: "/api/orpc/patients/openapi.json",
      theme: "saturn",
      favicon: "https://orpc.dev/icon.svg",
      layout: "modern",
      meta: {
        title: "Bioalergia Patients oRPC",
        description: "Contratos oRPC/OpenAPI para presupuestos y pagos de pacientes.",
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "openapi.patients",
      });
    }),
  ],
  schemaConverters: [new ZodToJsonSchemaConverter()],
});
