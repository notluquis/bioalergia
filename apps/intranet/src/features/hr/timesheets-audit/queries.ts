/**
 * Query keys for the timesheet-audit surface and its sibling read models.
 *
 * `audit` is the overlap-detection multi-employee fetch (this feature).
 * `months` and `emailPreview` belong to the adjacent `timesheets` feature
 * but are centralized here per the audit consolidation. They mirror the
 * exact tuples previously inlined — do NOT fold `months` into
 * `timesheetKeys.months()` (`["timesheets","months"]`): that is a
 * structurally distinct cache entry and merging it would change behavior.
 */
export const timesheetAuditKeys = {
  all: ["timesheet-audit"] as const,
  audit: (
    employeeIds: number[],
    firstDay: Date | undefined,
    lastDay: Date | undefined,
    sortedRanges: { end: Date; start: Date }[]
  ) => ["timesheet-audit", employeeIds, firstDay, lastDay, sortedRanges] as const,
  emailPreview: (request: unknown) => ["timesheet-email-preview", request] as const,
  months: () => ["timesheet-months"] as const,
};
