/**
 * MercadoPago Frontend Service
 * Reports list, create, and download functionality only
 */

import { z } from "zod";
import type { MpReportType } from "../../shared/mercadopago";
import { apiClient } from "../lib/api-client";

/**
 * Statistics returned after processing a report
 */
export interface ImportStats {
  duplicateRows: number;
  errors: string[];
  insertedRows: number;
  skippedRows: number;
  totalRows: number;
  validRows: number;
}

export interface MPReport {
  begin_date: Date;
  created_from: "manual" | "schedule";
  date_created?: Date;
  end_date: Date;
  file_name?: string;
  id: number;
  status?: string;
  status_detail?: string;
  state?: string;
}

export interface MPReportListResponse {
  reports: MPReport[];
  total: number;
}

export interface MpSyncLog {
  changeDetails?: MpSyncChangeDetails | null;
  errorMessage?: string | null;
  excluded?: number | null;
  finishedAt?: Date | null;
  id: bigint;
  inserted?: number | null;
  skipped?: number | null;
  startedAt: Date;
  status: "RUNNING" | "SUCCESS" | "ERROR";
  triggerLabel?: string | null;
  triggerSource: string;
  updated?: number | null;
}

export interface MpSyncImportStats {
  duplicateRows: number;
  errorCount?: number;
  insertedRows: number;
  skippedRows: number;
  totalRows: number;
  validRows: number;
}

export type MpSyncChangeDetails = Record<string, unknown> & {
  importStats?: MpSyncImportStats;
  importStatsByType?: Partial<Record<"release" | "settlement", MpSyncImportStats>>;
  reportTypes?: Array<"release" | "settlement">;
};

interface ProcessReportResponse {
  message: string;
  stats: ImportStats;
  status: string;
}

const MPReportSchema = z.looseObject({
  begin_date: z.coerce.date(),
  created_from: z.enum(["manual", "schedule"]),
  date_created: z.coerce.date().optional(),
  end_date: z.coerce.date(),
  file_name: z.string().optional(),
  id: z.number(),
  status: z.string().optional(),
  status_detail: z.string().optional(),
  state: z.string().optional(),
});

const MPReportListResponseSchema = z.object({
  reports: z.array(MPReportSchema),
  status: z.string().optional(),
  total: z.number(),
});

const MpSyncLogSchema = z.object({
  changeDetails: z.record(z.string(), z.unknown()).nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  excluded: z.number().nullable().optional(),
  finishedAt: z.coerce.date().nullable().optional(),
  id: z.bigint(),
  inserted: z.number().nullable().optional(),
  skipped: z.number().nullable().optional(),
  startedAt: z.coerce.date(),
  status: z.enum(["RUNNING", "SUCCESS", "ERROR"]),
  triggerLabel: z.string().nullable().optional(),
  triggerSource: z.string(),
  updated: z.number().nullable().optional(),
});

const MpSyncLogsResponseSchema = z.object({
  logs: z.array(MpSyncLogSchema),
  status: z.string().optional(),
  total: z.number(),
});

const ProcessReportResponseSchema = z.object({
  message: z.string(),
  stats: z.object({
    duplicateRows: z.number(),
    errors: z.array(z.string()),
    insertedRows: z.number(),
    skippedRows: z.number(),
    totalRows: z.number(),
    validRows: z.number(),
  }),
  status: z.string(),
});

function getBaseUrl(type: MpReportType = "release") {
  return type === "release" ? "/api/mercadopago" : "/api/mercadopago/settlement";
}

export const MPService = {
  createReport: async (
    beginDate: Date,
    endDate: Date,
    type: MpReportType = "release",
  ): Promise<MPReport> => {
    const baseUrl = getBaseUrl(type);
    return apiClient.post<MPReport>(
      `${baseUrl}/reports`,
      {
        begin_date: beginDate.toISOString(),
        end_date: endDate.toISOString(),
      },
      { responseSchema: MPReportSchema },
    );
  },

  /**
   * Create multiple reports if date range exceeds 60 days (MP limit is 62)
   * Returns array of created reports and calls onProgress for each
   */
  createReportBulk: async (
    beginDate: Date,
    endDate: Date,
    type: MpReportType,
    onProgress?: (current: number, total: number) => void,
  ): Promise<MPReport[]> => {
    const MAX_DAYS = 60; // Safe margin below 62-day limit
    const start = new Date(beginDate);
    let end = new Date(endDate);

    // Cap end date to today (MP API doesn't accept future dates)
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (end > today) {
      end = today;
    }

    // Calculate chunks needed
    const chunks: { begin: Date; end: Date }[] = [];
    let chunkStart = new Date(start);

    while (chunkStart < end) {
      const chunkEnd = new Date(chunkStart);
      chunkEnd.setDate(chunkEnd.getDate() + MAX_DAYS);

      // Don't exceed the end date
      const actualEnd = new Date(Math.min(chunkEnd.getTime(), end.getTime()));

      chunks.push({ begin: new Date(chunkStart), end: actualEnd });

      // Next chunk starts the day after this chunk ends
      chunkStart = new Date(actualEnd);
      chunkStart.setDate(chunkStart.getDate() + 1);
    }

    const reports: MPReport[] = [];

    console.log(`[MP Service] createReportBulk: Generating ${chunks.length} chunks`);

    let index = 0;
    for (const chunk of chunks) {
      index++;
      onProgress?.(index, chunks.length);

      // Format dates as ISO with time for MP API (YYYY-MM-DDTHH:MM:SSZ)
      // Begin date: start of day, End date: end of day
      const beginDate = new Date(chunk.begin);
      beginDate.setUTCHours(0, 0, 0, 0);

      const endDate = new Date(chunk.end);
      endDate.setUTCHours(23, 59, 59, 999);

      const beginStr = `${beginDate.toISOString().split(".")[0] ?? ""}Z`;
      const endStr = `${endDate.toISOString().split(".")[0] ?? ""}Z`;

      console.log(
        `[MP Service] Creating chunk ${index}/${chunks.length}: ${beginStr} to ${endStr}`,
      );

      const report = await MPService.createReport(beginDate, endDate, type);
      reports.push(report);
    }

    console.log(`[MP Service] createReportBulk: Successfully created ${reports.length} reports`);
    return reports;
  },

  downloadReport: async (fileName: string, type: MpReportType = "release"): Promise<Blob> => {
    const baseUrl = getBaseUrl(type);
    return apiClient.getRaw<Blob>(`${baseUrl}/reports/download/${encodeURIComponent(fileName)}`, {
      responseType: "blob",
    });
  },

  listReports: async (
    type: MpReportType = "release",
    params?: { limit?: number; offset?: number },
  ): Promise<MPReportListResponse> => {
    const baseUrl = getBaseUrl(type);
    const query = new URLSearchParams();
    if (params?.limit != null) query.set("limit", String(params.limit));
    if (params?.offset != null) query.set("offset", String(params.offset));
    const response = await apiClient.get<{ reports: MPReport[]; total: number; status: string }>(
      `${baseUrl}/reports?${query.toString()}`,
      { responseSchema: MPReportListResponseSchema },
    );
    const normalizeReportStatus = (report: MPReport): MPReport => {
      const status = report.status ?? report.status_detail ?? report.state;
      if (status) return { ...report, status };
      if (!report.file_name) return { ...report, status: "processing" };
      return report;
    };
    return {
      reports: (response.reports ?? []).map(normalizeReportStatus),
      total: response.total ?? 0,
    };
  },
  listSyncLogs: async (params?: {
    limit?: number;
    offset?: number;
  }): Promise<{
    logs: MpSyncLog[];
    total: number;
  }> => {
    const query = new URLSearchParams();
    if (params?.limit != null) query.set("limit", String(params.limit));
    if (params?.offset != null) query.set("offset", String(params.offset));
    const response = await apiClient.get<{ logs: MpSyncLog[]; status: string; total: number }>(
      `/api/mercadopago/sync/logs?${query.toString()}`,
      { responseSchema: MpSyncLogsResponseSchema },
    );
    return { logs: response.logs ?? [], total: response.total ?? 0 };
  },

  processReport: async (fileName: string, type: MpReportType): Promise<ImportStats> => {
    const data = await apiClient.post<ProcessReportResponse>(
      "/api/mercadopago/process-report",
      {
        fileName,
        reportType: type,
      },
      { responseSchema: ProcessReportResponseSchema },
    );
    return data.stats;
  },
};

export type { MpReportType } from "../../shared/mercadopago";
