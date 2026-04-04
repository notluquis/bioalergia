import { queryOptions } from "@tanstack/react-query";
import {
  fetchDoctoraliaDispatchNotifications,
  fetchDoctoraliaDispatchStats,
  fetchDoctoraliaPipelineOverview,
} from "./settings-api";

export const doctoraliaSettingsKeys = {
  all: ["doctoralia", "settings"] as const,

  notifications: (params: {
    limit?: number;
    offset?: number;
    status?: "PENDING" | "SENT" | "FAILED" | "DELIVERED" | "READ";
  }) =>
    queryOptions({
      queryFn: () => fetchDoctoraliaDispatchNotifications(params),
      queryKey: ["doctoralia", "settings", "notifications", params],
    }),

  stats: () =>
    queryOptions({
      queryFn: () => fetchDoctoraliaDispatchStats(),
      queryKey: ["doctoralia", "settings", "stats"],
    }),

  overview: () =>
    queryOptions({
      queryFn: () => fetchDoctoraliaPipelineOverview(),
      queryKey: ["doctoralia", "settings", "overview"],
    }),
};
