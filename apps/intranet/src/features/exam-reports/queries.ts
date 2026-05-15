import { queryOptions } from "@tanstack/react-query";
import type { ExamType } from "@finanzas/orpc-contracts/exam-reports";

import { examReportsORPCClient } from "./orpc";

export const examReportsKeys = {
  all: ["exam-reports"] as const,
  lists: () => [...examReportsKeys.all, "list"] as const,
  list: (params?: {
    patientId?: number;
    examType?: ExamType;
    search?: string;
    limit?: number;
    offset?: number;
  }) =>
    queryOptions({
      queryKey: [...examReportsKeys.lists(), params ?? {}] as const,
      queryFn: () => examReportsORPCClient.list(params ?? {}),
    }),
  detail: (id: number) =>
    queryOptions({
      queryKey: [...examReportsKeys.all, "detail", id] as const,
      queryFn: () => examReportsORPCClient.get({ id }),
    }),
  templates: (examType?: ExamType | null) =>
    queryOptions({
      queryKey: [...examReportsKeys.all, "templates", examType ?? null] as const,
      queryFn: () => examReportsORPCClient.listTemplates({ examType: examType ?? undefined }),
    }),
  clinicSettings: () =>
    queryOptions({
      queryKey: [...examReportsKeys.all, "clinic-settings"] as const,
      queryFn: () => examReportsORPCClient.getClinicSettings({}),
    }),
  allergens: (params?: { search?: string; categories?: string[]; limit?: number }) =>
    queryOptions({
      queryKey: [...examReportsKeys.all, "allergens", params ?? {}] as const,
      queryFn: () => examReportsORPCClient.listAllergens(params ?? {}),
    }),
};
