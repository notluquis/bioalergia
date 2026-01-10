/**
 * MercadoPago Frontend Service
 * Reports list, create, and download functionality only
 */

import { MpReportType } from "../../shared/mercadopago";
import { apiClient } from "../lib/apiClient";

export interface MPReport {
  id: number;
  begin_date: string;
  end_date: string;
  created_from: "manual" | "schedule";
  date_created?: string;
  status?: string;
  file_name?: string;
}

/**
 * Statistics returned after processing a report
 */
export interface ImportStats {
  totalRows: number;
  validRows: number;
  skippedRows: number;
  insertedRows: number;
  duplicateRows: number;
  errors: string[];
}

interface ProcessReportResponse {
  status: string;
  message: string;
  stats: ImportStats;
}

function getBaseUrl(type: MpReportType = "release") {
  return type === "release" ? "/api/mercadopago" : "/api/mercadopago/settlement";
}

export const MPService = {
  listReports: async (type: MpReportType = "release"): Promise<MPReport[]> => {
    const baseUrl = getBaseUrl(type);
    return apiClient.get<MPReport[]>(`${baseUrl}/reports`);
  },

  createReport: async (beginDate: string, endDate: string, type: MpReportType = "release"): Promise<MPReport> => {
    const baseUrl = getBaseUrl(type);
    return apiClient.post<MPReport>(`${baseUrl}/reports`, { begin_date: beginDate, end_date: endDate });
  },

  downloadReport: async (fileName: string, type: MpReportType = "release"): Promise<Blob> => {
    const baseUrl = getBaseUrl(type);
    return apiClient.get<Blob>(`${baseUrl}/reports/download/${encodeURIComponent(fileName)}`, { responseType: "blob" });
  },

  processReport: async (fileName: string, type: MpReportType): Promise<ImportStats> => {
    const data = await apiClient.post<ProcessReportResponse>("/api/mercadopago/process-report", {
      fileName,
      reportType: type,
    });
    return data.stats;
  },

  /**
   * Create multiple reports if date range exceeds 60 days (MP limit is 62)
   * Returns array of created reports and calls onProgress for each
   */
  createReportBulk: async (
    beginDate: string,
    endDate: string,
    type: MpReportType,
    onProgress?: (current: number, total: number) => void
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
      const actualEnd = chunkEnd > end ? end : chunkEnd;

      chunks.push({ begin: new Date(chunkStart), end: actualEnd });

      // Next chunk starts the day after this chunk ends
      chunkStart = new Date(actualEnd);
      chunkStart.setDate(chunkStart.getDate() + 1);
    }

    const reports: MPReport[] = [];

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

      const beginStr = beginDate.toISOString().split(".")[0] + "Z";
      const endStr = endDate.toISOString().split(".")[0] + "Z";

      const report = await MPService.createReport(beginStr, endStr, type);
      reports.push(report);
    }

    return reports;
  },
};

export type { MpReportType };
