import {
  LoanDetailResponseSchema,
  LoanListResponseSchema,
  LoanPaymentCandidatesResponseSchema,
  LoanScheduleResponseSchema,
} from "./schemas";
import { loansORPCClient, toLoansApiError } from "./orpc";
import type {
  CreateLoanPayload,
  CreateStructuredLoanPayload,
  LoanDetailResponse,
  LoanListResponse,
  LoanPaymentCandidate,
  LoanPaymentPayload,
  LoanSchedule,
  RegenerateSchedulePayload,
  UpdateLoanPayload,
} from "./types";

export async function createLoan(payload: CreateLoanPayload): Promise<LoanDetailResponse> {
  try {
    return LoanDetailResponseSchema.parse(await loansORPCClient.create(payload));
  } catch (error) {
    throw toLoansApiError(error);
  }
}

export async function createStructuredLoan(
  payload: CreateStructuredLoanPayload
): Promise<LoanDetailResponse> {
  try {
    return LoanDetailResponseSchema.parse(await loansORPCClient.createStructured(payload));
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

export async function fetchLoanPaymentCandidates(
  scheduleId: number
): Promise<LoanPaymentCandidate[]> {
  try {
    const response = LoanPaymentCandidatesResponseSchema.parse(
      await loansORPCClient.paymentCandidates({
        daysAfter: 7,
        daysBefore: 7,
        id: scheduleId,
        limit: 12,
      })
    );
    return response.candidates;
  } catch (error) {
    throw toLoansApiError(error);
  }
}

export async function deleteLoan(publicId: string): Promise<{ status: "ok" }> {
  try {
    return await loansORPCClient.delete({ publicId });
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

export async function updateLoan(
  publicId: string,
  payload: UpdateLoanPayload
): Promise<LoanDetailResponse> {
  try {
    return LoanDetailResponseSchema.parse(await loansORPCClient.update({ payload, publicId }));
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
