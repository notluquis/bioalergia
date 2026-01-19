/**
 * Doctoralia API Client
 *
 * Frontend API functions for Doctoralia integration.
 */

import { apiClient } from "@/lib/api-client";

import type {
  BookSlotPayload,
  DoctoraliaBooking,
  DoctoraliaBookingQuery,
  DoctoraliaBookingsResponse,
  DoctoraliaDoctor,
  DoctoraliaDoctorsResponse,
  DoctoraliaFacilitiesResponse,
  DoctoraliaFacility,
  DoctoraliaSlot,
  DoctoraliaSlotQuery,
  DoctoraliaSlotsResponse,
  DoctoraliaStatusResponse,
  DoctoraliaSyncLog,
  DoctoraliaSyncLogsResponse,
} from "./types";

// ============================================================
// STATUS
// ============================================================

export async function bookDoctoraliaSlot(
  facilityId: string,
  doctorId: string,
  addressId: string,
  slotStart: string,
  payload: BookSlotPayload
): Promise<DoctoraliaBooking> {
  const response = await apiClient.post<{ booking: DoctoraliaBooking; status: "ok" }>(
    `/api/doctoralia/facilities/${facilityId}/doctors/${doctorId}/addresses/${addressId}/slots/${encodeURIComponent(slotStart)}/book`,
    { json: payload }
  );

  if (response.status !== "ok") {
    throw new Error("No se pudo crear la reserva");
  }

  return response.booking;
}

// ============================================================
// FACILITIES
// ============================================================

export async function cancelDoctoraliaBooking(
  facilityId: string,
  doctorId: string,
  addressId: string,
  bookingId: string,
  reason?: string
): Promise<void> {
  const baseUrl = `/api/doctoralia/facilities/${facilityId}/doctors/${doctorId}/addresses/${addressId}/bookings/${bookingId}`;
  const url = reason ? `${baseUrl}?reason=${encodeURIComponent(reason)}` : baseUrl;
  await apiClient.delete(url);
}

// ============================================================
// DOCTORS
// ============================================================

export async function fetchDoctoraliaBookings(query: DoctoraliaBookingQuery): Promise<{
  bookings: DoctoraliaBooking[];
  pagination: { limit: number; page: number; pages: number; total: number };
}> {
  const { addressId, doctorId, end, facilityId, start } = query;
  const response = await apiClient.get<DoctoraliaBookingsResponse>(
    `/api/doctoralia/facilities/${facilityId}/doctors/${doctorId}/addresses/${addressId}/bookings`,
    { query: { end, start } }
  );

  if (response.status !== "ok") {
    throw new Error("No se pudo obtener las reservas");
  }

  return {
    bookings: response.bookings,
    pagination: response.pagination,
  };
}

// ============================================================
// SLOTS
// ============================================================

export async function fetchDoctoraliaDoctors(facilityId: number): Promise<DoctoraliaDoctor[]> {
  const response = await apiClient.get<DoctoraliaDoctorsResponse>(`/api/doctoralia/facilities/${facilityId}/doctors`);

  if (response.status !== "ok") {
    throw new Error("No se pudo obtener los doctores");
  }

  return response.doctors;
}

// ============================================================
// BOOKINGS
// ============================================================

export async function fetchDoctoraliaFacilities(): Promise<DoctoraliaFacility[]> {
  const response = await apiClient.get<DoctoraliaFacilitiesResponse>("/api/doctoralia/facilities");

  if (response.status !== "ok") {
    throw new Error("No se pudo obtener las instalaciones");
  }

  return response.facilities;
}

export async function fetchDoctoraliaSlots(query: DoctoraliaSlotQuery): Promise<DoctoraliaSlot[]> {
  const { addressId, doctorId, end, facilityId, start } = query;
  const response = await apiClient.get<DoctoraliaSlotsResponse>(
    `/api/doctoralia/facilities/${facilityId}/doctors/${doctorId}/addresses/${addressId}/slots`,
    { query: { end, start } }
  );

  if (response.status !== "ok") {
    throw new Error("No se pudo obtener los slots disponibles");
  }

  return response.slots;
}

export async function fetchDoctoraliaStatus(): Promise<{
  configured: boolean;
  domain: string;
}> {
  const response = await apiClient.get<DoctoraliaStatusResponse>("/api/doctoralia/status");

  if (response.status !== "ok") {
    throw new Error("No se pudo obtener el estado de Doctoralia");
  }

  return {
    configured: response.configured,
    domain: response.domain,
  };
}

// ============================================================
// SYNC
// ============================================================

export async function fetchDoctoraliaSyncLogs(): Promise<DoctoraliaSyncLog[]> {
  const response = await apiClient.get<DoctoraliaSyncLogsResponse>("/api/doctoralia/sync/logs");

  if (response.status !== "ok") {
    throw new Error("No se pudo obtener los logs de sincronización");
  }

  return response.logs;
}

export async function triggerDoctoraliaSync(): Promise<{ logId: number }> {
  const response = await apiClient.post<{
    logId: number;
    message: string;
    status: "accepted";
  }>("/api/doctoralia/sync", {});

  if (response.status !== "accepted") {
    throw new Error("No se pudo iniciar la sincronización");
  }

  return { logId: response.logId };
}
