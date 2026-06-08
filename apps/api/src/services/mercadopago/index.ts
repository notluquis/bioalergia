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
  // Present on /search results, absent on /list tasks (which carry
  // generation_date). Declared so the merge in listReports can backfill it.
  date_created?: string | null;
}

// Mirrors the frontend REPORT_PENDING_REGEX: a report whose generation task
// hasn't materialized a downloadable file yet shows as "Generando".
const PENDING_REPORT_STATUSES = new Set([
  "pending",
  "processing",
  "in_progress",
  "waiting",
  "queued",
  "creating",
  "generating",
]);

function isPendingReportStatus(status?: string | null): boolean {
  return status ? PENDING_REPORT_STATUSES.has(status.toLowerCase()) : false;
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

export interface MPListReportsResult {
  reports: Array<MPReportTask | MPSearchResultItem>;
  total: number;
}

export { isSettlementReport } from "./settlement-detector.ts";

export const MercadoPagoService = {
  /**
   * List available reports from MP API
   */
  async listReports(
    type: "release" | "settlement",
    options?: { limit?: number; offset?: number; silent?: boolean }
  ): Promise<MPListReportsResult> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;
    const baseUrl = type === "release" ? MP_API.RELEASE : MP_API.SETTLEMENT;

    // 1. Available files (reliable file_name) via /search.
    let files: Array<MPReportTask | MPSearchResultItem> = [];
    let total = 0;
    let searchHasFiles = false;
    try {
      const searchData = await this.searchReports(type, { limit, offset }, options);
      files = searchData.results ?? [];
      total = searchData.paging?.total ?? files.length;
      searchHasFiles = files.length > 0;
    } catch (error) {
      if (!options?.silent) {
        console.warn(`[MP Service] ${type} report search failed; falling back to list:`, error);
      }
    }

    // 2. Generation tasks via /list. This surfaces in-flight reports
    //    ("Generando") that /search can't return yet because no file exists.
    //    Released-money /list only carries finished files while settlement
    //    /list carries the full task queue incl. pending — merging is correct
    //    for both and is what lets "liberación" show the in-flight state
    //    instead of jumping straight to "disponible".
    let tasks: MPReportTask[] = [];
    try {
      const res = await mpFetch("/list", baseUrl, { log: false });
      const listData = await safeMpJson(res);
      if (Array.isArray(listData)) {
        tasks = listData as MPReportTask[];
      }
    } catch (error) {
      if (!options?.silent) {
        console.warn(`[MP Service] ${type} report /list failed:`, error);
      }
    }

    // If /search returned nothing, fall back to the full /list (old behavior)
    // so a type whose /search is empty never regresses.
    if (!searchHasFiles) {
      return { reports: tasks.length > 0 ? tasks : files, total: tasks.length || total };
    }

    // 3. Prepend in-flight tasks not yet represented as an available file.
    //    Match by file_name; a task without a file_name is always in-flight.
    const knownFileNames = new Set(
      files
        .map((report) => ("file_name" in report ? report.file_name : null))
        .filter((name): name is string => Boolean(name))
    );
    const pending = tasks
      .filter(
        (task) =>
          isPendingReportStatus(task.status) &&
          (!task.file_name || !knownFileNames.has(task.file_name))
      )
      .map((task) => ({ ...task, date_created: task.date_created ?? task.generation_date ?? null }));

    // Only the first page carries the in-flight head; deeper pages stay pure
    // history so pagination math doesn't drift.
    const reports = offset === 0 ? [...pending, ...files] : files;
    return { reports, total: offset === 0 ? total + pending.length : total };
  },

  /**
   * Create a new manual report generation task
   */
  async createReport(
    type: "release" | "settlement",
    range: { begin_date: string; end_date: string }
  ) {
    console.log(`[MP Service] Creating ${type} report with range:`, range);
    const baseUrl = type === "release" ? MP_API.RELEASE : MP_API.SETTLEMENT;
    const res = await mpFetch("", baseUrl, {
      method: "POST",
      body: JSON.stringify(range),
    });
    if (res.status === 203) {
      throw new Error(
        `MP API 203 Non-Authoritative: report could not be created for range ${range.begin_date}..${range.end_date}; retry needed`
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
    source: { url?: string; fileName?: string; syncLogId?: bigint }
  ): Promise<ImportStats> {
    let downloadUrl: string | undefined;

    if (source.fileName) {
      const baseUrl = type === "release" ? MP_API.RELEASE : MP_API.SETTLEMENT;
      downloadUrl = `${baseUrl}/${source.fileName}`;
    } else {
      downloadUrl = source.url;
    }

    if (!downloadUrl) {
      throw new Error("Either url or fileName must be provided");
    }

    return await processReportUrl(downloadUrl, type, { syncLogId: source.syncLogId });
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
    options?: { silent?: boolean }
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
    options?: { silent?: boolean }
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
