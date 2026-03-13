import { db } from "@finanzas/db";
import { servicesContract } from "@finanzas/orpc-contracts/services";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { Decimal } from "decimal.js";
import type { Context as HonoContext } from "hono";
import { z } from "zod";
import { getSessionUser, hasPermission } from "../auth";
import { serviceCreateSchema } from "../lib/entity-schemas";
import { logError } from "../lib/logger";
import { configureSuperjson } from "../lib/superjson-config";
import {
  createService,
  deleteService,
  generateSchedules,
  getServiceByIdOrPublicId,
  listServices,
  syncServiceSchedulesWithFinancialTransactions,
  updateService,
} from "../services/services";
import { SuperJSONRPCHandler } from "./superjson";

configureSuperjson();

type ServicesORPCContext = {
  hono: HonoContext;
};

const base = os.$context<ServicesORPCContext>();

const serviceIdSchema = z.object({
  id: z.string().min(1),
});

const scheduleIdSchema = z.object({
  id: z.number().int().positive(),
});

const generateSchedulesSchema = z.object({
  fromDate: z.coerce.date().optional(),
  id: z.string().min(1),
  months: z.number().int().min(1).max(120).optional(),
});

const payScheduleSchema = z.object({
  id: z.number().int().positive(),
  note: z.string().max(1000).optional().nullable(),
  paidAmount: z.coerce.number().min(0),
  paidDate: z.coerce.date(),
  transactionId: z.coerce.number().int(),
  transactionSource: z.enum(["release", "settlement", "withdraw"]).optional(),
});

const editScheduleSchema = z.object({
  dueDate: z.coerce.date().optional(),
  expectedAmount: z.coerce.number().min(0).optional(),
  id: z.number().int().positive(),
  note: z.string().max(1000).optional().nullable(),
});

const skipScheduleSchema = z.object({
  id: z.number().int().positive(),
  reason: z.string().min(1).max(500),
});
const decimalOutputSchema = z.union([z.number(), z.instanceof(Decimal)]);
const serviceCategorySchema = z
  .object({
    color: z.string().nullable(),
    id: z.number().int(),
    name: z.string(),
    type: z.enum(["EXPENSE", "INCOME"]),
  })
  .passthrough();
const serviceTransactionSchema = z
  .object({
    amount: decimalOutputSchema.nullable().optional(),
    description: z.string().nullable().optional(),
    id: z.number().int(),
    timestamp: z.date().optional(),
  })
  .passthrough();
const serviceScheduleSchema = z
  .object({
    createdAt: z.date(),
    dueDate: z.date(),
    effectiveAmount: decimalOutputSchema,
    expectedAmount: decimalOutputSchema,
    financialTransactionId: z.number().int().nullable().optional(),
    id: z.number().int(),
    lateFeeAmount: decimalOutputSchema,
    note: z.string().nullable(),
    overdueDays: z.number().int(),
    paidAmount: decimalOutputSchema.nullable().optional(),
    paidDate: z.date().nullable().optional(),
    periodEnd: z.date(),
    periodStart: z.date(),
    serviceId: z.number().int(),
    status: z.enum(["PAID", "PARTIAL", "PENDING", "SKIPPED"]),
    transaction: serviceTransactionSchema.nullable().optional(),
    transactionId: z.number().int().nullable(),
    updatedAt: z.date(),
  })
  .passthrough();
const serviceSummarySchema = z
  .object({
    accountReference: z.string().nullable(),
    amountIndexation: z.enum(["NONE", "UF"]),
    autoLinkTransactions: z.boolean(),
    category: z.string().nullable(),
    counterpartAccountBankName: z.string().nullable(),
    counterpartAccountId: z.number().int().nullable(),
    counterpartAccountIdentifier: z.string().nullable(),
    counterpartAccountType: z.string().nullable(),
    counterpartId: z.number().int().nullable(),
    counterpartName: z.string().nullable(),
    createdAt: z.date(),
    defaultAmount: decimalOutputSchema,
    detail: z.string().nullable(),
    dueDay: z.number().int().nullable(),
    emissionDay: z.number().int().nullable(),
    emissionEndDay: z.number().int().nullable(),
    emissionExactDate: z.date().nullable(),
    emissionMode: z.enum(["DATE_RANGE", "FIXED_DAY", "SPECIFIC_DATE"]),
    emissionStartDay: z.number().int().nullable(),
    frequency: z.enum([
      "ANNUAL",
      "BIMONTHLY",
      "BIWEEKLY",
      "MONTHLY",
      "ONCE",
      "QUARTERLY",
      "SEMIANNUAL",
      "WEEKLY",
    ]),
    id: z.number().int(),
    lateFeeGraceDays: z.number().int().nullable(),
    lateFeeMode: z.enum(["FIXED", "NONE", "PERCENTAGE"]),
    lateFeeValue: decimalOutputSchema.nullable(),
    name: z.string(),
    nextGenerationMonths: z.number().int(),
    notes: z.string().nullable(),
    obligationType: z.enum(["DEBT", "LOAN", "OTHER", "SERVICE"]),
    overdueCount: z.number().int(),
    ownership: z.enum(["COMPANY", "MIXED", "OWNER", "THIRD_PARTY"]),
    pendingCount: z.number().int(),
    publicId: z.string(),
    recurrenceType: z.enum(["ONE_OFF", "RECURRING"]),
    reminderDaysBefore: z.number().int(),
    serviceType: z.enum(["BUSINESS", "LEASE", "OTHER", "PERSONAL", "SOFTWARE", "SUPPLIER", "TAX", "UTILITY"]),
    startDate: z.date(),
    status: z.enum(["ACTIVE", "ARCHIVED", "INACTIVE"]),
    totalExpected: decimalOutputSchema,
    totalPaid: decimalOutputSchema,
    transactionCategory: serviceCategorySchema.nullable().optional(),
    transactionCategoryId: z.number().int().nullable(),
    updatedAt: z.date(),
  })
  .passthrough();

const statusOkSchema = z.object({
  status: z.literal("ok"),
});

const listResponseSchema = z.object({
  services: z.array(serviceSummarySchema),
  status: z.literal("ok"),
});

const detailResponseSchema = z.object({
  schedules: z.array(serviceScheduleSchema),
  service: serviceSummarySchema,
  status: z.literal("ok"),
});

const scheduleResponseSchema = z.object({
  schedule: serviceScheduleSchema,
  status: z.literal("ok"),
});

const syncResponseSchema = z.object({
  data: z.object({
    matchedSchedules: z.number(),
    processedSchedules: z.number(),
    scannedTransactions: z.number(),
    servicesCount: z.number(),
  }),
  status: z.literal("ok"),
});

const generateSchedulesResponseSchema = z
  .object({
    generated: z.number(),
    message: z.string().optional(),
    schedules: z.array(serviceScheduleSchema),
    service: serviceSummarySchema,
    status: z.literal("ok"),
  })
  .passthrough();

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

const readServices = authed.use(async ({ context, next }) => {
  const canRead = await hasPermission(context.user.id, "read", "Service");
  const canReadList = await hasPermission(context.user.id, "read", "ServiceList");
  const canReadAgenda = await hasPermission(context.user.id, "read", "ServiceAgenda");
  const canReadTemplate = await hasPermission(context.user.id, "read", "ServiceTemplate");

  if (!canRead && !canReadList && !canReadAgenda && !canReadTemplate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const updateServices = authed.use(async ({ context, next }) => {
  const canUpdate = await hasPermission(context.user.id, "update", "Service");

  if (!canUpdate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const createServices = authed.use(async ({ context, next }) => {
  const canCreate = await hasPermission(context.user.id, "create", "Service");

  if (!canCreate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const deleteServices = authed.use(async ({ context, next }) => {
  const canDelete = await hasPermission(context.user.id, "delete", "Service");

  if (!canDelete) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const RELEASE_ID_OFFSET = -1_000_000_000;
const WITHDRAW_ID_OFFSET = -2_000_000_000;

type TransactionSource = "release" | "settlement" | "withdraw";

function decodeUnifiedId(
  transactionId: number,
): null | { rawId: number; source: TransactionSource } {
  if (transactionId > 0) {
    return { rawId: transactionId, source: "settlement" };
  }

  if (transactionId <= WITHDRAW_ID_OFFSET - 1) {
    const rawId = WITHDRAW_ID_OFFSET - transactionId;
    return rawId > 0 ? { rawId, source: "withdraw" } : null;
  }

  if (transactionId <= RELEASE_ID_OFFSET - 1 && transactionId > WITHDRAW_ID_OFFSET - 1) {
    const rawId = RELEASE_ID_OFFSET - transactionId;
    return rawId > 0 ? { rawId, source: "release" } : null;
  }

  return null;
}

function normalizeTransactionReference(
  transactionId: number,
  transactionSource?: TransactionSource,
): null | { rawId: number; source: TransactionSource } {
  if (transactionSource) {
    if (transactionId > 0) {
      return { rawId: transactionId, source: transactionSource };
    }

    const decoded = decodeUnifiedId(transactionId);
    if (!decoded || decoded.source !== transactionSource) {
      return null;
    }

    return decoded;
  }

  return decodeUnifiedId(transactionId);
}

const servicesORPCRouterBase = {
  create: createServices
    .route(servicesContract.create)
    .handler(async ({ input }) => {
      const service = await createService(input);
      return {
        schedules: [],
        service,
        status: "ok" as const,
      };
    }),

  delete: deleteServices
    .route(servicesContract.delete)
    .handler(async ({ input }) => {
      const existing = await getServiceByIdOrPublicId(input.id);

      if (!existing) {
        throw new ORPCError("NOT_FOUND", { message: "Not found" });
      }

      await deleteService(existing.id);
      return { status: "ok" as const };
    }),

  detail: readServices
    .route(servicesContract.detail)
    .handler(async ({ input }) => {
      const service = await getServiceByIdOrPublicId(input.id);

      if (!service) {
        throw new ORPCError("NOT_FOUND", { message: "Not found" });
      }

      const schedules = await db.serviceSchedule.findMany({
        where: { serviceId: service.id },
        orderBy: { periodStart: "asc" },
      });

      return {
        schedules,
        service,
        status: "ok" as const,
      };
    }),

  list: readServices
    .route(servicesContract.list)
    .handler(async () => ({
      services: await listServices(),
      status: "ok" as const,
    })),

  regenerateSchedules: updateServices
    .route(servicesContract.regenerateSchedules)
    .handler(async ({ input }) => {
      const existing = await getServiceByIdOrPublicId(input.id);

      if (!existing) {
        throw new ORPCError("NOT_FOUND", { message: "Not found" });
      }

      const result = await generateSchedules({
        serviceId: existing.id,
        months: input.months,
        fromDate: input.fromDate,
      });

      const service = await getServiceByIdOrPublicId(existing.id);
      const schedules = await db.serviceSchedule.findMany({
        where: { serviceId: existing.id },
        orderBy: { periodStart: "asc" },
      });

      return {
        ...result,
        schedules,
        service,
        status: "ok" as const,
      };
    }),

  scheduleEdit: updateServices
    .route(servicesContract.scheduleEdit)
    .handler(async ({ input }) => {
      const schedule = await db.serviceSchedule.findUnique({ where: { id: input.id } });

      if (!schedule) {
        throw new ORPCError("NOT_FOUND", { message: "Schedule no encontrado" });
      }

      const data: {
        dueDate?: Date;
        expectedAmount?: Decimal;
        note?: null | string;
      } = {};

      if (input.dueDate !== undefined) {
        data.dueDate = input.dueDate;
      }

      if (input.expectedAmount !== undefined) {
        data.expectedAmount = new Decimal(input.expectedAmount);
      }

      if (input.note !== undefined) {
        data.note = input.note;
      }

      const updated = await db.serviceSchedule.update({
        where: { id: input.id },
        data,
      });

      return {
        schedule: updated,
        status: "ok" as const,
      };
    }),

  schedulePay: updateServices
    .route(servicesContract.schedulePay)
    .handler(async ({ input }) => {
      const schedule = await db.serviceSchedule.findUnique({ where: { id: input.id } });

      if (!schedule) {
        throw new ORPCError("NOT_FOUND", { message: "Schedule no encontrado" });
      }

      const txRef = normalizeTransactionReference(input.transactionId, input.transactionSource);
      if (!txRef) {
        throw new ORPCError("BAD_REQUEST", { message: "Referencia de transacción inválida" });
      }

      if (txRef.source === "settlement") {
        const found = await db.settlementTransaction.findUnique({ where: { id: txRef.rawId } });
        if (!found) {
          throw new ORPCError("NOT_FOUND", { message: "Settlement transaction no encontrada" });
        }
      } else if (txRef.source === "release") {
        const found = await db.releaseTransaction.findUnique({ where: { id: txRef.rawId } });
        if (!found) {
          throw new ORPCError("NOT_FOUND", { message: "Release transaction no encontrada" });
        }
      } else {
        const found = await db.withdrawTransaction.findUnique({ where: { id: txRef.rawId } });
        if (!found) {
          throw new ORPCError("NOT_FOUND", { message: "Withdraw transaction no encontrada" });
        }
      }

      const paidAmount = new Decimal(input.paidAmount);
      const dueAmount = new Decimal(schedule.effectiveAmount.toString());
      const status = paidAmount.greaterThanOrEqualTo(dueAmount) ? "PAID" : "PARTIAL";

      const updated = await db.serviceSchedule.update({
        where: { id: input.id },
        data: {
          paidAmount,
          paidDate: input.paidDate,
          note: input.note ?? schedule.note,
          status,
          financialTransactionId: null,
          settlementTransactionId: txRef.source === "settlement" ? txRef.rawId : null,
          releaseTransactionId: txRef.source === "release" ? txRef.rawId : null,
          withdrawTransactionId: txRef.source === "withdraw" ? txRef.rawId : null,
        },
      });

      return {
        schedule: updated,
        status: "ok" as const,
      };
    }),

  scheduleSkip: updateServices
    .route(servicesContract.scheduleSkip)
    .handler(async ({ input }) => {
      const schedule = await db.serviceSchedule.findUnique({ where: { id: input.id } });

      if (!schedule) {
        throw new ORPCError("NOT_FOUND", { message: "Schedule no encontrado" });
      }

      const updated = await db.serviceSchedule.update({
        where: { id: input.id },
        data: {
          note: input.reason,
          status: "SKIPPED",
        },
      });

      return {
        schedule: updated,
        status: "ok" as const,
      };
    }),

  scheduleUnlink: updateServices
    .route(servicesContract.scheduleUnlink)
    .handler(async ({ input }) => {
      const schedule = await db.serviceSchedule.findUnique({ where: { id: input.id } });

      if (!schedule) {
        throw new ORPCError("NOT_FOUND", { message: "Schedule no encontrado" });
      }

      const updated = await db.serviceSchedule.update({
        where: { id: input.id },
        data: {
          paidAmount: null,
          paidDate: null,
          status: "PENDING",
          financialTransactionId: null,
          settlementTransactionId: null,
          releaseTransactionId: null,
          withdrawTransactionId: null,
        },
      });

      return {
        schedule: updated,
        status: "ok" as const,
      };
    }),

  syncAllTransactions: updateServices
    .route(servicesContract.syncAllTransactions)
    .handler(async () => ({
      data: await syncServiceSchedulesWithFinancialTransactions(),
      status: "ok" as const,
    })),

  syncTransactions: updateServices
    .route(servicesContract.syncTransactions)
    .handler(async ({ input }) => {
      const existing = await getServiceByIdOrPublicId(input.id);

      if (!existing) {
        throw new ORPCError("NOT_FOUND", { message: "Not found" });
      }

      return {
        data: await syncServiceSchedulesWithFinancialTransactions(existing.publicId),
        status: "ok" as const,
      };
    }),

  update: updateServices
    .route(servicesContract.update)
    .handler(async ({ input }) => {
      const existing = await getServiceByIdOrPublicId(input.id);

      if (!existing) {
        throw new ORPCError("NOT_FOUND", { message: "Not found" });
      }

      const service = await updateService(existing.id, input.payload);
      const schedules = await db.serviceSchedule.findMany({
        where: { serviceId: service.id },
        orderBy: { periodStart: "asc" },
      });

      return {
        schedules,
        service,
        status: "ok" as const,
      };
    }),
};

export const servicesORPCRouter = base.prefix("/api/orpc/services").router(servicesORPCRouterBase);

export const servicesORPCHandler = new SuperJSONRPCHandler(servicesORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "orpc.services",
      });
    }),
  ],
});

export const servicesOpenAPIHandler = new OpenAPIHandler(servicesORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Services oRPC",
          description: "Contratos oRPC/OpenAPI para servicios recurrentes y sus schedules.",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "openapi.services",
      });
    }),
  ],
});

export type ServicesORPCRouter = typeof servicesORPCRouter;
