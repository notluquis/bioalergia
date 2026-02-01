import { z } from "zod";
import { apiClient } from "@/lib/api-client";

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

export async function createService(payload: CreateServicePayload): Promise<ServiceDetailResponse> {
  return apiClient.post<ServiceDetailResponse>("/api/services", payload, {
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
  return apiClient.post<ServiceDetailResponse>(`/api/services/${publicId}/schedules`, payload, {
    responseSchema: ServiceDetailResponseSchema,
  });
}

export async function registerServicePayment(
  scheduleId: number,
  payload: ServicePaymentPayload,
): Promise<{ schedule: ServiceSchedule; status: "ok" }> {
  return apiClient.post<{ schedule: ServiceSchedule; status: "ok" }>(
    `/api/services/schedules/${scheduleId}/pay`,
    payload,
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
  return apiClient.put<ServiceDetailResponse>(`/api/services/${publicId}`, payload, {
    responseSchema: ServiceDetailResponseSchema,
  });
}
