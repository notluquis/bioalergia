import {
  LoanDetailResponseSchema,
  LoanListResponseSchema,
  LoanScheduleResponseSchema,
} from "./schemas";
import { loansORPCClient, toLoansApiError } from "./orpc";
import type {
  CreateLoanPayload,
  LoanDetailResponse,
  LoanListResponse,
  LoanPaymentPayload,
  LoanSchedule,
  RegenerateSchedulePayload,
} from "./types";

export async function createLoan(payload: CreateLoanPayload): Promise<LoanDetailResponse> {
  try {
    return LoanDetailResponseSchema.parse(await loansORPCClient.create(payload));
  } catch (error) {
    throw toLoansApiError(error);
  }
}

export async function fetchLoanDetail(publicId: string): Promise<LoanDetailResponse> {
  try {
    return LoanDetailResponseSchema.parse(await loansORPCClient.detail({ publicId }));
  } catch (error) {
    throw toLoansApiError(error);
  }
}

export async function fetchLoans(): Promise<LoanListResponse> {
  try {
    return LoanListResponseSchema.parse(await loansORPCClient.list());
  } catch (error) {
    throw toLoansApiError(error);
  }
}

export async function regenerateSchedules(
  publicId: string,
  payload: RegenerateSchedulePayload
): Promise<LoanDetailResponse> {
  try {
    return LoanDetailResponseSchema.parse(
      await loansORPCClient.regenerateSchedules({ payload, publicId })
    );
  } catch (error) {
    throw toLoansApiError(error);
  }
}

export async function registerLoanPayment(
  scheduleId: number,
  payload: LoanPaymentPayload
): Promise<{ schedule: LoanSchedule; status: "ok" }> {
  try {
    return LoanScheduleResponseSchema.parse(
      await loansORPCClient.paySchedule({ id: scheduleId, payload })
    );
  } catch (error) {
    throw toLoansApiError(error);
  }
}

export async function unlinkLoanPayment(
  scheduleId: number
): Promise<{ schedule: LoanSchedule; status: "ok" }> {
  try {
    return LoanScheduleResponseSchema.parse(
      await loansORPCClient.unlinkSchedulePayment({ id: scheduleId })
    );
  } catch (error) {
    throw toLoansApiError(error);
  }
}
