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
  bookedAt: string;
  bookedBy: string;
  canceledAt?: string;
  canceledBy?: string;
  comment?: string;
  duration: number;
  endAt: string;
  id: string;
  patient?: DoctoraliaPatient;
  startAt: string;
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
  createdAt: string;
  doctorCount: number;
  externalId: string;
  id: number;
  name: string;
  updatedAt: string;
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
  end?: string;
  services?: { id: string; name: string }[];
  start: string;
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

export interface DoctoraliaSyncLog {
  bookingsSynced: number;
  doctorsSynced: number;
  endedAt: null | string;
  errorMessage: null | string;
  facilitiesSynced: number;
  id: number;
  slotsSynced: number;
  startedAt: string;
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
