import { db } from "@finanzas/db";
import {
  editScheduleSchema,
  generateSchedulesSchema,
  payScheduleSchema,
  scheduleIdSchema as contractScheduleIdSchema,
  serviceCreateSchema as contractServiceCreateSchema,
  serviceIdSchema as contractServiceIdSchema,
  skipScheduleSchema,
} from "@finanzas/orpc-contracts/services";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { Decimal } from "decimal.js";
import type { Context as HonoContext } from "hono";
import { z } from "zod";
import { getSessionUser, hasPermission } from "../lib/auth.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import {
  createService,
  deleteService,
  generateSchedules,
  getServiceByIdOrPublicId,
  listServices,
  syncServiceSchedulesWithFinancialTransactions,
  updateService,
} from "../services/services.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type ServicesORPCContext = {
  hono: HonoContext;
};

const base = os.$context<ServicesORPCContext>();

const decimalOutputSchema = z.union([z.number(), z.instanceof(Decimal)]);
const serviceCategorySchema = z
  .object({
    color: z.string().nullable(),
    id: z.number().int(),
    name: z.string(),
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
    serviceType: z.enum([
      "BUSINESS",
      "LEASE",
      "OTHER",
      "PERSONAL",
      "SOFTWARE",
      "SUPPLIER",
      "TAX",
      "UTILITY",
    ]),
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

type ServiceSummaryDto = z.infer<typeof serviceSummarySchema>;
type ServiceScheduleDto = z.infer<typeof serviceScheduleSchema>;

function toDecimalValue(value: Decimal | null | number | undefined) {
  if (value == null) {
    return null;
  }

  return value;
}

function toUnifiedTransactionId(schedule: {
  financialTransactionId?: null | number;
  releaseTransactionId?: null | number;
  settlementTransactionId?: null | number;
  withdrawTransactionId?: null | number;
}) {
  if (schedule.settlementTransactionId != null) {
    return schedule.settlementTransactionId;
  }

  if (schedule.releaseTransactionId != null) {
    return RELEASE_ID_OFFSET - schedule.releaseTransactionId;
  }

  if (schedule.withdrawTransactionId != null) {
    return WITHDRAW_ID_OFFSET - schedule.withdrawTransactionId;
  }

  return schedule.financialTransactionId ?? null;
}

function getOverdueDays(schedule: {
  dueDate: Date;
  status: "PAID" | "PARTIAL" | "PENDING" | "SKIPPED";
}) {
  if (schedule.status === "PAID" || schedule.status === "SKIPPED") {
    return 0;
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const dueDate = new Date(schedule.dueDate);
  dueDate.setHours(0, 0, 0, 0);

  const diffMs = startOfToday.getTime() - dueDate.getTime();
  return diffMs > 0 ? Math.floor(diffMs / 86_400_000) : 0;
}

function mapServiceSchedule(schedule: {
  createdAt: Date;
  dueDate: Date;
  effectiveAmount: Decimal;
  expectedAmount: Decimal;
  financialTransactionId: null | number;
  id: number;
  lateFeeAmount: Decimal;
  note: null | string;
  paidAmount: Decimal | null;
  paidDate: Date | null;
  periodEnd: Date;
  periodStart: Date;
  releaseTransactionId: null | number;
  serviceId: number;
  settlementTransactionId: null | number;
  status: "PAID" | "PARTIAL" | "PENDING" | "SKIPPED";
  updatedAt: Date;
  withdrawTransactionId: null | number;
}): ServiceScheduleDto {
  return {
    createdAt: schedule.createdAt,
    dueDate: schedule.dueDate,
    effectiveAmount: schedule.effectiveAmount,
    expectedAmount: schedule.expectedAmount,
    financialTransactionId: schedule.financialTransactionId,
    id: schedule.id,
    lateFeeAmount: schedule.lateFeeAmount,
    note: schedule.note,
    overdueDays: getOverdueDays(schedule),
    paidAmount: schedule.paidAmount,
    paidDate: schedule.paidDate,
    periodEnd: schedule.periodEnd,
    periodStart: schedule.periodStart,
    serviceId: schedule.serviceId,
    status: schedule.status,
    transaction: null,
    transactionId: toUnifiedTransactionId(schedule),
    updatedAt: schedule.updatedAt,
  };
}

function getServiceScheduleStats(schedules: ServiceScheduleDto[]) {
  return schedules.reduce(
    (acc, schedule) => {
      acc.totalExpected += Number(schedule.effectiveAmount);
      acc.totalPaid += Number(schedule.paidAmount ?? 0);

      if (schedule.status === "PENDING" || schedule.status === "PARTIAL") {
        acc.pendingCount += 1;
      }

      if (
        schedule.overdueDays > 0 &&
        (schedule.status === "PENDING" || schedule.status === "PARTIAL")
      ) {
        acc.overdueCount += 1;
      }

      return acc;
    },
    { overdueCount: 0, pendingCount: 0, totalExpected: 0, totalPaid: 0 }
  );
}

function mapServiceSummary(
  service: {
    amountIndexation: ServiceSummaryDto["amountIndexation"];
    autoLinkTransactions: boolean;
    category: null | string;
    counterpart: null | { bankAccountHolder: string; id: number };
    createdAt: Date;
    defaultAmount: Decimal;
    detail: null | string;
    dueDay: null | number;
    emissionDay: null | number;
    emissionEndDay: null | number;
    emissionExactDate: Date | null;
    emissionMode: ServiceSummaryDto["emissionMode"];
    emissionStartDay: null | number;
    frequency: ServiceSummaryDto["frequency"];
    id: number;
    lateFeeGraceDays: null | number;
    lateFeeMode: ServiceSummaryDto["lateFeeMode"];
    lateFeeValue: Decimal | null;
    name: string;
    nextGenerationMonths: number;
    notes: null | string;
    obligationType: ServiceSummaryDto["obligationType"];
    ownership: ServiceSummaryDto["ownership"];
    publicId: string;
    recurrenceType: ServiceSummaryDto["recurrenceType"];
    reminderDaysBefore: number;
    startDate: Date;
    status: ServiceSummaryDto["status"];
    transactionCategory: null | {
      color: null | string;
      id: number;
      name: string;
    };
    transactionCategoryId: null | number;
    type: ServiceSummaryDto["serviceType"];
    updatedAt: Date;
  },
  stats: { overdueCount: number; pendingCount: number; totalExpected: number; totalPaid: number }
): ServiceSummaryDto {
  return {
    accountReference: null,
    amountIndexation: service.amountIndexation,
    autoLinkTransactions: service.autoLinkTransactions,
    category: service.category,
    counterpartAccountBankName: null,
    counterpartAccountId: null,
    counterpartAccountIdentifier: null,
    counterpartAccountType: null,
    counterpartId: service.counterpart?.id ?? null,
    counterpartName: service.counterpart?.bankAccountHolder ?? null,
    createdAt: service.createdAt,
    defaultAmount: service.defaultAmount,
    detail: service.detail,
    dueDay: service.dueDay,
    emissionDay: service.emissionDay,
    emissionEndDay: service.emissionEndDay,
    emissionExactDate: service.emissionExactDate,
    emissionMode: service.emissionMode,
    emissionStartDay: service.emissionStartDay,
    frequency: service.frequency,
    id: service.id,
    lateFeeGraceDays: service.lateFeeGraceDays,
    lateFeeMode: service.lateFeeMode,
    lateFeeValue: toDecimalValue(service.lateFeeValue),
    name: service.name,
    nextGenerationMonths: service.nextGenerationMonths,
    notes: service.notes,
    obligationType: service.obligationType,
    overdueCount: stats.overdueCount,
    ownership: service.ownership,
    pendingCount: stats.pendingCount,
    publicId: service.publicId,
    recurrenceType: service.recurrenceType,
    reminderDaysBefore: service.reminderDaysBefore,
    serviceType: service.type,
    startDate: service.startDate,
    status: service.status,
    totalExpected: stats.totalExpected,
    totalPaid: stats.totalPaid,
    transactionCategory: service.transactionCategory,
    transactionCategoryId: service.transactionCategoryId,
    updatedAt: service.updatedAt,
  };
}

function mapServicePayload(input: z.output<typeof contractServiceCreateSchema>) {
  return {
    ...input,
    emissionExactDate: input.emissionExactDate?.toISOString() ?? null,
    startDate: input.startDate.toISOString(),
  };
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

const readServices = authed.use(async ({ context, next }) => {
  const canRead = await hasPermission(context.user, "read", "Service");
  const canReadList = await hasPermission(context.user, "read", "ServiceList");
  const canReadAgenda = await hasPermission(context.user, "read", "ServiceAgenda");
  const canReadTemplate = await hasPermission(context.user, "read", "ServiceTemplate");

  if (!canRead && !canReadList && !canReadAgenda && !canReadTemplate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const updateServices = authed.use(async ({ context, next }) => {
  const canUpdate = await hasPermission(context.user, "update", "Service");

  if (!canUpdate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const createServices = authed.use(async ({ context, next }) => {
  const canCreate = await hasPermission(context.user, "create", "Service");

  if (!canCreate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const deleteServices = authed.use(async ({ context, next }) => {
  const canDelete = await hasPermission(context.user, "delete", "Service");

  if (!canDelete) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const RELEASE_ID_OFFSET = -1_000_000_000;
const WITHDRAW_ID_OFFSET = -2_000_000_000;

type TransactionSource = "release" | "settlement" | "withdraw";

function decodeUnifiedId(
  transactionId: number
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
  transactionSource?: TransactionSource
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
    .route({ method: "POST", path: "/" })
    .input(contractServiceCreateSchema)
    .output(detailResponseSchema)
    .handler(async ({ input }: { input: z.output<typeof contractServiceCreateSchema> }) => {
      const service = await createService(mapServicePayload(input));
      return {
        schedules: [],
        service: mapServiceSummary(service, {
          overdueCount: 0,
          pendingCount: 0,
          totalExpected: 0,
          totalPaid: 0,
        }),
        status: "ok" as const,
      };
    }),

  delete: deleteServices
    .route({ method: "DELETE", path: "/{id}" })
    .input(contractServiceIdSchema)
    .output(statusOkSchema)
    .handler(async ({ input }: { input: z.input<typeof contractServiceIdSchema> }) => {
      const existing = await getServiceByIdOrPublicId(input.id);

      if (!existing) {
        throw new ORPCError("NOT_FOUND", { message: "Not found" });
      }

      await deleteService(existing.id);
      return { status: "ok" as const };
    }),

  detail: readServices
    .route({ method: "GET", path: "/{id}" })
    .input(contractServiceIdSchema)
    .output(detailResponseSchema)
    .handler(async ({ input }: { input: z.output<typeof contractServiceIdSchema> }) => {
      const service = await getServiceByIdOrPublicId(input.id);

      if (!service) {
        throw new ORPCError("NOT_FOUND", { message: "Not found" });
      }

      const schedules = await db.serviceSchedule.findMany({
        where: { serviceId: service.id },
        orderBy: { periodStart: "asc" },
      });
      const mappedSchedules = schedules.map(mapServiceSchedule);

      return {
        schedules: mappedSchedules,
        service: mapServiceSummary(service, getServiceScheduleStats(mappedSchedules)),
        status: "ok" as const,
      };
    }),

  list: readServices
    .route({ method: "GET", path: "/" })
    .output(listResponseSchema)
    .handler(async () => {
      const services = await listServices();
      const serviceIds = services.map((service) => service.id);
      const schedules = serviceIds.length
        ? await db.serviceSchedule.findMany({
            where: { serviceId: { in: serviceIds } },
            orderBy: { periodStart: "asc" },
          })
        : [];

      const schedulesByServiceId = new Map<number, ServiceScheduleDto[]>();
      for (const schedule of schedules) {
        const mapped = mapServiceSchedule(schedule);
        const current = schedulesByServiceId.get(schedule.serviceId) ?? [];
        current.push(mapped);
        schedulesByServiceId.set(schedule.serviceId, current);
      }

      return {
        services: services.map((service) =>
          mapServiceSummary(
            service,
            getServiceScheduleStats(schedulesByServiceId.get(service.id) ?? [])
          )
        ),
        status: "ok" as const,
      };
    }),

  regenerateSchedules: updateServices
    .route({ method: "POST", path: "/{id}/schedules" })
    .input(generateSchedulesSchema)
    .output(generateSchedulesResponseSchema)
    .handler(async ({ input }: { input: z.output<typeof generateSchedulesSchema> }) => {
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
      const mappedSchedules = schedules.map(mapServiceSchedule);

      return {
        ...result,
        schedules: mappedSchedules,
        service: mapServiceSummary(service ?? existing, getServiceScheduleStats(mappedSchedules)),
        status: "ok" as const,
      };
    }),

  scheduleEdit: updateServices
    .route({ method: "PATCH", path: "/schedules/{id}" })
    .input(editScheduleSchema)
    .output(scheduleResponseSchema)
    .handler(async ({ input }: { input: z.output<typeof editScheduleSchema> }) => {
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
        schedule: mapServiceSchedule(updated),
        status: "ok" as const,
      };
    }),

  schedulePay: updateServices
    .route({ method: "POST", path: "/schedules/{id}/pay" })
    .input(payScheduleSchema)
    .output(scheduleResponseSchema)
    .handler(async ({ input }: { input: z.output<typeof payScheduleSchema> }) => {
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
        schedule: mapServiceSchedule(updated),
        status: "ok" as const,
      };
    }),

  scheduleSkip: updateServices
    .route({ method: "POST", path: "/schedules/{id}/skip" })
    .input(skipScheduleSchema)
    .output(scheduleResponseSchema)
    .handler(async ({ input }: { input: z.output<typeof skipScheduleSchema> }) => {
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
        schedule: mapServiceSchedule(updated),
        status: "ok" as const,
      };
    }),

  scheduleUnlink: updateServices
    .route({ method: "POST", path: "/schedules/{id}/unlink" })
    .input(contractScheduleIdSchema)
    .output(scheduleResponseSchema)
    .handler(async ({ input }: { input: z.output<typeof contractScheduleIdSchema> }) => {
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
        schedule: mapServiceSchedule(updated),
        status: "ok" as const,
      };
    }),

  syncAllTransactions: updateServices
    .route({ method: "POST", path: "/sync/transactions" })
    .output(syncResponseSchema)
    .handler(async () => ({
      data: await syncServiceSchedulesWithFinancialTransactions(),
      status: "ok" as const,
    })),

  syncTransactions: updateServices
    .route({ method: "POST", path: "/{id}/sync-transactions" })
    .input(contractServiceIdSchema)
    .output(syncResponseSchema)
    .handler(async ({ input }: { input: z.output<typeof contractServiceIdSchema> }) => {
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
    .route({ method: "PUT", path: "/{id}" })
    .input(z.object({ id: z.string().min(1), payload: contractServiceCreateSchema }))
    .output(detailResponseSchema)
    .handler(
      async ({
        input,
      }: {
        input: { id: string; payload: z.output<typeof contractServiceCreateSchema> };
      }) => {
        const existing = await getServiceByIdOrPublicId(input.id);

        if (!existing) {
          throw new ORPCError("NOT_FOUND", { message: "Not found" });
        }

        const service = await updateService(existing.id, mapServicePayload(input.payload));
        const schedules = await db.serviceSchedule.findMany({
          where: { serviceId: service.id },
          orderBy: { periodStart: "asc" },
        });
        const mappedSchedules = schedules.map(mapServiceSchedule);

        return {
          schedules: mappedSchedules,
          service: mapServiceSummary(service, getServiceScheduleStats(mappedSchedules)),
          status: "ok" as const,
        };
      }
    ),
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
