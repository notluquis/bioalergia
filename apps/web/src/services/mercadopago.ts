/**
 * MercadoPago Frontend Service
 * Reports list, create, and download functionality only
 */

import { MpReportType } from "../../shared/mercadopago";

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

/**
 * Helper to extract error message from API response
 */
async function handleApiError(res: Response, fallbackMessage: string): Promise<never> {
  let errorMessage = fallbackMessage;
  try {
    const body = await res.json();
    if (body.message) {
      errorMessage = body.message;
    } else if (body.error) {
      errorMessage = body.error;
    }
  } catch {
    errorMessage = `${fallbackMessage}: ${res.status} ${res.statusText}`;
  }
  throw new Error(errorMessage);
}

function getBaseUrl(type: MpReportType = "release") {
  return type === "release" ? "/api/mercadopago" : "/api/mercadopago/settlement";
}

export const MPService = {
  listReports: async (type: MpReportType = "release"): Promise<MPReport[]> => {
    const baseUrl = getBaseUrl(type);
    const res = await fetch(`${baseUrl}/reports`);
    if (!res.ok) await handleApiError(res, "Error al obtener reportes");
    return res.json();
  },

  createReport: async (beginDate: string, endDate: string, type: MpReportType = "release"): Promise<MPReport> => {
    const baseUrl = getBaseUrl(type);
    const res = await fetch(`${baseUrl}/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ begin_date: beginDate, end_date: endDate }),
    });
    if (!res.ok) await handleApiError(res, "Error al crear reporte");
    return res.json();
  },

  downloadReport: async (fileName: string, type: MpReportType = "release"): Promise<Blob> => {
    const baseUrl = getBaseUrl(type);
    const res = await fetch(`${baseUrl}/reports/download/${encodeURIComponent(fileName)}`);
    if (!res.ok) await handleApiError(res, "Error al descargar reporte");
    return res.blob();
  },

  processReport: async (fileName: string, type: MpReportType): Promise<ImportStats> => {
    const res = await fetch("/api/mercadopago/process-report", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ fileName, reportType: type }),
    });
    if (!res.ok) await handleApiError(res, "Error al procesar reporte");
    const data: ProcessReportResponse = await res.json();
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
    const end = new Date(endDate);

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
