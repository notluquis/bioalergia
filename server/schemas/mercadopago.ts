/**
 * MercadoPago API schemas
 */
import { z } from "zod";

export const createReportSchema = z.object({
  begin_date: z.string(), // ISO String expected e.g. "2023-01-01T00:00:00Z"
  end_date: z.string(),
});

export const frequencySchema = z.object({
  type: z.enum(["daily", "weekly", "monthly"]),
  value: z.number().int().min(1),
  hour: z.number().int().min(0).max(23),
});

export const columnSchema = z.object({
  key: z.string().min(1),
});

export const sftpInfoSchema = z
  .object({
    server: z.string().optional(),
    password: z.string().optional(),
    remote_dir: z.string().optional(),
    port: z.number().optional(),
    username: z.string().optional(),
  })
  .optional();

export const mpConfigSchema = z.object({
  file_name_prefix: z.string().min(1),
  columns: z.array(columnSchema).min(1),
  frequency: frequencySchema,
  sftp_info: sftpInfoSchema,
  separator: z.string().optional(),
  display_timezone: z.string().optional(),
  report_translation: z.string().optional(),
  notification_email_list: z.array(z.string().email().or(z.null())).optional(),
  include_withdrawal_at_end: z.boolean().optional(),
  check_available_balance: z.boolean().optional(),
  compensate_detail: z.boolean().optional(),
  execute_after_withdrawal: z.boolean().optional(),
});
