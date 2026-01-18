import { queryOptions } from "@tanstack/react-query";

import { type MpReportType, MPService } from "@/services/mercadopago";

export const mercadoPagoKeys = {
  all: ["mp-reports"] as const,
  lists: (type: MpReportType) =>
    queryOptions({
      queryFn: () => MPService.listReports(type),
      queryKey: ["mp-reports", type],
    }),
};
