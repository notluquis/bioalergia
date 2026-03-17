import { queryOptions } from "@tanstack/react-query";
import { fetchWhatsappNotifications, fetchWhatsappStats } from "./api";

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

  stats: () =>
    queryOptions({
      queryFn: () => fetchWhatsappStats(),
      queryKey: ["whatsapp", "stats"],
    }),
};
