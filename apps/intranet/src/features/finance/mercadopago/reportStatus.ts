export const REPORT_PENDING_REGEX =
  /processing|pending|in_progress|waiting|generating|queued|creating/i;

export function isReportPending(status?: null | string): boolean {
  if (!status) {
    return false;
  }
  return REPORT_PENDING_REGEX.test(status);
}
