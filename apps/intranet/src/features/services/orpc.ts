import { createORPCClient, ORPCError } from "@orpc/client";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import type {
  CreateServicePayload,
  ServiceDetailResponse,
  ServicePaymentPayload,
  ServiceSchedule,
  ServiceScheduleEditPayload,
  ServiceScheduleSkipPayload,
  ServiceSummary,
  ServiceSyncTransactionsResult,
} from "./types";

type CreateServicePayloadRequest = Omit<CreateServicePayload, "emissionExactDate" | "startDate"> & {
  emissionExactDate?: null | string;
  startDate: string;
};

type ServicePaymentPayloadRequest = Omit<ServicePaymentPayload, "paidDate"> & { paidDate: string };

type ServiceScheduleEditPayloadRequest = Omit<ServiceScheduleEditPayload, "dueDate"> & {
  dueDate?: string;
};

type ServicesORPCClient = {
  create: (input: CreateServicePayloadRequest) => Promise<ServiceDetailResponse>;
  delete: (input: { id: string }) => Promise<{ status: "ok" }>;
  detail: (input: { id: string }) => Promise<ServiceDetailResponse>;
  list: () => Promise<{ services: ServiceSummary[]; status: "ok" }>;
  regenerateSchedules: (input: {
    id: string;
    months?: number;
    fromDate?: string;
  }) => Promise<ServiceDetailResponse & { generated?: number; message?: string }>;
  scheduleEdit: (input: { id: number } & ServiceScheduleEditPayloadRequest) => Promise<{
    schedule: ServiceSchedule;
    status: "ok";
  }>;
  schedulePay: (input: { id: number } & ServicePaymentPayloadRequest) => Promise<{
    schedule: ServiceSchedule;
    status: "ok";
  }>;
  scheduleSkip: (input: { id: number } & ServiceScheduleSkipPayload) => Promise<{
    schedule: ServiceSchedule;
    status: "ok";
  }>;
  scheduleUnlink: (input: { id: number }) => Promise<{ schedule: ServiceSchedule; status: "ok" }>;
  syncAllTransactions: () => Promise<{ data: ServiceSyncTransactionsResult; status: "ok" }>;
  syncTransactions: (input: { id: string }) => Promise<{
    data: ServiceSyncTransactionsResult;
    status: "ok";
  }>;
  update: (input: {
    id: string;
    payload: CreateServicePayloadRequest;
  }) => Promise<ServiceDetailResponse>;
};

const servicesORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export const servicesORPCClient = createORPCClient<ServicesORPCClient>(servicesORPCLink, {
  path: ["api", "orpc", "services", "rpc"],
});

export function toServicesApiError(error: unknown): ApiError {
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
