import { syncFinancialTransactions, syncFinancialTransactionsBySourceIds } from "../finance.ts";
import {
  checkMpConfig,
  MP_ACCESS_TOKEN,
  MP_API,
  MP_WEBHOOK_PASSWORD,
  mpFetch,
  safeMpJson,
} from "./client.ts";
import { type ImportStats, processReportUrl } from "./ingest.ts";

export type { ImportStats };
export { MP_WEBHOOK_PASSWORD };

export interface MPReportTask {
  id?: number;
  user_id?: number;
  account_id?: number;
  begin_date?: string;
  end_date?: string;
  created_from?: "manual" | "schedule";
  is_test?: boolean;
  is_reserve?: boolean;
  status?: "pending" | "processing" | "processed" | "failed" | "deleted";
  report_type?: string;
  generation_date?: string;
  report_id?: number | null;
  last_modified?: string;
  retries?: number;
  sub_type?: string | null;
  currency_id?: string;
  format?: "CSV" | "XLSX";
  file_name?: string | null;
}

export interface MPSearchResultItem {
  id?: number;
  user_id?: number;
  begin_date?: string;
  end_date?: string;
  file_name?: string;
  created_from?: string;
  date_created?: string;
  download_date?: string | null;
  status?: string;
  origin?: string;
  sub_type?: string | null;
  metadata?: string;
  model?: string;
  account_id?: number;
  currency_id?: string;
  format?: string;
}

export interface MPSearchResponse {
  paging?: { total?: number; limit?: number; offset?: number };
  results?: MPSearchResultItem[];
}

const SETTLEMENT_HINTS = [
  "settlement",
  "liquidaci",
  "account_money",
  "all_transactions",
  "todas_las_transacciones",
  "todas-las-transacciones",
];

export function isSettlementReport(...inputs: Array<string | undefined | null>): boolean {
  const haystack = inputs
    .filter((v): v is string => Boolean(v))
    .join(" ")
    .toLowerCase();
  return SETTLEMENT_HINTS.some((hint) => haystack.includes(hint));
}

export const MercadoPagoService = {
  /**
   * List available reports from MP API
   */
  async listReports(type: "release" | "settlement", options?: { silent?: boolean }) {
    const baseUrl = type === "release" ? MP_API.RELEASE : MP_API.SETTLEMENT;
    const res = await mpFetch("/list", baseUrl, { log: !options?.silent });
    return safeMpJson(res);
  },

  /**
   * Create a new manual report generation task
   */
  async createReport(
    type: "release" | "settlement",
    range: { begin_date: string; end_date: string },
  ) {
    console.log(`[MP Service] Creating ${type} report with range:`, range);
    const baseUrl = type === "release" ? MP_API.RELEASE : MP_API.SETTLEMENT;
    const res = await mpFetch("", baseUrl, {
      method: "POST",
      body: JSON.stringify(range),
    });
    if (res.status === 203) {
      throw new Error(
        `MP API 203 Non-Authoritative: report could not be created for range ${range.begin_date}..${range.end_date}; retry needed`,
      );
    }
    const data = await safeMpJson(res);
    console.log(`[MP Service] ${type} report creation response:`, data);
    return data;
  },

  /**
   * Get a download stream for a report file
   */
  async downloadReport(type: "release" | "settlement", fileName: string) {
    checkMpConfig();
    const baseUrl = type === "release" ? MP_API.RELEASE : MP_API.SETTLEMENT;
    const url = `${baseUrl}/${fileName}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    });

    if (!res.ok) {
      throw new Error(`Download failed: ${res.status}`);
    }
    return res;
  },

  /**
   * Process a report by ingesting it into the database
   * Can accept a specific URL (webhook) or filename (manual sync)
   * Returns detailed import statistics
   */
  async processReport(
    type: "release" | "settlement",
    source: { url?: string; fileName?: string },
  ): Promise<ImportStats> {
    let downloadUrl = source.url;

    if (!downloadUrl && source.fileName) {
      const baseUrl = type === "release" ? MP_API.RELEASE : MP_API.SETTLEMENT;
      downloadUrl = `${baseUrl}/${source.fileName}`;
    }

    if (!downloadUrl) {
      throw new Error("Either url or fileName must be provided");
    }

    return await processReportUrl(downloadUrl, type);
  },

  /**
   * Search reports with paginated filters (preferred over /list — returns file_name reliably)
   */
  async searchReports(
    type: "release" | "settlement",
    filters: {
      id?: number;
      file_name?: string;
      begin_date?: string;
      end_date?: string;
      created_from?: "manual" | "schedule" | "manual,schedule";
      currency_id?: string;
      format?: "CSV" | "XLSX";
      offset?: number;
      limit?: number;
      range?: "date_created";
      range_begin_date?: string;
      range_end_date?: string;
    } = {},
    options?: { silent?: boolean },
  ): Promise<MPSearchResponse> {
    const baseUrl = type === "release" ? MP_API.RELEASE : MP_API.SETTLEMENT;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null) {
        params.set(key, String(value));
      }
    }
    const query = params.toString();
    const url = query ? `/search?${query}` : "/search";
    const res = await mpFetch(url, baseUrl, { log: !options?.silent });
    return (await safeMpJson(res)) as MPSearchResponse;
  },

  /**
   * Look up a single report-creation task by its id (created from createReport response)
   */
  async getReportTask(
    type: "release" | "settlement",
    taskId: number | string,
    options?: { silent?: boolean },
  ): Promise<MPReportTask> {
    const baseUrl = type === "release" ? MP_API.RELEASE : MP_API.SETTLEMENT;
    const res = await mpFetch(`/task/${taskId}`, baseUrl, { log: !options?.silent });
    return (await safeMpJson(res)) as MPReportTask;
  },

  /**
   * Enable MP-side automatic schedule for the configured frequency.
   * Hits POST /schedule and flips the `scheduled` flag to true.
   */
  async enableSchedule(type: "release" | "settlement") {
    const baseUrl = type === "release" ? MP_API.RELEASE : MP_API.SETTLEMENT;
    const res = await mpFetch("/schedule", baseUrl, { method: "POST" });
    return safeMpJson(res);
  },

  /**
   * Disable MP-side automatic schedule.
   */
  async disableSchedule(type: "release" | "settlement") {
    const baseUrl = type === "release" ? MP_API.RELEASE : MP_API.SETTLEMENT;
    const res = await mpFetch("/schedule", baseUrl, { method: "DELETE" });
    return safeMpJson(res);
  },

  async syncCashFlow(userId?: number, options?: { sourceIds?: string[] }) {
    if (options?.sourceIds && options.sourceIds.length > 0) {
      return syncFinancialTransactionsBySourceIds(options.sourceIds, userId ?? 0);
    }
    return syncFinancialTransactions(userId ?? 0);
  },
};

const MP_DATE_TRIM_REGEX = /\.\d{3}Z$/;

export function formatMpDate(date: Date) {
  return date.toISOString().replace(MP_DATE_TRIM_REGEX, "Z");
}

