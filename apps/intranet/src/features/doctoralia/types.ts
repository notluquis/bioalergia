/**
 * Doctoralia Frontend Types
 *
 * TypeScript interfaces for Doctoralia data (camelCase for frontend).
 */

import { z } from "zod";

// ============================================================
// ENTITIES
// ============================================================

export interface DoctoraliaAddress {
  bookingCount: number;
  cityName: null | string;
  externalId: string;
  id: number;
  name: null | string;
  onlineOnly: boolean;
  serviceCount: number;
  street: null | string;
}

export interface DoctoraliaBooking {
  bookedAt: Date;
  bookedBy: string;
  canceledAt?: Date;
  canceledBy?: string;
  comment?: string;
  duration: number;
  endAt: Date;
  id: string;
  patient?: DoctoraliaPatient;
  startAt: Date;
  status: "booked" | "canceled";
}

export interface DoctoraliaBookingsResponse {
  bookings: DoctoraliaBooking[];
  pagination: {
    limit: number;
    page: number;
    pages: number;
    total: number;
  };
  status: "ok";
}

export interface DoctoraliaDoctor {
  addresses: DoctoraliaAddress[];
  externalId: string;
  fullName: string;
  id: number;
  name: string;
  profileUrl?: string;
  surname: string;
}

export interface DoctoraliaDoctorsResponse {
  doctors: DoctoraliaDoctor[];
  status: "ok";
}

export interface DoctoraliaFacilitiesResponse {
  facilities: DoctoraliaFacility[];
  status: "ok";
}

export interface DoctoraliaFacility {
  createdAt: Date;
  doctorCount: number;
  externalId: string;
  id: number;
  name: string;
  updatedAt: Date;
}

// ============================================================
// API RESPONSE TYPES
// ============================================================

export interface DoctoraliaPatient {
  birthDate?: string;
  email: string;
  gender?: "f" | "m";
  name: string;
  nin?: string;
  phone: string;
  surname: string;
}

export interface DoctoraliaSlot {
  end?: Date;
  services?: { id: string; name: string }[];
  start: Date;
}

export interface DoctoraliaSlotsResponse {
  slots: DoctoraliaSlot[];
  status: "ok";
}

export interface DoctoraliaStatusResponse {
  configured: boolean;
  domain: string;
  status: "ok";
}

export interface DoctoraliaCalendarAppointment {
  comments: null | string;
  endAt: Date;
  externalId: number;
  id: number;
  patientExternalId: number;
  schedule: {
    displayName: string;
    externalId: number;
  };
  serviceName: string;
  startAt: Date;
  status: number;
  title: string;
}

export interface DoctoraliaCalendarAppointmentsResponse {
  data: {
    appointments: DoctoraliaCalendarAppointment[];
    count: number;
    filters: {
      from: string;
      scheduleIds: number[];
      to: string;
    };
  };
  status: "ok";
}

export interface DoctoraliaSyncLog {
  bookingsSynced: number;
  doctorsSynced: number;
  endedAt: null | Date;
  errorMessage: null | string;
  facilitiesSynced: number;
  id: number;
  slotsSynced: number;
  startedAt: Date;
  status: string;
  triggerSource: null | string;
  triggerUserId: null | number;
}

export interface DoctoraliaSyncLogsResponse {
  logs: DoctoraliaSyncLog[];
  status: "ok";
}

// ============================================================
// BOOKING PAYLOAD
// ============================================================

export const bookSlotSchema = z.object({
  comment: z.string().optional(),
  duration: z.number().min(5).max(480),
  patient: z.object({
    birthDate: z.string().optional(),
    email: z.email(),
    gender: z.enum(["m", "f"]).optional(),
    name: z.string().min(1),
    nin: z.string().optional(),
    phone: z.string().min(8),
    surname: z.string().min(1),
  }),
  serviceId: z.string().optional(),
});

export type BookSlotPayload = z.infer<typeof bookSlotSchema>;

// ============================================================
// QUERY PARAMS
// ============================================================

export interface DoctoraliaBookingQuery extends DoctoraliaSlotQuery {}

export interface DoctoraliaSlotQuery {
  addressId: string;
  doctorId: string;
  end: string;
  facilityId: string;
  start: string;
}

export interface DoctoraliaCalendarAppointmentsQuery {
  from: string;
  scheduleIds?: number[];
  to: string;
}

export interface DoctoraliaCalendarAuthStartResponse {
  data: {
    authUrl: string;
    redirectUri: string;
  };
  status: "ok";
}

export interface DoctoraliaCalendarAuthStatusResponse {
  data: {
    connected: boolean;
    expiresAt: Date | null;
  };
  status: "ok";
}
