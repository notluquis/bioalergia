import dayjs from "dayjs";
import { describe, expect, it } from "vitest";

import type { TimesheetEntry } from "./types";
import { buildBulkRows, normalizeTimeString } from "./utils";

describe("timesheets utils", () => {
  it("maps work_date strings to the correct local day", () => {
    const entries: TimesheetEntry[] = [
      {
        comment: null,
        employee_id: 2,
        end_time: "18:00",
        id: 84,
        overtime_minutes: 0,
        start_time: "09:40",
        work_date: "2026-01-12",
        worked_minutes: 500,
      },
    ];

    const rows = buildBulkRows("2026-01", entries);
    const row = rows.find((item) => dayjs(item.date).format("YYYY-MM-DD") === "2026-01-12");

    expect(row).toBeDefined();
    expect(row?.entrada).toBe("09:40");
    expect(row?.salida).toBe("18:00");
  });

  it("normalizes time strings to HH:MM", () => {
    expect(normalizeTimeString("09:40:00")).toBe("09:40");
    expect(normalizeTimeString("09:40")).toBe("09:40");
  });
});
