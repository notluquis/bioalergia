import { queryOptions } from "@tanstack/react-query";

import { MPService, type MpReportType } from "@/services/mercadopago";

export const mercadoPagoKeys = {
  all: ["mp-reports"] as const,
  lists: (type: MpReportType, params?: { limit?: number; offset?: number }) =>
    queryOptions({
      queryFn: () => MPService.listReports(type, params),
      queryKey: ["mp-reports", type, params?.limit ?? null, params?.offset ?? null],
    }),
  syncLogs: (params?: { limit?: number; offset?: number }) =>
    queryOptions({
      queryFn: () => MPService.listSyncLogs(params),
      queryKey: ["mp-sync-logs", params?.limit ?? null, params?.offset ?? null],
    }),
  importChanges: (params: {
    fieldName?: string;
    limit?: number;
    offset?: number;
    sourceId?: string;
    syncLogId: bigint;
  }) =>
    queryOptions({
      queryFn: () => MPService.listImportChanges(params),
      queryKey: [
        "mp-import-changes",
        params.syncLogId.toString(),
        params.limit ?? null,
        params.offset ?? null,
        params.sourceId ?? null,
        params.fieldName ?? null,
      ],
    }),
};
