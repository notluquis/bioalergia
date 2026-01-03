/**
 * MercadoPago Frontend Service
 * Types aligned with backend: server/schemas/mercadopago.ts
 */

// Weekday type for weekly frequency
type Weekday = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

export interface MPReportConfig {
  file_name_prefix: string;
  columns: { key: string }[];
  frequency: {
    type: "daily" | "weekly" | "monthly";
    value: number | Weekday; // daily=0, weekly=Weekday, monthly=1-31
    hour: number;
  };
  sftp_info?: {
    server?: string;
    password?: string;
    remote_dir?: string;
    port?: number;
    username?: string;
  };
  separator?: string;
  display_timezone?: string; // default: "GMT-04"
  report_translation?: "en" | "es" | "pt";
  notification_email_list?: (string | null)[];
  include_withdrawal_at_end?: boolean; // default: true
  check_available_balance?: boolean; // default: true
  compensate_detail?: boolean; // default: true
  execute_after_withdrawal?: boolean; // default: false
  scheduled?: boolean; // default: false
}

export interface MPReport {
  id: number;
  begin_date: string;
  end_date: string;
  created_from: "manual" | "schedule";
  // Optional fields
  account_id?: number;
  currency_id?: string;
  generation_date?: string;
  last_modified?: string;
  report_id?: number;
  retries?: number;
  status?: string;
  sub_type?: "release";
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

export const MPService = {
  getConfig: async (): Promise<MPReportConfig> => {
    const res = await fetch("/api/mercadopago/config");
    if (!res.ok) {
      // Config might not exist yet (404), return null-ish or throw
      if (res.status === 404) {
        throw new Error("No hay configuración de MercadoPago. Crea una nueva.");
      }
      await handleApiError(res, "Error al obtener configuración");
    }
    return res.json();
  },

  updateConfig: async (data: Partial<MPReportConfig>): Promise<MPReportConfig> => {
    const res = await fetch("/api/mercadopago/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) await handleApiError(res, "Error al actualizar configuración");
    return res.json();
  },

  createConfig: async (data: Partial<MPReportConfig>): Promise<MPReportConfig> => {
    const res = await fetch("/api/mercadopago/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) await handleApiError(res, "Error al crear configuración");
    return res.json();
  },

  listReports: async (): Promise<MPReport[]> => {
    const res = await fetch("/api/mercadopago/reports");
    if (!res.ok) await handleApiError(res, "Error al obtener reportes");
    return res.json();
  },

  createReport: async (beginDate: string, endDate: string): Promise<MPReport> => {
    const res = await fetch("/api/mercadopago/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ begin_date: beginDate, end_date: endDate }),
    });
    if (!res.ok) await handleApiError(res, "Error al crear reporte");
    return res.json();
  },

  downloadReport: async (fileName: string): Promise<Blob> => {
    const res = await fetch(`/api/mercadopago/reports/download/${encodeURIComponent(fileName)}`);
    if (!res.ok) await handleApiError(res, "Error al descargar reporte");
    return res.blob();
  },

  enableSchedule: async (): Promise<MPReport> => {
    const res = await fetch("/api/mercadopago/schedule", { method: "POST" });
    if (!res.ok) await handleApiError(res, "Error al activar programación");
    return res.json();
  },

  disableSchedule: async (): Promise<MPReport> => {
    const res = await fetch("/api/mercadopago/schedule", { method: "DELETE" });
    if (!res.ok) await handleApiError(res, "Error al desactivar programación");
    return res.json();
  },
};
