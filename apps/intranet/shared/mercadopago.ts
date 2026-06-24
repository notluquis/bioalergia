/**
 * Shared MercadoPago Types
 * Minimal types needed for reports functionality
 */

export type MpReportType = "release" | "settlement";

/**
 * Report types that can appear in import-change audit rows. Includes "withdraw"
 * (Retiros) which is imported via CSV and never flows through the
 * create/list/download report inputs.
 */
export type MpChangeReportType = MpReportType | "withdraw";
