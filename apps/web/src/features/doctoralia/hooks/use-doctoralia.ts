/**
 * Doctoralia React Query Hooks
 *
 * TanStack Query hooks for Doctoralia data fetching.
 */

import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

import type { BookSlotPayload, DoctoraliaSlotQuery } from "../types";

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

// Query keys
export const doctoraliaKeys = {
  all: ["doctoralia"] as const,
  bookings: (query: DoctoraliaSlotQuery) => [...doctoraliaKeys.all, "bookings", query] as const,
  doctors: (facilityId: number) => [...doctoraliaKeys.all, "doctors", facilityId] as const,
  facilities: () => [...doctoraliaKeys.all, "facilities"] as const,
  slots: (query: DoctoraliaSlotQuery) => [...doctoraliaKeys.all, "slots", query] as const,
  status: () => [...doctoraliaKeys.all, "status"] as const,
  syncLogs: () => [...doctoraliaKeys.all, "syncLogs"] as const,
};

// ============================================================
// STATUS
// ============================================================

export function useBookSlot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      addressId,
      doctorId,
      facilityId,
      payload,
      slotStart,
    }: {
      addressId: string;
      doctorId: string;
      facilityId: string;
      payload: BookSlotPayload;
      slotStart: string;
    }) => {
      return bookDoctoraliaSlot(facilityId, doctorId, addressId, slotStart, payload);
    },
    onSuccess: () => {
      // Invalidate slots and bookings
      void queryClient.invalidateQueries({ queryKey: doctoraliaKeys.all });
    },
  });
}

// ============================================================
// FACILITIES
// ============================================================

export function useCancelBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      addressId,
      bookingId,
      doctorId,
      facilityId,
      reason,
    }: {
      addressId: string;
      bookingId: string;
      doctorId: string;
      facilityId: string;
      reason?: string;
    }) => {
      return cancelDoctoraliaBooking(facilityId, doctorId, addressId, bookingId, reason);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: doctoraliaKeys.all });
    },
  });
}

// ============================================================
// DOCTORS
// ============================================================

export function useDoctoraliaBookings(query: DoctoraliaSlotQuery | null) {
  return useSuspenseQuery({
    queryFn: async () => {
      if (!query) return [];
      return fetchDoctoraliaBookings(query);
    },
    queryKey: doctoraliaKeys.bookings(query ?? { addressId: "0", doctorId: "0", end: "", facilityId: "0", start: "" }),
    staleTime: 30 * 1000, // 30 seconds
  });
}

// ============================================================
// SLOTS
// ============================================================

export function useDoctoraliaDoctors(facilityId: number | undefined) {
  return useSuspenseQuery({
    queryFn: async () => {
      if (!facilityId) return [];
      return fetchDoctoraliaDoctors(facilityId);
    },
    queryKey: doctoraliaKeys.doctors(facilityId ?? 0),
    staleTime: 5 * 60 * 1000,
  });
}

// ============================================================
// BOOKINGS
// ============================================================

export function useDoctoraliaFacilities() {
  return useSuspenseQuery({
    queryFn: fetchDoctoraliaFacilities,
    queryKey: doctoraliaKeys.facilities(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useDoctoraliaSlots(query: DoctoraliaSlotQuery | null) {
  return useSuspenseQuery({
    queryFn: async () => {
      if (!query) return [];
      return fetchDoctoraliaSlots(query);
    },
    queryKey: doctoraliaKeys.slots(query ?? { addressId: "0", doctorId: "0", end: "", facilityId: "0", start: "" }),
    staleTime: 60 * 1000, // 1 minute (slots change frequently)
  });
}

export function useDoctoraliaStatus() {
  return useSuspenseQuery({
    queryFn: fetchDoctoraliaStatus,
    queryKey: doctoraliaKeys.status(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ============================================================
// SYNC
// ============================================================

export function useDoctoraliaSyncLogs() {
  return useSuspenseQuery({
    queryFn: fetchDoctoraliaSyncLogs,
    queryKey: doctoraliaKeys.syncLogs(),
    staleTime: 30 * 1000,
  });
}

export function useTriggerSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: triggerDoctoraliaSync,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: doctoraliaKeys.syncLogs() });
    },
  });
}
