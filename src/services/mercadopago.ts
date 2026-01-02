export interface MPReportConfig {
  file_name_prefix: string;
  columns: { key: string }[];
  frequency: {
    type: "daily" | "weekly" | "monthly";
    value: number;
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
  display_timezone?: string;
  report_translation?: string;
  notification_email_list?: (string | null)[];
  include_withdrawal_at_end?: boolean;
  check_available_balance?: boolean;
  compensate_detail?: boolean;
  execute_after_withdrawal?: boolean;
  scheduled?: boolean;
}

export interface MPReport {
  id: number;
  date_created: string;
  created_from: string;
  file_name: string;
  mode: string;
  generated: boolean;
  report_type: string;
  external_id: string;
}

export const MPService = {
  getConfig: async (): Promise<MPReportConfig> => {
    const res = await fetch("/api/mercadopago/config");
    if (!res.ok) throw new Error("Failed to fetch configuration");
    return res.json();
  },

  updateConfig: async (config: Partial<MPReportConfig>): Promise<MPReportConfig> => {
    const res = await fetch("/api/mercadopago/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    if (!res.ok) throw new Error("Failed to update configuration");
    return res.json();
  },

  createConfig: async (config: Partial<MPReportConfig>): Promise<MPReportConfig> => {
    const res = await fetch("/api/mercadopago/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    if (!res.ok) throw new Error("Failed to create configuration");
    return res.json();
  },

  listReports: async (): Promise<MPReport[]> => {
    const res = await fetch("/api/mercadopago/reports");
    if (!res.ok) throw new Error("Failed to fetch reports");
    return res.json();
  },

  createReport: async (beginDate: string, endDate: string): Promise<MPReport> => {
    const res = await fetch("/api/mercadopago/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ begin_date: beginDate, end_date: endDate }),
    });
    if (!res.ok) throw new Error("Failed to create report");
    return res.json();
  },

  enableSchedule: async (): Promise<unknown> => {
    const res = await fetch("/api/mercadopago/schedule", { method: "POST" });
    if (!res.ok) throw new Error("Failed to enable schedule");
    return res.json();
  },

  disableSchedule: async (): Promise<unknown> => {
    const res = await fetch("/api/mercadopago/schedule", { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to disable schedule");
    return res.json();
  },
};
