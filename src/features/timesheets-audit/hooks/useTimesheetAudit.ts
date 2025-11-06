/**
 * Hook for managing timesheet audit state and data fetching
 */

import { useCallback, useEffect, useState } from "react";
import { fetchMultiEmployeeTimesheets } from "../api";
import type { TimesheetEntryWithEmployee } from "../types";

interface UseTimesheetAuditOptions {
  month: string;
  employeeIds: number[];
}

export function useTimesheetAudit({ month, employeeIds }: UseTimesheetAuditOptions) {
  const [entries, setEntries] = useState<TimesheetEntryWithEmployee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEntries = useCallback(async () => {
    if (!month || employeeIds.length === 0) {
      setEntries([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [year, monthNum] = month.split("-");
      const firstDay = `${year}-${monthNum}-01`;
      const lastDay = `${year}-${monthNum}-31`; // MySQL handles overage dates

      const data = await fetchMultiEmployeeTimesheets(employeeIds, firstDay, lastDay);
      setEntries(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error cargando datos de auditoría";
      setError(message);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [month, employeeIds]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  return { entries, loading, error };
}
