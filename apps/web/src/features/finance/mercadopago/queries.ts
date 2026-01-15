import { queryOptions } from "@tanstack/react-query";

import { type MpReportType, MPService } from "@/services/mercadopago";

export const mercadoPagoKeys = {
  all: ["mp-reports"] as const,
  lists: (type: MpReportType) =>
    queryOptions({
      queryKey: ["mp-reports", type],
      queryFn: () => MPService.listReports(type),
    }),
};
