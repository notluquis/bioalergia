import { apiClient } from "@/lib/api-client";
import {
  LoanDetailResponseSchema,
  LoanListResponseSchema,
  LoanScheduleResponseSchema,
} from "./schemas";
import type {
  CreateLoanPayload,
  LoanDetailResponse,
  LoanListResponse,
  LoanPaymentPayload,
  LoanSchedule,
  RegenerateSchedulePayload,
} from "./types";

export async function createLoan(payload: CreateLoanPayload): Promise<LoanDetailResponse> {
  return apiClient.post<LoanDetailResponse>("/api/loans", payload, {
    responseSchema: LoanDetailResponseSchema,
  });
}

export async function fetchLoanDetail(publicId: string): Promise<LoanDetailResponse> {
  return apiClient.get<LoanDetailResponse>(`/api/loans/${publicId}`, {
    responseSchema: LoanDetailResponseSchema,
  });
}

export async function fetchLoans(): Promise<LoanListResponse> {
  return apiClient.get<LoanListResponse>("/api/loans", {
    responseSchema: LoanListResponseSchema,
  });
}

export async function regenerateSchedules(
  publicId: string,
  payload: RegenerateSchedulePayload,
): Promise<LoanDetailResponse> {
  return apiClient.post<LoanDetailResponse>(`/api/loans/${publicId}/schedules`, payload, {
    responseSchema: LoanDetailResponseSchema,
  });
}

export async function registerLoanPayment(
  scheduleId: number,
  payload: LoanPaymentPayload,
): Promise<{ schedule: LoanSchedule; status: "ok" }> {
  return apiClient.post<{ schedule: LoanSchedule; status: "ok" }>(
    `/api/loan-schedules/${scheduleId}/pay`,
    payload,
    { responseSchema: LoanScheduleResponseSchema },
  );
}

export async function unlinkLoanPayment(
  scheduleId: number,
): Promise<{ schedule: LoanSchedule; status: "ok" }> {
  return apiClient.post<{ schedule: LoanSchedule; status: "ok" }>(
    `/api/loan-schedules/${scheduleId}/unlink`,
    {},
    { responseSchema: LoanScheduleResponseSchema },
  );
}
