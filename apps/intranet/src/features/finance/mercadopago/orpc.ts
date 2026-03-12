import { createORPCClient, ORPCError } from "@orpc/client";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import type { MpReportType } from "../../../../shared/mercadopago";

type MercadoPagoORPCClient = {
  createReport: (input: { beginDate: Date; endDate: Date; type?: MpReportType }) => Promise<{
    begin_date: Date;
    created_from: string;
    date_created?: Date;
    end_date: Date;
    file_name?: string;
    id: number;
    state?: string;
    status?: string;
    status_detail?: string;
  }>;
  listReports: (input?: { limit?: number; offset?: number; type?: MpReportType }) => Promise<{
    reports: Array<{
      begin_date: Date;
      created_from: string;
      date_created?: Date;
      end_date: Date;
      file_name?: string;
      id: number;
      state?: string;
      status?: string;
      status_detail?: string;
    }>;
    total: number;
  }>;
  listSyncLogs: (input?: { limit?: number; offset?: number }) => Promise<{
    logs: Array<{
      changeDetails?: null | Record<string, unknown>;
      errorMessage?: null | string;
      excluded?: null | number;
      finishedAt?: Date | null;
      id: bigint;
      inserted?: null | number;
      skipped?: null | number;
      startedAt: Date;
      status: "ERROR" | "RUNNING" | "SUCCESS";
      triggerLabel?: null | string;
      triggerSource: string;
      updated?: null | number;
    }>;
    total: number;
  }>;
  processReport: (input: { fileName: string; reportType: MpReportType }) => Promise<{
    cashFlowSync?: {
      created: number;
      duplicates: number;
      errors: string[];
      failed: number;
      total: number;
    };
    message: string;
    stats: {
      duplicateRows: number;
      errors: string[];
      insertedRows: number;
      skippedRows: number;
      totalRows: number;
      validRows: number;
    };
    status: "error" | "success";
  }>;
};

const mercadopagoORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export const mercadopagoORPCClient = createORPCClient<MercadoPagoORPCClient>(mercadopagoORPCLink, {
  path: ["api", "orpc", "mercadopago", "rpc"],
});

export function toMercadoPagoApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  if (error instanceof ORPCError) {
    return new ApiError(error.message, error.status, error.data);
  }
  if (error instanceof Error) {
    return new ApiError(error.message, 500);
  }
  return new ApiError("Error inesperado", 500, error);
}
