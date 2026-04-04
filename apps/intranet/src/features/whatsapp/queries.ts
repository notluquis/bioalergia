import { queryOptions } from "@tanstack/react-query";
import {
  fetchWhatsappContacts,
  fetchWhatsappNotifications,
  fetchWhatsappOverview,
  fetchWhatsappStats,
} from "./api";

export const whatsappKeys = {
  all: ["whatsapp"] as const,

  notifications: (params: {
    limit?: number;
    offset?: number;
    status?: "PENDING" | "SENT" | "FAILED" | "DELIVERED" | "READ";
  }) =>
    queryOptions({
      queryFn: () => fetchWhatsappNotifications(params),
      queryKey: ["whatsapp", "notifications", params],
    }),

  contacts: (params: { limit?: number; offset?: number; search?: string }) =>
    queryOptions({
      queryFn: () => fetchWhatsappContacts(params),
      queryKey: ["whatsapp", "contacts", params],
    }),

  stats: () =>
    queryOptions({
      queryFn: () => fetchWhatsappStats(),
      queryKey: ["whatsapp", "stats"],
    }),

  overview: () =>
    queryOptions({
      queryFn: () => fetchWhatsappOverview(),
      queryKey: ["whatsapp", "overview"],
    }),
};
