import { createHmac, timingSafeEqual } from "node:crypto";
import { type Context, Hono } from "hono";
import { z } from "zod";
import { getSessionUser, hasPermission } from "../auth.js";
import {
  bookSlot,
  cancelBooking,
  getBookings,
  getSlots,
} from "../lib/doctoralia/doctoralia-client.js";
import { isDoctoraliaConfigured } from "../lib/doctoralia/doctoralia-core.js";
import { zValidator } from "../lib/zod-validator";
import {
  createDoctoraliaSyncLogEntry,
  finalizeDoctoraliaSyncLogEntry,
  getDoctoraliaDoctorsWithAddresses,
  getDoctoraliaFacilitiesWithCounts,
  listDoctoraliaSyncLogs,
} from "../services/doctoralia.js";
import { reply } from "../utils/reply.js";

export const doctoraliaRoutes = new Hono();

type DoctoraliaWebhookPayload = {
  name?: string;
  data?: {
    booking?: { id?: unknown };
    break?: { id?: unknown };
  };
};

// ============================================================
// SCHEMAS
// ============================================================

const facilityParamSchema = z.object({
  facilityId: z.string().regex(/^\d+$/).transform(Number),
});

const slotsParamSchema = z.object({
  facilityId: z.string(),
  doctorId: z.string(),
  addressId: z.string(),
});

const slotsQuerySchema = z.object({
  start: z.string(),
  end: z.string(),
});

const bookSlotParamSchema = z.object({
  facilityId: z.string(),
  doctorId: z.string(),
  addressId: z.string(),
  slotStart: z.string(),
});

const cancelBookingParamSchema = z.object({
  facilityId: z.string(),
  doctorId: z.string(),
  addressId: z.string(),
  bookingId: z.string(),
});

const cancelBookingBodySchema = z.object({
  reason: z.string().optional(),
});

// ============================================================
// MIDDLEWARE
// ============================================================

async function requireAuth(c: Context, next: () => Promise<void>) {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "No autorizado" }, 401);
  }
  c.set("user", user);
  return next();
}

function timingSafeCompare(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return timingSafeEqual(aBuffer, bBuffer);
}

// ============================================================
// STATUS
// ============================================================

doctoraliaRoutes.get("/status", requireAuth, async (c) => {
  const configured = isDoctoraliaConfigured();

  return reply(c, {
    status: "ok",
    configured,
    domain: "doctoralia.cl",
  });
});

// ============================================================
// FACILITIES (from DB cache)
// ============================================================

doctoraliaRoutes.get("/facilities", requireAuth, async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "No autorizado" }, 401);
  }

  const canRead = await hasPermission(user.id, "read", "DoctoraliaFacility");
  if (!canRead) {
    return reply(c, { status: "error", message: "Sin permisos" }, 403);
  }

  const facilities = await getDoctoraliaFacilitiesWithCounts();
  return reply(c, { status: "ok", facilities });
});

// ============================================================
// DOCTORS (from DB cache)
// ============================================================

doctoraliaRoutes.get(
  "/facilities/:facilityId/doctors",
  requireAuth,
  zValidator("param", facilityParamSchema),
  async (c) => {
    const user = await getSessionUser(c);
    if (!user) {
      return reply(c, { status: "error", message: "No autorizado" }, 401);
    }

    const canRead = await hasPermission(user.id, "read", "DoctoraliaDoctor");
    if (!canRead) {
      return reply(c, { status: "error", message: "Sin permisos" }, 403);
    }

    const { facilityId } = c.req.valid("param");

    const doctors = await getDoctoraliaDoctorsWithAddresses(facilityId);
    return reply(c, { status: "ok", doctors });
  },
);

// ============================================================
// SLOTS (from API)
// ============================================================

doctoraliaRoutes.get(
  "/facilities/:facilityId/doctors/:doctorId/addresses/:addressId/slots",
  requireAuth,
  zValidator("param", slotsParamSchema),
  zValidator("query", slotsQuerySchema),
  async (c) => {
    const { facilityId, doctorId, addressId } = c.req.valid("param");
    const { start, end } = c.req.valid("query");

    try {
      const data = await getSlots(facilityId, doctorId, addressId, start, end);
      return reply(c, { status: "ok", slots: data._items });
    } catch (error) {
      console.error("[Doctoralia] getSlots error:", error);
      return reply(c, { status: "error", message: "Error al obtener slots" }, 500);
    }
  },
);

// ============================================================
// BOOKINGS (from API)
// ============================================================

doctoraliaRoutes.get(
  "/facilities/:facilityId/doctors/:doctorId/addresses/:addressId/bookings",
  requireAuth,
  zValidator("param", slotsParamSchema),
  zValidator("query", slotsQuerySchema),
  async (c) => {
    const { facilityId, doctorId, addressId } = c.req.valid("param");
    const { start, end } = c.req.valid("query");

    try {
      const data = await getBookings(facilityId, doctorId, addressId, start, end, {
        withPatient: true,
      });
      return reply(c, {
        status: "ok",
        bookings: data._items,
        pagination: {
          page: data.page,
          limit: data.limit,
          pages: data.pages,
          total: data.total,
        },
      });
    } catch (error) {
      console.error("[Doctoralia] getBookings error:", error);
      return reply(c, { status: "error", message: "Error al obtener reservas" }, 500);
    }
  },
);

// ============================================================
// BOOK SLOT
// ============================================================

doctoraliaRoutes.post(
  "/facilities/:facilityId/doctors/:doctorId/addresses/:addressId/slots/:slotStart/book",
  requireAuth,
  zValidator("param", bookSlotParamSchema),
  async (c) => {
    const user = await getSessionUser(c);
    if (!user) {
      return reply(c, { status: "error", message: "No autorizado" }, 401);
    }

    const canCreate = await hasPermission(user.id, "create", "DoctoraliaBooking");
    if (!canCreate) {
      return reply(c, { status: "error", message: "Sin permisos" }, 403);
    }

    const { facilityId, doctorId, addressId, slotStart } = c.req.valid("param");
    const body = await c.req.json(); // Book slot body structure varies, keep loose or define strict if known

    try {
      const booking = await bookSlot(facilityId, doctorId, addressId, slotStart, body);
      return reply(c, { status: "ok", booking }, 201);
    } catch (error) {
      console.error("[Doctoralia] bookSlot error:", error);
      return reply(c, { status: "error", message: "Error al crear reserva" }, 500);
    }
  },
);

// ============================================================
// CANCEL BOOKING
// ============================================================

doctoraliaRoutes.delete(
  "/facilities/:facilityId/doctors/:doctorId/addresses/:addressId/bookings/:bookingId",
  requireAuth,
  zValidator("param", cancelBookingParamSchema),
  zValidator("json", cancelBookingBodySchema),
  async (c) => {
    const user = await getSessionUser(c);
    if (!user) {
      return reply(c, { status: "error", message: "No autorizado" }, 401);
    }

    const canDelete = await hasPermission(user.id, "delete", "DoctoraliaBooking");
    if (!canDelete) {
      return reply(c, { status: "error", message: "Sin permisos" }, 403);
    }

    const { facilityId, doctorId, addressId, bookingId } = c.req.valid("param");
    const body = c.req.valid("json");

    try {
      await cancelBooking(facilityId, doctorId, addressId, bookingId, body.reason);
      return reply(c, { status: "ok" }, 200);
    } catch (error) {
      console.error("[Doctoralia] cancelBooking error:", error);
      return reply(c, { status: "error", message: "Error al cancelar reserva" }, 500);
    }
  },
);

// ============================================================
// SYNC LOGS
// ============================================================

doctoraliaRoutes.get("/sync/logs", requireAuth, async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "No autorizado" }, 401);
  }

  const logs = await listDoctoraliaSyncLogs(50);
  return reply(c, {
    status: "ok",
    logs: logs.map((log) => ({
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
  });
});

// ============================================================
// MANUAL SYNC
// ============================================================

doctoraliaRoutes.post("/sync", requireAuth, async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "No autorizado" }, 401);
  }

  const canSync = await hasPermission(user.id, "update", "DoctoraliaFacility");
  if (!canSync) {
    return reply(c, { status: "error", message: "Sin permisos" }, 403);
  }

  try {
    const logId = await createDoctoraliaSyncLogEntry({
      triggerSource: "manual",
      triggerUserId: user.id,
    });

    // TODO: Implement full sync logic
    // This would call the API, upsert all entities, etc.
    // For now, just mark as success placeholder

    await finalizeDoctoraliaSyncLogEntry(logId, {
      status: "SUCCESS",
      facilitiesSynced: 0,
      doctorsSynced: 0,
      slotsSynced: 0,
      bookingsSynced: 0,
    });

    return reply(
      c,
      {
        status: "accepted",
        message: "Sincronización iniciada",
        logId,
      },
      202,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return reply(c, { status: "error", message }, 500);
  }
});

// ============================================================
// CALENDAR SYNC
// ============================================================

const calendarSyncSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scheduleIds: z.array(z.number()).optional(),
});

const doctoraliaCalendarAppointmentsQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scheduleId: z
    .union([z.array(z.coerce.number().int().positive()), z.coerce.number().int().positive()])
    .optional()
    .transform((value) => (value == null ? [] : Array.isArray(value) ? value : [value])),
});

const calendarAlertsQuerySchema = z.object({
  alertType: z.coerce.number().int().positive().optional().default(3),
});

const calendarAlertsSyncSchema = z.object({
  alertType: z.number().int().positive().optional().default(3),
});

doctoraliaRoutes.get("/calendar/status", requireAuth, async (c) => {
  const { isCalendarAuthConfigured } = await import(
    "../lib/doctoralia/doctoralia-calendar-auth.js"
  );
  const configured = isCalendarAuthConfigured();

  return reply(c, {
    status: "ok",
    data: {
      configured,
      message: configured
        ? "Calendar authentication configured"
        : "DOCTORALIA_CALENDAR_USERNAME and DOCTORALIA_CALENDAR_PASSWORD required",
    },
  });
});

doctoraliaRoutes.post(
  "/calendar/sync",
  requireAuth,
  zValidator("json", calendarSyncSchema),
  async (c) => {
    const user = await getSessionUser(c);
    if (!user) {
      return reply(c, { status: "error", message: "No autorizado" }, 401);
    }

    const canSync = await hasPermission(user.id, "update", "DoctoraliaFacility");
    if (!canSync) {
      return reply(c, { status: "error", message: "Sin permisos" }, 403);
    }

    const body = c.req.valid("json");

    try {
      const { doctoraliaCalendarSyncService } = await import("../services/doctoralia-calendar.js");
      const result = await doctoraliaCalendarSyncService.syncCalendar(
        body.from,
        body.to,
        body.scheduleIds,
        "manual",
        user.id,
      );

      return reply(c, {
        status: "ok",
        data: result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      console.error("[DoctoraliaCalendar] Sync error:", error);
      return reply(c, { status: "error", message }, 500);
    }
  },
);

doctoraliaRoutes.get(
  "/calendar/appointments",
  requireAuth,
  zValidator("query", doctoraliaCalendarAppointmentsQuerySchema),
  async (c) => {
    const user = await getSessionUser(c);
    if (!user) {
      return reply(c, { status: "error", message: "No autorizado" }, 401);
    }

    const canRead = await hasPermission(user.id, "read", "DoctoraliaFacility");
    if (!canRead) {
      return reply(c, { status: "error", message: "Sin permisos" }, 403);
    }

    const { from, scheduleId, to } = c.req.valid("query");

    try {
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

      const { db } = await import("@finanzas/db");
      const fromDate = new Date(`${from}T00:00:00.000Z`);
      const toDateExclusive = new Date(`${to}T23:59:59.999Z`);

      const appointments = await db.DoctoraliaCalendarAppointment.findMany({
        where: {
          ...(scheduleId.length > 0
            ? {
                schedule: {
                  externalId: {
                    in: scheduleId,
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
          id: true,
          externalId: true,
          title: true,
          startAt: true,
          endAt: true,
          status: true,
          comments: true,
          serviceName: true,
          patientExternalId: true,
          schedule: {
            select: {
              externalId: true,
              displayName: true,
            },
          },
        },
      });

      return reply(c, {
        status: "ok",
        data: {
          appointments,
          count: appointments.length,
          filters: {
            from,
            to,
            scheduleIds: scheduleId,
          },
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      console.error("[DoctoraliaCalendar] List appointments error:", error);
      return reply(c, { status: "error", message }, 500);
    }
  },
);

doctoraliaRoutes.get(
  "/calendar/alerts",
  requireAuth,
  zValidator("query", calendarAlertsQuerySchema),
  async (c) => {
    const user = await getSessionUser(c);
    if (!user) {
      return reply(c, { status: "error", message: "No autorizado" }, 401);
    }

    const canRead = await hasPermission(user.id, "read", "DoctoraliaFacility");
    if (!canRead) {
      return reply(c, { status: "error", message: "Sin permisos" }, 403);
    }

    try {
      const { alertType } = c.req.valid("query");
      const { doctoraliaCalendarSyncService } = await import("../services/doctoralia-calendar.js");
      const alerts = await doctoraliaCalendarSyncService.getAlerts(alertType);

      return reply(c, {
        status: "ok",
        data: {
          alertType,
          count: alerts.length,
          alerts,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      console.error("[DoctoraliaCalendar] Alerts fetch error:", error);
      return reply(c, { status: "error", message }, 500);
    }
  },
);

doctoraliaRoutes.post(
  "/calendar/alerts/sync",
  requireAuth,
  zValidator("json", calendarAlertsSyncSchema),
  async (c) => {
    const user = await getSessionUser(c);
    if (!user) {
      return reply(c, { status: "error", message: "No autorizado" }, 401);
    }

    const canSync = await hasPermission(user.id, "update", "DoctoraliaFacility");
    if (!canSync) {
      return reply(c, { status: "error", message: "Sin permisos" }, 403);
    }

    const { alertType } = c.req.valid("json");

    try {
      const { doctoraliaCalendarSyncService } = await import("../services/doctoralia-calendar.js");
      const result = await doctoraliaCalendarSyncService.syncFromAlerts(
        alertType,
        "manual-alerts",
        user.id,
      );

      return reply(c, {
        status: "ok",
        data: result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      console.error("[DoctoraliaCalendar] Alerts sync error:", error);
      return reply(c, { status: "error", message }, 500);
    }
  },
);

doctoraliaRoutes.get("/calendar/schedules", requireAuth, async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "No autorizado" }, 401);
  }

  try {
    const { db } = await import("@finanzas/db");
    const schedules = await db.DoctoraliaSchedule.findMany({
      select: {
        id: true,
        externalId: true,
        name: true,
        displayName: true,
        scheduleType: true,
        isVirtual: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { displayName: "asc" },
    });

    return reply(c, {
      status: "ok",
      data: {
        schedules,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    console.error("[DoctoraliaCalendar] List schedules error:", error);
    return reply(c, { status: "error", message }, 500);
  }
});

// ============================================================
// WEBHOOK (No Auth - for Doctoralia push notifications)
// ============================================================

doctoraliaRoutes.post("/webhook", async (c) => {
  const rawBody = await c.req.text();
  let body: DoctoraliaWebhookPayload;
  try {
    body = rawBody ? (JSON.parse(rawBody) as DoctoraliaWebhookPayload) : {};
  } catch {
    return c.json({ status: "error", message: "Payload inválido" }, 400);
  }

  // Log the notification
  console.log("[Doctoralia Webhook]", body.name, JSON.stringify(body.data));

  // TODO: Verify webhook signature if DOCTORALIA_WEBHOOK_SECRET is set
  const secret = process.env.DOCTORALIA_WEBHOOK_SECRET;
  if (secret) {
    const signatureHeader = c.req.header("x-doctoralia-signature");
    if (!signatureHeader) {
      return c.json({ status: "error", message: "Firma requerida" }, 401);
    }

    const signature = signatureHeader.includes("=")
      ? signatureHeader.slice(signatureHeader.indexOf("=") + 1)
      : signatureHeader;

    const hmacHex = createHmac("sha256", secret).update(rawBody).digest("hex");
    const hmacBase64 = createHmac("sha256", secret).update(rawBody).digest("base64");

    const signatureMatches = [hmacHex, hmacBase64].some((candidate) =>
      timingSafeCompare(signature, candidate),
    );

    if (!signatureMatches) {
      return c.json({ status: "error", message: "Firma inválida" }, 401);
    }
  }

  // Handle different notification types
  switch (body.name) {
    case "slot-booking":
    case "slot-booked": {
      // New booking created
      console.log("[Doctoralia Webhook] New booking:", body.data?.booking?.id);
      // TODO: Fetch and store the booking
      break;
    }
    case "booking-canceled": {
      // Booking was canceled
      console.log("[Doctoralia Webhook] Booking canceled:", body.data?.booking?.id);
      // TODO: Update booking status in DB
      break;
    }
    case "booking-moved": {
      // Booking was rescheduled
      console.log("[Doctoralia Webhook] Booking moved:", body.data?.booking?.id);
      // TODO: Update booking in DB
      break;
    }
    case "break-created": {
      // Calendar break created
      console.log("[Doctoralia Webhook] Break created:", body.data?.break?.id);
      // TODO: Store break in DB
      break;
    }
    case "break-removed": {
      // Calendar break removed
      console.log("[Doctoralia Webhook] Break removed:", body.data?.break?.id);
      // TODO: Remove break from DB
      break;
    }
    default:
      console.log("[Doctoralia Webhook] Unknown event:", body.name);
  }

  return c.json({ received: true }, 200);
});
