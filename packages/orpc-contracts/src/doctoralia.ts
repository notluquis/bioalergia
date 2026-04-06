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

export const emailNotificationsCalendarQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const emailNotificationsListQuerySchema = z.object({
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
});

export const emailNotificationSchema = z.strictObject({
  appointmentDate: z.coerce.date().nullable(),
  appointmentDoctor: z.string().nullable(),
  appointmentService: z.string().nullable(),
  clinicAddress: z.string().nullable(),
  createdAt: z.coerce.date(),
  emailMessageId: z.string(),
  eventType: z.enum(["BOOKING", "MODIFICATION", "CANCELLATION"]),
  id: z.string(),
  isFirstAppointment: z.boolean(),
  patientEmail: z.string().nullable(),
  patientName: z.string(),
  patientPhone: z.string().nullable(),
  previousAppointmentDate: z.coerce.date().nullable(),
  updatedAt: z.coerce.date(),
});

export const emailNotificationsCalendarResponseSchema = z.object({
  data: z.object({
    count: z.number(),
    notifications: z.array(emailNotificationSchema),
  }),
  status: z.literal("ok"),
});

export const doctoraliaImapListenerStateSchema = z.enum([
  "stopped",
  "missing_config",
  "connecting",
  "connected",
  "error",
]);

export const doctoraliaImapListenerSchema = z.object({
  enabled: z.boolean(),
  host: z.string().nullable(),
  lastConnectedAt: z.coerce.date().nullable(),
  lastErrorAt: z.coerce.date().nullable(),
  lastErrorMessage: z.string().nullable(),
  lastProcessedAt: z.coerce.date().nullable(),
  lastStartedAt: z.coerce.date().nullable(),
  mailbox: z.string().nullable(),
  reconnectDelayMs: z.number().int().nullable(),
  state: doctoraliaImapListenerStateSchema,
  user: z.string().nullable(),
});

export const emailNotificationsOverviewResponseSchema = z.object({
  data: z.object({
    imapHostConfigured: z.boolean(),
    imapMailbox: z.string(),
    imapPassConfigured: z.boolean(),
    imapReady: z.boolean(),
    imapUserConfigured: z.boolean(),
    listener: doctoraliaImapListenerSchema,
    senderFilter: z.string(),
  }),
  status: z.literal("ok"),
});

export const emailNotificationsListResponseSchema = z.object({
  data: z.object({
    notifications: z.array(emailNotificationSchema),
    total: z.number(),
  }),
  status: z.literal("ok"),
});

export const emailNotificationsStatsResponseSchema = z.object({
  data: z.object({
    bookings: z.number(),
    cancellations: z.number(),
    firstAppointments: z.number(),
    modifications: z.number(),
    total: z.number(),
    withPhone: z.number(),
  }),
  status: z.literal("ok"),
});

export const emailNotificationsIngestResponseSchema = z.object({
  data: z.object({
    alreadyProcessed: z.number(),
    checked: z.number(),
    failed: z.number(),
    saved: z.number(),
    skipped: z.number(),
  }),
  message: z.string(),
  status: z.enum(["ok", "error"]),
});

export const emailNotificationsPatientsQuerySchema = z.object({
  search: z.string().optional(),
});

export const emailPatientSchema = z.strictObject({
  lastAppointmentDate: z.coerce.date().nullable(),
  patientEmail: z.string().nullable(),
  patientName: z.string(),
  patientPhone: z.string().nullable(),
  totalBookings: z.number(),
});

export const emailNotificationsPatientsResponseSchema = z.object({
  data: z.object({
    patients: z.array(emailPatientSchema),
    total: z.number(),
  }),
  status: z.literal("ok"),
});

export const emailNotificationsPatientHistoryQuerySchema = z.object({
  patientName: z.string(),
  patientPhone: z.string().nullable().optional(),
});

export const emailNotificationsPatientHistoryResponseSchema = z.object({
  data: z.object({
    notifications: z.array(emailNotificationSchema),
  }),
  status: z.literal("ok"),
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
  emailNotificationsCalendar: oc
    .route({ method: "GET", path: "/email-notifications/calendar" })
    .input(emailNotificationsCalendarQuerySchema)
    .output(emailNotificationsCalendarResponseSchema),
  emailNotificationsOverview: oc
    .route({ method: "GET", path: "/email-notifications/overview" })
    .output(emailNotificationsOverviewResponseSchema),
  emailNotificationsList: oc
    .route({ method: "GET", path: "/email-notifications" })
    .input(emailNotificationsListQuerySchema)
    .output(emailNotificationsListResponseSchema),
  emailNotificationsStats: oc
    .route({ method: "GET", path: "/email-notifications/stats" })
    .output(emailNotificationsStatsResponseSchema),
  emailNotificationsPatients: oc
    .route({ method: "GET", path: "/email-notifications/patients" })
    .input(emailNotificationsPatientsQuerySchema)
    .output(emailNotificationsPatientsResponseSchema),
  emailNotificationsPatientHistory: oc
    .route({ method: "GET", path: "/email-notifications/patients/history" })
    .input(emailNotificationsPatientHistoryQuerySchema)
    .output(emailNotificationsPatientHistoryResponseSchema),
  emailNotificationsIngest: oc
    .route({ method: "POST", path: "/email-notifications/ingest" })
    .input(z.object({}))
    .output(emailNotificationsIngestResponseSchema),
  status: oc.route({ method: "GET", path: "/status" }).output(statusResponseSchema),
  sync: oc.route({ method: "POST", path: "/sync" }).input(syncInputSchema).output(syncResponseSchema),
  syncLogs: oc.route({ method: "GET", path: "/sync/logs" }).output(syncLogsResponseSchema),
};

export type DoctoraliaContract = typeof doctoraliaContract;
