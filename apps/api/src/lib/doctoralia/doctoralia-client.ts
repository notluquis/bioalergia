/**
 * Doctoralia API Client
 *
 * HTTP client for Doctoralia Integrations API v1.8.1.
 * Follows the hierarchical resource structure:
 * Facility → Doctor → Address → [Slots, Bookings, Breaks, Services]
 */

import { request, type GaxiosResponse } from "gaxios";
import { getAccessToken, getDoctoraliaDomain } from "./doctoralia-core.js";
import type {
  DoctoraliaFacility,
  DoctoraliaDoctor,
  DoctoraliaAddress,
  DoctoraliaService,
  DoctoraliaSlot,
  DoctoraliaBooking,
  DoctoraliaCalendarBreak,
  DoctoraliaInsuranceProvider,
  PaginatedResponse,
  BookSlotPayload,
  CreateBreakPayload,
  ReplaceSlotByDatePayload,
} from "./doctoralia-types.js";

const BASE_URL = `https://www.${getDoctoraliaDomain()}/api/v3/integration`;

/**
 * Make authenticated API request
 */
async function apiRequest<T>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  data?: unknown,
): Promise<T> {
  const token = await getAccessToken();

  const response: GaxiosResponse<T> = await request({
    url: `${BASE_URL}${path}`,
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.docplanner+json; charset=UTF-8",
      "Content-Type": "application/json",
    },
    data,
  });

  return response.data;
}

// ============================================================
// FACILITIES
// ============================================================

export async function getFacilities(): Promise<{
  _items: DoctoraliaFacility[];
}> {
  return apiRequest("GET", "/facilities");
}

export async function getFacility(
  facilityId: string,
): Promise<DoctoraliaFacility> {
  return apiRequest("GET", `/facilities/${facilityId}`);
}

// ============================================================
// DOCTORS
// ============================================================

export async function getDoctors(
  facilityId: string,
): Promise<{ _items: DoctoraliaDoctor[] }> {
  return apiRequest("GET", `/facilities/${facilityId}/doctors`);
}

export async function getDoctor(
  facilityId: string,
  doctorId: string,
): Promise<DoctoraliaDoctor> {
  return apiRequest("GET", `/facilities/${facilityId}/doctors/${doctorId}`);
}

// ============================================================
// ADDRESSES
// ============================================================

export async function getAddresses(
  facilityId: string,
  doctorId: string,
): Promise<{ _items: DoctoraliaAddress[] }> {
  return apiRequest(
    "GET",
    `/facilities/${facilityId}/doctors/${doctorId}/addresses`,
  );
}

export async function getAddress(
  facilityId: string,
  doctorId: string,
  addressId: string,
): Promise<DoctoraliaAddress> {
  return apiRequest(
    "GET",
    `/facilities/${facilityId}/doctors/${doctorId}/addresses/${addressId}`,
  );
}

// ============================================================
// SERVICES
// ============================================================

export async function getServices(
  facilityId: string,
  doctorId: string,
  addressId: string,
): Promise<{ _items: DoctoraliaService[] }> {
  return apiRequest(
    "GET",
    `/facilities/${facilityId}/doctors/${doctorId}/addresses/${addressId}/services`,
  );
}

// ============================================================
// INSURANCE PROVIDERS
// ============================================================

export async function getInsuranceProviders(
  facilityId: string,
  doctorId: string,
  addressId: string,
): Promise<{ _items: DoctoraliaInsuranceProvider[] }> {
  return apiRequest(
    "GET",
    `/facilities/${facilityId}/doctors/${doctorId}/addresses/${addressId}/insurances`,
  );
}

// ============================================================
// CALENDAR STATUS
// ============================================================

export async function getCalendarStatus(
  facilityId: string,
  doctorId: string,
  addressId: string,
): Promise<{ status: string }> {
  return apiRequest(
    "GET",
    `/facilities/${facilityId}/doctors/${doctorId}/addresses/${addressId}/calendar`,
  );
}

// ============================================================
// SLOTS
// ============================================================

export async function getSlots(
  facilityId: string,
  doctorId: string,
  addressId: string,
  start: string,
  end: string,
): Promise<{ _items: DoctoraliaSlot[] }> {
  const params = new URLSearchParams({ start, end });
  return apiRequest(
    "GET",
    `/facilities/${facilityId}/doctors/${doctorId}/addresses/${addressId}/slots?${params}`,
  );
}

export async function replaceSlots(
  facilityId: string,
  doctorId: string,
  addressId: string,
  slots: ReplaceSlotByDatePayload[],
): Promise<void> {
  await apiRequest(
    "PUT",
    `/facilities/${facilityId}/doctors/${doctorId}/addresses/${addressId}/slots`,
    { slots },
  );
}

export async function deleteSlotsByDate(
  facilityId: string,
  doctorId: string,
  addressId: string,
  date: string,
): Promise<void> {
  await apiRequest(
    "DELETE",
    `/facilities/${facilityId}/doctors/${doctorId}/addresses/${addressId}/slots/${date}`,
  );
}

// ============================================================
// BOOKINGS
// ============================================================

export async function getBookings(
  facilityId: string,
  doctorId: string,
  addressId: string,
  start: string,
  end: string,
  options?: { withPatient?: boolean; modifiedSince?: string },
): Promise<PaginatedResponse<DoctoraliaBooking>> {
  const params = new URLSearchParams({ start, end });

  if (options?.withPatient) {
    params.append("with[]", "booking.patient");
  }
  if (options?.modifiedSince) {
    params.append("modifiedSince", options.modifiedSince);
  }

  return apiRequest(
    "GET",
    `/facilities/${facilityId}/doctors/${doctorId}/addresses/${addressId}/bookings?${params}`,
  );
}

export async function getBooking(
  facilityId: string,
  doctorId: string,
  addressId: string,
  bookingId: string,
): Promise<DoctoraliaBooking> {
  return apiRequest(
    "GET",
    `/facilities/${facilityId}/doctors/${doctorId}/addresses/${addressId}/bookings/${bookingId}`,
  );
}

export async function bookSlot(
  facilityId: string,
  doctorId: string,
  addressId: string,
  slotStart: string,
  payload: BookSlotPayload,
): Promise<DoctoraliaBooking> {
  return apiRequest(
    "POST",
    `/facilities/${facilityId}/doctors/${doctorId}/addresses/${addressId}/slots/${encodeURIComponent(slotStart)}/book`,
    payload,
  );
}

export async function cancelBooking(
  facilityId: string,
  doctorId: string,
  addressId: string,
  bookingId: string,
  reason?: string,
): Promise<void> {
  await apiRequest(
    "DELETE",
    `/facilities/${facilityId}/doctors/${doctorId}/addresses/${addressId}/bookings/${bookingId}`,
    reason ? { reason } : undefined,
  );
}

export async function moveBooking(
  facilityId: string,
  doctorId: string,
  addressId: string,
  bookingId: string,
  newSlotStart: string,
): Promise<DoctoraliaBooking> {
  return apiRequest(
    "PATCH",
    `/facilities/${facilityId}/doctors/${doctorId}/addresses/${addressId}/bookings/${bookingId}/move/${encodeURIComponent(newSlotStart)}`,
  );
}

// ============================================================
// CALENDAR BREAKS
// ============================================================

export async function getBreaks(
  facilityId: string,
  doctorId: string,
  addressId: string,
  since: string,
  till: string,
): Promise<{ _items: DoctoraliaCalendarBreak[] }> {
  const params = new URLSearchParams({ since, till });
  return apiRequest(
    "GET",
    `/facilities/${facilityId}/doctors/${doctorId}/addresses/${addressId}/breaks?${params}`,
  );
}

export async function createBreak(
  facilityId: string,
  doctorId: string,
  addressId: string,
  payload: CreateBreakPayload,
): Promise<DoctoraliaCalendarBreak> {
  return apiRequest(
    "POST",
    `/facilities/${facilityId}/doctors/${doctorId}/addresses/${addressId}/breaks`,
    payload,
  );
}

export async function deleteBreak(
  facilityId: string,
  doctorId: string,
  addressId: string,
  breakId: string,
): Promise<void> {
  await apiRequest(
    "DELETE",
    `/facilities/${facilityId}/doctors/${doctorId}/addresses/${addressId}/breaks/${breakId}`,
  );
}

// ============================================================
// PATIENT PRESENCE
// ============================================================

export async function updatePatientPresence(
  facilityId: string,
  doctorId: string,
  addressId: string,
  bookingId: string,
  status: "appeared" | "not-appeared",
): Promise<void> {
  await apiRequest(
    "PUT",
    `/facilities/${facilityId}/doctors/${doctorId}/addresses/${addressId}/bookings/${bookingId}/presence`,
    { status },
  );
}

// ============================================================
// NOTIFICATION CALLBACKS (Webhooks)
// ============================================================

export async function getNotificationCallbacks(
  facilityId: string,
): Promise<{ callback_url?: string; events?: string[] }> {
  return apiRequest("GET", `/facilities/${facilityId}/notifications`);
}

export async function setNotificationCallback(
  facilityId: string,
  callbackUrl: string,
  events: string[],
): Promise<void> {
  await apiRequest("PUT", `/facilities/${facilityId}/notifications`, {
    callback_url: callbackUrl,
    events,
  });
}
