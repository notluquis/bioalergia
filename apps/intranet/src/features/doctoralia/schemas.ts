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
      }),
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
