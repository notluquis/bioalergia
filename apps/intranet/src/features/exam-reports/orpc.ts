import { createORPCClient, ORPCError } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { ExamReportsContract } from "@finanzas/orpc-contracts/exam-reports";

import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

const examReportsORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export type ExamReportsORPCClient = ContractRouterClient<ExamReportsContract>;

export const examReportsORPCClient = createORPCClient(examReportsORPCLink, {
  path: ["api", "orpc", "exam-reports", "rpc"],
}) as ExamReportsORPCClient;

export function toExamReportsApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof ORPCError) return new ApiError(error.message, error.status, error.data);
  if (error instanceof Error) return new ApiError(error.message, 500);
  return new ApiError("Error inesperado", 500, error);
}
