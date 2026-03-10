import { createORPCClient, ORPCError } from "@orpc/client";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import type {
  BookSlotPayload,
  DoctoraliaBooking,
  DoctoraliaCalendarAppointment,
  DoctoraliaDoctor,
  DoctoraliaFacility,
  DoctoraliaSlot,
  DoctoraliaSyncLog,
} from "./types";

type DoctoraliaORPCClient = {
  bookings: (input: {
    addressId: string;
    doctorId: string;
    end: string;
    facilityId: string;
    start: string;
  }) => Promise<{
    bookings: DoctoraliaBooking[];
    pagination: {
      limit: number;
      page: number;
      pages: number;
      total: number;
    };
    status: "ok";
  }>;
  bookSlot: (input: {
    addressId: string;
    body: BookSlotPayload;
    doctorId: string;
    facilityId: string;
    slotStart: string;
  }) => Promise<{ booking: DoctoraliaBooking; status: "ok" }>;
  calendarAppointments: (input: { from: string; scheduleIds?: number[]; to: string }) => Promise<{
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
  }>;
  calendarAuthStatus: () => Promise<{
    data: {
      connected: boolean;
      expiresAt: Date | null;
    };
    status: "ok";
  }>;
  cancelBooking: (input: {
    addressId: string;
    bookingId: string;
    doctorId: string;
    facilityId: string;
    reason?: string;
  }) => Promise<{ status: "ok" }>;
  doctors: (input: { facilityId: number }) => Promise<{
    doctors: DoctoraliaDoctor[];
    status: "ok";
  }>;
  facilities: () => Promise<{ facilities: DoctoraliaFacility[]; status: "ok" }>;
  slots: (input: {
    addressId: string;
    doctorId: string;
    end: string;
    facilityId: string;
    start: string;
  }) => Promise<{ slots: DoctoraliaSlot[]; status: "ok" }>;
  status: () => Promise<{ configured: boolean; domain: string; status: "ok" }>;
  sync: (input: Record<string, never>) => Promise<{
    logId: number;
    message: string;
    status: "accepted";
  }>;
  syncLogs: () => Promise<{ logs: DoctoraliaSyncLog[]; status: "ok" }>;
};

const doctoraliaORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export const doctoraliaORPCClient = createORPCClient<DoctoraliaORPCClient>(doctoraliaORPCLink, {
  path: ["api", "orpc", "doctoralia", "rpc"],
});

export function toDoctoraliaApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof ORPCError) {
    return new ApiError(error.message, error.status, error.data);
  }

  if (error instanceof Error) {
    return new ApiError(error.message, 500);
  }

  return new ApiError("Error inesperado", 500, error);
}
