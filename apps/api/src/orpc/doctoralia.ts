import { db } from "@finanzas/db";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { z } from "zod";
import { getSessionUser, hasPermission } from "../auth";
import {
  bookSlot,
  cancelBooking,
  getBookings,
  getSlots,
} from "../lib/doctoralia/doctoralia-client";
import { isDoctoraliaConfigured } from "../lib/doctoralia/doctoralia-core";
import { logError, logEvent } from "../lib/logger";
import { configureSuperjson } from "../lib/superjson-config";
import {
  createDoctoraliaSyncLogEntry,
  finalizeDoctoraliaSyncLogEntry,
  getDoctoraliaDoctorsWithAddresses,
  getDoctoraliaFacilitiesWithCounts,
  listDoctoraliaSyncLogs,
} from "../services/doctoralia";
import { SuperJSONRPCHandler } from "./superjson";

configureSuperjson();

type DoctoraliaORPCContext = {
  hono: HonoContext;
};

const base = os.$context<DoctoraliaORPCContext>();

const facilityIdSchema = z.object({
  facilityId: z.number().int().positive(),
});

const slotsAndBookingsQuerySchema = z.object({
  addressId: z.string(),
  doctorId: z.string(),
  end: z.string(),
  facilityId: z.string(),
  start: z.string(),
});

const bookSlotInputSchema = z.object({
  addressId: z.string(),
  body: z.object({
    comment: z.string().optional(),
    duration: z.number().min(5).max(480),
    patient: z.object({
      birthDate: z.string().optional(),
      email: z.email(),
      gender: z.enum(["f", "m"]).optional(),
      name: z.string().min(1),
      nin: z.string().optional(),
      phone: z.string().min(8),
      surname: z.string().min(1),
    }),
    serviceId: z.string().optional(),
  }),
  doctorId: z.string(),
  facilityId: z.string(),
  slotStart: z.string(),
});

const cancelBookingInputSchema = z.object({
  addressId: z.string(),
  bookingId: z.string(),
  doctorId: z.string(),
  facilityId: z.string(),
  reason: z.string().optional(),
});

const calendarAppointmentsQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scheduleIds: z.array(z.number().int().positive()).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const syncInputSchema = z.object({});

const statusResponseSchema = z.object({
  configured: z.boolean(),
  domain: z.string(),
  status: z.literal("ok"),
});

const facilitiesResponseSchema = z.object({
  facilities: z.array(z.unknown()),
  status: z.literal("ok"),
});

const doctorsResponseSchema = z.object({
  doctors: z.array(z.unknown()),
  status: z.literal("ok"),
});

const slotsResponseSchema = z.object({
  slots: z.array(z.unknown()),
  status: z.literal("ok"),
});

const bookingsResponseSchema = z.object({
  bookings: z.array(z.unknown()),
  pagination: z.object({
    limit: z.number(),
    page: z.number(),
    pages: z.number(),
    total: z.number(),
  }),
  status: z.literal("ok"),
});

const bookingResponseSchema = z.object({
  booking: z.unknown(),
  status: z.literal("ok"),
});

const okStatusSchema = z.object({
  status: z.literal("ok"),
});

const syncLogsResponseSchema = z.object({
  logs: z.array(z.unknown()),
  status: z.literal("ok"),
});

const syncResponseSchema = z.object({
  logId: z.number().int(),
  message: z.string(),
  status: z.literal("accepted"),
});

const calendarAuthStatusSchema = z.object({
  data: z.object({
    connected: z.boolean(),
    expiresAt: z.date().nullable(),
  }),
  status: z.literal("ok"),
});

const calendarAppointmentsSchema = z.object({
  data: z.object({
    appointments: z.array(z.unknown()),
    count: z.number(),
    filters: z.object({
      from: z.string(),
      scheduleIds: z.array(z.number()),
      to: z.string(),
    }),
  }),
  status: z.literal("ok"),
});

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

const canReadFacility = authed.use(async ({ context, next }) => {
  const canRead = await hasPermission(context.user.id, "read", "DoctoraliaFacility");
  if (!canRead) {
    throw new ORPCError("FORBIDDEN", { message: "Sin permisos" });
  }
  return next();
});

const canReadDoctor = authed.use(async ({ context, next }) => {
  const canRead = await hasPermission(context.user.id, "read", "DoctoraliaDoctor");
  if (!canRead) {
    throw new ORPCError("FORBIDDEN", { message: "Sin permisos" });
  }
  return next();
});

const canManageFacility = authed.use(async ({ context, next }) => {
  const canUpdate = await hasPermission(context.user.id, "update", "DoctoraliaFacility");
  if (!canUpdate) {
    throw new ORPCError("FORBIDDEN", { message: "Sin permisos" });
  }
  return next();
});

const canCreateBooking = authed.use(async ({ context, next }) => {
  const canCreate = await hasPermission(context.user.id, "create", "DoctoraliaBooking");
  if (!canCreate) {
    throw new ORPCError("FORBIDDEN", { message: "Sin permisos" });
  }
  return next();
});

const canDeleteBooking = authed.use(async ({ context, next }) => {
  const canDelete = await hasPermission(context.user.id, "delete", "DoctoraliaBooking");
  if (!canDelete) {
    throw new ORPCError("FORBIDDEN", { message: "Sin permisos" });
  }
  return next();
});

const doctoraliaORPCRouterBase = {
  bookSlot: canCreateBooking
    .route({
      method: "POST",
      path: "/bookings",
      summary: "Book doctoralia slot",
      tags: ["Doctoralia"],
    })
    .input(bookSlotInputSchema)
    .output(bookingResponseSchema)
    .handler(async ({ input }) => {
      const booking = await bookSlot(
        input.facilityId,
        input.doctorId,
        input.addressId,
        input.slotStart,
        input.body,
      );

      return {
        booking,
        status: "ok",
      };
    }),

  calendarAppointments: canReadFacility
    .route({
      method: "GET",
      path: "/calendar/appointments",
      summary: "List doctoralia calendar appointments",
      tags: ["Doctoralia"],
    })
    .input(calendarAppointmentsQuerySchema)
    .output(calendarAppointmentsSchema)
    .handler(async ({ input }) => {
      const autoSyncEnabled = process.env.ENABLE_DOCTORALIA_CALENDAR_SYNC === "true";
      if (autoSyncEnabled) {
        const staleThresholdMs = Number(
          process.env.DOCTORALIA_CALENDAR_APPOINTMENTS_REFRESH_MS || "120000",
        );
        const { runDoctoraliaCalendarAutoSync } = await import(
          "../lib/doctoralia/doctoralia-calendar-scheduler.js"
        );
        const { getSetting } = await import("../services/settings.js");
        const lastSuccessAtRaw = await getSetting("doctoralia:calendar:lastSuccessAt");
        const lastSuccessAt = lastSuccessAtRaw ? new Date(lastSuccessAtRaw).getTime() : 0;
        const shouldRefresh =
          !Number.isFinite(lastSuccessAt) ||
          lastSuccessAt <= 0 ||
          Date.now() - lastSuccessAt > staleThresholdMs;

        if (shouldRefresh) {
          void runDoctoraliaCalendarAutoSync({
            trigger: "read-stale",
          });
        }
      }

      const fromDate = new Date(`${input.from}T00:00:00.000Z`);
      const toDateExclusive = new Date(`${input.to}T23:59:59.999Z`);

      const appointments = await db.doctoraliaCalendarAppointment.findMany({
        where: {
          ...(input.scheduleIds && input.scheduleIds.length > 0
            ? {
                schedule: {
                  externalId: {
                    in: input.scheduleIds,
                  },
                },
              }
            : {}),
          startAt: {
            gte: fromDate,
            lte: toDateExclusive,
          },
        },
        orderBy: [{ startAt: "asc" }],
        select: {
          comments: true,
          endAt: true,
          externalId: true,
          id: true,
          patientExternalId: true,
          schedule: {
            select: {
              displayName: true,
              externalId: true,
            },
          },
          serviceName: true,
          startAt: true,
          status: true,
          title: true,
        },
      });

      return {
        data: {
          appointments,
          count: appointments.length,
          filters: {
            from: input.from,
            scheduleIds: input.scheduleIds ?? [],
            to: input.to,
          },
        },
        status: "ok",
      };
    }),

  calendarAuthStatus: canManageFacility
    .route({
      method: "GET",
      path: "/calendar/auth/status",
      summary: "Doctoralia calendar auth status",
      tags: ["Doctoralia"],
    })
    .output(calendarAuthStatusSchema)
    .handler(async ({ context }) => {
      const { getCachedToken } = await import("../lib/doctoralia/doctoralia-calendar-auth.js");
      const cached = await getCachedToken();
      const storedExpiresAt = cached?.expiresAt;
      const expiresAtIso =
        typeof storedExpiresAt === "string" || storedExpiresAt instanceof Date
          ? new Date(storedExpiresAt).toISOString()
          : null;

      logEvent("doctoralia.calendar.oauth.status", {
        userId: context.user.id,
        connected: Boolean(cached),
        expiresAt: expiresAtIso,
      });

      return {
        data: {
          connected: Boolean(cached),
          expiresAt: expiresAtIso ? new Date(expiresAtIso) : null,
        },
        status: "ok",
      };
    }),

  cancelBooking: canDeleteBooking
    .route({
      method: "DELETE",
      path: "/bookings/{bookingId}",
      summary: "Cancel doctoralia booking",
      tags: ["Doctoralia"],
    })
    .input(cancelBookingInputSchema)
    .output(okStatusSchema)
    .handler(async ({ input }) => {
      await cancelBooking(
        input.facilityId,
        input.doctorId,
        input.addressId,
        input.bookingId,
        input.reason,
      );

      return { status: "ok" };
    }),

  doctors: canReadDoctor
    .route({
      method: "GET",
      path: "/facilities/{facilityId}/doctors",
      summary: "List doctoralia doctors",
      tags: ["Doctoralia"],
    })
    .input(facilityIdSchema)
    .output(doctorsResponseSchema)
    .handler(async ({ input }) => ({
      doctors: await getDoctoraliaDoctorsWithAddresses(input.facilityId),
      status: "ok",
    })),

  facilities: canReadFacility
    .route({
      method: "GET",
      path: "/facilities",
      summary: "List doctoralia facilities",
      tags: ["Doctoralia"],
    })
    .output(facilitiesResponseSchema)
    .handler(async () => ({
      facilities: await getDoctoraliaFacilitiesWithCounts(),
      status: "ok",
    })),

  bookings: canReadFacility
    .route({
      method: "GET",
      path: "/bookings",
      summary: "List doctoralia bookings",
      tags: ["Doctoralia"],
    })
    .input(slotsAndBookingsQuerySchema)
    .output(bookingsResponseSchema)
    .handler(async ({ input }) => {
      const data = await getBookings(
        input.facilityId,
        input.doctorId,
        input.addressId,
        input.start,
        input.end,
        {
          withPatient: true,
        },
      );

      return {
        bookings: data._items,
        pagination: {
          limit: data.limit,
          page: data.page,
          pages: data.pages,
          total: data.total,
        },
        status: "ok",
      };
    }),

  slots: canReadFacility
    .route({
      method: "GET",
      path: "/slots",
      summary: "List doctoralia slots",
      tags: ["Doctoralia"],
    })
    .input(slotsAndBookingsQuerySchema)
    .output(slotsResponseSchema)
    .handler(async ({ input }) => ({
      slots: (
        await getSlots(input.facilityId, input.doctorId, input.addressId, input.start, input.end)
      )._items,
      status: "ok",
    })),

  status: authed
    .route({
      method: "GET",
      path: "/status",
      summary: "Doctoralia status",
      tags: ["Doctoralia"],
    })
    .output(statusResponseSchema)
    .handler(async () => ({
      configured: isDoctoraliaConfigured(),
      domain: "doctoralia.cl",
      status: "ok",
    })),

  sync: canManageFacility
    .route({
      method: "POST",
      path: "/sync",
      summary: "Trigger doctoralia sync",
      tags: ["Doctoralia"],
    })
    .input(syncInputSchema)
    .output(syncResponseSchema)
    .handler(async ({ context }) => {
      const logId = await createDoctoraliaSyncLogEntry({
        triggerSource: "manual",
        triggerUserId: context.user.id,
      });

      await finalizeDoctoraliaSyncLogEntry(logId, {
        status: "SUCCESS",
        facilitiesSynced: 0,
        doctorsSynced: 0,
        slotsSynced: 0,
        bookingsSynced: 0,
      });

      return {
        logId,
        message: "Sincronización iniciada",
        status: "accepted",
      };
    }),

  syncLogs: authed
    .route({
      method: "GET",
      path: "/sync/logs",
      summary: "Doctoralia sync logs",
      tags: ["Doctoralia"],
    })
    .output(syncLogsResponseSchema)
    .handler(async () => ({
      logs: (await listDoctoraliaSyncLogs(50)).map((log) => ({
        id: log.id,
        triggerSource: log.triggerSource,
        triggerUserId: log.triggerUserId,
        status: log.status,
        startedAt: log.startedAt,
        endedAt: log.endedAt,
        facilitiesSynced: log.facilitiesSynced,
        doctorsSynced: log.doctorsSynced,
        slotsSynced: log.slotsSynced,
        bookingsSynced: log.bookingsSynced,
        errorMessage: log.errorMessage,
      })),
      status: "ok",
    })),
};

export const doctoraliaORPCRouter = base
  .router(doctoraliaORPCRouterBase)
  .prefix("/api/orpc/doctoralia");

export const doctoraliaORPCHandler = new SuperJSONRPCHandler(doctoraliaORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "orpc.doctoralia",
      });
    }),
  ],
});

export const doctoraliaOpenAPIHandler = new OpenAPIHandler(doctoraliaORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Doctoralia oRPC",
          description: "Contratos oRPC/OpenAPI para catálogo, reservas y sync de Doctoralia.",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "openapi.doctoralia",
      });
    }),
  ],
});
