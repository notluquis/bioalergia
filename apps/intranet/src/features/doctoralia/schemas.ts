import { z } from "zod";

export const DoctoraliaAddressSchema = z.strictObject({
  bookingCount: z.number(),
  cityName: z.string().nullable(),
  externalId: z.string(),
  id: z.number(),
  name: z.string().nullable(),
  onlineOnly: z.boolean(),
  serviceCount: z.number(),
  street: z.string().nullable(),
});

export const DoctoraliaPatientSchema = z.strictObject({
  birthDate: z.string().optional(),
  email: z.string(),
  gender: z.enum(["f", "m"]).optional(),
  name: z.string(),
  nin: z.string().optional(),
  phone: z.string(),
  surname: z.string(),
});

export const DoctoraliaBookingSchema = z.strictObject({
  bookedAt: z.coerce.date(),
  bookedBy: z.string(),
  canceledAt: z.coerce.date().optional(),
  canceledBy: z.string().optional(),
  comment: z.string().optional(),
  duration: z.number(),
  endAt: z.coerce.date(),
  id: z.string(),
  patient: DoctoraliaPatientSchema.optional(),
  startAt: z.coerce.date(),
  status: z.enum(["booked", "canceled"]),
});

export const DoctoraliaDoctorSchema = z.strictObject({
  addresses: z.array(DoctoraliaAddressSchema),
  externalId: z.string(),
  fullName: z.string(),
  id: z.number(),
  name: z.string(),
  profileUrl: z.string().optional(),
  surname: z.string(),
});

export const DoctoraliaFacilitySchema = z.strictObject({
  createdAt: z.coerce.date(),
  doctorCount: z.number(),
  externalId: z.string(),
  id: z.number(),
  name: z.string(),
  updatedAt: z.coerce.date(),
});

export const DoctoraliaSlotSchema = z.strictObject({
  end: z.coerce.date().optional(),
  services: z
    .array(
      z.strictObject({
        id: z.string(),
        name: z.string(),
      })
    )
    .optional(),
  start: z.coerce.date(),
});

export const DoctoraliaBookingsResponseSchema = z.strictObject({
  bookings: z.array(DoctoraliaBookingSchema),
  pagination: z.strictObject({
    limit: z.number(),
    page: z.number(),
    pages: z.number(),
    total: z.number(),
  }),
  status: z.literal("ok"),
});

export const DoctoraliaDoctorsResponseSchema = z.strictObject({
  doctors: z.array(DoctoraliaDoctorSchema),
  status: z.literal("ok"),
});

export const DoctoraliaFacilitiesResponseSchema = z.strictObject({
  facilities: z.array(DoctoraliaFacilitySchema),
  status: z.literal("ok"),
});

export const DoctoraliaSlotsResponseSchema = z.strictObject({
  slots: z.array(DoctoraliaSlotSchema),
  status: z.literal("ok"),
});

export const DoctoraliaStatusResponseSchema = z.strictObject({
  configured: z.boolean(),
  domain: z.string(),
  status: z.literal("ok"),
});

export const DoctoraliaCalendarAppointmentSchema = z.strictObject({
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
});

export const DoctoraliaCalendarAppointmentsResponseSchema = z.strictObject({
  data: z.strictObject({
    appointments: z.array(DoctoraliaCalendarAppointmentSchema),
    count: z.number(),
    filters: z.strictObject({
      from: z.string(),
      scheduleIds: z.array(z.number()),
      to: z.string(),
    }),
  }),
  status: z.literal("ok"),
});

export const DoctoraliaSyncLogSchema = z.strictObject({
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
});

export const DoctoraliaSyncLogsResponseSchema = z.strictObject({
  logs: z.array(DoctoraliaSyncLogSchema),
  status: z.literal("ok"),
});

export const DoctoraliaSyncResponseSchema = z.strictObject({
  logId: z.number(),
  message: z.string(),
  status: z.literal("accepted"),
});

export const BookingResponseSchema = z.strictObject({
  booking: DoctoraliaBookingSchema,
  status: z.literal("ok"),
});

export const StatusOkSchema = z.strictObject({ status: z.literal("ok") });

export const DoctoraliaEmailNotificationSchema = z.strictObject({
  appointmentDate: z.coerce.date().nullable(),
  appointmentDoctor: z.string().nullable(),
  appointmentService: z.string().nullable(),
  clinicAddress: z.string().nullable(),
  createdAt: z.coerce.date(),
  emailMessageId: z.string(),
  eventType: z.enum(["BOOKING", "MODIFICATION", "CANCELLATION"]),
  id: z.string(),
  patientEmail: z.string().nullable(),
  patientName: z.string(),
  patientPhone: z.string().nullable(),
  previousAppointmentDate: z.coerce.date().nullable(),
  updatedAt: z.coerce.date(),
});

export const DoctoraliaEmailNotificationsCalendarResponseSchema = z.strictObject({
  data: z.strictObject({
    count: z.number(),
    notifications: z.array(DoctoraliaEmailNotificationSchema),
  }),
  status: z.literal("ok"),
});

export const DoctoraliaEmailOverviewResponseSchema = z.strictObject({
  data: z.strictObject({
    imapHostConfigured: z.boolean(),
    imapMailbox: z.string(),
    imapPassConfigured: z.boolean(),
    imapReady: z.boolean(),
    imapUserConfigured: z.boolean(),
    listener: z.strictObject({
      enabled: z.boolean(),
      host: z.string().nullable(),
      lastConnectedAt: z.coerce.date().nullable(),
      lastErrorAt: z.coerce.date().nullable(),
      lastErrorMessage: z.string().nullable(),
      lastProcessedAt: z.coerce.date().nullable(),
      lastStartedAt: z.coerce.date().nullable(),
      mailbox: z.string().nullable(),
      reconnectDelayMs: z.number().nullable(),
      state: z.enum(["stopped", "missing_config", "connecting", "connected", "error"]),
      user: z.string().nullable(),
    }),
    senderFilter: z.string(),
  }),
  status: z.literal("ok"),
});

export const DoctoraliaEmailNotificationsListResponseSchema = z.strictObject({
  data: z.strictObject({
    notifications: z.array(DoctoraliaEmailNotificationSchema),
    total: z.number(),
  }),
  status: z.literal("ok"),
});

export const DoctoraliaEmailStatsResponseSchema = z.strictObject({
  data: z.strictObject({
    bookings: z.number(),
    cancellations: z.number(),
    modifications: z.number(),
    total: z.number(),
    withPhone: z.number(),
  }),
  status: z.literal("ok"),
});

export const DoctoraliaEmailIngestResponseSchema = z.strictObject({
  data: z.strictObject({
    alreadyProcessed: z.number(),
    checked: z.number(),
    failed: z.number(),
    saved: z.number(),
    skipped: z.number(),
  }),
  message: z.string(),
  status: z.enum(["ok", "error"]),
});

export const DoctoraliaEmailPatientSchema = z.strictObject({
  lastAppointmentDate: z.coerce.date().nullable(),
  patientEmail: z.string().nullable(),
  patientName: z.string(),
  patientPhone: z.string().nullable(),
  totalBookings: z.number(),
});

export const DoctoraliaEmailPatientsResponseSchema = z.strictObject({
  data: z.strictObject({
    patients: z.array(DoctoraliaEmailPatientSchema),
    total: z.number(),
  }),
  status: z.literal("ok"),
});

export const DoctoraliaEmailPatientHistoryResponseSchema = z.strictObject({
  data: z.strictObject({
    notifications: z.array(DoctoraliaEmailNotificationSchema),
  }),
  status: z.literal("ok"),
});

export const DoctoraliaCalendarAuthStartResponseSchema = z.strictObject({
  data: z.strictObject({
    authUrl: z.url(),
    redirectUri: z.url(),
  }),
  status: z.literal("ok"),
});

export const DoctoraliaCalendarAuthStatusResponseSchema = z.strictObject({
  data: z.strictObject({
    connected: z.boolean(),
    expiresAt: z.coerce.date().nullable(),
  }),
  status: z.literal("ok"),
});

export const DoctoraliaScraperCookiesStatusResponseSchema = z.strictObject({
  data: z.strictObject({
    exists: z.boolean(),
    label: z.string().nullable(),
    count: z.number().int(),
    updatedAt: z.coerce.date().nullable(),
    lastUsedAt: z.coerce.date().nullable(),
    updatedByUserId: z.number().int().nullable(),
    updatedByEmail: z.string().nullable(),
  }),
  status: z.literal("ok"),
});

export const DoctoraliaUpdateScraperCookiesResponseSchema = z.strictObject({
  data: z.strictObject({
    label: z.string(),
    count: z.number().int(),
    updatedAt: z.coerce.date(),
  }),
  status: z.literal("ok"),
});
