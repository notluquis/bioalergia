import type { db } from "@finanzas/db";

// Helper to infer types from the ZenStack client
export type EmployeeWhereInput = NonNullable<Parameters<typeof db.employee.findMany>[0]>["where"];
export type EmployeeCreateInput = NonNullable<Parameters<typeof db.employee.create>[0]>["data"];
export type EmployeeUpdateInput = NonNullable<Parameters<typeof db.employee.update>[0]>["data"];

export type EmployeeTimesheetWhereInput = NonNullable<
  Parameters<typeof db.employeeTimesheet.findMany>[0]
>["where"];
export type EmployeeTimesheetCreateInput = NonNullable<
  Parameters<typeof db.employeeTimesheet.create>[0]
>["data"];
export type EmployeeTimesheetUpdateInput = NonNullable<
  Parameters<typeof db.employeeTimesheet.update>[0]
>["data"];
// GetPayload is harder to infer directly without using the specific return type of a function,
// but we can usually rely on the return value of the client methods.
// For explicit typing of variables:
export type EmployeeTimesheet = Awaited<ReturnType<typeof db.employeeTimesheet.findUnique>>;

export type EventWhereInput = NonNullable<Parameters<typeof db.event.findMany>[0]>["where"];
export type EventCreateInput = NonNullable<Parameters<typeof db.event.create>[0]>["data"];
export type EventUpdateInput = NonNullable<Parameters<typeof db.event.update>[0]>["data"];

export type SyncLogWhereInput = NonNullable<Parameters<typeof db.syncLog.findMany>[0]>["where"];

export type PersonCreateInput = NonNullable<Parameters<typeof db.person.create>[0]>["data"];
export type PersonUpdateInput = NonNullable<Parameters<typeof db.person.update>[0]>["data"];
