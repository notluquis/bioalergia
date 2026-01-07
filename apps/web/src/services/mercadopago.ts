/**
 * MercadoPago Frontend Service
 * Types aligned with backend: server/schemas/mercadopago.ts
 */

import { MpReleaseConfigFormData, MpSettlementConfigFormData } from "../../shared/mercadopago";

export type MpReportType = "release" | "settlement";

// Consolidated Config Interface (Union of both)
export type MPReportConfig = Partial<MpReleaseConfigFormData> & Partial<MpSettlementConfigFormData>;

export interface MPReport {
  id: number;
  begin_date: string;
  end_date: string;
  created_from: "manual" | "schedule";
  date_created?: string; // Added from API response
  // Optional fields
  account_id?: number;
  currency_id?: string;
  generation_date?: string;
  last_modified?: string;
  report_id?: number;
  retries?: number;
  status?: string;
  sub_type?: "release" | "settlement"; // added settlement
  user_id?: number;
  format?: string;
  file_name?: string;
  mode?: string;
  generated?: boolean;
  report_type?: string;
  external_id?: string;
}

/**
 * Helper to extract error message from API response
 */
async function handleApiError(res: Response, fallbackMessage: string): Promise<never> {
  let errorMessage = fallbackMessage;
  try {
    const body = await res.json();
    // MercadoPago API error format: { message: string, error: string, cause: [] }
    if (body.message) {
      errorMessage = body.message;
    } else if (body.error) {
      errorMessage = body.error;
    }
  } catch {
    // If JSON parsing fails, use the status text
    errorMessage = `${fallbackMessage}: ${res.status} ${res.statusText}`;
  }
  throw new Error(errorMessage);
}

// Helper to get base URL
function getBaseUrl(type: MpReportType = "release") {
  return type === "release" ? "/api/mercadopago" : "/api/mercadopago/settlement";
}

export const MPService = {
  getConfig: async (type: MpReportType = "release"): Promise<MPReportConfig> => {
    const baseUrl = getBaseUrl(type);
    const res = await fetch(`${baseUrl}/config`);
    if (!res.ok) {
      // Config might not exist yet (404), return empty or throw
      if (res.status === 404) {
        throw new Error("No hay configuración. Crea una nueva.");
      }
      await handleApiError(res, "Error al obtener configuración");
    }
    return res.json();
  },

  updateConfig: async (data: MPReportConfig, type: MpReportType = "release"): Promise<MPReportConfig> => {
    const baseUrl = getBaseUrl(type);
    const res = await fetch(`${baseUrl}/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(data),
    });
    if (!res.ok) await handleApiError(res, "Error al actualizar configuración");
    return res.json();
  },

  createConfig: async (data: MPReportConfig, type: MpReportType = "release"): Promise<MPReportConfig> => {
    const baseUrl = getBaseUrl(type);
    const res = await fetch(`${baseUrl}/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(data),
    });
    if (!res.ok) await handleApiError(res, "Error al crear configuración");
    return res.json();
  },

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

  enableSchedule: async (type: MpReportType = "release"): Promise<MPReport> => {
    const baseUrl = getBaseUrl(type);
    const res = await fetch(`${baseUrl}/schedule`, { method: "POST" });
    if (!res.ok) await handleApiError(res, "Error al activar programación");
    return res.json();
  },

  disableSchedule: async (type: MpReportType = "release"): Promise<MPReport> => {
    const baseUrl = getBaseUrl(type);
    const res = await fetch(`${baseUrl}/schedule`, { method: "DELETE" });
    if (!res.ok) await handleApiError(res, "Error al desactivar programación");
    return res.json();
  },
};
