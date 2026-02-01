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
  bookedAt: z.string(),
  bookedBy: z.string(),
  canceledAt: z.string().optional(),
  canceledBy: z.string().optional(),
  comment: z.string().optional(),
  duration: z.number(),
  endAt: z.string(),
  id: z.string(),
  patient: DoctoraliaPatientSchema.optional(),
  startAt: z.string(),
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
  createdAt: z.string(),
  doctorCount: z.number(),
  externalId: z.string(),
  id: z.number(),
  name: z.string(),
  updatedAt: z.string(),
});

export const DoctoraliaSlotSchema = z.strictObject({
  end: z.string().optional(),
  services: z
    .array(
      z.strictObject({
        id: z.string(),
        name: z.string(),
      }),
    )
    .optional(),
  start: z.string(),
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

export const DoctoraliaSyncLogSchema = z.strictObject({
  bookingsSynced: z.number(),
  doctorsSynced: z.number(),
  endedAt: z.string().nullable(),
  errorMessage: z.string().nullable(),
  facilitiesSynced: z.number(),
  id: z.number(),
  slotsSynced: z.number(),
  startedAt: z.string(),
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
