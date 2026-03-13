import { oc } from "@orpc/contract";
import { z } from "zod";

export const facilityIdSchema = z.object({
  facilityId: z.number().int().positive(),
});

export const slotsAndBookingsQuerySchema = z.object({
  addressId: z.string(),
  doctorId: z.string(),
  end: z.string(),
  facilityId: z.string(),
  start: z.string(),
});

export const bookSlotInputSchema = z.object({
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

export const cancelBookingInputSchema = z.object({
  addressId: z.string(),
  bookingId: z.string(),
  doctorId: z.string(),
  facilityId: z.string(),
  reason: z.string().optional(),
});

export const calendarAppointmentsQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scheduleIds: z.array(z.number().int().positive()).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const syncInputSchema = z.object({});

export const doctoraliaAddressSchema = z.strictObject({
  bookingCount: z.number(),
  cityName: z.string().nullable(),
  externalId: z.string(),
  id: z.number(),
  name: z.string().nullable(),
  onlineOnly: z.boolean(),
  serviceCount: z.number(),
  street: z.string().nullable(),
});

export const doctoraliaPatientSchema = z.strictObject({
  birthDate: z.string().optional(),
  email: z.string(),
  gender: z.enum(["f", "m"]).optional(),
  name: z.string(),
  nin: z.string().optional(),
  phone: z.string(),
  surname: z.string(),
});

export const doctoraliaBookingSchema = z.strictObject({
  bookedAt: z.coerce.date(),
  bookedBy: z.string(),
  canceledAt: z.coerce.date().optional(),
  canceledBy: z.string().optional(),
  comment: z.string().optional(),
  duration: z.number(),
  endAt: z.coerce.date(),
  id: z.string(),
  patient: doctoraliaPatientSchema.optional(),
  startAt: z.coerce.date(),
  status: z.enum(["booked", "canceled"]),
});

export const doctoraliaDoctorSchema = z.strictObject({
  addresses: z.array(doctoraliaAddressSchema),
  externalId: z.string(),
  fullName: z.string(),
  id: z.number(),
  name: z.string(),
  profileUrl: z.string().optional(),
  surname: z.string(),
});

export const doctoraliaFacilitySchema = z.strictObject({
  createdAt: z.coerce.date(),
  doctorCount: z.number(),
  externalId: z.string(),
  id: z.number(),
  name: z.string(),
  updatedAt: z.coerce.date(),
});

export const doctoraliaSlotSchema = z.strictObject({
  end: z.coerce.date().optional(),
  services: z
    .array(
      z.strictObject({
        id: z.string(),
        name: z.string(),
      }),
    )
    .optional(),
  start: z.coerce.date(),
});

export const statusResponseSchema = z.object({
  configured: z.boolean(),
  domain: z.string(),
  status: z.literal("ok"),
});

export const facilitiesResponseSchema = z.object({
  facilities: z.array(doctoraliaFacilitySchema),
  status: z.literal("ok"),
});

export const doctorsResponseSchema = z.object({
  doctors: z.array(doctoraliaDoctorSchema),
  status: z.literal("ok"),
});

export const slotsResponseSchema = z.object({
  slots: z.array(doctoraliaSlotSchema),
  status: z.literal("ok"),
});

export const bookingsResponseSchema = z.object({
  bookings: z.array(doctoraliaBookingSchema),
  pagination: z.object({
    limit: z.number(),
    page: z.number(),
    pages: z.number(),
    total: z.number(),
  }),
  status: z.literal("ok"),
});

export const bookingResponseSchema = z.object({
  booking: doctoraliaBookingSchema,
  status: z.literal("ok"),
});

export const okStatusSchema = z.object({
  status: z.literal("ok"),
});

export const syncLogsResponseSchema = z.object({
  logs: z.array(
    z.strictObject({
      bookingsSynced: z.number(),
      doctorsSynced: z.number(),
      endedAt: z.coerce.date().nullable(),
      errorMessage: z.string().nullable(),
      facilitiesSynced: z.number(),
      id: z.number(),
      slotsSynced: z.number(),
      startedAt: z.coerce.date(),
      status: z.string(),
      triggerSource: z.string().nullable(),
      triggerUserId: z.number().nullable(),
    }),
  ),
  status: z.literal("ok"),
});

export const syncResponseSchema = z.object({
  logId: z.number().int(),
  message: z.string(),
  status: z.literal("accepted"),
});

export const calendarAuthStatusSchema = z.object({
  data: z.object({
    connected: z.boolean(),
    expiresAt: z.coerce.date().nullable(),
  }),
  status: z.literal("ok"),
});

export const calendarAppointmentsSchema = z.object({
  data: z.object({
    appointments: z.array(
      z.strictObject({
        comments: z.string().nullable(),
        endAt: z.coerce.date(),
        externalId: z.number(),
        id: z.number(),
        patientExternalId: z.number(),
        schedule: z.strictObject({
          displayName: z.string(),
          externalId: z.number(),
        }),
        serviceName: z.string(),
        startAt: z.coerce.date(),
        status: z.number(),
        title: z.string(),
      }),
    ),
    count: z.number(),
    filters: z.object({
      from: z.string(),
      scheduleIds: z.array(z.number()),
      to: z.string(),
    }),
  }),
  status: z.literal("ok"),
});

export const doctoraliaContract = {
  bookSlot: oc.route({ method: "POST", path: "/bookings" }).input(bookSlotInputSchema).output(bookingResponseSchema),
  calendarAppointments: oc
    .route({ method: "GET", path: "/calendar/appointments" })
    .input(calendarAppointmentsQuerySchema)
    .output(calendarAppointmentsSchema),
  calendarAuthStatus: oc.route({ method: "GET", path: "/calendar/auth/status" }).output(calendarAuthStatusSchema),
  cancelBooking: oc
    .route({ method: "DELETE", path: "/bookings/{bookingId}" })
    .input(cancelBookingInputSchema)
    .output(okStatusSchema),
  doctors: oc
    .route({ method: "GET", path: "/facilities/{facilityId}/doctors" })
    .input(facilityIdSchema)
    .output(doctorsResponseSchema),
  facilities: oc.route({ method: "GET", path: "/facilities" }).output(facilitiesResponseSchema),
  bookings: oc.route({ method: "GET", path: "/bookings" }).input(slotsAndBookingsQuerySchema).output(bookingsResponseSchema),
  slots: oc.route({ method: "GET", path: "/slots" }).input(slotsAndBookingsQuerySchema).output(slotsResponseSchema),
  status: oc.route({ method: "GET", path: "/status" }).output(statusResponseSchema),
  sync: oc.route({ method: "POST", path: "/sync" }).input(syncInputSchema).output(syncResponseSchema),
  syncLogs: oc.route({ method: "GET", path: "/sync/logs" }).output(syncLogsResponseSchema),
};

export type DoctoraliaContract = typeof doctoraliaContract;
