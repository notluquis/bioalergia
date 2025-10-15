import { apiClient } from "../../lib/apiClient";
import type {
  CreateServicePayload,
  RegenerateServicePayload,
  ServiceDetailResponse,
  ServiceListResponse,
  ServicePaymentPayload,
  ServiceSchedule,
} from "./types";

export async function fetchServices(): Promise<ServiceListResponse> {
  return apiClient.get<ServiceListResponse>("/api/services");
}

export async function createService(payload: CreateServicePayload): Promise<ServiceDetailResponse> {
  return apiClient.post<ServiceDetailResponse>("/api/services", payload);
}

export async function fetchServiceDetail(publicId: string): Promise<ServiceDetailResponse> {
  return apiClient.get<ServiceDetailResponse>(`/api/services/${publicId}`);
}

export async function updateService(
  publicId: string,
  payload: CreateServicePayload
): Promise<ServiceDetailResponse> {
  return apiClient.put<ServiceDetailResponse>(`/api/services/${publicId}`, payload);
}

export async function regenerateServiceSchedules(
  publicId: string,
  payload: RegenerateServicePayload
): Promise<ServiceDetailResponse> {
  return apiClient.post<ServiceDetailResponse>(`/api/services/${publicId}/schedules`, payload);
}

export async function registerServicePayment(
  scheduleId: number,
  payload: ServicePaymentPayload
): Promise<{ status: "ok"; schedule: ServiceSchedule }> {
  return apiClient.post<{ status: "ok"; schedule: ServiceSchedule }>(
    `/api/services/schedules/${scheduleId}/pay`,
    payload
  );
}

export async function unlinkServicePayment(scheduleId: number): Promise<{ status: "ok"; schedule: ServiceSchedule }> {
  return apiClient.post<{ status: "ok"; schedule: ServiceSchedule }>(
    `/api/services/schedules/${scheduleId}/unlink`,
    {}
  );
}
