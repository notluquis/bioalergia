import { createORPCClient, ORPCError } from "@orpc/client";
import type { RouterClient } from "@orpc/server";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import type { PersonalFinanceORPCRouter } from "../../../../api/src/orpc/personal-finance";

export type PersonalFinanceORPCClient = RouterClient<PersonalFinanceORPCRouter>;

const personalFinanceORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export const personalFinanceORPCClient = createORPCClient<PersonalFinanceORPCClient>(
  personalFinanceORPCLink,
  {
    path: ["api", "orpc", "personal-finance", "rpc"],
  }
);

export type PersonalCreditTransport = Awaited<ReturnType<PersonalFinanceORPCClient["getCredit"]>>;
export type PersonalCreditInstallmentTransport = Awaited<
  ReturnType<PersonalFinanceORPCClient["payInstallment"]>
>;

export function toPersonalFinanceApiError(error: unknown): ApiError {
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
