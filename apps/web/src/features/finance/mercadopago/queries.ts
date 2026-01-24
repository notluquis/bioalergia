import { queryOptions } from "@tanstack/react-query";

import { MPService, type MpReportType } from "@/services/mercadopago";

export const mercadoPagoKeys = {
  all: ["mp-reports"] as const,
  lists: (type: MpReportType) =>
    queryOptions({
      queryFn: () => MPService.listReports(type),
      queryKey: ["mp-reports", type],
    }),
  syncLogs: (limit = 50) =>
    queryOptions({
      queryFn: () => MPService.listSyncLogs(limit),
      queryKey: ["mp-sync-logs", limit],
    }),
};
