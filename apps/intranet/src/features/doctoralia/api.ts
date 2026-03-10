/**
 * Doctoralia API Client
 *
 * Frontend API functions for Doctoralia integration.
 */

import { apiClient } from "@/lib/api-client";
import { doctoraliaORPCClient, toDoctoraliaApiError } from "./orpc";
import {
  BookingResponseSchema,
  DoctoraliaBookingsResponseSchema,
  DoctoraliaCalendarAppointmentsResponseSchema,
  DoctoraliaCalendarAuthStartResponseSchema,
  DoctoraliaCalendarAuthStatusResponseSchema,
  DoctoraliaDoctorsResponseSchema,
  DoctoraliaFacilitiesResponseSchema,
  DoctoraliaSlotsResponseSchema,
  DoctoraliaStatusResponseSchema,
  DoctoraliaSyncLogsResponseSchema,
  DoctoraliaSyncResponseSchema,
  StatusOkSchema,
} from "./schemas";
import type {
  BookSlotPayload,
  DoctoraliaBooking,
  DoctoraliaBookingQuery,
  DoctoraliaBookingsResponse,
  DoctoraliaCalendarAppointment,
  DoctoraliaCalendarAppointmentsQuery,
  DoctoraliaCalendarAppointmentsResponse,
  DoctoraliaCalendarAuthStartResponse,
  DoctoraliaCalendarAuthStatusResponse,
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

export async function bookDoctoraliaSlot(
  facilityId: string,
  doctorId: string,
  addressId: string,
  slotStart: string,
  payload: BookSlotPayload,
): Promise<DoctoraliaBooking> {
  let response: { booking: DoctoraliaBooking; status: "ok" };
  try {
    response = BookingResponseSchema.parse(
      await doctoraliaORPCClient.bookSlot({
        facilityId,
        doctorId,
        addressId,
        slotStart,
        body: payload,
      }),
    );
  } catch (error) {
    throw toDoctoraliaApiError(error);
  }

  if (response.status !== "ok") {
    throw new Error("No se pudo crear la reserva");
  }

  return response.booking;
}

export async function cancelDoctoraliaBooking(
  facilityId: string,
  doctorId: string,
  addressId: string,
  bookingId: string,
  reason?: string,
): Promise<void> {
  try {
    StatusOkSchema.parse(
      await doctoraliaORPCClient.cancelBooking({
        facilityId,
        doctorId,
        addressId,
        bookingId,
        reason,
      }),
    );
  } catch (error) {
    throw toDoctoraliaApiError(error);
  }
}

export async function fetchDoctoraliaBookings(query: DoctoraliaBookingQuery): Promise<{
  bookings: DoctoraliaBooking[];
  pagination: { limit: number; page: number; pages: number; total: number };
}> {
  const { addressId, doctorId, end, facilityId, start } = query;
  let response: DoctoraliaBookingsResponse;
  try {
    response = DoctoraliaBookingsResponseSchema.parse(
      await doctoraliaORPCClient.bookings({
        addressId,
        doctorId,
        end,
        facilityId,
        start,
      }),
    );
  } catch (error) {
    throw toDoctoraliaApiError(error);
  }

  if (response.status !== "ok") {
    throw new Error("No se pudo obtener las reservas");
  }

  return {
    bookings: response.bookings,
    pagination: response.pagination,
  };
}

export async function fetchDoctoraliaDoctors(facilityId: number): Promise<DoctoraliaDoctor[]> {
  let response: DoctoraliaDoctorsResponse;
  try {
    response = DoctoraliaDoctorsResponseSchema.parse(
      await doctoraliaORPCClient.doctors({ facilityId }),
    );
  } catch (error) {
    throw toDoctoraliaApiError(error);
  }

  if (response.status !== "ok") {
    throw new Error("No se pudo obtener los doctores");
  }

  return response.doctors;
}

export async function fetchDoctoraliaFacilities(): Promise<DoctoraliaFacility[]> {
  let response: DoctoraliaFacilitiesResponse;
  try {
    response = DoctoraliaFacilitiesResponseSchema.parse(await doctoraliaORPCClient.facilities());
  } catch (error) {
    throw toDoctoraliaApiError(error);
  }

  if (response.status !== "ok") {
    throw new Error("No se pudo obtener las instalaciones");
  }

  return response.facilities;
}

export async function fetchDoctoraliaSlots(query: DoctoraliaSlotQuery): Promise<DoctoraliaSlot[]> {
  const { addressId, doctorId, end, facilityId, start } = query;
  let response: DoctoraliaSlotsResponse;
  try {
    response = DoctoraliaSlotsResponseSchema.parse(
      await doctoraliaORPCClient.slots({
        addressId,
        doctorId,
        end,
        facilityId,
        start,
      }),
    );
  } catch (error) {
    throw toDoctoraliaApiError(error);
  }

  if (response.status !== "ok") {
    throw new Error("No se pudo obtener los slots disponibles");
  }

  return response.slots;
}

export async function fetchDoctoraliaStatus(): Promise<{
  configured: boolean;
  domain: string;
}> {
  let response: DoctoraliaStatusResponse;
  try {
    response = DoctoraliaStatusResponseSchema.parse(await doctoraliaORPCClient.status());
  } catch (error) {
    throw toDoctoraliaApiError(error);
  }

  if (response.status !== "ok") {
    throw new Error("No se pudo obtener el estado de Doctoralia");
  }

  return {
    configured: response.configured,
    domain: response.domain,
  };
}

export async function fetchDoctoraliaCalendarAppointments(
  query: DoctoraliaCalendarAppointmentsQuery,
): Promise<DoctoraliaCalendarAppointment[]> {
  let response: DoctoraliaCalendarAppointmentsResponse;
  try {
    response = DoctoraliaCalendarAppointmentsResponseSchema.parse(
      await doctoraliaORPCClient.calendarAppointments({
        from: query.from,
        to: query.to,
        scheduleIds: query.scheduleIds?.length ? query.scheduleIds : undefined,
      }),
    );
  } catch (error) {
    throw toDoctoraliaApiError(error);
  }

  if (response.status !== "ok") {
    throw new Error("No se pudo obtener las citas de Doctoralia");
  }

  return response.data.appointments;
}

export async function fetchDoctoraliaSyncLogs(): Promise<DoctoraliaSyncLog[]> {
  let response: DoctoraliaSyncLogsResponse;
  try {
    response = DoctoraliaSyncLogsResponseSchema.parse(await doctoraliaORPCClient.syncLogs());
  } catch (error) {
    throw toDoctoraliaApiError(error);
  }

  if (response.status !== "ok") {
    throw new Error("No se pudo obtener los logs de sincronización");
  }

  return response.logs;
}

export async function triggerDoctoraliaSync(): Promise<{ logId: number }> {
  let response: {
    logId: number;
    message: string;
    status: "accepted";
  };
  try {
    response = DoctoraliaSyncResponseSchema.parse(await doctoraliaORPCClient.sync({}));
  } catch (error) {
    throw toDoctoraliaApiError(error);
  }

  if (response.status !== "accepted") {
    throw new Error("No se pudo iniciar la sincronización");
  }

  return { logId: response.logId };
}

export async function fetchDoctoraliaCalendarAuthStatus(): Promise<{
  connected: boolean;
  expiresAt: Date | null;
}> {
  let response: DoctoraliaCalendarAuthStatusResponse;
  try {
    response = DoctoraliaCalendarAuthStatusResponseSchema.parse(
      await doctoraliaORPCClient.calendarAuthStatus(),
    );
  } catch (error) {
    throw toDoctoraliaApiError(error);
  }

  if (response.status !== "ok") {
    throw new Error("No se pudo obtener el estado de conexión de Doctoralia");
  }

  return response.data;
}

export async function startDoctoraliaCalendarOAuth(): Promise<{
  authUrl: string;
  redirectUri: string;
}> {
  const response = await apiClient.get<DoctoraliaCalendarAuthStartResponse>(
    "/api/doctoralia/calendar/auth/start",
    { responseSchema: DoctoraliaCalendarAuthStartResponseSchema },
  );

  if (response.status !== "ok") {
    throw new Error("No se pudo iniciar OAuth de Doctoralia");
  }

  return response.data;
}
