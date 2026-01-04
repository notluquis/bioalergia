import { MP_ACCESS_TOKEN } from "../config.js";
import { logger } from "../lib/logger.js";

const MP_API_URL = "https://api.mercadopago.com/v1/account/release_report";

// Weekday values for weekly frequency
type Weekday = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

// Types derived from MercadoPago API documentation
export interface ReportConfig {
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
  display_timezone?: string; // Default: "GMT-04"
  report_translation?: "en" | "es" | "pt";
  notification_email_list?: (string | null)[];
  include_withdrawal_at_end?: boolean; // Default: true
  check_available_balance?: boolean; // Default: true
  compensate_detail?: boolean; // Default: true
  execute_after_withdrawal?: boolean; // Default: false
  scheduled?: boolean; // Default: false
}

export interface CreateReportResponse {
  id: number;
  date_created: string;
  created_from: string;
  file_name: string;
  mode: string;
  generated: boolean;
  report_type: string;
  external_id: string;
}

async function mpFetch(endpoint: string, options: RequestInit = {}) {
  if (!MP_ACCESS_TOKEN) {
    throw new Error("Mercado Pago Access Token not configured (MP_ACCESS_TOKEN)");
  }

  const url = `${MP_API_URL}${endpoint}`;
  const headers = {
    Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    ...options.headers,
  };

  // Debug logging
  logger.info({
    event: "mp_api_request",
    url,
    method: options.method || "GET",
    body: options.body,
  });

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error({ event: "mercadopago_api_error", status: response.status, body: errorBody, url });
    throw new Error(`Mercado Pago API Error: ${response.status} ${response.statusText} - ${errorBody}`);
  }

  // Handle empty responses (like some DELETE or 204s)
  if (response.status === 204) return null;

  return response.json();
}

/**
 * Get current report configuration
 * GET /v1/account/release_report/config
 */
export async function getReportConfig(): Promise<ReportConfig> {
  return mpFetch("/config");
}

/**
 * Update report configuration
 * PUT /v1/account/release_report/config
 * @note This replaces the entire config. Make sure to send all required fields.
 */
export async function updateReportConfig(config: Partial<ReportConfig>): Promise<ReportConfig> {
  return mpFetch("/config", {
    method: "PUT",
    body: JSON.stringify(config),
  });
}

/**
 * Create initial configuration
 * POST /v1/account/release_report/config
 * @note Only allowed if no config exists.
 */
export async function createReportConfig(config: Partial<ReportConfig>): Promise<ReportConfig> {
  return mpFetch("/config", {
    method: "POST",
    body: JSON.stringify(config),
  });
}

/**
 * Manually generate a report
 * POST /v1/account/release_report
 */
export async function createReport(beginDate: string, endDate: string): Promise<CreateReportResponse> {
  const body = {
    begin_date: beginDate,
    end_date: endDate,
  };
  logger.info({ event: "mp_create_report_request", body });
  return mpFetch("", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * Get a specific report by ID
 * GET /v1/account/release_report/:id
 */
export async function getReport(id: string): Promise<CreateReportResponse> {
  return mpFetch(`/${id}`);
}

/**
 * List reports
 * GET /v1/account/release_report/list
 */
export async function listReports(): Promise<CreateReportResponse[]> {
  return mpFetch("/list");
}

/**
 * Download a report file
 * GET /v1/account/release_report/:fileName
 * Returns the raw Response object to allow streaming
 */
export async function downloadReport(fileName: string): Promise<Response> {
  if (!MP_ACCESS_TOKEN) {
    throw new Error("Mercado Pago Access Token not configured (MP_ACCESS_TOKEN)");
  }

  const url = `${MP_API_URL}/${fileName}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error({ event: "mercadopago_download_error", status: response.status, body: errorBody, url });
    throw new Error(`Mercado Pago Download Error: ${response.status}`);
  }

  return response;
}

/**
 * Enable automatic generation (Schedule)
 * POST /v1/account/release_report/schedule
 */
export async function enableSchedule(): Promise<unknown> {
  return mpFetch("/schedule", {
    method: "POST",
  });
}

/**
 * Disable automatic generation (Schedule)
 * DELETE /v1/account/release_report/schedule
 */
export async function disableSchedule(): Promise<unknown> {
  return mpFetch("/schedule", {
    method: "DELETE",
  });
}
