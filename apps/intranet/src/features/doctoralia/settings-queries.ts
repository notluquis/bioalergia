import { queryOptions } from "@tanstack/react-query";
import {
  fetchDoctoraliaEmailNotifications,
  fetchDoctoraliaEmailOverview,
  fetchDoctoraliaEmailStats,
} from "./settings-api";

export const doctoraliaSettingsKeys = {
  all: ["doctoralia", "settings"] as const,

  notifications: (params: { limit?: number; offset?: number }) =>
    queryOptions({
      queryFn: () => fetchDoctoraliaEmailNotifications(params),
      queryKey: ["doctoralia", "settings", "notifications", params],
    }),

  stats: () =>
    queryOptions({
      queryFn: () => fetchDoctoraliaEmailStats(),
      queryKey: ["doctoralia", "settings", "stats"],
    }),

  overview: () =>
    queryOptions({
      queryFn: () => fetchDoctoraliaEmailOverview(),
      queryKey: ["doctoralia", "settings", "overview"],
    }),
};
