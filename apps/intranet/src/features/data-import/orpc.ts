import { createORPCClient, ORPCError } from "@orpc/client";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import type { UnsafeORPCClient } from "@/lib/orpc-client";

const csvUploadORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export const csvUploadORPCClient = createORPCClient(csvUploadORPCLink, {
  path: ["api", "orpc", "csv-upload", "rpc"],
}) as unknown as UnsafeORPCClient;

export type CsvImportTable =
  | "counterparts"
  | "daily_balances"
  | "daily_production_balances"
  | "dte_purchases"
  | "dte_sales"
  | "employee_timesheets"
  | "employees"
  | "inventory_items"
  | "people"
  | "services"
  | "transactions"
  | "withdrawals";

export function toCsvUploadApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  if (error instanceof ORPCError) {
    return new ApiError(error.message, error.status, error.data);
  }
  if (error instanceof Error) {
    return new ApiError(error.message, 500);
  }
  return new ApiError("Error inesperado", 500, error);
}
