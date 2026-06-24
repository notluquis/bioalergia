import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { ExamReportsContract } from "@finanzas/orpc-contracts/exam-reports";

import { SuperJSONLink } from "@/features/calendar/orpc";
import { toApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

const examReportsORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export type ExamReportsORPCClient = ContractRouterClient<ExamReportsContract>;

export const examReportsORPCClient = createORPCClient(examReportsORPCLink, {
  path: ["api", "orpc", "exam-reports", "rpc"],
}) as ExamReportsORPCClient;

export const toExamReportsApiError = toApiError;
