import { createORPCClient, ORPCError } from "@orpc/client";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import type { UnsafeORPCClient } from "@/lib/orpc-client";
import type { ServiceSchedule, ServiceSummary } from "./types";

const servicesORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export const servicesORPCClient = createORPCClient(servicesORPCLink, {
  path: ["api", "orpc", "services", "rpc"],
}) as unknown as UnsafeORPCClient;

type NumberLike = null | number | { toNumber: () => number } | undefined;

type ServiceTransactionTransport = {
  amount: NumberLike;
  description: null | string;
  id: number;
  timestamp: Date | null;
};

export type ServiceScheduleItemTransport = Omit<
  ServiceSchedule,
  "effectiveAmount" | "expectedAmount" | "lateFeeAmount" | "paidAmount" | "transaction"
> & {
  effectiveAmount: NumberLike;
  expectedAmount: NumberLike;
  lateFeeAmount: NumberLike;
  paidAmount: NumberLike;
  transaction?: null | ServiceTransactionTransport;
};

export type ServiceScheduleTransport = { schedule: ServiceScheduleItemTransport; status: "ok" };

type ServiceSummaryTransport = Omit<
  ServiceSummary,
  "defaultAmount" | "lateFeeValue" | "totalExpected" | "totalPaid"
> & {
  defaultAmount: NumberLike;
  lateFeeValue: NumberLike;
  totalExpected: NumberLike;
  totalPaid: NumberLike;
};

export type ServiceDetailTransport = {
  schedules: ServiceScheduleItemTransport[];
  service: ServiceSummaryTransport;
  status: "ok";
};
export type ServiceListTransport = { services: ServiceSummaryTransport[]; status: "ok" };

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
