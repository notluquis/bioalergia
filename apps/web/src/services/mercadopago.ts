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

  processReport: async (fileName: string, type: MpReportType): Promise<void> => {
    const res = await fetch("/api/mercadopago/process-report", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ fileName, reportType: type }),
    });
    if (!res.ok) await handleApiError(res, "Error al procesar reporte");
  },
};

export type { MpReportType };
