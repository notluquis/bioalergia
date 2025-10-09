import { apiClient } from "../../lib/apiClient";
import type {
  CreateLoanPayload,
  LoanDetailResponse,
  LoanListResponse,
  LoanPaymentPayload,
  LoanSchedule,
  RegenerateSchedulePayload,
} from "./types";

export async function fetchLoans(): Promise<LoanListResponse> {
  return apiClient.get<LoanListResponse>("/api/loans");
}

export async function createLoan(payload: CreateLoanPayload): Promise<LoanDetailResponse> {
  return apiClient.post<LoanDetailResponse>("/api/loans", payload);
}

export async function fetchLoanDetail(publicId: string): Promise<LoanDetailResponse> {
  return apiClient.get<LoanDetailResponse>(`/api/loans/${publicId}`);
}

export async function regenerateSchedules(
  publicId: string,
  payload: RegenerateSchedulePayload
): Promise<LoanDetailResponse> {
  return apiClient.post<LoanDetailResponse>(`/api/loans/${publicId}/schedules`, payload);
}

export async function registerLoanPayment(
  scheduleId: number,
  payload: LoanPaymentPayload
): Promise<{ status: "ok"; schedule: LoanSchedule }> {
  return apiClient.post<{ status: "ok"; schedule: LoanSchedule }>(`/api/loan-schedules/${scheduleId}/pay`, payload);
}

export async function unlinkLoanPayment(scheduleId: number): Promise<{ status: "ok"; schedule: LoanSchedule }> {
  return apiClient.post<{ status: "ok"; schedule: LoanSchedule }>(`/api/loan-schedules/${scheduleId}/unlink`, {});
}
