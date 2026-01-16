/**
 * Doctoralia React Query Hooks
 *
 * TanStack Query hooks for Doctoralia data fetching.
 */

import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

import {
  bookDoctoraliaSlot,
  cancelDoctoraliaBooking,
  fetchDoctoraliaBookings,
  fetchDoctoraliaDoctors,
  fetchDoctoraliaFacilities,
  fetchDoctoraliaSlots,
  fetchDoctoraliaStatus,
  fetchDoctoraliaSyncLogs,
  triggerDoctoraliaSync,
} from "../api";
import type { BookSlotPayload, DoctoraliaSlotQuery } from "../types";

// Query keys
export const doctoraliaKeys = {
  all: ["doctoralia"] as const,
  status: () => [...doctoraliaKeys.all, "status"] as const,
  facilities: () => [...doctoraliaKeys.all, "facilities"] as const,
  doctors: (facilityId: number) => [...doctoraliaKeys.all, "doctors", facilityId] as const,
  slots: (query: DoctoraliaSlotQuery) => [...doctoraliaKeys.all, "slots", query] as const,
  bookings: (query: DoctoraliaSlotQuery) => [...doctoraliaKeys.all, "bookings", query] as const,
  syncLogs: () => [...doctoraliaKeys.all, "syncLogs"] as const,
};

// ============================================================
// STATUS
// ============================================================

export function useDoctoraliaStatus() {
  return useSuspenseQuery({
    queryKey: doctoraliaKeys.status(),
    queryFn: fetchDoctoraliaStatus,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ============================================================
// FACILITIES
// ============================================================

export function useDoctoraliaFacilities() {
  return useSuspenseQuery({
    queryKey: doctoraliaKeys.facilities(),
    queryFn: fetchDoctoraliaFacilities,
    staleTime: 5 * 60 * 1000,
  });
}

// ============================================================
// DOCTORS
// ============================================================

export function useDoctoraliaDoctors(facilityId: number | undefined) {
  return useSuspenseQuery({
    queryKey: doctoraliaKeys.doctors(facilityId ?? 0),
    queryFn: async () => {
      if (!facilityId) return [];
      return fetchDoctoraliaDoctors(facilityId);
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ============================================================
// SLOTS
// ============================================================

export function useDoctoraliaSlots(query: DoctoraliaSlotQuery | null) {
  return useSuspenseQuery({
    queryKey: doctoraliaKeys.slots(query ?? { facilityId: "0", doctorId: "0", addressId: "0", start: "", end: "" }),
    queryFn: async () => {
      if (!query) return [];
      return fetchDoctoraliaSlots(query);
    },
    staleTime: 60 * 1000, // 1 minute (slots change frequently)
  });
}

// ============================================================
// BOOKINGS
// ============================================================

export function useDoctoraliaBookings(query: DoctoraliaSlotQuery | null) {
  return useSuspenseQuery({
    queryKey: doctoraliaKeys.bookings(query ?? { facilityId: "0", doctorId: "0", addressId: "0", start: "", end: "" }),
    queryFn: async () => {
      if (!query) return [];
      return fetchDoctoraliaBookings(query);
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useBookSlot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      facilityId,
      doctorId,
      addressId,
      slotStart,
      payload,
    }: {
      facilityId: string;
      doctorId: string;
      addressId: string;
      slotStart: string;
      payload: BookSlotPayload;
    }) => {
      return bookDoctoraliaSlot(facilityId, doctorId, addressId, slotStart, payload);
    },
    onSuccess: () => {
      // Invalidate slots and bookings
      queryClient.invalidateQueries({ queryKey: doctoraliaKeys.all });
    },
  });
}

export function useCancelBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      facilityId,
      doctorId,
      addressId,
      bookingId,
      reason,
    }: {
      facilityId: string;
      doctorId: string;
      addressId: string;
      bookingId: string;
      reason?: string;
    }) => {
      return cancelDoctoraliaBooking(facilityId, doctorId, addressId, bookingId, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: doctoraliaKeys.all });
    },
  });
}

// ============================================================
// SYNC
// ============================================================

export function useDoctoraliaSyncLogs() {
  return useSuspenseQuery({
    queryKey: doctoraliaKeys.syncLogs(),
    queryFn: fetchDoctoraliaSyncLogs,
    staleTime: 30 * 1000,
  });
}

export function useTriggerSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: triggerDoctoraliaSync,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: doctoraliaKeys.syncLogs() });
    },
  });
}
