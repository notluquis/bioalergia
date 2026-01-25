import { checkMpConfig, MP_ACCESS_TOKEN, MP_API, mpFetch, safeMpJson } from "./client";
import { type ImportStats, processReportUrl } from "./ingest";

// Re-export webhook password for controller
export { MP_WEBHOOK_PASSWORD } from "./client";
export type { ImportStats } from "./ingest";

export const MercadoPagoService = {
  /**
   * List available reports from MP API
   */
  async listReports(type: "release" | "settlement") {
    const baseUrl = type === "release" ? MP_API.RELEASE : MP_API.SETTLEMENT;
    const res = await mpFetch("/list", baseUrl);
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
    const urlWithQuery = appendReportRange(baseUrl, range);
    const res = await mpFetch("", urlWithQuery, {
      method: "POST",
      body: JSON.stringify(range),
    });
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

    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
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
};

function appendReportRange(baseUrl: string, range: { begin_date: string; end_date: string }) {
  const params = new URLSearchParams();
  if (range.begin_date) params.set("begin_date", range.begin_date);
  if (range.end_date) params.set("end_date", range.end_date);
  const query = params.toString();
  if (!query) return baseUrl;
  return `${baseUrl}?${query}`;
}
