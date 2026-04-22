import { queryOptions } from "@tanstack/react-query";
import {
  fetchDoctoraliaBackfillStatus,
  fetchDoctoraliaScraperRunOverrideStatus,
  fetchDoctoraliaSyncLogs,
} from "./api";
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

  backfillStatus: () =>
    queryOptions({
      queryFn: () => fetchDoctoraliaBackfillStatus(),
      queryKey: ["doctoralia", "settings", "backfillStatus"],
    }),

  syncLogs: () =>
    queryOptions({
      queryFn: () => fetchDoctoraliaSyncLogs(),
      queryKey: ["doctoralia", "settings", "syncLogs"],
    }),

  scraperRunOverride: () =>
    queryOptions({
      queryFn: () => fetchDoctoraliaScraperRunOverrideStatus(),
      queryKey: ["doctoralia", "settings", "scraperRunOverride"],
    }),
};
