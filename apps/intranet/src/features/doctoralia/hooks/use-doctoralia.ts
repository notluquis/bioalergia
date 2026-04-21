/**
 * Doctoralia React Query Hooks
 *
 * TanStack Query hooks for Doctoralia data fetching.
 */

import { useSuspenseQuery } from "@tanstack/react-query";
import { fetchDoctoraliaSyncLogs } from "../api";

export const doctoraliaKeys = {
  all: ["doctoralia"] as const,
  syncLogs: () => [...doctoraliaKeys.all, "syncLogs"] as const,
};

export function useDoctoraliaSyncLogs() {
  return useSuspenseQuery({
    queryFn: fetchDoctoraliaSyncLogs,
    queryKey: doctoraliaKeys.syncLogs(),
    staleTime: 30 * 1000,
  });
}
