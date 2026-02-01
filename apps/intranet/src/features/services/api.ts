import { z } from "zod";
import { apiClient } from "@/lib/api-client";
import { formatISO } from "@/lib/dates";

import type {
  CreateServicePayload,
  RegenerateServicePayload,
  ServiceDetailResponse,
  ServiceListResponse,
  ServicePaymentPayload,
  ServiceSchedule,
} from "./types";

const ServiceDetailResponseSchema = z.looseObject({});
const ServiceListResponseSchema = z.looseObject({});
const ServiceScheduleResponseSchema = z.object({
  schedule: z.unknown(),
  status: z.literal("ok"),
});

type CreateServicePayloadRequest = Omit<CreateServicePayload, "emissionExactDate" | "startDate"> & {
  emissionExactDate?: null | string;
  startDate: string;
};

type RegenerateServicePayloadRequest = Omit<RegenerateServicePayload, "startDate"> & {
  startDate?: string;
};

type ServicePaymentPayloadRequest = Omit<ServicePaymentPayload, "paidDate"> & { paidDate: string };

function serializeServicePayload(payload: CreateServicePayload): CreateServicePayloadRequest {
  return {
    ...payload,
    emissionExactDate: payload.emissionExactDate ? formatISO(payload.emissionExactDate) : null,
    startDate: formatISO(payload.startDate),
  };
}

function serializeRegeneratePayload(
  payload: RegenerateServicePayload,
): RegenerateServicePayloadRequest {
  return {
    ...payload,
    startDate: payload.startDate ? formatISO(payload.startDate) : undefined,
  };
}

function serializePaymentPayload(payload: ServicePaymentPayload): ServicePaymentPayloadRequest {
  return {
    ...payload,
    paidDate: formatISO(payload.paidDate),
  };
}

export async function createService(payload: CreateServicePayload): Promise<ServiceDetailResponse> {
  return apiClient.post<ServiceDetailResponse>("/api/services", serializeServicePayload(payload), {
    responseSchema: ServiceDetailResponseSchema,
  });
}

export function extractErrorMessage(error: unknown): null | string {
  if (!error) return null;
  return error instanceof Error ? error.message : String(error);
}

export async function fetchServiceDetail(publicId: string): Promise<ServiceDetailResponse> {
  return apiClient.get<ServiceDetailResponse>(`/api/services/${publicId}`, {
    responseSchema: ServiceDetailResponseSchema,
  });
}

export async function fetchServices(): Promise<ServiceListResponse> {
  return apiClient.get<ServiceListResponse>("/api/services", {
    responseSchema: ServiceListResponseSchema,
  });
}

export async function regenerateServiceSchedules(
  publicId: string,
  payload: RegenerateServicePayload,
): Promise<ServiceDetailResponse> {
  return apiClient.post<ServiceDetailResponse>(
    `/api/services/${publicId}/schedules`,
    serializeRegeneratePayload(payload),
    {
      responseSchema: ServiceDetailResponseSchema,
    },
  );
}

export async function registerServicePayment(
  scheduleId: number,
  payload: ServicePaymentPayload,
): Promise<{ schedule: ServiceSchedule; status: "ok" }> {
  return apiClient.post<{ schedule: ServiceSchedule; status: "ok" }>(
    `/api/services/schedules/${scheduleId}/pay`,
    serializePaymentPayload(payload),
    { responseSchema: ServiceScheduleResponseSchema },
  );
}

export async function unlinkServicePayment(
  scheduleId: number,
): Promise<{ schedule: ServiceSchedule; status: "ok" }> {
  return apiClient.post<{ schedule: ServiceSchedule; status: "ok" }>(
    `/api/services/schedules/${scheduleId}/unlink`,
    {},
    { responseSchema: ServiceScheduleResponseSchema },
  );
}

export async function updateService(
  publicId: string,
  payload: CreateServicePayload,
): Promise<ServiceDetailResponse> {
  return apiClient.put<ServiceDetailResponse>(
    `/api/services/${publicId}`,
    serializeServicePayload(payload),
    {
      responseSchema: ServiceDetailResponseSchema,
    },
  );
}
