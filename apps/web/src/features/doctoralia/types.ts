/**
 * Doctoralia Frontend Types
 *
 * TypeScript interfaces for Doctoralia data (camelCase for frontend).
 */

import { z } from "zod";

// ============================================================
// ENTITIES
// ============================================================

export interface DoctoraliaFacility {
  id: number;
  externalId: string;
  name: string;
  doctorCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DoctoraliaDoctor {
  id: number;
  externalId: string;
  name: string;
  surname: string;
  fullName: string;
  profileUrl?: string;
  addresses: DoctoraliaAddress[];
}

export interface DoctoraliaAddress {
  id: number;
  externalId: string;
  name: string | null;
  cityName: string | null;
  street: string | null;
  onlineOnly: boolean;
  bookingCount: number;
  serviceCount: number;
}

export interface DoctoraliaSlot {
  start: string;
  end?: string;
  services?: Array<{ id: string; name: string }>;
}

export interface DoctoraliaBooking {
  id: string;
  status: "booked" | "canceled";
  startAt: string;
  endAt: string;
  duration: number;
  bookedBy: string;
  bookedAt: string;
  canceledBy?: string;
  canceledAt?: string;
  comment?: string;
  patient?: DoctoraliaPatient;
}

export interface DoctoraliaPatient {
  name: string;
  surname: string;
  email: string;
  phone: string;
  birthDate?: string;
  nin?: string;
  gender?: "m" | "f";
}

export interface DoctoraliaSyncLog {
  id: number;
  triggerSource: string | null;
  triggerUserId: number | null;
  status: string;
  startedAt: string;
  endedAt: string | null;
  facilitiesSynced: number;
  doctorsSynced: number;
  slotsSynced: number;
  bookingsSynced: number;
  errorMessage: string | null;
}

// ============================================================
// API RESPONSE TYPES
// ============================================================

export interface DoctoraliaStatusResponse {
  status: "ok";
  configured: boolean;
  domain: string;
}

export interface DoctoraliaFacilitiesResponse {
  status: "ok";
  facilities: DoctoraliaFacility[];
}

export interface DoctoraliaDoctorsResponse {
  status: "ok";
  doctors: DoctoraliaDoctor[];
}

export interface DoctoraliaSlotsResponse {
  status: "ok";
  slots: DoctoraliaSlot[];
}

export interface DoctoraliaBookingsResponse {
  status: "ok";
  bookings: DoctoraliaBooking[];
  pagination: {
    page: number;
    limit: number;
    pages: number;
    total: number;
  };
}

export interface DoctoraliaSyncLogsResponse {
  status: "ok";
  logs: DoctoraliaSyncLog[];
}

// ============================================================
// BOOKING PAYLOAD
// ============================================================

export const bookSlotSchema = z.object({
  duration: z.number().min(5).max(480),
  comment: z.string().optional(),
  patient: z.object({
    name: z.string().min(1),
    surname: z.string().min(1),
    email: z.email(),
    phone: z.string().min(8),
    birthDate: z.string().optional(),
    nin: z.string().optional(),
    gender: z.enum(["m", "f"]).optional(),
  }),
  serviceId: z.string().optional(),
});

export type BookSlotPayload = z.infer<typeof bookSlotSchema>;

// ============================================================
// QUERY PARAMS
// ============================================================

export interface DoctoraliaSlotQuery {
  facilityId: string;
  doctorId: string;
  addressId: string;
  start: string;
  end: string;
}

export interface DoctoraliaBookingQuery extends DoctoraliaSlotQuery {}
