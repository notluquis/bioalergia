import { queryOptions } from "@tanstack/react-query";
import {
  fetchWhatsappAccountInfo,
  fetchWhatsappContacts,
  fetchWhatsappNotifications,
  fetchWhatsappOverview,
  fetchWhatsappStats,
  fetchWhatsappTemplates,
} from "./api";

export const whatsappKeys = {
  all: ["whatsapp"] as const,

  notifications: (params: {
    limit?: number;
    offset?: number;
    status?: "PENDING" | "SENT" | "FAILED" | "DELIVERED" | "READ" | "PLAYED";
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

  templates: () =>
    queryOptions({
      queryFn: () => fetchWhatsappTemplates(),
      queryKey: ["whatsapp", "templates"],
    }),

  accountInfo: () =>
    queryOptions({
      queryFn: () => fetchWhatsappAccountInfo(),
      queryKey: ["whatsapp", "account-info"],
    }),
};
